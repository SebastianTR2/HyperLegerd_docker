import { apiJson } from './apiClient'
import type { RespuestaExitoTx, HistorialRevisionesApi } from '../types/api'

/** POST /clientes/:clienteId/draft — Crea un borrador editable del cliente */
export async function crearBorradorApi(clienteId: string): Promise<RespuestaExitoTx> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<RespuestaExitoTx>(`/clientes/${id}/draft`, { method: 'POST' })
}

/** PUT /clientes/:clienteId/draft — Actualiza los campos del borrador activo */
export async function actualizarBorradorApi(
  clienteId: string,
  patch: Record<string, string>,
): Promise<RespuestaExitoTx> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<RespuestaExitoTx>(`/clientes/${id}/draft`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}

/** POST /clientes/:clienteId/commit — Publica el borrador al registro oficial */
export async function confirmarBorradorApi(clienteId: string): Promise<RespuestaExitoTx> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<RespuestaExitoTx>(`/clientes/${id}/commit`, { method: 'POST' })
}

/** POST /clientes/:clienteId/rollback/:revision — Revierte al estado de una revisión anterior */
export async function revertirRevisionApi(
  clienteId: string,
  revision: number,
): Promise<RespuestaExitoTx> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<RespuestaExitoTx>(`/clientes/${id}/rollback/${revision}`, { method: 'POST' })
}

/** GET /clientes/:clienteId/versiones — Obtiene todas las revisiones históricas congeladas */
export async function obtenerRevisionesApi(clienteId: string): Promise<HistorialRevisionesApi> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<HistorialRevisionesApi>(`/clientes/${id}/versiones`, { method: 'GET' })
}
