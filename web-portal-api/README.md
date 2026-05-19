# web-portal-api

Backend de autenticación y BFF para **web-portal-cliente**.

- SQLite: usuarios y sesiones (no guarda clientes).
- JWT + una sesión activa por usuario.
- Proxy hacia `api-middleware` con `X-API-Key` según rol (no expuesta al navegador).

## Variables

Copiar `.env.example` a `.env` en esta carpeta.

## Levantar

```bash
cd web-portal-api
go mod tidy
go run ./cmd/server
```

Puerto por defecto: **3001**.

## Usuarios demo

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | admin123 | admin |
| trabajador | trabajador123 | integrador |
| lectura | lectura123 | lectura |
