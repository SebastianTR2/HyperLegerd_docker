import { useState } from 'react'
import type { TokenOperacion } from '../types/demo'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { newEntityId } from '../lib/demoPersist'
import { formatDemoDateTime } from '../lib/format'
import { describeApiError } from '../lib/apiErrorMessage'
import { DEFAULT_TOKEN_CODE, etiquetaTokenDemo } from '../lib/tokenDemoLabel'
import {
  emitirCuentaTokenVisibleApi,
  emitirTokenApi,
  transferirCuentaTokenVisibleApi,
  transferirTokenApi,
} from '../services/apiTokens'
import { normalizarAliasCuenta, obtenerSetAliasesVisibles } from '../services/apiCuentasVisibles'
import { ApiHttpError } from '../services/apiClient'

const input =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-accent-soft focus:ring-2 focus:ring-accent/25'

const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50'

const btnGhost =
  'inline-flex items-center justify-center rounded-xl border border-line bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-surface'


function notificarRefrescoCuentasVisibles() {
  window.dispatchEvent(new Event('cuentas-token-visibles-refresh'))
}

function primeraLineaCuenta(raw: string): string {
  return raw.split(/\r?\n/)[0]?.trim() ?? ''
}

type UltimaApiOk = { ok: boolean; mensaje: string; txId: string; txIdMint?: string }
type UltimaApiErr = { status: number; codigo?: string; mensaje: string }

export default function TokensPage() {
  const { mode, role, roleLabel, permissions } = useSettings()
  const { tokenOps, emitToken, transferToken, mergeExternalTokenOp, mergeExternalEvent, pushTrace, showToast } =
    useDemoStore()
  const [tab, setTab] = useState<'emitir' | 'transferir'>('emitir')
  const [emitForm, setEmitForm] = useState({ destinatario: '', monto: 100, codigoToken: DEFAULT_TOKEN_CODE })
  const [xferForm, setXferForm] = useState({
    origen: '',
    destino: '',
    monto: 10,
    codigoToken: DEFAULT_TOKEN_CODE,
  })
  const [legacyTab, setLegacyTab] = useState<'emitir' | 'transferir'>('emitir')
  const [legacyEmit, setLegacyEmit] = useState({
    destinatario: '',
    monto: 100,
    codigoToken: DEFAULT_TOKEN_CODE,
  })
  const [legacyXfer, setLegacyXfer] = useState({
    origen: '',
    destino: '',
    monto: 50,
    codigoToken: DEFAULT_TOKEN_CODE,
  })
  const [ultimaRespuesta, setUltimaRespuesta] = useState<TokenOperacion | null>(null)
  const [ultimaApiOk, setUltimaApiOk] = useState<UltimaApiOk | null>(null)
  const [ultimaApiErr, setUltimaApiErr] = useState<UltimaApiErr | null>(null)

  const submitEmitDemo = (e: React.FormEvent) => {
    if (!permissions.canEmitTokens) {
      e.preventDefault()
      showToast('Esta operacion requiere rol Administrador.', 'error')
      pushTrace({
        operationType: 'ERROR_PERMISOS',
        mode,
        role,
        state: 'bloqueado',
        message: 'Emision de token bloqueada por permisos.',
        codigoToken: emitForm.codigoToken,
        steps: [
          { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
          { id: 'rol', label: 'Validacion de rol', status: 'bloqueado', detail: `${roleLabel} no puede emitir tokens.` },
          { id: 'stop', label: 'Operacion bloqueada', status: 'bloqueado' },
        ],
      })
      return
    }
    e.preventDefault()
    setUltimaApiOk(null)
    setUltimaApiErr(null)
    const exp = new Date(Date.now() + 864e7 * 365).toISOString().slice(0, 10)
    const codigo = emitForm.codigoToken.trim() || DEFAULT_TOKEN_CODE
    const op = emitToken({
      cliente: emitForm.destinatario.trim() || 'Destinatario',
      cantidad: Number(emitForm.monto) || 0,
      descripcion: `Solo navegador · codigoToken ${codigo}`,
      tipoToken: codigo,
      fechaExpiracion: exp,
    })
    setUltimaRespuesta(op)
    pushTrace({
      operationType: 'TOKEN_EMITIDO',
      mode,
      role,
      state: 'exitoso',
      message: 'Token emitido (registrado solo en este navegador).',
      codigoToken: codigo,
      txId: op.referencia,
      steps: [
        { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
        { id: 'rol', label: 'Validacion de rol', status: 'exitoso', detail: `${roleLabel} autorizado.` },
        { id: 'local', label: 'Registro en navegador', status: 'exitoso', detail: 'Sin llamada al middleware.' },
      ],
    })
  }

  const submitXferDemo = (e: React.FormEvent) => {
    if (!permissions.canTransferTokens) {
      e.preventDefault()
      showToast('Esta operacion requiere rol Administrador.', 'error')
      pushTrace({
        operationType: 'ERROR_PERMISOS',
        mode,
        role,
        state: 'bloqueado',
        message: 'Transferencia de token bloqueada por permisos.',
        codigoToken: xferForm.codigoToken,
        steps: [
          { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
          { id: 'rol', label: 'Validacion de rol', status: 'bloqueado', detail: `${roleLabel} no puede transferir tokens.` },
          { id: 'stop', label: 'Operacion bloqueada', status: 'bloqueado' },
        ],
      })
      return
    }
    e.preventDefault()
    setUltimaApiOk(null)
    setUltimaApiErr(null)
    const codigo = xferForm.codigoToken.trim() || DEFAULT_TOKEN_CODE
    const op = transferToken({
      clienteOrigen: xferForm.origen.trim() || 'Origen',
      clienteDestino: xferForm.destino.trim() || 'Destino',
      cantidad: Number(xferForm.monto) || 0,
      descripcion: `Solo navegador · ${codigo}`,
    })
    setUltimaRespuesta(op)
    pushTrace({
      operationType: 'TOKEN_TRANSFERIDO',
      mode,
      role,
      state: 'exitoso',
      message: 'Transferencia registrada solo en este navegador.',
      codigoToken: codigo,
      txId: op.referencia,
      steps: [
        { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
        { id: 'rol', label: 'Validacion de rol', status: 'exitoso', detail: `${roleLabel} autorizado.` },
        { id: 'local', label: 'Registro en navegador', status: 'exitoso' },
      ],
    })
  }

  const submitEmitApi = async (e: React.FormEvent) => {
    e.preventDefault()
    setUltimaRespuesta(null)
    setUltimaApiOk(null)
    setUltimaApiErr(null)

    if (mode === 'api') {
      const dest = primeraLineaCuenta(emitForm.destinatario)
      if (!dest) {
        showToast('Indica el destinatario (alias de cuenta token visible).', 'error')
        return
      }
      try {
        const set = await obtenerSetAliasesVisibles()
        if (!set.has(normalizarAliasCuenta(dest))) {
          showToast('La cuenta token no existe', 'error')
          setUltimaApiErr({
            status: 400,
            codigo: 'CUENTA_INEXISTENTE',
            mensaje: 'La cuenta token no existe',
          })
          return
        }
      } catch (err) {
        const msg = describeApiError(err)
        showToast(msg, 'error')
        setUltimaApiErr({ status: 0, codigo: 'ERROR_LISTA_CUENTAS', mensaje: msg })
        return
      }
    }

      try {
        const res = await emitirCuentaTokenVisibleApi({
          destinatario: emitForm.destinatario.trim(),
          monto: Number(emitForm.monto) || 0,
          codigoToken: emitForm.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        })
      const op: TokenOperacion = {
        id: newEntityId('tok'),
        tipo: 'emitir',
        clienteOrigen:
          emitForm.destinatario.length > 40 ? `${emitForm.destinatario.slice(0, 40)}…` : emitForm.destinatario,
        cantidad: Number(emitForm.monto) || 0,
        descripcion: res.txIdMint ? `Mint: ${res.txIdMint}` : res.mensaje,
        tipoToken: emitForm.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        fechaIso: new Date().toISOString(),
        referencia: res.txId,
        estado: 'exito',
      }
      mergeExternalTokenOp(op)
      mergeExternalEvent({
        tipo: 'token_emitido',
        estado: 'exito',
        titulo: 'Token emitido',
        mensaje: res.mensaje,
        referencia: res.txId,
      })
      setUltimaApiOk({
        ok: res.ok,
        mensaje: res.mensaje,
        txId: res.txId,
        txIdMint: res.txIdMint,
      })
      showToast(`Éxito · txId: ${res.txId}. Los saldos se actualizan en «Cuentas token visibles».`, 'success')
      notificarRefrescoCuentasVisibles()
      pushTrace({
        operationType: 'TOKEN_EMITIDO',
        mode,
        role,
        state: 'exitoso',
        message: 'Token emitido a cuenta visible.',
        codigoToken: emitForm.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        txId: res.txId,
        txIdMint: res.txIdMint,
        steps: [
          { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
          { id: 'rol', label: 'Validacion de rol', status: 'exitoso', detail: `${roleLabel} autorizado.` },
          { id: 'api', label: 'Solicitud enviada al middleware/API', status: 'exitoso' },
          { id: 'res', label: 'Respuesta recibida', status: 'exitoso', detail: res.mensaje },
          { id: 'tx', label: 'TXID generado', status: 'exitoso', detail: 'Listo para validar en Explorer.' },
        ],
      })
    } catch (err) {
      const msg = describeApiError(err)
      setUltimaApiErr({
        status: err instanceof ApiHttpError ? err.status : 0,
        codigo: err instanceof ApiHttpError ? err.payload?.codigo : undefined,
        mensaje: err instanceof ApiHttpError ? err.payload?.mensaje ?? msg : msg,
      })
      showToast(msg, 'error')
      mergeExternalEvent({
        tipo: 'consulta',
        estado: 'error',
        titulo:
          err instanceof ApiHttpError && (err.status === 401 || err.status === 403)
            ? err.status === 401
              ? '401 No autorizado'
              : '403 Prohibido'
            : 'Error al emitir token',
        mensaje: err instanceof ApiHttpError ? err.payload?.mensaje ?? msg : msg,
      })
      pushTrace({
        operationType: 'ERROR_API',
        mode,
        role,
        state: 'error',
        message: 'Error API al emitir token.',
        codigoToken: emitForm.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        httpStatus: err instanceof ApiHttpError ? err.status : undefined,
        errorCode: err instanceof ApiHttpError ? err.payload?.codigo : undefined,
        errorMessage: err instanceof ApiHttpError ? err.payload?.mensaje ?? msg : msg,
        steps: [
          { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
          { id: 'api', label: 'Solicitud enviada al middleware/API', status: 'exitoso' },
          { id: 'err', label: 'Error recibido', status: 'error', detail: msg },
        ],
      })
    }
  }

  const submitXferApi = async (e: React.FormEvent) => {
    e.preventDefault()
    setUltimaRespuesta(null)
    setUltimaApiOk(null)
    setUltimaApiErr(null)

    if (mode === 'api') {
      const orig = primeraLineaCuenta(xferForm.origen)
      const dst = primeraLineaCuenta(xferForm.destino)
      if (!orig || !dst) {
        showToast('Indica origen y destino (alias de cuenta token visible).', 'error')
        return
      }
      try {
        const set = await obtenerSetAliasesVisibles()
        if (!set.has(normalizarAliasCuenta(orig))) {
          showToast('La cuenta token no existe', 'error')
          setUltimaApiErr({
            status: 400,
            codigo: 'CUENTA_INEXISTENTE',
            mensaje: 'La cuenta token no existe (origen)',
          })
          return
        }
        if (!set.has(normalizarAliasCuenta(dst))) {
          showToast('La cuenta token no existe', 'error')
          setUltimaApiErr({
            status: 400,
            codigo: 'CUENTA_INEXISTENTE',
            mensaje: 'La cuenta token no existe (destino)',
          })
          return
        }
      } catch (err) {
        const msg = describeApiError(err)
        showToast(msg, 'error')
        setUltimaApiErr({ status: 0, codigo: 'ERROR_LISTA_CUENTAS', mensaje: msg })
        return
      }
    }

      try {
        const res = await transferirCuentaTokenVisibleApi({
          origen: xferForm.origen.trim(),
          destino: xferForm.destino.trim(),
          monto: Number(xferForm.monto) || 0,
          codigoToken: xferForm.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        })
      const op: TokenOperacion = {
        id: newEntityId('tok'),
        tipo: 'transferir',
        clienteOrigen: xferForm.origen,
        clienteDestino: xferForm.destino.length > 36 ? `${xferForm.destino.slice(0, 36)}…` : xferForm.destino,
        cantidad: Number(xferForm.monto) || 0,
        descripcion: res.mensaje,
        tipoToken: xferForm.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        fechaIso: new Date().toISOString(),
        referencia: res.txId,
        estado: 'exito',
      }
      mergeExternalTokenOp(op)
      mergeExternalEvent({
        tipo: 'token_transferido',
        estado: 'exito',
        titulo: 'Transferencia realizada',
        mensaje: res.mensaje,
        referencia: res.txId,
      })
      setUltimaApiOk({ ok: res.ok, mensaje: res.mensaje, txId: res.txId, txIdMint: res.txIdMint })
      showToast(`Éxito · txId: ${res.txId}. Revise saldos en «Cuentas token visibles».`, 'success')
      notificarRefrescoCuentasVisibles()
      pushTrace({
        operationType: 'TOKEN_TRANSFERIDO',
        mode,
        role,
        state: 'exitoso',
        message: 'Transferencia entre cuentas visibles confirmada.',
        codigoToken: xferForm.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        txId: res.txId,
        txIdMint: res.txIdMint,
        steps: [
          { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
          { id: 'rol', label: 'Validacion de rol', status: 'exitoso', detail: `${roleLabel} autorizado.` },
          { id: 'api', label: 'Solicitud enviada al middleware/API', status: 'exitoso' },
          { id: 'res', label: 'Respuesta recibida', status: 'exitoso', detail: res.mensaje },
        ],
      })
    } catch (err) {
      const msg = describeApiError(err)
      setUltimaApiErr({
        status: err instanceof ApiHttpError ? err.status : 0,
        codigo: err instanceof ApiHttpError ? err.payload?.codigo : undefined,
        mensaje: err instanceof ApiHttpError ? err.payload?.mensaje ?? msg : msg,
      })
      showToast(msg, 'error')
      mergeExternalEvent({
        tipo: 'consulta',
        estado: 'error',
        titulo:
          err instanceof ApiHttpError && (err.status === 401 || err.status === 403)
            ? err.status === 401
              ? '401 No autorizado'
              : '403 Prohibido'
            : 'Error en transferencia de token',
        mensaje: err instanceof ApiHttpError ? err.payload?.mensaje ?? msg : msg,
      })
      pushTrace({
        operationType: 'ERROR_API',
        mode,
        role,
        state: 'error',
        message: 'Error API al transferir token.',
        codigoToken: xferForm.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        httpStatus: err instanceof ApiHttpError ? err.status : undefined,
        errorCode: err instanceof ApiHttpError ? err.payload?.codigo : undefined,
        errorMessage: err instanceof ApiHttpError ? err.payload?.mensaje ?? msg : msg,
        steps: [
          { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
          { id: 'api', label: 'Solicitud enviada al middleware/API', status: 'exitoso' },
          { id: 'err', label: 'Error recibido', status: 'error', detail: msg },
        ],
      })
    }
  }

  const submitLegacyEmitApi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode !== 'api') return
    setUltimaRespuesta(null)
    setUltimaApiOk(null)
    setUltimaApiErr(null)
    const dest = primeraLineaCuenta(legacyEmit.destinatario)
    if (!dest) {
      showToast('Indica destinatario (cuenta en el contrato ERC-20).', 'error')
      return
    }
    try {
      const res = await emitirTokenApi({
        destinatario: dest,
        monto: Number(legacyEmit.monto) || 0,
        codigoToken: legacyEmit.codigoToken.trim() || DEFAULT_TOKEN_CODE,
      })
      const op: TokenOperacion = {
        id: newEntityId('tok'),
        tipo: 'emitir',
        clienteOrigen: dest.length > 40 ? `${dest.slice(0, 40)}…` : dest,
        cantidad: Number(legacyEmit.monto) || 0,
        descripcion: res.txIdMint ? `Mint: ${res.txIdMint}` : res.mensaje,
        tipoToken: legacyEmit.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        fechaIso: new Date().toISOString(),
        referencia: res.txId,
        estado: 'exito',
      }
      mergeExternalTokenOp(op)
      mergeExternalEvent({
        tipo: 'token_emitido',
        estado: 'exito',
        titulo: 'Token emitido (contrato legacy)',
        mensaje: res.mensaje,
        referencia: res.txId,
      })
      setUltimaApiOk({
        ok: res.ok,
        mensaje: res.mensaje,
        txId: res.txId,
        txIdMint: res.txIdMint,
      })
      showToast(`Contrato ERC-20 · operación completada · txId: ${res.txId}`, 'success')
      pushTrace({
        operationType: 'TOKEN_EMITIDO',
        mode,
        role,
        state: 'exitoso',
        message: 'Emisión legacy POST /tokens/emitir.',
        codigoToken: legacyEmit.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        txId: res.txId,
        txIdMint: res.txIdMint,
        steps: [
          { id: 'cap', label: 'Captura', status: 'exitoso' },
          { id: 'api', label: 'POST /tokens/emitir', status: 'exitoso', detail: res.mensaje },
        ],
      })
    } catch (err) {
      const msg = describeApiError(err)
      setUltimaApiErr({
        status: err instanceof ApiHttpError ? err.status : 0,
        codigo: err instanceof ApiHttpError ? err.payload?.codigo : undefined,
        mensaje: err instanceof ApiHttpError ? err.payload?.mensaje ?? msg : msg,
      })
      showToast(msg, 'error')
    }
  }

  const submitLegacyXferApi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode !== 'api') return
    setUltimaRespuesta(null)
    setUltimaApiOk(null)
    setUltimaApiErr(null)
    const orig = primeraLineaCuenta(legacyXfer.origen)
    const dst = primeraLineaCuenta(legacyXfer.destino)
    if (!orig || !dst) {
      showToast('Indica origen y destino.', 'error')
      return
    }
    try {
      const res = await transferirTokenApi({
        origen: orig,
        destino: dst,
        monto: Number(legacyXfer.monto) || 0,
        codigoToken: legacyXfer.codigoToken.trim() || DEFAULT_TOKEN_CODE,
      })
      const op: TokenOperacion = {
        id: newEntityId('tok'),
        tipo: 'transferir',
        clienteOrigen: orig,
        clienteDestino: dst.length > 36 ? `${dst.slice(0, 36)}…` : dst,
        cantidad: Number(legacyXfer.monto) || 0,
        descripcion: res.mensaje,
        tipoToken: legacyXfer.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        fechaIso: new Date().toISOString(),
        referencia: res.txId,
        estado: 'exito',
      }
      mergeExternalTokenOp(op)
      mergeExternalEvent({
        tipo: 'token_transferido',
        estado: 'exito',
        titulo: 'Transferencia realizada (contrato legacy)',
        mensaje: res.mensaje,
        referencia: res.txId,
      })
      setUltimaApiOk({ ok: res.ok, mensaje: res.mensaje, txId: res.txId, txIdMint: res.txIdMint })
      showToast(`Contrato ERC-20 · operación completada · txId: ${res.txId}`, 'success')
      pushTrace({
        operationType: 'TOKEN_TRANSFERIDO',
        mode,
        role,
        state: 'exitoso',
        message: 'Transferencia legacy POST /tokens/transferir.',
        codigoToken: legacyXfer.codigoToken.trim() || DEFAULT_TOKEN_CODE,
        txId: res.txId,
        steps: [
          { id: 'cap', label: 'Captura', status: 'exitoso' },
          { id: 'api', label: 'POST /tokens/transferir', status: 'exitoso', detail: res.mensaje },
        ],
      })
    } catch (err) {
      const msg = describeApiError(err)
      setUltimaApiErr({
        status: err instanceof ApiHttpError ? err.status : 0,
        codigo: err instanceof ApiHttpError ? err.payload?.codigo : undefined,
        mensaje: err instanceof ApiHttpError ? err.payload?.mensaje ?? msg : msg,
      })
      showToast(msg, 'error')
    }
  }

  if (!permissions.canEmitTokens || !permissions.canTransferTokens) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-4">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-card">
          <h2 className="text-sm font-semibold text-amber-100">Operacion restringida</h2>
          <p className="mt-2 text-sm text-amber-200/90">Esta operacion requiere rol Administrador.</p>
          <p className="mt-2 text-xs text-muted">
            Rol actual: <span className="text-slate-300">{roleLabel}</span>. Puedes cambiarlo desde Credenciales.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
          <h3 className="text-sm font-semibold text-slate-100">Que puedes hacer con este rol</h3>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li>- Consultar clientes y revisar historial.</li>
            <li>- Revisar trazabilidad de operaciones y TXID existentes.</li>
            <li>- Alta de clientes desde el Portal de Cliente (según permisos de su clave).</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-4 lg:overflow-hidden">
      <div className="flex min-h-0 w-full shrink-0 flex-col gap-4 lg:w-[420px] lg:overflow-y-auto">
        <div className="rounded-2xl border border-line bg-elevated/90 shadow-card">
          <div className="flex border-b border-line p-1">
            <button
              type="button"
              className={`flex-1 rounded-lg py-2 text-xs font-medium sm:text-sm ${
                tab === 'emitir' ? 'bg-surface text-slate-100 shadow-sm' : 'text-muted hover:text-slate-200'
              }`}
              onClick={() => setTab('emitir')}
            >
              Emitir token
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg py-2 text-xs font-medium sm:text-sm ${
                tab === 'transferir' ? 'bg-surface text-slate-100 shadow-sm' : 'text-muted hover:text-slate-200'
              }`}
              onClick={() => setTab('transferir')}
            >
              Transferir token
            </button>
          </div>

          {tab === 'emitir' ? (
            <form
              onSubmit={mode === 'demo' ? submitEmitDemo : submitEmitApi}
              className="space-y-4 p-4 sm:p-5"
            >
              <p className="text-xs text-muted">
                {mode === 'demo' ? (
                  <>
                    Mismos campos que el backend; en modo sin API la operación queda solo en el navegador.{' '}
                    <strong className="text-slate-400">destinatario</strong> y{' '}
                    <strong className="text-slate-400">monto</strong> son libres.
                  </>
                ) : (
                  <>
                    <code className="font-mono text-slate-400">POST /tokens/cuentas/emitir</code>. El{' '}
                    <strong className="text-slate-400">destinatario</strong> debe ser el{' '}
                    <strong className="text-slate-400">alias</strong> de una cuenta listada en{' '}
                    <em className="text-slate-500">Cuentas token visibles</em> (se valida antes de enviar).{' '}
                    <strong className="text-slate-400">monto</strong> numérico. Rol admin.
                  </>
                )}
              </p>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">destinatario * (alias cuenta visible)</span>
                <textarea
                  className={`${input} min-h-[88px] font-mono text-xs`}
                  required
                  value={emitForm.destinatario}
                  onChange={(e) => setEmitForm((f) => ({ ...f, destinatario: e.target.value }))}
                  placeholder={
                    mode === 'api'
                      ? 'alex'
                      : 'Nombre o etiqueta (solo navegador); con API: alias'
                  }
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">monto * (numérico)</span>
                <input
                  className={input}
                  type="number"
                  min={mode === 'api' ? 1 : 0}
                  step="any"
                  value={emitForm.monto}
                  onChange={(e) => setEmitForm((f) => ({ ...f, monto: Number(e.target.value) }))}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">codigoToken *</span>
                <input
                  className={input}
                  value={emitForm.codigoToken}
                  onChange={(e) => setEmitForm((f) => ({ ...f, codigoToken: e.target.value }))}
                  placeholder={DEFAULT_TOKEN_CODE}
                />
              </label>
              <button type="submit" className={`${btnPrimary} w-full`}>
                {mode === 'demo' ? 'Registrar emisión (sin red)' : 'Emitir token'}
              </button>
            </form>
          ) : (
            <form
              onSubmit={mode === 'demo' ? submitXferDemo : submitXferApi}
              className="space-y-4 p-4 sm:p-5"
            >
              <p className="text-xs text-muted">
                {mode === 'demo' ? (
                  <>
                    Mismos nombres que <code className="font-mono text-slate-400">POST /tokens/cuentas/transferir</code>. Sin API la
                    operación queda en el navegador.
                  </>
                ) : (
                  <>
                    <code className="font-mono text-slate-400">POST /tokens/cuentas/transferir</code>.{' '}
                    <strong className="text-slate-400">origen</strong> y <strong className="text-slate-400">destino</strong>{' '}
                    deben ser alias presentes en <em className="text-slate-500">Cuentas token visibles</em>. Rol admin.
                  </>
                )}
              </p>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">origen * (alias cuenta visible)</span>
                <input
                  className={input}
                  required
                  value={xferForm.origen}
                  onChange={(e) => setXferForm((f) => ({ ...f, origen: e.target.value }))}
                  placeholder={mode === 'api' ? 'alex' : 'origen'}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">destino * (alias cuenta visible)</span>
                <textarea
                  className={`${input} min-h-[88px] font-mono text-xs`}
                  required
                  value={xferForm.destino}
                  onChange={(e) => setXferForm((f) => ({ ...f, destino: e.target.value }))}
                  placeholder={mode === 'api' ? 'fin' : 'Cuenta o etiqueta'}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">monto * (numérico)</span>
                <input
                  className={input}
                  type="number"
                  min={mode === 'api' ? 1 : 0}
                  step="any"
                  value={xferForm.monto}
                  onChange={(e) => setXferForm((f) => ({ ...f, monto: Number(e.target.value) }))}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">codigoToken *</span>
                <input
                  className={input}
                  value={xferForm.codigoToken}
                  onChange={(e) => setXferForm((f) => ({ ...f, codigoToken: e.target.value }))}
                  placeholder={DEFAULT_TOKEN_CODE}
                />
              </label>
              <div className="flex gap-2">
                <button type="submit" className={`${btnPrimary} flex-1`}>
                  {mode === 'demo' ? 'Registrar transferencia (sin red)' : 'Transferir'}
                </button>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() =>
                    setXferForm({ origen: '', destino: '', monto: 10, codigoToken: DEFAULT_TOKEN_CODE })
                  }
                >
                  Limpiar
                </button>
              </div>
            </form>
          )}
        </div>

        {mode === 'api' ? (
          <details className="rounded-2xl border border-line bg-elevated/90 shadow-card">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-200 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="mr-1 text-muted">▸</span>
              Tokens ERC-20 legacy
              <span className="mt-1 block font-mono text-[11px] font-normal text-slate-500">
                POST /tokens/emitir · POST /tokens/transferir
              </span>
            </summary>
            <div className="border-t border-line px-4 pb-4 pt-2">
              <p className="mb-3 text-xs text-muted">
                Invocación directa al contrato ERC-20 (identidades Fabric). El flujo principal por alias usa los
                formularios de arriba.
              </p>
              <div className="flex border-b border-line p-1">
                <button
                  type="button"
                  className={`flex-1 rounded-lg py-2 text-xs font-medium sm:text-sm ${
                    legacyTab === 'emitir' ? 'bg-surface text-slate-100 shadow-sm' : 'text-muted hover:text-slate-200'
                  }`}
                  onClick={() => setLegacyTab('emitir')}
                >
                  Emitir (legacy)
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-lg py-2 text-xs font-medium sm:text-sm ${
                    legacyTab === 'transferir' ? 'bg-surface text-slate-100 shadow-sm' : 'text-muted hover:text-slate-200'
                  }`}
                  onClick={() => setLegacyTab('transferir')}
                >
                  Transferir (legacy)
                </button>
              </div>
              {legacyTab === 'emitir' ? (
                <form onSubmit={submitLegacyEmitApi} className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">destinatario * (cuenta contrato)</span>
                    <textarea
                      className={`${input} min-h-[72px] font-mono text-xs`}
                      required
                      value={legacyEmit.destinatario}
                      onChange={(e) => setLegacyEmit((f) => ({ ...f, destinatario: e.target.value }))}
                      placeholder="ClientAccountID / base64"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">monto *</span>
                    <input
                      className={input}
                      type="number"
                      min={1}
                      step="any"
                      value={legacyEmit.monto}
                      onChange={(e) => setLegacyEmit((f) => ({ ...f, monto: Number(e.target.value) }))}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">codigoToken *</span>
                    <input
                      className={input}
                      value={legacyEmit.codigoToken}
                      onChange={(e) => setLegacyEmit((f) => ({ ...f, codigoToken: e.target.value }))}
                      placeholder={DEFAULT_TOKEN_CODE}
                    />
                  </label>
                  <button type="submit" className={`${btnPrimary} w-full`}>
                    Enviar POST /tokens/emitir
                  </button>
                </form>
              ) : (
                <form onSubmit={submitLegacyXferApi} className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">origen *</span>
                    <textarea
                      className={`${input} min-h-[56px] font-mono text-xs`}
                      required
                      value={legacyXfer.origen}
                      onChange={(e) => setLegacyXfer((f) => ({ ...f, origen: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">destino *</span>
                    <textarea
                      className={`${input} min-h-[56px] font-mono text-xs`}
                      required
                      value={legacyXfer.destino}
                      onChange={(e) => setLegacyXfer((f) => ({ ...f, destino: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">monto *</span>
                    <input
                      className={input}
                      type="number"
                      min={1}
                      step="any"
                      value={legacyXfer.monto}
                      onChange={(e) => setLegacyXfer((f) => ({ ...f, monto: Number(e.target.value) }))}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">codigoToken *</span>
                    <input
                      className={input}
                      value={legacyXfer.codigoToken}
                      onChange={(e) => setLegacyXfer((f) => ({ ...f, codigoToken: e.target.value }))}
                      placeholder={DEFAULT_TOKEN_CODE}
                    />
                  </label>
                  <button type="submit" className={`${btnPrimary} w-full`}>
                    Enviar POST /tokens/transferir
                  </button>
                </form>
              )}
            </div>
          </details>
        ) : null}

        <div className="rounded-2xl border border-line bg-elevated/90 p-4 shadow-card sm:p-5">
          <h2 className="text-sm font-semibold text-slate-100">
            {mode === 'api' ? 'Respuesta del servidor' : 'Respuesta (solo navegador)'}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {mode === 'api' ? 'ok, mensaje, txId y txIdMint si aplica.' : 'Valores alineados al formato de la API.'}
          </p>
          {mode === 'demo' && ultimaRespuesta ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-[11px] uppercase text-muted">ok</dt>
                <dd className="font-mono text-slate-300">true</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">mensaje</dt>
                <dd className="text-muted">{ultimaRespuesta.descripcion ?? 'Operación en navegador'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">txId</dt>
                <dd className="break-all font-mono text-xs text-slate-400">{ultimaRespuesta.referencia}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">Operación</dt>
                <dd className="text-slate-200">{ultimaRespuesta.tipo === 'emitir' ? 'Emisión' : 'Transferencia'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">Hora</dt>
                <dd className="text-muted">{formatDemoDateTime(ultimaRespuesta.fechaIso)}</dd>
              </div>
            </dl>
          ) : null}
          {mode === 'api' && ultimaApiOk ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-[11px] uppercase text-muted">ok</dt>
                <dd className="font-mono text-slate-300">{String(ultimaApiOk.ok)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">mensaje</dt>
                <dd className="text-muted">{ultimaApiOk.mensaje}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-muted">txId</dt>
                <dd className="break-all font-mono text-xs text-slate-300">{ultimaApiOk.txId}</dd>
              </div>
              {ultimaApiOk.txIdMint ? (
                <div>
                  <dt className="text-[11px] uppercase text-muted">txIdMint</dt>
                  <dd className="break-all font-mono text-xs text-slate-400">{ultimaApiOk.txIdMint}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {mode === 'api' && ultimaApiErr ? (
            <dl className="mt-4 space-y-2 text-sm text-danger/90">
              <div>
                <dt className="text-[11px] uppercase text-slate-500">HTTP</dt>
                <dd className="font-mono">{ultimaApiErr.status || '—'}</dd>
              </div>
              {ultimaApiErr.codigo ? (
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">codigo</dt>
                  <dd className="font-mono">{ultimaApiErr.codigo}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[11px] uppercase text-slate-500">mensaje</dt>
                <dd>{ultimaApiErr.mensaje}</dd>
              </div>
            </dl>
          ) : null}
          {!ultimaRespuesta && !ultimaApiOk && !ultimaApiErr ? (
            <p className="mt-4 text-xs text-muted">Ejecuta una operación para ver la respuesta aquí.</p>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-elevated/90 shadow-card">
        <div className="shrink-0 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-100">Operaciones recientes</h2>
          <p className="text-xs text-muted">{tokenOps.length} movimientos en el historial de la aplicación</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
          {tokenOps.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted">Sin operaciones todavía.</p>
          ) : null}
          {tokenOps.map((op) => (
            <article key={op.id} className="rounded-xl border border-line bg-surface/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-slate-200">
                  {op.tipo === 'emitir' ? 'Emisión' : 'Transferencia'}
                </span>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
                  {op.estado === 'exito' ? 'ÉXITO' : 'ERROR'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {op.cantidad} {etiquetaTokenDemo(op.tipoToken)} · {op.clienteOrigen}
                {op.clienteDestino ? ` → ${op.clienteDestino}` : ''}
              </p>
              {op.descripcion ? <p className="mt-1 text-xs text-slate-500">{op.descripcion}</p> : null}
              <p className="mt-2 font-mono text-[11px] text-slate-500" title={op.referencia}>
                {op.referencia.length > 22
                  ? `${op.referencia.slice(0, 14)}…${op.referencia.slice(-8)}`
                  : op.referencia}
              </p>
              <p className="mt-1 text-[11px] text-muted">{formatDemoDateTime(op.fechaIso)}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
