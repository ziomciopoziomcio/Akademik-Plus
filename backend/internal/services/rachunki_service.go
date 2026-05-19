package services

import (
	"context"
	"database/sql"

	"akademik/internal/models"
	"akademik/internal/repository"
)

type RachunkiService interface {
	GetByUzytkownikID(ctx context.Context, uzytkownikID int) ([]models.Rachunek, error)
	GetAll(ctx context.Context) ([]models.Rachunek, error)
	UpdatePaidStatus(ctx context.Context, numer string, czyOplacone bool) error
}

type rachunkiService struct {
	repo *repository.RachunkiRepo
}

func NewRachunkiService(repo *repository.RachunkiRepo) RachunkiService {
	return &rachunkiService{repo: repo}
}

func (s *rachunkiService) GetByUzytkownikID(ctx context.Context, uzytkownikID int) ([]models.Rachunek, error) {
	return s.repo.GetByUzytkownikID(ctx, uzytkownikID)
}

func (s *rachunkiService) GetAll(ctx context.Context) ([]models.Rachunek, error) {
	return s.repo.GetAll(ctx)
}

func (s *rachunkiService) UpdatePaidStatus(ctx context.Context, numer string, czyOplacone bool) error {
	rows, err := s.repo.SetPaidStatus(ctx, numer, czyOplacone)
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}
