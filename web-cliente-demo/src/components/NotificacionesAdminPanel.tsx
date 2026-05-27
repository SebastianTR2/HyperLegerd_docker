import { useEffect, useMemo, useState } from 'react'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { formatDemoDateTime } from '../lib/format'
import { useNotificacionesAdmin } from '../lib/notificacionesAdminHook'
import type { NotificacionAdmin } from '../services/apiNotificacionesAdmin'

/**
 * NotificacionesAdminPanel renderiza:
 *   - un botón de campana (con badge) en la barra superior,
 *   - un drawer lateral derecho con el feed en vivo.
 *
 * Solo está activo cuando el rol resuelto es admin y hay X-API-Key cargada.
 * No requiere props porque consume SettingsContext directamente.
 */
export function NotificacionesAdminPanel() {
  const { role, mode, apiKey } = useSettings()
  const { showToast } = useDemoStore()
  const [abierto, setAbierto] = useState(false)

  const habilitado = role === 'admin' && mode === 'api' && apiKey.trim().length > 0

  const { items, estado, errorMensaje, noLeidas, marcarLeidas, reintentar } = useNotificacionesAdmin({
    activo: habilitado,
    onNueva: (n) => {
      if (!abierto) {
        showToast(`Nueva notificación: ${n.tipo} → ${n.recurso ?? '—'}`, 'info')
      }
    },
  })

  useEffect(() => {
    if (abierto) marcarLeidas()
  }, [abierto, marcarLeidas])

  if (!habilitado) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="relative flex h-9 items-center gap-1.5 rounded-full border border-line bg-elevated px-3 text-xs font-medium text-slate-200 hover:bg-surface"
        title="Notificaciones del tenant"
      >
        <IconBell className="h-4 w-4 text-slate-300" />
        <span className="hidden sm:inline">Avisos</span>
        <EstadoPill estado={estado} />
        {noLeidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <Drawer
          items={items}
          estado={estado}
          error={errorMensaje}
          onCerrar={() => setAbierto(false)}
          onReintentar={reintentar}
        />
      )}
    </>
  )
}

interface DrawerProps {
  items: NotificacionAdmin[]
  estado: 'inactivo' | 'conectando' | 'conectado' | 'error'
  error: string | null
  onCerrar: () => void
  onReintentar: () => void
}

function Drawer({ items, estado, error, onCerrar, onReintentar }: DrawerProps) {
  const ordenados = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [items],
  )

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onCerrar}
        aria-label="Cerrar panel de notificaciones"
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-slate-100/10 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl backdrop-saturate-150"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-300/80">CampusChain</p>
            <h2 className="text-base font-semibold text-white">Notificaciones del tenant</h2>
            <p className="mt-0.5 text-xs text-slate-300/80">
              Mutaciones detectadas en el ledger por integradores u otros roles.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-2 text-[11px] text-slate-200/90">
          <div className="flex items-center gap-2 text-muted">
            <EstadoDot estado={estado} />
            <span>
              {estado === 'conectado' && 'Conectado al stream en vivo'}
              {estado === 'conectando' && 'Conectando…'}
              {estado === 'error' && 'Sin conexión al stream'}
              {estado === 'inactivo' && 'Inactivo'}
            </span>
          </div>
          {estado === 'error' && (
            <button
              type="button"
              onClick={onReintentar}
              className="rounded-md bg-accent/20 px-2 py-1 font-medium text-accent hover:bg-accent/30"
            >
              Reintentar
            </button>
          )}
        </div>

        {error && (
          <div className="border-b border-danger/30 bg-danger/10 px-5 py-2 text-xs text-danger/90">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {ordenados.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-slate-300/80">
              No hay notificaciones recientes. Aparecerán aquí cuando un integrador modifique el ledger.
            </p>
          ) : (
            <ul className="space-y-2">
              {ordenados.map((n) => (
                <li
                  key={n.id}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm shadow-card backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-sky-200">
                        {n.tipo}
                      </p>
                      <p className="mt-0.5 text-sm text-white">
                        {n.resumen || `${n.tipo} en ${n.recurso ?? '—'}`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
                      {n.recurso ?? '—'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-200/80">
                    <span>{formatDemoDateTime(n.timestamp)}</span>
                    {n.actorRol && (
                      <span className="rounded bg-black/30 px-1.5 py-0.5">
                        {n.actorNombre ? `${n.actorNombre} · ` : ''}
                        rol={n.actorRol}
                      </span>
                    )}
                    {n.txId && (
                      <span className="font-mono text-[10px] text-sky-200/80" title={n.txId}>
                        tx {n.txId.slice(0, 10)}…
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}

function EstadoPill({ estado }: { estado: 'inactivo' | 'conectando' | 'conectado' | 'error' }) {
  if (estado === 'conectado') return <span className="h-2 w-2 rounded-full bg-success" />
  if (estado === 'conectando') return <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
  if (estado === 'error') return <span className="h-2 w-2 rounded-full bg-danger" />
  return <span className="h-2 w-2 rounded-full bg-slate-500" />
}

function EstadoDot({ estado }: { estado: 'inactivo' | 'conectando' | 'conectado' | 'error' }) {
  return <EstadoPill estado={estado} />
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  )
}
