package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"akademik/internal/models"
	"akademik/internal/services"
)

type UzytkownicyHandler struct {
	service *services.UzytkownicyService
}

func NewUzytkownicyHandler(service *services.UzytkownicyService) *UzytkownicyHandler {
	return &UzytkownicyHandler{service: service}
}

func (h *UzytkownicyHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Incorrect user ID", http.StatusBadRequest)
		return
	}

	uzytkownik, err := h.service.GetByID(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Error during user retrieval", http.StatusInternalServerError)
		return
	}

	response, err := json.Marshal(uzytkownik)
	if err != nil {
		http.Error(w, "Error during response serialization", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(response); err != nil {
		http.Error(w, "Error during response write", http.StatusInternalServerError)
		return
	}
}

func (h *UzytkownicyHandler) Create(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		models.Uzytkownik
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	nowy := &payload.Uzytkownik

	err := h.service.CreateUser(nowy, payload.Password)

	if err != nil {
		switch err.Error() {
		case "invalid email":
			http.Error(w, "Invalid email format", http.StatusBadRequest)
			return
		case "email already in use":
			http.Error(w, "Email already in use", http.StatusConflict)
			return
		case "password must be at least 6 characters long":
			http.Error(w, "Password must be at least 6 characters long", http.StatusBadRequest)
		default:
			http.Error(w, "Error during user creation", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(nowy)
}

func (h *UzytkownicyHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	uzytkownicy, err := h.service.GetAll(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "nie udalo sie pobrac uzytkownikow")
		return
	}
	writeJSON(w, http.StatusOK, uzytkownicy)
}

func (h *UzytkownicyHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe id uzytkownika")
		return
	}

	var payload struct {
		Rola string `json:"rola"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe dane wejsciowe")
		return
	}

	rola := models.Rola(strings.TrimSpace(payload.Rola))
	if err := h.service.UpdateRole(r.Context(), id, rola); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "uzytkownik nie istnieje")
			return
		}
		if err.Error() == "invalid role" {
			writeError(w, http.StatusBadRequest, "nieprawidlowa rola")
			return
		}
		writeError(w, http.StatusInternalServerError, "nie udalo sie zaktualizowac roli")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "rola zaktualizowana"})
}
