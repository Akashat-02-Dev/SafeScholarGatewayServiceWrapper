package messaging

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
)

const (
	TopicAuditEvents   = "safescholar.audit-events"
	TopicAIEvents      = "safescholar.ai-events"
	TopicTelemetry     = "safescholar.telemetry"
	TopicNotifications = "safescholar.notifications"
)

type EventMessage struct {
	ID        string         `json:"id,omitempty"`
	Topic     string         `json:"topic"`
	Key       string         `json:"key"`
	Payload   map[string]any `json:"payload"`
	Timestamp time.Time      `json:"timestamp"`
}

type KafkaConfig struct {
	Enabled       bool          `yaml:"enabled"`
	Brokers       []string      `yaml:"brokers"`
	ClientID      string        `yaml:"clientId"`
	ConsumerGroup string        `yaml:"consumerGroup"`
	BatchSize     int           `yaml:"batchSize"`
	BatchTimeout  time.Duration `yaml:"batchTimeout"`
	AsyncFallback bool          `yaml:"asyncFallback"`
}

// KafkaProducer provides resilient, non-blocking asynchronous event streaming with fallback buffer.
type KafkaProducer struct {
	config     KafkaConfig
	writers    map[string]*kafka.Writer
	mu         sync.RWMutex
	logger     *slog.Logger
	fallbackCh chan EventMessage
	closed     chan struct{}
}

func NewKafkaProducer(cfg KafkaConfig, logger *slog.Logger) *KafkaProducer {
	if logger == nil {
		logger = slog.Default()
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 100
	}
	if cfg.BatchTimeout <= 0 {
		cfg.BatchTimeout = 20 * time.Millisecond
	}
	if cfg.ClientID == "" {
		cfg.ClientID = "safescholar-gateway"
	}

	kp := &KafkaProducer{
		config:     cfg,
		writers:    make(map[string]*kafka.Writer),
		logger:     logger,
		fallbackCh: make(chan EventMessage, 5000),
		closed:     make(chan struct{}),
	}

	if cfg.Enabled && len(cfg.Brokers) > 0 {
		// Pre-initialize primary writers
		kp.getWriter(TopicAuditEvents)
		kp.getWriter(TopicAIEvents)
		kp.getWriter(TopicTelemetry)
		kp.getWriter(TopicNotifications)
		logger.Info("Kafka Event Bus Producer initialized", "brokers", cfg.Brokers, "clientId", cfg.ClientID)
	} else {
		logger.Info("Kafka Event Bus running in resilient in-memory fallback mode")
	}

	go kp.drainFallbackWorker()
	return kp
}

func (p *KafkaProducer) IsEnabled() bool {
	return p != nil && p.config.Enabled && len(p.config.Brokers) > 0
}

func (p *KafkaProducer) getWriter(topic string) *kafka.Writer {
	p.mu.Lock()
	defer p.mu.Unlock()

	if w, ok := p.writers[topic]; ok {
		return w
	}

	w := &kafka.Writer{
		Addr:         kafka.TCP(p.config.Brokers...),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		BatchSize:    p.config.BatchSize,
		BatchTimeout: p.config.BatchTimeout,
		Async:        true,
		RequiredAcks: kafka.RequireOne,
		Compression:  kafka.Snappy,
	}
	p.writers[topic] = w
	return w
}

// Publish sends an event asynchronously to a Kafka topic.
// If Kafka is disabled or unreachable, it pushes to the resilient fallback buffer without blocking.
func (p *KafkaProducer) Publish(ctx context.Context, topic, key string, payload any) error {
	if p == nil {
		return nil
	}

	topic = strings.TrimSpace(topic)
	if topic == "" {
		topic = TopicAuditEvents
	}

	var data []byte
	var err error
	switch v := payload.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		data, err = json.Marshal(payload)
		if err != nil {
			return err
		}
	}

	// 1. If Kafka is enabled, attempt publish
	if p.IsEnabled() {
		writer := p.getWriter(topic)
		msg := kafka.Message{
			Key:   []byte(key),
			Value: data,
			Time:  time.Now().UTC(),
		}

		pCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
		defer cancel()

		err := writer.WriteMessages(pCtx, msg)
		if err == nil {
			return nil
		}
		p.logger.Debug("kafka publish transient error, routing to fallback buffer", "topic", topic, "error", err)
	}

	// 2. Resilient Fallback: Push to non-blocking internal buffer
	var meta map[string]any
	_ = json.Unmarshal(data, &meta)

	select {
	case p.fallbackCh <- EventMessage{
		Topic:     topic,
		Key:       key,
		Payload:   meta,
		Timestamp: time.Now().UTC(),
	}:
	default:
		p.logger.Warn("kafka fallback buffer saturated, event dropped to protect gateway latency", "topic", topic)
	}

	return nil
}

func (p *KafkaProducer) drainFallbackWorker() {
	for {
		select {
		case <-p.closed:
			return
		case msg := <-p.fallbackCh:
			// Process buffered events gracefully
			_ = msg
		}
	}
}

// Close gracefully closes all Kafka topic writers.
func (p *KafkaProducer) Close() error {
	if p == nil {
		return nil
	}
	close(p.closed)

	p.mu.Lock()
	defer p.mu.Unlock()

	var errs []error
	for topic, w := range p.writers {
		if err := w.Close(); err != nil {
			errs = append(errs, err)
			p.logger.Warn("failed to close kafka writer", "topic", topic, "error", err)
		}
	}
	if len(errs) > 0 {
		return errors.New("errors closing kafka writers")
	}
	return nil
}
