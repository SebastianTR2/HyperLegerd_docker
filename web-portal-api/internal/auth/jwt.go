package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID         string `json:"uid"`
	Username       string `json:"username"`
	NombreCompleto string `json:"nombre"`
	Rol            string `json:"rol"`
	jwt.RegisteredClaims
}

func IssueToken(secret string, userID, username, nombre, rol, jti string, exp time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:         userID,
		Username:       username,
		NombreCompleto: nombre,
		Rol:            rol,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ID:        jti,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(exp)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(secret))
}

func ParseToken(secret, token string) (*Claims, error) {
	t, err := jwt.ParseWithClaims(token, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("algoritmo JWT no soportado")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := t.Claims.(*Claims)
	if !ok || !t.Valid {
		return nil, errors.New("token inválido")
	}
	return claims, nil
}
