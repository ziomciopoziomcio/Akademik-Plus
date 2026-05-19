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
	"time"
)

type ZakwaterowaniaHandler struct {
	svc *services.ZakwaterowaniaService
}

func NewZakwaterowaniaHandler(svc *services.ZakwaterowaniaService) *ZakwaterowaniaHandler {
	return &ZakwaterowaniaHandler{svc: svc}
}

func (h *ZakwaterowaniaHandler) GetMojeZakwaterowania(w http.ResponseWriter, r *http.Request) {
	userIDval := r.Context().Value(middleware.UserIDKey)
	if userIDval == nil {
		writeError(w, http.StatusUnauthorized, "brak autoryzacji")
		return
	}

	userID, ok := userIDval.(int)
	if !ok {
		writeError(w, http.StatusInternalServerError, "nieprawidlowy identyfikator uzytkownika")
		return
	}

	zakwaterowanie, err := h.svc.GetCurrentAccommodation(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "brak aktywnego zakwaterowania")
			return
		}
		writeError(w, http.StatusInternalServerError, "nie udalo sie pobrac zakwaterowania")
		return
	}
	writeJSON(w, http.StatusOK, zakwaterowanie)
}

func (h *ZakwaterowaniaHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	zakwaterowania, err := h.svc.GetAll(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "nie udalo sie pobrac zakwaterowan")
		return
	}
	writeJSON(w, http.StatusOK, zakwaterowania)
}

func (h *ZakwaterowaniaHandler) Create(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		MieszkaniecID          int    `json:"mieszkaniec_id"`
		PokojID                int    `json:"pokoj_id"`
		PoczatekZakwaterowania string `json:"poczatek_zakwaterowania"`
		KoniecZakwaterowania   string `json:"koniec_zakwaterowania"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe dane wejsciowe")
		return
	}

	poczatek, err := parseDate(payload.PoczatekZakwaterowania)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowa data poczatku")
		return
	}
	koniec, err := parseDate(payload.KoniecZakwaterowania)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowa data konca")
		return
	}

	zakwaterowanie := &models.Zakwaterowanie{
		MieszkaniecID:          payload.MieszkaniecID,
		PokojID:                payload.PokojID,
		PoczatekZakwaterowania: poczatek,
		KoniecZakwaterowania:   koniec,
	}

	if err := h.svc.Create(r.Context(), zakwaterowanie); err != nil {
		if err.Error() == "invalid ids" || err.Error() == "invalid dates" {
			writeError(w, http.StatusBadRequest, "nieprawidlowe dane zakwaterowania")
			return
		}
		writeError(w, http.StatusInternalServerError, "nie udalo sie utworzyc zakwaterowania")
		return
	}
	writeJSON(w, http.StatusCreated, zakwaterowanie)
}

func (h *ZakwaterowaniaHandler) Checkout(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe id zakwaterowania")
		return
	}

	var payload struct {
		KoniecZakwaterowania string `json:"koniec_zakwaterowania"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe dane wejsciowe")
		return
	}

	if err := h.svc.Checkout(r.Context(), id, payload.KoniecZakwaterowania); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			writeError(w, http.StatusNotFound, "zakwaterowanie nie istnieje")
			return
		}
		if err.Error() == "invalid checkout date" {
			writeError(w, http.StatusBadRequest, "nieprawidlowa data wymeldowania")
			return
		}
		writeError(w, http.StatusInternalServerError, "nie udalo sie zaktualizowac zakwaterowania")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "wymeldowanie zapisane"})
}

func parseDate(value string) (time.Time, error) {
	return time.Parse("2006-01-02", value)
}
