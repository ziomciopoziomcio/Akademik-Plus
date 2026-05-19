package handlers

import (
	"akademik/internal/middleware"
	"akademik/internal/models"
	"akademik/internal/services"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

type UsterkiHandler struct {
	service *services.UsterkiService
}

func NewUsterkiHandler(service *services.UsterkiService) *UsterkiHandler {
	return &UsterkiHandler{service: service}
}

func (h *UsterkiHandler) GetByPokoj(w http.ResponseWriter, r *http.Request) {
	pokojIDStr := r.PathValue("id")
	pokojID, err := strconv.Atoi(pokojIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe id pokoju")
		return
	}

	usterki, err := h.service.GetByPokojID(pokojID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "nie udalo sie pobrac usterek")
		return
	}
	writeJSON(w, http.StatusOK, usterki)
}

func (h *UsterkiHandler) Create(w http.ResponseWriter, r *http.Request) {
	var nowaUsterka models.Usterka

	err := json.NewDecoder(r.Body).Decode(&nowaUsterka)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe dane wejsciowe")
		return
	}

	userIDRaw := r.Context().Value(middleware.UserIDKey)
	userID, ok := userIDRaw.(int)
	if !ok || userID <= 0 {
		writeError(w, http.StatusUnauthorized, "brak autoryzacji")
		return
	}
	nowaUsterka.ZglaszajacyID = userID

	if nowaUsterka.ZglaszajacyID <= 0 {
		writeError(w, http.StatusBadRequest, "zglaszajacy_id musi byc dodatni")
		return
	}

	if nowaUsterka.PokojID <= 0 {
		writeError(w, http.StatusBadRequest, "pokoj_id musi byc dodatni")
		return
	}

	if strings.TrimSpace(nowaUsterka.OpisUsterki) == "" {
		writeError(w, http.StatusBadRequest, "opis_usterki nie moze byc pusty")
		return
	}
	if nowaUsterka.Priorytet == nil || strings.TrimSpace(string(*nowaUsterka.Priorytet)) == "" {
		writeError(w, http.StatusBadRequest, "priorytet jest wymagany")
		return
	}

	err = h.service.CreateUsterka(&nowaUsterka)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nie udalo sie utworzyc usterki")
		return
	}

	writeJSON(w, http.StatusCreated, nowaUsterka)
}

func (h *UsterkiHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe id usterki")
		return
	}

	var requestBody struct {
		Status string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe dane wejsciowe")
		return
	}

	nowyStatus := models.StatusNaprawy(requestBody.Status)

	if !nowyStatus.IsValid() {
		writeError(w, http.StatusBadRequest, "nieprawidlowy status usterki")
		return
	}

	err = h.service.UpdateStatus(id, nowyStatus)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "usterka nie istnieje")
			return
		}
		writeError(w, http.StatusInternalServerError, "nie udalo sie zaktualizowac statusu usterki")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "status usterki zaktualizowany"})
}

func (h *UsterkiHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	usterki, err := h.service.GetAll()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "nie udalo sie pobrac usterek")
		return
	}
	writeJSON(w, http.StatusOK, usterki)
}

func (h *UsterkiHandler) GetMoje(w http.ResponseWriter, r *http.Request) {
	userIDRaw := r.Context().Value(middleware.UserIDKey)
	userID, ok := userIDRaw.(int)
	if !ok || userID <= 0 {
		writeError(w, http.StatusUnauthorized, "brak autoryzacji")
		return
	}

	usterki, err := h.service.GetByReporterID(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "nie udalo sie pobrac usterek")
		return
	}
	writeJSON(w, http.StatusOK, usterki)
}
