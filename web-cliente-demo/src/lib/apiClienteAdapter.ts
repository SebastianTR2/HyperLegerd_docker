import type { ClienteApiCacheRow } from '../types/api'
import type { Registro } from '../types/registro'
import { decodeIfBase64 } from './ledgerFieldDecode'
import { MARCA_BAJA_LOGICA_API, parseNotasLedger } from './notasLedger'

function mapEstado(estado: string, notas?: string, notasLedger?: string): Registro['estado'] {
  const u = estado.toUpperCase().replace(/\s+/g, '_')
  const n = notasLedger ?? notas ?? ''
  if (u === 'DADO_DE_BAJA') return 'baja'
  if (u === 'INACTIVO' && n.includes(MARCA_BAJA_LOGICA_API)) return 'baja'
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
  const notasLedger = typeof o.notas === 'string' ? o.notas : ''
  const notasParsed = parseNotasLedger(notasLedger)
  const tipoDoc = typeof o.tipoDocumento === 'string' ? o.tipoDocumento : 'CI'
  const numDoc = typeof o.numeroDocumento === 'string' ? o.numeroDocumento : ''
  return {
    clienteId: o.clienteId,
    nombre: decodeIfBase64(typeof o.nombre === 'string' ? o.nombre : ''),
    tipoDocumento: /^(CI|NIT|PASAPORTE)$/i.test(tipoDoc.trim()) ? tipoDoc : decodeIfBase64(tipoDoc),
    numeroDocumento: decodeIfBase64(numDoc),
    fechaAlta: typeof o.fechaAlta === 'string' ? o.fechaAlta : '',
    estado: typeof o.estado === 'string' ? o.estado : 'ACTIVO',
    telefono: decodeIfBase64(typeof o.telefono === 'string' ? o.telefono : ''),
    email: decodeIfBase64(typeof o.email === 'string' ? o.email : ''),
    notas: notasParsed.notasNegocio || undefined,
    notasLedger,
    informacionAuditoria: notasParsed.informacionAuditoria,
  }
}

/** Usa `payloadDecodificado` si viene en la respuesta OpenAPI ampliada. */
export function parseClienteDesdeLectura(res: {
  datos?: unknown
  payloadDecodificado?: unknown
}): ClienteApiCacheRow | null {
  const src = res.payloadDecodificado ?? res.datos
  return parseClienteDatos(src)
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
    estado: mapEstado(c.estado, c.notas, c.notasLedger),
    fechaRegistro: c.fechaAlta,
    telefono: c.telefono?.trim() || undefined,
    referenciaTrazabilidad: ref,
  }
}
