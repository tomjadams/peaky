// Package sse implements the SSE fan-out hub for peaky-sse.
//
// Architecture:
//   - One Hub per process.
//   - One dedicated PostgreSQL connection for LISTEN/NOTIFY (separate from the
//     query pool — database/sql does not expose which connection handles a query,
//     so we manage the LISTEN connection ourselves via pgx directly).
//   - Streams are registered per actor on SSE connect; the Hub accumulates
//     LISTEN calls on the shared PG connection as new channels are required.
//   - On NOTIFY the Hub fans the payload to every stream whose channel set
//     includes the notified channel.
//   - On stream close (client disconnect or server shutdown) the Hub removes
//     the stream; UNLISTEN is only called when no stream remains on a channel.
//
// Formal model: formal_verification/sync/sse_channel_alignment.fizz — the channel
// derivation here must stay aligned with the NOTIFY side, which is what that spec
// proves. Changing channel naming requires updating it.
package sse

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

// Stream represents one open SSE connection from a single browser tab.
// Fields are exported so that sse_test can construct Streams directly.
type Stream struct {
	ID       string
	ActorID  string
	Channels []string      // e.g. ["sync:review:catalog"]
	Ch       chan []byte   // buffered; handler reads from this
	Done     chan struct{} // closed when the stream is cleaned up
}

// listenCmd is a LISTEN/UNLISTEN command queued for the dispatch goroutine.
type listenCmd struct {
	channel string
	listen  bool // true = LISTEN, false = UNLISTEN
}

// Hub multiplexes PG NOTIFY messages to registered SSE streams.
type Hub struct {
	mu       sync.RWMutex
	streams  map[string]*Stream   // streamID → Stream
	channels map[string][]*Stream // channelName → Streams subscribed to it

	conn     *pgx.Conn      // dedicated LISTEN connection — only touched by dispatch
	commands chan listenCmd // queued for dispatch to execute serially
	dsn      string
	started  bool
}

// NewHub creates an uninitialised Hub. Call Start() to connect to PG.
func NewHub(dsn string) *Hub {
	return &Hub{
		dsn:      dsn,
		streams:  make(map[string]*Stream),
		channels: make(map[string][]*Stream),
		commands: make(chan listenCmd, 64),
	}
}

// Start opens the dedicated PG LISTEN connection and begins dispatching
// notifications. Returns after the goroutine is launched.
func (h *Hub) Start(ctx context.Context) error {
	conn, err := pgx.Connect(ctx, h.dsn)
	if err != nil {
		return fmt.Errorf("sse hub: connect: %w", err)
	}
	h.mu.Lock()
	h.conn = conn
	h.started = true
	h.mu.Unlock()
	slog.Info("sse hub: PG LISTEN connection established")

	go h.dispatch(ctx)
	return nil
}

// dispatch is the sole goroutine that touches h.conn. It interleaves
// notification waits with draining queued LISTEN/UNLISTEN commands.
// On transient errors it reconnects with exponential backoff (1s → 2s → 4s,
// capped at 30s). Only a context cancellation stops the loop.
func (h *Hub) dispatch(ctx context.Context) {
	backoff := 1 * time.Second
	const maxBackoff = 30 * time.Second
	const waitTimeout = 100 * time.Millisecond

	for {
		if ctx.Err() != nil {
			return
		}

		h.drainCommands(ctx)

		waitCtx, cancel := context.WithTimeout(ctx, waitTimeout)
		notification, err := h.conn.WaitForNotification(waitCtx)
		cancel()

		if err != nil {
			if ctx.Err() != nil {
				return // clean shutdown
			}
			if waitCtx.Err() == context.DeadlineExceeded {
				continue // normal timeout — loop back to drain commands
			}
			slog.Error("sse hub: wait for notification", "error", err)

			// Reconnect with exponential backoff.
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return
			}
			if err := h.reconnect(ctx); err != nil {
				slog.Error("sse hub: reconnect failed", "error", err, "retry_in", backoff.String())
				backoff *= 2
				if backoff > maxBackoff {
					backoff = maxBackoff
				}
				continue
			}
			slog.Info("sse hub: reconnected to PG LISTEN")
			backoff = 1 * time.Second
			continue
		}

		backoff = 1 * time.Second
		h.fan(notification.Channel, []byte(notification.Payload))
	}
}

// drainCommands executes all pending LISTEN/UNLISTEN commands on h.conn.
// Called only from dispatch — no concurrent access to h.conn.
func (h *Hub) drainCommands(ctx context.Context) {
	for {
		select {
		case cmd := <-h.commands:
			sql := "LISTEN"
			if !cmd.listen {
				sql = "UNLISTEN"
			}
			stmt := sql + " " + pgx.Identifier{cmd.channel}.Sanitize()
			if _, err := h.conn.Exec(ctx, stmt); err != nil {
				slog.Warn("sse hub: "+sql+" failed", "channel", cmd.channel, "error", err)
			} else {
				slog.Debug("sse hub: "+sql, "channel", cmd.channel)
			}
		default:
			return
		}
	}
}

// reconnect replaces the dedicated LISTEN connection and re-issues LISTEN
// for all channels that have active subscribers.
func (h *Hub) reconnect(ctx context.Context) error {
	if h.conn != nil {
		if err := h.conn.Close(ctx); err != nil {
			_ = err // broken connection being replaced; close failure is expected
		}
	}
	conn, err := pgx.Connect(ctx, h.dsn)
	if err != nil {
		return fmt.Errorf("sse hub: reconnect: %w", err)
	}
	h.conn = conn

	// Re-subscribe to all active channels.
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch, streams := range h.channels {
		if len(streams) > 0 {
			if _, err := conn.Exec(ctx, "LISTEN "+pgx.Identifier{ch}.Sanitize()); err != nil {
				slog.Warn("sse hub: re-LISTEN failed", "channel", ch, "error", err)
			}
		}
	}
	return nil
}

// fan delivers a raw payload to every stream subscribed to channel.
func (h *Hub) fan(channel string, payload []byte) {
	h.mu.RLock()
	streams := h.channels[channel]
	h.mu.RUnlock()

	for _, s := range streams {
		select {
		case s.Ch <- payload:
		default:
			// Slow client — drop notification; they'll catch up on 30s poll.
			slog.Warn("sse hub: slow client, dropping notification",
				"stream", s.ID, "actor", s.ActorID, "channel", channel)
		}
	}
}

// Register adds a new stream and queues LISTEN for any new channels.
func (h *Hub) Register(ctx context.Context, s *Stream) error {
	listenChannels := make([]string, 0, len(s.Channels))

	h.mu.Lock()
	h.streams[s.ID] = s

	for _, ch := range s.Channels {
		existing := h.channels[ch]
		h.channels[ch] = append(existing, s)

		// Decide whether this channel needs its first LISTEN while state is
		// stable under h.mu, but do not enqueue yet.
		if len(existing) == 0 && h.started {
			listenChannels = append(listenChannels, ch)
		}
	}
	h.mu.Unlock()

	for _, ch := range listenChannels {
		select {
		// Enqueue only after unlocking: a full commands buffer may block, and we
		// must never hold h.mu across a blocking send.
		case h.commands <- listenCmd{channel: ch, listen: true}:
		case <-ctx.Done():
			// Shutdown/disconnect wins over waiting forever for dispatch to drain.
			return nil
		}
	}

	return nil
}

// Deregister removes a stream and queues UNLISTEN for now-empty channels.
func (h *Hub) Deregister(ctx context.Context, streamID string) {
	unlistenChannels := make([]string, 0)

	h.mu.Lock()
	s, ok := h.streams[streamID]
	if !ok {
		h.mu.Unlock()
		return
	}
	delete(h.streams, streamID)
	close(s.Done)

	for _, ch := range s.Channels {
		updated := make([]*Stream, 0, len(h.channels[ch]))
		for _, existing := range h.channels[ch] {
			if existing.ID != streamID {
				updated = append(updated, existing)
			}
		}
		h.channels[ch] = updated

		// Decide whether this channel needs its final UNLISTEN while state is
		// stable under h.mu, but do not enqueue yet.
		if len(updated) == 0 && h.started {
			unlistenChannels = append(unlistenChannels, ch)
		}
	}
	h.mu.Unlock()

	for _, ch := range unlistenChannels {
		select {
		// Enqueue only after unlocking: a full commands buffer may block, and we
		// must never hold h.mu across a blocking send.
		case h.commands <- listenCmd{channel: ch, listen: false}:
		case <-ctx.Done():
			// Shutdown/disconnect wins over waiting forever for dispatch to drain.
			return
		}
	}
}

// Broadcast delivers payload to all streams subscribed to channel.
// Used by tests and for injecting synthetic notifications without a real PG.
func (h *Hub) Broadcast(channel string, payload []byte) {
	h.fan(channel, payload)
}
