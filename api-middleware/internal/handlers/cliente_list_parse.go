package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"api-middleware/pkg/models"
)

func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max]) + "…"
}

// decodeListaClientes interpreta la salida de GetAllAssets ante distintos formatos
// (array directo, JSON dentro de string, envoltorio con claves, QueryResult[], objeto único).
func decodeListaClientes(raw []byte) ([]models.Cliente, error) {
	return decodeListaClientesDepth(raw, 0)
}

func decodeListaClientesDepth(raw []byte, depth int) ([]models.Cliente, error) {
	if depth > 6 {
		return nil, fmt.Errorf("anidación JSON excesiva")
	}
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return []models.Cliente{}, nil
	}
	if bytes.HasPrefix(raw, []byte{0xEF, 0xBB, 0xBF}) {
		raw = raw[3:]
	}
	if string(raw) == "null" {
		return []models.Cliente{}, nil
	}

	var clientes []models.Cliente
	if err := json.Unmarshal(raw, &clientes); err == nil {
		if clientes == nil {
			return []models.Cliente{}, nil
		}
		return clientes, nil
	}

	var inner string
	if err := json.Unmarshal(raw, &inner); err == nil && strings.TrimSpace(inner) != "" {
		return decodeListaClientesDepth([]byte(strings.TrimSpace(inner)), depth+1)
	}

	type queryRow struct {
		Key    string          `json:"Key"`
		Record json.RawMessage `json:"Record"`
	}
	var rows []queryRow
	if err := json.Unmarshal(raw, &rows); err == nil && len(rows) > 0 {
		out := make([]models.Cliente, 0, len(rows))
		for _, row := range rows {
			if len(row.Record) == 0 {
				continue
			}
			var c models.Cliente
			if err := json.Unmarshal(row.Record, &c); err != nil {
				continue
			}
			if strings.TrimSpace(c.ClienteId) != "" {
				out = append(out, c)
			}
		}
		return out, nil
	}

	var one models.Cliente
	if err := json.Unmarshal(raw, &one); err == nil && strings.TrimSpace(one.ClienteId) != "" {
		return []models.Cliente{one}, nil
	}

	var wrap map[string]json.RawMessage
	if err := json.Unmarshal(raw, &wrap); err == nil {
		for _, key := range []string{"datos", "assets", "items", "clientes", "records", "data", "result"} {
			if rm, ok := wrap[key]; ok && len(rm) > 0 {
				decoded, err := decodeListaClientesDepth(rm, depth+1)
				if err == nil {
					return decoded, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("formato no reconocido (muestra): %s", truncateRunes(string(raw), 240))
}
