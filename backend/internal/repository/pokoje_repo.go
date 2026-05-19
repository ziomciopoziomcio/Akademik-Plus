package repository

import (
	"context"
	"errors"

	"akademik/internal/models"

	"github.com/jmoiron/sqlx"
)

type PokojeRepo struct {
	db *sqlx.DB
}

func NewPokojeRepo(db *sqlx.DB) *PokojeRepo {
	return &PokojeRepo{db: db}
}

func (r *PokojeRepo) GetAll(ctx context.Context) ([]models.Pokoj, error) {
	pokoje := []models.Pokoj{}
	if err := r.db.SelectContext(ctx, &pokoje, "SELECT * FROM pokoj"); err != nil {
		return nil, err
	}
	return pokoje, nil
}

func (r *PokojeRepo) Create(ctx context.Context, p *models.Pokoj) (int, error) {
	query := `INSERT INTO pokoj (
				numer_pokoju, ile_osob, czy_kuchnia, czy_toaleta, czy_dostosowany, pietro, status_pokoju, standard, akademik_id
			  )
			  VALUES (
			  	:numer_pokoju, :ile_osob, :czy_kuchnia, :czy_toaleta, :czy_dostosowany, :pietro, :status_pokoju, :standard, :akademik_id
			  ) RETURNING id`
	rows, err := r.db.NamedQueryContext(ctx, query, p)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	if rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return 0, err
		}
		return id, nil
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	return 0, errors.New("no id returned")
}

func (r *PokojeRepo) Delete(ctx context.Context, id int) (int64, error) {
	res, err := r.db.ExecContext(ctx, "DELETE FROM pokoj WHERE id = $1", id)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (r *PokojeRepo) GetByID(id int) (*models.Pokoj, error) {
	var pokoj models.Pokoj

	query := `SELECT * FROM pokoj WHERE id = $1`

	err := r.db.Get(&pokoj, query, id)
	if err != nil {
		return nil, err
	}
	return &pokoj, nil
}

func (r *PokojeRepo) UpdateStatus(ctx context.Context, id int, status models.StatusPokoju) (int64, error) {
	res, err := r.db.ExecContext(ctx, "UPDATE pokoj SET status_pokoju = $1 WHERE id = $2", status, id)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
