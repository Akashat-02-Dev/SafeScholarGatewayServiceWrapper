package middleware

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"

	"safescholar/gateway/internal/auth"
)

type RouteMeta struct {
	ServiceName        string
	RequiredPermission string
	AuthRequired       bool
}

type UserContext struct {
	UserID           string
	SessionID        string
	TokenID          string
	InstitutionID    string
	Roles            []string
	Permissions      []string
	IsSysAdmin       bool
	IsAuthenticated  bool
}

func contextWithRouteMeta(ctx context.Context, meta RouteMeta) context.Context {
	return context.WithValue(ctx, ctxKeyRouteMeta, meta)
}

func RouteMetaFromContext(ctx context.Context) RouteMeta {
	if v := ctx.Value(ctxKeyRouteMeta); v != nil {
		if rm, ok := v.(RouteMeta); ok {
			return rm
		}
	}
	return RouteMeta{}
}

func contextWithUserContext(ctx context.Context, uc UserContext) context.Context {
	return context.WithValue(ctx, ctxKeyUserContext, uc)
}

func UserContextFromContext(ctx context.Context) UserContext {
	if v := ctx.Value(ctxKeyUserContext); v != nil {
		if uc, ok := v.(UserContext); ok {
			return uc
		}
	}
	return UserContext{}
}

func newShortID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func ContextWithRouteMeta(ctx context.Context, meta RouteMeta) context.Context {
	return contextWithRouteMeta(ctx, meta)
}

func AuthMiddleware(validator *auth.TokenValidator) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			meta := RouteMetaFromContext(r.Context())
			tokenString, tokenPresent, err := tryBearerToken(r)
			if err != nil {
				if meta.AuthRequired {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				next.ServeHTTP(w, r)
				return
			}
			if !meta.AuthRequired && !tokenPresent {
				next.ServeHTTP(w, r)
				return
			}
			if validator == nil {
				if meta.AuthRequired {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				next.ServeHTTP(w, r)
				return
			}
			claims, sess, err := validator.ValidateAccessToken(r.Context(), tokenString)
			if err != nil {
				if meta.AuthRequired {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			uc := UserContext{
				UserID:          claims.Subject,
				SessionID:       claims.SessionID,
				TokenID:         claims.TokenID,
				InstitutionID:   claims.Institution,
				Roles:           claims.Roles,
				Permissions:     claims.Permissions,
				IsSysAdmin:      hasPerm(claims.Permissions, "SUPER_ADMIN"),
				IsAuthenticated: true,
			}
			if sess.SessionID != "" && sess.SessionID != claims.SessionID {
				if meta.AuthRequired {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				next.ServeHTTP(w, r)
				return
			}
			r = r.WithContext(contextWithUserContext(r.Context(), uc))
			next.ServeHTTP(w, r)
		})
	}
}

func tryBearerToken(r *http.Request) (string, bool, error) {
	h := strings.TrimSpace(r.Header.Get("Authorization"))
	if h == "" {
		return "", false, nil
	}
	parts := strings.SplitN(h, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return "", true, errors.New("invalid")
	}
	t := strings.TrimSpace(parts[1])
	if t == "" {
		return "", true, errors.New("invalid")
	}
	return t, true, nil
}

func hasPerm(perms []string, required string) bool {
	req := strings.ToUpper(strings.TrimSpace(required))
	for _, p := range perms {
		if strings.ToUpper(strings.TrimSpace(p)) == req {
			return true
		}
	}
	return false
}
