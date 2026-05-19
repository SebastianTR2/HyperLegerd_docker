/** Caracteres típicos de Base64 estándar (sin espacios). */
const B64_PATTERN = /^[A-Za-z0-9+/]+=*$/

/**
 * Decodifica solo si el valor parece Base64 válido (p. ej. nombre/email del ledger).
 * No altera CI, estados, fechas, correos en claro ni textos cortos normales.
 */
export function decodeIfBase64(value: string): string {
  const s = value.trim()
  if (!s) return value
  if (s.includes('@') || s.includes(' ') || s.includes('\n') || s.includes('\r')) {
    return value
  }
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
