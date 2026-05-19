package middleware

import (
	"net/http"
	"os"
	"strings"
)

func isAllowedOrigin(origin string) bool {
	if origin == "" {
		return false
	}

	normalizedOrigin := strings.TrimSuffix(strings.TrimSpace(origin), "/")
	originsEnv := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if originsEnv == "" {
		originsEnv = "http://localhost:5173,http://127.0.0.1:5173"
	}

	allowedOrigins := strings.Split(originsEnv, ",")
	for _, allowedOrigin := range allowedOrigins {
		if strings.TrimSuffix(strings.TrimSpace(allowedOrigin), "/") == normalizedOrigin {
			return true
		}
	}

	return false
}

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Vary", "Origin")
			if isAllowedOrigin(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
