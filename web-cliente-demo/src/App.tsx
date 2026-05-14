import { Route, Routes } from 'react-router-dom'
import { RoleRouteGate } from './components/RoleRouteGate'
import { DashboardLayout } from './layouts/DashboardLayout'
import ClienteHistorialPage from './pages/ClienteHistorialPage'
import ClientesRegistradosPage from './pages/ClientesRegistradosPage'
import CredencialesPage from './pages/CredencialesPage'
import ConsultasPage from './pages/ConsultasPage'
import CuentasTokenVisiblesPage from './pages/CuentasTokenVisiblesPage'
import HistorialPage from './pages/HistorialPage'
import AuditarPage from './pages/AuditarPage'
import PanelPage from './pages/PanelPage'
import RegistrosPage from './pages/RegistrosPage'
import TokensPage from './pages/TokensPage'
import TrazabilidadPage from './pages/TrazabilidadPage'

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<PanelPage />} />
        <Route
          path="registros"
          element={
            <RoleRouteGate path="/registros">
              <RegistrosPage />
            </RoleRouteGate>
          }
        />
        <Route
          path="tokens"
          element={
            <RoleRouteGate path="/tokens">
              <TokensPage />
            </RoleRouteGate>
          }
        />
        <Route path="consultas" element={<ConsultasPage />} />
        <Route path="cuentas-visibles" element={<CuentasTokenVisiblesPage />} />
        <Route path="clientes-registrados" element={<ClientesRegistradosPage />} />
        <Route path="historial-cliente/:clienteId" element={<ClienteHistorialPage />} />
        <Route path="historial" element={<HistorialPage />} />
        <Route path="auditoria" element={<AuditarPage />} />
        <Route path="trazabilidad" element={<TrazabilidadPage />} />
        <Route path="credenciales" element={<CredencialesPage />} />
      </Route>
    </Routes>
  )
}
