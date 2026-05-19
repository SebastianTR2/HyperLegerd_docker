/** Marca de baja en notas (api-middleware). */
const MARCA_BAJA_LOGICA_API = '[baja-logica-api]'

export interface NotasLedgerParseadas {
  /** Texto editable / visible como nota de negocio. */
  notasNegocio: string
  /** Líneas técnicas (firma, actor, baja) para sección informativa. */
  informacionAuditoria: string | null
}

const FIRMA_PREFIX_RE = /^FIRMA:\s*(SIG-[a-f0-9]+)\s*\|\s*/i

/**
 * Separa nota de negocio de metadatos del ledger (FIRMA, actor, baja lógica).
 * `notasRaw` completo se conserva para detectar baja lógica vía {@link MARCA_BAJA_LOGICA_API}.
 */
export function parseNotasLedger(notasRaw: string): NotasLedgerParseadas {
  let rest = notasRaw.trim()
  const auditParts: string[] = []

  const firmaMatch = rest.match(FIRMA_PREFIX_RE)
  if (firmaMatch) {
    auditParts.push(`Firma de integridad: ${firmaMatch[1]}`)
    rest = rest.slice(firmaMatch[0].length).trim()
  }

  const businessLines: string[] = []

  for (const line of rest.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    if (t.includes(MARCA_BAJA_LOGICA_API) || /baja\s+l[oó]gica\s+registrada/i.test(t)) {
      auditParts.push(t)
      continue
    }
    if (t.toLowerCase().startsWith('[actor]')) {
      const { actorLabel, business } = parseActorLine(t)
      if (actorLabel) auditParts.push(`Operador: ${actorLabel}`)
      if (business) businessLines.push(business)
      continue
    }
    if (t.startsWith('[') && !t.toLowerCase().startsWith('[actor]')) {
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

/** `[actor] Nombre · rol · usuario nota` → metadatos + nota de negocio. */
function parseActorLine(line: string): { actorLabel: string; business: string } {
  const body = line.replace(/^\[actor\]\s*/i, '').trim()
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
