import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SessionLogProvider } from './context/SessionLogContext'
import { AppLayout } from './layouts/AppLayout'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { WriteRoute } from './routes/WriteRoute'
import LoginPage from './pages/LoginPage'
import InicioPage from './pages/InicioPage'
import ClientesPage from './pages/ClientesPage'
import NuevoClientePage from './pages/NuevoClientePage'
import ClienteDetallePage from './pages/ClienteDetallePage'
import EditarClientePage from './pages/EditarClientePage'
import HistorialPage from './pages/HistorialPage'

export default function App() {
  return (
    <div
      className="portal-app min-h-dvh min-h-screen bg-[#F8F6F2] font-sans text-[#1F2937] antialiased"
      style={{
        backgroundColor: '#f8f6f2',
        color: '#1f2937',
        minHeight: '100dvh',
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <SessionLogProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route index element={<InicioPage />} />
                  <Route path="clientes" element={<ClientesPage />} />
                  <Route element={<WriteRoute />}>
                    <Route path="clientes/nuevo" element={<NuevoClientePage />} />
                    <Route path="clientes/:clienteId/editar" element={<EditarClientePage />} />
                  </Route>
                  <Route path="clientes/:clienteId" element={<ClienteDetallePage />} />
                  <Route path="historial" element={<HistorialPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SessionLogProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  )
}
