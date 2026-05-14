package handlers

import (
	"api-middleware/internal/fabric"
	"api-middleware/pkg/models"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

// ListarCuentasToken lista cuentas token visibles desde chaincode.
func ListarCuentasToken(c *gin.Context) {
	cc, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}
	raw, err := fabric.EvaluateTransaction(cc, "ListarCuentasToken")
	if err != nil {
		log.Printf("[GET /tokens/cuentas] EvaluateTransaction ListarCuentasToken falló: %v", err)
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: err.Error(),
		})
		return
	}
	log.Printf("[GET /tokens/cuentas] payload Fabric: len=%d muestra=%s", len(raw), truncateRunes(string(raw), 700))

	datos, decErr := decodeListaCuentasToken(raw, cc)
	if decErr != nil {
		log.Printf("[GET /tokens/cuentas] decodeListaCuentasToken: %v | payload_completo=%s", decErr, string(raw))
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FORMATO",
			Mensaje: "No se pudo interpretar la lista del chaincode: " + decErr.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, respuestaLecturaTipada(c, "CONSULTA_EXITOSA", "Listado de cuentas token visibles", datos, raw))
}

// CrearCuentaTokenVisible registra una nueva cuenta visible en ledger.
func CrearCuentaTokenVisible(c *gin.Context) {
	var body models.CrearCuentaTokenBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}
	cc, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}
	res, err := fabric.InvokeTransactionWithTxID(cc, "CrearCuentaToken", strings.TrimSpace(body.Alias))
	if err != nil {
		responderErrorFabricCuentaToken(c, err)
		return
	}
	c.JSON(http.StatusCreated, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    res.TxID,
		Mensaje: "Cuenta token visible creada en la red",
	})
}

// ObtenerCuentaTokenVisible devuelve una cuenta visible.
func ObtenerCuentaTokenVisible(c *gin.Context) {
	alias := strings.TrimSpace(c.Param("alias"))
	cc, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}
	raw, err := fabric.EvaluateTransaction(cc, "ObtenerCuentaToken", alias)
	if err != nil {
		if strings.Contains(err.Error(), "La cuenta token no existe") {
			c.JSON(http.StatusNotFound, models.RespuestaError{
				Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "La cuenta token no existe.",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok: false, Codigo: "ERROR_FABRIC", Mensaje: err.Error(),
		})
		return
	}
	var v models.CuentaTokenVista
	if err := json.Unmarshal(raw, &v); err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok: false, Codigo: "ERROR_FORMATO", Mensaje: err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, respuestaLecturaTipada(c, "CONSULTA_EXITOSA", "Cuenta encontrada", v, raw))
}

// ConsultarSaldoCuentaTokenVisible consulta solo el saldo numérico.
func ConsultarSaldoCuentaTokenVisible(c *gin.Context) {
	alias := strings.TrimSpace(c.Param("alias"))
	codigo := strings.TrimSpace(c.Query("codigoToken"))
	tokenCodeDefault := strings.TrimSpace(os.Getenv("TOKEN_CODE"))
	if tokenCodeDefault == "" {
		tokenCodeDefault = "TOK"
	}
	if codigo != "" && !strings.EqualFold(codigo, tokenCodeDefault) {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok: false, Codigo: "TOKEN_NO_SOPORTADO",
			Mensaje: fmt.Sprintf("Use codigoToken=%s alineado al proyecto (o omita la query)", tokenCodeDefault),
		})
		return
	}

	cc, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}
	raw, err := fabric.EvaluateTransaction(cc, "ConsultarSaldoCuentaToken", alias)
	if err != nil {
		if strings.Contains(err.Error(), "La cuenta token no existe") {
			c.JSON(http.StatusNotFound, models.RespuestaError{
				Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "La cuenta token no existe.",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok: false, Codigo: "ERROR_FABRIC", Mensaje: err.Error(),
		})
		return
	}
	var saldo int64
	if err := json.Unmarshal(raw, &saldo); err != nil {
		// algunos peers devuelven el entero como número JSON float
		var f float64
		if err2 := json.Unmarshal(raw, &f); err2 == nil {
			saldo = int64(f)
		} else {
			c.JSON(http.StatusInternalServerError, models.RespuestaError{
				Ok: false, Codigo: "ERROR_FORMATO", Mensaje: "Saldo ilegible: " + string(raw),
			})
			return
		}
	}
	saldoResp := models.SaldoToken{
		ClienteId:   alias,
		CodigoToken: tokenCodeDefault,
		Saldo:       saldo,
	}
	c.JSON(http.StatusOK, respuestaLecturaTipada(c, "CONSULTA_EXITOSA", "Saldo de cuenta visible", saldoResp, raw))
}

// EmitirACuentaTokenVisible emite tokens hacia una cuenta visible (Mint + transfer interno).
func EmitirACuentaTokenVisible(c *gin.Context) {
	var body models.EmitirCuentaTokenBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}
	cc, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}
	res, err := fabric.InvokeTransactionWithTxID(cc, "EmitirACuentaToken",
		strings.TrimSpace(body.Destinatario),
		strconv.FormatInt(body.Monto, 10),
		strings.TrimSpace(body.CodigoToken),
	)
	if err != nil {
		responderErrorFabricCuentaToken(c, err)
		return
	}
	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    res.TxID,
		Mensaje: "Emisión a cuenta token visible confirmada",
	})
}

// TransferirEntreCuentasTokenVisible transfiere entre cuentas visibles en ledger.
func TransferirEntreCuentasTokenVisible(c *gin.Context) {
	var body models.TransferirCuentaTokenBody
	if err := c.ShouldBindBodyWith(&body, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}
	cc, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}
	res, err := fabric.InvokeTransactionWithTxID(cc, "TransferirEntreCuentasToken",
		strings.TrimSpace(body.Origen),
		strings.TrimSpace(body.Destino),
		strconv.FormatInt(body.Monto, 10),
		strings.TrimSpace(body.CodigoToken),
	)
	if err != nil {
		responderErrorFabricCuentaToken(c, err)
		return
	}
	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    res.TxID,
		Mensaje: "Transferencia entre cuentas visibles confirmada",
	})
}

func responderErrorFabricCuentaToken(c *gin.Context, err error) {
	msgCore := mensajeDetalleFabric(err)
	if strings.TrimSpace(msgCore) == "" {
		msgCore = err.Error()
	}
	msg := msgCore
	lower := strings.ToLower(msg)
	switch {
	case strings.Contains(msg, "La cuenta token no existe"):
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok: false, Codigo: "CUENTA_TOKEN_INEXISTENTE", Mensaje: "La cuenta token no existe.",
		})
	case strings.Contains(msg, "La cuenta token origen no existe"):
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok: false, Codigo: "ORIGEN_INEXISTENTE", Mensaje: "La cuenta token origen no existe.",
		})
	case strings.Contains(msg, "La cuenta token destino no existe"):
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok: false, Codigo: "DESTINO_INEXISTENTE", Mensaje: "La cuenta token destino no existe.",
		})
	case strings.Contains(msg, "Saldo insuficiente"):
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok: false, Codigo: "SALDO_INSUFICIENTE", Mensaje: extraerMensajeCadena(msg),
		})
	case strings.Contains(msg, "ya existe"):
		c.JSON(http.StatusConflict, models.RespuestaError{
			Ok: false, Codigo: "CUENTA_DUPLICADA", Mensaje: extraerMensajeCadena(msg),
		})
	case strings.Contains(lower, "solo org1msp"):
		c.JSON(http.StatusForbidden, models.RespuestaError{
			Ok: false, Codigo: "FABRIC_NO_AUTORIZADO", Mensaje: msg,
		})
	case strings.Contains(lower, "debe inicializ"), strings.Contains(lower, "no está inicializado"):
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok: false, Codigo: "CONTRATO_NO_INICIALIZADO", Mensaje: msg,
		})
	case strings.Contains(lower, "alias inválido"):
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok: false, Codigo: "ALIAS_INVALIDO", Mensaje: msg,
		})
	default:
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok: false, Codigo: "ERROR_FABRIC", Mensaje: msg,
		})
	}
}

func extraerMensajeCadena(msg string) string {
	msg = strings.TrimSpace(msg)
	if i := strings.Index(msg, ":"); i >= 0 && i < len(msg)-1 {
		rest := strings.TrimSpace(msg[i+1:])
		if rest != "" {
			return rest
		}
	}
	return msg
}
