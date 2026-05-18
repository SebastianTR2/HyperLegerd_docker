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
  // Control de versiones y borradores (Git-like)
  revision?: number
  isDraft?: boolean
  draftOf?: string
}

/** Respuesta del endpoint GET /clientes/:clienteId/versiones */
export interface HistorialRevisionesApi {
  ok: boolean
  clienteId: string
  total: number
  revisiones: ClienteApi[]
}

export interface RegistroHistorialClienteApi {
  txId: string
  timestamp: string
  isDelete: boolean
  record?: ClienteApi | null
}

export interface HistorialClienteApi {
  clienteId: string
  operaciones: RegistroHistorialClienteApi[]
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

/** Respuesta estándar de lectura del middleware (OpenAPI RespuestaLectura). */
export interface RespuestaLectura {
  ok: boolean
  codigo: string
  mensaje: string
  datos: unknown
  payloadDecodificado?: unknown
  payloadRaw?: string
}

export type RespuestaLecturaCliente = RespuestaLectura
