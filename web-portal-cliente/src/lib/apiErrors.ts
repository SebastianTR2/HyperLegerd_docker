import { ApiHttpError } from '../services/apiClient'

function textoContieneDuplicadoCliente(s: string): boolean {
  const t = s.toLowerCase()
  return (
    t.includes('cliente_existente') ||
    t.includes('already exists') ||
    t.includes('ya existe') ||
    (t.includes('asset') && t.includes('exist'))
  )
}

/** Registra detalle técnico solo en consola (no en UI de usuario). */
export function logTechnicalApiFailure(context: string, err: unknown): void {
  if (err instanceof ApiHttpError) {
    console.warn(`[${context}]`, err.status, err.payload?.codigo ?? '', err.payload?.mensaje ?? err.message)
    return
  }
  console.warn(`[${context}]`, err)
}

export function esErrorAccesoServicio(err: unknown): boolean {
  return err instanceof ApiHttpError && (err.status === 401 || err.status === 403)
}

export const MENSAJE_ACCESO_SERVICIO = 'No se pudo acceder al servicio.'

export function mensajeUsuarioAccesoServicio(): string {
  return MENSAJE_ACCESO_SERVICIO
}

/** Mensaje tras fallo al registrar cliente. */
export function mensajeErrorAltaCliente(err: unknown): string {
  if (err instanceof ApiHttpError) {
    if (err.status === 401 || err.status === 403) {
      return mensajeUsuarioAccesoServicio()
    }
    if (err.status === 409) {
      const m = (err.payload?.mensaje ?? err.message ?? '').toString()
      if (
        err.payload?.codigo === 'CLIENTE_EXISTENTE' ||
        textoContieneDuplicadoCliente(m) ||
        m.toLowerCase().includes('ya está en uso') ||
        m.toLowerCase().includes('cliente_existente')
      ) {
        return 'El código de cliente ya está en uso. Ingresa un código diferente.'
      }
    }
    const msg = (err.payload?.mensaje ?? err.message ?? '').toString()
    if (err.payload?.codigo === 'CLIENTE_EXISTENTE' || textoContieneDuplicadoCliente(msg)) {
      return 'El código de cliente ya está en uso. Ingresa un código diferente.'
    }
    if (err.status === 400 && err.payload?.codigo === 'VALIDACION') {
      return 'Verifique los datos e intente nuevamente.'
    }
  }
  return 'No se pudo guardar el cliente.'
}

/** Mensaje tras fallo al listar o cargar clientes. */
export function mensajeErrorCargaGenerica(err: unknown): string {
  if (err instanceof ApiHttpError) {
    if (err.status === 401 || err.status === 403) {
      return mensajeUsuarioAccesoServicio()
    }
  }
  return 'No se pudo cargar la información. Intente más tarde.'
}

export function mensajeClienteNoEncontrado(): string {
  return 'Cliente no encontrado.'
}
