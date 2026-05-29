package routes

import (
	"api-middleware/internal/handlers"
	"api-middleware/internal/middleware"
	"api-middleware/internal/tenants"

	"github.com/gin-gonic/gin"
)

// SetupRoutes configura todos los endpoints del API Middleware.
func SetupRoutes(router *gin.Engine) {
	// --- API pública del contrato OpenAPI: X-API-Key + rol (hito 2.6) ---
	authCualquierRol := []gin.HandlerFunc{
		middleware.XAPIKeyAuth(),
		middleware.RequireAPIRoles(middleware.RoleAdmin, middleware.RoleIntegrador, middleware.RoleSoloLectura),
	}
	authIntegradorOAdmin := []gin.HandlerFunc{
		middleware.XAPIKeyAuth(),
		middleware.RequireAPIRoles(middleware.RoleAdmin, middleware.RoleIntegrador),
	}
	authSoloAdmin := []gin.HandlerFunc{
		middleware.XAPIKeyAuth(),
		middleware.RequireAPIRoles(middleware.RoleAdmin),
	}

	// Rutas legacy del tenant base (cliente_cc): solo el tenant "clientes"
	// puede consumirlas. Para otros tenants (Agricultura), los endpoints
	// genéricos /datos/* y /chaincode/invocar.
	tenantBase := middleware.RequireTenants(tenants.DefaultTenantID)
	authCualquierRolBase := append([]gin.HandlerFunc{}, authCualquierRol...)
	authCualquierRolBase = append(authCualquierRolBase, tenantBase)
	authIntegradorOAdminBase := append([]gin.HandlerFunc{}, authIntegradorOAdmin...)
	authIntegradorOAdminBase = append(authIntegradorOAdminBase, tenantBase)
	authSoloAdminBase := append([]gin.HandlerFunc{}, authSoloAdmin...)
	authSoloAdminBase = append(authSoloAdminBase, tenantBase)

	// Grupo de Clientes (tenant base "clientes" / cliente_cc)
	router.GET("/clientes", append(authCualquierRolBase, handlers.ListarClientes)...)
	router.POST("/clientes", append(authIntegradorOAdminBase, handlers.RegistrarCliente)...)
	router.GET("/clientes/:clienteId", append(authCualquierRolBase, handlers.ConsultarCliente)...)
	router.PATCH("/clientes/:clienteId", append(authIntegradorOAdminBase, handlers.ActualizarCliente)...)
	router.POST("/clientes/:clienteId/baja", append(authIntegradorOAdminBase, handlers.DarBajaCliente)...)
	router.GET("/clientes/historial/:clienteId", append(authCualquierRolBase, handlers.ConsultarHistorialCliente)...)
	router.GET("/clientes/historial-resumido/:clienteId", append(authCualquierRolBase, handlers.ConsultarLineaTiempoCliente)...)

	// Cuentas token visibles (Fase 2 — solo tenant base)
	router.GET("/tokens/cuentas", append(authCualquierRolBase, handlers.ListarCuentasToken)...)
	router.POST("/tokens/cuentas", append(authIntegradorOAdminBase, handlers.CrearCuentaTokenVisible)...)
	router.POST("/tokens/cuentas/emitir", append(authSoloAdminBase, handlers.EmitirACuentaTokenVisible)...)
	router.POST("/tokens/cuentas/transferir", append(authSoloAdminBase, handlers.TransferirEntreCuentasTokenVisible)...)
	router.GET("/tokens/cuentas/:alias/saldo", append(authCualquierRolBase, handlers.ConsultarSaldoCuentaTokenVisible)...)
	router.GET("/tokens/cuentas/:alias", append(authCualquierRolBase, handlers.ObtenerCuentaTokenVisible)...)

	// Grupo de Tokens (tenant base)
	router.POST("/tokens/emitir", append(authSoloAdminBase, handlers.EmitirToken)...)
	router.POST("/tokens/transferir", append(authSoloAdminBase, handlers.TransferirToken)...)
	router.GET("/tokens/saldo/:clienteId", append(authCualquierRolBase, handlers.ConsultarSaldo)...)
	router.GET("/tokens/historial/:clienteId", append(authCualquierRolBase, handlers.ConsultarHistorial)...)

	// Endpoint unificado (detección automática — hito 2.4)
	router.GET("/operar", append(authCualquierRolBase, handlers.AutoRouteOperation)...)
	router.POST("/operar", append(authIntegradorOAdminBase, handlers.AutoRouteOperation)...)

	// =========================================================================
	// Endpoints genéricos multi-tenant (cualquier empresa cliente del BaaS)
	// =========================================================================
	// Modelo genérico (dato_cc): clave libre + payload JSON; usado por
	// integradores externos como la administradora de Agricultura.
	router.GET("/datos", append(authCualquierRol, handlers.ListarDatos)...)
	router.POST("/datos", append(authIntegradorOAdmin, handlers.CrearDato)...)
	router.GET("/datos/:datoId", append(authCualquierRol, handlers.ConsultarDato)...)
	router.PUT("/datos/:datoId", append(authIntegradorOAdmin, handlers.ActualizarDato)...)
	router.DELETE("/datos/:datoId", append(authSoloAdmin, handlers.EliminarDato)...)
	router.GET("/datos/:datoId/historial", append(authCualquierRol, handlers.ConsultarHistorialDato)...)

	// Invocación controlada por lista blanca (hito 2.5) — integradores (contrato OpenAPI)
	router.POST("/chaincode/invocar", append(authIntegradorOAdmin, handlers.InvocarChaincodeIntegrador)...)

	// Monitoreo de eventos de chaincode (hito 2.7): SSE + historial en memoria
	router.GET("/eventos/stream", append(authIntegradorOAdmin, handlers.StreamEventos)...)
	router.GET("/eventos/historial", append(authCualquierRol, handlers.ObtenerUltimosEventos)...)

	// Notificaciones de auditoría para administradores del tenant
	// (mutaciones hechas por integradores u otros roles).
	router.GET("/admin/notificaciones/stream", append(authSoloAdmin, handlers.StreamNotificacionesAdmin)...)
	router.GET("/admin/notificaciones", append(authSoloAdmin, handlers.HistorialNotificacionesAdmin)...)
	router.DELETE("/admin/notificaciones", append(authSoloAdmin, handlers.PurgarNotificacionesAdmin)...)

	// Auditoría del puente (bitácora en memoria + vista combinada con eventos de cadena)
	router.GET("/auditoria/http", append(authCualquierRol, handlers.ListarAuditoriaHTTP)...)
	router.GET("/auditoria/combinada", append(authCualquierRol, handlers.ListarAuditoriaCombinada)...)
	// Alias: peticiones al :3000 con prefijo /api (p. ej. proxy sin rewrite)
	router.GET("/api/auditoria/http", append(authCualquierRol, handlers.ListarAuditoriaHTTP)...)
	router.GET("/api/auditoria/combinada", append(authCualquierRol, handlers.ListarAuditoriaCombinada)...)

	// Rutas administrativas: fuera del OpenAPI público; validación omitida en middleware y API key obligatoria
	admin := router.Group("/admin")
	admin.Use(middleware.AdminAPIKey())
	{
		admin.POST("/chaincode/invocar", handlers.InvocarChaincodeAdmin)
	}
}
