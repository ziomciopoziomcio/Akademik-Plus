package repository

import (
	"context"

	"akademik/internal/models"

	"github.com/jmoiron/sqlx"
)

type RachunkiRepo struct {
	db *sqlx.DB
}

func NewRachunkiRepo(db *sqlx.DB) *RachunkiRepo {
	return &RachunkiRepo{db: db}
}

func (r *RachunkiRepo) GetByUzytkownikID(ctx context.Context, uzytkownikID int) ([]models.Rachunek, error) {
	rachunki := []models.Rachunek{}
	query := `
        SELECT r.* FROM rachunki r
        JOIN zakwaterowania z ON r.zakwaterowanie_id = z.id
        WHERE z.mieszkaniec_id = $1
    `
	if err := r.db.SelectContext(ctx, &rachunki, query, uzytkownikID); err != nil {
		return nil, err
	}
	return rachunki, nil
}

func (r *RachunkiRepo) GetAll(ctx context.Context) ([]models.Rachunek, error) {
	rachunki := []models.Rachunek{}
	query := `SELECT * FROM rachunki ORDER BY data_wystawienia DESC, numer_rachunku DESC`
	if err := r.db.SelectContext(ctx, &rachunki, query); err != nil {
		return nil, err
	}
	return rachunki, nil
}

func (r *RachunkiRepo) SetPaidStatus(ctx context.Context, numerRachunku string, czyOplacone bool) (int64, error) {
	res, err := r.db.ExecContext(ctx, "UPDATE rachunki SET czy_oplacone = $1 WHERE numer_rachunku = $2", czyOplacone, numerRachunku)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
