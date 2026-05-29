# Prompt para integrar Agro con BaaS (copiar al otro chat)

## Precondición (YA HECHA en este entorno)

- Canal Fabric `agricultura` + chaincode `dato_cc` (secuencia 2).
- `api-middleware/config/tenants.yaml` con tenant `agricultura`.
- Middleware en `http://localhost:3000` con `TENANTS_FILE` y CORS para Agro.
- Prueba OK: `POST/PUT/GET /datos` y `GET /datos/{id}/historial` con keys `agri-*`.

---

## Texto del prompt

```
Workspace: /Users/evato/Developer/Proyecto_Hyperledger
- Agro (Laravel 12 + Inertia): /Users/evato/Developer/Proyecto_Hyperledger/Agro
- Middleware BaaS: /Users/evato/Developer/Proyecto_Hyperledger/proyecto-blockchain/api-middleware

PRECONDICIÓN CUMPLIDA: canal agricultura, dato_cc y middleware multi-tenant operativos.
No modificar api-middleware salvo CORS si cambia el puerto de Agro.

## Estado de Agro hoy
- SOLO CRUD SQLite: Lote, Actividad, Produccion (controladores dicen "persistencia local únicamente").
- Sin blockchain, sin Http:: al middleware, sin .env BLOCKCHAIN_*.
- Clave de negocio: lote.codigo_trazabilidad (único, usado en rutas /lotes/{codigo}).

## Objetivo (requisito del inge)
Cada lote debe guardarse en blockchain CON su proceso (actividades + cosechas).
Tras cada mutación local exitosa, sincronizar snapshot al middleware.

## API del middleware (tenant deducido por X-API-Key, NO enviar X-Tenant)
Base: http://127.0.0.1:3000
Keys de prueba:
  agri-int-2026   → integrador (POST/PUT)
  agri-lect-2026  → solo lectura (GET historial)
  agri-admin-2026 → admin (DELETE)

Endpoints:
  POST   /datos              body: { datoId, tipo, payload }
  PUT    /datos/{datoId}     mismo body (datoId = codigo_trazabilidad)
  GET    /datos/{datoId}
  GET    /datos/{datoId}/historial
  DELETE /datos/{datoId}     solo admin

Modelo on-chain (v1):
  datoId = codigo_trazabilidad del lote
  tipo   = "lote"
  payload = snapshot JSON (lote + actividades[] + producciones[] + sincronizadoEn ISO-8601)
  Usar POST si el dato no existe; PUT si ya existe (o GET previo para decidir).

## Implementar en Agro (Laravel, servidor a servidor)

1. .env.example:
   BLOCKCHAIN_ENABLED=true
   BLOCKCHAIN_API_URL=http://127.0.0.1:3000
   BLOCKCHAIN_API_KEY=agri-int-2026
   BLOCKCHAIN_SYNC_ON_FAILURE=block

2. config/blockchain.php

3. app/Services/Blockchain/DatosBlockchainClient.php (Http facade, timeout 60s, header X-API-Key)

4. app/Services/Blockchain/LoteBlockchainSync.php — construir payload desde lote con relaciones

5. Hooks tras DB exitosa en:
   - LoteController: store, update, destroy
   - ActividadController: store, update, destroy → sync lote padre
   - ProduccionController: store, destroy → sync lote padre

6. Migración opcional en lote: blockchain_tx_id, blockchain_synced_at, blockchain_last_error

7. Rutas + LoteBlockchainController para proxy historial (GET) — solo servidor, no desde React

8. UI en lotes/show.tsx: badge txId + sección "Historial en cadena" vía Inertia props

9. Tests con Http::fake()

NO exponer API key en VITE_* ni fetch desde React al puerto 3000.

## Criterios de aceptación
- Crear lote en Agro → POST /datos con mismo codigo_trazabilidad → 201 + txId
- Añadir actividad → PUT con payload.actividades actualizado → historial ≥ 2 entradas
- GET historial desde Laravel muestra evolución del proceso
- sec-admin no lee datos de agricultura (404)

## Archivos Agro a tocar
app/Http/Controllers/LoteController.php, ActividadController.php, ProduccionController.php
app/Services/Blockchain/*, config/blockchain.php, routes/web.php
resources/js/pages/lotes/show.tsx, .env.example, README.md, tests/
```
