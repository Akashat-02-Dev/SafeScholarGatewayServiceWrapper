package clients

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/middleware"
)

type AssessmentClient struct {
	baseURL           *url.URL
	client            *http.Client
	tokenGen          *auth.TokenGenerator
	serviceToken      time.Duration
	responseValidator *auth.TokenValidator
	breaker           *circuitBreaker
}

func NewAssessmentClient(baseURL string, client *http.Client) *AssessmentClient {
	u := parseBaseURL(baseURL)
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	return &AssessmentClient{
		baseURL:      u,
		client:       client,
		serviceToken: 2 * time.Minute,
		breaker:      newCircuitBreaker(5, 60*time.Second, 30*time.Second),
	}
}

func NewAssessmentClientWithDeps(baseURL string, client *http.Client, tokenGen *auth.TokenGenerator, responseValidator *auth.TokenValidator) *AssessmentClient {
	c := NewAssessmentClient(baseURL, client)
	c.tokenGen = tokenGen
	c.responseValidator = responseValidator
	return c
}

func (c *AssessmentClient) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	if c.client == nil {
		return nil, errors.New("http client not configured")
	}
	if c.baseURL == nil || c.baseURL.Scheme == "" || c.baseURL.Host == "" {
		return nil, errors.New("invalid assessment base url")
	}
	if req == nil {
		return nil, errors.New("request required")
	}
	if req.URL == nil {
		return nil, errors.New("request url required")
	}
	if c.breaker != nil {
		if err := c.breaker.Allow(); err != nil {
			return nil, err
		}
	}

	if canRetryRequest(req) {
		return c.doWithRetry(ctx, req, 3)
	}
	return c.doOnce(ctx, req)
}

func (c *AssessmentClient) doWithRetry(ctx context.Context, req *http.Request, attempts int) (*http.Response, error) {
	var lastErr error
	for i := 0; i < attempts; i++ {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		attemptReq, err := cloneForAttempt(req, ctx)
		if err != nil {
			return nil, err
		}
		resp, err := c.doOnce(ctx, attemptReq)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		backoff := time.Duration(100*(1<<i)) * time.Millisecond
		t := time.NewTimer(backoff)
		select {
		case <-ctx.Done():
			t.Stop()
			return nil, ctx.Err()
		case <-t.C:
		}
	}
	return nil, lastErr
}

func (c *AssessmentClient) doOnce(ctx context.Context, req *http.Request) (*http.Response, error) {
	out := req.Clone(ctx)
	out.URL = resolveBaseURL(c.baseURL, req.URL)
	out.Host = out.URL.Host
	c.enrichHeaders(ctx, out)

	resp, err := c.client.Do(out)
	if err != nil {
		if c.breaker != nil {
			c.breaker.Failure()
		}
		return nil, err
	}

	if resp.StatusCode >= 500 {
		if c.breaker != nil {
			c.breaker.Failure()
		}
		_ = resp.Body.Close()
		return nil, errors.New("assessment service unavailable")
	}
	if c.breaker != nil {
		c.breaker.Success()
	}

	if c.responseValidator != nil {
		if sig := strings.TrimSpace(resp.Header.Get("X-SS-Service-Token")); sig != "" {
			claims, err := c.responseValidator.ValidateServiceToken(ctx, sig)
			if err != nil || strings.TrimSpace(claims.Subject) == "" {
				_ = resp.Body.Close()
				return nil, errors.New("invalid assessment response signature")
			}
		}
	}

	return resp, nil
}

func (c *AssessmentClient) enrichHeaders(ctx context.Context, req *http.Request) {
	uc := middleware.UserContextFromContext(ctx)
	if strings.TrimSpace(uc.UserID) != "" {
		req.Header.Set("X-SS-User-Id", uc.UserID)
	}
	if strings.TrimSpace(uc.InstitutionID) != "" {
		req.Header.Set("X-SS-Institution-Id", uc.InstitutionID)
	}
	if len(uc.Roles) > 0 {
		req.Header.Set("X-SS-Roles", strings.Join(uc.Roles, ","))
	}
	if len(uc.Permissions) > 0 {
		req.Header.Set("X-SS-Permissions", strings.Join(uc.Permissions, ","))
	}
	if uc.IsSysAdmin {
		req.Header.Set("X-SS-Is-SysAdmin", "true")
	} else {
		req.Header.Set("X-SS-Is-SysAdmin", "false")
	}
	if cid := middleware.CorrelationIDFromContext(ctx); strings.TrimSpace(cid) != "" {
		req.Header.Set("X-Correlation-Id", cid)
		req.Header.Set("X-SS-Correlation-Id", cid)
	}
	if c.tokenGen != nil {
		tok, _, err := c.tokenGen.IssueServiceToken(ctx, "gateway", c.serviceToken)
		if err == nil && strings.TrimSpace(tok) != "" {
			req.Header.Set("Authorization", "Bearer "+tok)
		}
	}
}

func isIdempotentMethod(m string) bool {
	switch strings.ToUpper(strings.TrimSpace(m)) {
	case http.MethodGet, http.MethodHead, http.MethodPut, http.MethodDelete, http.MethodOptions:
		return true
	default:
		return false
	}
}

func canRetryRequest(req *http.Request) bool {
	if !isIdempotentMethod(req.Method) {
		return false
	}
	if req.Body == nil {
		return true
	}
	return req.GetBody != nil
}

func cloneForAttempt(req *http.Request, ctx context.Context) (*http.Request, error) {
	out := req.Clone(ctx)
	if req.Body != nil && req.GetBody != nil {
		b, err := req.GetBody()
		if err != nil {
			return nil, err
		}
		out.Body = b
	}
	return out, nil
}

type circuitBreaker struct {
	mu sync.Mutex

	failures         int
	firstFailureAt   time.Time
	failureThreshold int
	failureWindow    time.Duration

	openUntil time.Time
	openFor   time.Duration
	halfOpen  bool
}

func newCircuitBreaker(failureThreshold int, failureWindow, openFor time.Duration) *circuitBreaker {
	if failureThreshold <= 0 {
		failureThreshold = 5
	}
	if failureWindow <= 0 {
		failureWindow = 60 * time.Second
	}
	if openFor <= 0 {
		openFor = 30 * time.Second
	}
	return &circuitBreaker{
		failureThreshold: failureThreshold,
		failureWindow:    failureWindow,
		openFor:          openFor,
	}
}

func (b *circuitBreaker) Allow() error {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := time.Now()
	if !b.openUntil.IsZero() && now.Before(b.openUntil) {
		return errors.New("assessment service temporarily unavailable")
	}
	if !b.openUntil.IsZero() && now.After(b.openUntil) && !b.halfOpen {
		b.halfOpen = true
	}
	if b.halfOpen {
		b.halfOpen = false
		b.openUntil = time.Time{}
		return nil
	}
	return nil
}

func (b *circuitBreaker) Success() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.failures = 0
	b.firstFailureAt = time.Time{}
	b.openUntil = time.Time{}
	b.halfOpen = false
}

func (b *circuitBreaker) Failure() {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := time.Now()
	if b.failures == 0 {
		b.firstFailureAt = now
	}
	if !b.firstFailureAt.IsZero() && now.Sub(b.firstFailureAt) > b.failureWindow {
		b.failures = 0
		b.firstFailureAt = now
	}
	b.failures++
	if b.failures >= b.failureThreshold {
		b.openUntil = now.Add(b.openFor)
		b.halfOpen = false
	}
}

func parseBaseURL(raw string) *url.URL {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return nil
	}
	if strings.TrimSpace(u.Scheme) == "" || strings.TrimSpace(u.Host) == "" {
		return nil
	}
	return u
}

func resolveBaseURL(base *url.URL, ref *url.URL) *url.URL {
	u := *base
	p := ref.Path
	if p == "" {
		p = "/"
	}
	u.Path = joinURLPath(u.Path, p)
	u.RawQuery = ref.RawQuery
	u.Fragment = ""
	return &u
}

func joinURLPath(a, b string) string {
	if a == "" {
		a = "/"
	}
	if b == "" {
		b = "/"
	}
	as := strings.HasSuffix(a, "/")
	bs := strings.HasPrefix(b, "/")
	switch {
	case as && bs:
		return a + b[1:]
	case !as && !bs:
		return a + "/" + b
	default:
		return a + b
	}
}
