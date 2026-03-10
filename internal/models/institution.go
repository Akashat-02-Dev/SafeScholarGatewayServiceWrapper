package models

import (
	"errors"
	"strings"
	"time"
)

type Institution struct {
	InstitutionID string     `json:"institutionId"`
	Name          string     `json:"name"`
	Domain        string     `json:"domain,omitempty"`
	Status        string     `json:"status"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     *time.Time `json:"updatedAt,omitempty"`
}

type InstitutionStatus string

const (
	InstitutionStatusActive    InstitutionStatus = "active"
	InstitutionStatusSuspended InstitutionStatus = "suspended"
	InstitutionStatusDisabled  InstitutionStatus = "disabled"
)

func (i *Institution) Normalize() {
	if i == nil {
		return
	}
	i.InstitutionID = strings.TrimSpace(i.InstitutionID)
	i.Name = strings.TrimSpace(i.Name)
	i.Domain = strings.ToLower(strings.TrimSpace(i.Domain))
	i.Status = strings.ToLower(strings.TrimSpace(i.Status))
}

func (i Institution) Validate() error {
	if _, err := validateID("institutionId", i.InstitutionID); err != nil {
		return err
	}
	if _, err := validateShortText("name", i.Name, 255); err != nil {
		return err
	}
	if i.Domain != "" {
		if _, err := validateShortText("domain", i.Domain, 255); err != nil {
			return err
		}
	}
	if strings.TrimSpace(i.Status) == "" {
		return errors.New("status required")
	}
	if len(i.Status) > maxStatusLen {
		return errors.New("status too long")
	}
	switch InstitutionStatus(strings.ToLower(strings.TrimSpace(i.Status))) {
	case InstitutionStatusActive, InstitutionStatusSuspended, InstitutionStatusDisabled:
	default:
		return errors.New("invalid status")
	}
	return nil
}
