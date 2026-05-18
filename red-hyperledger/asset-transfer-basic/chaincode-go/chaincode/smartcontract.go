package chaincode

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// SmartContract provides functions for managing an Asset
type SmartContract struct {
	contractapi.Contract
}

// Asset describes basic details of what makes up a simple asset (Cliente)
// Se han actualizado los campos para coincidir con la Especificación 1.2
type Asset struct {
	ClienteId       string `json:"clienteId"`
	Nombre          string `json:"nombre"`
	TipoDocumento   string `json:"tipoDocumento"`
	NumeroDocumento string `json:"numeroDocumento"`
	FechaAlta       string `json:"fechaAlta"`
	Estado          string `json:"estado"`
	Telefono        string `json:"telefono"`
	Email           string `json:"email"`
	Notas           string `json:"notas"`
	Revision        int    `json:"revision"` // Nuevo: número de revisión de producción
	IsDraft         bool   `json:"isDraft"`  // Nuevo: indica si es un borrador
	DraftOf         string `json:"draftOf"`  // Nuevo: ID del cliente original del que es borrador
}

// InitLedger adds a base set of assets to the ledger
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	assets := []Asset{
		{ClienteId: "CLI-INIT", Nombre: "Initial Admin", TipoDocumento: "CI", NumeroDocumento: "0000000", FechaAlta: "2026-04-10", Estado: "ACTIVO", Telefono: "000", Email: "admin@example.com", Notas: "init", Revision: 1, IsDraft: false, DraftOf: ""},
	}

	for _, asset := range assets {
		assetJSON, err := json.Marshal(asset)
		if err != nil {
			return err
		}

		err = ctx.GetStub().PutState(asset.ClienteId, assetJSON)
		if err != nil {
			return fmt.Errorf("failed to put to world state. %v", err)
		}
	}

	return nil
}

// CreateAsset issues a new asset to the world state with given details.
func (s *SmartContract) CreateAsset(ctx contractapi.TransactionContextInterface, id string, nombre string, tipoDoc string, numDoc string, fechaAlta string, estado string, tlf string, email string, notas string) error {
	exists, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("CLIENTE_EXISTENTE: el código %s ya está en uso", id)
	}

	asset := Asset{
		ClienteId:       id,
		Nombre:          nombre,
		TipoDocumento:   tipoDoc,
		NumeroDocumento: numDoc,
		FechaAlta:       fechaAlta,
		Estado:          estado,
		Telefono:        tlf,
		Email:           email,
		Notas:           notas,
		Revision:        1,
		IsDraft:         false,
		DraftOf:         "",
	}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	err = ctx.GetStub().SetEvent("CreateAsset", assetJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return ctx.GetStub().PutState(id, assetJSON)
}

// ReadAsset returns the asset stored in the world state with given id.
func (s *SmartContract) ReadAsset(ctx contractapi.TransactionContextInterface, id string) (*Asset, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if assetJSON == nil {
		return nil, fmt.Errorf("the asset %s does not exist", id)
	}

	var asset Asset
	err = json.Unmarshal(assetJSON, &asset)
	if err != nil {
		return nil, err
	}

	return &asset, nil
}

// UpdateAsset updates an existing asset in the world state with provided parameters.
func (s *SmartContract) UpdateAsset(ctx contractapi.TransactionContextInterface, id string, nombre string, tipoDoc string, numDoc string, fechaAlta string, estado string, tlf string, email string, notas string) error {
	exists, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("the asset %s does not exist", id)
	}

	prev, err := s.ReadAsset(ctx, id)
	if err != nil {
		return err
	}
	if strings.ToUpper(strings.TrimSpace(prev.Estado)) == "DADO_DE_BAJA" {
		return fmt.Errorf("CLIENTE_NO_EDITABLE: el cliente fue dado de baja y no admite modificaciones")
	}
	if strings.ToUpper(strings.TrimSpace(estado)) == "DADO_DE_BAJA" {
		return fmt.Errorf("CLIENTE_BAJA_VIA_ENDPOINT: el estado DADO_DE_BAJA solo se aplica mediante la operación de baja lógica")
	}

	// overwriting original asset with new asset
	asset := Asset{
		ClienteId:       id,
		Nombre:          nombre,
		TipoDocumento:   tipoDoc,
		NumeroDocumento: numDoc,
		FechaAlta:       fechaAlta,
		Estado:          estado,
		Telefono:        tlf,
		Email:           email,
		Notas:           notas,
		Revision:        prev.Revision + 1,
		IsDraft:         false,
		DraftOf:         "",
	}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	err = ctx.GetStub().SetEvent("UpdateAsset", assetJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return ctx.GetStub().PutState(id, assetJSON)
}

// BajaCliente marca el cliente como DADO_DE_BAJA sin borrar el asset (baja lógica; el historial MVCC se conserva).
// lineaAuditoria: texto opcional (p. ej. fecha y rol) que se añade a notas.
func (s *SmartContract) BajaCliente(ctx contractapi.TransactionContextInterface, clienteId string, lineaAuditoria string) error {
	asset, err := s.ReadAsset(ctx, clienteId)
	if err != nil {
		return err
	}
	switch strings.ToUpper(strings.TrimSpace(asset.Estado)) {
	case "DADO_DE_BAJA":
		return fmt.Errorf("CLIENTE_YA_DADO_DE_BAJA: el cliente ya fue dado de baja")
	}

	asset.Estado = "DADO_DE_BAJA"
	la := strings.TrimSpace(lineaAuditoria)
	if la != "" {
		if strings.TrimSpace(asset.Notas) != "" {
			asset.Notas = asset.Notas + "\n" + la
		} else {
			asset.Notas = la
		}
	}

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}
	if err := ctx.GetStub().SetEvent("BajaCliente", assetJSON); err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}
	return ctx.GetStub().PutState(clienteId, assetJSON)
}

// DeleteAsset deletes an given asset from the world state.
func (s *SmartContract) DeleteAsset(ctx contractapi.TransactionContextInterface, id string) error {
	exists, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("the asset %s does not exist", id)
	}

	return ctx.GetStub().DelState(id)
}

// AssetExists returns true when asset with given ID exists in world state
func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return assetJSON != nil, nil
}

// TransferAsset dummy keeping signature compatibility for general interface (unused for Cliente)
func (s *SmartContract) TransferAsset(ctx contractapi.TransactionContextInterface, id string, newOwner string) (string, error) {
	return "", fmt.Errorf("TransferAsset is not fully supported for Client models")
}

// GetAllAssets returns all assets found in world state
func (s *SmartContract) GetAllAssets(ctx contractapi.TransactionContextInterface) ([]*Asset, error) {
	// range query with empty string for startKey and endKey does an
	// open-ended query of all assets in the chaincode namespace.
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var assets []*Asset
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var asset Asset
		err = json.Unmarshal(queryResponse.Value, &asset)
		if err != nil {
			return nil, err
		}
		assets = append(assets, &asset)
	}

	return assets, nil
}

// HistoryQueryResult structure used for returning result of history query
type HistoryQueryResult struct {
	Record    *Asset `json:"record"`
	TxId      string `json:"txId"`
	Timestamp string `json:"timestamp"`
	IsDelete  bool   `json:"isDelete"`
}

// GetAssetHistory returns the chain of custody for an asset since issuance.
func (s *SmartContract) GetAssetHistory(ctx contractapi.TransactionContextInterface, id string) ([]HistoryQueryResult, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(id)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var records []HistoryQueryResult
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var asset *Asset
		if len(response.Value) > 0 {
			asset = new(Asset)
			err = json.Unmarshal(response.Value, asset)
			if err != nil {
				return nil, err
			}
		} else {
			asset = nil
		}

		timestamp := time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).Format(time.RFC3339)

		record := HistoryQueryResult{
			TxId:      response.TxId,
			Timestamp: timestamp,
			Record:    asset,
			IsDelete:  response.IsDelete,
		}
		records = append(records, record)
	}

	// Reverse to have descending temporal order (newest first)
	for i, j := 0, len(records)-1; i < j; i, j = i+1, j-1 {
		records[i], records[j] = records[j], records[i]
	}

	return records, nil
}

// CrearBorrador crea una copia del registro de producción actual como un borrador editable con ID id + "_DRAFT".
// Si el cliente no existe todavía, crea un borrador en blanco con valores por defecto.
func (s *SmartContract) CrearBorrador(ctx contractapi.TransactionContextInterface, id string) error {
	draftId := id + "_DRAFT"

	var draftAsset Asset
	existsProd, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}

	if existsProd {
		prodAsset, err := s.ReadAsset(ctx, id)
		if err != nil {
			return err
		}
		// Clonamos los datos actuales
		draftAsset = *prodAsset
	} else {
		// Nuevo borrador desde cero
		draftAsset = Asset{
			Estado: "ACTIVO",
		}
	}

	draftAsset.ClienteId = draftId
	draftAsset.IsDraft = true
	draftAsset.DraftOf = id

	draftAssetJSON, err := json.Marshal(draftAsset)
	if err != nil {
		return err
	}

	err = ctx.GetStub().SetEvent("CrearBorrador", draftAssetJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return ctx.GetStub().PutState(draftId, draftAssetJSON)
}

// ActualizarBorrador edita los campos del borrador de trabajo (id + "_DRAFT")
func (s *SmartContract) ActualizarBorrador(ctx contractapi.TransactionContextInterface, id string, nombre string, tipoDoc string, numDoc string, fechaAlta string, estado string, tlf string, email string, notas string) error {
	draftId := id + "_DRAFT"
	exists, err := s.AssetExists(ctx, draftId)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("EL_BORRADOR_NO_EXISTE: debe crear un borrador primero para %s", id)
	}

	draftAsset, err := s.ReadAsset(ctx, draftId)
	if err != nil {
		return err
	}

	// Actualizamos los campos en el borrador
	draftAsset.Nombre = nombre
	draftAsset.TipoDocumento = tipoDoc
	draftAsset.NumeroDocumento = numDoc
	draftAsset.FechaAlta = fechaAlta
	draftAsset.Estado = estado
	draftAsset.Telefono = tlf
	draftAsset.Email = email
	draftAsset.Notas = notas

	draftAssetJSON, err := json.Marshal(draftAsset)
	if err != nil {
		return err
	}

	err = ctx.GetStub().SetEvent("ActualizarBorrador", draftAssetJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return ctx.GetStub().PutState(draftId, draftAssetJSON)
}

// ConfirmarBorrador (Commit/Merge) toma el estado de id + "_DRAFT", guarda una copia de historial de id
// en id + "_REV_" + R y sobreescribe la clave principal id con el contenido del borrador consolidado.
func (s *SmartContract) ConfirmarBorrador(ctx contractapi.TransactionContextInterface, id string) error {
	draftId := id + "_DRAFT"
	existsDraft, err := s.AssetExists(ctx, draftId)
	if err != nil {
		return err
	}
	if !existsDraft {
		return fmt.Errorf("EL_BORRADOR_NO_EXISTE: no hay borrador activo para confirmar")
	}

	draftAsset, err := s.ReadAsset(ctx, draftId)
	if err != nil {
		return err
	}

	existsProd, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}

	nextRevision := 1
	if existsProd {
		prodAsset, err := s.ReadAsset(ctx, id)
		if err != nil {
			return err
		}
		
		// Guardamos la instantánea de la revisión actual
		currentRev := prodAsset.Revision
		nextRevision = currentRev + 1

		revKey := id + "_REV_" + strconv.Itoa(currentRev)
		prodAssetJSON, err := json.Marshal(prodAsset)
		if err != nil {
			return err
		}
		err = ctx.GetStub().PutState(revKey, prodAssetJSON)
		if err != nil {
			return fmt.Errorf("failed to save historical revision: %v", err)
		}
	}

	// Promovemos el borrador al estado de producción
	prodAsset := *draftAsset
	prodAsset.ClienteId = id
	prodAsset.IsDraft = false
	prodAsset.DraftOf = ""
	prodAsset.Revision = nextRevision

	prodAssetJSON, err := json.Marshal(prodAsset)
	if err != nil {
		return err
	}

	// Guardar el registro definitivo en producción
	err = ctx.GetStub().PutState(id, prodAssetJSON)
	if err != nil {
		return fmt.Errorf("failed to commit to production: %v", err)
	}

	// Borrar el borrador de trabajo
	err = ctx.GetStub().DelState(draftId)
	if err != nil {
		return fmt.Errorf("failed to delete draft: %v", err)
	}

	err = ctx.GetStub().SetEvent("ConfirmarBorrador", prodAssetJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return nil
}

// RevertirARevision (Rollback) restaura la clave principal id con el contenido guardado en id + "_REV_" + revisionDestino.
func (s *SmartContract) RevertirARevision(ctx contractapi.TransactionContextInterface, id string, revisionDestino int) error {
	revKey := id + "_REV_" + strconv.Itoa(revisionDestino)
	existsRev, err := s.AssetExists(ctx, revKey)
	if err != nil {
		return err
	}
	if !existsRev {
		return fmt.Errorf("VERSION_NO_ENCONTRADA: no existe la revisión %d para el cliente %s", revisionDestino, id)
	}

	histAsset, err := s.ReadAsset(ctx, revKey)
	if err != nil {
		return err
	}

	existsProd, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}

	if existsProd {
		prodAsset, err := s.ReadAsset(ctx, id)
		if err != nil {
			return err
		}
		// Guardamos el estado actual como una nueva revisión antes de revertir
		currentRev := prodAsset.Revision
		currentRevKey := id + "_REV_" + strconv.Itoa(currentRev)
		prodAssetJSON, err := json.Marshal(prodAsset)
		if err != nil {
			return err
		}
		err = ctx.GetStub().PutState(currentRevKey, prodAssetJSON)
		if err != nil {
			return fmt.Errorf("failed to save current revision backup: %v", err)
		}

		// Reemplazar la producción con la histórica incrementando revisión
		newProd := *histAsset
		newProd.ClienteId = id
		newProd.IsDraft = false
		newProd.DraftOf = ""
		newProd.Revision = currentRev + 1

		newProdJSON, err := json.Marshal(newProd)
		if err != nil {
			return err
		}

		err = ctx.GetStub().SetEvent("RevertirARevision", newProdJSON)
		if err != nil {
			return fmt.Errorf("failed to set event: %v", err)
		}

		return ctx.GetStub().PutState(id, newProdJSON)
	}

	return fmt.Errorf("CLIENTE_NO_EXISTE: no se puede revertir un cliente inexistente")
}

// ObtenerHistorialRevisiones retorna todas las revisiones congeladas (id + "_REV_<N>") en orden cronológico inverso.
func (s *SmartContract) ObtenerHistorialRevisiones(ctx contractapi.TransactionContextInterface, id string) ([]*Asset, error) {
	startKey := id + "_REV_"
	endKey := id + "_REV~" // '~' (0x7E) > '_' (0x5F) > digits, cubre todos los _REV_N sin bytes no-UTF8

	resultsIterator, err := ctx.GetStub().GetStateByRange(startKey, endKey)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var revisions []*Asset
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var asset Asset
		err = json.Unmarshal(queryResponse.Value, &asset)
		if err != nil {
			return nil, err
		}
		revisions = append(revisions, &asset)
	}

	// Invertimos el orden para que la versión histórica más reciente salga primero
	for i, j := 0, len(revisions)-1; i < j; i, j = i+1, j-1 {
		revisions[i], revisions[j] = revisions[j], revisions[i]
	}

	return revisions, nil
}

