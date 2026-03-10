package oauth

import (
	"errors"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

func microsoftIssuerURL(tenant string) string {
	t := strings.TrimSpace(tenant)
	if t == "" {
		t = "common"
	}
	return "https://login.microsoftonline.com/" + t + "/v2.0"
}

func microsoftOIDCConfig(clientID, tenant string) *oidc.Config {
	cfg := &oidc.Config{ClientID: clientID}
	if microsoftSkipIssuerCheck(tenant) {
		cfg.SkipIssuerCheck = true
	}
	return cfg
}

func microsoftAuthCodeOptions(nonce, codeChallenge string) []oauth2.AuthCodeOption {
	return []oauth2.AuthCodeOption{
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("nonce", nonce),
		oauth2.SetAuthURLParam("code_challenge", codeChallenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	}
}

func microsoftIdentityFromToken(tok *oidc.IDToken) (oauthIdentity, error) {
	if tok == nil {
		return oauthIdentity{}, errors.New("oauth invalid id_token")
	}

	var claims struct {
		PreferredUsername string `json:"preferred_username"`
		Email             string `json:"email"`
		UPN               string `json:"upn"`
		GivenName         string `json:"given_name"`
		FamilyName        string `json:"family_name"`
		Name              string `json:"name"`
		Sub               string `json:"sub"`
	}
	if err := tok.Claims(&claims); err != nil {
		return oauthIdentity{}, errors.New("oauth invalid claims")
	}
	email := strings.ToLower(strings.TrimSpace(claims.Email))
	if email == "" {
		email = strings.ToLower(strings.TrimSpace(claims.PreferredUsername))
	}
	if email == "" {
		email = strings.ToLower(strings.TrimSpace(claims.UPN))
	}
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

func microsoftSkipIssuerCheck(tenant string) bool {
	t := strings.ToLower(strings.TrimSpace(tenant))
	if t == "" {
		return true
	}
	switch t {
	case "common", "organizations", "consumers":
		return true
	default:
		return false
	}
}
