#!/usr/bin/env bash
#
# Agrega el tenant "agricultura" al test-network del proyecto.
#
# Crea el canal `agricultura` y despliega el chaincode `dato_cc` (genérico).
#
# Modos:
#   simple     (default) — usa Org1 y Org2 ya existentes para el nuevo canal.
#                         Endoso mayoría Org1+Org2 (igual que el canal clientes).
#   multiorg              — incorpora Org3 vía addOrg3 y la trata como
#                         OrgAgriculturaMSP para la entrega académica.
#                         (NOTA: addOrg3 fuerza la unión al canal mychannel
#                         por defecto. Para Agricultura, el canal a usar es
#                         el ya creado `clientes` o el nuevo `agricultura`.)
#
# Requisitos:
#   - Red levantada con `./network.sh up createChannel -ca -s couchdb -c clientes`
#   - Chaincode dato_cc ya construido en red-hyperledger/dato-cc/chaincode-go/
#   - Binarios Fabric en red-hyperledger/bin (PATH).
#
# Variables:
#   PROYECTO_BLOCKCHAIN_ROOT   ruta absoluta a proyecto-blockchain/ (autodetectada).
#   AGRI_CHANNEL               nombre del canal (default: agricultura).
#   AGRI_CC_NAME               nombre del chaincode (default: dato_cc).
#   AGRI_CC_VERSION            versión del chaincode (default: 1.0).
#   AGRI_CC_SEQUENCE           secuencia (default: 1).

set -euo pipefail

MODE="${1:-simple}"
shift || true

ROOT="${PROYECTO_BLOCKCHAIN_ROOT:-}"
if [[ -z "$ROOT" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi

TN="$ROOT/red-hyperledger/test-network"
if [[ ! -f "$TN/network.sh" ]]; then
  echo "No se encontró test-network en: $TN" >&2
  exit 1
fi

AGRI_CHANNEL="${AGRI_CHANNEL:-agricultura}"
AGRI_CC_NAME="${AGRI_CC_NAME:-dato_cc}"
AGRI_CC_VERSION="${AGRI_CC_VERSION:-1.0}"
AGRI_CC_SEQUENCE="${AGRI_CC_SEQUENCE:-1}"
AGRI_CC_SRC="${AGRI_CC_SRC:-../dato-cc/chaincode-go}"

echo "== Agregar tenant agricultura =="
echo "  modo: $MODE"
echo "  ROOT: $ROOT"
echo "  test-network: $TN"
echo "  canal: $AGRI_CHANNEL"
echo "  chaincode: $AGRI_CC_NAME (src=$AGRI_CC_SRC, ver=$AGRI_CC_VERSION, seq=$AGRI_CC_SEQUENCE)"

cd "$TN"
export PATH="${TN}/../bin:${PATH:-}"

case "$MODE" in
  simple)
    echo "--> 1/2 Creando canal $AGRI_CHANNEL con Org1 + Org2 existentes"
    ./network.sh createChannel -c "$AGRI_CHANNEL" -ca -s couchdb || true

    echo "--> 2/2 Desplegando chaincode $AGRI_CC_NAME en $AGRI_CHANNEL"
    ./network.sh deployCC \
      -c "$AGRI_CHANNEL" \
      -ccn "$AGRI_CC_NAME" \
      -ccp "$AGRI_CC_SRC" \
      -ccl go \
      -ccv "$AGRI_CC_VERSION" \
      -ccs "$AGRI_CC_SEQUENCE" \
      -cci "NA"
    ;;

  multiorg)
    if [[ ! -x "$TN/addOrg3/addOrg3.sh" ]]; then
      echo "addOrg3.sh no es ejecutable en $TN/addOrg3/" >&2
      chmod +x "$TN/addOrg3/addOrg3.sh"
    fi

    echo "--> 1/3 Generando material de Org3 (= OrgAgricultura)"
    pushd "$TN/addOrg3" >/dev/null
    ./addOrg3.sh generate
    popd >/dev/null

    echo "--> 2/3 Levantando Org3 y uniéndola al canal existente \"$AGRI_CHANNEL\""
    echo "    (asegúrese de haber creado primero ese canal con createChannel -c $AGRI_CHANNEL)"
    pushd "$TN/addOrg3" >/dev/null
    ./addOrg3.sh up -c "$AGRI_CHANNEL" -ca -s couchdb
    popd >/dev/null

    echo "--> 3/3 Desplegando $AGRI_CC_NAME en $AGRI_CHANNEL (Org1 + Org2 + Org3)"
    ./network.sh deployCC \
      -c "$AGRI_CHANNEL" \
      -ccn "$AGRI_CC_NAME" \
      -ccp "$AGRI_CC_SRC" \
      -ccl go \
      -ccv "$AGRI_CC_VERSION" \
      -ccs "$AGRI_CC_SEQUENCE" \
      -cci "NA"
    ;;

  *)
    echo "Modo desconocido: $MODE (usar 'simple' o 'multiorg')" >&2
    exit 2
    ;;
esac

echo
echo "✅ Tenant agricultura listo."
echo "   - Canal Fabric: $AGRI_CHANNEL"
echo "   - Chaincode:    $AGRI_CC_NAME"
echo
echo "Siguiente paso: poblar config/tenants.yaml con las rutas de certs y reiniciar el middleware."
echo "Verificación rápida desde test-network:"
echo "  peer chaincode query -C $AGRI_CHANNEL -n $AGRI_CC_NAME -c '{\"function\":\"GetAllDatos\",\"Args\":[]}'"
