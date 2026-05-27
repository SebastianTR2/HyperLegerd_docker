# Onboarding de cliente nuevo (BaaS multi-tenant)

Guía paso a paso para incorporar una empresa cliente al middleware como un **tenant** independiente.

Esta guía usa como ejemplo la administradora de **Agricultura**. Para incorporar otra empresa, reemplazar los nombres `agricultura`, `OrgAgri`, `agri-*` por los suyos.

---

## 1. Información que debe entregar el cliente

Antes de empezar, el equipo del nuevo cliente debe responder:

| Pregunta | Ejemplo Agricultura | Por qué importa |
|----------|---------------------|-----------------|
| Nombre comercial / identificador corto | `agricultura` | Se vuelve el id del tenant. |
| Dominio de la web que consumirá la API | `https://web-agricultura.ejemplo` | Necesario para CORS y para emitir API keys. |
| ¿Misma red Fabric o propia? | Misma test-network | Define el procedimiento de alta. |
| ¿Modelo tipado o genérico? | Genérico (`dato_cc`) | Define qué chaincode se despliega en su canal. |
| Roles necesarios | admin, integrador, lectura | Cuántas API keys emitir. |

---

## 2. Pasos en la red Fabric

### 2.1 Crear canal y desplegar chaincode genérico

```bash
cd proyecto-blockchain
./scripts/fabric-despliegue/agregar_tenant_agricultura.sh simple
```

Esto crea el canal `agricultura` con Org1 + Org2 y despliega `dato_cc` con secuencia 1.

> Alternativa avanzada: `agregar_tenant_agricultura.sh multiorg` para incorporar Org3 como `OrgAgriMSP` real (consultar el script).

### 2.2 Generar material MSP

En modo `simple`, el tenant usa la identidad Admin@org1.example.com (la misma del tenant base). Cuando se requiera identidad independiente, ejecutar `addOrg3.sh generate` y copiar:

```
red-hyperledger/test-network/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp/signcerts/cert.pem
red-hyperledger/test-network/organizations/peerOrganizations/org3.example.com/users/Admin@org3.example.com/msp/keystore/<archivo>.pem
red-hyperledger/test-network/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt
```

a una ruta accesible por el middleware (p. ej. `/etc/baas/agricultura/`).

---

## 3. Configurar el middleware

### 3.1 Activar modo multi-tenant

En `api-middleware/.env`:

```env
TENANTS_FILE=./config/tenants.yaml
CORS_ORIGINS=https://web-agricultura.ejemplo,http://localhost:5174
```

### 3.2 Editar `config/tenants.yaml`

Copiar `config/tenants.example.yaml` y completar el bloque `agricultura`:

```yaml
default: clientes
tenants:
  clientes:
    # ... configuración existente del tenant base ...
  agricultura:
    nombre: "Administradora de Agricultura"
    msp_id: "Org1MSP"   # o "Org3MSP" si se usó multiorg
    cert_path: "/ruta/admin/cert.pem"
    key_path_dir: "/ruta/admin/keystore"
    tls_cert_path: "/ruta/peer/tls/ca.crt"
    peer_endpoint: "localhost:7051"   # o 11051 si Org3
    peer_host_alias: "peer0.org1.example.com"
    canal: "agricultura"
    chaincode: "dato_cc"
    api_keys:
      "agri-admin-2026": admin
      "agri-int-2026":   integrador
      "agri-lect-2026":  solo_lectura
```

> Las **API keys deben ser únicas en todo el archivo**. Si una key se repite, el middleware no arranca.

### 3.3 Reiniciar el middleware

```bash
cd api-middleware
go run ./cmd/server
```

En el arranque debe verse:

```
Configuración multi-tenant cargada desde ./config/tenants.yaml (2 tenants: [agricultura clientes])
Conectando a Hyperledger Fabric...
¡Conexión exitosa con Hyperledger Fabric para todos los tenants!
```

---

## 4. Endpoints expuestos al cliente

| Método | Ruta | Para qué |
|--------|------|---------|
| `POST` | `/datos` | Crear un activo genérico (datoId, tipo, payload). |
| `GET` | `/datos` | Listar todos los datos del tenant. |
| `GET` | `/datos/{datoId}` | Consultar un dato concreto. |
| `PUT` | `/datos/{datoId}` | Actualizar un dato existente. |
| `DELETE` | `/datos/{datoId}` | Borrarlo del world state (solo `admin`). |
| `GET` | `/datos/{datoId}/historial` | Historial inmutable on-chain. |
| `GET` | `/eventos/stream` | Eventos SSE (filtrar por `tenant` en cliente). |
| `POST` | `/chaincode/invocar` | Invocación cruda con `{canal, contrato, funcion, modo, parametros}`. |

> El header obligatorio es `X-API-Key`. No se manda nada del tenant; lo deduce el middleware de la key.

---

## 5. Ejemplos `curl` (Agricultura)

### 5.1 Registrar una parcela

```bash
curl -X POST http://localhost:3000/datos \
  -H "X-API-Key: agri-int-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "datoId": "PARCELA-001",
    "tipo": "parcela",
    "payload": {
      "duenio": "Cooperativa Sur",
      "hectareas": 12.5,
      "cultivo": "quinua",
      "ubicacion": {"lat": -16.5, "lon": -68.1}
    }
  }'
```

Respuesta esperada (201):

```json
{
  "ok": true,
  "txId": "f3a2b1c4...",
  "mensaje": "Dato registrado correctamente en la Blockchain"
}
```

### 5.2 Consultarla

```bash
curl -H "X-API-Key: agri-lect-2026" \
  http://localhost:3000/datos/PARCELA-001
```

### 5.3 Actualizar payload

```bash
curl -X PUT http://localhost:3000/datos/PARCELA-001 \
  -H "X-API-Key: agri-int-2026" \
  -H "Content-Type: application/json" \
  -d '{
    "datoId": "PARCELA-001",
    "tipo": "parcela",
    "payload": {
      "duenio": "Cooperativa Sur",
      "hectareas": 12.5,
      "cultivo": "papa amarga",
      "ubicacion": {"lat": -16.5, "lon": -68.1}
    }
  }'
```

### 5.4 Ver historial inmutable

```bash
curl -H "X-API-Key: agri-lect-2026" \
  http://localhost:3000/datos/PARCELA-001/historial
```

Respuesta (orden cronológico descendente):

```json
{
  "ok": true,
  "codigo": "CONSULTA_EXITOSA",
  "datos": [
    {"txId": "...", "timestamp": "2026-05-26T01:10:22Z", "record": {"datoId":"PARCELA-001","tipo":"parcela","payload":{...,"cultivo":"papa amarga"},"revision":2,...}},
    {"txId": "...", "timestamp": "2026-05-26T01:05:11Z", "record": {"datoId":"PARCELA-001","tipo":"parcela","payload":{...,"cultivo":"quinua"},"revision":1,...}}
  ]
}
```

### 5.5 Listar todo

```bash
curl -H "X-API-Key: agri-lect-2026" http://localhost:3000/datos
```

### 5.6 Borrar (solo admin)

```bash
curl -X DELETE http://localhost:3000/datos/PARCELA-001 \
  -H "X-API-Key: agri-admin-2026"
```

---

## 6. Validar aislamiento entre tenants

1. Crear `PARCELA-001` con `agri-int-2026` (Agricultura).
2. Intentar leerla con `sec-admin` (tenant `clientes`):

   ```bash
   curl -H "X-API-Key: sec-admin" http://localhost:3000/datos/PARCELA-001
   ```

   → debe responder con un error de Fabric (el canal `clientes` no tiene ese dato) o un 404. No verá los datos de Agricultura.

3. Intentar registrar un Cliente con la API key de Agricultura:

   ```bash
   curl -X POST http://localhost:3000/clientes \
     -H "X-API-Key: agri-int-2026" \
     -H "Content-Type: application/json" \
     -d '{"clienteId":"CLI-XYZ","nombre":"…"}'
   ```

   → debe responder `403 TENANT_NO_AUTORIZADO`. La key de Agricultura no puede usar las rutas legacy `/clientes/*`.

---

## 7. Colección Postman (sugerencia)

Crear una colección con dos entornos:

```text
Entorno: clientes
  base_url = http://localhost:3000
  api_key = sec-admin

Entorno: agricultura
  base_url = http://localhost:3000
  api_key = agri-int-2026
```

Variables compartidas en cada request:

- Header: `X-API-Key: {{api_key}}`
- URL: `{{base_url}}/datos`

Importar/exportar como JSON desde Postman → File → Export collection.

---

## 8. Rotación de API keys

1. Editar `config/tenants.yaml`, sustituir la entrada por la nueva clave.
2. Reiniciar el middleware (5 s de downtime aceptables).
3. Comunicar la nueva clave al cliente por canal seguro (PGP / 1Password).
4. Si se sospecha fuga: borrar la entrada en `tenants.yaml` y reiniciar. Toda petición con la clave vieja recibirá `403 CREDENCIAL_INVALIDA`.

---

## 9. Checklist final antes de “ir a producción”

- [ ] `config/tenants.yaml` con permisos `chmod 600` y propietario del servicio.
- [ ] Certificados MSP en ruta privada (`/etc/baas/<tenant>/`).
- [ ] `CORS_ORIGINS` con dominios reales (no `*`).
- [ ] HTTPS delante del middleware (Caddy, nginx, Traefik).
- [ ] Backup del directorio `crypto-config` del peer y del archivo `tenants.yaml`.
- [ ] Documentar en `tenants.yaml` quién es el contacto técnico del cliente.

---

## 10. Soporte y troubleshooting

| Síntoma | Causa probable |
|---------|----------------|
| `TENANT_NO_AUTORIZADO` | API key del cliente externo usada en endpoint `/clientes/*` (sólo admite tenant base). |
| `CREDENCIAL_INVALIDA` | API key inexistente en `tenants.yaml` ni en variables legacy. |
| `tenant "agricultura" no tiene gateway conectado` | Falló la conexión Fabric del tenant — revisar paths del cert/keystore y el peer en logs. |
| `the channel "agricultura" does not exist` | Canal no creado o peer no unido. Ejecutar `agregar_tenant_agricultura.sh simple`. |
| Eventos SSE no llegan | Verificar que `tenants.yaml` define `chaincode` y el peer está vivo. |
