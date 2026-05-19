import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui'

export function WriteRoute() {
  const { puedeEscribir } = useAuth()

  if (!puedeEscribir) {
    return (
      <div className="mx-auto max-w-lg">
        <Card title="Acceso restringido">
          <p className="text-sm text-[#374151]">
            Su perfil solo permite consultar información. No puede crear, editar ni dar de baja clientes.
          </p>
          <p className="mt-4">
            <Link to="/clientes" className="text-sm font-medium text-[#D97706] hover:underline">
              Volver al listado de clientes
            </Link>
          </p>
        </Card>
      </div>
    )
  }

  return <Outlet />
}
