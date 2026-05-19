package repository

import (
	"akademik/internal/models"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
)

type UsterkiRepo struct {
	db *sqlx.DB
}

func NewUsterkiRepo(db *sqlx.DB) *UsterkiRepo {
	return &UsterkiRepo{db: db}
}

func (r *UsterkiRepo) Create(u *models.Usterka) error {
	if u.Priorytet == nil {
		return fmt.Errorf("priorytet zgłoszenia jest wymagany")
	}

	query := `
        INSERT INTO usterki (zglaszajacy_id, pokoj_id, opis_usterki, priorytet, status) 
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id`

	if err := r.db.QueryRow(query, u.ZglaszajacyID, u.PokojID, u.OpisUsterki, string(*u.Priorytet), string(u.Status)).Scan(&u.ID); err != nil {
		return err
	}

	return nil
}

func (r *UsterkiRepo) GetByPokojID(pokojID int) ([]models.Usterka, error) {
	usterki := []models.Usterka{}
	err := r.db.Select(&usterki, "SELECT * FROM usterki WHERE pokoj_id = $1", pokojID)
	return usterki, err
}

func (r *UsterkiRepo) UpdateStatus(id int, status models.StatusNaprawy) error {
	result, err := r.db.Exec("UPDATE usterki SET status = $1 WHERE id = $2", status, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *UsterkiRepo) GetAll() ([]models.Usterka, error) {
	usterki := []models.Usterka{}

	query := ` 
	SELECT
	id,
		zglaszajacy_id,
		pokoj_id,
		priorytet,
		status,
		przypisany_administrator_id,
		opis_usterki,
		data_zgloszenia,
		data_rozwiazania
	FROM usterki
	ORDER BY data_zgloszenia DESC
	`

	err := r.db.Select(&usterki, query)
	return usterki, err
}
