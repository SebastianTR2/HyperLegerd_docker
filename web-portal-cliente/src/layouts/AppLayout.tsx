import * as React from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { rolEtiqueta } from '../lib/roles'

const nav: { to: string; label: string; end: boolean; icon: React.ReactNode }[] = [
  { to: '/', label: 'Inicio', end: true, icon: <IconHome /> },
  { to: '/clientes', label: 'Clientes', end: false, icon: <IconUsers /> },
  { to: '/clientes/nuevo', label: 'Nuevo cliente', end: true, icon: <IconPlus /> },
  { to: '/historial', label: 'Historial', end: true, icon: <IconClock /> },
]

function titleForPath(path: string): { title: string; subtitle?: string } {
  if (path === '/' || path === '') {
    return {
      title: 'Inicio',
      subtitle: 'Resumen y accesos rápidos a tu gestión de clientes.',
    }
  }
  if (path.startsWith('/clientes/nuevo')) {
    return { title: 'Nuevo cliente', subtitle: 'Complete los datos y guarde el registro.' }
  }
  if (/\/clientes\/[^/]+\/editar$/.test(path)) {
    return { title: 'Editar cliente', subtitle: 'Modifique los datos permitidos.' }
  }
  if (path === '/clientes') {
    return { title: 'Clientes', subtitle: 'Listado de clientes registrados en el sistema.' }
  }
  if (/\/clientes\/[^/]+$/.test(path)) {
    return { title: 'Detalle del cliente', subtitle: 'Información del registro seleccionado.' }
  }
  if (path === '/historial') {
    return { title: 'Historial', subtitle: 'Actividad reciente en esta sesión.' }
  }
  return { title: 'Gestión de Clientes' }
}

export function AppLayout() {
  const loc = useLocation()
  const { title, subtitle } = titleForPath(loc.pathname)
  const { user, logout, readOnly } = useAuth()
  const navigate = useNavigate()

  const navVisible = nav.filter((item) => !(readOnly && item.to === '/clientes/nuevo'))

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-[#F8F6F2]">
      <aside className="portal-sidebar hidden w-64 shrink-0 flex-col border-r border-[#E8E1D8] bg-white shadow-[4px_0_24px_rgba(31,41,55,0.04)] lg:flex">
        <div className="border-b border-[#E8E1D8]/80 px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1E6] text-[#D97706]">
              <IconChain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">CampusChain</p>
              <h1 className="text-base font-bold leading-tight tracking-tight text-[#1F2937]">Gestión de Clientes</h1>
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navVisible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium leading-snug transition-all duration-150',
                  isActive
                    ? 'bg-[#FFF1E6] text-[#D97706] shadow-sm ring-1 ring-[#D97706]/15'
                    : 'text-[#374151] hover:bg-[#F5F2EC] hover:text-[#1F2937]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={['shrink-0 opacity-90', isActive ? 'text-[#D97706]' : ''].join(' ')}>{item.icon}</span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-[#E8E1D8]/60 p-4">
          <div className="rounded-xl border border-[#E8E1D8] bg-[#F5F2EC]/60 px-3 py-3">
            <p className="text-xs font-medium text-[#1F2937]">¿Necesitas ayuda?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">Consulta al equipo de tu organización.</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="portal-topnav flex gap-1 overflow-x-auto border-b border-[#E8E1D8] bg-white px-2 py-2 shadow-sm lg:hidden">
          {navVisible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold',
                  isActive ? 'bg-[#FFF1E6] text-[#D97706]' : 'text-[#374151] hover:bg-[#F5F2EC]',
                ].join(' ')
              }
            >
              <span className="scale-90">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
        <header className="shrink-0 border-b border-[#E8E1D8] bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#1F2937]">{title}</h2>
              {subtitle ? <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">{subtitle}</p> : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {user ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E8E1D8] bg-[#F5F2EC]/50 px-3 py-2 text-sm">
                  <span className="font-medium text-[#1F2937]">
                    {user.nombreCompleto} · {rolEtiqueta(user.rol)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onLogout()}
                    className="rounded-lg border border-[#E8E1D8] bg-white px-2.5 py-1 text-xs font-semibold text-[#374151] hover:bg-[#FFF1E6] hover:text-[#D97706]"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : null}
              <HeaderSearch />
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-[#F8F6F2] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
        <footer className="shrink-0 border-t border-[#E8E1D8]/70 bg-white px-4 py-3 text-center text-xs text-[#6B7280]">
          Gracias por confiar en CampusChain · Seguimos mejorando tu experiencia
        </footer>
      </div>
    </div>
  )
}

function HeaderSearch() {
  const [q, setQ] = React.useState('')
  const navigate = useNavigate()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = q.trim()
    if (!t) return
    navigate(`/clientes?buscar=${encodeURIComponent(t)}`)
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-lg flex-col gap-2 rounded-2xl border border-[#E8E1D8] bg-[#F5F2EC]/50 p-1.5 shadow-inner sm:flex-row sm:items-stretch lg:max-w-md"
    >
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">
          <IconSearch className="h-4 w-4" />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por código, nombre o documento…"
          className="portal-field h-10 w-full rounded-xl border-0 bg-transparent pl-10 pr-3 text-sm text-[#1F2937] outline-none placeholder:text-[#6B7280]/80"
        />
      </div>
      <button
        type="submit"
        className="h-10 shrink-0 rounded-xl bg-[#D97706] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#C96E0A] hover:shadow active:scale-[0.98] sm:h-auto sm:self-stretch"
      >
        Buscar
      </button>
    </form>
  )
}

function IconChain({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 000-7.07h0M14 11a5 5 0 00-7.07 0L5.52 12.4a5 5 0 000 7.07h0" strokeLinecap="round" />
    </svg>
  )
}

function IconHome() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" strokeLinejoin="round" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  )
}

function IconSearch({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  )
}
