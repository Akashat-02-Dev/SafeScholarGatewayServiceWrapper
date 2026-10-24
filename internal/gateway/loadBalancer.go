package gateway

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type LBAlgorithm string

const (
	AlgorithmRoundRobin LBAlgorithm = "round_robin"
	AlgorithmLeastConn  LBAlgorithm = "least_conn"
)

type EndpointStatus struct {
	URL            *url.URL
	RawURL         string
	ActiveConns    int64
	FailureCount   int64
	Healthy        bool
	LastFailureAt  time.Time
	CooldownPeriod time.Duration
}

// ServicePool holds a pool of endpoints for a specific downstream service.
type ServicePool struct {
	ServiceName string
	Endpoints   []*EndpointStatus
	Algorithm   LBAlgorithm
	rrCounter   uint64
	mu          sync.RWMutex
}

// LoadBalancer distributes traffic across microservice replicas with active health tracking.
type LoadBalancer struct {
	pools map[string]*ServicePool
	mu    sync.RWMutex
}

func NewLoadBalancer() *LoadBalancer {
	return &LoadBalancer{
		pools: make(map[string]*ServicePool),
	}
}

// RegisterService adds or updates a pool of endpoints for a service.
func (lb *LoadBalancer) RegisterService(serviceName string, rawURLs []string, algo LBAlgorithm) error {
	if strings.TrimSpace(serviceName) == "" {
		return errors.New("service name required")
	}
	if len(rawURLs) == 0 {
		return errors.New("at least one endpoint required")
	}
	if algo == "" {
		algo = AlgorithmLeastConn
	}

	var endpoints []*EndpointStatus
	for _, raw := range rawURLs {
		for _, part := range strings.Split(raw, ",") {
			trimmed := strings.TrimSpace(part)
			if trimmed == "" {
				continue
			}
			u, err := url.Parse(trimmed)
			if err != nil || u.Host == "" {
				continue
			}
			endpoints = append(endpoints, &EndpointStatus{
				URL:            u,
				RawURL:         trimmed,
				Healthy:        true,
				CooldownPeriod: 15 * time.Second,
			})
		}
	}

	if len(endpoints) == 0 {
		return errors.New("no valid endpoint URLs found")
	}

	lb.mu.Lock()
	defer lb.mu.Unlock()
	lb.pools[strings.ToLower(strings.TrimSpace(serviceName))] = &ServicePool{
		ServiceName: serviceName,
		Endpoints:   endpoints,
		Algorithm:   algo,
	}
	return nil
}

// Select chooses an optimal healthy endpoint and returns a release function.
func (lb *LoadBalancer) Select(ctx context.Context, serviceName string) (string, func(success bool), error) {
	lb.mu.RLock()
	pool, ok := lb.pools[strings.ToLower(strings.TrimSpace(serviceName))]
	lb.mu.RUnlock()

	if !ok || len(pool.Endpoints) == 0 {
		return "", func(bool) {}, errors.New("no endpoints available for service: " + serviceName)
	}

	pool.mu.Lock()
	defer pool.mu.Unlock()

	now := time.Now()
	// Re-evaluate cooled down endpoints
	for _, ep := range pool.Endpoints {
		if !ep.Healthy && now.Sub(ep.LastFailureAt) > ep.CooldownPeriod {
			ep.Healthy = true
			ep.FailureCount = 0
		}
	}

	var healthy []*EndpointStatus
	for _, ep := range pool.Endpoints {
		if ep.Healthy {
			healthy = append(healthy, ep)
		}
	}

	// Fail-open: If all nodes were marked unhealthy, re-try all rather than hard dropping
	if len(healthy) == 0 {
		healthy = pool.Endpoints
	}

	var chosen *EndpointStatus
	if pool.Algorithm == AlgorithmLeastConn {
		// Least Connections: pick the node with fewest active connections
		chosen = healthy[0]
		minConns := atomic.LoadInt64(&chosen.ActiveConns)
		for _, ep := range healthy[1:] {
			conns := atomic.LoadInt64(&ep.ActiveConns)
			if conns < minConns {
				chosen = ep
				minConns = conns
			}
		}
	} else {
		// Round-Robin
		idx := atomic.AddUint64(&pool.rrCounter, 1) % uint64(len(healthy))
		chosen = healthy[idx]
	}

	atomic.AddInt64(&chosen.ActiveConns, 1)

	release := func(success bool) {
		atomic.AddInt64(&chosen.ActiveConns, -1)
		pool.mu.Lock()
		defer pool.mu.Unlock()
		if success {
			chosen.FailureCount = 0
			chosen.Healthy = true
		} else {
			chosen.FailureCount++
			if chosen.FailureCount >= 3 {
				chosen.Healthy = false
				chosen.LastFailureAt = time.Now()
			}
		}
	}

	return chosen.RawURL, release, nil
}

// ResolveURL checks if rawURL is a comma-separated list of nodes; if so, selects one via round-robin.
func (lb *LoadBalancer) ResolveURL(serviceName, rawURL string) string {
	parts := strings.Split(rawURL, ",")
	if len(parts) <= 1 {
		return strings.TrimSpace(rawURL)
	}

	// Register on the fly if not already present
	lb.mu.RLock()
	_, exists := lb.pools[strings.ToLower(strings.TrimSpace(serviceName))]
	lb.mu.RUnlock()

	if !exists {
		_ = lb.RegisterService(serviceName, parts, AlgorithmLeastConn)
	}

	selected, _, err := lb.Select(context.Background(), serviceName)
	if err != nil {
		return strings.TrimSpace(parts[0])
	}
	return selected
}
