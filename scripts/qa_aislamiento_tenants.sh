#!/usr/bin/env bash
# Prueba de aislamiento entre tenants del BaaS.
#
# Requisitos previos:
#   - api-middleware corriendo en MIDDLEWARE_URL (default :3000)
#   - tenant "clientes" activo con API key SEC_ADMIN
#   - tenant "agricultura" activo con API keys AGRI_INT y AGRI_LECT
#   - Canal "clientes" con cliente_cc desplegado
#   - Canal "agricultura" con dato_cc desplegado
#
# Variables (con valores por defecto):
#   MIDDLEWARE_URL=http://localhost:3000
#   SEC_ADMIN=sec-admin
#   AGRI_INT=agri-int-2026
#   AGRI_LECT=agri-lect-2026
#   DATO_ID=PARCELA-QA-001
#
# Salida: el script termina con código 0 si todas las aserciones pasan.

set -uo pipefail

MIDDLEWARE_URL="${MIDDLEWARE_URL:-http://localhost:3000}"
SEC_ADMIN="${SEC_ADMIN:-sec-admin}"
AGRI_INT="${AGRI_INT:-agri-int-2026}"
AGRI_LECT="${AGRI_LECT:-agri-lect-2026}"
DATO_ID="${DATO_ID:-PARCELA-QA-001}"

PASS=0
FAIL=0

ok()  { echo "  ✅ $1"; PASS=$((PASS+1)); }
ko()  { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

assert_status() {
  local label="$1" expected="$2" url="$3" key="$4" method="${5:-GET}" body="${6:-}"
  local actual
  if [[ -n "$body" ]]; then
    actual=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
      -H "X-API-Key: $key" -H "Content-Type: application/json" -d "$body")
  else
    actual=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" -H "X-API-Key: $key")
  fi
  if [[ "$actual" == "$expected" ]]; then
    ok "$label → $actual"
  else
    ko "$label → esperado $expected, obtenido $actual"
  fi
}

echo "== QA aislamiento de tenants =="
echo "  middleware: $MIDDLEWARE_URL"
echo "  datoId:     $DATO_ID"
echo

# 1. Agricultura registra un dato en su canal
echo "[1] Agricultura crea $DATO_ID en /datos"
assert_status "POST /datos con agri-int" "201" "$MIDDLEWARE_URL/datos" "$AGRI_INT" "POST" \
  "{\"datoId\":\"$DATO_ID\",\"tipo\":\"parcela\",\"payload\":{\"qa\":true,\"hectareas\":5}}"

# 2. Agricultura lo lee
echo "[2] Agricultura lo lee con agri-lect"
assert_status "GET /datos/$DATO_ID con agri-lect" "200" "$MIDDLEWARE_URL/datos/$DATO_ID" "$AGRI_LECT"

# 3. El tenant clientes NO debería ver ese dato en su canal
echo "[3] tenant clientes intenta leer el mismo id en su canal"
assert_status "GET /datos/$DATO_ID con sec-admin (no debe verlo)" "404" \
  "$MIDDLEWARE_URL/datos/$DATO_ID" "$SEC_ADMIN"

# 4. Agricultura NO puede usar /clientes/*
echo "[4] Agricultura intenta /clientes (debe ser 403 TENANT_NO_AUTORIZADO)"
assert_status "GET /clientes con agri-lect" "403" "$MIDDLEWARE_URL/clientes" "$AGRI_LECT"

# 5. Historial del dato es consultable
echo "[5] Historial inmutable del dato"
assert_status "GET /datos/$DATO_ID/historial con agri-lect" "200" \
  "$MIDDLEWARE_URL/datos/$DATO_ID/historial" "$AGRI_LECT"

# 6. lectura no puede crear
echo "[6] rol lectura no puede crear"
assert_status "POST /datos con agri-lect (debe ser 403)" "403" "$MIDDLEWARE_URL/datos" "$AGRI_LECT" "POST" \
  "{\"datoId\":\"PARCELA-QA-002\",\"tipo\":\"parcela\",\"payload\":{\"x\":1}}"

# 7. Credencial inválida
echo "[7] credencial fantasma"
assert_status "POST /datos con clave inventada" "403" "$MIDDLEWARE_URL/datos" "no-existe" "POST" \
  "{\"datoId\":\"x\",\"tipo\":\"x\",\"payload\":{}}"

echo
echo "== Resultado =="
echo "  ✅ pass: $PASS"
echo "  ❌ fail: $FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
