package services

import (
	"context"
	"database/sql"
	"errors"

	"akademik/internal/models"
	"akademik/internal/repository"
)

var ErrNotFound = sql.ErrNoRows

type PokojeService interface {
	GetAll(ctx context.Context) ([]models.Pokoj, error)
	Create(ctx context.Context, p *models.Pokoj) (int, error)
	Delete(ctx context.Context, id int) error
	UpdateStatus(ctx context.Context, id int, status models.StatusPokoju) error
}

type pokojeService struct {
	repo *repository.PokojeRepo
}

func NewPokojeService(repo *repository.PokojeRepo) PokojeService {
	return &pokojeService{repo: repo}
}

func (s *pokojeService) GetAll(ctx context.Context) ([]models.Pokoj, error) {
	return s.repo.GetAll(ctx)
}

func (s *pokojeService) Create(ctx context.Context, p *models.Pokoj) (int, error) {
	return s.repo.Create(ctx, p)
}

func (s *pokojeService) Delete(ctx context.Context, id int) error {
	rows, err := s.repo.Delete(ctx, id)
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *pokojeService) UpdateStatus(ctx context.Context, id int, status models.StatusPokoju) error {
	if status != models.Dostepny && status != models.WRemoncie {
		return errors.New("invalid room status")
	}
	rows, err := s.repo.UpdateStatus(ctx, id, status)
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}
