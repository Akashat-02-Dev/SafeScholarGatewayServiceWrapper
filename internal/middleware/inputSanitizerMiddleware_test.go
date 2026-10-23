package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInputSanitizerMiddleware(t *testing.T) {
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	sanitizer := InputSanitizerMiddleware(nil)(nextHandler)

	tests := []struct {
		name           string
		method         string
		url            string
		body           string
		expectedStatus int
	}{
		{
			name:           "Valid request passes through",
			method:         http.MethodPost,
			url:            "/api/auth/login",
			body:           `{"email":"teacher@school.edu","password":"SafePassword123!"}`,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "SQL Injection in URL query blocked",
			method:         http.MethodGet,
			url:            "/api/users?search=1'%20UNION%20SELECT%20password_hash%20FROM%20users--",
			body:           "",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "SQL command DROP TABLE in body blocked",
			method:         http.MethodPost,
			url:            "/api/worksheet/save",
			body:           `{"title":"Math Test", "notes":"'; DROP TABLE users;--"}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "SQL Boolean injection in query blocked",
			method:         http.MethodGet,
			url:            "/api/v1/admin/users?filter='%20OR%201=1--",
			body:           "",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "XSS script tag in body blocked",
			method:         http.MethodPost,
			url:            "/api/feedback",
			body:           `{"comment":"<script>alert('xss')</script>"}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Path traversal in query blocked",
			method:         http.MethodGet,
			url:            "/api/files?path=../../etc/passwd",
			body:           "",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Command injection in body blocked",
			method:         http.MethodPost,
			url:            "/api/tools/run",
			body:           `{"param":"test; cat /etc/passwd"}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Null byte in path blocked",
			method:         http.MethodGet,
			url:            "/api/files/test.pdf%00.exe",
			body:           "",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "XXE entity injection blocked",
			method:         http.MethodPost,
			url:            "/api/xml/import",
			body:           `<!ENTITY xxe SYSTEM "file:///etc/passwd">`,
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var bodyReader *bytes.Reader
			if tt.body != "" {
				bodyReader = bytes.NewReader([]byte(tt.body))
			} else {
				bodyReader = bytes.NewReader(nil)
			}

			req := httptest.NewRequest(tt.method, tt.url, bodyReader)
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()

			sanitizer.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d. Body: %s", tt.expectedStatus, rec.Code, rec.Body.String())
			}
		})
	}
}
