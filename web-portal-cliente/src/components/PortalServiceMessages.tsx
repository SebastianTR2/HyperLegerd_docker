/** Aviso cuando no hay clave en entorno ni en almacenamiento de respaldo (desarrollo). */
export function ServicioNoConfigurado() {
  return (
    <div role="status" className="admin-card px-5 py-4 sm:px-6">
      <h2 className="text-sm font-semibold text-ink">Servicio no configurado</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        No se pudo conectar con el servicio de gestión. Contacta al administrador del sistema.
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        El portal no está configurado para conectarse al servicio.
      </p>
    </div>
  )
}

export function AccesoServicioBloqueado() {
  return (
    <div role="status" className="admin-alert-warning px-5 py-4 sm:px-6">
      <h2 className="text-sm font-semibold">No se pudo acceder al servicio</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Comprueba la conexión o solicita ayuda al administrador del sistema.
      </p>
    </div>
  )
}
