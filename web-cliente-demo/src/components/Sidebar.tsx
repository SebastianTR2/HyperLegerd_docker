import type { ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { routeAllowedForRole, type AppRoutePath } from '../lib/roles'

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

type NavItem = {
  to: AppRoutePath
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
}

const items: NavItem[] = [
  { to: '/', label: 'Panel', icon: IconGrid, end: true },
  { to: '/registros', label: 'Registros del sistema', icon: IconUsers },
  { to: '/tokens', label: 'Tokens', icon: IconCoin },
  { to: '/cuentas-visibles', label: 'Cuentas token visibles', icon: IconEye },
  { to: '/consultas', label: 'Consultas', icon: IconSearch },
  { to: '/clientes-registrados', label: 'Clientes registrados', icon: IconList },
  { to: '/historial', label: 'Historial', icon: IconClock },
  { to: '/trazabilidad', label: 'Trazabilidad', icon: IconFlow },
  { to: '/credenciales', label: 'Credenciales', icon: IconKey },
]

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { role } = useSettings()

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-label="Cerrar menú"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        className={[
          'fixed z-40 flex h-full w-64 shrink-0 flex-col border-r border-line bg-surface/95 backdrop-blur-sm transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="border-b border-line px-5 py-6">
          <NavLink to="/" end className="block" onClick={onCloseMobile}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-elevated shadow-card">
                <span className="text-lg font-semibold text-accent">C</span>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-100">CampusChain</p>
                <p className="text-xs text-muted">Trazabilidad institucional</p>
              </div>
            </div>
          </NavLink>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {items
            .filter((it) => routeAllowedForRole(role, it.to))
            .map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  [
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-elevated font-medium text-slate-100 shadow-card'
                      : 'text-muted hover:bg-elevated/60 hover:text-slate-200',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <it.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-accent' : 'opacity-80'}`} />
                    <span>{it.label}</span>
                  </>
                )}
              </NavLink>
            ))}
        </nav>
        <div className="border-t border-line p-4">
          <div className="rounded-xl border border-line bg-elevated/80 p-3 shadow-card">
            <p className="text-xs font-medium text-muted">Conexión</p>
            <p className="mt-1 text-sm font-medium text-slate-200">Hyperledger Fabric</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/40 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-xs text-muted">Estado vía middleware</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25z" />
    </svg>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.433-2.554M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconList({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  )
}

function IconCoin({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M8 10h8M8 14h8M12 8v8" />
    </svg>
  )
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconFlow({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h6m9 0h-3m-3 0h-3m6 0v3m0 4.5v3m0-3h3m-6 0h3m-12 0h6m-6 0v-3m0-4.5v-3m0 3h3m6 0h0" />
    </svg>
  )
}

function IconKey({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
      />
    </svg>
  )
}
