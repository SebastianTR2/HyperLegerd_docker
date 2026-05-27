package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"api-middleware/internal/middleware"
	"api-middleware/internal/notificador"
	"api-middleware/pkg/models"

	"github.com/gin-gonic/gin"
)

// StreamNotificacionesAdmin (GET /admin/notificaciones/stream)
// Expone vía Server-Sent Events las notificaciones del tenant en vivo. El
// tenant se deduce de la X-API-Key del solicitante; el filtrado por tenant
// lo aplica el broker al construir el cliente.
//
// Esta ruta debe quedar protegida con RequireAPIRoles(RoleAdmin) en routes.go.
func StreamNotificacionesAdmin(c *gin.Context) {
	if notificador.Default == nil || notificador.Default.BrokerSSE() == nil {
		c.JSON(http.StatusServiceUnavailable, models.RespuestaError{
			Ok:      false,
			Codigo:  "SERVICIO_NO_DISPONIBLE",
			Mensaje: "el notificador no está inicializado",
		})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Transfer-Encoding", "chunked")

	tenant := middleware.TenantFromContext(c)
	broker := notificador.Default.BrokerSSE()
	cliente := broker.AgregarCliente(tenant)
	defer broker.QuitarCliente(cliente)

	c.Writer.Write([]byte("event: status\ndata: Conectado al stream de notificaciones admin\n\n"))
	c.Writer.Flush()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	c.Stream(func(w io.Writer) bool {
		select {
		case <-c.Request.Context().Done():
			return false
		case <-ticker.C:
			c.Writer.Write([]byte(":\n\n"))
			c.Writer.Flush()
			return true
		case ev, ok := <-cliente.Canal:
			if !ok {
				return false
			}
			data, err := json.Marshal(ev)
			if err != nil {
				return true
			}
			c.Writer.Write([]byte("event: notificacion\ndata: "))
			c.Writer.Write(data)
			c.Writer.Write([]byte("\n\n"))
			c.Writer.Flush()
			return true
		}
	})
}

// HistorialNotificacionesAdmin (GET /admin/notificaciones)
// Devuelve el histórico reciente de notificaciones para el tenant del solicitante.
func HistorialNotificacionesAdmin(c *gin.Context) {
	if notificador.Default == nil || notificador.Default.BrokerSSE() == nil {
		c.JSON(http.StatusOK, gin.H{"ok": true, "tenant": "", "total": 0, "items": []any{}})
		return
	}
	tenant := middleware.TenantFromContext(c)
	items := notificador.Default.BrokerSSE().HistorialPorTenant(tenant)
	c.JSON(http.StatusOK, gin.H{
		"ok":     true,
		"tenant": tenant,
		"total":  len(items),
		"items":  items,
	})
}
