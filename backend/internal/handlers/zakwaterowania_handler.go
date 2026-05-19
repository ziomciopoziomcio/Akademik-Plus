package handlers

import (
	"akademik/internal/middleware"
	"akademik/internal/services"
	"database/sql"
	"errors"
	"net/http"
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
