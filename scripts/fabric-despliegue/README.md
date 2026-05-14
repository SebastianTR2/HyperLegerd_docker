# Scripts de despliegue de chaincode (test-network)

Esta carpeta encapsula el flujo repetible de **empaquetado + install + approve + commit** sobre la red de prueba oficial del monorepo (`red-hyperledger/test-network`), reutilizando `network.sh deployCC` y los mismos parámetros que `scripts/deployCC.sh`.

## Requisitos

- Docker en ejecución y red levantada con canal creado (por ejemplo `clientes`), según el [README del monorepo](../../README.md).
- Binarios `peer`, `configtxgen`, etc. en el `PATH` (p. ej. `export PATH=$PWD/red-hyperledger/bin:$PATH` desde la raíz del monorepo).
- Ejecutar los scripts **desde la raíz del monorepo** `proyecto-blockchain/` o exportar `PROYECTO_BLOCKCHAIN_ROOT` apuntando a esa ruta.

## Uso rápido

Variables obligatorias:

| Variable | Descripción |
|----------|-------------|
| `CHAINCODE_DEPLOY_NAME` | Nombre lógico del chaincode (`-ccn`) |
| `CHAINCODE_DEPLOY_SRC` | Ruta del código **relativa a** `red-hyperledger/test-network` (p. ej. `../asset-transfer-basic/chaincode-go`) |

Opcionales:

| Variable | Default |
|----------|---------|
| `CHAINCODE_DEPLOY_CHANNEL` | `clientes` |
| `CHAINCODE_DEPLOY_VERSION` | `1.0` |
| `CHAINCODE_DEPLOY_SEQUENCE` | `1` |
| `CHAINCODE_DEPLOY_LANG` | `go` |
| `CHAINCODE_DEPLOY_INIT_FCN` | `NA` (sin `--init-required`) |

Ejemplo (cliente asset, mismo fuente que usa el README del proyecto):

```bash
export CHAINCODE_DEPLOY_NAME=cliente_cc
export CHAINCODE_DEPLOY_SRC=../asset-transfer-basic/chaincode-go
./scripts/fabric-despliegue/desplegar_chaincode_test_network.sh
```

El script termina con código distinto de cero si falta alguna variable o si `network.sh` falla; revise la salida en consola.

## Si `deployCC` falla con `docker.proxy.sock: write: broken pipe`

Ese mensaje viene del **daemon de Docker** al construir la imagen del chaincode. En muchos equipos con **Docker Engine v29+** ocurre porque el proceso **peer dentro del contenedor** (imágenes `fabric-peer` antiguas, p. ej. 2.5.12) usa una librería cliente Docker incompatible; **Fabric 2.5.15+** lo corrige ([nota en Hyperledger Fabric](https://github.com/hyperledger/fabric/issues/5350)).

En este monorepo las imágenes de `compose/*.yaml` usan **`${FABRIC_IMAGE_TAG}`** (por defecto **2.5.15**, vía `network.config` y `network.sh`). Tras actualizar el repo:

```bash
docker pull hyperledger/fabric-peer:2.5.15
docker pull hyperledger/fabric-orderer:2.5.15
docker pull hyperledger/fabric-ca:1.5.15
cd red-hyperledger/test-network
./network.sh down
./network.sh up createChannel -ca -s couchdb -c clientes
./network.sh deployCC ...
```

Otras medidas que ayudan:

1. Cierre Docker Desktop por completo (**Quit Docker Desktop**) y ábralo de nuevo.
2. En Docker Desktop → **Settings → Resources**: suba memoria (p. ej. 8 GB o más) y CPUs; aplique y reinicie.
3. Ajuste `IMAGETAG` / `CA_IMAGETAG` en `network.config` si sus binarios `peer` / `fabric-ca-client` son otra versión compatible, luego `./network.sh down` y vuelva a levantar la red.
4. `export DOCKER_BUILDKIT=0` en el host; los peers también tienen `DOCKER_BUILDKIT=0` en `compose/docker/docker-compose-test-net.yaml`.
5. Compruebe que `docker run --rm hello-world` y un `docker build` pequeño funcionan sin errores.

Los avisos `get docker_orderer.example.com: no such volume` al hacer `down` suelen ser inofensivos si el volumen ya no existe.

### `405 channel already exists` o `ledger [clientes] already exists`

El orderer o los peers conservan datos de un arranque anterior. Haga un apagado limpio y vuelva a subir todo:

```bash
cd red-hyperledger/test-network
export PATH="$PWD/../bin:$PATH"
./network.sh down
docker ps -a   # no deben quedar peer0, orderer, couchdb de esta red
./network.sh up createChannel -ca -s couchdb -c clientes
```

Si el canal **ya está** en los peers (`docker exec peer0.org1.example.com peer channel list` muestra `clientes`), no hace falta repetir `createChannel`: pase directo a `deployCC`.

## Relación con el middleware

El despliegue real del chaincode lifecycle se ejecuta con la **CLI de Fabric** dentro del entorno test-network; el middleware solo **invoca** contratos ya definidos en políticas (`internal/chaincodepolicy/politicas_chaincode.json` o `CHAINCODE_POLITICAS_FILE`).
