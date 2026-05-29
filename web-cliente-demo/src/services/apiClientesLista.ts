import { apiJson } from './apiClient'
import { parseClienteDatos } from '../lib/apiClienteAdapter'
import { parseDatoDatos } from '../lib/datoApiAdapter'
import type { ClienteApi } from '../types/api'

interface ListaBody {
  ok?: boolean
  datos?: unknown
}

/** Obtiene filas de ledger para el tenant activo (clientes/agricultura). */
export async function listarClientesApi(tenant: string): Promise<ClienteApi[]> {
  const endpoint = tenant.trim().toLowerCase() === 'agricultura' ? '/datos' : '/clientes'
  const j = await apiJson<ListaBody>(endpoint)
  const d = j.datos
  if (d == null) return []
  if (!Array.isArray(d)) return []
  const parser = endpoint === '/datos' ? parseDatoDatos : parseClienteDatos
  return d
    .map((row) => parser(row))
    .filter((x): x is ClienteApi => x !== null)
}
