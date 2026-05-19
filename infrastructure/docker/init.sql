CREATE TABLE uzytkownicy
(
    id             SERIAL PRIMARY KEY,
    imie           TEXT        NOT NULL,
    nazwisko       TEXT        NOT NULL,
    email          TEXT UNIQUE NOT NULL,
    numer_telefonu TEXT UNIQUE NOT NULL,
    username       TEXT UNIQUE NOT NULL,
    password_hash  TEXT        NOT NULL,
    rola           TEXT        NOT NULL,
    czy_wymaga_dostosowan BOOLEAN NOT NULL DEFAULT FALSE
);

--  akademiki.go

CREATE TABLE akademiki
(
    id  SERIAL PRIMARY KEY,
    adres TEXT NOT NULL,
    ilosc_pieter INT DEFAULT 4,
    czy_winda BOOLEAN NOT NULL DEFAULT TRUE,
    czy_dostosowany BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TYPE StatusPokoju AS ENUM ('Dostepny', 'W_remoncie');
CREATE TYPE StandardPokoju AS ENUM ('Standard', 'Podwyzszony');

CREATE TABLE pokoj
(
    id SERIAL PRIMARY KEY,
    numer_pokoju TEXT NOT NULL,
    ile_osob INT NOT NULL DEFAULT 2,
    czy_kuchnia BOOLEAN NOT NULL DEFAULT FALSE,
    czy_toaleta BOOLEAN NOT NULL DEFAULT TRUE,
    czy_dostosowany BOOLEAN NOT NULL DEFAULT FALSE,
    pietro INT NOT NULL,
    status_pokoju StatusPokoju NOT NULL DEFAULT 'Dostepny',
    standard StandardPokoju NOT NULL Default 'Standard',
    akademik_id INT NOT NULL REFERENCES akademiki(id)
);

CREATE TABLE zakwaterowania
(
    id SERIAL PRIMARY KEY,
    mieszkaniec_id INT NOT NULL REFERENCES uzytkownicy(id),
    pokoj_id INT NOT NULL REFERENCES pokoj(id),
    poczatek_zakwaterowania DATE NOT NULL,
    koniec_zakwaterowania DATE NOT NULL
);

CREATE TABLE usterki
(
    id                          SERIAL PRIMARY KEY,
    zglaszajacy_id              INT       NOT NULL REFERENCES uzytkownicy (id),
    pokoj_id                    INT       NOT NULL REFERENCES pokoj(id),
    priorytet                   TEXT      NOT NULL,
    status                      TEXT      NOT NULL,
    przypisany_administrator_id INT REFERENCES uzytkownicy (id),
    opis_usterki                TEXT      NOT NULL,
    data_zgloszenia             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_rozwiazania            TIMESTAMP
);

CREATE TABLE cennik
(
    id SERIAL PRIMARY KEY,
    standard StandardPokoju NOT NULL DEFAULT 'Standard',
    kwota DECIMAL(10, 2) NOT NULL
);

CREATE TABLE rachunki
(
    numer_rachunku TEXT PRIMARY KEY,
    zakwaterowanie_id INT NOT NULL REFERENCES zakwaterowania(id),
    kwota DECIMAL(10, 2) NOT NULL,
    czy_oplacone BOOLEAN NOT NULL DEFAULT FALSE,
    data_wystawienia DATE NOT NULL DEFAULT CURRENT_DATE,
    termin_do_zaplacenia DATE NOT NULL,
    termin_platnosci DATE,
    okres_rozliczeniowy TEXT NOT NULL,
    dodatkowe_uwagi TEXT
);

CREATE TABLE komentarze_usterki (
    id SERIAL PRIMARY KEY,
    usterka_id INT NOT NULL REFERENCES usterki(id) ON DELETE CASCADE,
    autor_id INT NOT NULL REFERENCES uzytkownicy(id),
    tresc TEXT NOT NULL,
    data_dodania TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Test password: "Haslo123"
INSERT INTO uzytkownicy (imie, nazwisko, email, numer_telefonu, username, password_hash, rola, czy_wymaga_dostosowan)
VALUES
    ('Jan', 'Kowalski', 'jan@akademik.pl', '123456789', 'jkowalski', '$2a$10$/4xitngJrzV0FpJsQL9uh.9m4ASxiB/juv7w0cbD1NC.aLtyT1v9a', 'Mieszkaniec', FALSE),
    ('Anna', 'Admin', 'admin@akademik.pl', '987654321', 'aadmin', '$2a$10$/4xitngJrzV0FpJsQL9uh.9m4ASxiB/juv7w0cbD1NC.aLtyT1v9a', 'Administrator', FALSE);

INSERT INTO akademiki (adres, ilosc_pieter, czy_winda, czy_dostosowany)
VALUES ('ul. Akademicka 1, Warszawa', 5, TRUE, TRUE);

INSERT INTO cennik (standard, kwota)
VALUES
    ('Standard', 600.00),
    ('Podwyzszony', 850.00);

INSERT INTO pokoj (numer_pokoju, ile_osob, czy_kuchnia, czy_toaleta, czy_dostosowany, pietro, status_pokoju, standard, akademik_id)
VALUES
    ('101', 2, FALSE, TRUE, FALSE, 1, 'Dostepny', 'Standard', 1),
    ('202', 1, TRUE, TRUE, TRUE, 2, 'Dostepny', 'Podwyzszony', 1);

INSERT INTO zakwaterowania (mieszkaniec_id, pokoj_id, poczatek_zakwaterowania, koniec_zakwaterowania)
VALUES (1, 1, '2026-10-01', '2027-06-30');

INSERT INTO usterki (zglaszajacy_id, pokoj_id, opis_usterki, priorytet, status)
VALUES (1, 1, 'Kran przecieka w łazience', 'Pilne', 'Przyjeto');

INSERT INTO rachunki (numer_rachunku, zakwaterowanie_id, kwota, czy_oplacone, data_wystawienia, termin_do_zaplacenia, okres_rozliczeniowy, dodatkowe_uwagi)
VALUES ('RACH/2026/10/01', 1, 600.00, FALSE, '2026-10-01', '2026-10-15', 'Październik 2026', 'Czynsz podstawowy');
