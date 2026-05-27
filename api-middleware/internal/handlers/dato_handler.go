package handlers

// Handler genérico para el chaincode dato_cc. Está pensado para empresas
// externas (p. ej. Agricultura) que necesitan persistir cualquier estructura
// JSON en su propio canal Fabric de forma inmutable.
//
// El tenant se deduce de la cabecera X-API-Key (ver middleware.XAPIKeyAuth).
// El canal y el chaincode se toman de la configuración del tenant
// (config/tenants.yaml).
//
// Modelo conceptual:
//   {
//     "datoId":   string,       // clave única (obligatoria)
//     "tipo":     string,       // categoría libre (p. ej. "parcela", "cosecha")
//     "payload":  object|array, // JSON libre de negocio
//     "fechaCreacion":      ISO-8601 (rellenado por el chaincode si vacío)
//     "fechaActualizacion": ISO-8601
//   }

import (
	"api-middleware/internal/fabric"
	"api-middleware/internal/middleware"
	"api-middleware/internal/notificador"
	"api-middleware/pkg/models"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type entradaDato struct {
	DatoID  string          `json:"datoId"`
	Tipo    string          `json:"tipo"`
	Payload json.RawMessage `json:"payload"`
}

func validarEntradaDato(e entradaDato) error {
	if strings.TrimSpace(e.DatoID) == "" {
		return errors.New("datoId es obligatorio")
	}
	if strings.TrimSpace(e.Tipo) == "" {
		return errors.New("tipo es obligatorio")
	}
	if len(e.Payload) == 0 {
		return errors.New("payload es obligatorio (objeto o arreglo JSON)")
	}
	if !json.Valid(e.Payload) {
		return errors.New("payload no es JSON válido")
	}
	return nil
}

// CrearDato registra un nuevo activo genérico (CreateDato) en el canal del tenant.
func CrearDato(c *gin.Context) {
	var in entradaDato
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "JSON inválido: " + err.Error()})
		return
	}
	if err := validarEntradaDato(in); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}
	tenantID := middleware.TenantFromContext(c)
	res, err := fabric.InvokeTransactionWithTxIDTenant(tenantID, "", "", "CreateDato",
		strings.TrimSpace(in.DatoID),
		strings.TrimSpace(in.Tipo),
		string(in.Payload),
	)
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	publicarNotificacion(c,
		notificador.EventoDatoCreado,
		strings.TrimSpace(in.DatoID),
		res.TxID,
		fmt.Sprintf("Dato %q (tipo=%s) registrado", strings.TrimSpace(in.DatoID), strings.TrimSpace(in.Tipo)),
	)

	c.JSON(http.StatusCreated, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    res.TxID,
		Mensaje: "Dato registrado correctamente en la Blockchain",
	})
}

// ListarDatos devuelve todos los datos del canal del tenant (GetAllDatos).
func ListarDatos(c *gin.Context) {
	tenantID := middleware.TenantFromContext(c)
	raw, err := fabric.EvaluateTransactionTenant(tenantID, "", "", "GetAllDatos")
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	c.JSON(http.StatusOK, respuestaLecturaFabric(c, raw, "Listado de datos del canal del tenant"))
}

// ConsultarDato obtiene un dato por su id (ReadDato).
func ConsultarDato(c *gin.Context) {
	id := strings.TrimSpace(c.Param("datoId"))
	if id == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "datoId vacío"})
		return
	}
	tenantID := middleware.TenantFromContext(c)
	raw, err := fabric.EvaluateTransactionTenant(tenantID, "", "", "ReadDato", id)
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	c.JSON(http.StatusOK, respuestaLecturaFabric(c, raw, "Dato consultado"))
}

// ActualizarDato modifica un dato existente (UpdateDato).
func ActualizarDato(c *gin.Context) {
	id := strings.TrimSpace(c.Param("datoId"))
	if id == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "datoId vacío"})
		return
	}
	var in entradaDato
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "JSON inválido: " + err.Error()})
		return
	}
	if in.DatoID == "" {
		in.DatoID = id
	}
	if in.DatoID != id {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "el datoId del path y el cuerpo no coinciden"})
		return
	}
	if err := validarEntradaDato(in); err != nil {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: err.Error()})
		return
	}
	tenantID := middleware.TenantFromContext(c)
	res, err := fabric.InvokeTransactionWithTxIDTenant(tenantID, "", "", "UpdateDato",
		id,
		strings.TrimSpace(in.Tipo),
		string(in.Payload),
	)
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	publicarNotificacion(c,
		notificador.EventoDatoEditado,
		id,
		res.TxID,
		fmt.Sprintf("Dato %q (tipo=%s) editado", id, strings.TrimSpace(in.Tipo)),
	)

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    res.TxID,
		Mensaje: "Dato actualizado correctamente",
	})
}

// EliminarDato borra un dato (DeleteDato). Solo admin del tenant.
func EliminarDato(c *gin.Context) {
	id := strings.TrimSpace(c.Param("datoId"))
	if id == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "datoId vacío"})
		return
	}
	tenantID := middleware.TenantFromContext(c)
	res, err := fabric.InvokeTransactionWithTxIDTenant(tenantID, "", "", "DeleteDato", id)
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	publicarNotificacion(c,
		notificador.EventoDatoEliminado,
		id,
		res.TxID,
		fmt.Sprintf("Dato %q eliminado del ledger", id),
	)

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    res.TxID,
		Mensaje: "Dato eliminado del ledger",
	})
}

// ConsultarHistorialDato devuelve el historial inmutable (GetDatoHistory → GetHistoryForKey).
func ConsultarHistorialDato(c *gin.Context) {
	id := strings.TrimSpace(c.Param("datoId"))
	if id == "" {
		c.JSON(http.StatusBadRequest, models.RespuestaError{Ok: false, Codigo: "VALIDACION", Mensaje: "datoId vacío"})
		return
	}
	tenantID := middleware.TenantFromContext(c)
	raw, err := fabric.EvaluateTransactionTenant(tenantID, "", "", "GetDatoHistory", id)
	if err != nil {
		st, cod, pub := clasificarErrorFabric(err)
		c.JSON(st, models.RespuestaError{Ok: false, Codigo: cod, Mensaje: pub})
		return
	}
	c.JSON(http.StatusOK, respuestaLecturaFabric(c, raw, "Historial inmutable del dato"))
}
