# Pruebas de carga (Sprint 3.4)

Script k6 multi-tenant para validar estabilidad y latencia del **api-middleware** frente a operaciones de lectura y escritura simultáneas en dos tenants (`clientes` + `agricultura`).

## Requisitos

- [k6](https://k6.io/docs/get-started/installation/) instalado (`brew install k6` en macOS).
- Middleware corriendo en `http://localhost:3000`.
- Red Fabric arriba con `cliente_cc` y `dato_cc` desplegados.
- API keys configuradas en `config/tenants.yaml` (o `.env` legacy).

## Ejecución básica

```bash
k6 run pruebas-carga/k6-tenants.js
```

## Ejecución con variables custom

```bash
k6 run \
  -e BASE=http://localhost:3000 \
  -e SEC_ADMIN=sec-admin \
  -e AGRI_INT=agri-int-2026 \
  -e AGRI_LECT=agri-lect-2026 \
  pruebas-carga/k6-tenants.js
```

## Exportar reporte

```bash
k6 run --summary-export=reporte.json pruebas-carga/k6-tenants.js
```

Para HTML legible:

```bash
k6 run --out json=results.json pruebas-carga/k6-tenants.js
# usar k6-reporter o convertir manualmente
```

## Escenarios

| Escenario | Carga | Duración |
|-----------|-------|----------|
| Lectura `clientes` (`GET /clientes`) | 5 VUs constantes | 30 s |
| Escritura `agricultura` (`POST /datos`) | rampa 0→5 VUs | 40 s |
| Lectura `agricultura` (`GET /datos`) | 4 VUs constantes | 40 s |

## Umbrales

- Tasa de error global < 5 %.
- p95 de lecturas < 1500 ms.
- p95 de escrituras (incluye commit Fabric) < 3000 ms.

Si la prueba falla por timeout o saturación, revisar logs del middleware (`[BITACORA_RESULTADO]` con `error_servidor`) y el estado de los peers Fabric.
