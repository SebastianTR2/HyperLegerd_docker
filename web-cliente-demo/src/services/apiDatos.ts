import { apiJson } from './apiClient'
import type { RespuestaLectura } from '../types/api'

export async function consultarDatoApi(datoId: string): Promise<RespuestaLectura> {
  const id = encodeURIComponent(datoId.trim())
  return apiJson<RespuestaLectura>(`/datos/${id}`, { method: 'GET' })
}

export async function fetchHistorialDato(datoId: string): Promise<RespuestaLectura> {
  const id = encodeURIComponent(datoId.trim())
  return apiJson<RespuestaLectura>(`/datos/${id}/historial`, { method: 'GET' })
}

