package models

import (
	"strings"
	"time"
)

type Permission struct {
	PermissionID string    `json:"permissionId"`
	Name         string    `json:"name"`
	Module       string    `json:"module,omitempty"`
	Description  string    `json:"description,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}

func (p *Permission) Normalize() {
	if p == nil {
		return
	}
	p.PermissionID = strings.TrimSpace(p.PermissionID)
	p.Name = strings.ToUpper(strings.TrimSpace(p.Name))
	p.Module = strings.TrimSpace(p.Module)
	p.Description = strings.TrimSpace(p.Description)
}

func (p Permission) Validate() error {
	if _, err := validateID("permissionId", p.PermissionID); err != nil {
		return err
	}
	if _, err := validatePermissionCode("name", p.Name); err != nil {
		return err
	}
	if p.Module != "" {
		if _, err := validateShortText("module", p.Module, 120); err != nil {
			return err
		}
	}
	if p.Description != "" {
		if _, err := validateShortText("description", p.Description, 500); err != nil {
			return err
		}
	}
	return nil
}
