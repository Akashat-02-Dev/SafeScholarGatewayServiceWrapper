package auth

import (
	"errors"
	"strings"
	"unicode"
	"unicode/utf8"
)

type PasswordPolicy struct {
	MinLength        int
	MaxLength        int
	RequireUpper     bool
	RequireLower     bool
	RequireDigit     bool
	RequireSpecial   bool
	DisallowWhitespace bool
}

func DefaultPasswordPolicy() PasswordPolicy {
	return PasswordPolicy{
		MinLength:          12,
		MaxLength:          256,
		RequireUpper:       true,
		RequireLower:       true,
		RequireDigit:       true,
		RequireSpecial:     true,
		DisallowWhitespace: true,
	}
}

func (p PasswordPolicy) Validate(password string) error {
	if strings.TrimSpace(password) == "" {
		return errors.New("password required")
	}
	if p.MinLength <= 0 {
		p.MinLength = 12
	}
	if p.MaxLength <= 0 {
		p.MaxLength = 256
	}
	n := utf8.RuneCountInString(password)
	if n < p.MinLength {
		return errors.New("password too short")
	}
	if n > p.MaxLength {
		return errors.New("password too long")
	}
	var hasUpper bool
	var hasLower bool
	var hasDigit bool
	var hasSpecial bool
	var hasWhitespace bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		case unicode.IsSpace(r):
			hasWhitespace = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasSpecial = true
		}
	}
	if p.DisallowWhitespace && hasWhitespace {
		return errors.New("password contains whitespace")
	}
	if p.RequireUpper && !hasUpper {
		return errors.New("password does not meet complexity requirements")
	}
	if p.RequireLower && !hasLower {
		return errors.New("password does not meet complexity requirements")
	}
	if p.RequireDigit && !hasDigit {
		return errors.New("password does not meet complexity requirements")
	}
	if p.RequireSpecial && !hasSpecial {
		return errors.New("password does not meet complexity requirements")
	}
	return nil
}
