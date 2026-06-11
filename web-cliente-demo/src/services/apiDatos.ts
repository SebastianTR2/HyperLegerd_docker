import { apiJson } from './apiClient'
import type { RespuestaExitoTx, RespuestaLectura } from '../types/api'

export async function consultarDatoApi(datoId: string): Promise<RespuestaLectura> {
  const id = encodeURIComponent(datoId.trim())
  return apiJson<RespuestaLectura>(`/datos/${id}`, { method: 'GET' })
}

export async function fetchHistorialDato(datoId: string): Promise<RespuestaLectura> {
  const id = encodeURIComponent(datoId.trim())
  return apiJson<RespuestaLectura>(`/datos/${id}/historial`, { method: 'GET' })
}

export async function restaurarDatoRevision(datoId: string, txId: string): Promise<RespuestaExitoTx & { restauradoDesdeTxId?: string }> {
  const id = encodeURIComponent(datoId.trim())
  return apiJson<RespuestaExitoTx & { restauradoDesdeTxId?: string }>(`/datos/${id}/restaurar`, {
    method: 'POST',
    body: JSON.stringify({ txId: txId.trim() }),
  })
}

