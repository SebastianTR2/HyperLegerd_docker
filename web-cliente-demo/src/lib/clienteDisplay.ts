import type { ClienteApi } from '../types/api'
import { displayLedgerField } from './ledgerFieldDecode'

const HIDDEN_KEYS = new Set(['notasLedger', 'informacionAuditoria', '_ultimoTxId'])

/** Filas para tablas de detalle/historial (sin metadatos internos). */
export function clienteFilasLegibles(c: ClienteApi | null | undefined): Array<{ key: string; value: string }> {
  if (!c) return []
  const base: Array<{ key: string; value: string }> = [
    { key: 'clienteId', value: c.clienteId },
    { key: 'nombre', value: c.nombre },
    { key: 'tipoDocumento', value: c.tipoDocumento },
    { key: 'numeroDocumento', value: c.numeroDocumento },
    { key: 'fechaAlta', value: c.fechaAlta },
    { key: 'estado', value: c.estado },
    { key: 'telefono', value: c.telefono ?? '' },
    { key: 'email', value: c.email ?? '' },
    { key: 'notas', value: c.notas ?? '' },
  ]
  if (c.informacionAuditoria?.trim()) {
    base.push({
      key: 'informacionAuditoria',
      value: c.informacionAuditoria,
    })
  }
  return base.filter((r) => !HIDDEN_KEYS.has(r.key))
}

export function displayClienteField(key: string, value: unknown): string {
  if (key === 'informacionAuditoria') return String(value ?? '')
  if (key === 'notas') return String(value ?? '') || '(vacío)'
  return displayLedgerField(key, value) || '(vacío)'
}
