package routes

import (
	"api-middleware/internal/handlers"
	"api-middleware/internal/middleware"

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

	// Grupo de Clientes
	router.GET("/clientes", append(authCualquierRol, handlers.ListarClientes)...)
	router.POST("/clientes", append(authIntegradorOAdmin, handlers.RegistrarCliente)...)
	router.GET("/clientes/:clienteId", append(authCualquierRol, handlers.ConsultarCliente)...)

	// Cuentas token visibles (Fase 2): rutas literales antes que :alias
	router.GET("/tokens/cuentas", append(authCualquierRol, handlers.ListarCuentasToken)...)
	router.POST("/tokens/cuentas", append(authIntegradorOAdmin, handlers.CrearCuentaTokenVisible)...)
	router.POST("/tokens/cuentas/emitir", append(authSoloAdmin, handlers.EmitirACuentaTokenVisible)...)
	router.POST("/tokens/cuentas/transferir", append(authSoloAdmin, handlers.TransferirEntreCuentasTokenVisible)...)
	router.GET("/tokens/cuentas/:alias/saldo", append(authCualquierRol, handlers.ConsultarSaldoCuentaTokenVisible)...)
	router.GET("/tokens/cuentas/:alias", append(authCualquierRol, handlers.ObtenerCuentaTokenVisible)...)

	// Grupo de Tokens
	router.POST("/tokens/emitir", append(authSoloAdmin, handlers.EmitirToken)...)
	router.POST("/tokens/transferir", append(authSoloAdmin, handlers.TransferirToken)...)
	router.GET("/tokens/saldo/:clienteId", append(authCualquierRol, handlers.ConsultarSaldo)...)
	router.GET("/tokens/historial/:clienteId", append(authCualquierRol, handlers.ConsultarHistorial)...)

	// Endpoint unificado (detección automática — hito 2.4)
	router.GET("/operar", append(authCualquierRol, handlers.AutoRouteOperation)...)
	router.POST("/operar", append(authIntegradorOAdmin, handlers.AutoRouteOperation)...)

	// Invocación controlada por lista blanca (hito 2.5) — integradores (contrato OpenAPI)
	router.POST("/chaincode/invocar", append(authIntegradorOAdmin, handlers.InvocarChaincodeIntegrador)...)

	// Monitoreo de eventos de chaincode (hito 2.7): SSE + historial en memoria
	router.GET("/eventos/stream", append(authIntegradorOAdmin, handlers.StreamEventos)...)
	router.GET("/eventos/historial", append(authCualquierRol, handlers.ObtenerUltimosEventos)...)

	// Rutas administrativas: fuera del OpenAPI público; validación omitida en middleware y API key obligatoria
	admin := router.Group("/admin")
	admin.Use(middleware.AdminAPIKey())
	{
		admin.POST("/chaincode/invocar", handlers.InvocarChaincodeAdmin)
	}
}
