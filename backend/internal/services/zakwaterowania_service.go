package services

import (
	"akademik/internal/models"
	"akademik/internal/repository"
	"context"
	"errors"
	"time"
)

type ZakwaterowaniaService struct {
	repo *repository.ZakwaterowaniaRepo
}

func NewZakwaterowaniaService(repo *repository.ZakwaterowaniaRepo) *ZakwaterowaniaService {
	return &ZakwaterowaniaService{repo: repo}
}

func (s *ZakwaterowaniaService) GetCurrentAccommodation(mieszkaniecID int) (*models.Zakwaterowanie, error) {
	return s.repo.GetCurrentByMieszkaniecID(mieszkaniecID)
}

func (s *ZakwaterowaniaService) GetAll(ctx context.Context) ([]models.Zakwaterowanie, error) {
	return s.repo.GetAll(ctx)
}

func (s *ZakwaterowaniaService) Create(ctx context.Context, z *models.Zakwaterowanie) error {
	if z.MieszkaniecID <= 0 || z.PokojID <= 0 {
		return errors.New("invalid ids")
	}
	if z.PoczatekZakwaterowania.IsZero() || z.KoniecZakwaterowania.IsZero() {
		return errors.New("invalid dates")
	}
	if z.KoniecZakwaterowania.Before(z.PoczatekZakwaterowania) {
		return errors.New("invalid dates")
	}
	z.PoczatekZakwaterowania = z.PoczatekZakwaterowania.UTC()
	z.KoniecZakwaterowania = z.KoniecZakwaterowania.UTC()
	return s.repo.Create(ctx, z)
}

func (s *ZakwaterowaniaService) Checkout(ctx context.Context, id int, koniec string) error {
	if _, err := time.Parse("2006-01-02", koniec); err != nil {
		return errors.New("invalid checkout date")
	}
	rows, err := s.repo.Checkout(ctx, id, koniec)
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
