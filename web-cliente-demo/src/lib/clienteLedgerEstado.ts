import type { ClienteApi } from '../types/api'

/** Debe coincidir con el prefijo que escribe api-middleware en notas al dar de baja vía UpdateAsset. */
const MARCA_BAJA_LOGICA = '[baja-logica-api]'

export type ClienteLedgerEstadoResumen = 'activo' | 'baja' | 'inactivo'

export function clienteLedgerEstadoResumen(c: ClienteApi): ClienteLedgerEstadoResumen {
  const raw = (c.estado ?? '').toUpperCase().replace(/\s+/g, '_')
  const notas = c.notasLedger ?? c.notas ?? ''
  if (raw === 'DADO_DE_BAJA') return 'baja'
  if (raw === 'INACTIVO' && notas.includes(MARCA_BAJA_LOGICA)) return 'baja'
  if (raw === 'ACTIVO') return 'activo'
  return 'inactivo'
}
