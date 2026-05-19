package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"akademik/internal/models"
	"akademik/internal/services"
)

type PokojeHandler struct {
	svc services.PokojeService
}

func NewPokojeHandler(svc services.PokojeService) *PokojeHandler {
	return &PokojeHandler{svc: svc}
}

func (h *PokojeHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	pokoje, err := h.svc.GetAll(r.Context())
	if err != nil {
		http.Error(w, "Failed to fetch pokoje", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(pokoje); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

func (h *PokojeHandler) Create(w http.ResponseWriter, r *http.Request) {
	var p models.Pokoj
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(p.NumerPokoju) == "" {
		http.Error(w, "numer_pokoju is required", http.StatusBadRequest)
		return
	}
	if p.IleOsob <= 0 {
		http.Error(w, "ile_osob must be > 0", http.StatusBadRequest)
		return
	}
	if p.AkademikID <= 0 {
		http.Error(w, "akademik_id is required", http.StatusBadRequest)
		return
	}

	id, err := h.svc.Create(r.Context(), &p)
	if err != nil {
		http.Error(w, "Failed to create pokoj", http.StatusInternalServerError)
		return
	}
	p.ID = id

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(p); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

func (h *PokojeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid pokoj ID", http.StatusBadRequest)
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			http.Error(w, "Pokój not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to delete pokoj", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]string{"message": "Pokój usunięty"}); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

func (h *PokojeHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe id pokoju")
		return
	}

	var payload struct {
		Status string `json:"status_pokoju"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe dane wejsciowe")
		return
	}

	status := models.StatusPokoju(strings.TrimSpace(payload.Status))
	if err := h.svc.UpdateStatus(r.Context(), id, status); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			writeError(w, http.StatusNotFound, "pokoj nie istnieje")
			return
		}
		if err.Error() == "invalid room status" {
			writeError(w, http.StatusBadRequest, "nieprawidlowy status pokoju")
			return
		}
		writeError(w, http.StatusInternalServerError, "nie udalo sie zaktualizowac statusu pokoju")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "status pokoju zaktualizowany"})
}
