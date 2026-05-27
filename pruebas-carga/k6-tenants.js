// k6 load test multi-tenant para api-middleware.
//
// Ejecutar:
//   k6 run pruebas-carga/k6-tenants.js
//
// Variables (k6 -e KEY=VALUE):
//   BASE          base URL del middleware (default http://localhost:3000)
//   SEC_ADMIN     api key del tenant base, rol admin
//   AGRI_INT      api key del tenant agricultura, rol integrador
//   AGRI_LECT     api key del tenant agricultura, rol lectura
//
// Escenarios:
//   1) lectura masiva en tenant clientes (GET /clientes)
//   2) escritura sostenida en tenant agricultura (POST /datos)
//   3) lectura sostenida en tenant agricultura (GET /datos/{id})
//
// Umbrales (thresholds) que se reportan en el resumen final:
//   - http_req_failed < 5 %
//   - p(95) < 1500 ms para lecturas
//   - p(95) < 3000 ms para escrituras (commit Fabric incluido)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://localhost:3000';
const SEC_ADMIN = __ENV.SEC_ADMIN || 'sec-admin';
const AGRI_INT = __ENV.AGRI_INT || 'agri-int-2026';
const AGRI_LECT = __ENV.AGRI_LECT || 'agri-lect-2026';

const writes = new Counter('agri_writes_ok');
const reads = new Counter('agri_reads_ok');
const writeLatency = new Trend('agri_write_latency_ms', true);

export const options = {
  scenarios: {
    lectura_clientes: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'leerClientes',
      tags: { tenant: 'clientes' },
    },
    escritura_agricultura: {
      executor: 'ramping-vus',
      stages: [
        { duration: '10s', target: 3 },
        { duration: '20s', target: 5 },
        { duration: '10s', target: 0 },
      ],
      exec: 'escribirAgri',
      tags: { tenant: 'agricultura' },
    },
    lectura_agricultura: {
      executor: 'constant-vus',
      vus: 4,
      duration: '40s',
      exec: 'leerAgri',
      tags: { tenant: 'agricultura' },
      startTime: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{scenario:lectura_clientes}': ['p(95)<1500'],
    'http_req_duration{scenario:lectura_agricultura}': ['p(95)<1500'],
    'http_req_duration{scenario:escritura_agricultura}': ['p(95)<3000'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function leerClientes() {
  const res = http.get(`${BASE}/clientes`, {
    headers: { 'X-API-Key': SEC_ADMIN, Accept: 'application/json' },
    tags: { name: 'GET /clientes' },
  });
  check(res, { 'GET /clientes 200': (r) => r.status === 200 });
  sleep(1);
}

export function escribirAgri() {
  const id = `K6-${__VU}-${__ITER}-${Date.now()}`;
  const body = JSON.stringify({
    datoId: id,
    tipo: 'parcela',
    payload: {
      origen: 'k6',
      hectareas: Math.random() * 20,
      cultivo: 'quinua',
    },
  });
  const t0 = Date.now();
  const res = http.post(`${BASE}/datos`, body, {
    headers: { 'X-API-Key': AGRI_INT, 'Content-Type': 'application/json' },
    tags: { name: 'POST /datos' },
  });
  writeLatency.add(Date.now() - t0);
  if (check(res, { 'POST /datos 201': (r) => r.status === 201 })) {
    writes.add(1);
  }
}

export function leerAgri() {
  const res = http.get(`${BASE}/datos`, {
    headers: { 'X-API-Key': AGRI_LECT, Accept: 'application/json' },
    tags: { name: 'GET /datos' },
  });
  if (check(res, { 'GET /datos 200': (r) => r.status === 200 })) {
    reads.add(1);
  }
  sleep(0.5);
}
