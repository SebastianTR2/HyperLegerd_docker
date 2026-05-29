import { type ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * RequiereSesion envuelve las rutas privadas. Mientras se valida el JWT
 * (al recargar la página con token persistido) muestra un placeholder;
 * si no hay sesión redirige a /login conservando el destino original
 * para volver tras autenticar.
 */
export function RequiereSesion({ children }: { children: ReactElement }) {
  const { estado } = useAuth()
  const location = useLocation()

  if (estado === 'verificando') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas">
        <div className="admin-card flex items-center gap-3 px-5 py-3 text-sm text-muted">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
          <span>Validando sesión…</span>
        </div>
      </div>
    )
  }

  if (estado === 'sin-sesion') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}
