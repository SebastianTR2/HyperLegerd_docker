import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { formatDemoDateTime } from '../lib/format'
import { etiquetaOrganizacion } from '../lib/organizacion'
import { useNotificacionesAdmin } from '../lib/notificacionesAdminHook'
import type { NotificacionAdmin } from '../services/apiNotificacionesAdmin'

const PANEL_BG = '#131a24'
const CARD_BG = '#1a2330'
const OVERLAY_Z = 9998
const DRAWER_Z = 9999

/**
 * Campana en la barra + drawer de avisos admin.
 * El drawer se monta con portal en document.body para no quedar atrapado
 * dentro del header (que usa backdrop-blur y rompe position:fixed).
 */
export function NotificacionesAdminPanel() {
  const { role, mode, apiKey, tenant } = useSettings()
  const { showToast } = useDemoStore()
  const [abierto, setAbierto] = useState(false)
  const organizacion = etiquetaOrganizacion(tenant)

  const habilitado = role === 'admin' && mode === 'api' && apiKey.trim().length > 0

  const { items, estado, errorMensaje, noLeidas, marcarLeidas, reintentar, limpiar } = useNotificacionesAdmin({
    activo: habilitado,
    onNueva: (n) => {
      if (!abierto) {
        showToast(`Nuevo aviso: ${n.tipo} → ${n.recurso ?? '—'}`, 'info')
      }
    },
  })

  const onLimpiar = async () => {
    await limpiar()
    showToast('Avisos limpiados.', 'success')
  }

  useEffect(() => {
    if (abierto) marcarLeidas()
  }, [abierto, marcarLeidas])

  useEffect(() => {
    if (!abierto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [abierto])

  if (!habilitado) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="relative flex h-9 items-center gap-1.5 rounded-full border border-line bg-elevated px-3 text-xs font-medium text-slate-200 hover:bg-surface"
        title="Centro de avisos"
        aria-expanded={abierto}
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

      {abierto &&
        createPortal(
          <Drawer
            items={items}
            estado={estado}
            error={errorMensaje}
            organizacion={organizacion}
            onCerrar={() => setAbierto(false)}
            onReintentar={reintentar}
            onLimpiar={onLimpiar}
          />,
          document.body,
        )}
    </>
  )
}

interface DrawerProps {
  items: NotificacionAdmin[]
  estado: 'inactivo' | 'conectando' | 'conectado' | 'error'
  error: string | null
  organizacion: string
  onCerrar: () => void
  onReintentar: () => void
  onLimpiar: () => void
}

function Drawer({ items, estado, error, organizacion, onCerrar, onReintentar, onLimpiar }: DrawerProps) {
  const navigate = useNavigate()
  const ordenados = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [items],
  )

  const irAAuditar = (n: NotificacionAdmin) => {
    onCerrar()
    navigate('/auditoria', {
      state: {
        recursoId: n.recurso?.trim() ?? '',
        txId: n.txId?.trim() ?? '',
      },
    })
  }

  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: OVERLAY_Z, backgroundColor: 'rgba(0,0,0,0.72)' }}
        onClick={onCerrar}
        aria-hidden
      />
      <aside
        className="fixed right-0 top-0 flex h-[100dvh] w-full flex-col border-l border-[#2a3545] shadow-2xl"
        style={{ zIndex: DRAWER_Z, backgroundColor: PANEL_BG, maxWidth: 'min(92vw, 22rem)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notificaciones-drawer-title"
      >
        <header
          className="shrink-0 border-b px-5 py-4"
          style={{ borderColor: '#2a3545', backgroundColor: PANEL_BG }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8b9aaf]">
                CampusChain · {organizacion}
              </p>
              <h2 id="notificaciones-drawer-title" className="text-base font-semibold text-slate-100">
                Centro de avisos
              </h2>
              <p className="mt-0.5 text-xs text-[#8b9aaf]">Cambios recientes en la red.</p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="shrink-0 rounded-lg border p-2 text-[#8b9aaf] hover:text-slate-100"
              style={{ borderColor: '#2a3545', backgroundColor: CARD_BG }}
              aria-label="Cerrar"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div
          className="flex shrink-0 items-center justify-between border-b px-5 py-2.5 text-xs"
          style={{ borderColor: '#2a3545', backgroundColor: PANEL_BG }}
        >
          <div className="flex items-center gap-2 text-[#8b9aaf]">
            <EstadoDot estado={estado} />
            <span>
              {estado === 'conectado' && 'Recibiendo avisos en vivo'}
              {estado === 'conectando' && 'Conectando…'}
              {estado === 'error' && 'Sin conexión'}
              {estado === 'inactivo' && 'Inactivo'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {estado === 'error' && (
              <button
                type="button"
                onClick={onReintentar}
                className="rounded-md bg-[#3d5266] px-2.5 py-1 font-medium text-slate-100 hover:bg-[#5a7a9a]"
              >
                Reintentar
              </button>
            )}
            <button
              type="button"
              onClick={onLimpiar}
              disabled={items.length === 0}
              className="rounded-md border px-2.5 py-1 font-medium text-[#8b9aaf] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: '#2a3545', backgroundColor: CARD_BG }}
              title="Borrar todos los avisos"
            >
              Limpiar
            </button>
          </div>
        </div>

        {error && (
          <div
            className="shrink-0 border-b px-5 py-2.5 text-sm text-[#e8a0a0]"
            style={{ borderColor: '#5c3030', backgroundColor: '#2a1818' }}
          >
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3" style={{ backgroundColor: PANEL_BG }}>
          {ordenados.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-[#8b9aaf]">
              Sin avisos recientes.
            </p>
          ) : (
            <ul className="space-y-2">
              {ordenados.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border px-3 py-2.5"
                  style={{ borderColor: '#2a3545', backgroundColor: CARD_BG }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-100">
                        {formatearTipoEvento(n.tipo)}
                        {n.recurso ? (
                          <span className="font-mono text-[#6d8aad]"> · {n.recurso}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#8b9aaf]">
                        {resumenCorto(n)}
                        {' · '}
                        {formatDemoDateTime(n.timestamp)}
                      </p>
                    </div>
                  </div>
                  {n.recurso ? (
                    <button
                      type="button"
                      onClick={() => irAAuditar(n)}
                      className="mt-2 w-full rounded-md border px-2 py-1.5 text-center text-xs font-medium text-[#6d8aad] hover:bg-[#2a3545] hover:text-slate-100"
                      style={{ borderColor: '#3d5266', backgroundColor: PANEL_BG }}
                    >
                      Ver detalles
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}

function formatearTipoEvento(tipo: string): string {
  const map: Record<string, string> = {
    'cliente.creado': 'Cliente creado',
    'cliente.editado': 'Cliente editado',
    'cliente.dado_de_baja': 'Cliente dado de baja',
    'dato.creado': 'Dato creado',
    'dato.editado': 'Dato editado',
    'dato.eliminado': 'Dato eliminado',
  }
  return map[tipo] ?? tipo.replace(/\./g, ' · ')
}

/** Una línea: quién hizo el cambio (si hay dato). */
function resumenCorto(n: NotificacionAdmin): string {
  if (n.actorNombre?.trim()) return n.actorNombre.trim()
  if (n.actorRol) return etiquetaRol(n.actorRol)
  return 'Cambio en la red'
}

function etiquetaRol(rol: string): string {
  if (rol === 'admin') return 'Administrador'
  if (rol === 'integrador') return 'Integrador'
  if (rol === 'lectura' || rol === 'solo_lectura') return 'Solo lectura'
  return rol
}

function EstadoPill({ estado }: { estado: 'inactivo' | 'conectando' | 'conectado' | 'error' }) {
  if (estado === 'conectado') return <span className="h-2 w-2 rounded-full bg-[#4a9d7a]" />
  if (estado === 'conectando') return <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
  if (estado === 'error') return <span className="h-2 w-2 rounded-full bg-[#b85c5c]" />
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
