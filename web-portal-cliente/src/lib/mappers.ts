import type { ClienteApiPayload } from '../types/api'
import type { ClienteDetalleDto, ClienteFormDto, ClienteListItemDto } from '../types/dto'
import { decodeIfBase64 } from './ledgerFieldDecode'
import { parseNotasLedger } from './notasLedger'

const TIPOS_DOC = ['CI', 'NIT', 'PASAPORTE'] as const

/** Misma marca que api-middleware (baja vía UpdateAsset con estado INACTIVO). */
export const MARCA_BAJA_LOGICA_API = '[baja-logica-api]'

export function esClienteBajaLogica(detalle: {
  estadoCodigo: string
  notas: string
  /** Notas tal como vienen del ledger (antes de limpiar); necesario para la marca de baja. */
  notasLedger?: string
}): boolean {
  if (detalle.estadoCodigo === 'DADO_DE_BAJA') return true
  const src = detalle.notasLedger ?? detalle.notas
  return detalle.estadoCodigo === 'INACTIVO' && src.includes(MARCA_BAJA_LOGICA_API)
}

export function estadoEtiqueta(estado: string): string {
  const u = estado.toUpperCase()
  if (u === 'ACTIVO') return 'Activo'
  if (u === 'INACTIVO') return 'Inactivo'
  if (u === 'DADO_DE_BAJA' || u === 'DADO DE BAJA') return 'Dado de baja'
  return estado
}

function esTipoDocValido(s: string): s is (typeof TIPOS_DOC)[number] {
  return TIPOS_DOC.includes(s as (typeof TIPOS_DOC)[number])
}

/** Formulario alta/nuevo → payload POST /clientes */
export function formularioNuevoToPayload(dto: ClienteFormDto): ClienteApiPayload {
  const tipo = dto.tipoDocumento.toUpperCase()
  const tipoDocumento = esTipoDocValido(tipo) ? tipo : 'CI'
  return {
    clienteId: dto.codigoCliente.trim(),
    nombre: dto.nombreCompleto.trim(),
    tipoDocumento,
    numeroDocumento: dto.numeroDocumento.trim(),
    fechaAlta: dto.fechaAlta.trim(),
    estado: dto.estado.toUpperCase() === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO',
    telefono: dto.telefono.trim() || undefined,
    email: dto.correo.trim() || undefined,
    notas: dto.notas.trim() || undefined,
  }
}

/** Formulario edición (sin código ni fecha de alta editables en payload de update futuro). */
export function formularioEdicionToPartialPayload(
  dto: Omit<ClienteFormDto, 'codigoCliente' | 'fechaAlta'>,
): Pick<
  ClienteApiPayload,
  'nombre' | 'tipoDocumento' | 'numeroDocumento' | 'telefono' | 'email' | 'notas' | 'estado'
> {
  const tipo = dto.tipoDocumento.toUpperCase()
  const tipoDocumento = esTipoDocValido(tipo) ? tipo : 'CI'
  return {
    nombre: dto.nombreCompleto.trim(),
    tipoDocumento,
    numeroDocumento: dto.numeroDocumento.trim(),
    estado: dto.estado.toUpperCase(),
    telefono: dto.telefono.trim() || undefined,
    email: dto.correo.trim() || undefined,
    notas: dto.notas.trim() || undefined,
  }
}

export function apiRecordToDetalleDto(raw: unknown): ClienteDetalleDto | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const clienteId = String(r.clienteId ?? r.ClienteId ?? '')
  if (!clienteId) return null
  const estadoRaw = String(r.estado ?? 'ACTIVO')
    .toUpperCase()
    .replace(/\s+/g, '_')
  const estadoCodigo =
    estadoRaw === 'DADO_DE_BAJA' ? 'DADO_DE_BAJA' : estadoRaw === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO'
  const notasLedger = String(r.notas ?? '')
  const notasParsed = parseNotasLedger(notasLedger)
  const esBajaLogica =
    estadoCodigo === 'DADO_DE_BAJA' ||
    (estadoCodigo === 'INACTIVO' && notasLedger.includes(MARCA_BAJA_LOGICA_API))
  const etiqueta = esBajaLogica ? 'Dado de baja' : estadoEtiqueta(estadoCodigo)
  return {
    codigo: clienteId,
    nombre: decodeIfBase64(String(r.nombre ?? '')),
    tipoDocumento: String(r.tipoDocumento ?? ''),
    numeroDocumento: String(r.numeroDocumento ?? ''),
    estadoCodigo,
    estadoEtiqueta: etiqueta,
    fechaAlta: String(r.fechaAlta ?? ''),
    telefono: decodeIfBase64(String(r.telefono ?? '')),
    correo: decodeIfBase64(String(r.email ?? '')),
    notas: notasParsed.notasNegocio,
    informacionAuditoria: notasParsed.informacionAuditoria,
    esBajaLogica,
  }
}

export function apiRecordToListItemDto(raw: unknown): ClienteListItemDto | null {
  const d = apiRecordToDetalleDto(raw)
  if (!d) return null
  return {
    codigo: d.codigo,
    documentoEtiqueta: `${d.tipoDocumento} ${d.numeroDocumento}`.trim(),
    nombre: d.nombre,
    estadoCodigo: d.estadoCodigo,
    estadoEtiqueta: d.estadoEtiqueta,
    fechaRegistro: d.fechaAlta,
    esBajaLogica: d.esBajaLogica,
  }
}

export function detalleToFormDto(d: ClienteDetalleDto): ClienteFormDto {
  return {
    codigoCliente: d.codigo,
    nombreCompleto: d.nombre,
    tipoDocumento: d.tipoDocumento,
    numeroDocumento: d.numeroDocumento,
    fechaAlta: d.fechaAlta,
    estado: d.estadoCodigo,
    telefono: d.telefono,
    correo: d.correo,
    notas: d.notas,
  }
}

export function emptyFormDto(): ClienteFormDto {
  const hoy = new Date().toISOString().slice(0, 10)
  return {
    codigoCliente: '',
    nombreCompleto: '',
    tipoDocumento: 'CI',
    numeroDocumento: '',
    fechaAlta: hoy,
    estado: 'ACTIVO',
    telefono: '',
    correo: '',
    notas: '',
  }
}
