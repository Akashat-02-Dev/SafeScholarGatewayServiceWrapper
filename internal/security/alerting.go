package security

import (
	"log/slog"
)

type Alert struct {
	InstitutionID string
	Subject       string
	Message       string
}

var alertChan = make(chan Alert, 1000) // Buffered channel to prevent blocking

func init() {
	// Initialize a worker pool of 5 routines to prevent unbounded goroutines
	for i := 0; i < 5; i++ {
		go alertWorker(i)
	}
}

func alertWorker(id int) {
	for alert := range alertChan {
		// Mock email/in-app dispatching logic (e.g., AWS SES or SendGrid)
		slog.Info("Dispatching alert email", 
			"worker_id", id,
			"institution_id", alert.InstitutionID, 
			"subject", alert.Subject, 
		)
		// Simulating network latency
		// time.Sleep(100 * time.Millisecond)
	}
}

// DispatchAlert queues an alert asynchronously without blocking the HTTP thread.
// It uses a select statement to ensure it fails gracefully if the queue is full.
func DispatchAlert(institutionID, subject, message string) {
	select {
	case alertChan <- Alert{InstitutionID: institutionID, Subject: subject, Message: message}:
		// Successfully queued
	default:
		slog.Warn("Alert queue full, dropping alert", "institution_id", institutionID, "subject", subject)
	}
}
