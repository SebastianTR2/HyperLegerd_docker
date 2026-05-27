// Proxy genérico para la consola del puente (web-cliente-demo).
//
// El frontend nunca habla directamente con api-middleware: envía
// Authorization: Bearer <jwt> al BFF en /admin/api/*. El BFF valida el
// JWT, resuelve la X-API-Key real desde el registro YAML (multi-tenant)
// e inyecta las cabeceras X-Actor-* derivadas de los claims del JWT.
//
// El proxy soporta:
//   - GET/POST/PATCH/PUT/DELETE con cuerpo JSON.
//   - text/event-stream (Server-Sent Events) en streaming bidireccional
//     para /admin/notificaciones/stream.
//   - query string preservado.
package handlers

import (
	"bytes"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"web-portal-api/internal/config"
	"web-portal-api/internal/models"
	"web-portal-api/internal/usuariosadmin"
)

// AdminProxyHandler reenvía peticiones desde la consola al api-middleware.
type AdminProxyHandler struct {
	Cfg      config.Config
	Registro *usuariosadmin.Registry
}

// hopByHopHeaders no deben copiarse al cliente.
var hopByHopHeaders = map[string]bool{
	"Connection":          true,
	"Keep-Alive":          true,
	"Proxy-Authenticate":  true,
	"Proxy-Authorization": true,
	"Te":                  true,
	"Trailer":             true,
	"Transfer-Encoding":   true,
	"Upgrade":             true,
}

// Proxy es el handler genérico montado en /admin/api/*proxyPath.
func (h *AdminProxyHandler) Proxy(c *gin.Context) {
	cl, ok := AdminClaimsFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Ok: false, Codigo: "NO_AUTENTICADO", Mensaje: "Se requiere iniciar sesión",
		})
		return
	}

	// Bloquear writes para rol lectura, pero permitir GETs.
	method := c.Request.Method
	if strings.EqualFold(cl.Rol, "lectura") && esMutacion(method) {
		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Ok: false, Codigo: "ACCESO_DENEGADO",
			Mensaje: "Su perfil solo permite consultar información",
		})
		return
	}

	// Resolver X-API-Key real desde el registro.
	apiKey := h.Registro.APIKeyPara(cl.Tenant, cl.Rol)
	if apiKey == "" {
		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Ok: false, Codigo: "API_KEY_AUSENTE",
			Mensaje: "No hay credencial de servicio para este tenant/rol",
		})
		return
	}

	// Reconstruir la ruta destino. Gin entrega proxyPath con leading slash.
	subPath := strings.TrimSpace(c.Param("proxyPath"))
	if subPath == "" {
		subPath = "/"
	}
	if !strings.HasPrefix(subPath, "/") {
		subPath = "/" + subPath
	}
	target := h.Cfg.MiddlewareURL + subPath
	if q := c.Request.URL.RawQuery; q != "" {
		target += "?" + q
	}
	if _, err := url.Parse(target); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Ok: false, Codigo: "VALIDACION", Mensaje: "Ruta no válida",
		})
		return
	}

	// Para SSE no leemos el body (típicamente GET sin body).
	var body io.Reader
	var bodyBytes []byte
	if c.Request.Body != nil && (method == http.MethodPost || method == http.MethodPatch || method == http.MethodPut) {
		b, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Ok: false, Codigo: "VALIDACION", Mensaje: "No se pudo leer el cuerpo",
			})
			return
		}
		bodyBytes = b
		body = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), method, target, body)
	if err != nil {
		c.JSON(http.StatusBadGateway, models.ErrorResponse{
			Ok: false, Codigo: "PROXY_ERROR", Mensaje: "No se pudo construir la petición al middleware",
		})
		return
	}

	// Headers que pasamos hacia el middleware.
	req.Header.Set("Accept", c.GetHeader("Accept"))
	if req.Header.Get("Accept") == "" {
		req.Header.Set("Accept", "application/json")
	}
	if len(bodyBytes) > 0 {
		ct := c.GetHeader("Content-Type")
		if ct == "" {
			ct = "application/json"
		}
		req.Header.Set("Content-Type", ct)
	}
	req.Header.Set("X-API-Key", apiKey)
	req.Header.Set("X-Actor-Name", cl.NombreCompleto)
	req.Header.Set("X-Actor-Username", cl.Username)
	req.Header.Set("X-Actor-Id", cl.Username)
	req.Header.Set("X-Actor-Role", cl.Rol)
	if cl.Tenant != "" {
		req.Header.Set("X-Tenant", cl.Tenant)
	}
	// Identificador de origen útil para auditoría.
	req.Header.Set("X-Forwarded-By", "web-portal-api/admin")

	// Detectar SSE para hacer streaming en vez de buffer.
	wantsSSE := strings.Contains(strings.ToLower(req.Header.Get("Accept")), "text/event-stream")

	client := h.clienteHTTP(wantsSSE)
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, models.ErrorResponse{
			Ok: false, Codigo: "PROXY_ERROR",
			Mensaje: "No se pudo conectar con api-middleware",
		})
		return
	}
	defer resp.Body.Close()

	// Copiar cabeceras (sin hop-by-hop ni Content-Length para SSE).
	for k, vals := range resp.Header {
		if hopByHopHeaders[http.CanonicalHeaderKey(k)] {
			continue
		}
		if wantsSSE && strings.EqualFold(k, "Content-Length") {
			continue
		}
		for _, v := range vals {
			c.Header(k, v)
		}
	}
	c.Status(resp.StatusCode)

	if wantsSSE && resp.StatusCode == http.StatusOK {
		// Stream bidireccional: lee del middleware, escribe al cliente,
		// hace flush al final de cada bloque.
		streamRespuesta(c, resp.Body)
		return
	}

	if _, err := io.Copy(c.Writer, resp.Body); err != nil {
		// Si ya enviamos status, no podemos sobrescribir; sólo loguear.
		_ = err
	}
}

// streamRespuesta copia chunk-a-chunk del backend al cliente y fuerza
// flush. Termina cuando el backend cierra o el cliente desconecta
// (Request.Context().Done()).
func streamRespuesta(c *gin.Context, body io.Reader) {
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		// Sin flusher no podemos hacer SSE; copiamos en bloque.
		_, _ = io.Copy(c.Writer, body)
		return
	}
	// Forzar headers SSE básicos si el backend no los puso.
	if c.Writer.Header().Get("Content-Type") == "" {
		c.Header("Content-Type", "text/event-stream; charset=utf-8")
	}
	c.Header("Cache-Control", "no-cache, no-transform")
	c.Header("X-Accel-Buffering", "no")

	buf := make([]byte, 4096)
	for {
		select {
		case <-c.Request.Context().Done():
			return
		default:
		}
		n, err := body.Read(buf)
		if n > 0 {
			if _, werr := c.Writer.Write(buf[:n]); werr != nil {
				return
			}
			flusher.Flush()
		}
		if err != nil {
			return
		}
	}
}

func (h *AdminProxyHandler) clienteHTTP(streaming bool) *http.Client {
	if streaming {
		return &http.Client{Timeout: 0}
	}
	return &http.Client{Timeout: 30 * time.Second}
}

func esMutacion(metodo string) bool {
	switch strings.ToUpper(metodo) {
	case http.MethodPost, http.MethodPatch, http.MethodPut, http.MethodDelete:
		return true
	default:
		return false
	}
}
