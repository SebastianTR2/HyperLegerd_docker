# Checklist QA por fases — Web puente

Checklist formal para aprobar la consola del puente antes de conectar nuevas webs externas.

Estado por caso:

- `[ ]` Pendiente
- `[x]` Aprobado
- `[N/A]` No aplica

---

## Fase 1 — Build y backend base

### 1.1 Compilación frontend

- [x] En `web-cliente-demo`, `npm run build` termina sin errores.

### 1.2 Pruebas BFF

- [x] En `web-portal-api`, `go test ./...` termina en verde.

### 1.3 Pruebas middleware

- [x] En `api-middleware`, `go test ./...` termina en verde.

Criterio de salida Fase 1: 3/3 aprobados.

Evidencia (2026-05-31):

- `web-cliente-demo`: `npm run build` ✅
- `web-cliente-demo`: `npm test` ✅ (12 tests / 6 files)
- `web-portal-api`: `go test ./...` ✅
- `api-middleware`: `go test ./...` ✅
- `api-middleware`: `go build ./...` ✅

---

## Fase 2 — Autenticación y sesión

### 2.1 Flujo login correcto

- [ ] `GET /login` carga sin errores.
- [ ] Login válido devuelve sesión autenticada.
- [ ] Header `Authorization: Bearer ...` se envía al BFF desde frontend.
- [ ] Frontend no expone `X-API-Key` en requests del navegador.

### 2.2 Flujo login inválido

- [ ] Credenciales inválidas muestran error controlado.
- [ ] No queda sesión persistida tras login fallido.

### 2.3 Flujo logout

- [ ] Botón salir cierra sesión y redirige a `/login`.
- [ ] Rutas privadas rechazan acceso sin token.

Criterio de salida Fase 2: 9/9 aprobados.

---

## Fase 3 — Autorización por rol en UI

### 3.1 Rol admin

- [ ] Usuario admin ve campana y drawer de notificaciones.
- [ ] Usuario admin puede acceder a páginas de auditoría/historial/trazabilidad.

### 3.2 Rol integrador

- [ ] Usuario integrador no ve campana.
- [ ] Usuario integrador mantiene acceso de lectura a auditoría/historial.

### 3.3 Rol lectura

- [ ] Usuario lectura no ve campana.
- [ ] Usuario lectura mantiene acceso de lectura a auditoría/historial.

### 3.4 Restricción audit-only

- [ ] No existe UI para crear/editar/eliminar clientes.
- [ ] No existe UI de tokens.

Criterio de salida Fase 3: 10/10 aprobados.

---

## Fase 4 — Flujo de notificaciones y trazabilidad

### 4.1 Notificación en vivo (SSE)

- [ ] Con sesión admin activa, al mutar un recurso desde portal/API externa llega evento al panel.
- [ ] Evento incluye `tipo`, `recurso`, `actorNombre`, `actorRol`, `txId`.

### 4.2 Aislamiento por tenant

- [ ] Admin de `clientes` no recibe eventos de `agricultura`.
- [ ] Admin de `agricultura` no recibe eventos de `clientes`.

### 4.3 Historial/auditoría coherentes

- [ ] Historial muestra cronología del mismo recurso.
- [ ] Vista de auditoría agrupa correctamente por recurso y permite expandir cambios.

Criterio de salida Fase 4: 6/6 aprobados.

---

## Fase 5 — Resiliencia mínima y operación

### 5.1 Token expirado

- [ ] Al expirar JWT, frontend redirige a login sin crash.

### 5.2 Reinicio del BFF

- [ ] Tras logout, el token permanece inválido incluso si reinicia el BFF (revocación persistente).

### 5.3 Runbook

- [ ] Equipo puede levantar stack completo siguiendo solo `docs/runbook-web-puente.md`.

Criterio de salida Fase 5: 3/3 aprobados.

---

## Definición de listo (Go/No-Go)

Go para integrar Agricultura si:

- Fase 1, 2, 3 y 4 completas.
- En Fase 5, al menos 2/3 completos.

No-Go si:

- Hay regresiones audit-only (aparece edición/creación en web puente), o
- Falla login base, o
- Falla SSE de notificaciones admin.
