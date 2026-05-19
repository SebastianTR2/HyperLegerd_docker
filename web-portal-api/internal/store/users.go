package store

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"web-portal-api/internal/models"
)

var ErrInvalidCredentials = errors.New("credenciales inválidas")
var ErrUserInactive = errors.New("usuario inactivo")

type UserRow struct {
	ID             string
	Username       string
	PasswordHash   string
	NombreCompleto string
	Rol            string
	Activo         bool
}

func Authenticate(conn *sql.DB, username, password string) (UserRow, error) {
	u := strings.TrimSpace(username)
	var row UserRow
	var activo int
	err := conn.QueryRow(
		`SELECT id, username, password_hash, nombre_completo, rol, activo FROM users WHERE username = ? COLLATE NOCASE`,
		u,
	).Scan(&row.ID, &row.Username, &row.PasswordHash, &row.NombreCompleto, &row.Rol, &activo)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return UserRow{}, ErrInvalidCredentials
		}
		return UserRow{}, err
	}
	row.Activo = activo == 1
	if !row.Activo {
		return UserRow{}, ErrUserInactive
	}
	if err := bcrypt.CompareHashAndPassword([]byte(row.PasswordHash), []byte(password)); err != nil {
		return UserRow{}, ErrInvalidCredentials
	}
	return row, nil
}

func RevokeUserSessions(conn *sql.DB, userID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := conn.Exec(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, now, userID)
	return err
}

func CreateSession(conn *sql.DB, userID, jti string, expiresAt time.Time) error {
	id := uuid.NewString()
	_, err := conn.Exec(
		`INSERT INTO sessions (id, user_id, jti, expires_at) VALUES (?, ?, ?, ?)`,
		id, userID, jti, expiresAt.UTC().Format(time.RFC3339),
	)
	return err
}

func SessionActive(conn *sql.DB, jti string) (bool, error) {
	var revoked sql.NullString
	var expires string
	err := conn.QueryRow(`SELECT revoked_at, expires_at FROM sessions WHERE jti = ?`, jti).Scan(&revoked, &expires)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	if revoked.Valid && strings.TrimSpace(revoked.String) != "" {
		return false, nil
	}
	exp, err := time.Parse(time.RFC3339, expires)
	if err != nil {
		return false, err
	}
	return time.Now().UTC().Before(exp), nil
}

func RevokeSessionByJTI(conn *sql.DB, jti string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := conn.Exec(`UPDATE sessions SET revoked_at = ? WHERE jti = ? AND revoked_at IS NULL`, now, jti)
	return err
}

func ToPublic(row UserRow) models.User {
	return models.User{
		ID:             row.ID,
		Username:       row.Username,
		NombreCompleto: row.NombreCompleto,
		Rol:            row.Rol,
	}
}

func GetUserByID(conn *sql.DB, id string) (UserRow, error) {
	var row UserRow
	var activo int
	err := conn.QueryRow(
		`SELECT id, username, password_hash, nombre_completo, rol, activo FROM users WHERE id = ?`,
		id,
	).Scan(&row.ID, &row.Username, &row.PasswordHash, &row.NombreCompleto, &row.Rol, &activo)
	if err != nil {
		return UserRow{}, err
	}
	row.Activo = activo == 1
	return row, nil
}
