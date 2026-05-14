/** Cuerpo y respuestas alineadas al api-middleware (JSON). */

export interface ClienteApiPayload {
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

/** Cuerpo PATCH /clientes/:id (campos opcionales; al menos uno requerido en servidor). */
export type ClientePatchPayload = Partial<
  Pick<ClienteApiPayload, 'nombre' | 'tipoDocumento' | 'numeroDocumento' | 'telefono' | 'email' | 'notas' | 'estado'>
>

export interface RespuestaExitoTx {
  ok: boolean
  txId: string
  mensaje: string
  txIdMint?: string
}

export interface RespuestaError {
  ok: false
  codigo: string
  mensaje: string
}

export interface RespuestaLecturaCliente {
  ok: boolean
  codigo: string
  mensaje: string
  datos: unknown
}
