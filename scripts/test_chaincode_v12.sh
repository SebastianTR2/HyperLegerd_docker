#!/usr/bin/env bash
set -e
export PATH=/mnt/c/Users/PC/OneDrive/Escritorio/Universidad/5to_Semestre/equipo02/red-hyperledger/bin:/usr/local/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export FABRIC_CFG_PATH=/mnt/c/Users/PC/OneDrive/Escritorio/Universidad/5to_Semestre/equipo02/red-hyperledger/config

TN=/mnt/c/Users/PC/OneDrive/Escritorio/Universidad/5to_Semestre/equipo02/red-hyperledger/test-network
cd "$TN"
source ./scripts/envVar.sh
setGlobals 1

ORDERER_TLS="$TN/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem"
PEER1_TLS="$TN/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem"
PEER2_TLS="$TN/organizations/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem"

echo "=== Version comprometida ==="
peer lifecycle chaincode querycommitted -C clientes --name cliente_cc

echo ""
echo "=== ObtenerHistorialRevisiones(CLI103) - debe devolver array vacio ==="
peer chaincode query -C clientes -n cliente_cc \
  -c '{"Args":["ObtenerHistorialRevisiones","CLI103"]}' 2>&1

echo ""
echo "=== CrearBorrador(CLI103) ==="
peer chaincode invoke \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile "$ORDERER_TLS" \
  -C clientes -n cliente_cc \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$PEER1_TLS" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$PEER2_TLS" \
  -c '{"Args":["CrearBorrador","CLI103"]}' 2>&1

echo ""
echo "=== Verificar borrador CLI103_DRAFT ==="
sleep 3
peer chaincode query -C clientes -n cliente_cc \
  -c '{"Args":["ReadAsset","CLI103_DRAFT"]}' 2>&1
