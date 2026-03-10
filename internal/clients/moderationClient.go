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
	"safescholar/gateway/internal/contracts"
	"safescholar/gateway/internal/middleware"
	"safescholar/gateway/internal/security"
)

type ModerationClient struct {
	baseURL      *url.URL
	client       *http.Client
	tokenGen     *auth.TokenGenerator
	serviceToken time.Duration
	auditLogger  *security.AuditLogger
}

func NewModerationClient(baseURL string, client *http.Client) *ModerationClient {
	u := parseBaseURL(baseURL)
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	return &ModerationClient{
		baseURL:      u,
		client:       client,
		serviceToken: 2 * time.Minute,
	}
}

func NewModerationClientWithDeps(baseURL string, client *http.Client, tokenGen *auth.TokenGenerator, auditLogger *security.AuditLogger) *ModerationClient {
	c := NewModerationClient(baseURL, client)
	c.tokenGen = tokenGen
	c.auditLogger = auditLogger
	return c
}

func (c *ModerationClient) PerformAction(ctx context.Context, req contracts.ModerationActionRequest) (*http.Response, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}
	uc := middleware.UserContextFromContext(ctx)
	if !hasPermission(uc.Permissions, "MODERATE_CONTENT") && !uc.IsSysAdmin {
		return nil, errors.New("forbidden")
	}
	body := []byte(`{"contentId":"` + escapeJSON(req.ContentID) + `","action":"` + escapeJSON(req.Action) + `"}`)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "/moderation/actions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := c.Do(ctx, httpReq)
	c.auditModeration(ctx, req, resp, err)
	return resp, err
}

func (c *ModerationClient) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	if c.client == nil {
		return nil, errors.New("http client not configured")
	}
	if c.baseURL == nil || c.baseURL.Scheme == "" || c.baseURL.Host == "" {
		return nil, errors.New("invalid moderation base url")
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

func (c *ModerationClient) enrichHeaders(ctx context.Context, req *http.Request) {
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

func (c *ModerationClient) auditModeration(ctx context.Context, req contracts.ModerationActionRequest, resp *http.Response, callErr error) {
	if c.auditLogger == nil {
		return
	}
	uc := middleware.UserContextFromContext(ctx)
	action := "MODERATION_ACTION"
	status := 0
	if resp != nil {
		status = resp.StatusCode
	}
	meta := map[string]any{
		"action": req.Action,
		"status": status,
	}
	if callErr != nil {
		meta["error"] = callErr.Error()
	}
	_ = c.auditLogger.Log(ctx, security.AuditEvent{
		UserID:     uc.UserID,
		Action:     action,
		Resource:   "content",
		ResourceID: req.ContentID,
		CreatedAt:  time.Now().UTC(),
		Metadata:   withCorrelation(meta, middleware.CorrelationIDFromContext(ctx)),
	})
}

func withCorrelation(meta map[string]any, correlationID string) map[string]any {
	cid := strings.TrimSpace(correlationID)
	if cid == "" {
		return meta
	}
	if meta == nil {
		meta = map[string]any{}
	}
	meta["correlationId"] = cid
	return meta
}

func hasPermission(perms []string, required string) bool {
	req := strings.ToUpper(strings.TrimSpace(required))
	if req == "" {
		return true
	}
	for _, p := range perms {
		if strings.ToUpper(strings.TrimSpace(p)) == req {
			return true
		}
	}
	return false
}

func escapeJSON(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\r", "\\r")
	s = strings.ReplaceAll(s, "\t", "\\t")
	return s
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
