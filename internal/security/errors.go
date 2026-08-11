package security

import (
	"encoding/json"
	"net/http"
)

// WriteJSONError standardizes the format of error responses across the Gateway to prevent plain-text leakage
func WriteJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
