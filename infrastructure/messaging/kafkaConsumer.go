package messaging

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/segmentio/kafka-go"
)

type AuditEventMessage struct {
	UserID     string         `json:"user_id"`
	Action     string         `json:"action"`
	Resource   string         `json:"resource"`
	ResourceID string         `json:"resource_id"`
	IPAddress  string         `json:"ip_address"`
	Metadata   map[string]any `json:"metadata"`
	CreatedAt  time.Time      `json:"created_at"`
}

// KafkaAuditConsumer consumes audit events from Kafka and writes them asynchronously to PostgreSQL in bulk.
type KafkaAuditConsumer struct {
	reader  *kafka.Reader
	pool    *pgxpool.Pool
	logger  *slog.Logger
	running bool
	stopCh  chan struct{}
	wg      sync.WaitGroup
}

func NewKafkaAuditConsumer(brokers []string, groupID string, pool *pgxpool.Pool, logger *slog.Logger) *KafkaAuditConsumer {
	if logger == nil {
		logger = slog.Default()
	}
	if groupID == "" {
		groupID = "safescholar-audit-group"
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		GroupID:        groupID,
		Topic:          TopicAuditEvents,
		MinBytes:       10e3, // 10KB
		MaxBytes:       10e6, // 10MB
		CommitInterval: 1 * time.Second,
		MaxWait:        500 * time.Millisecond,
	})

	return &KafkaAuditConsumer{
		reader: reader,
		pool:   pool,
		logger: logger,
		stopCh: make(chan struct{}),
	}
}

// Start launches the consumer worker loop in a background goroutine.
func (c *KafkaAuditConsumer) Start(ctx context.Context) {
	if c == nil || c.reader == nil || c.pool == nil {
		return
	}
	c.running = true
	c.wg.Add(1)

	go func() {
		defer c.wg.Done()
		c.logger.Info("Kafka Audit Consumer worker started", "topic", TopicAuditEvents)

		batch := make([]AuditEventMessage, 0, 50)
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-c.stopCh:
				if len(batch) > 0 {
					c.flushBatch(context.Background(), batch)
				}
				return
			case <-ticker.C:
				if len(batch) > 0 {
					c.flushBatch(ctx, batch)
					batch = batch[:0]
				}
			default:
				mCtx, cancel := context.WithTimeout(ctx, 1*time.Second)
				msg, err := c.reader.FetchMessage(mCtx)
				cancel()

				if err != nil {
					continue
				}

				var ev AuditEventMessage
				if err := json.Unmarshal(msg.Value, &ev); err == nil {
					batch = append(batch, ev)
					if len(batch) >= 50 {
						c.flushBatch(ctx, batch)
						batch = batch[:0]
					}
				}
				_ = c.reader.CommitMessages(ctx, msg)
			}
		}
	}()
}

func (c *KafkaAuditConsumer) flushBatch(ctx context.Context, batch []AuditEventMessage) {
	if len(batch) == 0 || c.pool == nil {
		return
	}

	bCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := c.pool.BeginTx(bCtx, pgx.TxOptions{})
	if err != nil {
		c.logger.Warn("failed to begin audit flush transaction", "error", err)
		return
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	stmt := `
insert into audit_logs(
  user_id, action, resource, resource_id, resource_id_text, ip_address, metadata, created_at
) values (
  nullif($1,'')::uuid,
  $2,
  nullif($3,''),
  case when $4 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then nullif($4,'')::uuid else null end,
  nullif($4,''),
  nullif($5,''),
  $6,
  $7
)`

	for _, e := range batch {
		var meta any
		if e.Metadata != nil {
			metaBytes, _ := json.Marshal(e.Metadata)
			meta = metaBytes
		}
		if e.CreatedAt.IsZero() {
			e.CreatedAt = time.Now().UTC()
		}

		_, _ = tx.Exec(bCtx, stmt,
			strings.TrimSpace(e.UserID),
			strings.ToUpper(strings.TrimSpace(e.Action)),
			strings.TrimSpace(e.Resource),
			strings.TrimSpace(e.ResourceID),
			strings.TrimSpace(e.IPAddress),
			meta,
			e.CreatedAt,
		)
	}

	if err := tx.Commit(bCtx); err != nil {
		c.logger.Warn("failed to commit batch audit flush", "count", len(batch), "error", err)
	} else {
		c.logger.Debug("flushed audit events to postgres via kafka consumer", "count", len(batch))
	}
}

// Stop shuts down the consumer worker cleanly.
func (c *KafkaAuditConsumer) Stop() {
	if c == nil || !c.running {
		return
	}
	close(c.stopCh)
	c.wg.Wait()
	if c.reader != nil {
		_ = c.reader.Close()
	}
	c.running = false
}
