# Gestión de Clientes (portal)

Aplicación web orientada al **usuario de negocio** para registrar y consultar clientes. La consola administrativa del equipo (`web-cliente-demo`) cubre auditoría y control avanzado.

## Arquitectura local

Tres servicios en desarrollo:

| Servicio | Puerto | Rol |
|----------|--------|-----|
| `api-middleware` | 3000 | API Fabric + auditoría |
| `web-portal-api` | 3001 | Login JWT, sesiones SQLite, proxy a middleware |
| `web-portal-cliente` (Vite) | 5174 | UI React |

El navegador solo habla con Vite (`/portal-api` → proxy a `web-portal-api`). Las claves `X-API-Key` del middleware **no** se envían al frontend.

## Requisitos

- Node.js 18+
- Go 1.22+ (para `web-portal-api`)
- `api-middleware` en ejecución con las API keys configuradas en su `.env`

## Instalación (frontend)

```bash
cd web-portal-cliente
npm install
```

Variables opcionales (`.env` o `.env.local`):

```env
VITE_PORTAL_API_TARGET=http://127.0.0.1:3001
```

## Levantar todo (orden recomendado)

1. **Middleware** (desde `api-middleware`, con Fabric/red según su README).
2. **Portal API**:

   ```bash
   cd web-portal-api
   cp .env.example .env   # ajustar MIDDLEWARE_URL y API_KEY_* 
   go mod tidy
   go run ./cmd/server
   ```

3. **Frontend**:

   ```bash
   cd web-portal-cliente
   npm run dev
   ```

Abrir `http://localhost:5174/login`.

## Usuarios demo

| Usuario | Contraseña | Permisos en portal |
|---------|------------|-------------------|
| admin | admin123 | Lectura y escritura (rol admin) |
| trabajador | trabajador123 | Lectura y escritura (rol integrador) |
| lectura | lectura123 | Solo consulta |

## Desarrollo

```bash
npm run dev
```

Puerto **5174**. Rutas de API del portal: prefijo `/portal-api` (auth y clientes vía BFF).

## Build

```bash
npm run build
```

Salida en `dist/`.
