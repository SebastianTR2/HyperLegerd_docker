package notificador

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"api-middleware/internal/tenants"
)

// CanalWebhook entrega notificaciones por HTTP POST en formato JSON.
// El cuerpo enviado es exactamente el EventoNotificacion serializado.
type CanalWebhook struct {
	cliente *http.Client
}

// NuevoCanalWebhook crea el canal con un cliente HTTP con timeout.
func NuevoCanalWebhook() *CanalWebhook {
	return &CanalWebhook{
		cliente: &http.Client{Timeout: 6 * time.Second},
	}
}

// Nombre identifica el canal.
func (*CanalWebhook) Nombre() string { return "webhook" }

// Entregar emite el POST al URL del destino.
func (c *CanalWebhook) Entregar(ctx context.Context, ev EventoNotificacion, dest tenants.DestinoNotificacion) error {
	if strings.TrimSpace(dest.URL) == "" {
		return errors.New("destino webhook sin url")
	}
	metodo := strings.ToUpper(strings.TrimSpace(dest.Metodo))
	if metodo == "" {
		metodo = http.MethodPost
	}
	cuerpo, err := json.Marshal(ev)
	if err != nil {
		return fmt.Errorf("serializar evento: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, metodo, dest.URL, bytes.NewReader(cuerpo))
	if err != nil {
		return fmt.Errorf("construir request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "api-middleware-notificador/1.0")
	if tok := strings.TrimSpace(dest.Token); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	resp, err := c.cliente.Do(req)
	if err != nil {
		return fmt.Errorf("POST %s: %w", dest.URL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	return fmt.Errorf("webhook %s respondió %d", dest.URL, resp.StatusCode)
}
