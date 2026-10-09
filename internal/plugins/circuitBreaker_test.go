package plugins

import (
	"errors"
	"testing"
	"time"
)

func TestCircuitBreaker_StateTransitions(t *testing.T) {
	cb := NewCircuitBreaker(3, 1) // 3 failures threshold, 1 second cooldown

	// Initial state: CLOSED
	allowed, state := cb.AllowRequest()
	if !allowed || state != CircuitClosed {
		t.Fatalf("expected initial state CLOSED and allowed, got allowed=%v, state=%v", allowed, state)
	}

	// 2 failures: still CLOSED
	testErr := errors.New("upstream timeout")
	cb.RecordFailure(testErr)
	cb.RecordFailure(testErr)

	stats := cb.GetStats()
	if stats.State != CircuitClosed || stats.ConsecutiveFailures != 2 {
		t.Fatalf("expected state CLOSED with 2 failures, got state=%v, failures=%d", stats.State, stats.ConsecutiveFailures)
	}

	// 3rd failure: trips to OPEN
	cb.RecordFailure(testErr)
	stats = cb.GetStats()
	if stats.State != CircuitOpen {
		t.Fatalf("expected state OPEN after 3 failures, got %v", stats.State)
	}

	// Next immediate call: rejected because circuit is OPEN
	allowed, state = cb.AllowRequest()
	if allowed || state != CircuitOpen {
		t.Fatalf("expected request blocked with state OPEN, got allowed=%v, state=%v", allowed, state)
	}

	// Wait for cooldown (1s)
	time.Sleep(1100 * time.Millisecond)

	// Cooldown expired: should transition to HALF_OPEN
	allowed, state = cb.AllowRequest()
	if !allowed || state != CircuitHalfOpen {
		t.Fatalf("expected canary request allowed in HALF_OPEN, got allowed=%v, state=%v", allowed, state)
	}

	// 2 consecutive canary successes close the circuit
	cb.RecordSuccess(10 * time.Millisecond)
	cb.RecordSuccess(12 * time.Millisecond)

	stats = cb.GetStats()
	if stats.State != CircuitClosed {
		t.Fatalf("expected circuit to recover to CLOSED after canary successes, got %v", stats.State)
	}
}

func TestCircuitBreaker_Reset(t *testing.T) {
	cb := NewCircuitBreaker(2, 30)
	cb.RecordFailure(errors.New("err1"))
	cb.RecordFailure(errors.New("err2"))

	if cb.GetStats().State != CircuitOpen {
		t.Fatalf("expected OPEN state")
	}

	cb.Reset()
	if cb.GetStats().State != CircuitClosed {
		t.Fatalf("expected CLOSED state after Reset()")
	}
}
