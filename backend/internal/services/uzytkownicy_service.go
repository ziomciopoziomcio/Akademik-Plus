package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"akademik/internal/models"
	"akademik/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

type UzytkownicyService struct {
	repo *repository.UzytkownicyRepo
}

func NewUzytkownicyService(repo *repository.UzytkownicyRepo) *UzytkownicyService {
	return &UzytkownicyService{repo: repo}
}

func (s *UzytkownicyService) CreateUser(u *models.Uzytkownik, plainPassword string) error {
	if strings.TrimSpace(u.Imie) == "" || strings.TrimSpace(u.Nazwisko) == "" {
		return errors.New("name is required")
	}
	if !strings.Contains(u.Email, "@") {
		return errors.New("invalid email")
	}
	if strings.TrimSpace(u.NumerTelefonu) == "" {
		return errors.New("phone is required")
	}
	if strings.TrimSpace(u.Username) == "" {
		return errors.New("username is required")
	}
	if strings.TrimSpace(string(u.Rola)) == "" {
		u.Rola = models.Mieszkaniec
	} else if u.Rola != models.Administrator && u.Rola != models.Mieszkaniec {
		return errors.New("invalid role")
	}

	existing, err := s.repo.GetByEmail(u.Email)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
	} else if existing != nil {
		return errors.New("email already in use")
	}

	if len(plainPassword) < 6 {
		return errors.New("password must be at least 6 characters long")
	}

	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hashedBytes)

	return s.repo.Create(u)
}

func (s *UzytkownicyService) GetByID(id int) (*models.Uzytkownik, error) {
	return s.repo.GetByID(id)
}

func (s *UzytkownicyService) GetAll(ctx context.Context) ([]models.Uzytkownik, error) {
	return s.repo.GetAll(ctx)
}

func (s *UzytkownicyService) UpdateRole(ctx context.Context, id int, rola models.Rola) error {
	if rola != models.Administrator && rola != models.Mieszkaniec {
		return errors.New("invalid role")
	}
	rows, err := s.repo.UpdateRole(ctx, id, rola)
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *UzytkownicyService) Delete(ctx context.Context, id int) error {
	rows, err := s.repo.Delete(ctx, id)
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}
