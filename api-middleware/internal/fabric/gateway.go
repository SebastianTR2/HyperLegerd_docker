package fabric

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/hyperledger/fabric-gateway/pkg/client"
)

// SubmitResult contiene la información relevante de una escritura en Fabric.
type SubmitResult struct {
	Payload []byte
	TxID    string
}

func canalEfectivo(nombreCanal string) string {
	c := strings.TrimSpace(nombreCanal)
	if c != "" {
		return c
	}
	return strings.TrimSpace(os.Getenv("CHANNEL_NAME"))
}

// defaultTenantGateway devuelve el gateway global (legacy / tenant por defecto).
func defaultTenantGateway() *client.Gateway {
	if GlobalGateway != nil {
		return GlobalGateway
	}
	return nil
}

// InvokeTransaction envía una transacción de escritura al ledger del tenant por defecto.
func InvokeTransaction(chaincodeName string, functionName string, args ...string) ([]byte, error) {
	return InvokeTransactionEnCanal(canalEfectivo(""), chaincodeName, functionName, args...)
}

// InvokeTransactionEnCanal envía una transacción de escritura al canal indicado (tenant por defecto).
func InvokeTransactionEnCanal(channelName string, chaincodeName string, functionName string, args ...string) ([]byte, error) {
	gw := defaultTenantGateway()
	if gw == nil {
		return nil, fmt.Errorf("el gateway no está inicializado")
	}
	return invokeOn(gw, canalEfectivo(channelName), chaincodeName, functionName, args...)
}

// InvokeTransactionTenant envía una transacción al gateway del tenant dado.
// Si channelName / chaincodeName están vacíos, se usan los del tenant en el registro.
func InvokeTransactionTenant(tenantID, channelName, chaincodeName, functionName string, args ...string) ([]byte, error) {
	gw, canal, cc, err := resolveTenant(tenantID, channelName, chaincodeName)
	if err != nil {
		return nil, err
	}
	return invokeOn(gw, canal, cc, functionName, args...)
}

// InvokeTransactionWithTxID envía una escritura y devuelve el txID confirmado (tenant por defecto).
func InvokeTransactionWithTxID(chaincodeName string, functionName string, args ...string) (*SubmitResult, error) {
	return InvokeTransactionWithTxIDEnCanal(canalEfectivo(""), chaincodeName, functionName, args...)
}

// InvokeTransactionWithTxIDEnCanal igual que InvokeTransactionWithTxID pero sobre el canal dado (tenant por defecto).
func InvokeTransactionWithTxIDEnCanal(channelName string, chaincodeName string, functionName string, args ...string) (*SubmitResult, error) {
	gw := defaultTenantGateway()
	if gw == nil {
		return nil, fmt.Errorf("el gateway no está inicializado")
	}
	return invokeAsyncOn(gw, canalEfectivo(channelName), chaincodeName, functionName, args...)
}

// InvokeTransactionWithTxIDTenant envía una escritura al tenant indicado y devuelve el txID confirmado.
func InvokeTransactionWithTxIDTenant(tenantID, channelName, chaincodeName, functionName string, args ...string) (*SubmitResult, error) {
	gw, canal, cc, err := resolveTenant(tenantID, channelName, chaincodeName)
	if err != nil {
		return nil, err
	}
	return invokeAsyncOn(gw, canal, cc, functionName, args...)
}

// EvaluateTransaction realiza una consulta al ledger del tenant por defecto.
func EvaluateTransaction(chaincodeName string, functionName string, args ...string) ([]byte, error) {
	return EvaluateTransactionEnCanal(canalEfectivo(""), chaincodeName, functionName, args...)
}

// EvaluateTransactionEnCanal evalúa sobre el canal indicado (tenant por defecto).
func EvaluateTransactionEnCanal(channelName string, chaincodeName string, functionName string, args ...string) ([]byte, error) {
	gw := defaultTenantGateway()
	if gw == nil {
		return nil, fmt.Errorf("el gateway no está inicializado")
	}
	return evaluateOn(gw, canalEfectivo(channelName), chaincodeName, functionName, args...)
}

// EvaluateTransactionTenant evalúa contra el gateway del tenant dado.
func EvaluateTransactionTenant(tenantID, channelName, chaincodeName, functionName string, args ...string) ([]byte, error) {
	gw, canal, cc, err := resolveTenant(tenantID, channelName, chaincodeName)
	if err != nil {
		return nil, err
	}
	return evaluateOn(gw, canal, cc, functionName, args...)
}

// ToJSON helper para convertir resultados a estructuras.
func ToJSON(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

func resolveTenant(tenantID, channelName, chaincodeName string) (*client.Gateway, string, string, error) {
	id := strings.TrimSpace(tenantID)
	if id == "" {
		// fallback al gateway por defecto + canal/cc del .env
		gw := defaultTenantGateway()
		if gw == nil {
			return nil, "", "", fmt.Errorf("el gateway no está inicializado")
		}
		return gw, canalEfectivo(channelName), chaincodeName, nil
	}
	gw, ok := GatewayFor(id)
	if !ok {
		return nil, "", "", fmt.Errorf("tenant %q no tiene gateway conectado", id)
	}
	t, _ := TenantFor(id)
	canal := strings.TrimSpace(channelName)
	if canal == "" && t != nil {
		canal = t.Canal
	}
	if canal == "" {
		canal = canalEfectivo("")
	}
	cc := strings.TrimSpace(chaincodeName)
	if cc == "" && t != nil {
		cc = t.Chaincode
	}
	return gw, canal, cc, nil
}

func invokeOn(gw *client.Gateway, channelName, chaincodeName, functionName string, args ...string) ([]byte, error) {
	network := gw.GetNetwork(channelName)
	contract := network.GetContract(chaincodeName)
	result, err := contract.SubmitTransaction(functionName, args...)
	if err != nil {
		return nil, fmt.Errorf("error al enviar transacción: %w", err)
	}
	return result, nil
}

func invokeAsyncOn(gw *client.Gateway, channelName, chaincodeName, functionName string, args ...string) (*SubmitResult, error) {
	network := gw.GetNetwork(channelName)
	contract := network.GetContract(chaincodeName)
	result, commit, err := contract.SubmitAsync(functionName, client.WithArguments(args...))
	if err != nil {
		return nil, fmt.Errorf("error al enviar transacción: %w", err)
	}
	status, err := commit.Status()
	if err != nil {
		return nil, fmt.Errorf("error al confirmar transacción: %w", err)
	}
	if !status.Successful {
		return nil, fmt.Errorf("la transacción %s fue rechazada con código de estado %d", commit.TransactionID(), int32(status.Code))
	}
	return &SubmitResult{
		Payload: result,
		TxID:    commit.TransactionID(),
	}, nil
}

func evaluateOn(gw *client.Gateway, channelName, chaincodeName, functionName string, args ...string) ([]byte, error) {
	network := gw.GetNetwork(channelName)
	contract := network.GetContract(chaincodeName)
	result, err := contract.EvaluateTransaction(functionName, args...)
	if err != nil {
		return nil, fmt.Errorf("error al evaluar transacción: %w", err)
	}
	return result, nil
}
