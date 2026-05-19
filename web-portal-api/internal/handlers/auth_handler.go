package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"web-portal-api/internal/auth"
	"web-portal-api/internal/config"
	"web-portal-api/internal/middleware"
	"web-portal-api/internal/models"
	"web-portal-api/internal/store"
)

type AuthHandler struct {
	Cfg  config.Config
	DB   *sql.DB
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Ok: false, Codigo: "VALIDACION", Mensaje: "Usuario y contraseña son obligatorios"})
		return
	}
	row, err := store.Authenticate(h.DB, req.Username, req.Password)
	if err != nil {
		if err == store.ErrInvalidCredentials {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{Ok: false, Codigo: "CREDENCIALES_INVALIDAS", Mensaje: "Usuario o contraseña incorrectos"})
			return
		}
		if err == store.ErrUserInactive {
			c.JSON(http.StatusForbidden, models.ErrorResponse{Ok: false, Codigo: "USUARIO_INACTIVO", Mensaje: "Usuario deshabilitado"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Ok: false, Codigo: "ERROR_INTERNO", Mensaje: "No se pudo iniciar sesión"})
		return
	}
	if err := store.RevokeUserSessions(h.DB, row.ID); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Ok: false, Codigo: "ERROR_INTERNO", Mensaje: "No se pudo crear la sesión"})
		return
	}
	jti := uuid.NewString()
	expires := time.Now().UTC().Add(h.Cfg.JWTExpiry)
	if err := store.CreateSession(h.DB, row.ID, jti, expires); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Ok: false, Codigo: "ERROR_INTERNO", Mensaje: "No se pudo crear la sesión"})
		return
	}
	token, err := auth.IssueToken(h.Cfg.JWTSecret, row.ID, row.Username, row.NombreCompleto, row.Rol, jti, h.Cfg.JWTExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Ok: false, Codigo: "ERROR_INTERNO", Mensaje: "No se pudo emitir el token"})
		return
	}
	c.JSON(http.StatusOK, models.LoginResponse{
		Ok: true, Token: token, Usuario: store.ToPublic(row),
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	u, ok := middleware.CurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Ok: false, Codigo: "NO_AUTENTICADO", Mensaje: "Sesión no válida"})
		return
	}
	c.JSON(http.StatusOK, models.MeResponse{Ok: true, Usuario: u})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	jti, _ := c.Get(middleware.ContextJTI)
	if s, ok := jti.(string); ok && strings.TrimSpace(s) != "" {
		_ = store.RevokeSessionByJTI(h.DB, s)
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "mensaje": "Sesión cerrada"})
}
