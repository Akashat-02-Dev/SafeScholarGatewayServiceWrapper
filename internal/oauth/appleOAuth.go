package oauth

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

func appleIssuerURL() string {
	return "https://appleid.apple.com"
}

func appleOIDCConfig(clientID string) *oidc.Config {
	return &oidc.Config{ClientID: clientID}
}

func appleAuthCodeOptions(nonce, codeChallenge string) []oauth2.AuthCodeOption {
	return []oauth2.AuthCodeOption{
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("nonce", nonce),
		oauth2.SetAuthURLParam("code_challenge", codeChallenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	}
}

func appleIdentityFromToken(tok *oidc.IDToken) (oauthIdentity, error) {
	if tok == nil {
		return oauthIdentity{}, errors.New("oauth invalid id_token")
	}

	var claims struct {
		Email          string          `json:"email"`
		EmailVerified  json.RawMessage `json:"email_verified"`
		IsPrivateEmail json.RawMessage `json:"is_private_email"`
		GivenName      string          `json:"given_name"`
		FamilyName     string          `json:"family_name"`
		Name           string          `json:"name"`
		Sub            string          `json:"sub"`
	}
	if err := tok.Claims(&claims); err != nil {
		return oauthIdentity{}, errors.New("oauth invalid claims")
	}
	email := strings.ToLower(strings.TrimSpace(claims.Email))
	if email == "" {
		return oauthIdentity{}, errors.New("oauth insufficient identity")
	}
	sub := strings.TrimSpace(tok.Subject)
	if sub == "" {
		sub = strings.TrimSpace(claims.Sub)
	}
	if sub == "" {
		return oauthIdentity{}, errors.New("oauth insufficient identity")
	}
	if v, ok := rawBool(claims.EmailVerified); ok && !v {
		return oauthIdentity{}, errors.New("oauth email not verified")
	}
	first := strings.TrimSpace(claims.GivenName)
	last := strings.TrimSpace(claims.FamilyName)
	if first == "" && last == "" {
		first, last = splitName(claims.Name)
	}
	return oauthIdentity{
		Subject:   sub,
		Email:     email,
		FirstName: first,
		LastName:  last,
	}, nil
}

func rawBool(b json.RawMessage) (bool, bool) {
	v := strings.TrimSpace(string(b))
	if v == "" || v == "null" {
		return false, false
	}
	if v == "true" {
		return true, true
	}
	if v == "false" {
		return false, true
	}
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		s = strings.ToLower(strings.TrimSpace(s))
		if s == "true" || s == "1" || s == "yes" {
			return true, true
		}
		if s == "false" || s == "0" || s == "no" {
			return false, true
		}
	}
	return false, false
}
