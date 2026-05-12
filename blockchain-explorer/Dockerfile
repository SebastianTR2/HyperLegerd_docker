# Imagen Explorer parcheada: el discovery del peer devolvía "access denied" y el SDK
# lanzaba error fatal. Se desactiva discovery en el Gateway y se inyectan resultados
# estáticos para el test-network (canal clientes, Org1, orderer Raft estándar).
FROM ghcr.io/hyperledger-labs/explorer:latest

COPY patch-gateway.mjs /tmp/patch-gateway.mjs
RUN node /tmp/patch-gateway.mjs && rm -f /tmp/patch-gateway.mjs
