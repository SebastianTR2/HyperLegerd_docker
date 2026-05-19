/** Etiqueta visible del rol en la UI del portal. */
export function rolEtiqueta(rol: string): string {
  switch (rol) {
    case 'admin':
      return 'Admin'
    case 'integrador':
      return 'Trabajador'
    case 'lectura':
      return 'Lectura'
    default:
      return rol || 'Usuario'
  }
}

export function esSoloLecturaRol(rol: string): boolean {
  return rol === 'lectura'
}

export function puedeEscribirRol(rol: string): boolean {
  return rol === 'admin' || rol === 'integrador'
}
