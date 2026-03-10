package middleware

import (
	"bufio"
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, middleware ...Middleware) http.Handler {
	for i := len(middleware) - 1; i >= 0; i-- {
		h = middleware[i](h)
	}
	return h
}

type ctxKey string

const (
	ctxKeyCorrelationID ctxKey = "correlation_id"
	ctxKeyRouteMeta     ctxKey = "route_meta"
	ctxKeyUserContext   ctxKey = "user_context"
)

type ResponseRecorder struct {
	http.ResponseWriter
	status int
	bytes  int64
}

func (r *ResponseRecorder) WriteHeader(statusCode int) {
	r.status = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

func (r *ResponseRecorder) Write(p []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(p)
	r.bytes += int64(n)
	return n, err
}

func (r *ResponseRecorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (r *ResponseRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := r.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("hijack not supported")
	}
	return h.Hijack()
}

func (r *ResponseRecorder) Push(target string, opts *http.PushOptions) error {
	if p, ok := r.ResponseWriter.(http.Pusher); ok {
		return p.Push(target, opts)
	}
	return http.ErrNotSupported
}

func LoggingMiddleware(logger *slog.Logger) Middleware {
	if logger == nil {
		logger = slog.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now().UTC()
			cid := GetOrCreateCorrelationID(w, r)
			ctx := contextWithCorrelationID(r.Context(), cid)
			r = r.WithContext(ctx)

			rr := &ResponseRecorder{ResponseWriter: w}
			next.ServeHTTP(rr, r)
			if rr.status == 0 {
				rr.status = http.StatusOK
			}

			route := RouteMetaFromContext(r.Context())
			uc := UserContextFromContext(r.Context())
			ip := ClientIP(r)
			ipStr := ""
			if ip != nil {
				ipStr = ip.String()
			}

			logger.Info("request",
				slog.String("cid", cid),
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rr.status),
				slog.Int64("bytes", rr.bytes),
				slog.Duration("latency", time.Since(start)),
				slog.String("ip", ipStr),
				slog.String("user_agent", strings.TrimSpace(r.UserAgent())),
				slog.String("route_service", route.ServiceName),
				slog.String("route_permission", route.RequiredPermission),
				slog.String("user_id", uc.UserID),
				slog.String("institution_id", uc.InstitutionID),
				slog.Bool("authenticated", uc.IsAuthenticated),
			)
		})
	}
}

func contextWithCorrelationID(ctx context.Context, cid string) context.Context {
	return context.WithValue(ctx, ctxKeyCorrelationID, strings.TrimSpace(cid))
}

func CorrelationIDFromContext(ctx context.Context) string {
	if v := ctx.Value(ctxKeyCorrelationID); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func GetOrCreateCorrelationID(w http.ResponseWriter, r *http.Request) string {
	cid := strings.TrimSpace(r.Header.Get("X-Request-Id"))
	if cid == "" {
		cid = newShortID()
	}
	w.Header().Set("X-Request-Id", cid)
	return cid
}
