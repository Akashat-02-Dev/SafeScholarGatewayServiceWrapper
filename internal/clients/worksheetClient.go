package clients

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"safescholar/gateway/internal/auth"
	"safescholar/gateway/internal/middleware"
	"safescholar/gateway/internal/security"
)

type WorksheetClient struct {
	baseURL      *url.URL
	client       *http.Client
	tokenGen     *auth.TokenGenerator
	limiter      *security.TokenBucketLimiter
	serviceToken time.Duration
}

func NewWorksheetClient(baseURL string, client *http.Client) *WorksheetClient {
	u := parseBaseURL(baseURL)
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	return &WorksheetClient{
		baseURL:      u,
		client:       client,
		serviceToken: 2 * time.Minute,
	}
}

func NewWorksheetClientWithDeps(baseURL string, client *http.Client, tokenGen *auth.TokenGenerator, limiter *security.TokenBucketLimiter) *WorksheetClient {
	c := NewWorksheetClient(baseURL, client)
	c.tokenGen = tokenGen
	c.limiter = limiter
	return c
}

func (c *WorksheetClient) CreateWorksheet(ctx context.Context, jsonBody []byte) (*http.Response, error) {
	if err := c.rateLimit(ctx, "create"); err != nil {
		return nil, err
	}
	if len(jsonBody) == 0 {
		return nil, errors.New("body required")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "/worksheets", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.Do(ctx, req)
}

func (c *WorksheetClient) FetchWorksheet(ctx context.Context, worksheetID string) (*http.Response, error) {
	if err := c.rateLimit(ctx, "fetch"); err != nil {
		return nil, err
	}
	id := strings.TrimSpace(worksheetID)
	if id == "" {
		return nil, errors.New("worksheetId required")
	}
	if len(id) > 128 {
		return nil, errors.New("worksheetId too long")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "/worksheets/"+url.PathEscape(id), nil)
	if err != nil {
		return nil, err
	}
	return c.Do(ctx, req)
}

func (c *WorksheetClient) UpdateWorksheet(ctx context.Context, worksheetID string, jsonBody []byte) (*http.Response, error) {
	if err := c.rateLimit(ctx, "update"); err != nil {
		return nil, err
	}
	id := strings.TrimSpace(worksheetID)
	if id == "" {
		return nil, errors.New("worksheetId required")
	}
	if len(id) > 128 {
		return nil, errors.New("worksheetId too long")
	}
	if len(jsonBody) == 0 {
		return nil, errors.New("body required")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, "/worksheets/"+url.PathEscape(id), bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.Do(ctx, req)
}

func (c *WorksheetClient) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	if c.client == nil {
		return nil, errors.New("http client not configured")
	}
	if c.baseURL == nil || c.baseURL.Scheme == "" || c.baseURL.Host == "" {
		return nil, errors.New("invalid worksheet base url")
	}
	if req == nil {
		return nil, errors.New("request required")
	}
	if req.URL == nil {
		return nil, errors.New("request url required")
	}

	out := req.Clone(ctx)
	out.URL = resolveBaseURL(c.baseURL, req.URL)
	out.Host = out.URL.Host
	c.enrichHeaders(ctx, out)
	return c.client.Do(out)
}

func (c *WorksheetClient) enrichHeaders(ctx context.Context, req *http.Request) {
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

func (c *WorksheetClient) rateLimit(ctx context.Context, operation string) error {
	if c.limiter == nil {
		return nil
	}
	op := strings.ToLower(strings.TrimSpace(operation))
	if op == "" {
		op = "op"
	}
	uc := middleware.UserContextFromContext(ctx)
	key := "worksheet:" + op + ":"
	if uc.IsAuthenticated && strings.TrimSpace(uc.UserID) != "" {
		key += "user:" + uc.UserID
	} else {
		key += "anon"
	}
	res, err := c.limiter.Allow(ctx, key)
	if err != nil {
		return errors.New("worksheet rate limit unavailable")
	}
	if !res.Allowed {
		return errors.New("worksheet rate limit exceeded")
	}
	return nil
}
