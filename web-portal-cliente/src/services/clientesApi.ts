import { apiJson } from './apiClient'
import type { ClienteApiPayload, ClientePatchPayload, RespuestaExitoTx, RespuestaLecturaCliente } from '../types/api'
import { apiRecordToDetalleDto, apiRecordToListItemDto } from '../lib/mappers'
import type { ClienteDetalleDto, ClienteListItemDto } from '../types/dto'

interface ListaBody {
  ok?: boolean
  datos?: unknown
}

export async function listarClientesDesdeApi(): Promise<ClienteListItemDto[]> {
  const j = await apiJson<ListaBody>('/clientes')
  const d = j.datos
  if (d == null) return []
  if (!Array.isArray(d)) return []
  return d.map((row) => apiRecordToListItemDto(row)).filter((x): x is ClienteListItemDto => x !== null)
}

export async function consultarClienteDesdeApi(clienteId: string): Promise<ClienteDetalleDto | null> {
  const id = encodeURIComponent(clienteId.trim())
  const j = await apiJson<RespuestaLecturaCliente>(`/clientes/${id}`)
  return apiRecordToDetalleDto(j.datos)
}

export async function registrarClienteDesdeApi(body: ClienteApiPayload): Promise<RespuestaExitoTx> {
  return apiJson<RespuestaExitoTx>('/clientes', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function actualizarClienteDesdeApi(
  clienteId: string,
  body: ClientePatchPayload,
): Promise<RespuestaExitoTx> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<RespuestaExitoTx>(`/clientes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function darBajaClienteDesdeApi(clienteId: string): Promise<RespuestaExitoTx> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<RespuestaExitoTx>(`/clientes/${id}/baja`, {
    method: 'POST',
  })
}
