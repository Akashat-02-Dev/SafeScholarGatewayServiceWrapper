package gateway

import (
	"context"
	"net/url"
	"testing"
)

func TestLoadBalancer_RoundRobin(t *testing.T) {
	lb := NewLoadBalancer()
	err := lb.RegisterService("ai-service", []string{"http://10.0.0.1:8000", "http://10.0.0.2:8000", "http://10.0.0.3:8000"}, AlgorithmRoundRobin)
	if err != nil {
		t.Fatalf("failed to register service: %v", err)
	}

	targets := make([]string, 6)
	for i := 0; i < 6; i++ {
		urlStr, release, err := lb.Select(context.Background(), "ai-service")
		if err != nil {
			t.Fatalf("failed to select endpoint: %v", err)
		}
		targets[i] = urlStr
		release(true)
	}

	// Because RoundRobin starts with atomic.AddUint64(&rrCounter, 1) % 3:
	// step 0: 1 % 3 = 1 -> 10.0.0.2
	// step 1: 2 % 3 = 2 -> 10.0.0.3
	// step 2: 3 % 3 = 0 -> 10.0.0.1
	// and so on, distributing across all nodes evenly.
	counts := make(map[string]int)
	for _, target := range targets {
		counts[target]++
	}

	if counts["http://10.0.0.1:8000"] != 2 || counts["http://10.0.0.2:8000"] != 2 || counts["http://10.0.0.3:8000"] != 2 {
		t.Errorf("traffic not evenly distributed across replicas: %+v", counts)
	}
}

func TestLoadBalancer_LeastConn(t *testing.T) {
	lb := NewLoadBalancer()
	_ = lb.RegisterService("worksheet-service", []string{"http://10.0.0.1:9000", "http://10.0.0.2:9000"}, AlgorithmLeastConn)

	url1, release1, err := lb.Select(context.Background(), "worksheet-service")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url1 != "http://10.0.0.1:9000" {
		t.Fatalf("expected first node, got %s", url1)
	}

	// Keep conn1 active, do not release yet! Next request should route to node 2
	url2, release2, err := lb.Select(context.Background(), "worksheet-service")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url2 != "http://10.0.0.2:9000" {
		t.Errorf("expected least-conn to route to node2, got %s", url2)
	}

	release1(true)
	release2(true)
}

func TestLoadBalancer_CircuitBreakerFailover(t *testing.T) {
	lb := NewLoadBalancer()
	_ = lb.RegisterService("moderation", []string{"http://10.0.0.1:9445", "http://10.0.0.2:9445"}, AlgorithmRoundRobin)

	// Cause 3 consecutive failures on node 1
	for i := 0; i < 3; i++ {
		urlStr, release, _ := lb.Select(context.Background(), "moderation")
		if urlStr == "http://10.0.0.1:9445" {
			release(false) // record failure
		} else {
			release(true)
			i-- // retry until node 1 gets hit 3 times
		}
	}

	// Now node 1 should be tripped as unhealthy, only node 2 should be returned
	for i := 0; i < 6; i++ {
		urlStr, release, err := lb.Select(context.Background(), "moderation")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if urlStr != "http://10.0.0.2:9445" {
			t.Errorf("expected healthy node 2 after node 1 tripped, got %s", urlStr)
		}
		release(true)
	}
}

func TestLoadBalancer_ResolveURL(t *testing.T) {
	lb := NewLoadBalancer()

	// Single URL passes through unchanged
	single := "http://localhost:8000"
	if res := lb.ResolveURL("ai", single); res != single {
		t.Errorf("expected %s, got %s", single, res)
	}

	// Multi URL distributes
	multi := "http://node1:8000,http://node2:8000"
	res1 := lb.ResolveURL("ai-cluster", multi)
	res2 := lb.ResolveURL("ai-cluster", multi)

	u1, _ := url.Parse(res1)
	u2, _ := url.Parse(res2)
	if u1.Host == "" || u2.Host == "" {
		t.Errorf("invalid resolved urls: %s, %s", res1, res2)
	}
}
