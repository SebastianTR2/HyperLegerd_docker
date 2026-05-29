# Runbook operativo — Web puente audit-only

Guía rápida para levantar, validar y diagnosticar la consola del puente (`web-cliente-demo`) con login JWT vía BFF.

---

## 1. Alcance

Este runbook cubre:

- Arranque completo del stack local.
- Verificaciones mínimas de salud por servicio.
- Flujo funcional principal de la consola audit-only.
- Diagnóstico rápido de fallos comunes.

No cubre despliegue productivo ni hardening final.

---

## 2. Prerrequisitos

- Docker Desktop activo.
- Go y Node.js instalados.
- Dependencias del repo descargadas.
- Archivo de usuarios admin disponible en `web-portal-api/config/usuarios-admin.yaml`.
- Si se usa modo multi-tenant, `api-middleware/config/tenants.yaml` debe existir y ser válido.

---

## 3. Arranque estándar (orden obligatorio)

### 3.1 Red Fabric

```bash
cd /Users/evato/Developer/Proyecto_Hyperledger/proyecto-blockchain/red-hyperledger/test-network
export PATH="$PWD/../bin:$PATH"
./network.sh up createChannel -ca -s couchdb -c clientes
```

Chequeo rápido:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
docker exec peer0.org1.example.com peer channel list
```

Debe aparecer el canal `clientes`.

### 3.2 API middleware (`:3000`)

```bash
cd /Users/evato/Developer/Proyecto_Hyperledger/proyecto-blockchain/api-middleware
set -a && source .env && set +a
export OPENAPI_SPEC="$(pwd)/openapi.yaml"
go run ./cmd/server
```

Logs esperados:

- `Conectando a Hyperledger Fabric...`
- `Conexión exitosa con Hyperledger Fabric...`
- `Listening and serving HTTP on :3000`

### 3.3 BFF (`:3001`)

```bash
cd /Users/evato/Developer/Proyecto_Hyperledger/proyecto-blockchain/web-portal-api
go run ./cmd/server
```

Logs esperados:

- `usuariosadmin cargado: ... cuentas`
- `web-portal-api escuchando en :3001`

### 3.4 Web puente (`:5173`)

```bash
cd /Users/evato/Developer/Proyecto_Hyperledger/proyecto-blockchain/web-cliente-demo
npm install
npm run dev
```

Log esperado:

- `[Vite proxy] /api -> http://127.0.0.1:3001`

---

## 4. Smoke test mínimo (5 minutos)

1. Abrir `http://localhost:5173`.
2. Confirmar redirección automática a `/login`.
3. Login con cuenta demo admin (`carlos`).
4. Verificar acceso a panel/listados/historial/auditoría.
5. Verificar que aparezca campana de notificaciones (solo admin).
6. Cerrar sesión y confirmar redirección a `/login`.

Resultado esperado: 6/6 correcto.

---

## 5. Validación funcional audit-only

La consola del puente debe cumplir:

- No mostrar UI para crear/editar/eliminar clientes.
- No mostrar módulos de tokens ni registros de operación.
- Mostrar lectura/auditoría/historial/trazabilidad.
- Mostrar notificaciones solo a rol `admin`.

Si aparece alguna acción de mutación en esta web, se considera regresión.

---

## 6. Diagnóstico rápido de incidentes

### Caso A: `401` o retorno constante a login

- Verificar hora del sistema (desfase puede invalidar JWT).
- Revisar expiración de token (`JWT_EXPIRY_HOURS`).
- Confirmar que `web-portal-api` está arriba y responde `/admin/auth/me`.

### Caso B: `500 ERROR_FABRIC` al listar datos

- Confirmar red y peers activos.
- Confirmar canal/chaincode desplegados.
- Validar que middleware arrancó con conexión Fabric exitosa.

### Caso C: no llegan notificaciones SSE

- Confirmar login con rol `admin`.
- Confirmar evento de mutación real en ledger (no fallido).
- Revisar configuración `notificaciones` del tenant.

### Caso D: logout no invalida tras reinicio del BFF

- Comportamiento esperado en MVP (revocación in-memory).
- Registrar como limitación conocida, no como bug.

---

## 7. Criterio de operación “estable”

Se considera estable cuando:

- Arranque completo sin errores en los 4 servicios.
- Smoke test mínimo 6/6.
- Validación audit-only sin regresiones de UI.
- Notificaciones admin confirmadas con al menos un evento real.

Con esto, la web puente queda lista para iniciar integración de una nueva web externa (por ejemplo Agricultura).
