# Changelog — Sprint 3 multi-tenant BaaS

Esta entrega convierte el middleware en un BaaS multi-tenant: el sistema original (`clientes`) sigue intacto y se incorpora una segunda empresa (`agricultura`) con su propio canal Fabric y chaincode genérico.

## Pasos implementados (P1 → P14)

| Paso | Entregable | Archivo(s) |
|------|-----------|-----------|
| P1 | Documento de arquitectura | `docs/arquitectura-multi-tenant.md` |
| P2 | Diseño de `tenants.yaml` + `.env.example` actualizado | `api-middleware/config/tenants.example.yaml`, `api-middleware/.env.example` |
| P3 | Gateway por tenant (`map[tenant]*Gateway`) con backcompat | `api-middleware/internal/tenants/config.go`, `api-middleware/internal/fabric/connection.go`, `api-middleware/internal/fabric/gateway.go` |
| P4 | `XAPIKeyAuth` resuelve `(tenantId, rol)` desde la API key | `api-middleware/internal/middleware/api_key_roles.go` |
| P5 | Handlers `/chaincode/invocar` y `/datos/*` son tenant-aware; `/clientes/*` y `/tokens/*` quedan reservados al tenant base con `RequireTenants` | `api-middleware/internal/handlers/chaincode_handlers.go`, `api-middleware/internal/handlers/dato_handler.go`, `api-middleware/internal/routes/routes.go` |
| P6 | Bitácora + eventos SSE etiquetados con `tenant` | `api-middleware/internal/bitacora/solicitudes.go`, `api-middleware/internal/middleware/audit.go`, `api-middleware/internal/fabric/events.go` |
| P7-P8 | Script para crear canal `agricultura` (modo simple o multiorg con Org3) | `scripts/fabric-despliegue/agregar_tenant_agricultura.sh` |
| P9 | Chaincode genérico `dato_cc` (CRUD + historial + JSON libre) | `red-hyperledger/dato-cc/chaincode-go/**` |
| P10 | Mismo script anterior despliega `dato_cc` | `scripts/fabric-despliegue/agregar_tenant_agricultura.sh` |
| P11 | Endpoints `/datos*` (CRUD + historial) | `api-middleware/internal/handlers/dato_handler.go`, `api-middleware/internal/routes/routes.go`, `api-middleware/internal/middleware/validator.go` |
| P12 | Guía de onboarding para nuevas empresas + ejemplos curl | `docs/onboarding-cliente-nuevo.md` |
| P13 | Tests unitarios de `tenants` + script QA de aislamiento | `api-middleware/internal/tenants/config_test.go`, `scripts/qa_aislamiento_tenants.sh` |
| P14 | k6 multi-tenant + plantilla de reporte (Sprint 3.4) | `pruebas-carga/k6-tenants.js`, `pruebas-carga/README.md`, `docs/3.4-pruebas-carga.md` |

## Compatibilidad hacia atrás

- El `.env` actual sigue funcionando sin tocar nada: si **no** se define `TENANTS_FILE`, el middleware arranca en modo single-tenant igual que antes (un solo tenant llamado `clientes` con las API keys clásicas `API_KEY_ADMIN/INTEGRADOR/SOLO_LECTURA`).
- Para activar multi-tenant: definir `TENANTS_FILE=./config/tenants.yaml` y poblarlo (ver `config/tenants.example.yaml`).
- `GlobalGateway` apunta al tenant por defecto, así los handlers de `cliente_cc` y `token_erc20` no requirieron cambios.
- Los endpoints `/clientes/*` y `/tokens/*` rechazan API keys de otros tenants con `403 TENANT_NO_AUTORIZADO`.

## Aislamiento entre tenants

| Recurso | ¿Aislado? | Cómo |
|---------|-----------|------|
| Ledger | Sí | Canal Fabric distinto. |
| Identidad MSP | Sí | Cert + llave por tenant en `tenants.yaml`. |
| API key | Sí | Indexadas; duplicados rechazados al cargar el archivo. |
| Auditoría | Sí | Líneas JSONL con campo `tenant`. |
| Eventos SSE | Sí | `EventoNormalizado` lleva `tenant` y `canal`. |

## Cómo verificar localmente

```bash
# Build + tests
cd api-middleware
go build ./...
go test ./...

# Compilar chaincode genérico
cd ../red-hyperledger/dato-cc/chaincode-go
GOSUMDB=off go build ./...

# Con red Fabric levantada (clientes activo)
cd ../../..
./scripts/fabric-despliegue/agregar_tenant_agricultura.sh simple

# Activar multi-tenant
cp api-middleware/config/tenants.example.yaml api-middleware/config/tenants.yaml
# editar rutas/claves reales
echo "TENANTS_FILE=./config/tenants.yaml" >> api-middleware/.env

# Arrancar middleware
cd api-middleware && go run ./cmd/server

# Suite QA
../scripts/qa_aislamiento_tenants.sh

# Carga
k6 run ../pruebas-carga/k6-tenants.js
```

## Estado de los entregables del Sprint 3

| Item Sprint 3 | Estado |
|---------------|--------|
| 3.1 Historial por registro (`GET /clientes/historial/:id`) | ya completo previo |
| 3.2 Línea de tiempo + diff (`/historial-resumido`) | ya completo previo |
| 3.3 Auditoría administrativa por bitácora + eventos | ya completo previo |
| 3.4 Pruebas de carga | ✅ ahora completo (k6 + docs) |
| Multi-tenant / nueva empresa (`agricultura`) | ✅ implementado |
| Onboarding documentado para empresas externas | ✅ `docs/onboarding-cliente-nuevo.md` |

## Próximos pasos (fuera del scope P1-P14)

- Conectar la web real de Agricultura contra `/datos/*` (frontend del cliente externo).
- Endurecer CORS (lista blanca) cuando salga de desarrollo.
- Migrar `tenants.yaml` a una fuente segura (Vault, KMS) en producción.
- Política de endoso multi-org real en `agricultura` (requiere `multiorg` + ajustar lifecycle).
