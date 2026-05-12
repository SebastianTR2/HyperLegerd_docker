#!/usr/bin/env bash
# Copia la clave privada de Admin@org1 al nombre priv_sk (Explorer lo espera así).
# Con Fabric CA el fichero real suele ser <hash>_sk; en bind mounts Windows->Docker los symlinks suelen fallar, por eso se usa cp.

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
TN_ROOT="${FABRIC_TEST_NETWORK_ROOT:-$SCRIPT_DIR/../red-hyperledger/test-network}"
KEYSTORE="$TN_ROOT/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore"

if [[ ! -d "$KEYSTORE" ]]; then
	echo "No existe el keystore de Admin: $KEYSTORE" >&2
	echo "Levanta antes la red: cd red-hyperledger/test-network && ./network.sh up createChannel -ca -s couchdb -c clientes" >&2
	exit 1
fi

shopt -s nullglob
keys=()
for f in "$KEYSTORE"/*_sk; do
	[[ -e "$f" ]] || continue
	[[ "$(basename "$f")" == "priv_sk" ]] && continue
	keys+=("$f")
done

if [[ ${#keys[@]} -eq 0 ]]; then
	echo "No hay archivo *_sk (distinto de priv_sk) en $KEYSTORE" >&2
	exit 1
fi

if [[ ${#keys[@]} -gt 1 ]]; then
	echo "Aviso: hay varias claves *_sk; se usa la primera: ${keys[0]}" >&2
fi

SRC="${keys[0]}"
cp -f "$SRC" "$KEYSTORE/priv_sk"
echo "Listo: $KEYSTORE/priv_sk (copiado desde $(basename "$SRC"))"
