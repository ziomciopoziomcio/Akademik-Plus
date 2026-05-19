package handlers

import (
	"akademik/internal/middleware"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"akademik/internal/services"
)

type RachunkiHandler struct {
	svc services.RachunkiService
}

func NewRachunkiHandler(svc services.RachunkiService) *RachunkiHandler {
	return &RachunkiHandler{svc: svc}
}

func (h *RachunkiHandler) GetByUzytkownikID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe id uzytkownika")
		return
	}
	h.respondWithRachunki(w, r, id)
}

func (h *RachunkiHandler) GetMojeRachunki(w http.ResponseWriter, r *http.Request) {
	userIDval := r.Context().Value(middleware.UserIDKey)

	if userIDval == nil {
		writeError(w, http.StatusUnauthorized, "brak autoryzacji")
		return
	}

	var userID int
	switch v := userIDval.(type) {
	case float64:
		userID = int(v)
	case int:
		userID = v
	default:
		writeError(w, http.StatusBadRequest, "nieprawidlowe id uzytkownika")
		return
	}
	h.respondWithRachunki(w, r, userID)
}

func (h *RachunkiHandler) MarkAsPaid(w http.ResponseWriter, r *http.Request) {
	numer := r.PathValue("numer")
	if numer == "" {
		writeError(w, http.StatusBadRequest, "brak numeru rachunku")
		return
	}

	var payload struct {
		CzyOplacone *bool `json:"czy_oplacone"`
	}
	_ = json.NewDecoder(r.Body).Decode(&payload)

	status, err := h.resolvePaidStatus(r, payload.CzyOplacone)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.svc.UpdatePaidStatus(r.Context(), numer, status); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			writeError(w, http.StatusNotFound, "rachunek nie istnieje")
			return
		}
		writeError(w, http.StatusInternalServerError, "nie udalo sie zaktualizowac statusu rachunku")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":      "status rachunku zaktualizowany",
		"czy_oplacone": status,
	})
}

func (h *RachunkiHandler) respondWithRachunki(w http.ResponseWriter, r *http.Request, userID int) {
	rachunki, err := h.svc.GetByUzytkownikID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "nie udalo sie pobrac rachunkow")
		return
	}
	writeJSON(w, http.StatusOK, rachunki)
}

func (h *RachunkiHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	rachunki, err := h.svc.GetAll(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "nie udalo sie pobrac rachunkow")
		return
	}
	writeJSON(w, http.StatusOK, rachunki)
}

func (h *RachunkiHandler) resolvePaidStatus(r *http.Request, fromBody *bool) (bool, error) {
	if fromBody != nil {
		return *fromBody, nil
	}

	query := r.URL.Query().Get("czy_oplacone")
	if query == "" {
		return true, nil
	}
	if query == "true" {
		return true, nil
	}
	if query == "false" {
		return false, nil
	}
	return false, errors.New("nieprawidlowa wartosc czy_oplacone")
}
