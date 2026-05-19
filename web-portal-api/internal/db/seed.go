package db

import (
	"database/sql"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type DemoUser struct {
	Username       string
	Password       string
	NombreCompleto string
	Rol            string
}

var demoUsers = []DemoUser{
	{Username: "admin", Password: "admin123", NombreCompleto: "Administrador General", Rol: "admin"},
	{Username: "trabajador", Password: "trabajador123", NombreCompleto: "Operador de Clientes", Rol: "integrador"},
	{Username: "lectura", Password: "lectura123", NombreCompleto: "Usuario Consulta", Rol: "lectura"},
}

func SeedDemoUsers(conn *sql.DB) error {
	now := time.Now().UTC().Format(time.RFC3339)
	for _, u := range demoUsers {
		var exists int
		err := conn.QueryRow(`SELECT COUNT(1) FROM users WHERE username = ? COLLATE NOCASE`, u.Username).Scan(&exists)
		if err != nil {
			return err
		}
		if exists > 0 {
			continue
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		id := uuid.NewString()
		_, err = conn.Exec(
			`INSERT INTO users (id, username, password_hash, nombre_completo, rol, activo, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
			id, strings.ToLower(u.Username), string(hash), u.NombreCompleto, u.Rol, now, now,
		)
		if err != nil {
			return err
		}
	}
	return nil
}
