package repository

import (
	"akademik/internal/models"

	"github.com/jmoiron/sqlx"
)

type StatystykiRepo struct {
	db *sqlx.DB
}

func NewStatystykiRepo(db *sqlx.DB) *StatystykiRepo {
	return &StatystykiRepo{db: db}
}

func (r *StatystykiRepo) GetDashboardStats() (*models.AdminStats, error) {
	var stats models.AdminStats

	err := r.db.Get(&stats.NieoplaconeRachunki, `SELECT COUNT(*) FROM rachunki WHERE czy_oplacone = false`)
	if err != nil {
		return nil, err
	}

	err = r.db.Get(&stats.OtwarteUsterki, `SELECT COUNT(*) FROM usterki WHERE status NOT IN ('Naprawiono', 'Zakonczono_bez_naprawy')`)
	if err != nil {
		return nil, err
	}

	err = r.db.Get(&stats.WszystkiePokoje, `SELECT COUNT(*) FROM pokoj`)
	if err != nil {
		return nil, err
	}

	err = r.db.Get(&stats.ZajetePokoje, `SELECT COUNT(DISTINCT pokoj_id) FROM zakwaterowania WHERE koniec_zakwaterowania >= CURRENT_DATE`)
	if err != nil {
		return nil, err
	}

	return &stats, nil
}
