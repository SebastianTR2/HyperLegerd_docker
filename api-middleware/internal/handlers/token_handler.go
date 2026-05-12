package handlers

import (
	"api-middleware/internal/fabric"
	"api-middleware/pkg/models"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

// EmitirToken ejecuta Mint (fondos en cuenta del minter/gateway) y Transfer al destinatario.
// El contrato token_erc20 (sample) no usa codigoToken: hay un único activo; el campo se mantiene por contrato de API.
func EmitirToken(c *gin.Context) {
	var s models.EmitirToken
	if err := c.ShouldBindBodyWith(&s, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	if err := validarEmitirToken(s); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	chaincode, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}

	// 1) Mint al minter (identidad Admin del gateway en .env)
	mintRes, err := fabric.InvokeTransactionWithTxID(chaincode, "Mint", fmt.Sprintf("%d", s.Monto))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al acuñar fondos (Mint): " + err.Error(),
		})
		return
	}

	// 2) Transfer del minter al destinatario (recipient debe ser ClientAccountID / cuenta válida en el contrato)
	transRes, err := fabric.InvokeTransactionWithTxID(chaincode, "Transfer", strings.TrimSpace(s.Destinatario), fmt.Sprintf("%d", s.Monto))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: fmt.Sprintf("Mint confirmado (txId %s) pero falló Transfer al destinatario: %s", mintRes.TxID, err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:       true,
		TxId:     transRes.TxID,
		TxIdMint: mintRes.TxID,
		Mensaje:  "Tokens emitidos: Mint y Transfer confirmados en la red",
	})
}

// TransferirToken ejecuta Transfer: el origen en ledger es la identidad que firma (gateway), no el campo JSON `origen`.
func TransferirToken(c *gin.Context) {
	var s models.TransferirToken
	if err := c.ShouldBindBodyWith(&s, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	if err := validarTransferirToken(s); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	chaincode, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}

	origen := strings.TrimSpace(s.Origen)
	destino := strings.TrimSpace(s.Destino)

	// Regla de negocio del token_erc20: Transfer usa como origen la identidad firmante del gateway.
	// Si el origen enviado no coincide con esa cuenta, la transacción fallará por fondos/autorización.
	cuentaFirmante, err := obtenerCuentaFirmanteToken(chaincode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "No se pudo resolver la cuenta firmante del gateway para transferir tokens: " + err.Error(),
		})
		return
	}
	if origen != cuentaFirmante {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:     false,
			Codigo: "ORIGEN_NO_FIRMANTE",
			Mensaje: "En token_erc20 el origen real es la identidad firmante del gateway. " +
				"Use como origen la cuenta del gateway (ClientAccountID) o utilice otra operación de negocio.",
		})
		return
	}
	if destino == cuentaFirmante {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "DESTINO_INVALIDO",
			Mensaje: "El destino no puede ser la misma cuenta firmante/origen en una transferencia ERC-20",
		})
		return
	}

	transRes, err := fabric.InvokeTransactionWithTxID(
		chaincode,
		"Transfer",
		destino,
		fmt.Sprintf("%d", s.Monto),
	)
	if err != nil {
		msg := err.Error()
		msgLower := strings.ToLower(msg)
		if strings.Contains(msgLower, "insufficient funds") ||
			strings.Contains(msgLower, "cannot transfer to and from same client account") ||
			strings.Contains(msgLower, "has no balance") {
			c.JSON(http.StatusBadRequest, models.RespuestaError{
				Ok:      false,
				Codigo:  "TRANSFERENCIA_INVALIDA",
				Mensaje: "Transferencia no válida para token_erc20: " + msg,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al transferir tokens: " + msg,
		})
		return
	}

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:   true,
		TxId: transRes.TxID,
		Mensaje: "Transferencia realizada con éxito desde la identidad del gateway. " +
			"El contrato ERC-20 no usa el campo origen del JSON; el cargo es a la cuenta del firmante.",
	})
}

// ConsultarSaldo obtiene el balance usando 'BalanceOf'.
func ConsultarSaldo(c *gin.Context) {
	clienteId := strings.TrimSpace(c.Param("clienteId"))
	codigoToken := strings.TrimSpace(c.Query("codigoToken"))
	tokenCodeDefault := strings.TrimSpace(os.Getenv("TOKEN_CODE"))
	if tokenCodeDefault == "" {
		tokenCodeDefault = "TOK"
	}

	if codigoToken == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: "codigoToken es obligatorio en query",
		})
		return
	}

	// token_erc20 maneja un único token por contrato. Aceptamos solo el token configurado.
	if !strings.EqualFold(codigoToken, tokenCodeDefault) {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "TOKEN_NO_SOPORTADO",
			Mensaje: fmt.Sprintf("El contrato actual solo soporta codigoToken=%s", tokenCodeDefault),
		})
		return
	}

	chaincode, errResp := tokenChaincodeNombre()
	if errResp != nil {
		c.JSON(http.StatusInternalServerError, errResp)
		return
	}

	result, err := fabric.EvaluateTransaction(chaincode, "BalanceOf", clienteId)
	if err != nil {
		if esErrorNoEncontrado(err) {
			c.JSON(http.StatusNotFound, models.RespuestaError{
				Ok:      false,
				Codigo:  "NO_ENCONTRADO",
				Mensaje: "Cuenta de cliente no encontrada en el token",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error interno al consultar saldo en Blockchain",
		})
		return
	}

	var saldo int64
	if err := json.Unmarshal(result, &saldo); err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FORMATO",
			Mensaje: "Error al interpretar el saldo devuelto por Blockchain",
		})
		return
	}

	saldoResp := models.SaldoToken{
		ClienteId:   clienteId,
		CodigoToken: tokenCodeDefault,
		Saldo:       saldo,
	}

	c.JSON(http.StatusOK, models.RespuestaLectura{
		Ok:      true,
		Codigo:  "CONSULTA_EXITOSA",
		Mensaje: "Saldo consultado correctamente",
		Datos:   saldoResp,
	})
}

// ConsultarHistorial obtiene la lista de operaciones desde el ledger.
func ConsultarHistorial(c *gin.Context) {
	codigoToken := strings.TrimSpace(c.Query("codigoToken"))
	if codigoToken == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: "codigoToken es obligatorio en query",
		})
		return
	}

	c.JSON(http.StatusNotImplemented, models.RespuestaError{
		Ok:      false,
		Codigo:  "NO_IMPLEMENTADO_CHAINCODE",
		Mensaje: "El chaincode token_erc20 actual no expone una función GetHistory por cuenta. Endpoint reservado para una versión futura.",
	})
}

func tokenChaincodeNombre() (string, *models.RespuestaError) {
	n := strings.TrimSpace(os.Getenv("TOKEN_CHAINCODE_NAME"))
	if n == "" {
		return "", &models.RespuestaError{
			Ok:      false,
			Codigo:  "CONFIGURACION",
			Mensaje: "No se encontró TOKEN_CHAINCODE_NAME en variables de entorno",
		}
	}
	return n, nil
}

func validarEmitirToken(s models.EmitirToken) error {
	if strings.TrimSpace(s.Destinatario) == "" {
		return fmt.Errorf("destinatario es obligatorio")
	}
	if s.Monto <= 0 {
		return fmt.Errorf("monto debe ser mayor que cero")
	}
	if strings.TrimSpace(s.CodigoToken) == "" {
		return fmt.Errorf("codigoToken es obligatorio")
	}
	return nil
}

func validarTransferirToken(s models.TransferirToken) error {
	if strings.TrimSpace(s.Destino) == "" {
		return fmt.Errorf("destino es obligatorio")
	}
	if s.Monto <= 0 {
		return fmt.Errorf("monto debe ser mayor que cero")
	}
	if strings.TrimSpace(s.CodigoToken) == "" {
		return fmt.Errorf("codigoToken es obligatorio")
	}
	// origen es obligatorio en el JSON por compatibilidad de API; el contrato no lo usa (origen = identidad del gateway).
	if strings.TrimSpace(s.Origen) == "" {
		return fmt.Errorf("origen es obligatorio en la solicitud (informativo; el ledger usa la identidad del gateway)")
	}
	return nil
}

func obtenerCuentaFirmanteToken(chaincode string) (string, error) {
	raw, err := fabric.EvaluateTransaction(chaincode, "ClientAccountID")
	if err != nil {
		return "", err
	}
	return normalizarTextoFabric(raw), nil
}

func normalizarTextoFabric(raw []byte) string {
	texto := strings.TrimSpace(string(raw))
	var quoted string
	if err := json.Unmarshal(raw, &quoted); err == nil {
		return strings.TrimSpace(quoted)
	}
	return strings.Trim(texto, "\"")
}
