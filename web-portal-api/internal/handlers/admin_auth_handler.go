// Handlers de autenticación para la consola del puente (web-cliente-demo).
// A diferencia del login del portal-cliente final (basado en SQLite),
// este flujo valida contra el registro YAML usuariosadmin.
//
// Los tokens emitidos llevan scope="admin-console" + tenant. El middleware
// RequireAdminAuth los acepta; el RequireAuth tradicional NO acepta tokens
// con este scope para evitar mezclar superficies.
package handlers

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"web-portal-api/internal/auth"
	"web-portal-api/internal/config"
	"web-portal-api/internal/models"
	"web-portal-api/internal/usuariosadmin"
)

// ScopeAdminConsole es el valor del claim "scope" de los tokens emitidos
// para la consola del puente.
const ScopeAdminConsole = "admin-console"

// AdminAuthHandler agrupa los endpoints /admin/auth/*.
type AdminAuthHandler struct {
	Cfg      config.Config
	Registro *usuariosadmin.Registry
	// JTIRevocados mantiene un set en memoria de tokens cerrados (logout).
	// Para producción real conviene una tabla; en MVP es suficiente.
	JTIRevocados *RevocacionesMemoria
}

type RevocacionesMemoria struct {
	mu   sync.RWMutex
	jtis map[string]time.Time
}

func NuevaRevocacionesMemoria() *RevocacionesMemoria {
	return &RevocacionesMemoria{jtis: make(map[string]time.Time)}
}

func (r *RevocacionesMemoria) Revocar(jti string, exp time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.jtis[jti] = exp
	if len(r.jtis) > 256 {
		now := time.Now()
		for k, e := range r.jtis {
			if now.After(e) {
				delete(r.jtis, k)
			}
		}
	}
}

func (r *RevocacionesMemoria) Revocado(jti string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	exp, ok := r.jtis[jti]
	if !ok {
		return false
	}
	if time.Now().After(exp) {
		return false
	}
	return true
}

// UsuarioAdminPublico es el shape devuelto al frontend (sin hash).
type UsuarioAdminPublico struct {
	Usuario        string `json:"usuario"`
	NombreCompleto string `json:"nombreCompleto"`
	Rol            string `json:"rol"`
	Tenant         string `json:"tenant"`
}

type LoginAdminResponse struct {
	Ok      bool                 `json:"ok"`
	Token   string               `json:"token"`
	Usuario UsuarioAdminPublico  `json:"usuario"`
}

type MeAdminResponse struct {
	Ok      bool                `json:"ok"`
	Usuario UsuarioAdminPublico `json:"usuario"`
}

// AdminClaimsFromContext recupera el JWT decodificado del contexto Gin.
func AdminClaimsFromContext(c *gin.Context) (*auth.Claims, bool) {
	v, ok := c.Get("admin_console_claims")
	if !ok {
		return nil, false
	}
	cl, ok := v.(*auth.Claims)
	return cl, ok
}

// Login valida usuario+contraseña contra el YAML y emite un JWT.
func (h *AdminAuthHandler) Login(c *gin.Context) {
	if h.Registro == nil {
		c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
			Ok: false, Codigo: "ADMIN_NO_CONFIGURADO",
			Mensaje: "El BFF no tiene configurado el módulo de consola admin",
		})
		return
	}
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Username) == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "VALIDACION",
			Mensaje: "Usuario y contraseña son obligatorios",
		})
		return
	}
	u, err := h.Registro.Autenticar(req.Username, req.Password)
	if err != nil {
		switch err {
		case usuariosadmin.ErrUsuarioInactivo:
			c.JSON(http.StatusForbidden, models.ErrorResponse{
				Ok: false, Codigo: "USUARIO_INACTIVO",
				Mensaje: "Cuenta deshabilitada",
			})
		case usuariosadmin.ErrConfiguracionAusente:
			c.JSON(http.StatusServiceUnavailable, models.ErrorResponse{
				Ok: false, Codigo: "ADMIN_NO_CONFIGURADO",
				Mensaje: "Sin configuración de usuarios admin",
			})
		default:
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Ok: false, Codigo: "CREDENCIALES_INVALIDAS",
				Mensaje: "Usuario o contraseña incorrectos",
			})
		}
		return
	}
	jti := uuid.NewString()
	exp := h.Cfg.JWTExpiry
	if exp == 0 {
		exp = 8 * time.Hour
	}
	token, err := auth.IssueTokenExt(
		h.Cfg.JWTSecret,
		u.Usuario, u.Usuario, u.NombreCompleto, u.Rol,
		u.Tenant, ScopeAdminConsole, jti, exp,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Ok: false, Codigo: "ERROR_INTERNO",
			Mensaje: "No se pudo emitir el token",
		})
		return
	}
	c.JSON(http.StatusOK, LoginAdminResponse{
		Ok:    true,
		Token: token,
		Usuario: UsuarioAdminPublico{
			Usuario:        u.Usuario,
			NombreCompleto: u.NombreCompleto,
			Rol:            u.Rol,
			Tenant:         u.Tenant,
		},
	})
}

// Me devuelve la identidad asociada al JWT actual.
func (h *AdminAuthHandler) Me(c *gin.Context) {
	cl, ok := AdminClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Ok: false, Codigo: "NO_AUTENTICADO",
			Mensaje: "Sesión no válida",
		})
		return
	}
	c.JSON(http.StatusOK, MeAdminResponse{
		Ok: true,
		Usuario: UsuarioAdminPublico{
			Usuario:        cl.Username,
			NombreCompleto: cl.NombreCompleto,
			Rol:            cl.Rol,
			Tenant:         cl.Tenant,
		},
	})
}

// Logout añade el JTI a la lista de revocados.
func (h *AdminAuthHandler) Logout(c *gin.Context) {
	cl, ok := AdminClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"ok": true, "mensaje": "Sesión cerrada"})
		return
	}
	if h.JTIRevocados != nil && cl.ID != "" {
		var exp time.Time
		if cl.ExpiresAt != nil {
			exp = cl.ExpiresAt.Time
		} else {
			exp = time.Now().Add(8 * time.Hour)
		}
		h.JTIRevocados.Revocar(cl.ID, exp)
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "mensaje": "Sesión cerrada"})
}
