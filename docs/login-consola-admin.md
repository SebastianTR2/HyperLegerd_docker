# Login de la consola del puente (web-cliente-demo)

> Este documento describe el flujo de autenticación, el archivo de cuentas y
> cómo arrancar el sistema completo con login JWT. Reemplaza al esquema
> anterior basado en `X-API-Key` manual.

## 1. Objetivo

Hasta ahora la consola del puente (`web-cliente-demo`) no tenía sesión: el
operador pegaba una `X-API-Key` en la pestaña Credenciales y el rol se
deducía de esa clave. Esto bastaba para demostrar el middleware pero tenía
dos problemas serios:

1. **Sin identidad real**: las notificaciones de cambios decían "el rol
   integrador editó Cli1" pero no quién (Ana, Carlos, …).
2. **Clave expuesta en el navegador**: localStorage guardaba la
   `X-API-Key` del tenant, que cualquier extensión o usuario en la misma
   máquina podía leer.

La solución implementada:

- El BFF (`web-portal-api`) emite **JWT** tras un login con usuario y
  contraseña.
- Las cuentas humanas se administran en un YAML del dueño del BaaS
  (`web-portal-api/config/usuarios-admin.yaml`).
- El frontend **nunca** ve la `X-API-Key`; el BFF la inyecta al reenviar
  cada petición al `api-middleware`, junto con cabeceras `X-Actor-*` con
  la identidad real del JWT.

> ℹ️ **La consola del puente es audit-only.** No hay UI para crear,
> editar o dar de baja clientes desde aquí; eso se hace desde el portal
> del cliente (`web-portal-cliente`) o vía API directa al middleware.
> Aquí solo se observa y se reciben notificaciones (rol admin).

## 2. Arquitectura

```
┌──────────────┐  POST /admin/auth/login    ┌──────────────┐
│ web-cliente- │ ───usuario+contraseña────► │ web-portal-  │
│ demo (React) │ ◄────── JWT ─────────────  │ api (BFF)    │
│              │                            │              │
│  guarda JWT  │                            │ valida vs    │
│  en local-   │                            │ usuarios-    │
│  Storage     │                            │ admin.yaml   │
│              │                            │ (bcrypt)     │
│              │ /api/admin/api/clientes/…  │              │
│              │ Authorization: Bearer JWT  │              │
│              │ ─────────────────────────► │ valida JWT,  │
│              │                            │ inyecta:     │
│              │                            │   X-API-Key  │
│              │                            │   X-Actor-*  │
│              │                            │ reenvía al   │
│              │                            │ middleware   │
└──────────────┘                            └──────┬───────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ api-middle-  │
                                            │ ware (sin    │
                                            │ cambios)     │
                                            └──────────────┘
```

El `api-middleware` sigue validando por `X-API-Key`, no por JWT. Esto
permite que cualquier otro cliente (un script, un proceso, otro portal)
siga usando `X-API-Key` directamente sin pasar por el BFF.

## 3. Archivo de cuentas

`web-portal-api/config/usuarios-admin.yaml`:

```yaml
default_tenant: clientes

tenants:
  clientes:
    nombre: "Demostraciones / clientes"
    api_keys:
      admin: sec-admin
      integrador: sec-int
      lectura: sec-lect
  agricultura:
    nombre: "Agricultura (canal aparte)"
    api_keys:
      admin: agri-admin-2026
      integrador: agri-int-2026
      lectura: agri-lect-2026

usuarios:
  - usuario: ana
    nombre_completo: "Ana Pérez"
    rol: integrador
    tenant: clientes
    contrasena_hash: "$2a$10$0cAh09Off1k6VnOVujyGr.ADfbBQ30vgNTWOj3XO9.loAajYpoAj."

  # ... más usuarios
```

**Reglas:**

- `tenants[<id>].api_keys[<rol>]` debe coincidir con la `X-API-Key`
  registrada en `api-middleware/config/tenants.yaml` para ese tenant.
- `rol` válido: `admin | integrador | lectura`.
- `contrasena_hash` debe ser un bcrypt válido. Generarlo con:
  ```bash
  cd web-portal-api
  go run ./cmd/bcrypt-gen "mi-contrasena-secreta"
  ```
- Marcar `activo: false` desactiva la cuenta sin borrarla.

Cuentas de demostración incluidas:

| Usuario  | Contraseña             | Rol         | Tenant       |
| -------- | ---------------------- | ----------- | ------------ |
| `ana`    | `ana-clientes-2026`    | integrador  | clientes     |
| `carlos` | `carlos-admin-2026`    | admin       | clientes     |
| `lucia`  | `lucia-lectura-2026`   | lectura     | clientes     |
| `olga`   | `olga-agri-2026`       | admin       | agricultura  |

> ⚠️ Cambiar estas contraseñas antes de cualquier despliegue real.

## 4. Endpoints del BFF

### Autenticación

| Método | Ruta                  | Descripción                                       |
| ------ | --------------------- | ------------------------------------------------- |
| POST   | `/admin/auth/login`   | `{ username, password }` → `{ token, usuario }`   |
| GET    | `/admin/auth/me`      | Verifica JWT y devuelve el usuario del token.     |
| POST   | `/admin/auth/logout`  | Invalida el JTI (in-memory revocation).           |

### Proxy genérico

```
ANY  /admin/api/*    →   {API_MIDDLEWARE_URL}/<misma ruta>
```

El BFF añade automáticamente:

- `X-API-Key: <tenant.api_keys[rol]>`
- `X-Actor-Name: <usuario.nombre_completo>`
- `X-Actor-Username: <usuario.usuario>`
- `X-Actor-Id: <usuario.usuario>`
- `X-Actor-Role: <rol>`
- `X-Tenant: <tenant>`
- `X-Forwarded-By: web-portal-api/admin`

Y elimina el `Authorization: Bearer …` antes de reenviar (el middleware no
necesita el JWT).

El proxy soporta SSE (Server-Sent Events) en streaming, por ejemplo:

```
GET /api/admin/api/admin/notificaciones/stream
```

llega al middleware como `GET /admin/notificaciones/stream` con la
`X-API-Key` del admin del tenant.

## 5. Cómo arrancar todo

```bash
# 1) Red Fabric (igual que antes)
cd proyecto-blockchain/red-hyperledger/test-network
./network.sh up createChannel -ca -s couchdb -c clientes

# 2) api-middleware (puerto 3000)
cd ../../api-middleware
go run ./cmd/server

# 3) web-portal-api – BFF con login (puerto 3001)
cd ../web-portal-api
go run ./cmd/server
# Verás:
#   usuariosadmin cargado: 4 cuentas desde ./config/usuarios-admin.yaml
#   web-portal-api escuchando en :3001 (middleware=http://127.0.0.1:3000)

# 4) web-cliente-demo (puerto 5173) – la consola del puente
cd ../web-cliente-demo
npm install
npm run dev
# Verás: [Vite proxy] /api -> http://127.0.0.1:3001
```

Abrir <http://localhost:5173>. Como aún no hay sesión la app redirige a
`/login`. Ingresa con cualquiera de las cuentas de demo.

## 6. Notificaciones administrativas con identidad real

Tras el login, las notificaciones (drawer del icono campana) muestran:

```
CLIENTE.EDITADO    [Cli1]
Cliente Cli1 actualizado
26 may 2026, 04:25 · Ana Pérez · rol=integrador · tx 9a3b…
```

`Ana Pérez` ya no es un texto editable por el usuario; viene del JWT.

**Importante**: solo el rol `admin` ve la campana y el drawer. Para los
roles `integrador` y `lectura` la consola entrega las mismas páginas de
auditoría/historial pero sin el panel de notificaciones.

## 6.1 Diferencias prácticas entre roles en la consola

Como la consola es audit-only, todos los roles ven las mismas páginas de
lectura. La diferencia se reduce a:

| Capacidad                            | admin | integrador | lectura |
| ------------------------------------ | :---: | :--------: | :-----: |
| Iniciar sesión en la consola         |   ✓   |     ✓      |    ✓    |
| Ver listados/auditoría/historial     |   ✓   |     ✓      |    ✓    |
| Recibir notificaciones en vivo       |   ✓   |     ✗      |    ✗    |
| Editar/crear/dar de baja clientes    |   ✗ (¹)   |  ✗ (¹)   |    ✗    |

(¹) En el `api-middleware`, los roles `admin` e `integrador` SÍ tienen
permisos de escritura — solo que esas acciones se hacen desde el portal
del cliente o vía API directa, no desde esta consola.

## 7. Limitaciones conocidas

- **Revocación persistente en SQLite**: el logout marca el JTI en la tabla
  `sessions` del BFF, por lo que reiniciar el proceso ya no reactiva el token.
  Recomendación futura para alta escala: TTL/limpieza periódica de sesiones
  expiradas y métricas de almacenamiento.
- **No hay refresh tokens**: los JWT viven 8 h por defecto
  (`JWT_EXPIRY_HOURS`). Al expirar, el frontend redirige a `/login`.
- **El YAML no se hot-reload**: cambios requieren reiniciar el BFF.
- **Una sola lista de tenants/keys**: si necesitas administrar muchos
  tenants en producción, conviene mover las `api_keys` a variables de
  entorno o a un vault y dejar el YAML sólo para identidades.

## 8. Cómo desactivar el login (modo legado)

Si necesitas volver al modo `X-API-Key` directo (por ejemplo para
pruebas), basta con:

1. En `web-cliente-demo/vite.config.ts`, cambiar el proxy de `/api` para
   apuntar al middleware (`http://127.0.0.1:3000`).
2. Revertir `src/services/apiClient.ts` para enviar `X-API-Key` (los
   commits previos al bloque "login JWT" lo tienen).
3. Borrar/no usar `LoginPage` y `RequiereSesion` del `App.tsx`.

No se recomienda hacerlo: el login es ahora el flujo de referencia y las
notificaciones dependen de la identidad real del JWT.

## 9. Documentos operativos complementarios

Para operación diaria y aprobación de salida antes de integrar nuevas webs:

- `docs/runbook-web-puente.md` — arranque, smoke test y diagnóstico rápido.
- `docs/qa-web-puente-checklist.md` — checklist QA por fases con criterio Go/No-Go.
