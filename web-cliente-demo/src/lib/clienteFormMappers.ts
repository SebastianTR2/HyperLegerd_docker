import type { ClienteApi } from '../types/api'
import type { Registro, RegistroInput } from '../types/registro'

export function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyClienteForm(): ClienteApi {
  return {
    clienteId: '',
    nombre: '',
    tipoDocumento: 'CI',
    numeroDocumento: '',
    fechaAlta: todayYmd(),
    estado: 'ACTIVO',
    telefono: '',
    email: '',
    notas: '',
  }
}

function mapLegacyTipoDocumento(t: string): string {
  const u = t.toUpperCase()
  if (u === 'DNI' || u.includes('CARN')) return 'CI'
  if (u === 'PASAPORTE') return 'PASAPORTE'
  if (u === 'NIT') return 'NIT'
  if (u === 'CI' || u === 'NIT' || u === 'PASAPORTE') return t
  return 'CI'
}

/** Carga un registro demo en el modelo de formulario alineado a la API. */
export function registroToClienteForm(r: Registro): ClienteApi {
  const ymd =
    r.fechaRegistro.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(r.fechaRegistro)
      ? r.fechaRegistro.slice(0, 10)
      : todayYmd()
  let estadoApi = 'ACTIVO'
  if (r.estado === 'inactivo') estadoApi = 'INACTIVO'
  else if (r.estado === 'baja') estadoApi = 'DADO_DE_BAJA'
  else if (r.estado === 'pendiente') estadoApi = 'ACTIVO'

  return {
    clienteId: r.id,
    nombre: r.nombreCompleto,
    tipoDocumento: mapLegacyTipoDocumento(r.tipoDocumento),
    numeroDocumento: r.documento,
    fechaAlta: ymd,
    estado: estadoApi,
    telefono: r.telefono ?? '',
    email: r.email ?? '',
    notas: r.facultad === '—' ? '' : r.facultad,
  }
}

/** Convierte el formulario unificado al input de la demo local. */
export function clienteFormToRegistroInput(c: ClienteApi): RegistroInput {
  const estado: RegistroInput['estado'] =
    c.estado === 'INACTIVO' ? 'inactivo' : c.estado === 'DADO_DE_BAJA' ? 'baja' : 'activo'
  return {
    clienteId: c.clienteId.trim(),
    tipoDocumento: c.tipoDocumento,
    documento: c.numeroDocumento.trim(),
    nombreCompleto: c.nombre.trim(),
    email: (c.email ?? '').trim(),
    facultad: (c.notas ?? '').trim() || '—',
    estado,
    telefono: (c.telefono ?? '').trim() || undefined,
    fechaAlta: c.fechaAlta.trim(),
  }
}

/** Cuerpo JSON para `POST /clientes`: sin cadenas vacías en opcionales (evita validación estricta en backend). */
export function sanitizeClienteApiBody(c: ClienteApi): ClienteApi {
  const base: ClienteApi = {
    clienteId: c.clienteId.trim(),
    nombre: c.nombre.trim(),
    tipoDocumento: c.tipoDocumento,
    numeroDocumento: c.numeroDocumento.trim(),
    fechaAlta: c.fechaAlta.trim(),
    estado: c.estado,
  }
  const t = c.telefono?.trim()
  const em = c.email?.trim()
  const n = c.notas?.trim()
  if (t) base.telefono = t
  if (em) base.email = em
  if (n) base.notas = n
  return base
}
