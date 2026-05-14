package handlers

import (
	"encoding/json"
	"strings"

	"api-middleware/pkg/models"

	"github.com/gin-gonic/gin"
)

func quierePayloadRaw(c *gin.Context) bool {
	if c == nil {
		return false
	}
	return c.Query("incluirPayloadRaw") == "1" || strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Debug-Payload")), "1")
}

// respuestaLecturaFabric decodifica bytes del peer: `datos` legible, `payloadDecodificado` solo si era JSON, `payloadRaw` opcional para depuración.
func respuestaLecturaFabric(c *gin.Context, raw []byte, mensaje string) models.RespuestaLectura {
	var datos interface{}
	var payloadDec interface{}
	if len(raw) == 0 {
		datos = nil
	} else if json.Unmarshal(raw, &datos) == nil {
		payloadDec = datos
	} else {
		datos = string(raw)
	}
	r := models.RespuestaLectura{
		Ok:                  true,
		Codigo:              "CONSULTA_EXITOSA",
		Mensaje:             mensaje,
		Datos:               datos,
		PayloadDecodificado: payloadDec,
	}
	if quierePayloadRaw(c) && len(raw) > 0 {
		r.PayloadRaw = string(raw)
	}
	return r
}

// respuestaLecturaTipada rellena payloadDecodificado igual que datos cuando ya están tipados desde el ledger.
func respuestaLecturaTipada(c *gin.Context, codigo, mensaje string, datos interface{}, raw []byte) models.RespuestaLectura {
	r := models.RespuestaLectura{
		Ok:                  true,
		Codigo:              codigo,
		Mensaje:             mensaje,
		Datos:               datos,
		PayloadDecodificado: datos,
	}
	if quierePayloadRaw(c) && len(raw) > 0 {
		r.PayloadRaw = string(raw)
	}
	return r
}
