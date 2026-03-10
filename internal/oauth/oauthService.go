package oauth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/oauth2"

	"safescholar/gateway/config"
	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/security"
	"safescholar/gateway/infrastructure/database"
)

type Provider string

const (
	ProviderGoogle    Provider = "google"
	ProviderMicrosoft Provider = "microsoft"
	ProviderApple     Provider = "apple"
)

type OAuthService struct {
	rdb         *redis.Client
	pool        *pgxpool.Pool
	tokenGen    *auth.TokenGenerator
	sessionMgr  *auth.SessionManager
	auditLogger *security.AuditLogger

	stateCookieName string
	verifierCookieName string
	stateTTL        time.Duration

	providers map[Provider]*providerRuntime
}

type providerRuntime struct {
	enabled  bool
	oauthCfg *oauth2.Config
	verifier *oidc.IDTokenVerifier
}

type oauthIdentity struct {
	Subject   string
	Email     string
	FirstName string
	LastName  string
}

func identityFromToken(provider Provider, tok *oidc.IDToken) (oauthIdentity, error) {
	switch provider {
	case ProviderGoogle:
		return googleIdentityFromToken(tok)
	case ProviderMicrosoft:
		return microsoftIdentityFromToken(tok)
	case ProviderApple:
		return appleIdentityFromToken(tok)
	default:
		return oauthIdentity{}, errors.New("oauth provider unsupported")
	}
}

func providerOIDCConfig(provider Provider, clientID, tenant string) *oidc.Config {
	switch provider {
	case ProviderGoogle:
		return googleOIDCConfig(clientID)
	case ProviderMicrosoft:
		return microsoftOIDCConfig(clientID, tenant)
	case ProviderApple:
		return appleOIDCConfig(clientID)
	default:
		return &oidc.Config{ClientID: clientID}
	}
}

func providerAuthCodeOptions(provider Provider, nonce, codeChallenge string) []oauth2.AuthCodeOption {
	switch provider {
	case ProviderGoogle:
		return googleAuthCodeOptions(nonce, codeChallenge)
	case ProviderMicrosoft:
		return microsoftAuthCodeOptions(nonce, codeChallenge)
	case ProviderApple:
		return appleAuthCodeOptions(nonce, codeChallenge)
	default:
		return []oauth2.AuthCodeOption{
			oauth2.AccessTypeOffline,
			oauth2.SetAuthURLParam("nonce", nonce),
			oauth2.SetAuthURLParam("code_challenge", codeChallenge),
			oauth2.SetAuthURLParam("code_challenge_method", "S256"),
		}
	}
}

func isSecureRequest(r *http.Request) bool {
	if r == nil {
		return false
	}
	if r.TLS != nil {
		return true
	}
	if strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")), "https") {
		return true
	}
	return false
}

func codeChallengeS256(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func splitName(full string) (string, string) {
	v := strings.TrimSpace(full)
	if v == "" {
		return "", ""
	}
	parts := strings.Fields(v)
	if len(parts) == 1 {
		return parts[0], ""
	}
	first := parts[0]
	last := strings.Join(parts[1:], " ")
	return first, last
}

type OAuthLoginResult struct {
	UserID        string
	InstitutionID string
	Email         string
	FirstName     string
	LastName      string
	SessionID     string
	AccessToken   string
	RefreshToken  string
}

func NewOAuthService(ctx context.Context, cfg config.OAuthConfig, pool *pgxpool.Pool, rdb *redis.Client, tokenGen *auth.TokenGenerator, sessionMgr *auth.SessionManager, auditLogger *security.AuditLogger) (*OAuthService, error) {
	s := &OAuthService{
		rdb:             rdb,
		pool:            pool,
		tokenGen:        tokenGen,
		sessionMgr:      sessionMgr,
		auditLogger:     auditLogger,
		stateCookieName: cfg.StateCookieName,
		stateTTL:        cfg.StateTTL,
		providers:       map[Provider]*providerRuntime{},
	}

	if strings.TrimSpace(s.stateCookieName) == "" {
		s.stateCookieName = "ss_oauth_state"
	}
	s.verifierCookieName = s.stateCookieName + "_cv"
	if s.stateTTL <= 0 {
		s.stateTTL = 10 * time.Minute
	}

	if cfg.Google.Enabled {
		rt, err := buildProvider(ctx, ProviderGoogle, cfg.Google, googleIssuerURL())
		if err != nil {
			return nil, err
		}
		s.providers[ProviderGoogle] = rt
	}
	if cfg.Microsoft.Enabled {
		rt, err := buildProvider(ctx, ProviderMicrosoft, cfg.Microsoft, microsoftIssuerURL(cfg.Microsoft.Tenant))
		if err != nil {
			return nil, err
		}
		s.providers[ProviderMicrosoft] = rt
	}
	if cfg.Apple.Enabled {
		rt, err := buildProvider(ctx, ProviderApple, cfg.Apple, appleIssuerURL())
		if err != nil {
			return nil, err
		}
		s.providers[ProviderApple] = rt
	}
	return s, nil
}

func buildProvider(ctx context.Context, provider Provider, cfg config.OAuthProviderConfig, issuer string) (*providerRuntime, error) {
	if strings.TrimSpace(cfg.ClientID) == "" || strings.TrimSpace(cfg.RedirectURL) == "" {
		return nil, errors.New("oauth provider misconfigured")
	}
	if strings.TrimSpace(cfg.ClientSecret) == "" {
		return nil, errors.New("oauth provider misconfigured")
	}
	p, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, err
	}
	oauthCfg := &oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		Endpoint:     p.Endpoint(),
		RedirectURL:  cfg.RedirectURL,
		Scopes:       append([]string{"openid", "email"}, cfg.Scopes...),
	}
	verifier := p.Verifier(providerOIDCConfig(provider, cfg.ClientID, cfg.Tenant))
	return &providerRuntime{
		enabled:  cfg.Enabled,
		oauthCfg: oauthCfg,
		verifier: verifier,
	}, nil
}

func (s *OAuthService) Start(w http.ResponseWriter, r *http.Request, provider Provider) error {
	rt, ok := s.providers[provider]
	if !ok || rt == nil || !rt.enabled {
		return errors.New("provider disabled")
	}
	state, err := randomState()
	if err != nil {
		return err
	}
	codeVerifier, err := randomState()
	if err != nil {
		return err
	}
	nonce, err := randomState()
	if err != nil {
		return err
	}
	stateValue := codeVerifier + ":" + nonce

	http.SetCookie(w, &http.Cookie{
		Name:     s.stateCookieName,
		Value:    state,
		Path:     "/api/oauth/",
		HttpOnly: true,
		Secure:   isSecureRequest(r),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(s.stateTTL.Seconds()),
	})

	if s.rdb != nil {
		if err := s.rdb.Set(r.Context(), "oauth:state:"+state, stateValue, s.stateTTL).Err(); err != nil {
			return err
		}
	} else {
		http.SetCookie(w, &http.Cookie{
			Name:     s.verifierCookieName,
			Value:    stateValue,
			Path:     "/api/oauth/",
			HttpOnly: true,
			Secure:   isSecureRequest(r),
			SameSite: http.SameSiteLaxMode,
			MaxAge:   int(s.stateTTL.Seconds()),
		})
	}

	codeChallenge := codeChallengeS256(codeVerifier)
	url := rt.oauthCfg.AuthCodeURL(state, providerAuthCodeOptions(provider, nonce, codeChallenge)...)
	http.Redirect(w, r, url, http.StatusFound)
	return nil
}

func (s *OAuthService) Callback(ctx context.Context, provider Provider, code, state string, cookies []*http.Cookie, ipAddress, userAgent, correlationID string) (OAuthLoginResult, error) {
	rt, ok := s.providers[provider]
	if !ok || rt == nil || !rt.enabled {
		return OAuthLoginResult{}, errors.New("provider disabled")
	}
	if strings.TrimSpace(code) == "" || strings.TrimSpace(state) == "" {
		return OAuthLoginResult{}, errors.New("invalid oauth callback")
	}
	codeVerifier, nonce, ok := s.consumeState(ctx, state, cookies)
	if !ok {
		return OAuthLoginResult{}, errors.New("invalid oauth state")
	}

	exchangeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	token, err := rt.oauthCfg.Exchange(exchangeCtx, code, oauth2.SetAuthURLParam("code_verifier", codeVerifier))
	if err != nil {
		return OAuthLoginResult{}, errors.New("oauth exchange failed")
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || strings.TrimSpace(rawIDToken) == "" {
		return OAuthLoginResult{}, errors.New("oauth missing id_token")
	}
	idToken, err := rt.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return OAuthLoginResult{}, errors.New("oauth invalid id_token")
	}
	if nonce != "" && strings.TrimSpace(idToken.Nonce) != "" && idToken.Nonce != nonce {
		return OAuthLoginResult{}, errors.New("oauth invalid nonce")
	}

	identity, err := identityFromToken(provider, idToken)
	if err != nil {
		return OAuthLoginResult{}, err
	}
	if identity.Subject == "" || identity.Email == "" {
		return OAuthLoginResult{}, errors.New("oauth insufficient identity")
	}

	userID, institutionID, err := s.findOrCreateUser(ctx, string(provider), identity.Subject, identity.Email, identity.FirstName, identity.LastName)
	if err != nil {
		return OAuthLoginResult{}, err
	}

	sessionID, err := randomUUID()
	if err != nil {
		return OAuthLoginResult{}, err
	}
	refreshTTL := 30 * 24 * time.Hour
	accessTTL := 15 * time.Minute

	if s.sessionMgr != nil {
		if err := s.sessionMgr.Create(ctx, auth.Session{
			SessionID:     sessionID,
			UserID:        userID,
			IPAddress:     ipAddress,
			UserAgent:     userAgent,
			CreatedAt:     time.Now().UTC(),
			ExpiresAt:     time.Now().UTC().Add(refreshTTL),
		}); err != nil {
			return OAuthLoginResult{}, err
		}
	}

	roles, perms, err := s.loadUserAuthz(ctx, institutionID, userID)
	if err != nil {
		return OAuthLoginResult{}, err
	}
	if ok, _ := s.isSysAdminUser(ctx, userID); ok {
		perms = append(perms, "SUPER_ADMIN")
	}
	toks, _, refreshClaims, err := s.tokenGen.IssueUserTokens(ctx, userID, institutionID, sessionID, roles, perms, accessTTL, refreshTTL)
	if err != nil {
		return OAuthLoginResult{}, err
	}
	if s.sessionMgr != nil {
		_ = s.sessionMgr.SetTokenID(ctx, institutionID, sessionID, refreshClaims.TokenID)
	}
	if s.rdb != nil {
		if b, err := json.Marshal(perms); err == nil {
			_ = s.rdb.Set(ctx, "permissions:"+userID, b, refreshTTL).Err()
		}
	}

	_ = s.auditLogger.Log(ctx, security.AuditEvent{
		UserID:        userID,
		Action:        "OAUTH_LOGIN_SUCCESS",
		Resource:      "user",
		ResourceID:    userID,
		CreatedAt:     time.Now().UTC(),
		Metadata: map[string]any{
			"provider":      string(provider),
			"correlationId": correlationID,
		},
	})

	return OAuthLoginResult{
		UserID:        userID,
		InstitutionID: institutionID,
		Email:         identity.Email,
		FirstName:     identity.FirstName,
		LastName:      identity.LastName,
		SessionID:     sessionID,
		AccessToken:   toks.AccessToken,
		RefreshToken:  toks.RefreshToken,
	}, nil
}

func (s *OAuthService) consumeState(ctx context.Context, state string, cookies []*http.Cookie) (string, string, bool) {
	var cookieState string
	var cookieVerifier string
	for _, c := range cookies {
		if c == nil {
			continue
		}
		if c.Name == s.stateCookieName {
			cookieState = c.Value
		}
		if c.Name == s.verifierCookieName {
			cookieVerifier = c.Value
		}
	}
	if strings.TrimSpace(cookieState) == "" || cookieState != state {
		return "", "", false
	}

	stateValue := strings.TrimSpace(cookieVerifier)
	if s.rdb != nil {
		v, err := s.rdb.GetDel(ctx, "oauth:state:"+state).Result()
		if err != nil {
			return "", "", false
		}
		stateValue = strings.TrimSpace(v)
	}
	parts := strings.SplitN(stateValue, ":", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	codeVerifier := strings.TrimSpace(parts[0])
	nonce := strings.TrimSpace(parts[1])
	if codeVerifier == "" || nonce == "" {
		return "", "", false
	}
	return codeVerifier, nonce, true
}

func (s *OAuthService) findOrCreateUser(ctx context.Context, provider, providerSubject, email, firstName, lastName string) (string, string, error) {
	if s.pool == nil {
		return "", "", errors.New("oauth store unavailable")
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return "", "", err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return "", "", err
	}

	var userID string
	var institutionID string
	err = tx.QueryRow(ctx, `
select u.user_id::text, coalesce(u.institution_id::text,'')
from oauth_accounts oa
join users u on u.user_id = oa.user_id
where oa.provider=$1 and oa.provider_user_id=$2`, provider, providerSubject).Scan(&userID, &institutionID)
	if err == nil {
		return userID, institutionID, tx.Commit(ctx)
	}

	err = tx.QueryRow(ctx, `select user_id::text, coalesce(institution_id::text,'') from users where lower(email)=lower($1) limit 1`, email).Scan(&userID, &institutionID)
	if err != nil {
		err = tx.QueryRow(ctx, `
insert into users(email, first_name, last_name, status, is_sys_admin)
values ($1, nullif($2,''), nullif($3,''), 'active', false)
returning user_id::text, coalesce(institution_id::text,'')`, email, firstName, lastName).Scan(&userID, &institutionID)
		if err != nil {
			return "", "", errors.New("oauth user create failed")
		}
	}

	_, err = tx.Exec(ctx, `
insert into oauth_accounts(user_id, provider, provider_user_id, email)
values (nullif($1,'')::uuid, $2, $3, $4)
on conflict (provider, provider_user_id) do nothing`, userID, provider, providerSubject, email)
	if err != nil {
		return "", "", err
	}

	return userID, institutionID, tx.Commit(ctx)
}

func (s *OAuthService) isSysAdminUser(ctx context.Context, userID string) (bool, error) {
	if s.pool == nil {
		return false, errors.New("oauth store unavailable")
	}
	uid := strings.TrimSpace(userID)
	if uid == "" {
		return false, nil
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if err := database.ApplyAppContext(ctx, tx, database.AppContext{AllowLogin: true}); err != nil {
		return false, err
	}

	var v bool
	if err := tx.QueryRow(ctx, `select is_sys_admin from users where user_id = nullif($1,'')::uuid`, uid).Scan(&v); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return v, nil
}

func (s *OAuthService) loadUserAuthz(ctx context.Context, institutionID, userID string) ([]string, []string, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: institutionID}); err != nil {
		return nil, nil, err
	}

	rows, err := tx.Query(ctx, `
select r.name
from user_roles ur
join roles r on r.role_id = ur.role_id
where ur.user_id = nullif($1,'')::uuid`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var roles []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, nil, err
		}
		n = strings.ToLower(strings.TrimSpace(n))
		if n != "" {
			roles = append(roles, n)
		}
	}
	if rows.Err() != nil {
		return nil, nil, rows.Err()
	}

	prows, err := tx.Query(ctx, `
select distinct p.name
from user_roles ur
join role_permissions rp on rp.role_id = ur.role_id
join permissions p on p.permission_id = rp.permission_id
where ur.user_id = nullif($1,'')::uuid`, userID)
	if err != nil {
		return nil, nil, err
	}
	defer prows.Close()
	var perms []string
	for prows.Next() {
		var c string
		if err := prows.Scan(&c); err != nil {
			return nil, nil, err
		}
		c = strings.ToUpper(strings.TrimSpace(c))
		if c != "" {
			perms = append(perms, c)
		}
	}
	if prows.Err() != nil {
		return nil, nil, prows.Err()
	}

	return roles, perms, tx.Commit(ctx)
}

func randomState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func randomUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	p1 := binary.BigEndian.Uint32(b[0:4])
	p2 := binary.BigEndian.Uint16(b[4:6])
	p3 := binary.BigEndian.Uint16(b[6:8])
	p4 := binary.BigEndian.Uint16(b[8:10])
	p5 := uint64(0)
	for i := 10; i < 16; i++ {
		p5 = (p5 << 8) | uint64(b[i])
	}
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", p1, p2, p3, p4, p5), nil
}
