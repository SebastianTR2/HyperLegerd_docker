import { apiJson } from './apiClient'
import { parseClienteDatos } from '../lib/apiClienteAdapter'
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
  if (!Array.isArray(d)) return []
  return d
    .map((row) => parseClienteDatos(row))
    .filter((x): x is ClienteApi => x !== null)
}
