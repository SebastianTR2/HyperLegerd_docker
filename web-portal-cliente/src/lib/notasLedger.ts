/** Marca de baja en notas (api-middleware). */
export const MARCA_BAJA_LOGICA_API = '[baja-logica-api]'

export interface NotasLedgerParseadas {
  /** Texto editable / visible como nota de negocio. */
  notasNegocio: string
  /** Líneas técnicas (firma, actor, baja) para sección informativa. */
  informacionAuditoria: string | null
}

const FIRMA_CHUNK_RE = /FIRMA:\s*(SIG-[a-f0-9]+)\s*\|\s*/gi
const ACTOR_CHUNK_RE =
  /\[actor\]\s*[\s\S]*?(?=\s*FIRMA:|\s*\[actor\]|$)/gi
const LEGACY_OPERADOR_RE = /\[(?!baja-logica-api)[^\]]+\]/gi

/**
 * Separa nota de negocio de metadatos del ledger (FIRMA, actor, baja lógica).
 * Soporta varias capas acumuladas en un solo campo (altas y ediciones sucesivas).
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

  const notasNegocio = businessLines.join('\n').trim()
  const informacionAuditoria =
    auditParts.length > 0 ? auditParts.join('\n') : null

  return { notasNegocio, informacionAuditoria }
}

function parseActorBody(chunk: string): { actorLabel: string; business: string } {
  const body = chunk.replace(/^\[actor\]\s*/i, '').trim()
  const parts = body.split(' · ')
  if (parts.length < 3) {
    return { actorLabel: body, business: '' }
  }
  const name = parts[0]?.trim() ?? ''
  const role = parts[1]?.trim() ?? ''
  const userAndNote = parts.slice(2).join(' · ').trim()
  const spaceIdx = userAndNote.indexOf(' ')
  let username = userAndNote
  let business = ''
  if (spaceIdx > 0) {
    username = userAndNote.slice(0, spaceIdx).trim()
    business = userAndNote.slice(spaceIdx + 1).trim()
  }
  const actorLabel = [name, role, username].filter(Boolean).join(' · ')
  return { actorLabel, business }
}
