/** Caracteres típicos de Base64 estándar (sin espacios). */
const B64_PATTERN = /^[A-Za-z0-9+/]+=*$/

const SKIP_DECODE_KEYS = new Set([
  'clienteId',
  'ClientId',
  'estado',
  'Estado',
  'fechaAlta',
  'FechaAlta',
  'txId',
  'txid',
  'blockNumber',
  'blockHash',
])

/**
 * Decodifica solo si el valor parece Base64 válido (p. ej. nombre/email del ledger).
 * No altera estados, fechas, IDs ni textos cortos normales.
 */
export function decodeIfBase64(value: string): string {
  const s = value.trim()
  if (!s) return value
  if (s.includes('@') || s.includes(' ') || s.includes('\n') || s.includes('\r')) {
    return value
  }
  if (/^SIG-[a-f0-9]+$/i.test(s)) return value
  if (SKIP_DECODE_KEYS.has(s)) return value
  if (s.length < 4 || s.length % 4 !== 0) return value
  if (!B64_PATTERN.test(s)) return value
  try {
    const decoded = atob(s)
    if (btoa(decoded) !== s) return value
    if (!isReasonablePlainText(decoded)) return value
    return decoded
  } catch {
    return value
  }
}

function isReasonablePlainText(text: string): boolean {
  if (!text.length) return false
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === 9 || c === 10 || c === 13) continue
    if (c < 32) return false
  }
  return true
}

/** Valor legible para tablas de detalle/historial/auditoría. */
export function displayLedgerField(key: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (key === 'notas' || key === 'Notas') {
    return s
  }
  if (SKIP_DECODE_KEYS.has(key)) return s
  const u = s.toUpperCase().replace(/\s+/g, '_')
  if (u === 'ACTIVO' || u === 'INACTIVO' || u === 'DADO_DE_BAJA') return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s
  if (/^(CI|NIT|PASAPORTE)$/i.test(s.trim())) return s
  return decodeIfBase64(s)
}
