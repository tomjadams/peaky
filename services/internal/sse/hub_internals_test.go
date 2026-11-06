package sse

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestHub_RegisterReturnsWhenQueueIsFullAndContextCancels(t *testing.T) {
	// GIVEN a started hub whose command queue is already full
	hub := NewHub("")
	hub.started = true
	for i := 0; i < cap(hub.commands); i++ {
		hub.commands <- listenCmd{channel: fmt.Sprintf("sync:test:%d", i), listen: true}
	}
	stream := &Stream{
		ID:       "s1",
		ActorID:  "actor",
		Channels: []string{"sync:test:new"},
		Ch:       make(chan []byte, 1),
		Done:     make(chan struct{}),
	}

	// Already-canceled context + full queue: Register must take the
	// ctx.Done() branch and return promptly, rather than blocking forever
	// on the full h.commands channel.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	// WHEN Register runs after shutdown/cancellation has already started
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = hub.Register(ctx, stream)
	}()

	// THEN Register should return promptly instead of blocking forever on h.commands
	select {
	case <-done:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("Register blocked with a full command queue")
	}
}

func TestHub_DeregisterReturnsWhenQueueIsFullAndContextCancels(t *testing.T) {
	// GIVEN a started hub whose command queue is full and whose last subscriber is registered
	hub := NewHub("")
	hub.started = true
	for i := 0; i < cap(hub.commands); i++ {
		hub.commands <- listenCmd{channel: fmt.Sprintf("sync:test:%d", i), listen: true}
	}
	stream := &Stream{
		ID:       "s1",
		ActorID:  "actor",
		Channels: []string{"sync:test:new"},
		Ch:       make(chan []byte, 1),
		Done:     make(chan struct{}),
	}
	hub.streams[stream.ID] = stream
	hub.channels[stream.Channels[0]] = []*Stream{stream}

	// Already-canceled context + full queue: Deregister must take the
	// ctx.Done() branch and return promptly, rather than blocking forever
	// on the full h.commands channel.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	// WHEN Deregister runs after shutdown/cancellation has already started
	done := make(chan struct{})
	go func() {
		defer close(done)
		hub.Deregister(ctx, stream.ID)
	}()

	// THEN Deregister should return promptly instead of blocking forever on h.commands
	select {
	case <-done:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("Deregister blocked with a full command queue")
	}
}

func TestHub_RegisterDoesNotBlockFanWhenCommandsFull(t *testing.T) {
	hub := NewHub("")
	hub.started = true

	// fill h.commands so Register's enqueue cannot complete immediately
	for i := 0; i < cap(hub.commands); i++ {
		hub.commands <- listenCmd{channel: fmt.Sprintf("sync:test:%d", i), listen: true}
	}

	stream := &Stream{
		ID:       "s1",
		ActorID:  "actor",
		Channels: []string{"sync:test:new"},
		Ch:       make(chan []byte, 1),
		Done:     make(chan struct{}),
	}

	// Register will block on h.commands <- ... since the queue is full
	// and ctx is never cancelled. The question: does it hold h.mu while
	// doing so?
	ctx := context.Background()
	registerDone := make(chan struct{})
	go func() {
		defer close(registerDone)
		_ = hub.Register(ctx, stream)
	}()

	// give Register a moment to reach the blocking send
	time.Sleep(20 * time.Millisecond)

	// fan() needs h.mu.RLock(). If Register is holding h.mu while blocked,
	// this hangs. If Register released h.mu before the send (fixed code),
	// this proceeds immediately.
	fanDone := make(chan struct{})
	go func() {
		defer close(fanDone)
		hub.fan("sync:test:0", []byte("x"))
	}()

	select {
	case <-fanDone:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("fan() blocked — Register is holding h.mu while sending on a full h.commands")
	}

	// cleanup: drain one slot so Register's goroutine can finish
	<-hub.commands
	<-registerDone
}
