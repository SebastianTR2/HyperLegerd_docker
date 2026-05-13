import { apiJson } from './apiClient'
import type { ClienteApi, RespuestaExitoTx, RespuestaLecturaCliente } from '../types/api'

export async function registrarClienteApi(body: ClienteApi): Promise<RespuestaExitoTx> {
  return apiJson<RespuestaExitoTx>('/clientes', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function consultarClienteApi(clienteId: string): Promise<RespuestaLecturaCliente> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<RespuestaLecturaCliente>(`/clientes/${id}`, { method: 'GET' })
}
