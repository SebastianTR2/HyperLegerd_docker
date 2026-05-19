package middleware

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"web-portal-api/internal/auth"
	"web-portal-api/internal/config"
	"web-portal-api/internal/models"
	"web-portal-api/internal/store"
)

const (
	ContextUser = "portal_user"
	ContextJTI  = "portal_jti"
)

func RequireAuth(cfg config.Config, conn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := bearerToken(c.GetHeader("Authorization"))
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "NO_AUTENTICADO", Mensaje: "Se requiere iniciar sesión",
			})
			return
		}
		claims, err := auth.ParseToken(cfg.JWTSecret, token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "TOKEN_INVALIDO", Mensaje: "Sesión inválida o expirada",
			})
			return
		}
		active, err := store.SessionActive(conn, claims.ID)
		if err != nil || !active {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "SESION_INVALIDA", Mensaje: "La sesión ya no es válida. Inicie sesión de nuevo.",
			})
			return
		}
		row, err := store.GetUserByID(conn, claims.UserID)
		if err != nil || !row.Activo {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "USUARIO_INVALIDO", Mensaje: "Usuario no disponible",
			})
			return
		}
		c.Set(ContextUser, store.ToPublic(row))
		c.Set(ContextJTI, claims.ID)
		c.Next()
	}
}

func RequireWriteRole() gin.HandlerFunc {
	return func(c *gin.Context) {
		u, ok := CurrentUser(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "NO_AUTENTICADO", Mensaje: "Se requiere iniciar sesión",
			})
			return
		}
		if u.Rol == "lectura" {
			c.AbortWithStatusJSON(http.StatusForbidden, models.ErrorResponse{
				Ok: false, Codigo: "ACCESO_DENEGADO",
				Mensaje: "Su perfil solo permite consultar información. No puede crear, editar ni dar de baja clientes.",
			})
			return
		}
		c.Next()
	}
}

func CurrentUser(c *gin.Context) (models.User, bool) {
	v, ok := c.Get(ContextUser)
	if !ok {
		return models.User{}, false
	}
	u, ok := v.(models.User)
	return u, ok
}

func bearerToken(h string) string {
	h = strings.TrimSpace(h)
	if h == "" {
		return ""
	}
	const p = "Bearer "
	if len(h) > len(p) && strings.EqualFold(h[:len(p)], p) {
		return strings.TrimSpace(h[len(p):])
	}
	return ""
}
