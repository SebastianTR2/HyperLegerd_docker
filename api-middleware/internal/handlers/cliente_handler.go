package handlers

import (
	"api-middleware/internal/fabric"
	"api-middleware/internal/middleware"
	"api-middleware/pkg/models"
	"encoding/json"
	"fmt"
	"net/mail"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

// RegistrarCliente maneja la creación de un nuevo asset de cliente en Fabric.
func RegistrarCliente(c *gin.Context) {
	var n models.Cliente
	if err := c.ShouldBindBodyWith(&n, binding.JSON); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}

	normalizado, err := validarRegistroCliente(n)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{
			Ok:      false,
			Codigo:  "VALIDACION",
			Mensaje: err.Error(),
		})
		return
	}
	n = normalizado

	// 1. Invocar el Chaincode (Fase 4)
	// Función: CreateAsset(clienteId, nombre, tipoDoc, numeroDoc, fechaAlta, estado, telefono, email, notas)
	chaincode := os.Getenv("CHAINCODE_NAME")
	if strings.TrimSpace(chaincode) == "" {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "CONFIGURACION",
			Mensaje: "No se encontró CHAINCODE_NAME en variables de entorno",
		})
		return
	}

	result, err := fabric.InvokeTransactionWithTxID(chaincode, "CreateAsset",
		n.ClienteId, n.Nombre, n.TipoDocumento, n.NumeroDocumento,
		n.FechaAlta, n.Estado, n.Telefono, n.Email, n.Notas,
	)

	if err != nil {
		if esErrorClienteExistente(err) {
			c.JSON(http.StatusConflict, models.RespuestaError{
				Ok:      false,
				Codigo:  "CLIENTE_EXISTENTE",
				Mensaje: "El código de cliente ya está en uso",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al registrar en Blockchain: " + err.Error(),
		})
		return
	}

	// 2. Responder con el éxito
	c.JSON(http.StatusCreated, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    result.TxID,
		Mensaje: "Cliente registrado correctamente en la Blockchain",
	})
}

// ListarClientes devuelve todos los assets cliente_cc (GetAllAssets).
func ListarClientes(c *gin.Context) {
	chaincode := strings.TrimSpace(os.Getenv("CHAINCODE_NAME"))
	if chaincode == "" {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "CONFIGURACION",
			Mensaje: "No se encontró CHAINCODE_NAME en variables de entorno",
		})
		return
	}
	raw, err := fabric.EvaluateTransaction(chaincode, "GetAllAssets")
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al listar clientes: " + err.Error(),
		})
		return
	}
	clientes, err := decodeListaClientes(raw)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FORMATO",
			Mensaje: "No se pudo interpretar la lista: " + err.Error(),
		})
		return
	}
	if clientes == nil {
		clientes = []models.Cliente{}
	}
	c.JSON(http.StatusOK, respuestaLecturaTipada(c, "CONSULTA_EXITOSA", "Listado de clientes registrados", clientes, raw))
}

// ConsultarCliente obtiene los datos de un cliente desde el ledger.
func ConsultarCliente(c *gin.Context) {
	clienteId := strings.TrimSpace(c.Param("clienteId"))
	chaincode := strings.TrimSpace(os.Getenv("CHAINCODE_NAME"))
	if chaincode == "" {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "CONFIGURACION",
			Mensaje: "No se encontró CHAINCODE_NAME en variables de entorno",
		})
		return
	}

	// 1. Evaluar el Chaincode (Consulta)
	result, err := fabric.EvaluateTransaction(chaincode, "ReadAsset", clienteId)
	if err != nil {
		if esErrorNoEncontrado(err) {
			c.JSON(http.StatusNotFound, models.RespuestaError{
				Ok:      false,
				Codigo:  "NO_ENCONTRADO",
				Mensaje: "Cliente no encontrado en la Blockchain",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error interno al consultar cliente en Blockchain",
		})
		return
	}

	// 2. Parsear el resultado JSON del Chaincode
	var cliente models.Cliente
	if err := json.Unmarshal(result, &cliente); err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FORMATO",
			Mensaje: "Error al interpretar los datos de la Blockchain",
		})
		return
	}

	c.JSON(http.StatusOK, respuestaLecturaTipada(c, "CONSULTA_EXITOSA", "Cliente consultado correctamente", cliente, result))
}

// ActualizarCliente aplica cambios parciales conservando clienteId y fechaAlta del ledger.
func ActualizarCliente(c *gin.Context) {
	clienteId := strings.TrimSpace(c.Param("clienteId"))
	if clienteId == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "clienteId es obligatorio"})
		return
	}
	chaincode := strings.TrimSpace(os.Getenv("CHAINCODE_NAME"))
	if chaincode == "" {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{Ok: false, Codigo: "CONFIGURACION", Mensaje: "No se encontró CHAINCODE_NAME en variables de entorno"})
		return
	}

	raw, err := fabric.EvaluateTransaction(chaincode, "ReadAsset", clienteId)
	if err != nil {
		if esErrorNoEncontrado(err) {
			c.JSON(http.StatusNotFound, models.RespuestaError{Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Cliente no encontrado en la Blockchain"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{Ok: false, Codigo: "ERROR_FABRIC", Mensaje: "Error al leer cliente: " + err.Error()})
		return
	}
	var actual models.Cliente
	if err := json.Unmarshal(raw, &actual); err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{Ok: false, Codigo: "ERROR_FORMATO", Mensaje: "Error al interpretar los datos del cliente"})
		return
	}
	if strings.ToUpper(strings.TrimSpace(actual.Estado)) == "DADO_DE_BAJA" {
		c.JSON(http.StatusConflict, models.RespuestaError{Ok: false, Codigo: "CLIENTE_NO_EDITABLE", Mensaje: "El cliente fue dado de baja y no admite modificaciones"})
		return
	}

	var patch models.ClientePatch
	if err := c.ShouldBindJSON(&patch); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}
	if err := validarPatchNoVacio(patch); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}

	merged, err := mergeClientePatch(actual, patch)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}
	normalizado, err := normalizarClienteDominio(merged, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}

	result, err := fabric.InvokeTransactionWithTxID(chaincode, "UpdateAsset",
		normalizado.ClienteId, normalizado.Nombre, normalizado.TipoDocumento, normalizado.NumeroDocumento,
		normalizado.FechaAlta, normalizado.Estado, normalizado.Telefono, normalizado.Email, normalizado.Notas,
	)
	if err != nil {
		if strings.Contains(err.Error(), "CLIENTE_NO_EDITABLE") {
			c.JSON(http.StatusConflict, models.RespuestaError{Ok: false, Codigo: "CLIENTE_NO_EDITABLE", Mensaje: "El cliente fue dado de baja y no admite modificaciones"})
			return
		}
		if strings.Contains(err.Error(), "CLIENTE_BAJA_VIA_ENDPOINT") {
			c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "CLIENTE_BAJA_VIA_ENDPOINT", Mensaje: "Para dar de baja use POST /clientes/{clienteId}/baja"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{Ok: false, Codigo: "ERROR_FABRIC", Mensaje: "Error al actualizar en Blockchain: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    result.TxID,
		Mensaje: "Cliente actualizado correctamente",
	})
}

// marcaBajaLogicaNotas identifica en notas una baja aplicada vía API (UpdateAsset), p. ej. cuando el estado queda INACTIVO.
const marcaBajaLogicaNotas = "[baja-logica-api]"

// DarBajaCliente aplica baja lógica vía UpdateAsset (mismo camino que PATCH), sin DeleteAsset ni BajaCliente en chaincode.
func DarBajaCliente(c *gin.Context) {
	clienteId := strings.TrimSpace(c.Param("clienteId"))
	if clienteId == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "clienteId es obligatorio"})
		return
	}
	chaincode := strings.TrimSpace(os.Getenv("CHAINCODE_NAME"))
	if chaincode == "" {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{Ok: false, Codigo: "CONFIGURACION", Mensaje: "No se encontró CHAINCODE_NAME en variables de entorno"})
		return
	}

	raw, err := fabric.EvaluateTransaction(chaincode, "ReadAsset", clienteId)
	if err != nil {
		if esErrorNoEncontrado(err) {
			c.JSON(http.StatusNotFound, models.RespuestaError{Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Cliente no encontrado en la Blockchain"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{Ok: false, Codigo: "ERROR_FABRIC", Mensaje: "Error al leer cliente: " + err.Error()})
		return
	}
	var actual models.Cliente
	if err := json.Unmarshal(raw, &actual); err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{Ok: false, Codigo: "ERROR_FORMATO", Mensaje: "Error al interpretar los datos del cliente"})
		return
	}

	est := strings.ToUpper(strings.TrimSpace(actual.Estado))
	if est == "DADO_DE_BAJA" {
		c.JSON(http.StatusConflict, models.RespuestaError{Ok: false, Codigo: "CLIENTE_YA_DADO_DE_BAJA", Mensaje: "El cliente ya fue dado de baja"})
		return
	}
	if est == "INACTIVO" && strings.Contains(actual.Notas, marcaBajaLogicaNotas) {
		c.JSON(http.StatusConflict, models.RespuestaError{Ok: false, Codigo: "CLIENTE_YA_DADO_DE_BAJA", Mensaje: "El cliente ya fue dado de baja"})
		return
	}

	roleStr := rolOperacionDesdeContexto(c)
	audit := fmt.Sprintf("%s [%s] Baja lógica registrada (rol operación: %s)", marcaBajaLogicaNotas, time.Now().UTC().Format(time.RFC3339), roleStr)
	notas := strings.TrimSpace(actual.Notas)
	if notas != "" {
		notas = notas + "\n" + audit
	} else {
		notas = audit
	}

	invokeUpdate := func(estado string) (*fabric.SubmitResult, error) {
		return fabric.InvokeTransactionWithTxID(chaincode, "UpdateAsset",
			actual.ClienteId, actual.Nombre, actual.TipoDocumento, actual.NumeroDocumento,
			actual.FechaAlta, estado, actual.Telefono, actual.Email, notas,
		)
	}

	result, err := invokeUpdate("DADO_DE_BAJA")
	if err != nil && esErrorUpdateRechazaDadoDeBaja(err) {
		result, err = invokeUpdate("INACTIVO")
	}
	if err != nil {
		if strings.Contains(err.Error(), "CLIENTE_NO_EDITABLE") {
			c.JSON(http.StatusConflict, models.RespuestaError{Ok: false, Codigo: "CLIENTE_NO_EDITABLE", Mensaje: "El cliente fue dado de baja y no admite modificaciones"})
			return
		}
		if esErrorNoEncontrado(err) {
			c.JSON(http.StatusNotFound, models.RespuestaError{Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Cliente no encontrado en la Blockchain"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{Ok: false, Codigo: "ERROR_FABRIC", Mensaje: "Error al registrar la baja en Blockchain: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    result.TxID,
		Mensaje: "Cliente dado de baja correctamente",
	})
}

func esErrorUpdateRechazaDadoDeBaja(err error) bool {
	if err == nil {
		return false
	}
	s := strings.ToLower(err.Error())
	return strings.Contains(s, "cliente_baja_via_endpoint") ||
		strings.Contains(s, "solo se aplica mediante la operación de baja lógica")
}

func rolOperacionDesdeContexto(c *gin.Context) string {
	if v, ok := c.Get(middleware.ContextAPIRole); ok {
		if s, ok2 := v.(string); ok2 && strings.TrimSpace(s) != "" {
			return s
		}
	}
	return "desconocido"
}

func esErrorClienteExistente(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return strings.Contains(s, "CLIENTE_EXISTENTE") || strings.Contains(strings.ToLower(s), "already exists")
}

func validarPatchNoVacio(p models.ClientePatch) error {
	if p.Nombre == nil && p.TipoDocumento == nil && p.NumeroDocumento == nil && p.Telefono == nil && p.Email == nil && p.Notas == nil && p.Estado == nil {
		return fmt.Errorf("debe enviar al menos un campo a actualizar")
	}
	return nil
}

func mergeClientePatch(actual models.Cliente, p models.ClientePatch) (models.Cliente, error) {
	out := actual
	if p.Nombre != nil {
		out.Nombre = strings.TrimSpace(*p.Nombre)
	}
	if p.TipoDocumento != nil {
		out.TipoDocumento = strings.TrimSpace(*p.TipoDocumento)
	}
	if p.NumeroDocumento != nil {
		out.NumeroDocumento = strings.TrimSpace(*p.NumeroDocumento)
	}
	if p.Telefono != nil {
		out.Telefono = strings.TrimSpace(*p.Telefono)
	}
	if p.Email != nil {
		out.Email = strings.TrimSpace(*p.Email)
	}
	if p.Notas != nil {
		out.Notas = *p.Notas
	}
	if p.Estado != nil {
		es := strings.ToUpper(strings.TrimSpace(*p.Estado))
		if es == "DADO_DE_BAJA" {
			return out, fmt.Errorf("para dar de baja use el endpoint POST /clientes/{clienteId}/baja")
		}
		out.Estado = es
	}
	return out, nil
}

// normalizarClienteDominio valida y devuelve una copia con tipoDocumento y estado normalizados.
func normalizarClienteDominio(cli models.Cliente, isAlta bool) (models.Cliente, error) {
	out := cli
	if isAlta && strings.TrimSpace(out.ClienteId) == "" {
		return out, fmt.Errorf("clienteId es obligatorio")
	}
	if strings.TrimSpace(out.Nombre) == "" {
		return out, fmt.Errorf("nombre es obligatorio")
	}
	if strings.TrimSpace(out.NumeroDocumento) == "" {
		return out, fmt.Errorf("numeroDocumento es obligatorio")
	}
	t := strings.ToUpper(strings.TrimSpace(out.TipoDocumento))
	if t != "CI" && t != "NIT" && t != "PASAPORTE" {
		return out, fmt.Errorf("tipoDocumento debe ser CI, NIT o PASAPORTE")
	}
	out.TipoDocumento = t

	e := strings.ToUpper(strings.TrimSpace(out.Estado))
	if e != "ACTIVO" && e != "INACTIVO" {
		return out, fmt.Errorf("estado debe ser ACTIVO o INACTIVO")
	}
	out.Estado = e

	if isAlta {
		if strings.TrimSpace(out.FechaAlta) == "" {
			return out, fmt.Errorf("fechaAlta es obligatoria")
		}
		if _, err := time.Parse("2006-01-02", out.FechaAlta); err != nil {
			return out, fmt.Errorf("fechaAlta debe tener formato YYYY-MM-DD")
		}
	} else {
		if _, err := time.Parse("2006-01-02", out.FechaAlta); err != nil {
			return out, fmt.Errorf("fechaAlta del registro es inválida")
		}
	}

	if strings.TrimSpace(out.Email) != "" {
		if _, err := mail.ParseAddress(out.Email); err != nil {
			return out, fmt.Errorf("email inválido")
		}
	}
	return out, nil
}

func validarRegistroCliente(cliente models.Cliente) (models.Cliente, error) {
	if strings.TrimSpace(cliente.ClienteId) == "" {
		return cliente, fmt.Errorf("clienteId es obligatorio")
	}
	return normalizarClienteDominio(cliente, true)
}

func esErrorNoEncontrado(err error) bool {
	m := strings.ToLower(err.Error())
	return strings.Contains(m, "does not exist") ||
		strings.Contains(m, "not found") ||
		strings.Contains(m, "no existe") ||
		strings.Contains(m, "cannot read world state pair with key")
}

// ConsultarHistorialCliente obtiene el historial de modificaciones de un cliente.
func ConsultarHistorialCliente(c *gin.Context) {
	clienteId := strings.TrimSpace(c.Param("clienteId"))
	chaincode := strings.TrimSpace(os.Getenv("CHAINCODE_NAME"))
	if chaincode == "" {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "CONFIGURACION",
			Mensaje: "No se encontró CHAINCODE_NAME en variables de entorno",
		})
		return
	}

	result, err := fabric.EvaluateTransaction(chaincode, "GetAssetHistory", clienteId)
	if err != nil {
		if esErrorNoEncontrado(err) {
			c.JSON(http.StatusNotFound, models.RespuestaError{
				Ok:      false,
				Codigo:  "NO_ENCONTRADO",
				Mensaje: "Historial no encontrado para el cliente en la Blockchain",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error interno al consultar historial del cliente: " + err.Error(),
		})
		return
	}

	var operaciones []models.RegistroHistorialCliente
	if err := json.Unmarshal(result, &operaciones); err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FORMATO",
			Mensaje: "Error al interpretar el historial de la Blockchain",
		})
		return
	}

	c.JSON(http.StatusOK, models.HistorialCliente{
		ClienteId:   clienteId,
		Operaciones: operaciones,
	})
}
