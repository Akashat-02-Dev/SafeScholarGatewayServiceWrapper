package gateway

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"safescholar/gateway/internal/middleware"
)

type ServiceProxy struct {
	client  *http.Client
	timeout time.Duration
}

func NewServiceProxy(client *http.Client) *ServiceProxy {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	return &ServiceProxy{client: client, timeout: 15 * time.Second}
}

func (p *ServiceProxy) Forward(w http.ResponseWriter, req *http.Request, baseURL string, stripPrefix string) error {
	if p == nil || p.client == nil {
		return errors.New("service proxy not configured")
	}
	u, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || u.Host == "" {
		return errors.New("invalid base url")
	}
	if proxyRequiresHTTPS(p.client.Transport) && u.Scheme != "https" {
		return errors.New("invalid base url scheme")
	}

	proxy := httputil.NewSingleHostReverseProxy(u)
	if p.client.Transport != nil {
		proxy.Transport = p.client.Transport
	}
	proxy.ErrorHandler = func(rw http.ResponseWriter, r *http.Request, e error) {
		rw.WriteHeader(http.StatusBadGateway)
	}
	proxy.ModifyResponse = func(resp *http.Response) error {
		removeHopByHopHeaders(resp.Header)
		return nil
	}

	strip := strings.TrimRight(strings.TrimSpace(stripPrefix), "/")
	proxy.Director = func(r *http.Request) {
		origHost := r.Host
		r.URL.Scheme = u.Scheme
		r.URL.Host = u.Host
		r.Host = u.Host

		path := r.URL.Path
		if strip != "" && strings.HasPrefix(path, strip) {
			path = strings.TrimPrefix(path, strip)
			if path == "" {
				path = "/"
			}
		}
		if !strings.HasPrefix(path, "/") {
			path = "/" + path
		}
		r.URL.Path = singleJoiningSlash(u.Path, path)

		removeHopByHopHeaders(r.Header)
		r.Header.Del("Authorization")
		r.Header.Del("Cookie")
		r.Header.Del("X-User-Id")
		r.Header.Del("X-Institution-Id")
		r.Header.Del("X-Session-Id")
		r.Header.Del("X-Token-Id")
		r.Header.Del("X-Roles")
		r.Header.Del("X-Permissions")
		r.Header.Del("X-Authenticated")

		cid := middleware.CorrelationIDFromContext(r.Context())
		if cid != "" {
			r.Header.Set("X-Request-Id", cid)
		}

		uc := middleware.UserContextFromContext(r.Context())
		if uc.IsAuthenticated {
			r.Header.Set("X-User-Id", uc.UserID)
			r.Header.Set("X-Institution-Id", uc.InstitutionID)
			r.Header.Set("X-Session-Id", uc.SessionID)
			r.Header.Set("X-Token-Id", uc.TokenID)
			if len(uc.Roles) > 0 {
				r.Header.Set("X-Roles", strings.Join(uc.Roles, ","))
			}
			if len(uc.Permissions) > 0 {
				r.Header.Set("X-Permissions", strings.Join(uc.Permissions, ","))
			}
			r.Header.Set("X-Authenticated", "true")
		} else {
			r.Header.Set("X-Authenticated", "false")
		}
		r.Header.Set("X-Gateway", "safescholar-gateway")

		addForwardedHeaders(r, origHost)
	}

	ctx := req.Context()
	if _, ok := ctx.Deadline(); !ok && p.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, p.timeout)
		defer cancel()
	}
	proxy.ServeHTTP(w, req.WithContext(ctx))
	return nil
}

func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	default:
		return a + b
	}
}

func addForwardedHeaders(r *http.Request, origHost string) {
	ip := middleware.ClientIP(r)
	if ip != nil {
		prior := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
		if prior == "" {
			r.Header.Set("X-Forwarded-For", ip.String())
		} else {
			r.Header.Set("X-Forwarded-For", prior+", "+ip.String())
		}
	}

	if strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")) == "" {
		if r.TLS != nil {
			r.Header.Set("X-Forwarded-Proto", "https")
		} else {
			r.Header.Set("X-Forwarded-Proto", "http")
		}
	}
	if strings.TrimSpace(origHost) != "" {
		r.Header.Set("X-Forwarded-Host", origHost)
	}

	if ip != nil {
		if ip4 := ip.To4(); ip4 != nil {
			r.Header.Set("X-Real-Ip", ip4.String())
		} else {
			r.Header.Set("X-Real-Ip", ip.String())
		}
	} else {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err == nil {
			r.Header.Set("X-Real-Ip", host)
		}
	}
}

func proxyRequiresHTTPS(rt http.RoundTripper) bool {
	tr, ok := rt.(*http.Transport)
	if !ok || tr == nil || tr.TLSClientConfig == nil {
		return false
	}
	return len(tr.TLSClientConfig.Certificates) > 0
}

func removeHopByHopHeaders(h http.Header) {
	for _, v := range h.Values("Connection") {
		for _, f := range strings.Split(v, ",") {
			if name := strings.TrimSpace(f); name != "" {
				h.Del(name)
			}
		}
	}
	h.Del("Connection")
	h.Del("Proxy-Connection")
	h.Del("Keep-Alive")
	h.Del("Proxy-Authenticate")
	h.Del("Proxy-Authorization")
	h.Del("Te")
	h.Del("Trailer")
	h.Del("Transfer-Encoding")
	h.Del("Upgrade")
}
