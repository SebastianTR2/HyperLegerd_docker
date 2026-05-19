package handlers

import (
	"bytes"
	"database/sql"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"web-portal-api/internal/config"
	"web-portal-api/internal/middleware"
	"web-portal-api/internal/models"
)

type ProxyHandler struct {
	Cfg config.Config
	DB  *sql.DB
}

func (h *ProxyHandler) ProxyClientes(c *gin.Context) {
	u, ok := middleware.CurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Ok: false, Codigo: "NO_AUTENTICADO", Mensaje: "Se requiere iniciar sesión"})
		return
	}
	method := c.Request.Method
	if u.Rol == "lectura" && (method == http.MethodPost || method == http.MethodPatch || method == http.MethodPut || method == http.MethodDelete) {
		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Ok: false, Codigo: "ACCESO_DENEGADO",
			Mensaje: "Su perfil solo permite consultar información.",
		})
		return
	}
	proxyPath := strings.TrimSpace(c.Param("proxyPath"))
	fullPath := "/clientes"
	if proxyPath != "" {
		if !strings.HasPrefix(proxyPath, "/") {
			proxyPath = "/" + proxyPath
		}
		fullPath += proxyPath
	}
	target := h.Cfg.MiddlewareURL + fullPath
	if q := c.Request.URL.RawQuery; q != "" {
		target += "?" + q
	}

	var body io.Reader
	if c.Request.Body != nil && (method == http.MethodPost || method == http.MethodPatch || method == http.MethodPut) {
		b, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Ok: false, Codigo: "VALIDACION", Mensaje: "No se pudo leer el cuerpo"})
			return
		}
		body = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), method, target, body)
	if err != nil {
		c.JSON(http.StatusBadGateway, models.ErrorResponse{Ok: false, Codigo: "PROXY_ERROR", Mensaje: "Error al contactar el servicio de clientes"})
		return
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		ct := c.GetHeader("Content-Type")
		if ct == "" {
			ct = "application/json"
		}
		req.Header.Set("Content-Type", ct)
	}
	apiKey := h.Cfg.APIKeyForRole(u.Rol)
	if apiKey == "" {
		c.JSON(http.StatusForbidden, models.ErrorResponse{Ok: false, Codigo: "ROL_INVALIDO", Mensaje: "Rol sin credencial de servicio"})
		return
	}
	req.Header.Set("X-API-Key", apiKey)
	req.Header.Set("X-Actor-Name", u.NombreCompleto)
	req.Header.Set("X-Actor-Role", u.Rol)
	req.Header.Set("X-Actor-Username", u.Username)
	req.Header.Set("X-Actor-Id", u.Username)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, models.ErrorResponse{Ok: false, Codigo: "PROXY_ERROR", Mensaje: "No se pudo conectar con api-middleware"})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	for k, vals := range resp.Header {
		if strings.EqualFold(k, "Content-Length") {
			continue
		}
		for _, v := range vals {
			c.Header(k, v)
		}
	}
	c.Status(resp.StatusCode)
	if len(respBody) > 0 {
		c.Writer.Write(respBody)
	}
}
