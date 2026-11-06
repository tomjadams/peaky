package sse_test

import (
	"context"
	"testing"
	"time"

	"github.com/peaky-team/peaky/services/internal/sse"
)

// newStream is a test helper that builds a Stream with a buffered channel.
func newStream(t *testing.T, id, actorID string, channels []string) *sse.Stream {
	t.Helper()
	return &sse.Stream{
		ID:       id,
		ActorID:  actorID,
		Channels: channels,
		Ch:       make(chan []byte, 16),
		Done:     make(chan struct{}),
	}
}

func TestHub_RegisterAndReceive(t *testing.T) {
	// GIVEN a hub with one registered stream on "sync:review:catalog"
	hub := sse.NewHub("")

	s := newStream(t, "s1", "actor_1", []string{"sync:review:catalog"})
	if err := hub.Register(context.Background(), s); err != nil {
		t.Fatalf("Register: %v", err)
	}

	// WHEN broadcasting to that channel
	payload := []byte(`{"cursor":"t1","family":"review"}`)
	hub.Broadcast("sync:review:catalog", payload)

	// THEN the stream receives the payload
	select {
	case got := <-s.Ch:
		if string(got) != string(payload) {
			t.Errorf("got %s, want %s", got, payload)
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatal("expected payload on stream channel, got nothing")
	}
}

func TestHub_DeregisterStopsDelivery(t *testing.T) {
	// GIVEN a registered stream that is then deregistered
	hub := sse.NewHub("")
	ctx := context.Background()

	s := newStream(t, "s1", "actor_1", []string{"sync:review:catalog"})
	_ = hub.Register(ctx, s)
	hub.Deregister(ctx, "s1")

	// WHEN broadcasting to the channel
	hub.Broadcast("sync:review:catalog", []byte("msg"))

	// THEN the deregistered stream receives nothing
	select {
	case got := <-s.Ch:
		t.Errorf("expected no delivery after deregister, got %s", got)
	case <-time.After(50 * time.Millisecond):
		// correct: nothing delivered
	}
}

func TestHub_FanOnlyToSubscribedChannels(t *testing.T) {
	// GIVEN two streams on different channels
	hub := sse.NewHub("")
	ctx := context.Background()

	sA := newStream(t, "sA", "actor_a", []string{"sync:review:catalog"})
	sB := newStream(t, "sB", "actor_b", []string{"sync:product:catalog"})
	_ = hub.Register(ctx, sA)
	_ = hub.Register(ctx, sB)

	// WHEN broadcasting to "sync:review:catalog"
	hub.Broadcast("sync:review:catalog", []byte("for-a-only"))

	// THEN only stream A receives it
	select {
	case got := <-sA.Ch:
		if string(got) != "for-a-only" {
			t.Errorf("stream A: expected 'for-a-only', got %s", got)
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatal("stream A: expected payload, got nothing")
	}

	select {
	case got := <-sB.Ch:
		t.Errorf("stream B should NOT receive payment notification, got %s", got)
	case <-time.After(50 * time.Millisecond):
		// correct: nothing delivered to sB
	}
}

func TestHub_MultipleStreamsOnSameChannel(t *testing.T) {
	// GIVEN two streams registered on the same channel
	hub := sse.NewHub("")
	ctx := context.Background()

	s1 := newStream(t, "s1", "actor_a_tab1", []string{"sync:review:catalog"})
	s2 := newStream(t, "s2", "actor_a_tab2", []string{"sync:review:catalog"})
	_ = hub.Register(ctx, s1)
	_ = hub.Register(ctx, s2)

	// WHEN broadcasting to that channel
	hub.Broadcast("sync:review:catalog", []byte("broadcast"))

	// THEN both streams receive the payload
	for _, s := range []*sse.Stream{s1, s2} {
		select {
		case got := <-s.Ch:
			if string(got) != "broadcast" {
				t.Errorf("stream %s: expected 'broadcast', got %s", s.ID, got)
			}
		case <-time.After(100 * time.Millisecond):
			t.Fatalf("stream %s: expected payload, got nothing", s.ID)
		}
	}
}

func TestHub_DeregisterOneOfTwoStreams(t *testing.T) {
	// GIVEN two streams on the same channel, then s1 deregistered
	hub := sse.NewHub("")
	ctx := context.Background()

	s1 := newStream(t, "s1", "actor_a", []string{"sync:review:catalog"})
	s2 := newStream(t, "s2", "actor_b", []string{"sync:review:catalog"})
	_ = hub.Register(ctx, s1)
	_ = hub.Register(ctx, s2)
	hub.Deregister(ctx, "s1")

	// WHEN broadcasting
	hub.Broadcast("sync:review:catalog", []byte("after-deregister"))

	// THEN s1 receives nothing, s2 still receives
	select {
	case got := <-s1.Ch:
		t.Errorf("deregistered stream s1 should not receive, got %s", got)
	case <-time.After(50 * time.Millisecond):
	}

	select {
	case got := <-s2.Ch:
		if string(got) != "after-deregister" {
			t.Errorf("stream s2: expected 'after-deregister', got %s", got)
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatal("stream s2: expected payload, got nothing")
	}
}
