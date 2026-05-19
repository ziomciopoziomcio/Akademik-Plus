package services

import (
	"akademik/internal/models"
	"akademik/internal/repository"
	"errors"
)

type UsterkiService struct {
	repo       *repository.UsterkiRepo
	pokojeRepo *repository.PokojeRepo
}

func NewUsterkiService(repo *repository.UsterkiRepo, pokojeRepo *repository.PokojeRepo) *UsterkiService {
	return &UsterkiService{repo: repo, pokojeRepo: pokojeRepo}
}

func (s *UsterkiService) CreateUsterka(u *models.Usterka) error {
	u.Status = models.Przyjeto
	if u.Priorytet == nil {
		return errors.New("priorytet zgłoszenia jest wymagany")
	}
	if !u.Priorytet.IsValid() {
		return errors.New("nieprawidłowy priorytet zgłoszenia")
	}
	_, err := s.pokojeRepo.GetByID(u.PokojID)
	if err != nil {
		return errors.New("wskazany pokój nie istnieje")
	}

	return s.repo.Create(u)
}

func (s *UsterkiService) UpdateStatus(id int, status models.StatusNaprawy) error {
	if !status.IsValid() {
		return errors.New("invalid status")
	}
	return s.repo.UpdateStatus(id, status)
}

func (s *UsterkiService) GetByPokojID(id int) ([]models.Usterka, error) {
	return s.repo.GetByPokojID(id)
}

func (s *UsterkiService) GetAll() ([]models.Usterka, error) {
	return s.repo.GetAll()
}

func (s *UsterkiService) GetByReporterID(userID int) ([]models.Usterka, error) {
	return s.repo.GetByReporterID(userID)
}
