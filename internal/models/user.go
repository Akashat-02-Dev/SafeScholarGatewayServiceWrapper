package models

import (
	"errors"
	"net/mail"
	"strings"
	"time"
	"unicode"
)

type User struct {
	UserID        string     `json:"userId"`
	InstitutionID string     `json:"institutionId,omitempty"`
	Email         string     `json:"email"`
	PasswordHash  string     `json:"-"`
	FirstName     string     `json:"firstName,omitempty"`
	LastName      string     `json:"lastName,omitempty"`
	Status        string     `json:"status"`
	IsSysAdmin    bool       `json:"isSysAdmin"`
	AuthProvider  string     `json:"authProvider,omitempty"`
	Roles         []string   `json:"roles,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     *time.Time `json:"updatedAt,omitempty"`
	LastLogin     *time.Time `json:"lastLogin,omitempty"`
}

type UserStatus string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusDisabled UserStatus = "disabled"
	UserStatusLocked   UserStatus = "locked"
	UserStatusInvited  UserStatus = "invited"
	UserStatusPending  UserStatus = "pending"
)

const (
	maxEmailLen  = 255
	maxNameLen   = 100
	maxStatusLen = 50
	maxIDLen     = 128
)

func (u *User) Normalize() {
	if u == nil {
		return
	}
	u.UserID = strings.TrimSpace(u.UserID)
	u.InstitutionID = strings.TrimSpace(u.InstitutionID)
	u.Email = normalizeEmail(u.Email)
	u.FirstName = strings.TrimSpace(u.FirstName)
	u.LastName = strings.TrimSpace(u.LastName)
	u.Status = strings.ToLower(strings.TrimSpace(u.Status))
	u.AuthProvider = strings.ToLower(strings.TrimSpace(u.AuthProvider))
	u.Roles = normalizeLower(u.Roles)
}

func (u User) Validate() error {
	if _, err := validateID("userId", u.UserID); err != nil {
		return err
	}
	if u.InstitutionID != "" {
		if _, err := validateID("institutionId", u.InstitutionID); err != nil {
			return err
		}
	}
	if _, err := validateEmail("email", u.Email); err != nil {
		return err
	}
	if u.FirstName != "" {
		if _, err := validateName("firstName", u.FirstName); err != nil {
			return err
		}
	}
	if u.LastName != "" {
		if _, err := validateName("lastName", u.LastName); err != nil {
			return err
		}
	}
	if strings.TrimSpace(u.Status) == "" {
		return errors.New("status required")
	}
	if len(u.Status) > maxStatusLen {
		return errors.New("status too long")
	}
	switch UserStatus(strings.ToLower(strings.TrimSpace(u.Status))) {
	case UserStatusActive, UserStatusDisabled, UserStatusLocked, UserStatusInvited, UserStatusPending:
	default:
		return errors.New("invalid status")
	}
	for _, r := range u.Roles {
		if _, err := validateRoleName("role", r); err != nil {
			return err
		}
	}
	return nil
}

func normalizeEmail(raw string) string {
	v := strings.TrimSpace(raw)
	if v == "" {
		return ""
	}
	return strings.ToLower(v)
}

func validateEmail(field string, raw string) (string, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return "", errors.New(field + " required")
	}
	if len(v) > maxEmailLen {
		return "", errors.New(field + " too long")
	}
	if hasControlOrNul(v, false) {
		return "", errors.New("invalid " + field)
	}
	addr, err := mail.ParseAddress(v)
	if err != nil || addr == nil {
		return "", errors.New("invalid " + field)
	}
	if strings.ToLower(strings.TrimSpace(addr.Address)) != strings.ToLower(v) {
		return "", errors.New("invalid " + field)
	}
	return strings.ToLower(v), nil
}

func validateName(field string, raw string) (string, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return "", errors.New(field + " required")
	}
	if len(v) > maxNameLen {
		return "", errors.New(field + " too long")
	}
	if hasControlOrNul(v, true) {
		return "", errors.New("invalid " + field)
	}
	if strings.ContainsAny(v, "<>") {
		return "", errors.New("invalid " + field)
	}
	return v, nil
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

func validateRoleName(field string, raw string) (string, error) {
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == "" {
		return "", errors.New(field + " required")
	}
	if len(v) > 64 {
		return "", errors.New(field + " too long")
	}
	if hasControlOrNul(v, false) {
		return "", errors.New("invalid " + field)
	}
	for _, r := range v {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			continue
		}
		switch r {
		case '-', '_':
			continue
		default:
			return "", errors.New("invalid " + field)
		}
	}
	return v, nil
}

func validatePermissionCode(field string, raw string) (string, error) {
	v := strings.ToUpper(strings.TrimSpace(raw))
	if v == "" {
		return "", errors.New(field + " required")
	}
	if len(v) > 64 {
		return "", errors.New(field + " too long")
	}
	if hasControlOrNul(v, false) {
		return "", errors.New("invalid " + field)
	}
	for _, r := range v {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' {
			continue
		}
		return "", errors.New("invalid " + field)
	}
	return v, nil
}

func validateShortText(field string, raw string, maxLen int) (string, error) {
	v := strings.TrimSpace(raw)
	if v == "" {
		return "", errors.New(field + " required")
	}
	if maxLen > 0 && len(v) > maxLen {
		return "", errors.New(field + " too long")
	}
	if hasControlOrNul(v, true) {
		return "", errors.New("invalid " + field)
	}
	return v, nil
}

func normalizeLower(in []string) []string {
	out := make([]string, 0, len(in))
	seen := map[string]struct{}{}
	for _, s := range in {
		v := strings.ToLower(strings.TrimSpace(s))
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
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
