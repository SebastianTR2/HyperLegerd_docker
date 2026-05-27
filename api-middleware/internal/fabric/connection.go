package fabric

import (
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"api-middleware/internal/tenants"

	"github.com/hyperledger/fabric-gateway/pkg/client"
	"github.com/hyperledger/fabric-gateway/pkg/identity"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// GlobalGateway es la instancia persistente del cliente de Fabric.
//
// Compatibilidad legacy: cuando se opera en modo single-tenant, apunta al
// gateway del tenant por defecto ("clientes").
var GlobalGateway *client.Gateway

var (
	gatewaysMu sync.RWMutex
	gateways   = map[string]*client.Gateway{} // tenantId → gateway

	tenantsMu sync.RWMutex
	registry  *tenants.Registry
)

// Connect mantiene el comportamiento legacy: si hay TENANTS_FILE válido se
// conectan todos los tenants definidos; en caso contrario se construye un
// registro single-tenant a partir del .env.
//
// Esta función no rompe el flujo existente: tras llamarla, GlobalGateway sigue
// apuntando al tenant por defecto y los handlers legacy siguen funcionando.
func Connect() error {
	reg, _, err := tenants.Load()
	if err != nil {
		return fmt.Errorf("cargar configuración de tenants: %w", err)
	}
	return ConnectAll(reg)
}

// ConnectAll abre un Gateway por cada tenant del registro y guarda referencias.
// Si algún tenant falla se registra el error pero se continúa con los demás
// (el middleware puede arrancar parcialmente y reportar fallos).
func ConnectAll(reg *tenants.Registry) error {
	if reg == nil || len(reg.Tenants) == 0 {
		return errors.New("no hay tenants para conectar")
	}

	tenantsMu.Lock()
	registry = reg
	tenantsMu.Unlock()

	var firstErr error
	var errsTenants []string
	for id, t := range reg.Tenants {
		gw, err := connectTenant(t)
		if err != nil {
			errsTenants = append(errsTenants, fmt.Sprintf("%s: %v", id, err))
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		gatewaysMu.Lock()
		gateways[id] = gw
		gatewaysMu.Unlock()
	}

	// GlobalGateway apunta al tenant por defecto (para compat con handlers viejos).
	if gw, ok := gatewayFor(reg.Default); ok {
		GlobalGateway = gw
	}

	if len(errsTenants) > 0 {
		return fmt.Errorf("fallaron tenants: %s", strings.Join(errsTenants, "; "))
	}
	return firstErr
}

// Registry devuelve el registro multi-tenant cargado (puede ser nil si Connect aún no se ejecutó).
func Registry() *tenants.Registry {
	tenantsMu.RLock()
	defer tenantsMu.RUnlock()
	return registry
}

// GatewayFor devuelve el gateway del tenant indicado. Si el tenant no existe o
// no se conectó, devuelve (nil, false).
func GatewayFor(tenantID string) (*client.Gateway, bool) {
	return gatewayFor(tenantID)
}

// TenantFor devuelve el objeto Tenant para un id dado.
func TenantFor(tenantID string) (*tenants.Tenant, bool) {
	tenantsMu.RLock()
	defer tenantsMu.RUnlock()
	if registry == nil {
		return nil, false
	}
	t := registry.Get(tenantID)
	if t == nil {
		return nil, false
	}
	return t, true
}

func gatewayFor(tenantID string) (*client.Gateway, bool) {
	gatewaysMu.RLock()
	defer gatewaysMu.RUnlock()
	gw, ok := gateways[strings.TrimSpace(tenantID)]
	return gw, ok
}

func connectTenant(t *tenants.Tenant) (*client.Gateway, error) {
	if t == nil {
		return nil, errors.New("tenant nil")
	}
	if strings.TrimSpace(t.MSPID) == "" {
		return nil, fmt.Errorf("tenant %s sin MSPID", t.ID)
	}

	id, err := loadIdentity(t.MSPID, t.CertPath)
	if err != nil {
		return nil, fmt.Errorf("identidad: %w", err)
	}
	signer, err := loadSigner(t.KeyPathDir)
	if err != nil {
		return nil, fmt.Errorf("firmante: %w", err)
	}
	grpcConn, err := createGrpcConnection(t.TLSCertPath, t.PeerEndpoint, t.PeerHostAlias)
	if err != nil {
		return nil, fmt.Errorf("gRPC: %w", err)
	}
	gw, err := client.Connect(
		id,
		client.WithSign(signer),
		client.WithClientConnection(grpcConn),
		client.WithEvaluateTimeout(5*time.Second),
		client.WithEndorseTimeout(15*time.Second),
		client.WithSubmitTimeout(5*time.Second),
		client.WithCommitStatusTimeout(1*time.Minute),
	)
	if err != nil {
		return nil, fmt.Errorf("gateway: %w", err)
	}
	return gw, nil
}

func loadIdentity(mspID string, certPath string) (identity.Identity, error) {
	if strings.TrimSpace(certPath) == "" {
		return nil, errors.New("CERT_PATH vacío")
	}
	certBytes, err := os.ReadFile(certPath)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(certBytes)
	if block == nil {
		return nil, errors.New("error al decodificar el certificado PEM")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("error al parsear el certificado: %w", err)
	}

	return identity.NewX509Identity(mspID, cert)
}

func loadSigner(keyPathDir string) (func(digest []byte) ([]byte, error), error) {
	if strings.TrimSpace(keyPathDir) == "" {
		return nil, errors.New("KEY_PATH_DIR vacío")
	}
	files, err := os.ReadDir(keyPathDir)
	if err != nil {
		return nil, err
	}

	var keyFile string
	for _, file := range files {
		if !file.IsDir() && filepath.Ext(file.Name()) == ".pem" {
			keyFile = filepath.Join(keyPathDir, file.Name())
			break
		}
	}
	if keyFile == "" && len(files) > 0 {
		keyFile = filepath.Join(keyPathDir, files[0].Name())
	}

	keyBytes, err := os.ReadFile(keyFile)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(keyBytes)
	if block == nil {
		return nil, errors.New("error al decodificar la llave privada PEM")
	}

	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		privateKey, err = x509.ParseECPrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("error al parsear la llave privada: %w", err)
		}
	}

	signer, err := identity.NewPrivateKeySign(privateKey)
	if err != nil {
		return nil, fmt.Errorf("error al crear el signer oficial: %w", err)
	}

	return signer, nil
}

func createGrpcConnection(tlsCertPath string, peerEndpoint string, peerHostAlias string) (*grpc.ClientConn, error) {
	if strings.TrimSpace(tlsCertPath) == "" {
		return nil, errors.New("TLS_CERT_PATH vacío")
	}
	cert, err := os.ReadFile(tlsCertPath)
	if err != nil {
		return nil, err
	}

	certPool := x509.NewCertPool()
	certPool.AppendCertsFromPEM(cert)

	creds := credentials.NewClientTLSFromCert(certPool, peerHostAlias)
	return grpc.Dial(peerEndpoint, grpc.WithTransportCredentials(creds))
}
