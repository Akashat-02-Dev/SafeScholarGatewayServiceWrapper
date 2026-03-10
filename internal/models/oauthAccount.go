package models

import (
	"errors"
	"strings"
	"time"
)

type OAuthAccount struct {
	OAuthAccountID string    `json:"oauthAccountId"`
	UserID         string    `json:"userId"`
	Provider       string    `json:"provider"`
	ProviderUserID string    `json:"providerUserId"`
	Email          string    `json:"email,omitempty"`
	AccessToken    string    `json:"accessToken,omitempty"`
	RefreshToken   string    `json:"refreshToken,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}

type OAuthProvider string

const (
	OAuthProviderGoogle    OAuthProvider = "google"
	OAuthProviderMicrosoft OAuthProvider = "microsoft"
	OAuthProviderApple     OAuthProvider = "apple"
)

func (a *OAuthAccount) Normalize() {
	if a == nil {
		return
	}
	a.OAuthAccountID = strings.TrimSpace(a.OAuthAccountID)
	a.UserID = strings.TrimSpace(a.UserID)
	a.Provider = strings.ToLower(strings.TrimSpace(a.Provider))
	a.ProviderUserID = strings.TrimSpace(a.ProviderUserID)
	a.Email = normalizeEmail(a.Email)
	a.AccessToken = strings.TrimSpace(a.AccessToken)
	a.RefreshToken = strings.TrimSpace(a.RefreshToken)
}

func (a OAuthAccount) Validate() error {
	if _, err := validateID("oauthAccountId", a.OAuthAccountID); err != nil {
		return err
	}
	if _, err := validateID("userId", a.UserID); err != nil {
		return err
	}
	if strings.TrimSpace(a.Provider) == "" {
		return errors.New("provider required")
	}
	switch OAuthProvider(strings.ToLower(strings.TrimSpace(a.Provider))) {
	case OAuthProviderGoogle, OAuthProviderMicrosoft, OAuthProviderApple:
	default:
		return errors.New("invalid provider")
	}
	if _, err := validateShortText("providerUserId", a.ProviderUserID, 255); err != nil {
		return err
	}
	if a.Email != "" {
		if _, err := validateEmail("email", a.Email); err != nil {
			return err
		}
	}
	return nil
}
