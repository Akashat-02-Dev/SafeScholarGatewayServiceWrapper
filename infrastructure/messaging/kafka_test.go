package messaging

import (
	"context"
	"testing"
	"time"
)

func TestKafkaProducer_ResilientFallback(t *testing.T) {
	// Create producer with Kafka disabled or unconfigured
	cfg := KafkaConfig{
		Enabled:       false,
		Brokers:       []string{},
		ClientID:      "test-gateway",
		BatchSize:     50,
		BatchTimeout:  10 * time.Millisecond,
		AsyncFallback: true,
	}

	producer := NewKafkaProducer(cfg, nil)
	defer producer.Close()

	if producer.IsEnabled() {
		t.Error("expected producer to be disabled without brokers")
	}

	ctx := context.Background()

	// Publishing should not block and should smoothly route to internal fallback buffer
	err := producer.Publish(ctx, TopicAuditEvents, "user-456", map[string]any{
		"action": "LOGIN",
		"status": "SUCCESS",
	})
	if err != nil {
		t.Fatalf("unexpected error publishing in fallback mode: %v", err)
	}

	err = producer.Publish(ctx, TopicTelemetry, "user-456", "test message string")
	if err != nil {
		t.Fatalf("unexpected error publishing string payload: %v", err)
	}
}
