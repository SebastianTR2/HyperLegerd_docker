import { apiJson } from './apiClient'
import type { RespuestaLectura } from '../types/api'

export type LineaAuditoriaApi = {
  prefijo: string
  tipoFuente: string
  registro: unknown
}

export type EventoCadenaApi = {
  timestamp: string
  contrato: string
  nombreEvento: string
  txId: string
  blockNumber: number
  payload: unknown
}

export type AuditoriaCombinadaDatos = {
  httpPuente: LineaAuditoriaApi[]
  eventosCadena: EventoCadenaApi[]
  totalHttp: number
  totalEventos: number
  correlacionHint?: string
}

function buildQuery(limite: number, desde: string, hasta: string): string {
  const p = new URLSearchParams()
  p.set('limite', String(limite))
  if (desde.trim()) p.set('desde', desde.trim())
  if (hasta.trim()) p.set('hasta', hasta.trim())
  const q = p.toString()
  return q ? `?${q}` : ''
}

export async function fetchAuditoriaCombinada(
  limite: number,
  desde: string,
  hasta: string,
): Promise<AuditoriaCombinadaDatos> {
  const res = await apiJson<RespuestaLectura>(`/auditoria/combinada${buildQuery(limite, desde, hasta)}`)
  const datos = res.datos as AuditoriaCombinadaDatos | undefined
  if (!datos || !Array.isArray(datos.httpPuente)) {
    throw new Error('Respuesta de auditoría incompleta')
  }
  return {
    ...datos,
    eventosCadena: Array.isArray(datos.eventosCadena) ? datos.eventosCadena : [],
  }
}
