package models

import (
	"errors"
	"strings"
	"time"
)

type Role struct {
	RoleID        string    `json:"roleId"`
	InstitutionID string    `json:"institutionId,omitempty"`
	Name          string    `json:"name"`
	Description   string    `json:"description,omitempty"`
	IsSystem      bool      `json:"isSystem"`
	CreatedAt     time.Time `json:"createdAt"`
	CreatedBy     string    `json:"createdBy,omitempty"`
}

func (r *Role) Normalize() {
	if r == nil {
		return
	}
	r.RoleID = strings.TrimSpace(r.RoleID)
	r.InstitutionID = strings.TrimSpace(r.InstitutionID)
	r.Name = strings.ToLower(strings.TrimSpace(r.Name))
	r.Description = strings.TrimSpace(r.Description)
	r.CreatedBy = strings.TrimSpace(r.CreatedBy)
}

func (r Role) Validate() error {
	if _, err := validateID("roleId", r.RoleID); err != nil {
		return err
	}
	if r.InstitutionID != "" {
		if _, err := validateID("institutionId", r.InstitutionID); err != nil {
			return err
		}
	}
	if _, err := validateRoleName("name", r.Name); err != nil {
		return err
	}
	if r.Description != "" {
		if _, err := validateShortText("description", r.Description, 500); err != nil {
			return err
		}
	}
	if r.IsSystem && r.InstitutionID != "" {
		return errors.New("system role cannot be institution-scoped")
	}
	if r.CreatedBy != "" {
		if _, err := validateID("createdBy", r.CreatedBy); err != nil {
			return err
		}
	}
	return nil
}
