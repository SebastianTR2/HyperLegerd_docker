import { apiJson } from './apiClient'
import type { EmitirTokenApi, RespuestaExitoTx, TransferirTokenApi } from '../types/api'

export async function emitirTokenApi(body: EmitirTokenApi): Promise<RespuestaExitoTx> {
  return apiJson<RespuestaExitoTx>('/tokens/emitir', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function transferirTokenApi(body: TransferirTokenApi): Promise<RespuestaExitoTx> {
  return apiJson<RespuestaExitoTx>('/tokens/transferir', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Emisión a cuenta token visible (alias) — actualiza saldos en VTBAL del ledger. */
export async function emitirCuentaTokenVisibleApi(body: EmitirTokenApi): Promise<RespuestaExitoTx> {
  return apiJson<RespuestaExitoTx>('/tokens/cuentas/emitir', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Transferencia entre cuentas token visibles por alias. */
export async function transferirCuentaTokenVisibleApi(body: TransferirTokenApi): Promise<RespuestaExitoTx> {
  return apiJson<RespuestaExitoTx>('/tokens/cuentas/transferir', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
