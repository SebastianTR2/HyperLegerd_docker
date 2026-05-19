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
    <div className="flex min-h-screen items-center justify-center bg-[#F8F6F2] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#E8E1D8] bg-white p-8 shadow-[0_8px_30px_rgba(31,41,55,0.08)]">
        <div className="mb-6 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">CampusChain</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1F2937]">Gestión de Clientes</h1>
          <p className="mt-2 text-sm text-[#6B7280]">Inicie sesión para continuar</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#374151]">Usuario</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="portal-field w-full rounded-xl border border-[#E8E1D8] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20"
              placeholder="Ingrese su usuario"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#374151]">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="portal-field w-full rounded-xl border border-[#E8E1D8] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20"
            />
          </label>
          {error ? <p className="text-sm text-red-800">{error}</p> : null}
          <Button type="submit" className="w-full" loading={submitting}>
            Ingresar
          </Button>
        </form>

      </div>
    </div>
  )
}
