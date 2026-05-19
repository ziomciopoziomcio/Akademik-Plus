package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"akademik/internal/middleware"
	"akademik/internal/models"
	"akademik/internal/services"
)

type KomentarzeHandler struct {
	svc *services.KomentarzeService
}

func NewKomentarzeHandler(svc *services.KomentarzeService) *KomentarzeHandler {
	return &KomentarzeHandler{svc: svc}
}

func (h *KomentarzeHandler) GetKomentarze(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	usterkaID, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe id usterki")
		return
	}
	komentarze, err := h.svc.GetCzatUsterki(usterkaID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "nie udalo sie pobrac komentarzy")
		return
	}
	writeJSON(w, http.StatusOK, komentarze)
}

func (h *KomentarzeHandler) AddKomentarz(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	usterkaID, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe id usterki")
		return
	}
	userIDval := r.Context().Value(middleware.UserIDKey)
	autorID, ok := userIDval.(int)
	if !ok {
		writeError(w, http.StatusUnauthorized, "brak autoryzacji")
		return
	}
	var input struct {
		Tresc string `json:"tresc"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "nieprawidlowe dane wejsciowe")
		return
	}
	input.Tresc = strings.TrimSpace(input.Tresc)
	if input.Tresc == "" {
		writeError(w, http.StatusBadRequest, "tresc komentarza nie moze byc pusta")
		return
	}
	komentarz := &models.KomentarzUsterki{
		UsterkaID: usterkaID,
		AutorID:   autorID,
		Tresc:     input.Tresc,
	}

	if err := h.svc.CreateKomentarz(komentarz); err != nil {
		writeError(w, http.StatusInternalServerError, "nie udalo sie dodac komentarza")
		return
	}
	writeJSON(w, http.StatusCreated, komentarz)
}
