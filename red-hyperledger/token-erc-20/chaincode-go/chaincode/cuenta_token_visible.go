package chaincode

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

const (
	vtBalPrefix  = "VTBAL:"
	vtMetaPrefix = "VTMETA:"
	vtIndexKey   = "cuentaTokenIdx"
)

// CuentaTokenMeta estado extendido (el saldo autoritativo sigue la fila ERC-20 en VTBAL:alias).
type CuentaTokenMeta struct {
	Alias       string `json:"alias"`
	CodigoToken string `json:"codigoToken,omitempty"`
	Estado      string `json:"estado"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// CuentaTokenVista combina meta + saldo para consultas API.
// codigoToken sin omitempty: el runtime de Fabric valida el retorno JSON y exige la clave presente.
type CuentaTokenVista struct {
	Alias       string `json:"alias"`
	Saldo       int    `json:"saldo"`
	CodigoToken string `json:"codigoToken"`
	Estado      string `json:"estado"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

var aliasValido = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$`)

func normalizarAlias(alias string) string {
	return strings.ToLower(strings.TrimSpace(alias))
}

// txTimeRFC3339 usa el timestamp de la transacción (idem en todos los endorsers).
// time.Now() aquí provoca resultados distintos por peer → fallo de endorsement / validación.
func txTimeRFC3339(ctx contractapi.TransactionContextInterface) (string, error) {
	ts, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return "", fmt.Errorf("timestamp de transacción: %w", err)
	}
	return ts.AsTime().UTC().Format(time.RFC3339), nil
}

func metaKey(alias string) string {
	return vtMetaPrefix + alias
}

func balKey(alias string) string {
	return vtBalPrefix + alias
}

func requireOrg1(ctx contractapi.TransactionContextInterface) error {
	msp, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("no se pudo obtener MSPID: %w", err)
	}
	if msp != "Org1MSP" {
		return errors.New("solo Org1MSP puede ejecutar esta operación")
	}
	return nil
}

func leerSaldoStub(ctx contractapi.TransactionContextInterface, account string) (int, error) {
	b, err := ctx.GetStub().GetState(account)
	if err != nil {
		return 0, err
	}
	if b == nil {
		return 0, fmt.Errorf("la cuenta %s no existe", account)
	}
	v, err := strconv.Atoi(string(b))
	if err != nil {
		return 0, fmt.Errorf("saldo inválido en ledger para %s", account)
	}
	return v, nil
}

// CrearCuentaToken registra una cuenta visible con saldo 0 en el ledger (VTBAL + VTMETA).
func (s *SmartContract) CrearCuentaToken(ctx contractapi.TransactionContextInterface, alias string) error {
	if err := requireOrg1(ctx); err != nil {
		return err
	}
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return err
	}
	if !initialized {
		return errors.New("el contrato debe inicializarse antes de crear cuentas token visibles")
	}
	trimmed := strings.TrimSpace(alias)
	a := strings.ToLower(trimmed)
	if a == "" || !aliasValido.MatchString(trimmed) {
		return errors.New("alias inválido: use letras, números, punto, guión o guión bajo (1-63 caracteres)")
	}
	if existe, _ := cuentaMetaExiste(ctx, a); existe {
		return fmt.Errorf("la cuenta token '%s' ya existe", a)
	}

	now, err := txTimeRFC3339(ctx)
	if err != nil {
		return err
	}
	meta := CuentaTokenMeta{
		Alias:       a,
		CodigoToken: s.codigoTokenVisibleDefault(ctx),
		Estado:      "ACTIVA",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	if err := ctx.GetStub().PutState(balKey(a), []byte("0")); err != nil {
		return err
	}
	if err := ctx.GetStub().PutState(metaKey(a), metaBytes); err != nil {
		return err
	}
	return appendAliasIndex(ctx, a)
}

func cuentaMetaExiste(ctx contractapi.TransactionContextInterface, alias string) (bool, error) {
	b, err := ctx.GetStub().GetState(metaKey(alias))
	if err != nil {
		return false, err
	}
	return b != nil, nil
}

func appendAliasIndex(ctx contractapi.TransactionContextInterface, alias string) error {
	raw, err := ctx.GetStub().GetState(vtIndexKey)
	var lista []string
	if err != nil {
		return err
	}
	if raw != nil {
		_ = json.Unmarshal(raw, &lista)
	}
	for _, x := range lista {
		if x == alias {
			return nil
		}
	}
	lista = append(lista, alias)
	out, err := json.Marshal(lista)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(vtIndexKey, out)
}

// CuentaTokenExiste indica si existe metadata de cuenta visible.
func (s *SmartContract) CuentaTokenExiste(ctx contractapi.TransactionContextInterface, alias string) (bool, error) {
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return false, err
	}
	if !initialized {
		return false, errors.New("el contrato no está inicializado")
	}
	a := normalizarAlias(alias)
	return cuentaMetaExiste(ctx, a)
}

// ListarCuentasToken devuelve todas las cuentas visibles y sus saldos.
func (s *SmartContract) ListarCuentasToken(ctx contractapi.TransactionContextInterface) ([]*CuentaTokenVista, error) {
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return nil, err
	}
	if !initialized {
		return nil, errors.New("el contrato no está inicializado")
	}
	raw, err := ctx.GetStub().GetState(vtIndexKey)
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return []*CuentaTokenVista{}, nil
	}
	var lista []string
	if err := json.Unmarshal(raw, &lista); err != nil {
		return nil, err
	}
	var out []*CuentaTokenVista
	for _, a := range lista {
		v, err := s.leerVistaCuenta(ctx, a)
		if err != nil {
			continue
		}
		out = append(out, v)
	}
	return out, nil
}

func (s *SmartContract) leerVistaCuenta(ctx contractapi.TransactionContextInterface, alias string) (*CuentaTokenVista, error) {
	metaBytes, err := ctx.GetStub().GetState(metaKey(alias))
	if err != nil || metaBytes == nil {
		return nil, fmt.Errorf("sin metadata para alias %s", alias)
	}
	var meta CuentaTokenMeta
	if err := json.Unmarshal(metaBytes, &meta); err != nil {
		return nil, err
	}
	saldo, err := leerSaldoStub(ctx, balKey(alias))
	if err != nil {
		saldo = 0
	}
	codigo := strings.TrimSpace(meta.CodigoToken)
	if codigo == "" {
		codigo = s.codigoTokenVisibleDefault(ctx)
	}
	return &CuentaTokenVista{
		Alias:       meta.Alias,
		Saldo:       saldo,
		CodigoToken: codigo,
		Estado:      meta.Estado,
		CreatedAt:   meta.CreatedAt,
		UpdatedAt:   meta.UpdatedAt,
	}, nil
}

// codigoTokenVisibleDefault usa el símbolo del contrato ERC-20 si existe; si no, TOK001.
func (s *SmartContract) codigoTokenVisibleDefault(ctx contractapi.TransactionContextInterface) string {
	b, err := ctx.GetStub().GetState(symbolKey)
	if err != nil || len(b) == 0 {
		return "TOK001"
	}
	c := strings.TrimSpace(string(b))
	if c == "" {
		return "TOK001"
	}
	return c
}

// ObtenerCuentaToken devuelve meta + saldo de una cuenta visible.
func (s *SmartContract) ObtenerCuentaToken(ctx contractapi.TransactionContextInterface, alias string) (*CuentaTokenVista, error) {
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return nil, err
	}
	if !initialized {
		return nil, errors.New("el contrato no está inicializado")
	}
	a := normalizarAlias(alias)
	ok, err := cuentaMetaExiste(ctx, a)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("La cuenta token no existe.")
	}
	return s.leerVistaCuenta(ctx, a)
}

// ConsultarSaldoCuentaToken devuelve el saldo numérico de una cuenta visible.
func (s *SmartContract) ConsultarSaldoCuentaToken(ctx contractapi.TransactionContextInterface, alias string) (int, error) {
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return 0, err
	}
	if !initialized {
		return 0, errors.New("el contrato no está inicializado")
	}
	a := normalizarAlias(alias)
	ok, err := cuentaMetaExiste(ctx, a)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, fmt.Errorf("La cuenta token no existe.")
	}
	return leerSaldoStub(ctx, balKey(a))
}

func validarCodigoToken(_ contractapi.TransactionContextInterface, codigo string) error {
	c := strings.TrimSpace(codigo)
	if c == "" {
		return errors.New("codigoToken es obligatorio")
	}
	for _, r := range c {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')) {
			return errors.New("codigoToken solo permite letras y números sin espacios")
		}
	}
	return nil
}

// EmitirACuentaToken incrementa el saldo en VTBAL:{alias} y actualiza VTMETA (sin Mint ni minter; fase 2).
func (s *SmartContract) EmitirACuentaToken(ctx contractapi.TransactionContextInterface, alias string, monto int, codigoToken string) error {
	if err := requireOrg1(ctx); err != nil {
		return err
	}
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return err
	}
	if !initialized {
		return errors.New("el contrato debe estar inicializado")
	}
	if monto <= 0 {
		return errors.New("el monto debe ser mayor que cero")
	}
	a := normalizarAlias(alias)
	ok, err := cuentaMetaExiste(ctx, a)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("La cuenta token no existe.")
	}
	if err := validarCodigoToken(ctx, codigoToken); err != nil {
		return err
	}

	dest := balKey(a)
	rawBal, err := ctx.GetStub().GetState(dest)
	if err != nil {
		return err
	}
	if rawBal == nil {
		return errors.New("La cuenta token no existe.")
	}
	saldoActual, err := strconv.Atoi(string(rawBal))
	if err != nil {
		return errors.New("saldo ilegible en cuenta visible")
	}

	nuevoSaldo, err := add(saldoActual, monto)
	if err != nil {
		return err
	}
	if err := ctx.GetStub().PutState(dest, []byte(strconv.Itoa(nuevoSaldo))); err != nil {
		return err
	}

	now, err := txTimeRFC3339(ctx)
	if err != nil {
		return err
	}
	if err := s.patchMeta(ctx, a, func(m *CuentaTokenMeta) {
		m.CodigoToken = strings.TrimSpace(codigoToken)
		m.UpdatedAt = now
	}); err != nil {
		return err
	}

	ev := map[string]interface{}{
		"tipo":            "EmitirACuentaToken",
		"alias":           a,
		"monto":           monto,
		"codigoToken":     strings.TrimSpace(codigoToken),
		"cuentaLedger":    dest,
		"saldoResultante": nuevoSaldo,
	}
	evb, err := json.Marshal(ev)
	if err != nil {
		return err
	}
	return ctx.GetStub().SetEvent("CuentaTokenEmitida", evb)
}

func (s *SmartContract) patchMeta(ctx contractapi.TransactionContextInterface, alias string, fn func(*CuentaTokenMeta)) error {
	raw, err := ctx.GetStub().GetState(metaKey(alias))
	if err != nil || raw == nil {
		return fmt.Errorf("metadata no encontrada para %s", alias)
	}
	var m CuentaTokenMeta
	if err := json.Unmarshal(raw, &m); err != nil {
		return err
	}
	fn(&m)
	out, err := json.Marshal(m)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(metaKey(alias), out)
}

// TransferirEntreCuentasToken mueve saldos entre cuentas visibles en el mismo ledger ERC-20.
func (s *SmartContract) TransferirEntreCuentasToken(ctx contractapi.TransactionContextInterface, origen, destino string, monto int, codigoToken string) error {
	if err := requireOrg1(ctx); err != nil {
		return err
	}
	initialized, err := checkInitialized(ctx)
	if err != nil {
		return err
	}
	if !initialized {
		return errors.New("el contrato debe estar inicializado")
	}
	o := normalizarAlias(origen)
	d := normalizarAlias(destino)
	if o == d {
		return errors.New("origen y destino no pueden ser iguales")
	}
	if monto <= 0 {
		return errors.New("el monto debe ser mayor que cero")
	}
	if err := validarCodigoToken(ctx, codigoToken); err != nil {
		return err
	}

	okO, err := cuentaMetaExiste(ctx, o)
	if err != nil {
		return err
	}
	if !okO {
		return errors.New("La cuenta token origen no existe.")
	}
	okD, err := cuentaMetaExiste(ctx, d)
	if err != nil {
		return err
	}
	if !okD {
		return errors.New("La cuenta token destino no existe.")
	}

	fromK := balKey(o)
	toK := balKey(d)

	saldoO, err := leerSaldoStub(ctx, fromK)
	if err != nil {
		return errors.New("La cuenta token origen no existe.")
	}
	if saldoO < monto {
		return fmt.Errorf("Saldo insuficiente. La cuenta %s tiene %d %s y quiere transferir %d %s.", o, saldoO, strings.TrimSpace(codigoToken), monto, strings.TrimSpace(codigoToken))
	}

	if err := transferHelper(ctx, fromK, toK, monto); err != nil {
		return err
	}

	now, err := txTimeRFC3339(ctx)
	if err != nil {
		return err
	}
	_ = s.patchMeta(ctx, o, func(m *CuentaTokenMeta) { m.UpdatedAt = now })
	_ = s.patchMeta(ctx, d, func(m *CuentaTokenMeta) { m.UpdatedAt = now })

	ev := map[string]interface{}{
		"tipo":        "TransferirEntreCuentasToken",
		"origen":      o,
		"destino":     d,
		"monto":       monto,
		"codigoToken": strings.TrimSpace(codigoToken),
	}
	evb, _ := json.Marshal(ev)
	_ = ctx.GetStub().SetEvent("CuentaTokenTransferida", evb)

	return nil
}
