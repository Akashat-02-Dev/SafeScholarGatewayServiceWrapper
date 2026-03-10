package adapters

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"safescholar/gateway/config"
	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/middleware"
)

func NewHTTPClient(cfg config.MTLSConfig) (*http.Client, error) {
	return NewHTTPClientWithDeps(cfg, HTTPClientDeps{})
}

type HTTPClientDeps struct {
	TokenGenerator  *auth.TokenGenerator
	TokenValidator  *auth.TokenValidator
	ServiceTokenTTL time.Duration
	GatewayName     string
}

func NewHTTPClientWithDeps(cfg config.MTLSConfig, deps HTTPClientDeps) (*http.Client, error) {
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
	}

	if cfg.Enabled {
		tlsCfg, err := buildMTLSConfig(cfg)
		if err != nil {
			return nil, err
		}
		tr.TLSClientConfig = tlsCfg
	} else {
		tr.TLSClientConfig = &tls.Config{
			MinVersion: tlsMinVersion(cfg.MinVersion),
		}
	}

	deps.GatewayName = strings.TrimSpace(deps.GatewayName)
	if deps.GatewayName == "" {
		deps.GatewayName = "safescholar-gateway"
	}
	if deps.ServiceTokenTTL <= 0 {
		deps.ServiceTokenTTL = 2 * time.Minute
	}
	rt := http.RoundTripper(tr)
	rt = &secureRoundTripper{base: rt, deps: deps}

	return &http.Client{
		Timeout:   15 * time.Second,
		Transport: rt,
	}, nil
}

func buildMTLSConfig(cfg config.MTLSConfig) (*tls.Config, error) {
	caPEM, err := os.ReadFile(filepath.Clean(cfg.CACertFile))
	if err != nil {
		return nil, err
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(caPEM) {
		return nil, errors.New("invalid mtls ca cert")
	}
	cert, err := tls.LoadX509KeyPair(filepath.Clean(cfg.ClientCertFile), filepath.Clean(cfg.ClientKeyFile))
	if err != nil {
		return nil, err
	}
	return &tls.Config{
		MinVersion:   tlsMinVersion(cfg.MinVersion),
		RootCAs:      roots,
		Certificates: []tls.Certificate{cert},
		ServerName:   cfg.ServerName,
	}, nil
}

func tlsMinVersion(v uint16) uint16 {
	if v == 0 {
		return tls.VersionTLS13
	}
	return v
}

type secureRoundTripper struct {
	base http.RoundTripper
	deps HTTPClientDeps
}

func (s *secureRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if req == nil {
		return nil, errors.New("request required")
	}
	if req.URL == nil {
		return nil, errors.New("request url required")
	}
	base := s.base
	if base == nil {
		base = http.DefaultTransport
	}

	out := req.Clone(req.Context())
	out.Header = cloneHeader(out.Header)

	if cid := middleware.CorrelationIDFromContext(out.Context()); cid != "" {
		setIfEmpty(out.Header, "X-Request-Id", cid)
		setIfEmpty(out.Header, "X-Correlation-Id", cid)
		setIfEmpty(out.Header, "X-SS-Correlation-Id", cid)
	}
	setIfEmpty(out.Header, "X-Gateway", s.deps.GatewayName)

	uc := middleware.UserContextFromContext(out.Context())
	if uc.IsAuthenticated {
		setIfEmpty(out.Header, "X-Authenticated", "true")
		setIfEmpty(out.Header, "X-User-Id", uc.UserID)
		setIfEmpty(out.Header, "X-Institution-Id", uc.InstitutionID)
		setIfEmpty(out.Header, "X-Session-Id", uc.SessionID)
		setIfEmpty(out.Header, "X-Token-Id", uc.TokenID)
		if len(uc.Roles) > 0 && strings.TrimSpace(out.Header.Get("X-Roles")) == "" {
			out.Header.Set("X-Roles", strings.Join(uc.Roles, ","))
		}
		if len(uc.Permissions) > 0 && strings.TrimSpace(out.Header.Get("X-Permissions")) == "" {
			out.Header.Set("X-Permissions", strings.Join(uc.Permissions, ","))
		}
	} else {
		setIfEmpty(out.Header, "X-Authenticated", "false")
	}

	if s.deps.TokenGenerator != nil {
		tok, _, err := s.deps.TokenGenerator.IssueServiceToken(out.Context(), "gateway", s.deps.ServiceTokenTTL)
		if err != nil {
			return nil, errors.New("service token unavailable")
		}
		if strings.TrimSpace(tok) != "" {
			out.Header.Set("Authorization", "Bearer "+tok)
			out.Header.Set("X-SS-Service-Token", tok)
		}
	}

	if err := validateHeaderValues(out.Header); err != nil {
		return nil, err
	}

	resp, err := base.RoundTrip(out)
	if err != nil {
		return nil, err
	}

	if s.deps.TokenValidator != nil {
		if sig := strings.TrimSpace(resp.Header.Get("X-SS-Service-Token")); sig != "" {
			if _, err := s.deps.TokenValidator.ValidateServiceToken(out.Context(), sig); err != nil {
				_ = resp.Body.Close()
				return nil, errors.New("invalid response signature")
			}
		}
	}

	if err := validateHeaderValues(resp.Header); err != nil {
		_ = resp.Body.Close()
		return nil, err
	}
	resp.Body = &limitedBody{rc: resp.Body, n: 25 * 1024 * 1024}
	return resp, nil
}

func cloneHeader(h http.Header) http.Header {
	if h == nil {
		return make(http.Header)
	}
	out := make(http.Header, len(h))
	for k, vs := range h {
		cp := make([]string, len(vs))
		copy(cp, vs)
		out[k] = cp
	}
	return out
}

func setIfEmpty(h http.Header, key, value string) {
	if strings.TrimSpace(h.Get(key)) == "" && strings.TrimSpace(value) != "" {
		h.Set(key, value)
	}
}

func validateHeaderValues(h http.Header) error {
	for k, vs := range h {
		if strings.ContainsAny(k, "\r\n") {
			return errors.New("invalid header")
		}
		for _, v := range vs {
			if strings.ContainsAny(v, "\r\n") {
				return errors.New("invalid header")
			}
		}
	}
	return nil
}

type limitedBody struct {
	rc io.ReadCloser
	n  int64
}

func (l *limitedBody) Read(p []byte) (int, error) {
	if l.n <= 0 {
		return 0, errors.New("response too large")
	}
	if int64(len(p)) > l.n {
		p = p[:l.n]
	}
	n, err := l.rc.Read(p)
	l.n -= int64(n)
	return n, err
}

func (l *limitedBody) Close() error {
	if l.rc == nil {
		return nil
	}
	return l.rc.Close()
}
