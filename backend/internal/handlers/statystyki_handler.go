package handlers

import (
	"akademik/internal/services"
	"net/http"
)

type StatystykiHandler struct {
	svc *services.StatystykiService
}

func NewStatystykiHandler(svc *services.StatystykiService) *StatystykiHandler {
	return &StatystykiHandler{svc: svc}
}

func (h *StatystykiHandler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.svc.GetStats()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "nie udalo sie pobrac statystyk")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}
