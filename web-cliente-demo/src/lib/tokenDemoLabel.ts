/** Valor por defecto del código de token en formularios (alinear con el token desplegado en red). */
export const DEFAULT_TOKEN_CODE = 'TOK001'

/** Etiqueta del código de token tal como viene del ledger/API (sin sustitución). */
export function etiquetaTokenDemo(codigo?: string | null): string {
  const t = (codigo ?? '').trim()
  return t === '' ? '—' : t
}
