# Notificaciones a administradores (multi-tenant)

Este documento describe el sistema que avisa al administrador del tenant
cuando un usuario con rol **integrador** (u otro rol no-admin) ejecuta una
operación que modifica el ledger. Cubre desde la configuración por tenant
hasta los canales de salida (correo, webhook, SSE en vivo).

> **Ubicación del código**: `api-middleware/internal/notificador/`.
> **Hooks**: `internal/handlers/cliente_handler.go` y `dato_handler.go`.
> **Endpoints**: `GET /admin/notificaciones/stream` (SSE) y `GET /admin/notificaciones` (histórico).

---

## 1. ¿Por qué existe?

Hyperledger Fabric ya guarda el historial inmutable de cualquier cambio
(`GetAssetHistory`), pero **no avisa** a nadie cuando ocurre. La consola
admin (`web-cliente-demo`) puede consultar la auditoría a demanda, pero
para una operación 24/7 hace falta una alerta proactiva:

- Un integrador crea/edita/elimina un activo → se manda un correo al
  administrador del tenant.
- Si el admin tiene el portal abierto, el evento llega además en vivo por
  SSE y se muestra como toast/lista lateral.
- Si el cliente del tenant usa Slack/Teams/n8n, también puede enchufar un
  webhook.

El módulo es **multi-tenant**: cada tenant declara sus propios destinos y
sus filtros. Un admin de Agricultura nunca recibe eventos de Clientes y
viceversa.

---

## 2. Modelo de evento

```jsonc
{
  "id": "evt-1716784512000000000",
  "timestamp": "2026-05-26T08:15:12Z",
  "tenant": "clientes",
  "tipo": "cliente.editado",        // ver tabla más abajo
  "recurso": "Cli1",                // clienteId o datoId
  "actorRol": "integrador",         // rol resuelto por X-API-Key
  "actorId": "u-007",               // X-Actor-Id (opcional)
  "actorNombre": "Ana Pérez",       // X-Actor-Name (opcional)
  "txId": "9a3b…f24",               // TxID Fabric de la mutación
  "resumen": "Cliente Cli1 editado",
  "metadata": { }                    // reservado
}
```

Tipos de evento estándar:

| Tipo                       | Cuándo se dispara                                       |
| -------------------------- | ------------------------------------------------------- |
| `cliente.creado`           | `POST /clientes` exitoso                                |
| `cliente.editado`          | `PATCH /clientes/:id` exitoso                           |
| `cliente.dado_de_baja`     | `POST /clientes/:id/baja` exitoso                       |
| `dato.creado`              | `POST /datos` exitoso (multi-tenant, dato_cc)           |
| `dato.editado`             | `PUT /datos/:id` exitoso                                |
| `dato.eliminado`           | `DELETE /datos/:id` exitoso                             |

> Si el ledger rechaza la operación (4xx/5xx en HTTP), **no** se publica
> nada: solo notifica mutaciones realmente confirmadas.

---

## 3. Configuración por tenant (`config/tenants.yaml`)

Cada tenant añade un bloque `notificaciones`. La sección es opcional;
sin ella el tenant no genera correos ni webhooks (la SSE sigue
disponible si alguien se conecta, pero no llegará nada).

```yaml
tenants:
  clientes:
    # ... msp_id, canal, chaincode, api_keys ...
    notificaciones:
      activado: true
      eventos:
        - cliente.creado
        - cliente.editado
        - cliente.dado_de_baja
      # Vacío = avisar para cualquier rol.
      # Caso típico: ["integrador"] para no spamearse a sí mismo el admin.
      roles_actor: [integrador]
      destinos:
        - tipo: email
          asunto: "[CampusChain] {tipo} en {tenant} (recurso={recurso})"
          destinatarios:
            - admin-clientes@empresa.com
        - tipo: webhook
          url: https://hooks.slack.com/services/XXX/YYY/ZZZ
          token: ""   # opcional → Authorization: Bearer ...
```

**Plantillas en `asunto`**: `{tenant}`, `{tipo}`, `{recurso}`,
`{actor}` (nombre), `{rol}`.

**Overrides por destino**: cada destino puede declarar su propio
`eventos` y `roles_actor`. Si están vacíos hereda los del tenant.

---

## 4. Canales de salida

### 4.1 Email (SMTP, `internal/notificador/email.go`)

Variables de entorno (en `.env`):

```bash
NOTIFICADOR_SMTP_HOST=smtp.gmail.com
NOTIFICADOR_SMTP_PUERTO=587
NOTIFICADOR_SMTP_USUARIO=avisos@empresa.com
NOTIFICADOR_SMTP_CONTRASENA=contraseña-de-app
NOTIFICADOR_SMTP_REMITENTE="CampusChain <avisos@empresa.com>"
NOTIFICADOR_SMTP_STARTTLS=true
NOTIFICADOR_SMTP_LOG_ONLY=false
```

Sin `NOTIFICADOR_SMTP_HOST` definido (o con `NOTIFICADOR_SMTP_LOG_ONLY=true`)
el canal entra en **modo log-only**: cada correo que hubiera enviado se
imprime en el log con el prefijo `[NOTIFICADOR_EMAIL][log-only]`. Útil
para desarrollo y demos sin servidor de correo real.

### 4.2 Webhook (`internal/notificador/webhook.go`)

POST JSON al URL del destino con el `EventoNotificacion` serializado.
Si `token` está definido, se envía como `Authorization: Bearer <token>`.

### 4.3 SSE (`internal/notificador/sse.go`)

El portal admin se conecta con su `X-API-Key` de rol **admin** a:

```
GET /admin/notificaciones/stream
```

El broker filtra por el tenant resuelto desde la key, así que cada admin
solo ve los eventos de su propio tenant. Cada evento llega como:

```
event: notificacion
data: { "id":"evt-…", "tenant":"clientes", "tipo":"cliente.editado", … }
```

Además existe un histórico reciente (in-memory, últimos 50):

```
GET /admin/notificaciones
```

---

## 5. Garantías y límites

| Punto                           | Comportamiento                                             |
| ------------------------------- | ---------------------------------------------------------- |
| Concurrencia                    | El bus tiene un buffer (256 por defecto). Worker fan-out.  |
| Pérdida bajo carga              | Si el bus se llena, el evento se descarta y queda en bitácora `[BITACORA_EVENTO] {"categoria":"NOTIFICACION_DESCARTADA",…}`. |
| Timeout de entrega              | 8 s por destino. Errores se loguean como `NOTIFICACION_FALLIDA`. |
| No bloquea el handler HTTP      | `Publicar(...)` es no-bloqueante (encola y retorna).        |
| Aislamiento tenant ↔ tenant     | El broker SSE filtra por `tenant`. Email/webhook usan los `destinos` declarados en cada tenant. |
| Persistencia de notificaciones  | No hay: el histórico es in-memory (último ringbuffer).      |
| Retrabajos                      | No hay reintentos automáticos; un webhook que falle se vuelve a intentar en la siguiente notificación. |

> Para producción real conviene migrar a una cola persistente (NATS,
> RabbitMQ) y/o guardar el histórico en SQLite/Postgres. La interfaz
> `CanalSalida` permite añadir nuevos canales sin tocar handlers.

---

## 6. Probar el flujo end-to-end

1. Arranca el middleware con `tenants.yaml` y `notificaciones.activado: true`:
   ```bash
   TENANTS_FILE=./config/tenants.yaml go run ./cmd/server
   ```
   Si no defines variables `NOTIFICADOR_SMTP_*`, los correos saldrán por log.

2. Conecta un admin al stream (en otra terminal):
   ```bash
   curl -N -H "X-API-Key: sec-admin" \
     http://127.0.0.1:3000/admin/notificaciones/stream
   ```

3. Simula un cambio desde un integrador:
   ```bash
   curl -X PATCH http://127.0.0.1:3000/clientes/Cli1 \
     -H "X-API-Key: sec-int" \
     -H "X-Actor-Name: Ana Pérez" \
     -H "Content-Type: application/json" \
     -d '{"telefono":"700-99-99-99"}'
   ```

4. En la primera terminal verás:
   ```
   event: notificacion
   data: {"id":"evt-…","tenant":"clientes","tipo":"cliente.editado",
          "recurso":"Cli1","actorRol":"integrador","actorNombre":"Ana Pérez",
          "txId":"…","resumen":"Cliente Cli1 editado", … }
   ```

5. En el log del middleware:
   ```
   [NOTIFICADOR_EMAIL][log-only] de=avisos@empresa.com a=[admin-clientes@empresa.com] asunto="[CampusChain] cliente.editado en clientes (recurso=Cli1)"
   ```

---

## 7. Integración con el portal admin

El portal de la consola (`web-cliente-demo`) puede consumir el stream
así (cualquier framework moderno soporta SSE nativo):

```ts
const url = `${API}/admin/notificaciones/stream`
const es = new EventSource(url, { withCredentials: false })
// Por compatibilidad con el header X-API-Key se recomienda hacer la
// suscripción a través de un fetch reader (ver lib/sseConApiKey.ts) en
// vez de EventSource, ya que el navegador no permite headers custom
// en EventSource estándar.

es.addEventListener('notificacion', (ev) => {
  const data = JSON.parse(ev.data)
  mostrarToast(`${data.tipo} → ${data.recurso} por ${data.actorNombre}`)
  agregarAFeedLateral(data)
})
```

Para inicializar la vista con eventos pasados, primero `GET /admin/notificaciones`
y luego abrir el stream.
