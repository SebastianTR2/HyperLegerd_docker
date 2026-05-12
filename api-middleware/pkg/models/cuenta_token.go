package models

// CuentaTokenVista refleja la respuesta de chaincode (cuentas visibles).
type CuentaTokenVista struct {
	Alias       string `json:"alias"`
	Saldo       int64  `json:"saldo"`
	CodigoToken string `json:"codigoToken"`
	Estado      string `json:"estado"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// CrearCuentaTokenBody solicitud para crear cuenta visible.
type CrearCuentaTokenBody struct {
	Alias string `json:"alias" binding:"required"`
}

// EmitirCuentaTokenBody emisión hacia una cuenta visible.
type EmitirCuentaTokenBody struct {
	Destinatario string `json:"destinatario" binding:"required"`
	Monto        int64  `json:"monto" binding:"required,gt=0"`
	CodigoToken  string `json:"codigoToken" binding:"required"`
}

// TransferirCuentaTokenBody transferencia entre cuentas visibles.
type TransferirCuentaTokenBody struct {
	Origen      string `json:"origen" binding:"required"`
	Destino     string `json:"destino" binding:"required"`
	Monto       int64  `json:"monto" binding:"required,gt=0"`
	CodigoToken string `json:"codigoToken" binding:"required"`
}
