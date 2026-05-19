package handlers

import (
	"encoding/json"
	"net/http"

	"akademik/internal/services"

	"github.com/golang-jwt/jwt/v5"
)

type AuthHandler struct {
	service *services.AuthService
}

func NewAuthHandler(service *services.AuthService) *AuthHandler {
	return &AuthHandler{service: service}
}

func extractRoleFromToken(tokenString string) string {
	token, _, err := new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		return ""
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return ""
	}

	if rola, ok := claims["rola"].(string); ok {
		return rola
	}
	if role, ok := claims["role"].(string); ok {
		return role
	}
	return ""
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe dane logowania")
		return
	}

	token, err := h.service.Login(payload.Email, payload.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "nieprawidlowy email lub haslo")
		return
	}

	response := map[string]string{"token": token}
	if role := extractRoleFromToken(token); role != "" {
		response["rola"] = role
	}

	writeJSON(w, http.StatusOK, response)
}
