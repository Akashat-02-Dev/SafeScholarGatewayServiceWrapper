package auth

import (
	"context"
	"errors"
	"strings"

	"safescholar/gateway/internal/security"
)

type TokenValidator struct {
	jwtManager     *security.JWTManager
	sessionManager *SessionManager
}

func NewTokenValidator(jwtManager *security.JWTManager, sessionManager *SessionManager) *TokenValidator {
	return &TokenValidator{
		jwtManager:     jwtManager,
		sessionManager: sessionManager,
	}
}

func (v *TokenValidator) ValidateAccessToken(ctx context.Context, tokenString string) (security.TokenClaims, Session, error) {
	claims, sess, err := v.validate(ctx, tokenString, security.TokenTypeAccess)
	if err != nil {
		return security.TokenClaims{}, Session{}, err
	}
	return claims, sess, nil
}

func (v *TokenValidator) ValidateRefreshToken(ctx context.Context, tokenString string) (security.TokenClaims, Session, error) {
	claims, sess, err := v.validate(ctx, tokenString, security.TokenTypeRefresh)
	if err != nil {
		return security.TokenClaims{}, Session{}, err
	}
	return claims, sess, nil
}

func (v *TokenValidator) ValidateServiceToken(ctx context.Context, tokenString string) (security.TokenClaims, error) {
	if v.jwtManager == nil {
		return security.TokenClaims{}, errors.New("jwt manager not configured")
	}
	claims, err := v.jwtManager.ParseAndValidate(tokenString)
	if err != nil {
		return security.TokenClaims{}, errors.New("invalid token")
	}
	if claims.ID != string(security.TokenTypeService) {
		return security.TokenClaims{}, errors.New("invalid token")
	}
	if strings.TrimSpace(claims.Subject) == "" || strings.TrimSpace(claims.TokenID) == "" {
		return security.TokenClaims{}, errors.New("invalid token")
	}
	return claims, nil
}

func (v *TokenValidator) validate(ctx context.Context, tokenString string, expected security.TokenType) (security.TokenClaims, Session, error) {
	if v.jwtManager == nil {
		return security.TokenClaims{}, Session{}, errors.New("jwt manager not configured")
	}
	claims, err := v.jwtManager.ParseAndValidate(tokenString)
	if err != nil {
		return security.TokenClaims{}, Session{}, errors.New("invalid token")
	}
	if claims.ID != string(expected) {
		return security.TokenClaims{}, Session{}, errors.New("invalid token")
	}
	if strings.TrimSpace(claims.Subject) == "" || strings.TrimSpace(claims.TokenID) == "" {
		return security.TokenClaims{}, Session{}, errors.New("invalid token")
	}
	if strings.TrimSpace(claims.SessionID) == "" {
		return security.TokenClaims{}, Session{}, errors.New("invalid token")
	}
	if strings.TrimSpace(claims.Institution) == "" {
		return security.TokenClaims{}, Session{}, errors.New("invalid token")
	}

	if v.sessionManager == nil {
		return claims, Session{}, nil
	}
	blacklisted, err := v.sessionManager.IsTokenBlacklisted(ctx, claims.TokenID)
	if err != nil {
		return security.TokenClaims{}, Session{}, err
	}
	if blacklisted {
		return security.TokenClaims{}, Session{}, errors.New("invalid token")
	}
	sess, err := v.sessionManager.Validate(ctx, claims.Institution, claims.SessionID)
	if err != nil {
		return security.TokenClaims{}, Session{}, errors.New("invalid token")
	}
	if sess.SessionID != "" && sess.SessionID != claims.SessionID {
		return security.TokenClaims{}, Session{}, errors.New("invalid token")
	}
	if expected == security.TokenTypeRefresh {
		if strings.TrimSpace(sess.TokenID) != "" && strings.TrimSpace(sess.TokenID) != strings.TrimSpace(claims.TokenID) {
			return security.TokenClaims{}, Session{}, errors.New("invalid token")
		}
	}
	return claims, sess, nil
}
