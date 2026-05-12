import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { routeAllowedForRole, workspaceLabel, type AppRoutePath } from '../lib/roles'

export function RoleRouteGate({
  path,
  children,
}: {
  path: AppRoutePath
  children: ReactElement
}) {
  const { role } = useSettings()
  const { showToast } = useDemoStore()
  const allowed = routeAllowedForRole(role, path)

  useEffect(() => {
    if (allowed) return
    if (role === 'integrador' && path === '/tokens') {
      showToast('Esta sección pertenece al panel administrativo.', 'info')
      return
    }
    if (role === 'solo_lectura') {
      showToast('Tu espacio de trabajo es de consulta.', 'info')
      return
    }
    showToast(`Sección no disponible para ${workspaceLabel(role)}.`, 'info')
  }, [allowed, path, role, showToast])

  if (!allowed) return <Navigate to="/" replace />
  return children
}
