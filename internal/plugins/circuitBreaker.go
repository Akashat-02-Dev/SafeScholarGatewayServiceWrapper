package plugins

import (
	"sync"
	"time"
)

type CircuitBreaker struct {
	mu                  sync.RWMutex
	state               CircuitState
	failureThreshold    int
	cooldownDuration    time.Duration
	consecutiveFailures int
	consecutiveSuccesses int
	totalRequests       int64
	totalFailures       int64
	totalSuccesses      int64
	lastFailureTime     *time.Time
	lastSuccessTime     *time.Time
	lastStateChange     time.Time
	totalLatencyMs      float64
}

func NewCircuitBreaker(failureThreshold int, cooldownSeconds int) *CircuitBreaker {
	if failureThreshold <= 0 {
		failureThreshold = 3
	}
	if cooldownSeconds <= 0 {
		cooldownSeconds = 30
	}
	return &CircuitBreaker{
		state:            CircuitClosed,
		failureThreshold: failureThreshold,
		cooldownDuration: time.Duration(cooldownSeconds) * time.Second,
		lastStateChange:  time.Now(),
	}
}

func (cb *CircuitBreaker) AllowRequest() (bool, CircuitState) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()

	switch cb.state {
	case CircuitClosed:
		return true, CircuitClosed
	case CircuitOpen:
		// Check if cooldown has elapsed
		if cb.lastFailureTime != nil && now.Sub(*cb.lastFailureTime) >= cb.cooldownDuration {
			cb.state = CircuitHalfOpen
			cb.lastStateChange = now
			cb.consecutiveSuccesses = 0
			return true, CircuitHalfOpen
		}
		return false, CircuitOpen
	case CircuitHalfOpen:
		// Allow canary trial
		return true, CircuitHalfOpen
	default:
		return true, CircuitClosed
	}
}

func (cb *CircuitBreaker) RecordSuccess(latency time.Duration) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()
	cb.totalRequests++
	cb.totalSuccesses++
	cb.lastSuccessTime = &now
	cb.totalLatencyMs += float64(latency.Milliseconds())

	switch cb.state {
	case CircuitHalfOpen:
		cb.consecutiveSuccesses++
		// If canary succeeds 2 consecutive times, close circuit
		if cb.consecutiveSuccesses >= 2 {
			cb.state = CircuitClosed
			cb.consecutiveFailures = 0
			cb.consecutiveSuccesses = 0
			cb.lastStateChange = now
		}
	case CircuitClosed:
		cb.consecutiveFailures = 0
	}
}

func (cb *CircuitBreaker) RecordFailure(err error) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()
	cb.totalRequests++
	cb.totalFailures++
	cb.lastFailureTime = &now
	cb.consecutiveFailures++

	switch cb.state {
	case CircuitHalfOpen:
		// Canary failed, reopen circuit
		cb.state = CircuitOpen
		cb.lastStateChange = now
		cb.consecutiveSuccesses = 0
	case CircuitClosed:
		if cb.consecutiveFailures >= cb.failureThreshold {
			cb.state = CircuitOpen
			cb.lastStateChange = now
		}
	}
}

func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.state = CircuitClosed
	cb.consecutiveFailures = 0
	cb.consecutiveSuccesses = 0
	cb.lastStateChange = time.Now()
}

func (cb *CircuitBreaker) UpdateParams(failureThreshold int, cooldownSeconds int) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if failureThreshold > 0 {
		cb.failureThreshold = failureThreshold
	}
	if cooldownSeconds > 0 {
		cb.cooldownDuration = time.Duration(cooldownSeconds) * time.Second
	}
}

type CircuitStats struct {
	State               CircuitState
	ConsecutiveFailures int
	TotalRequests       int64
	TotalFailures       int64
	TotalSuccesses      int64
	LastFailureTime     *time.Time
	LastSuccessTime     *time.Time
	LastStateChange     time.Time
	AvgLatencyMs        float64
}

func (cb *CircuitBreaker) GetStats() CircuitStats {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	avgLatency := float64(0)
	if cb.totalRequests > 0 {
		avgLatency = cb.totalLatencyMs / float64(cb.totalRequests)
	}

	return CircuitStats{
		State:               cb.state,
		ConsecutiveFailures: cb.consecutiveFailures,
		TotalRequests:       cb.totalRequests,
		TotalFailures:       cb.totalFailures,
		TotalSuccesses:      cb.totalSuccesses,
		LastFailureTime:     cb.lastFailureTime,
		LastSuccessTime:     cb.lastSuccessTime,
		LastStateChange:     cb.lastStateChange,
		AvgLatencyMs:        avgLatency,
	}
}
