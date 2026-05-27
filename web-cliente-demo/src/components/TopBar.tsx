import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { workspaceLabel } from '../lib/roles'
import { NotificacionesAdminPanel } from './NotificacionesAdminPanel'

interface TopBarProps {
  onMenuClick: () => void
}

const SECTION_META: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Panel del puente',
    subtitle: 'Resumen, accesos rápidos y actividad reciente',
  },
  '/clientes-registrados': {
    title: 'Clientes en red',
    subtitle: 'Listado de solo lectura desde GET /clientes',
  },
  '/consultas': {
    title: 'Consultas',
    subtitle: 'Buscar cliente por clienteId exacto',
  },
  '/auditoria': {
    title: 'Auditar',
    subtitle: 'Bitácora HTTP + eventos de cadena (GET /auditoria/combinada)',
  },
  '/historial': {
    title: 'Historial',
    subtitle: 'Operaciones observadas en esta sesión',
  },
  '/trazabilidad': {
    title: 'Trazabilidad',
    subtitle: 'Línea de tiempo y comprobación de TXID',
  },
  '/credenciales': {
    title: 'Perfil de sesión',
    subtitle: 'Datos del usuario y permisos asignados',
  },
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { mode, role, roleLabel, tenant, nombreUsuario } = useSettings()
  const { usuario, logout } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const workspace = workspaceLabel(role)
  const nombre = nombreUsuario || usuario?.usuario || 'Sin sesión'
  const meta = useMemo(() => {
    if (pathname.startsWith('/historial-cliente')) {
      return {
        title: 'Historial en cadena',
        subtitle: 'GET /api/clientes/historial/:clienteId',
      }
    }
    const base = SECTION_META[pathname] ?? SECTION_META['/']
    if (pathname === '/consultas') {
      return { ...base, subtitle: 'GET /api/clientes/:clienteId (proxy al middleware)' }
    }
    return base
  }, [pathname])

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/80 px-4 py-3 backdrop-blur-md sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          className="rounded-lg p-2 text-muted hover:bg-elevated hover:text-slate-200 lg:hidden"
          aria-label="Abrir menú"
          onClick={onMenuClick}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">CampusChain</p>
          <h1 className="truncate text-base font-semibold tracking-tight text-slate-100 sm:text-lg">{meta.title}</h1>
          <p className="hidden truncate text-xs text-muted sm:block">{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div
          className={`hidden rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide sm:block ${
            mode === 'api' ? 'border-accent/40 bg-accent/15 text-accent' : 'border-line bg-surface/60 text-muted'
          }`}
        >
          {mode === 'api' ? 'API' : 'Sin API'}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {tenant && (
            <span className="rounded-full border border-line bg-elevated px-3 py-1 text-xs font-medium text-slate-300">
              Tenant: <span className="text-slate-200">{tenant}</span>
            </span>
          )}
          <span className="rounded-full border border-line bg-elevated px-3 py-1 text-xs font-medium text-slate-300">
            Rol: <span className="text-accent">{roleLabel}</span>
          </span>
          <span className="rounded-full border border-line bg-elevated px-3 py-1 text-xs font-medium text-slate-300">
            Espacio: <span className="text-slate-200">{workspace}</span>
          </span>
          <NotificacionesAdminPanel />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-line bg-elevated px-2 py-1 pr-3 hover:bg-surface"
              title={nombre}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-accent">
                {iniciales(nombre)}
              </span>
              <span className="max-w-[140px] truncate text-xs font-medium text-slate-200">{nombre}</span>
            </button>
            {menuAbierto && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuAbierto(false)} aria-hidden />
                <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
                  <div className="border-b border-line px-3 py-2 text-xs">
                    <p className="truncate font-semibold text-slate-100">{nombre}</p>
                    <p className="truncate text-muted">{usuario?.usuario}</p>
                  </div>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-elevated"
                    onClick={() => {
                      setMenuAbierto(false)
                      navigate('/credenciales')
                    }}
                  >
                    Perfil de sesión
                  </button>
                  <button
                    type="button"
                    className="block w-full border-t border-line px-3 py-2 text-left text-xs text-danger hover:bg-danger/10"
                    onClick={() => {
                      setMenuAbierto(false)
                      void logout().then(() => navigate('/login', { replace: true }))
                    }}
                  >
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

/* IconCopy eliminado: la consola ya no muestra X-API-Key, el botón
 * copiar de la barra superior fue retirado al introducir el login JWT.
 */
