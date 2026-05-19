package repository

import (
	"akademik/internal/models"
	"context"

	"github.com/jmoiron/sqlx"
)

type ZakwaterowaniaRepo struct {
	db *sqlx.DB
}

func NewZakwaterowaniaRepo(db *sqlx.DB) *ZakwaterowaniaRepo {
	return &ZakwaterowaniaRepo{db: db}
}

func (r *ZakwaterowaniaRepo) GetCurrentByMieszkaniecID(mieszkaniecID int) (*models.Zakwaterowanie, error) {
	var zakwaterowanie models.Zakwaterowanie
	query := `
		SELECT 
			z.id, 
			z.mieszkaniec_id, 
			z.pokoj_id, 
			z.poczatek_zakwaterowania, 
			z.koniec_zakwaterowania,
			p.numer_pokoju,
			p.standard AS standard_pokoju,
			a.adres AS akademik_adres,
			CONCAT(u.imie, ' ', u.nazwisko) AS mieszkaniec_nazwa
		FROM zakwaterowania z
		JOIN pokoj p ON z.pokoj_id = p.id
		JOIN akademiki a ON p.akademik_id = a.id
		JOIN uzytkownicy u ON z.mieszkaniec_id = u.id
		WHERE z.mieszkaniec_id = $1
		ORDER BY z.poczatek_zakwaterowania DESC
		LIMIT 1
	`

	err := r.db.Get(&zakwaterowanie, query, mieszkaniecID)
	if err != nil {
		return nil, err
	}
	return &zakwaterowanie, nil
}

func (r *ZakwaterowaniaRepo) GetAll(ctx context.Context) ([]models.Zakwaterowanie, error) {
	zakwaterowania := []models.Zakwaterowanie{}
	query := `
		SELECT 
			z.id, 
			z.mieszkaniec_id, 
			z.pokoj_id, 
			z.poczatek_zakwaterowania, 
			z.koniec_zakwaterowania,
			p.numer_pokoju,
			p.standard AS standard_pokoju,
			a.adres AS akademik_adres,
			CONCAT(u.imie, ' ', u.nazwisko) AS mieszkaniec_nazwa
		FROM zakwaterowania z
		JOIN pokoj p ON z.pokoj_id = p.id
		JOIN akademiki a ON p.akademik_id = a.id
		JOIN uzytkownicy u ON z.mieszkaniec_id = u.id
		ORDER BY z.poczatek_zakwaterowania DESC
	`
	if err := r.db.SelectContext(ctx, &zakwaterowania, query); err != nil {
		return nil, err
	}
	return zakwaterowania, nil
}

func (r *ZakwaterowaniaRepo) Create(ctx context.Context, z *models.Zakwaterowanie) error {
	query := `
		INSERT INTO zakwaterowania (mieszkaniec_id, pokoj_id, poczatek_zakwaterowania, koniec_zakwaterowania)
		VALUES (:mieszkaniec_id, :pokoj_id, :poczatek_zakwaterowania, :koniec_zakwaterowania)
		RETURNING id
	`
	rows, err := r.db.NamedQueryContext(ctx, query, z)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&z.ID)
	}
	return rows.Err()
}

func (r *ZakwaterowaniaRepo) Checkout(ctx context.Context, id int, koniec string) (int64, error) {
	res, err := r.db.ExecContext(ctx, "UPDATE zakwaterowania SET koniec_zakwaterowania = $1 WHERE id = $2", koniec, id)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
