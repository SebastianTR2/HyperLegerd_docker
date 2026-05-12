package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"api-middleware/internal/fabric"
	"api-middleware/pkg/models"
)

func decodeListaCuentasToken(raw []byte, ccNombre string) ([]models.CuentaTokenVista, error) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return []models.CuentaTokenVista{}, nil
	}

	var ptrs []*models.CuentaTokenVista
	if err := json.Unmarshal(raw, &ptrs); err == nil {
		return normalizarVistasDesdePtrs(ptrs), nil
	}

	var vals []models.CuentaTokenVista
	if err := json.Unmarshal(raw, &vals); err == nil {
		return normalizarVistasSlice(vals), nil
	}

	var inner string
	if err := json.Unmarshal(raw, &inner); err == nil && strings.TrimSpace(inner) != "" {
		return decodeListaCuentasToken([]byte(strings.TrimSpace(inner)), ccNombre)
	}

	var aliases []string
	if err := json.Unmarshal(raw, &aliases); err == nil && len(aliases) > 0 {
		return materializarCuentasPorAliases(ccNombre, aliases)
	}

	return nil, fmt.Errorf("JSON no reconocido como lista de cuentas token visibles")
}

func defaultCodigoTokenAPI() string {
	t := strings.TrimSpace(os.Getenv("TOKEN_CODE"))
	if t != "" {
		return t
	}
	return "TOK001"
}

func normalizarUnaVista(v *models.CuentaTokenVista) {
	if strings.TrimSpace(v.CodigoToken) == "" {
		v.CodigoToken = defaultCodigoTokenAPI()
	}
}

func normalizarVistasDesdePtrs(in []*models.CuentaTokenVista) []models.CuentaTokenVista {
	out := make([]models.CuentaTokenVista, 0, len(in))
	for _, p := range in {
		if p == nil {
			continue
		}
		v := *p
		normalizarUnaVista(&v)
		out = append(out, v)
	}
	return out
}

func normalizarVistasSlice(vals []models.CuentaTokenVista) []models.CuentaTokenVista {
	out := make([]models.CuentaTokenVista, 0, len(vals))
	for i := range vals {
		v := vals[i]
		normalizarUnaVista(&v)
		out = append(out, v)
	}
	return out
}

func materializarCuentasPorAliases(ccNombre string, aliases []string) ([]models.CuentaTokenVista, error) {
	out := make([]models.CuentaTokenVista, 0, len(aliases))
	for _, a := range aliases {
		a = strings.TrimSpace(a)
		if a == "" {
			continue
		}
		raw, err := fabric.EvaluateTransaction(ccNombre, "ObtenerCuentaToken", a)
		if err != nil {
			log.Printf("[decodeListaCuentasToken] ObtenerCuentaToken(%q): %v", a, err)
			continue
		}
		var v models.CuentaTokenVista
		if err := json.Unmarshal(raw, &v); err != nil {
			log.Printf("[decodeListaCuentasToken] JSON cuenta %q: %v", a, err)
			continue
		}
		normalizarUnaVista(&v)
		out = append(out, v)
	}
	return out, nil
}
