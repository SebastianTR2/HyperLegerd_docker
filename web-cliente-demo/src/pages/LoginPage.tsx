import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface LocationState {
  from?: string
}

export default function LoginPage() {
  const { login, estado } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (estado === 'autenticado') {
      const to = (location.state as LocationState | null)?.from ?? '/'
      navigate(to, { replace: true })
    }
  }, [estado, navigate, location.state])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario.trim() || !contrasena) {
      setError('Usuario y contraseña son obligatorios.')
      return
    }
    setError(null)
    setEnviando(true)
    try {
      await login(usuario.trim(), contrasena)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar sesión'
      setError(msg)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-sidebar text-lg font-bold text-white">
            C
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">CampusChain</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Consola del puente</h1>
          <p className="mt-2 text-sm text-muted">
            Iniciar sesión para acceder al panel de auditoría de tu organización.
          </p>
        </div>
        <form onSubmit={submit} className="admin-card p-6 shadow-card-md">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Usuario</span>
            <input
              type="text"
              autoComplete="username"
              className="admin-input mt-1"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              disabled={enviando}
              autoFocus
            />
          </label>
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              className="admin-input mt-1"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              disabled={enviando}
            />
          </label>
          {error && (
            <p className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger-ink">
              {error}
            </p>
          )}
          <button type="submit" disabled={enviando} className="admin-btn-primary mt-5 w-full py-2.5">
            {enviando ? 'Validando…' : 'Iniciar sesión'}
          </button>
          <p className="mt-4 text-center text-[11px] text-muted">
            Las cuentas las crea el operador del BaaS en{' '}
            <code className="rounded bg-gray-100 px-1 font-mono text-ink-secondary">config/usuarios-admin.yaml</code>.
          </p>
        </form>
      </div>
    </div>
  )
}
