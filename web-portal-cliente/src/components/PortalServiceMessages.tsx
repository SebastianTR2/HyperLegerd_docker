/** Aviso cuando no hay clave en entorno ni en almacenamiento de respaldo (desarrollo). */
export function ServicioNoConfigurado() {
  return (
    <div
      role="status"
      className="rounded-2xl border border-[#E8E1D8] bg-white/80 px-5 py-4 shadow-sm sm:px-6"
    >
      <h2 className="text-sm font-semibold text-[#1F2937]">Servicio no configurado</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
        No se pudo conectar con el servicio de gestión. Contacta al administrador del sistema.
      </p>
      <p className="mt-3 text-xs leading-relaxed text-[#6B7280]">
        El portal no está configurado para conectarse al servicio.
      </p>
    </div>
  )
}

export function AccesoServicioBloqueado() {
  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm sm:px-6"
    >
      <h2 className="text-sm font-semibold text-amber-900">No se pudo acceder al servicio</h2>
      <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
        Comprueba la conexión o solicita ayuda al administrador del sistema.
      </p>
    </div>
  )
}
