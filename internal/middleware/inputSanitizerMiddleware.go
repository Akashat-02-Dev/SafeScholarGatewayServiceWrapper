package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"safescholar/gateway/internal/security"
)

var (
	// SQL Injection & Prohibited Database Command Patterns
	sqlInjectionPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\b(union\s+(all\s+)?select)\b`),
		regexp.MustCompile(`(?i)\b(drop|truncate|alter)\s+(table|database|schema|view|index)\b`),
		regexp.MustCompile(`(?i)\b(insert\s+into\s+[a-zA-Z0-9_.]+\s*(values|\())`),
		regexp.MustCompile(`(?i)\b(delete\s+from\s+[a-zA-Z0-9_.]+)`),
		regexp.MustCompile(`(?i)\b(update\s+[a-zA-Z0-9_.]+\s+set\s+[a-zA-Z0-9_.]+\s*=)`),
		regexp.MustCompile(`(?i)\b(exec|execute)\s*(\(|xp_|sp_)`),
		regexp.MustCompile(`(?i);\s*(drop|delete|insert|update|create|truncate|alter)\b`),
		regexp.MustCompile(`(?i)\b(waitfor\s+delay|pg_sleep\s*\()\b`),
		regexp.MustCompile(`(?i)('\s*(or|and)\s*('|[0-9]+=[0-9]+|[a-z]+=[a-z]+))`),
		regexp.MustCompile(`(?i)\b(information_schema\.tables|pg_catalog\.)\b`),
	}

	// Cross-Site Scripting (XSS) Patterns
	xssPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)<\s*script\b`),
		regexp.MustCompile(`(?i)javascript\s*:`),
		regexp.MustCompile(`(?i)\bon(error|load|click|mouseover|focus|blur|change|submit)\s*=`),
		regexp.MustCompile(`(?i)<\s*(iframe|embed|object)\b`),
	}

	// Command Injection & Remote Code Execution Patterns
	cmdInjectionPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(\||;|&&|\$\(|\` + "`" + `)\s*(cat\s+/etc/passwd|nc\s+-|bash\s+-i|sh\s+-i|curl\s+http|wget\s+http)`),
	}

	// Path / Directory Traversal & LFI / RFI Patterns
	pathTraversalPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(\.\.[/\\]|%2e%2e[%2f%5c/])`),
		regexp.MustCompile(`(?i)(/etc/passwd|/etc/shadow|c:\\windows\\system32)`),
	}

	// XML External Entity (XXE) Injection Patterns
	xxePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)<!ENTITY\b`),
		regexp.MustCompile(`(?i)SYSTEM\s+["'](file|http|https|ftp)://`),
	}
)

// InputSanitizerMiddleware validates and sanitizes incoming HTTP requests against
// SQL commands entry, XSS, Command Injection, Path Traversal, and XXE patterns.
func InputSanitizerMiddleware(auditLogger *security.AuditLogger) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip health checks
			if r.URL.Path == "/healthz" || r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			// 1. Validate UTF-8 integrity of URL path and query string
			if !utf8.ValidString(r.URL.Path) || !utf8.ValidString(r.URL.RawQuery) {
				rejectSecurityViolation(w, r, auditLogger, "invalid_utf8_encoding", "Malformed UTF-8 encoding in URL")
				return
			}

			// 2. Reject Null Byte Injection
			if strings.Contains(r.URL.Path, "\x00") || strings.Contains(r.URL.RawQuery, "\x00") {
				rejectSecurityViolation(w, r, auditLogger, "null_byte_injection", "Null byte character in request target")
				return
			}

			// 3. Inspect URL Path and Decoded Path
			decodedPath, err := url.PathUnescape(r.URL.Path)
			if err != nil {
				decodedPath = r.URL.Path
			}
			if matched, reason := checkPayloadPatterns(decodedPath); matched {
				rejectSecurityViolation(w, r, auditLogger, reason, "Prohibited injection command in URL path: "+reason)
				return
			}

			// 4. Inspect Query String and Raw Query
			if r.URL.RawQuery != "" {
				decodedQuery, err := url.QueryUnescape(r.URL.RawQuery)
				if err != nil {
					decodedQuery = r.URL.RawQuery
				}
				if matched, reason := checkPayloadPatterns(decodedQuery); matched {
					rejectSecurityViolation(w, r, auditLogger, reason, "Prohibited SQL command or injection pattern in query string")
					return
				}
			}

			// 5. Inspect Request Body for mutating HTTP methods (POST, PUT, PATCH)
			if r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch {
				if r.Body != nil {
					// Read up to 512 KB for security pattern analysis
					const maxInspectBytes = 512 * 1024
					bodyBytes, err := io.ReadAll(io.LimitReader(r.Body, maxInspectBytes))
					if err == nil && len(bodyBytes) > 0 {
						// Restore r.Body so downstream handlers and reverse proxies can read it
						r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

						if !utf8.Valid(bodyBytes) {
							rejectSecurityViolation(w, r, auditLogger, "invalid_utf8_body", "Malformed UTF-8 encoding in request body")
							return
						}
						if bytes.Contains(bodyBytes, []byte("\x00")) {
							rejectSecurityViolation(w, r, auditLogger, "null_byte_body", "Null byte in request body")
							return
						}

						bodyStr := string(bodyBytes)
						if matched, reason := checkPayloadPatterns(bodyStr); matched {
							rejectSecurityViolation(w, r, auditLogger, reason, "Prohibited SQL command or injection pattern in request body")
							return
						}
					}
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

func checkPayloadPatterns(input string) (bool, string) {
	for _, p := range sqlInjectionPatterns {
		if p.MatchString(input) {
			return true, "sql_injection_attempt"
		}
	}
	for _, p := range pathTraversalPatterns {
		if p.MatchString(input) {
			return true, "path_traversal_attempt"
		}
	}
	for _, p := range xssPatterns {
		if p.MatchString(input) {
			return true, "xss_injection_attempt"
		}
	}
	for _, p := range cmdInjectionPatterns {
		if p.MatchString(input) {
			return true, "command_injection_attempt"
		}
	}
	for _, p := range xxePatterns {
		if p.MatchString(input) {
			return true, "xxe_injection_attempt"
		}
	}
	return false, ""
}

func rejectSecurityViolation(w http.ResponseWriter, r *http.Request, auditLogger *security.AuditLogger, reason, message string) {
	if auditLogger != nil {
		uc := UserContextFromContext(r.Context())
		ip := ClientIP(r)
		ipStr := ""
		if ip != nil {
			ipStr = ip.String()
		}
		_ = auditLogger.Log(r.Context(), security.AuditEvent{
			UserID:     uc.UserID,
			Action:     "SECURITY_INJECTION_BLOCKED",
			Resource:   "HTTP_REQUEST",
			ResourceID: r.URL.Path,
			IPAddress:  ipStr,
			Metadata: map[string]any{
				"reason":         reason,
				"method":         r.Method,
				"path":           r.URL.Path,
				"institution_id": uc.InstitutionID,
				"user_agent":     r.UserAgent(),
				"correlation_id": CorrelationIDFromContext(r.Context()),
			},
			CreatedAt: time.Now().UTC(),
		})
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusBadRequest)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error":   "Request rejected: prohibited injection command pattern detected",
		"code":    "SECURITY_VIOLATION",
		"details": reason,
	})
}
