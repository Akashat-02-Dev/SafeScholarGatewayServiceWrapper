package models

import (
	"errors"
	"net"
	"strings"
	"time"
)

type AuditLog struct {
	AuditID    string         `json:"auditId"`
	UserID     string         `json:"userId,omitempty"`
	Action     string         `json:"action"`
	Resource   string         `json:"resource,omitempty"`
	ResourceID string         `json:"resourceId,omitempty"`
	IPAddress  string         `json:"ipAddress,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

func (a *AuditLog) Normalize() {
	if a == nil {
		return
	}
	a.AuditID = strings.TrimSpace(a.AuditID)
	a.UserID = strings.TrimSpace(a.UserID)
	a.Action = strings.ToUpper(strings.TrimSpace(a.Action))
	a.Resource = strings.TrimSpace(a.Resource)
	a.ResourceID = strings.TrimSpace(a.ResourceID)
	a.IPAddress = strings.TrimSpace(a.IPAddress)
}

func (a AuditLog) Validate() error {
	if _, err := validateID("auditId", a.AuditID); err != nil {
		return err
	}
	if a.UserID != "" {
		if _, err := validateID("userId", a.UserID); err != nil {
			return err
		}
	}
	if _, err := validateShortText("action", a.Action, 120); err != nil {
		return err
	}
	if a.Resource != "" {
		if _, err := validateShortText("resource", a.Resource, 80); err != nil {
			return err
		}
	}
	if a.ResourceID != "" {
		if len(a.ResourceID) > 256 || hasControlOrNul(a.ResourceID, false) {
			return errors.New("invalid resourceId")
		}
	}
	if a.IPAddress != "" {
		if net.ParseIP(a.IPAddress) == nil {
			return errors.New("invalid ip")
		}
	}
	return nil
}
