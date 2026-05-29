import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui'
import { ApiHttpError } from '../services/apiClient'

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && isAuthenticated) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      if (err instanceof ApiHttpError) {
        setError(err.message)
      } else {
        setError('No se pudo iniciar sesión. Compruebe que web-portal-api esté en ejecución.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md rounded-md border border-line bg-surface p-8 shadow-card-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-sidebar text-lg font-bold text-white">
            C
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">CampusChain</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">Gestión de Clientes</h1>
          <p className="mt-2 text-sm text-muted">Inicie sesión para continuar</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-secondary">Usuario</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="portal-field admin-input"
              placeholder="Ingrese su usuario"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-secondary">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="portal-field admin-input"
            />
          </label>
          {error ? (
            <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-ink">{error}</p>
          ) : null}
          <Button type="submit" className="w-full" loading={submitting}>
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  )
}
