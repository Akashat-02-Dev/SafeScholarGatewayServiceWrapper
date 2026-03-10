package oauth

import (
	"errors"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

func googleIssuerURL() string {
	return "https://accounts.google.com"
}

func googleOIDCConfig(clientID string) *oidc.Config {
	return &oidc.Config{ClientID: clientID}
}

func googleAuthCodeOptions(nonce, codeChallenge string) []oauth2.AuthCodeOption {
	return []oauth2.AuthCodeOption{
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("nonce", nonce),
		oauth2.SetAuthURLParam("code_challenge", codeChallenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	}
}

func googleIdentityFromToken(tok *oidc.IDToken) (oauthIdentity, error) {
	if tok == nil {
		return oauthIdentity{}, errors.New("oauth invalid id_token")
	}

	var claims struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		GivenName     string `json:"given_name"`
		FamilyName    string `json:"family_name"`
		Name          string `json:"name"`
		Sub           string `json:"sub"`
	}
	if err := tok.Claims(&claims); err != nil {
		return oauthIdentity{}, errors.New("oauth invalid claims")
	}
	email := strings.ToLower(strings.TrimSpace(claims.Email))
	if email == "" {
		return oauthIdentity{}, errors.New("oauth insufficient identity")
	}
	if !claims.EmailVerified {
		return oauthIdentity{}, errors.New("oauth email not verified")
	}
	sub := strings.TrimSpace(tok.Subject)
	if sub == "" {
		sub = strings.TrimSpace(claims.Sub)
	}
	if sub == "" {
		return oauthIdentity{}, errors.New("oauth insufficient identity")
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
