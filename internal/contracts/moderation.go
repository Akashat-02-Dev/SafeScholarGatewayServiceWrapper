package contracts

import (
	"errors"
	"strings"
	"time"
)

type ModerationAction string

const (
	ModerationActionApprove ModerationAction = "approve"
	ModerationActionReject  ModerationAction = "reject"
	ModerationActionFlag    ModerationAction = "flag"
)

type ModerationActionRequest struct {
	ContentID       string   `json:"contentId"`
	Action          string   `json:"action"`
	Reason          string   `json:"reason,omitempty"`
	ModeratorUserID string   `json:"moderatorUserId,omitempty"`
	ModeratorRoles  []string `json:"moderatorRoles,omitempty"`
	CorrelationID   string   `json:"correlationId,omitempty"`
}

func (r ModerationActionRequest) Validate() error {
	if _, err := validateID("contentId", r.ContentID); err != nil {
		return err
	}
	a := strings.ToLower(strings.TrimSpace(r.Action))
	if a != string(ModerationActionApprove) && a != string(ModerationActionReject) && a != string(ModerationActionFlag) {
		return errors.New("invalid action")
	}
	if r.Reason != "" {
		if _, err := validateLongText("reason", r.Reason); err != nil {
			return err
		}
	}
	if r.ModeratorUserID != "" {
		if _, err := validateID("moderatorUserId", r.ModeratorUserID); err != nil {
			return err
		}
	}
	if len(r.ModeratorRoles) > 20 {
		return errors.New("too many moderatorRoles")
	}
	for _, role := range r.ModeratorRoles {
		if _, err := validateShortText("moderatorRole", role); err != nil {
			return err
		}
	}
	if r.CorrelationID != "" {
		if len(strings.TrimSpace(r.CorrelationID)) > 128 || hasControlOrNul(r.CorrelationID, false) {
			return errors.New("invalid correlationId")
		}
	}
	return nil
}

func (r ModerationActionRequest) ValidateAgainstActor(actorUserID string, actorRoles []string) error {
	if err := r.Validate(); err != nil {
		return err
	}
	if r.ModeratorUserID != "" && strings.TrimSpace(actorUserID) != "" {
		if strings.TrimSpace(r.ModeratorUserID) != strings.TrimSpace(actorUserID) {
			return errors.New("moderatorUserId mismatch")
		}
	}
	if len(r.ModeratorRoles) > 0 && len(actorRoles) > 0 {
		if !containsAllNormalized(r.ModeratorRoles, actorRoles) {
			return errors.New("moderatorRoles mismatch")
		}
	}
	return nil
}

type ModerationAuditRecord struct {
	AuditID         string           `json:"auditId"`
	InstitutionID   string           `json:"institutionId,omitempty"`
	ContentID       string           `json:"contentId"`
	Action          ModerationAction `json:"action"`
	Reason          string           `json:"reason,omitempty"`
	ModeratorUserID string           `json:"moderatorUserId"`
	ModeratorRoles  []string         `json:"moderatorRoles,omitempty"`
	CreatedAt       time.Time        `json:"createdAt,omitempty"`
	CorrelationID   string           `json:"correlationId,omitempty"`
}

func (r ModerationAuditRecord) Validate() error {
	if _, err := validateID("auditId", r.AuditID); err != nil {
		return err
	}
	if r.InstitutionID != "" {
		if _, err := validateID("institutionId", r.InstitutionID); err != nil {
			return err
		}
	}
	if _, err := validateID("contentId", r.ContentID); err != nil {
		return err
	}
	switch r.Action {
	case ModerationActionApprove, ModerationActionReject, ModerationActionFlag:
	default:
		return errors.New("invalid action")
	}
	if r.Reason != "" {
		if _, err := validateLongText("reason", r.Reason); err != nil {
			return err
		}
	}
	if _, err := validateID("moderatorUserId", r.ModeratorUserID); err != nil {
		return err
	}
	if len(r.ModeratorRoles) > 20 {
		return errors.New("too many moderatorRoles")
	}
	for _, role := range r.ModeratorRoles {
		if _, err := validateShortText("moderatorRole", role); err != nil {
			return err
		}
	}
	if r.CorrelationID != "" {
		if len(strings.TrimSpace(r.CorrelationID)) > 128 || hasControlOrNul(r.CorrelationID, false) {
			return errors.New("invalid correlationId")
		}
	}
	return nil
}

func containsAllNormalized(subset []string, superset []string) bool {
	set := map[string]struct{}{}
	for _, v := range superset {
		n := strings.ToLower(strings.TrimSpace(v))
		if n != "" {
			set[n] = struct{}{}
		}
	}
	for _, v := range subset {
		n := strings.ToLower(strings.TrimSpace(v))
		if n == "" {
			continue
		}
		if _, ok := set[n]; !ok {
			return false
		}
	}
	return true
}
