import type { ClienteApiCacheRow } from '../types/api'
import type { Registro } from '../types/registro'

function mapEstado(estado: string): Registro['estado'] {
  const u = estado.toUpperCase()
  if (u === 'ACTIVO') return 'activo'
  if (u === 'INACTIVO') return 'inactivo'
  return 'pendiente'
}

/** Convierte respuesta de la API a fila/detalle del UI existente. */
/** Normaliza `datos` de `GET /clientes/:id` hacia fila de caché. */
export function parseClienteDatos(datos: unknown): ClienteApiCacheRow | null {
  if (!datos || typeof datos !== 'object') return null
  const o = datos as Record<string, unknown>
  if (typeof o.clienteId !== 'string') return null
  return {
    clienteId: o.clienteId,
    nombre: typeof o.nombre === 'string' ? o.nombre : '',
    tipoDocumento: typeof o.tipoDocumento === 'string' ? o.tipoDocumento : 'CI',
    numeroDocumento: typeof o.numeroDocumento === 'string' ? o.numeroDocumento : '',
    fechaAlta: typeof o.fechaAlta === 'string' ? o.fechaAlta : '',
    estado: typeof o.estado === 'string' ? o.estado : 'ACTIVO',
    telefono: typeof o.telefono === 'string' ? o.telefono : '',
    email: typeof o.email === 'string' ? o.email : '',
    notas: typeof o.notas === 'string' ? o.notas : '',
  }
}

export function clienteApiToRegistro(c: ClienteApiCacheRow, txId?: string): Registro {
  const ref = txId ?? c._ultimoTxId
  return {
    id: c.clienteId,
    tipoDocumento: c.tipoDocumento,
    documento: c.numeroDocumento,
    nombreCompleto: c.nombre,
    email: c.email ?? '',
    facultad: c.notas?.trim() ? c.notas : '—',
    estado: mapEstado(c.estado),
    fechaRegistro: c.fechaAlta,
    telefono: c.telefono?.trim() || undefined,
    referenciaTrazabilidad: ref,
  }
}
