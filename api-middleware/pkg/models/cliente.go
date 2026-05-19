package models

// Cliente representa el esquema del activo de cliente en el sistema.
type Cliente struct {
	ClienteId       string `json:"clienteId" binding:"required"`
	Nombre          string `json:"nombre" binding:"required"`
	TipoDocumento   string `json:"tipoDocumento" binding:"required,oneof=CI NIT PASAPORTE"`
	NumeroDocumento string `json:"numeroDocumento" binding:"required"`
	FechaAlta       string `json:"fechaAlta" binding:"required"`
	Estado          string `json:"estado" binding:"required"`
	Telefono        string `json:"telefono,omitempty"`
	Email           string `json:"email,omitempty" binding:"omitempty,email"`
	Notas           string `json:"notas,omitempty"`
	// Campos del sistema de control de versiones y borradores
	Revision int    `json:"revision"`  // Número de revisión oficial (se incrementa en cada commit)
	IsDraft  bool   `json:"isDraft"`   // true si este registro es un borrador (WIP)
	DraftOf  string `json:"draftOf"`   // ID del cliente original del que es borrador
}

// ClientePatch campos opcionales para actualización (PATCH). No incluye clienteId ni fechaAlta.
type ClientePatch struct {
	Nombre          *string `json:"nombre,omitempty"`
	TipoDocumento   *string `json:"tipoDocumento,omitempty"`
	NumeroDocumento *string `json:"numeroDocumento,omitempty"`
	Telefono        *string `json:"telefono,omitempty"`
	Email           *string `json:"email,omitempty"`
	Notas           *string `json:"notas,omitempty"`
	Estado          *string `json:"estado,omitempty"`
}

// RegistroHistorialCliente representa un evento histórico del cliente.
type RegistroHistorialCliente struct {
	TxId      string   `json:"txId"`
	Timestamp string   `json:"timestamp"`
	IsDelete  bool     `json:"isDelete"`
	Record    *Cliente `json:"record"`
}

// HistorialCliente representa la lista de operaciones de un cliente.
type HistorialCliente struct {
	ClienteId   string                     `json:"clienteId"`
	Operaciones []RegistroHistorialCliente `json:"operaciones"`
}

// LineaTiempoCliente representa la auditoría resumida del cliente.
type LineaTiempoCliente struct {
	Ok        bool                `json:"ok"`
	ClienteId string              `json:"clienteId"`
	Acciones  []AccionLineaTiempo `json:"acciones"`
}

// AccionLineaTiempo representa un hito en la vida del activo.
type AccionLineaTiempo struct {
	Tipo     string `json:"tipo"` // creado, editado, baja
	Etiqueta string `json:"etiqueta"`
	Fecha    string `json:"fecha"`
	TxId     string `json:"txId"`
}
