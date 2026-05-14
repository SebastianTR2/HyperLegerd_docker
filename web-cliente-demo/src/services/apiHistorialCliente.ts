import { apiJson } from './apiClient'
import type { ClienteApi, HistorialClienteApi } from '../types/api'

export async function fetchHistorialCliente(clienteId: string): Promise<HistorialClienteApi> {
  const id = encodeURIComponent(clienteId.trim())
  return apiJson<HistorialClienteApi>(`/clientes/historial/${id}`, { method: 'GET' })
}

export type HistorialFilaVista = {
  txId: string
  timestamp: string
  isDelete: boolean
  resumen: string
  cliente?: ClienteApi | null
}

export function operacionesAVista(h: HistorialClienteApi): HistorialFilaVista[] {
  return h.operaciones.map((op) => {
    const rec = op.record
    const resumen = rec
      ? `${rec.nombre ?? ''} (${rec.estado ?? ''})`.trim() || op.txId
      : op.isDelete
        ? 'Baja / borrado lógico'
        : 'Sin registro'
    return {
      txId: op.txId,
      timestamp: op.timestamp,
      isDelete: op.isDelete,
      resumen,
      cliente: rec ?? null,
    }
  })
}
