package handlers

import (
	"api-middleware/internal/fabric"
	"api-middleware/internal/middleware"
	"api-middleware/internal/notificador"
	"api-middleware/pkg/models"
	"encoding/json"
	"fmt"
	"net/mail"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"encoding/base64"
	"crypto/sha256"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

// encodeField codifica un string en Base64 para privacidad en el ledger
func encodeField(data string) string {
	return base64.StdEncoding.EncodeToString([]byte(data))
}

// generateSignature crea un hash de integridad del registro
func generateSignature(c models.Cliente) string {
	payload := fmt.Sprintf("%s|%s|%s|%s", c.ClienteId, c.Nombre, c.Estado, c.FechaAlta)
	hash := sha256.Sum256([]byte(payload))
	return fmt.Sprintf("SIG-%x", hash[:16])
}

const (
	headerActorName     = "X-Actor-Name"
	headerActorRole     = "X-Actor-Role"
	headerActorUsername = "X-Actor-Username"
)

// getRoleFromKey mapea la API Key al nombre del usuario y su rol para auditoría (fallback sin portal).
func getRoleFromKey(key string) string {
	switch key {
	case os.Getenv("API_KEY_ADMIN"):
		return "Ing. Carlos Mamani (Supervisor)"
	case os.Getenv("API_KEY_INTEGRADOR"):
		return "Lic. Ana Flores (Operador Planta)"
	case os.Getenv("API_KEY_SOLO_LECTURA"):
		return "Dr. Pedro Huanca (Auditor)"
	default:
		return "Usuario Desconocido"
	}
}

// prefijoAuditoriaOperador usa cabeceras del portal (X-Actor-*) o, si no vienen, la API key.
func prefijoAuditoriaOperador(c *gin.Context) string {
	name := strings.TrimSpace(c.GetHeader(headerActorName))
	role := strings.TrimSpace(c.GetHeader(headerActorRole))
	user := strings.TrimSpace(c.GetHeader(headerActorUsername))
	if name != "" || role != "" || user != "" {
		var parts []string
		if name != "" {
			parts = append(parts, name)
		}
		if role != "" {
			parts = append(parts, role)
		}
		if user != "" {
			parts = append(parts, user)
		}
		return "[actor] " + strings.Join(parts, " · ")
	}
	return "[" + getRoleFromKey(c.GetHeader("X-API-Key")) + "]"
}

var (
	reFirmaEnNotas    = regexp.MustCompile(`(?i)FIRMA:\s*SIG-[a-f0-9]+\s*\|\s*`)
	reActorEnNotas    = regexp.MustCompile(`(?i)\[actor\][^[\n]*`)
	reEtiquetaCorch   = regexp.MustCompile(`\[[^\]]+\]`)
	reRevisionLegacy  = regexp.MustCompile(`_REV_\d+$`)
)

// sanitizarNotasNegocio quita FIRMA, [actor] y prefijos viejos; solo conserva texto de negocio del usuario.
//
// Notas de implementación:
//   - Go RE2 no soporta lookahead/lookbehind, por eso el filtrado del marcador
//     [baja-logica-api] se hace con ReplaceAllStringFunc y no con una negative
//     lookahead.
func sanitizarNotasNegocio(notas string) string {
	s := strings.TrimSpace(notas)
	for i := 0; i < 32; i++ {
		prev := s
		s = strings.TrimSpace(reFirmaEnNotas.ReplaceAllString(s, " "))
		s = strings.TrimSpace(reActorEnNotas.ReplaceAllString(s, " "))
		s = strings.TrimSpace(reEtiquetaCorch.ReplaceAllStringFunc(s, func(m string) string {
			low := strings.ToLower(m)
			if strings.Contains(low, "baja-logica-api") {
				return m
			}
			return " "
		}))
		if s == prev {
			break
		}
	}
	return s
}

func inyectarAuditoriaNotas(c *gin.Context, notas string) string {
	pref := prefijoAuditoriaOperador(c)
	notas = sanitizarNotasNegocio(notas)
	if notas == "" {
		return pref
	}
	return pref + " " + notas
}

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

	n.Notas = inyectarAuditoriaNotas(c, n.Notas)

	// APLICAR ENCODE (Privacidad) — desactivado temporalmente (legibilidad en UI)
	// n.Nombre = encodeField(n.Nombre)
	// n.Email = encodeField(n.Email)
	// n.Telefono = encodeField(n.Telefono)

	// GENERAR FIRMA DIGITAL DE NEGOCIO
	firma := generateSignature(n)
	n.Notas = fmt.Sprintf("FIRMA: %s | %s", firma, n.Notas)

	// 1. Invocar el Chaincode (Fase 4)
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

	publicarNotificacion(c,
		notificador.EventoClienteCreado,
		n.ClienteId,
		result.TxID,
		fmt.Sprintf("Cliente %s registrado", n.ClienteId),
	)

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
	// Filtrar restos del legado de "borradores": claves _DRAFT y _REV_N
	// quedan visibles en GetAllAssets hasta que se actualice el chaincode.
	filtrados := clientes[:0]
	for _, cli := range clientes {
		id := strings.ToUpper(strings.TrimSpace(cli.ClienteId))
		if strings.HasSuffix(id, "_DRAFT") || reRevisionLegacy.MatchString(id) {
			continue
		}
		filtrados = append(filtrados, cli)
	}
	c.JSON(http.StatusOK, respuestaLecturaTipada(c, "CONSULTA_EXITOSA", "Listado de clientes registrados", filtrados, raw))
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

	normalizado.Notas = inyectarAuditoriaNotas(c, normalizado.Notas)

	// APLICAR ENCODE (Privacidad) — desactivado temporalmente
	// normalizado.Nombre = encodeField(normalizado.Nombre)
	// normalizado.Email = encodeField(normalizado.Email)
	// normalizado.Telefono = encodeField(normalizado.Telefono)

	// GENERAR FIRMA DIGITAL DE NEGOCIO
	firma := generateSignature(normalizado)
	normalizado.Notas = fmt.Sprintf("FIRMA: %s | %s", firma, normalizado.Notas)

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

	publicarNotificacion(c,
		notificador.EventoClienteEditado,
		normalizado.ClienteId,
		result.TxID,
		fmt.Sprintf("Cliente %s editado", normalizado.ClienteId),
	)

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    result.TxID,
		Mensaje: "Cliente actualizado correctamente",
	})
}

// marcaBajaLogicaNotas identifica en notas una baja aplicada vía API (UpdateAsset), p. ej. cuando el estado queda INACTIVO.
const marcaBajaLogicaNotas = "[baja-logica-api]"

// DarBajaCliente aplica baja lógica invocando BajaCliente en el chaincode (estado DADO_DE_BAJA).
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
	lineaAuditoria := lineaAuditoriaBaja(c, roleStr)

	// Estrategia dual: muchos despliegues no exponen BajaCliente o fallan con "failed to endorse"
	// sin detalle; UpdateAsset(INACTIVO)+marca suele ser la vía compatible. Si falla, se intenta BajaCliente.
	var result *fabric.SubmitResult
	var errBaja error
	result, errBaja = darBajaViaUpdateAssetInactivo(chaincode, actual, clienteId, lineaAuditoria)
	if errBaja != nil && !esErrorClienteYaDeBaja(errBaja) {
		var resultCC *fabric.SubmitResult
		var errCC error
		resultCC, errCC = fabric.InvokeTransactionWithTxID(chaincode, "BajaCliente", clienteId, lineaAuditoria)
		if errCC == nil {
			result = resultCC
			errBaja = nil
		} else {
			errBaja = fmt.Errorf("baja vía UpdateAsset(INACTIVO): %v; baja vía BajaCliente: %w", errBaja, errCC)
		}
	}
	if errBaja != nil {
		errMsg := extraerMensajeErrorFabric(errBaja)
		if esErrorClienteYaDeBaja(errBaja) {
			c.JSON(http.StatusConflict, models.RespuestaError{Ok: false, Codigo: "CLIENTE_YA_DADO_DE_BAJA", Mensaje: "El cliente ya fue dado de baja"})
			return
		}
		if strings.Contains(errMsg, "CLIENTE_NO_EDITABLE") {
			c.JSON(http.StatusConflict, models.RespuestaError{Ok: false, Codigo: "CLIENTE_NO_EDITABLE", Mensaje: "El cliente fue dado de baja y no admite modificaciones"})
			return
		}
		if esErrorNoEncontrado(errBaja) {
			c.JSON(http.StatusNotFound, models.RespuestaError{Ok: false, Codigo: "NO_ENCONTRADO", Mensaje: "Cliente no encontrado en la Blockchain"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok: false, Codigo: "ERROR_FABRIC",
			Mensaje: "Error al registrar la baja en Blockchain: " + errMsg,
		})
		return
	}

	publicarNotificacion(c,
		notificador.EventoClienteDadoDeBaja,
		clienteId,
		result.TxID,
		fmt.Sprintf("Cliente %s dado de baja", clienteId),
	)

	c.JSON(http.StatusOK, models.RespuestaExitoTx{
		Ok:      true,
		TxId:    result.TxID,
		Mensaje: "Cliente dado de baja correctamente",
	})
}

func lineaAuditoriaBaja(c *gin.Context, roleStr string) string {
	return fmt.Sprintf("%s %s [%s] Baja lógica registrada (rol operación: %s)",
		marcaBajaLogicaNotas, prefijoAuditoriaOperador(c), time.Now().UTC().Format(time.RFC3339), roleStr)
}

// Respaldo si el chaincode desplegado no expone BajaCliente: INACTIVO + marca en notas (UpdateAsset rechaza DADO_DE_BAJA).
func darBajaViaUpdateAssetInactivo(chaincode string, actual models.Cliente, clienteId string, lineaAuditoria string) (*fabric.SubmitResult, error) {
	id := strings.TrimSpace(actual.ClienteId)
	if id == "" {
		id = strings.TrimSpace(clienteId)
	}
	notas := strings.TrimSpace(actual.Notas)
	if notas != "" {
		notas = notas + "\n" + lineaAuditoria
	} else {
		notas = lineaAuditoria
	}
	return fabric.InvokeTransactionWithTxID(chaincode, "UpdateAsset",
		id, actual.Nombre, actual.TipoDocumento, actual.NumeroDocumento,
		actual.FechaAlta, "INACTIVO", actual.Telefono, actual.Email, notas,
	)
}

func esErrorClienteYaDeBaja(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToUpper(err.Error()), "CLIENTE_YA_DADO_DE_BAJA")
}

// extraerMensajeErrorFabric devuelve el detalle del chaincode si viene anidado en el error de endorsement.
func extraerMensajeErrorFabric(err error) string {
	if err == nil {
		return ""
	}
	raw := err.Error()
	if i := strings.Index(raw, "chaincode response"); i >= 0 {
		return strings.TrimSpace(raw[i:])
	}
	if i := strings.Index(raw, "CLIENTE_"); i >= 0 {
		return strings.TrimSpace(raw[i:])
	}
	return raw
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

// ConsultarLineaTiempoCliente obtiene el historial y lo transforma en hitos de negocio (Creado, Editado, Baja).
func ConsultarLineaTiempoCliente(c *gin.Context) {
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
				Mensaje: "Historial no encontrado",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FABRIC",
			Mensaje: "Error al obtener historial: " + err.Error(),
		})
		return
	}

	var operaciones []models.RegistroHistorialCliente
	if err := json.Unmarshal(result, &operaciones); err != nil {
		c.JSON(http.StatusInternalServerError, models.RespuestaError{
			Ok:      false,
			Codigo:  "ERROR_FORMATO",
			Mensaje: "Error al interpretar historial",
		})
		return
	}

	// El chaincode devuelve entradas de más reciente a más antiguo.
	// Ordenamos ascendente por timestamp para que i==0 sea siempre la PRIMERA
	// escritura (creación) y los siguientes sean ediciones o baja.
	sort.Slice(operaciones, func(i, j int) bool {
		return operaciones[i].Timestamp < operaciones[j].Timestamp
	})

	acciones := make([]models.AccionLineaTiempo, 0, len(operaciones))
	for i, op := range operaciones {
		accion := models.AccionLineaTiempo{
			TxId:  op.TxId,
			Fecha: op.Timestamp,
		}

		switch {
		case op.IsDelete:
			accion.Tipo = "baja"
			accion.Etiqueta = "Dado de Baja"
		case i == 0:
			// Primera entrada (más antigua) = creación del asset
			accion.Tipo = "creado"
			accion.Etiqueta = "Creado"
		default:
			// Entradas posteriores sin isDelete = modificación
			accion.Tipo = "editado"
			accion.Etiqueta = "Editado"
		}
		acciones = append(acciones, accion)
	}

	c.JSON(http.StatusOK, models.LineaTiempoCliente{
		Ok:        true,
		ClienteId: clienteId,
		Acciones:  acciones,
	})
}

// NOTA: El sistema "draft → commit → rollback → versiones" se eliminó.
// Hyperledger Fabric ya garantiza historial inmutable por activo a través
// de GetAssetHistory (ver ObtenerHistorialCliente y ObtenerLineaTiempo más
// arriba). Un flujo de "borrador" en chaincode contaminaba el world state
// con activos auxiliares (_DRAFT, _REV_N) y duplicaba transacciones por
// edición sin aportar valor real al auditor.

