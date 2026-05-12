import { apiFetch, ApiHttpError, apiJson } from './apiClient'
import type { RespuestaError, RespuestaExitoTx } from '../types/api'

export interface CuentaTokenVista {
  alias: string
  saldo: number
  codigoToken?: string
  estado?: string
  createdAt?: string
  updatedAt?: string
}

interface RespuestaLecturaGen {
  ok?: boolean
  datos?: unknown
}

function unwrapDatos<T>(body: RespuestaLecturaGen | null | undefined): T | null {
  if (!body || typeof body !== 'object') return null
  const d = body.datos
  return (d ?? null) as T | null
}

/** Normaliza `datos` del backend a filas de tabla (array, objeto único, vacío). */
export function normalizarDatosCuentasLista(datos: unknown): CuentaTokenVista[] {
  if (datos == null) return []
  if (Array.isArray(datos)) {
    return datos.map(mapearFilaCuenta).filter((r): r is CuentaTokenVista => r != null)
  }
  if (typeof datos === 'object') {
    const r = mapearFilaCuenta(datos)
    return r ? [r] : []
  }
  return []
}

function mapearFilaCuenta(raw: unknown): CuentaTokenVista | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const aliasRaw = o.alias
  const alias = typeof aliasRaw === 'string' ? aliasRaw.trim() : String(aliasRaw ?? '').trim()
  if (!alias) return null

  let saldo = 0
  if (typeof o.saldo === 'number' && Number.isFinite(o.saldo)) saldo = Math.trunc(o.saldo)
  else if (typeof o.saldo === 'string') saldo = Math.trunc(Number(o.saldo.replace(',', '.')) || 0)

  return {
    alias,
    saldo,
    codigoToken: typeof o.codigoToken === 'string' ? o.codigoToken : undefined,
    estado: typeof o.estado === 'string' ? o.estado : undefined,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : undefined,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
  }
}

/**
 * Lista cuentas token visibles. Usa fetch explícito para log en consola y para tratar
 * `ok: true` + `datos` como éxito aunque el status HTTP sea anómalo (proxy / carreras).
 */
export async function listarCuentasTokenApi(): Promise<CuentaTokenVista[]> {
  let res: Response
  try {
    res = await apiFetch('/tokens/cuentas')
  } catch (e) {
    throwConnectionHint(e)
  }
  let text: string
  try {
    text = await res.text()
  } catch (e) {
    throwConnectionHint(e)
  }

  if (import.meta.env.DEV) {
    /* eslint-disable no-console */
    console.info('[GET /api/tokens/cuentas] cuerpo exacto (texto):', text)
    /* eslint-enable no-console */
  }

  let parsed: unknown = null
  try {
    parsed = text ? (JSON.parse(text) as unknown) : null
  } catch {
    parsed = null
  }

  if (import.meta.env.DEV && parsed !== null) {
    /* eslint-disable no-console */
    console.info('[GET /api/tokens/cuentas] cuerpo parseado (JSON):', parsed)
    /* eslint-enable no-console */
  }

  const obj = parsed && typeof parsed === 'object' ? (parsed as RespuestaLecturaGen) : null

  if (obj && obj.ok === true) {
    const rows = normalizarDatosCuentasLista(obj.datos)
    if (import.meta.env.DEV) {
      /* eslint-disable no-console */
      console.info('[GET /api/tokens/cuentas] ok=true → filas para la tabla:', rows)
      /* eslint-enable no-console */
    }
    return rows
  }

  if (!res.ok) {
    const apiErr =
      obj && typeof obj === 'object' && 'ok' in obj && (obj as RespuestaError).ok === false
        ? (obj as RespuestaError)
        : null
    const looksLikeProxyDown =
      !apiErr?.mensaje?.trim() &&
      (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) &&
      (!text?.trim() || parsed === null || isHtmlLike(text))

    if (looksLikeProxyDown) {
      throw new Error(
        'El proxy de Vite no pudo conectar con el middleware (ECONNREFUSED). Compruebe el API y la variable VITE_API_TARGET si usa WSL; pulse Refrescar.',
      )
    }

    throw new ApiHttpError(res.status, apiErr, apiErr?.mensaje)
  }

  if (obj?.datos !== undefined) {
    return normalizarDatosCuentasLista(obj.datos)
  }

  return []
}

function isHtmlLike(s: string): boolean {
  const t = s.trimStart().toLowerCase()
  return t.startsWith('<!') || t.startsWith('<html')
}

function throwConnectionHint(e: unknown): never {
  if (e instanceof TypeError || (e instanceof Error && /fetch|network|failed/i.test(e.message))) {
    throw new Error(
      'Sin conexión al backend vía proxy /api. Arranque el middleware y, si el API está en WSL y la web en Windows, defina VITE_API_TARGET (p. ej. IP de WSL:3000) y reinicie npm run dev.',
    )
  }
  if (e instanceof Error) throw e
  throw new Error(String(e))
}

/** Normaliza alias como en chaincode (trim + minúsculas). */
export function normalizarAliasCuenta(alias: string): string {
  return alias.trim().toLowerCase()
}

/** Para validar destinatario/origen contra GET /tokens/cuentas. */
export async function obtenerSetAliasesVisibles(): Promise<Set<string>> {
  const list = await listarCuentasTokenApi()
  return new Set(list.map((c) => normalizarAliasCuenta(c.alias)))
}

export async function obtenerCuentaTokenApi(alias: string): Promise<CuentaTokenVista | null> {
  try {
    const j = await apiJson<RespuestaLecturaGen | null>(`/tokens/cuentas/${encodeURIComponent(alias)}`)
    if (!j || typeof j !== 'object') return null
    const d = unwrapDatos<CuentaTokenVista>(j)
    if (!d || typeof d !== 'object') return null
    const rows = normalizarDatosCuentasLista([d])
    return rows[0] ?? null
  } catch {
    return null
  }
}

export async function crearCuentaTokenApi(alias: string): Promise<RespuestaExitoTx> {
  const r = await apiJson<RespuestaExitoTx | null>('/tokens/cuentas', {
    method: 'POST',
    body: JSON.stringify({ alias }),
  })
  if (!r || typeof r !== 'object') {
    throw new Error('Respuesta vacía del servidor al crear cuenta token.')
  }
  return r
}

export async function emitirCuentaVisibleApi(body: {
  destinatario: string
  monto: number
  codigoToken: string
}): Promise<RespuestaExitoTx> {
  return apiJson<RespuestaExitoTx>('/tokens/cuentas/emitir', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function transferirCuentasVisiblesApi(body: {
  origen: string
  destino: string
  monto: number
  codigoToken: string
}): Promise<RespuestaExitoTx> {
  return apiJson<RespuestaExitoTx>('/tokens/cuentas/transferir', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Consulta saldo visible; devuelve null si error HTTP. */
export async function saldoCuentaVisibleApi(alias: string, codigoToken: string): Promise<number | null> {
  const q = codigoToken.trim() ? `?codigoToken=${encodeURIComponent(codigoToken.trim())}` : ''
  try {
    const res = await apiFetch(`/tokens/cuentas/${encodeURIComponent(alias)}/saldo${q}`)
    const text = await res.text()
    const parsed = text ? (JSON.parse(text) as RespuestaLecturaGen) : {}
    if (!res.ok) return null
    const datos = parsed.datos as { saldo?: number } | undefined
    return typeof datos?.saldo === 'number' ? datos.saldo : null
  } catch {
    return null
  }
}
