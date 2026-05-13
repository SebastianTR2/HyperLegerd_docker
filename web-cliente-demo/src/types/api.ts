/** Modelo alineado a `api-middleware/pkg/models/cliente.go` (JSON del backend). */
export interface ClienteApi {
  clienteId: string
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  fechaAlta: string
  estado: string
  telefono?: string
  email?: string
  notas?: string
}

/** Fila en caché local tras un alta por API (no se envía al backend). */
export type ClienteApiCacheRow = ClienteApi & { _ultimoTxId?: string }

export interface EmitirTokenApi {
  destinatario: string
  monto: number
  codigoToken: string
}

export interface TransferirTokenApi {
  origen: string
  destino: string
  monto: number
  codigoToken: string
}

export interface RespuestaExitoTx {
  ok: boolean
  txId: string
  mensaje: string
  txIdMint?: string
}

export interface RespuestaError {
  ok: boolean
  codigo: string
  mensaje: string
}

export interface RespuestaLecturaCliente {
  ok: boolean
  codigo: string
  mensaje: string
  datos: unknown
}
