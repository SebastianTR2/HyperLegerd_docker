package bitacora

import (
	"encoding/json"
	"sync"
	"time"
)

const maxLineasAuditoria = 500

// LineaAuditoriaMemoria es una línea de bitácora retenida en RAM para consulta GET /auditoria/http.
type LineaAuditoriaMemoria struct {
	Prefijo    string          `json:"prefijo"`
	TipoFuente string          `json:"tipoFuente"`
	Registro   json.RawMessage `json:"registro"`
}

var (
	audMu    sync.RWMutex
	audLines []LineaAuditoriaMemoria
)

func tipoFuenteDesdePrefijo(prefijo string) string {
	switch prefijo {
	case "[BITACORA_SOLICITUD]", "[BITACORA_RESULTADO]":
		return "http_puente"
	case "[BITACORA_CHAINCODE]":
		return "chaincode"
	case "[BITACORA_EVENTO]":
		return "evento_cadena"
	case "[BITACORA_CONEXION]":
		return "conexion"
	default:
		return "otro"
	}
}

// RegistrarLineaAuditoriaMemoria guarda una copia JSON ya serializada (misma que stdout/archivo).
func RegistrarLineaAuditoriaMemoria(prefijo string, lineaJSON []byte) {
	if len(lineaJSON) == 0 {
		return
	}
	cp := append(json.RawMessage(nil), lineaJSON...)
	entry := LineaAuditoriaMemoria{
		Prefijo:    prefijo,
		TipoFuente: tipoFuenteDesdePrefijo(prefijo),
		Registro:   cp,
	}
	audMu.Lock()
	audLines = append(audLines, entry)
	if len(audLines) > maxLineasAuditoria {
		audLines = audLines[len(audLines)-maxLineasAuditoria:]
	}
	audMu.Unlock()
}

// ObtenerLineasAuditoriaMemoria devuelve las últimas líneas más recientes primero, con filtro opcional por timestamp del registro (campo JSON `timestamp` RFC3339).
func ObtenerLineasAuditoriaMemoria(limite int, desde, hasta *time.Time) []LineaAuditoriaMemoria {
	if limite <= 0 {
		limite = 100
	}
	if limite > maxLineasAuditoria {
		limite = maxLineasAuditoria
	}
	audMu.RLock()
	defer audMu.RUnlock()
	out := make([]LineaAuditoriaMemoria, 0, limite)
	for i := len(audLines) - 1; i >= 0 && len(out) < limite; i-- {
		e := audLines[i]
		if !pasaFiltroTiempo(e.Registro, desde, hasta) {
			continue
		}
		out = append(out, e)
	}
	return out
}

func pasaFiltroTiempo(reg json.RawMessage, desde, hasta *time.Time) bool {
	if desde == nil && hasta == nil {
		return true
	}
	var aux struct {
		Timestamp time.Time `json:"timestamp"`
	}
	if err := json.Unmarshal(reg, &aux); err != nil || aux.Timestamp.IsZero() {
		return true
	}
	t := aux.Timestamp.UTC()
	if desde != nil && t.Before(desde.UTC()) {
		return false
	}
	if hasta != nil && t.After(hasta.UTC()) {
		return false
	}
	return true
}
