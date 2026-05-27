/** Marca de baja en notas (api-middleware). */
export const MARCA_BAJA_LOGICA_API = '[baja-logica-api]'

export interface NotasLedgerParseadas {
  notasNegocio: string
  informacionAuditoria: string | null
}

/** Actor del portal (cabeceras X-Actor-* → prefijo [actor] en ledger). */
export interface ActorAuditoria {
  nombre: string
  rol: string
  username?: string
}

export type FuenteNotasAuditoria =
  | string
  | {
      notas?: string
      notasLedger?: string
      informacionAuditoria?: string | null
    }
  | null
  | undefined

const FIRMA_CHUNK_RE = /FIRMA:\s*(SIG-[a-f0-9]+)\s*\|\s*/gi
const ACTOR_CHUNK_RE =
  /\[actor\]\s*[\s\S]*?(?=\s*FIRMA:|\s*\[actor\]|$)/gi
const ACTOR_PARTS_RE =
  /\[actor\]\s*([^·\n|]+?)\s*·\s*([^·\n|]+?)(?:\s*·\s*([^·[\n|]*))?/gi
const LEGACY_OPERADOR_RE = /\[(?!baja-logica-api)[^\]]+\]/gi

function actorDesdePartes(nombre: string, rol: string, third?: string): ActorAuditoria {
  const t = (third ?? '').trim()
  const username = t ? t.split(/\s+/)[0] : undefined
  return { nombre: nombre.trim(), rol: rol.trim(), username }
}

/** Todos los bloques [actor] en orden (altas/ediciones en la misma cadena de notas). */
export function extraerTodosActoresAuditoria(notasRaw: string): ActorAuditoria[] {
  const out: ActorAuditoria[] = []
  let rest = notasRaw.trim().replace(FIRMA_CHUNK_RE, ' ')
  const re = new RegExp(ACTOR_PARTS_RE.source, 'gi')
  for (const m of rest.matchAll(re)) {
    const nombre = (m[1] ?? '').trim()
    const rol = (m[2] ?? '').trim()
    if (nombre || rol) out.push(actorDesdePartes(nombre, rol, m[3]))
  }
  return out
}

/**
 * Actor de la operación que escribió esta versión en ledger.
 * Si hay varios [actor] acumulados (dato antiguo), usa el último — quien hizo esa escritura.
 */
export function extraerActorAuditoria(notasRaw: string): ActorAuditoria | null {
  const todos = extraerTodosActoresAuditoria(notasRaw)
  if (todos.length > 0) return todos[todos.length - 1]

  const rest = notasRaw.trim().replace(FIRMA_CHUNK_RE, ' ').trim()
  const legacy = rest.match(/\[([^\]]+)\]/)
  if (legacy && !/^actor\b/i.test(legacy[1].trim())) {
    const full = legacy[1].trim()
    const paren = full.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
    if (paren) {
      return { nombre: paren[1].trim(), rol: paren[2].trim() }
    }
    return { nombre: full, rol: '' }
  }
  return null
}

function parseActorBody(chunk: string): { actorLabel: string; business: string } {
  const actor = extraerActorAuditoria(chunk.startsWith('[actor]') ? chunk : `[actor] ${chunk}`)
  if (!actor) {
    return { actorLabel: chunk.replace(/^\[actor\]\s*/i, '').trim(), business: '' }
  }
  const actorLabel = [actor.nombre, actor.rol, actor.username].filter(Boolean).join(' · ')
  const body = chunk.replace(/^\[actor\]\s*/i, '').trim()
  const parts = body.split(' · ')
  let business = ''
  if (parts.length >= 3) {
    const userAndNote = parts.slice(2).join(' · ').trim()
    const spaceIdx = userAndNote.indexOf(' ')
    if (spaceIdx > 0) business = userAndNote.slice(spaceIdx + 1).trim()
  }
  return { actorLabel, business }
}

/**
 * Separa nota de negocio de metadatos del ledger (FIRMA, actor, baja).
 * Soporta varias capas en una sola línea (histórico antes de sanitizar en middleware).
 */
export function parseNotasLedger(notasRaw: string): NotasLedgerParseadas {
  const auditParts: string[] = []
  let rest = notasRaw.trim()

  const firmas = [...rest.matchAll(FIRMA_CHUNK_RE)]
  for (const m of firmas) {
    if (m[1]) auditParts.push(`Firma de integridad: ${m[1]}`)
  }
  rest = rest.replace(FIRMA_CHUNK_RE, ' ').trim()

  const actores = [...rest.matchAll(ACTOR_CHUNK_RE)]
  for (const m of actores) {
    const { actorLabel, business } = parseActorBody(m[0])
    if (actorLabel) auditParts.push(`Operador: ${actorLabel}`)
    if (business) rest = `${rest} ${business}`.trim()
  }
  rest = rest.replace(ACTOR_CHUNK_RE, ' ').trim()

  const legacy = [...rest.matchAll(LEGACY_OPERADOR_RE)]
  for (const m of legacy) {
    const t = m[0].trim()
    if (t.toLowerCase().startsWith('[actor]')) continue
    auditParts.push(t)
  }
  rest = rest.replace(LEGACY_OPERADOR_RE, ' ').trim()

  const businessLines: string[] = []
  for (const line of rest.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    if (t.includes(MARCA_BAJA_LOGICA_API) || /baja\s+l[oó]gica\s+registrada/i.test(t)) {
      auditParts.push(t)
      continue
    }
    businessLines.push(t)
  }

  return {
    notasNegocio: businessLines.join('\n').trim(),
    informacionAuditoria: auditParts.length > 0 ? auditParts.join('\n') : null,
  }
}

export function notasCrudasParaAuditoria(source: FuenteNotasAuditoria): string {
  if (source == null) return ''
  if (typeof source === 'string') return source.trim()
  return (source.notasLedger ?? source.notas ?? '').trim()
}

function actorDesdeInformacionAuditoria(info: string | null | undefined): ActorAuditoria | null {
  if (!info) return null
  let last: ActorAuditoria | null = null
  for (const line of info.split(/\r?\n/)) {
    const m = line.match(/^Operador:\s*(.+)$/i)
    if (!m) continue
    const parts = m[1].split(' · ').map((p) => p.trim())
    if (parts.length >= 2) {
      last = { nombre: parts[0], rol: parts[1], username: parts[2] }
    } else if (parts[0]) {
      last = { nombre: parts[0], rol: '' }
    }
  }
  return last
}

export function rolEtiquetaAuditoria(rol: string): string {
  switch (rol.trim().toLowerCase()) {
    case 'admin':
      return 'Admin'
    case 'integrador':
      return 'Integrador'
    case 'lectura':
    case 'solo_lectura':
      return 'Solo lectura'
    default:
      return rol.trim() || 'Usuario'
  }
}

function inferirAutorScriptEtapa(notas: string): string | null {
  const n = notas.toUpperCase()
  if (n.includes('ETAPA 1') || n.includes('REGISTRADO')) return 'Encargado de Almacén'
  if (n.includes('ETAPA 2') || n.includes('PRODUCCION')) return 'Operador de Planta'
  if (n.includes('ETAPA 3') || n.includes('CALIDAD')) return 'Inspector de Calidad'
  if (n.includes('ETAPA 4') || n.includes('SELLADO')) return 'Supervisor General'
  return null
}

function formatearActorDisplay(actor: ActorAuditoria): string {
  const rolLabel = actor.rol ? rolEtiquetaAuditoria(actor.rol) : ''
  if (actor.nombre && rolLabel) return `${actor.nombre} (${rolLabel})`
  if (actor.nombre) return actor.nombre
  if (rolLabel) return rolLabel
  return 'Sistema'
}

/**
 * Autor/rol de la operación representada por estas notas (una revisión del historial).
 * Usa el último [actor] en la cadena = quien registró esa versión en cadena.
 */
export function autorRolDisplayDesdeNotas(source: FuenteNotasAuditoria): string {
  const raw = notasCrudasParaAuditoria(source)
  if (!raw) {
    if (source && typeof source === 'object') {
      const fromInfo = actorDesdeInformacionAuditoria(source.informacionAuditoria)
      if (fromInfo) return formatearActorDisplay(fromInfo)
    }
    return 'Sistema'
  }

  const actor = extraerActorAuditoria(raw)
  if (actor) return formatearActorDisplay(actor)

  if (source && typeof source === 'object') {
    const fromInfo = actorDesdeInformacionAuditoria(source.informacionAuditoria)
    if (fromInfo) return formatearActorDisplay(fromInfo)
  }

  const script = inferirAutorScriptEtapa(raw)
  if (script) return script

  return 'Sistema'
}
