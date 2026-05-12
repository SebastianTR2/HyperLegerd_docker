import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { describeApiError } from '../lib/apiErrorMessage'
import { formatDemoDateTime } from '../lib/format'
import {
  crearCuentaTokenApi,
  listarCuentasTokenApi,
  obtenerCuentaTokenApi,
  type CuentaTokenVista,
} from '../services/apiCuentasVisibles'
import { etiquetaTokenDemo } from '../lib/tokenDemoLabel'

const input =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-accent-soft focus:ring-2 focus:ring-accent/25'

const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50'

const btnGhost =
  'inline-flex items-center justify-center rounded-xl border border-line bg-transparent px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-surface disabled:opacity-50'

const btnIcon =
  'inline-flex items-center justify-center rounded-lg border border-line bg-surface/80 px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-elevated hover:text-slate-100 disabled:opacity-50'

function ultimoMovimiento(r: CuentaTokenVista): string {
  const raw = (r.updatedAt ?? r.createdAt ?? '').trim()
  if (!raw) return '—'
  return formatDemoDateTime(raw)
}

export default function CuentasTokenVisiblesPage() {
  const { mode, role, permissions } = useSettings()
  const { pushTrace, showToast } = useDemoStore()

  const [rows, setRows] = useState<CuentaTokenVista[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const [nuevoAlias, setNuevoAlias] = useState('')
  const [saldoBusyAlias, setSaldoBusyAlias] = useState<string | null>(null)

  const [ultimaTx, setUltimaTx] = useState<{ mensaje: string; txId: string } | null>(null)

  const listaReqId = useRef(0)

  const cargarLista = useCallback(async () => {
    const id = ++listaReqId.current
    setLoadError(null)
    setLoading(true)
    try {
      const list = await listarCuentasTokenApi()
      if (id !== listaReqId.current) return
      setRows(list)
      setLoadError(null)
    } catch (e) {
      if (id !== listaReqId.current) return
      setLoadError(describeApiError(e))
    } finally {
      if (id === listaReqId.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void cargarLista()
  }, [cargarLista])

  useEffect(() => {
    const onRefresh = () => {
      void cargarLista()
    }
    window.addEventListener('cuentas-token-visibles-refresh', onRefresh)
    return () => window.removeEventListener('cuentas-token-visibles-refresh', onRefresh)
  }, [cargarLista])

  const copiarAlias = async (alias: string) => {
    try {
      await navigator.clipboard.writeText(alias)
      showToast(`Alias copiado: ${alias}`, 'success')
    } catch {
      showToast('No se pudo copiar al portapapeles.', 'error')
    }
  }

  const refrescarSaldoFila = async (alias: string) => {
    setSaldoBusyAlias(alias)
    try {
      const v = await obtenerCuentaTokenApi(alias)
      if (v) {
        setRows((prev) => prev.map((r) => (r.alias === alias ? { ...r, ...v } : r)))
        showToast(`Saldo actualizado · ${alias}`, 'success')
      } else {
        showToast('No se pudo obtener el saldo de esa cuenta.', 'error')
      }
    } finally {
      setSaldoBusyAlias(null)
    }
  }

  const onCrear = async (e: FormEvent) => {
    e.preventDefault()
    if (!permissions.canCreateVisibleTokenAccount) {
      showToast('Solo administrador e integrador pueden crear cuentas visibles.', 'error')
      return
    }
    const alias = nuevoAlias.trim()
    if (!alias) {
      showToast('Indica un alias para la cuenta.', 'error')
      return
    }
    setCreateError(null)
    try {
      const r = await crearCuentaTokenApi(alias)
      setUltimaTx({ mensaje: r.mensaje ?? 'Cuenta creada.', txId: r.txId })
      setNuevoAlias('')
      showToast('Cuenta token visible creada.', 'success')
      pushTrace({
        operationType: 'CUENTA_VISIBLE_CREADA',
        mode,
        role,
        state: 'exitoso',
        message: `Cuenta token visible · alias ${alias}`,
        txId: r.txId,
        steps: [
          { id: 'cap', label: 'Alias', status: 'exitoso', detail: alias },
          { id: 'api', label: 'POST /tokens/cuentas', status: 'exitoso', detail: r.txId },
        ],
      })
      await cargarLista()
    } catch (error) {
      const msg = describeApiError(error)
      setCreateError(msg)
      showToast(msg, 'error')
      pushTrace({
        operationType: 'ERROR_API',
        mode,
        role,
        state: 'error',
        message: msg,
        steps: [{ id: 'api', label: 'POST /tokens/cuentas', status: 'error', detail: msg }],
      })
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Cuentas token visibles</h1>
          <p className="mt-1 text-sm text-muted">
            Consulta de cuentas por alias en el ledger · proxy <span className="font-mono text-slate-400">/api</span>
          </p>
          {mode !== 'api' ? (
            <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Sin conexión API: configure la clave y el modo API en Credenciales para operar contra el middleware.
            </p>
          ) : null}
        </div>
        <button type="button" className={`${btnGhost} shrink-0 sm:self-center`} onClick={() => void cargarLista()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Refrescar'}
        </button>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <span className="font-medium">Error al cargar el listado:</span> {loadError}
        </div>
      ) : null}

      <div className="min-h-0 overflow-hidden rounded-2xl border border-line bg-elevated/90 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface/95 text-xs uppercase text-muted backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 font-medium">Alias / cuenta</th>
                <th className="px-4 py-3 font-medium">Saldo</th>
                <th className="px-4 py-3 font-medium">TOKEN</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Último movimiento</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.alias} className="hover:bg-surface/40">
                  <td className="px-4 py-3 font-mono text-xs text-slate-100">{r.alias}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-200">{r.saldo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{etiquetaTokenDemo(r.codigoToken)}</td>
                  <td className="px-4 py-3 text-muted">{r.estado ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-xs text-muted md:table-cell">{ultimoMovimiento(r)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" className={btnIcon} onClick={() => void copiarAlias(r.alias)} title="Copiar alias">
                        Copiar
                      </button>
                      <button
                        type="button"
                        className={btnIcon}
                        onClick={() => void refrescarSaldoFila(r.alias)}
                        disabled={saldoBusyAlias === r.alias}
                        title="Refrescar saldo desde el ledger"
                      >
                        {saldoBusyAlias === r.alias ? '…' : 'Saldo'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && rows.length === 0 && !loadError ? (
          <p className="border-t border-line px-4 py-10 text-center text-sm text-muted">
            No hay cuentas token visibles registradas.
          </p>
        ) : null}
      </div>

      {ultimaTx ? (
        <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-slate-200">
          <span className="text-muted">Última alta:</span>{' '}
          <span className="font-mono text-accent">{ultimaTx.txId}</span>
          <span className="ml-2 text-slate-400">{ultimaTx.mensaje}</span>
        </div>
      ) : null}

      {permissions.canCreateVisibleTokenAccount ? (
        <details className="group rounded-2xl border border-line bg-surface/40 shadow-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-200 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="text-muted transition-transform group-open:rotate-90">▸</span>
              Crear cuenta token visible
              <span className="text-xs font-normal text-muted">(POST /tokens/cuentas · admin / integrador)</span>
            </span>
          </summary>
          <div className="border-t border-line px-4 pb-4 pt-2">
            <form onSubmit={onCrear} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="block text-xs font-medium text-muted">Alias</label>
                <input
                  className={`${input} mt-1`}
                  value={nuevoAlias}
                  onChange={(ev) => setNuevoAlias(ev.target.value)}
                  placeholder="ej. alex"
                  autoComplete="off"
                />
              </div>
              <button type="submit" className={btnPrimary}>
                Crear cuenta
              </button>
            </form>
            {createError ? (
              <p className="mt-3 text-sm text-red-300">
                <span className="font-medium">No se pudo crear:</span> {createError}
              </p>
            ) : null}
          </div>
        </details>
      ) : (
        <p className="text-sm text-muted">
          Tu rol puede consultar la tabla; crear cuentas corresponde a administrador e integrador.
        </p>
      )}
    </div>
  )
}
