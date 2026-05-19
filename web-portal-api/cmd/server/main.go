package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"web-portal-api/internal/config"
	"web-portal-api/internal/db"
	"web-portal-api/internal/handlers"
	"web-portal-api/internal/middleware"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	conn, err := db.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("base de datos: %v", err)
	}
	defer conn.Close()
	if err := db.Migrate(conn); err != nil {
		log.Fatalf("migración: %v", err)
	}
	if err := db.SeedDemoUsers(conn); err != nil {
		log.Fatalf("seed: %v", err)
	}

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true, "servicio": "web-portal-api"})
	})

	authH := &handlers.AuthHandler{Cfg: cfg, DB: conn}
	proxyH := &handlers.ProxyHandler{Cfg: cfg, DB: conn}
	authMW := middleware.RequireAuth(cfg, conn)

	r.POST("/auth/login", authH.Login)
	r.POST("/auth/logout", authMW, authH.Logout)
	r.GET("/auth/me", authMW, authH.Me)

	r.GET("/clientes", authMW, proxyH.ProxyClientes)
	r.POST("/clientes", authMW, middleware.RequireWriteRole(), proxyH.ProxyClientes)
	r.GET("/clientes/*proxyPath", authMW, proxyH.ProxyClientes)
	r.PATCH("/clientes/*proxyPath", authMW, middleware.RequireWriteRole(), proxyH.ProxyClientes)
	r.POST("/clientes/*proxyPath", authMW, middleware.RequireWriteRole(), proxyH.ProxyClientes)

	log.Printf("web-portal-api escuchando en :%s (middleware=%s)", cfg.Port, cfg.MiddlewareURL)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
