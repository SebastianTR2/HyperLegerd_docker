import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { workspaceLabel } from '../lib/roles'

interface TopBarProps {
  onMenuClick: () => void
}

const SECTION_META: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Panel principal',
    subtitle: 'Resumen, accesos rápidos y actividad reciente',
  },
  '/registros': {
    title: 'Registros',
    subtitle: 'Alta de cliente y respuesta del servidor',
  },
  '/tokens': {
    title: 'Cuentas token',
    subtitle: 'Emisión y transferencia vía API',
  },
  '/consultas': {
    title: 'Consultas',
    subtitle: 'Buscar por clienteId exacto',
  },
  '/historial': {
    title: 'Historial',
    subtitle: 'Historial de operaciones de la sesión',
  },
  '/trazabilidad': {
    title: 'Trazabilidad',
    subtitle: 'Línea de tiempo y comprobación de TXID',
  },
  '/credenciales': {
    title: 'Credenciales',
    subtitle: 'Rol y cabecera X-API-Key',
  },
}

function maskKey(k: string): string {
  if (!k) return '··············'
  if (k.length <= 6) return '····' + k.slice(-2)
  return '··············' + k.slice(-4)
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { pathname } = useLocation()
  const { mode, apiKey, role, roleLabel } = useSettings()
  const workspace = workspaceLabel(role)
  const meta = useMemo(() => {
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
          <div className="flex max-w-[200px] items-center gap-2 rounded-xl border border-line bg-elevated px-3 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">X-API-Key</span>
            <code className="truncate text-xs text-slate-300">{maskKey(apiKey)}</code>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted hover:bg-surface hover:text-slate-200"
              title="Copiar la clave guardada (misma que se envía en X-API-Key; la vista muestra solo los últimos 4 caracteres)"
              onClick={() => apiKey && void navigator.clipboard?.writeText(apiKey)}
            >
              <IconCopy className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="rounded-full border border-line bg-elevated px-3 py-1 text-xs font-medium text-slate-300">
            Rol: <span className="text-accent">{roleLabel}</span>
          </span>
          <span className="rounded-full border border-line bg-elevated px-3 py-1 text-xs font-medium text-slate-300">
            Espacio: <span className="text-slate-200">{workspace}</span>
          </span>
          <div className="flex items-center gap-2 rounded-full border border-line bg-elevated px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-xs text-muted">{mode === 'api' ? 'Proxy /api' : 'Solo navegador'}</span>
          </div>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-elevated text-xs font-semibold text-slate-200"
            title="Usuario de sesión"
          >
            AD
          </div>
        </div>
      </div>
    </header>
  )
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  )
}
