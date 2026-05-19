package models

import "time"

type Rola string

const (
	Administrator Rola = "Administrator"
	Mieszkaniec   Rola = "Mieszkaniec"
)

type Uzytkownik struct {
	ID                  int    `db:"id" json:"id"`
	Imie                string `db:"imie" json:"imie"`
	Nazwisko            string `db:"nazwisko" json:"nazwisko"`
	Email               string `db:"email" json:"email"`
	NumerTelefonu       string `db:"numer_telefonu" json:"numer_telefonu"`
	Username            string `db:"username" json:"username"`
	PasswordHash        string `db:"password_hash" json:"-"`
	Rola                Rola   `db:"rola" json:"rola"`
	CzyWymagaDostosowan bool   `db:"czy_wymaga_dostosowan" json:"czy_wymaga_dostosowan"`
}

type Zakwaterowanie struct {
	ID                     int       `db:"id" json:"id"`
	MieszkaniecID          int       `db:"mieszkaniec_id" json:"mieszkaniec_id"`
	PokojID                int       `db:"pokoj_id" json:"pokoj_id"`
	PoczatekZakwaterowania time.Time `db:"poczatek_zakwaterowania" json:"poczatek_zakwaterowania"`
	KoniecZakwaterowania   time.Time `db:"koniec_zakwaterowania" json:"koniec_zakwaterowania"`
	NumerPokoju            string    `db:"numer_pokoju" json:"numer_pokoju,omitempty"`
	StandardPokoju         string    `db:"standard_pokoju" json:"standard_pokoju,omitempty"`
	AkademikAdres          string    `db:"akademik_adres" json:"akademik_adres,omitempty"`
	MieszkaniecNazwa       string    `db:"mieszkaniec_nazwa" json:"mieszkaniec_nazwa,omitempty"`
}
