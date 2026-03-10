package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"safescholar/gateway/infrastructure/database"
	"safescholar/gateway/internal/security"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TokenGenerator struct {
	jwtManager *security.JWTManager
	pool       *pgxpool.Pool
}

func NewTokenGenerator(jwtManager *security.JWTManager, pool *pgxpool.Pool) *TokenGenerator {
	return &TokenGenerator{jwtManager: jwtManager, pool: pool}
}

type Tokens struct {
	AccessToken  string
	RefreshToken string
}

func (g *TokenGenerator) IssueUserTokens(ctx context.Context, userID, institutionID, sessionID string, roles, permissions []string, accessTTL, refreshTTL time.Duration) (Tokens, security.TokenClaims, security.TokenClaims, error) {
	if g.jwtManager == nil {
		return Tokens{}, security.TokenClaims{}, security.TokenClaims{}, errors.New("jwt manager not configured")
	}
	sub := strings.TrimSpace(userID)
	if sub == "" {
		return Tokens{}, security.TokenClaims{}, security.TokenClaims{}, errors.New("user id required")
	}

	accessToken, accessClaims, err := g.jwtManager.Generate(sub, security.TokenTypeAccess, sessionID, roles, permissions, institutionID, accessTTL)
	if err != nil {
		return Tokens{}, security.TokenClaims{}, security.TokenClaims{}, err
	}
	refreshToken, refreshClaims, err := g.jwtManager.Generate(sub, security.TokenTypeRefresh, sessionID, roles, permissions, institutionID, refreshTTL)
	if err != nil {
		return Tokens{}, security.TokenClaims{}, security.TokenClaims{}, err
	}

	if g.pool != nil {
		if err := g.recordToken(ctx, institutionID, accessClaims, security.TokenTypeAccess); err != nil {
			return Tokens{}, security.TokenClaims{}, security.TokenClaims{}, err
		}
		if err := g.recordToken(ctx, institutionID, refreshClaims, security.TokenTypeRefresh); err != nil {
			return Tokens{}, security.TokenClaims{}, security.TokenClaims{}, err
		}
	}

	return Tokens{AccessToken: accessToken, RefreshToken: refreshToken}, accessClaims, refreshClaims, nil
}

func (g *TokenGenerator) IssueServiceToken(ctx context.Context, subject string, ttl time.Duration) (string, security.TokenClaims, error) {
	if g.jwtManager == nil {
		return "", security.TokenClaims{}, errors.New("jwt manager not configured")
	}
	token, claims, err := g.jwtManager.Generate(subject, security.TokenTypeService, "", []string{"gateway"}, []string{"SERVICE_ACCESS"}, "", ttl)
	if err != nil {
		return "", security.TokenClaims{}, err
	}
	return token, claims, nil
}

func (g *TokenGenerator) recordToken(ctx context.Context, institutionID string, claims security.TokenClaims, tokenType security.TokenType) error {
	tx, err := g.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	if err := database.ApplyAppContext(ctx, tx, database.AppContext{InstitutionID: institutionID}); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
insert into jwt_tokens(token_id, user_id, session_id, token_type, issued_at, expires_at)
values (nullif($1,'')::uuid, nullif($2,'')::uuid, nullif($3,'')::uuid, $4, $5, $6)
on conflict (token_id) do nothing`,
		claims.TokenID, claims.Subject, claims.SessionID, string(tokenType),
		claims.IssuedAt.Time, claims.ExpiresAt.Time,
	)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
