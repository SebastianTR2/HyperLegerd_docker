export type EstadoRegistro = 'activo' | 'inactivo' | 'pendiente'

export interface Registro {
  id: string
  tipoDocumento: string
  documento: string
  nombreCompleto: string
  email: string
  facultad: string
  estado: EstadoRegistro
  fechaRegistro: string
  telefono?: string
  /** Simulación de identificador en cadena; la API real podría mapear txId */
  referenciaTrazabilidad?: string
}

export interface RegistroInput {
  /** Si se indica, se usa como `id` del registro demo (p. ej. CLI001). */
  clienteId?: string
  tipoDocumento: string
  documento: string
  nombreCompleto: string
  email: string
  /** Contenido de notas / facultad en la demo local. */
  facultad: string
  estado: EstadoRegistro
  telefono?: string
  /** Fecha de alta YYYY-MM-DD para `fechaRegistro` al crear. */
  fechaAlta?: string
}
