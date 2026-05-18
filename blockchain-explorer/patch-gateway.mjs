/**
 * Parche en build de la imagen Explorer: discovery del peer puede devolver "access denied".
 * - Desactiva solo el bloque discovery de gateway.connect (no toca otros "enabled: true" del archivo).
 * - Sustituye getDiscoveryResult por topología estática (test-network estándar).
 * - Parchea getActiveOrderersList para que el orderer aparezca como conectado.
 * Idempotente: si vuelves a ejecutar el RUN sobre una capa ya parcheada, no rompe.
 */
import fs from 'fs';

const path = '/opt/explorer/app/platform/fabric/gateway/FabricGateway.js';
let s = fs.readFileSync(path, 'utf8');

const discoveryConnectNeedle = `                    discovery: {
                        enabled: true,
                        asLocalhost: this.asLocalhost
                    },`;
const discoveryConnectPatched = `                    discovery: {
                        enabled: false,
                        asLocalhost: this.asLocalhost
                    },`;

if (s.includes(discoveryConnectPatched)) {
    console.log('patch-gateway: discovery en gateway.connect ya desactivado.');
} else if (s.includes(discoveryConnectNeedle)) {
    s = s.replace(discoveryConnectNeedle, discoveryConnectPatched);
    console.log('patch-gateway: discovery en gateway.connect -> enabled: false.');
} else {
    console.error(
        'patch-gateway: no se encontró el bloque "discovery: { enabled: true" de gateway.connect. ¿Cambió la imagen upstream?'
    );
    process.exit(1);
}

const stubMarker = "endpoint: 'peer0.org1.example.com:7051'";
if (s.includes(stubMarker) && s.includes('getDiscoveryResult(channelName)')) {
    console.log('patch-gateway: getDiscoveryResult ya contenía el stub estático.');
} else {
    const re =
        /getDiscoveryResult\(channelName\)\s*\{\s*return __awaiter\(this,\s*void 0,\s*void 0,\s*function\*\s*\(\)\s*\{\s*yield this\.setupDiscoveryRequest\(channelName\);\s*if \(!this\.dsTargets\.length\) \{\s*this\.dsTargets = yield this\.getDiscoveryServiceTarget\(\);\s*\}\s*if \(this\.ds && this\.dsTargets\.length\) \{\s*const result = yield this\.sendDiscoveryRequest\(\);\s*return result;\s*\}\s*return null;\s*\}\);\s*\}/;

    const stub = `getDiscoveryResult(channelName) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                peers_by_org: {
                    Org1MSP: {
                        peers: [
                            {
                                mspid: 'Org1MSP',
                                endpoint: 'peer0.org1.example.com:7051',
                                ledgerHeight: {
                                    low: 10,
                                    high: 0,
                                    unsigned: true
                                },
                                chaincodes: []
                            }
                        ]
                    },
                    Org2MSP: {
                        peers: [
                            {
                                mspid: 'Org2MSP',
                                endpoint: 'peer0.org2.example.com:9051',
                                ledgerHeight: {
                                    low: 10,
                                    high: 0,
                                    unsigned: true
                                },
                                chaincodes: []
                            }
                        ]
                    }
                },
                orderers: {
                    OrdererMSP: {
                        endpoints: [{ host: 'orderer.example.com', port: 7050 }]
                    }
                }
            };
        });
    }`;

    if (!re.test(s)) {
        const i = s.indexOf('getDiscoveryResult(channelName)');
        console.error('patch-gateway: no coincide el cuerpo original de getDiscoveryResult. Fragmento:');
        console.error(i === -1 ? '(no encontrado)' : s.slice(i, i + 900));
        process.exit(1);
    }
    s = s.replace(re, stub);
    console.log('patch-gateway: getDiscoveryResult sustituido por resultados estáticos.');
}

const activeOrderersPatched = `    getActiveOrderersList(channel_name) {
        return __awaiter(this, void 0, void 0, function* () {
            return [
                {
                    name: 'orderer.example.com',
                    connected: true
                },
                {
                    name: 'orderer.example.com:7050',
                    connected: true
                }
            ];
        });
    }`;

if (s.includes(activeOrderersPatched)) {
    console.log('patch-gateway: getActiveOrderersList ya está parcheado.');
} else {
    const activeOrderersOriginal = `    getActiveOrderersList(channel_name) {
        return __awaiter(this, void 0, void 0, function* () {
            const network = yield this.gateway.getNetwork(channel_name);
            let orderers = [];
            try {
                for (let [orderer, ordererMetadata] of network.discoveryService.channel.committers) {
                    let ordererAtrributes = {
                        name: orderer,
                        connected: ordererMetadata.connected
                    };
                    orderers.push(ordererAtrributes);
                }
                return orderers;
            }
            catch (error) {
                logger.error(\`Failed to get orderers list : \`, error);
                return orderers;
            }
        });
    }`;

    if (s.includes(activeOrderersOriginal)) {
        s = s.replace(activeOrderersOriginal, activeOrderersPatched);
        console.log('patch-gateway: getActiveOrderersList parcheado con estado conectado.');
    } else {
        console.error('patch-gateway: no se pudo encontrar la función original getActiveOrderersList.');
        process.exit(1);
    }
}

fs.writeFileSync(path, s);
console.log('patch-gateway: FabricGateway.js listo.');
