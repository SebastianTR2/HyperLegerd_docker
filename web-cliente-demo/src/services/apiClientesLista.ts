import { apiJson } from './apiClient'
import type { ClienteApi } from '../types/api'

interface ListaBody {
  ok?: boolean
  datos?: unknown
}

/** GET /clientes → lista de assets en cliente_cc */
export async function listarClientesApi(): Promise<ClienteApi[]> {
  const j = await apiJson<ListaBody>('/clientes')
  const d = j.datos
  if (d == null) return []
  return Array.isArray(d) ? (d as ClienteApi[]) : []
}
