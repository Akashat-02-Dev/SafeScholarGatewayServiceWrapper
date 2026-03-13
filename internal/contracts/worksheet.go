package contracts

import (
	"errors"
	"strings"
	"time"
	"unicode"
)

const (
	maxIDLen          = 128
	maxTitleLen       = 120
	maxShortTextLen   = 500
	maxLongTextLen    = 4000
	maxWorksheetItems = 200
	maxAnswers        = 400
	maxOptions        = 30
)

type WorksheetRequest struct {
	WorksheetID string `json:"worksheetId"`
}

func (r WorksheetRequest) Validate() error {
	_, err := validateID("worksheetId", r.WorksheetID)
	return err
}

type WorksheetStatus string

const (
	WorksheetStatusDraft     WorksheetStatus = "draft"
	WorksheetStatusPublished WorksheetStatus = "published"
	WorksheetStatusArchived  WorksheetStatus = "archived"
)

type Worksheet struct {
	WorksheetID   string          `json:"worksheetId"`
	InstitutionID string          `json:"institutionId,omitempty"`
	Title         string          `json:"title"`
	Description   string          `json:"description,omitempty"`
	Status        WorksheetStatus `json:"status"`
	Items         []WorksheetItem `json:"items,omitempty"`
	CreatedAt     time.Time       `json:"createdAt,omitempty"`
	UpdatedAt     time.Time       `json:"updatedAt,omitempty"`
}

func (w Worksheet) Validate() error {
	if _, err := validateID("worksheetId", w.WorksheetID); err != nil {
		return err
	}
	if w.InstitutionID != "" {
		if _, err := validateID("institutionId", w.InstitutionID); err != nil {
			return err
		}
	}
	if _, err := validateTitle("title", w.Title); err != nil {
		return err
	}
	if w.Description != "" {
		if _, err := validateLongText("description", w.Description); err != nil {
			return err
		}
	}
	if w.Status != "" {
		if w.Status != WorksheetStatusDraft && w.Status != WorksheetStatusPublished && w.Status != WorksheetStatusArchived {
			return errors.New("invalid status")
		}
	}
	if len(w.Items) > maxWorksheetItems {
		return errors.New("too many items")
	}
	for _, it := range w.Items {
		if err := it.Validate(); err != nil {
			return err
		}
	}
	return nil
}

type WorksheetItemKind string

const (
	WorksheetItemKindShortAnswer WorksheetItemKind = "short_answer"
	WorksheetItemKindLongAnswer  WorksheetItemKind = "long_answer"
	WorksheetItemKindMultiple    WorksheetItemKind = "multiple_choice"
	WorksheetItemKindCheckbox    WorksheetItemKind = "checkbox"
)

type WorksheetItem struct {
	ItemID    string            `json:"itemId"`
	Prompt    string            `json:"prompt"`
	Kind      WorksheetItemKind `json:"kind"`
	Options   []string          `json:"options,omitempty"`
	Required  bool              `json:"required"`
	MaxLength int               `json:"maxLength,omitempty"`
}

func (i WorksheetItem) Validate() error {
	if _, err := validateID("itemId", i.ItemID); err != nil {
		return err
	}
	if _, err := validateShortText("prompt", i.Prompt); err != nil {
		return err
	}
	switch i.Kind {
	case WorksheetItemKindShortAnswer, WorksheetItemKindLongAnswer, WorksheetItemKindMultiple, WorksheetItemKindCheckbox:
	default:
		return errors.New("invalid item kind")
	}
	if len(i.Options) > maxOptions {
		return errors.New("too many options")
	}
	for _, opt := range i.Options {
		if _, err := validateShortText("option", opt); err != nil {
			return err
		}
	}
	if i.Kind == WorksheetItemKindMultiple || i.Kind == WorksheetItemKindCheckbox {
		if len(i.Options) == 0 {
			return errors.New("options required")
		}
	}
	if i.MaxLength < 0 || i.MaxLength > maxLongTextLen {
		return errors.New("invalid maxLength")
	}
	return nil
}

type CreateWorksheetRequest struct {
	Title       string          `json:"title"`
	Description string          `json:"description,omitempty"`
	Items       []WorksheetItem `json:"items,omitempty"`
}

func (r CreateWorksheetRequest) Validate() error {
	if _, err := validateTitle("title", r.Title); err != nil {
		return err
	}
	if r.Description != "" {
		if _, err := validateLongText("description", r.Description); err != nil {
			return err
		}
	}
	if len(r.Items) > maxWorksheetItems {
		return errors.New("too many items")
	}
	for _, it := range r.Items {
		if err := it.Validate(); err != nil {
			return err
		}
	}
	return nil
}

type CreateWorksheetResponse struct {
	WorksheetID string `json:"worksheetId"`
}

func (r CreateWorksheetResponse) Validate() error {
	_, err := validateID("worksheetId", r.WorksheetID)
	return err
}

type UpdateWorksheetRequest struct {
	WorksheetID  string          `json:"worksheetId"`
	Title        string          `json:"title,omitempty"`
	Description  string          `json:"description,omitempty"`
	Items        []WorksheetItem `json:"items,omitempty"`
	ReplaceItems bool            `json:"replaceItems,omitempty"`
}

func (r UpdateWorksheetRequest) Validate() error {
	if _, err := validateID("worksheetId", r.WorksheetID); err != nil {
		return err
	}
	if r.Title != "" {
		if _, err := validateTitle("title", r.Title); err != nil {
			return err
		}
	}
	if r.Description != "" {
		if _, err := validateLongText("description", r.Description); err != nil {
			return err
		}
	}
	if len(r.Items) > maxWorksheetItems {
		return errors.New("too many items")
	}
	for _, it := range r.Items {
		if err := it.Validate(); err != nil {
			return err
		}
	}
	return nil
}

type SubmitWorksheetRequest struct {
	WorksheetID string            `json:"worksheetId"`
	Answers     []WorksheetAnswer `json:"answers"`
}

func (r SubmitWorksheetRequest) Validate() error {
	if _, err := validateID("worksheetId", r.WorksheetID); err != nil {
		return err
	}
	if len(r.Answers) == 0 {
		return errors.New("answers required")
	}
	if len(r.Answers) > maxAnswers {
		return errors.New("too many answers")
	}
	for _, a := range r.Answers {
		if err := a.Validate(); err != nil {
			return err
		}
	}
	return nil
}

type WorksheetAnswer struct {
	ItemID string `json:"itemId"`
	Value  string `json:"value"`
}

func (a WorksheetAnswer) Validate() error {
	if _, err := validateID("itemId", a.ItemID); err != nil {
		return err
	}
	if _, err := validateLongText("value", a.Value); err != nil {
		return err
	}
	return nil
}

func validateID(field string, raw string) (string, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return "", errors.New(field + " required")
	}
	if len(v) > maxIDLen {
		return "", errors.New(field + " too long")
	}
	for _, r := range v {
		if r > 127 {
			return "", errors.New("invalid " + field)
		}
		if unicode.IsControl(r) || unicode.IsSpace(r) {
			return "", errors.New("invalid " + field)
		}
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			continue
		}
		switch r {
		case '-', '_', ':', '.', '@':
			continue
		default:
			return "", errors.New("invalid " + field)
		}
	}
	return v, nil
}

func validateTitle(field string, raw string) (string, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return "", errors.New(field + " required")
	}
	if len(v) > maxTitleLen {
		return "", errors.New(field + " too long")
	}
	if hasControlOrNul(v, false) {
		return "", errors.New("invalid " + field)
	}
	if strings.ContainsAny(v, "<>") {
		return "", errors.New("invalid " + field)
	}
	return v, nil
}

func validateShortText(field string, raw string) (string, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return "", errors.New(field + " required")
	}
	if len(v) > maxShortTextLen {
		return "", errors.New(field + " too long")
	}
	if hasControlOrNul(v, true) {
		return "", errors.New("invalid " + field)
	}
	return v, nil
}

func validateLongText(field string, raw string) (string, error) {
	v := strings.TrimSpace(raw)
	if len(v) > maxLongTextLen {
		return "", errors.New(field + " too long")
	}
	if hasControlOrNul(v, true) {
		return "", errors.New("invalid " + field)
	}
	return v, nil
}

func hasControlOrNul(s string, allowNewlines bool) bool {
	for _, r := range s {
		if r == 0 {
			return true
		}
		if unicode.IsControl(r) {
			if allowNewlines && (r == '\n' || r == '\r' || r == '\t') {
				continue
			}
			return true
		}
	}
	return false
}
