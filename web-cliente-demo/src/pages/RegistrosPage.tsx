import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RegistroDetailPanel } from '../components/RegistroDetailPanel'
import { RegistroForm } from '../components/RegistroForm'
import { RegistrosTable } from '../components/RegistrosTable'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { clienteFormToRegistroInput, sanitizeClienteApiBody } from '../lib/clienteFormMappers'
import { clienteApiToRegistro } from '../lib/apiClienteAdapter'
import { describeApiError } from '../lib/apiErrorMessage'
import { registrarClienteApi } from '../services/apiClientes'
import { crearCuentaTokenApi } from '../services/apiCuentasVisibles'
import { ApiHttpError } from '../services/apiClient'
import type { ClienteApi, ClienteApiCacheRow, RespuestaExitoTx } from '../types/api'

type UltimaApiOk = RespuestaExitoTx
type UltimaApiErr = { status: number; codigo?: string; mensaje: string }

export default function RegistrosPage() {
  const location = useLocation()
  const { mode, role, roleLabel, permissions } = useSettings()
  const {
    registros,
    apiClienteRows,
    clientesLedger,
    refreshClientesLedger,
    upsertApiClienteRow,
    createRegistro,
    updateRegistro,
    deleteRegistro,
    mergeExternalEvent,
    pushTrace,
    showToast,
  } = useDemoStore()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ultimaOk, setUltimaOk] = useState<UltimaApiOk | null>(null)
  const [ultimaErr, setUltimaErr] = useState<UltimaApiErr | null>(null)
  const [crearCuentaTokenTambien, setCrearCuentaTokenTambien] = useState(false)

  const apiRows = useMemo(() => apiClienteRows.map((c) => clienteApiToRegistro(c)), [apiClienteRows])

  const selected =
    mode === 'api'
      ? (apiRows.find((r) => r.id === selectedId) ?? null)
      : (registros.find((r) => r.id === selectedId) ?? null)
  const editingRegistro = editingId
    ? (mode === 'api' ? apiRows : registros).find((r) => r.id === editingId) ?? null
    : null
  const modo = editingId ? 'editar' : 'crear'

  useEffect(() => {
    const id = (location.state as { focusId?: string } | null)?.focusId
    if (!id) return
    if (mode === 'demo' && registros.some((r) => r.id === id)) {
      setSelectedId(id)
      setEditingId(null)
    }
    if (
      mode === 'api' &&
      (apiClienteRows.some((c) => c.clienteId === id) || clientesLedger.some((c) => c.clienteId === id))
    ) {
      setSelectedId(id)
    }
  }, [location.state, mode, registros, apiClienteRows, clientesLedger])

  const handleSubmit = useCallback(
    async (body: ClienteApi) => {
      if (!permissions.canRegisterClients) {
        showToast('Tu rol solo permite consultar informacion.', 'error')
        pushTrace({
          operationType: 'ERROR_PERMISOS',
          mode,
          role,
          state: 'bloqueado',
          message: 'Registro de cliente bloqueado por permisos del rol.',
          clienteId: body.clienteId?.trim() || undefined,
          steps: [
            { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
            { id: 'rol', label: 'Validacion de rol', status: 'bloqueado', detail: `${roleLabel} no puede registrar clientes.` },
            { id: 'stop', label: 'Operacion bloqueada', status: 'bloqueado', detail: 'No se envio la solicitud al backend.' },
          ],
        })
        return
      }
      if (mode === 'demo') {
        if (!body.clienteId.trim()) {
          showToast('Indica un clienteId (ej. CLI001).', 'error')
          return
        }
        const input = clienteFormToRegistroInput(body)
        if (!input.documento.trim() || !input.nombreCompleto.trim()) {
          showToast('Completa número de documento y nombre.', 'error')
          return
        }
        setBusy(true)
        setUltimaErr(null)
        setUltimaOk(null)
        try {
          await new Promise((r) => setTimeout(r, 100))
          if (editingId) {
            const u = updateRegistro(editingId, input)
            setSelectedId(u.id)
            pushTrace({
              operationType: 'CLIENTE_REGISTRADO',
              mode,
              role,
              state: 'exitoso',
              message: `Cliente actualizado (solo navegador): ${u.id}`,
              clienteId: u.id,
              steps: [
                { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
                { id: 'rol', label: 'Validacion de rol', status: 'exitoso', detail: `${roleLabel} autorizado.` },
                { id: 'local', label: 'Persistencia en navegador', status: 'exitoso' },
              ],
            })
          } else {
            if (registros.some((r) => r.id === input.clienteId?.trim())) {
              showToast('Ya existe un registro con ese clienteId.', 'error')
              return
            }
            const c = createRegistro(input)
            setSelectedId(c.id)
            setEditingId(null)
            pushTrace({
              operationType: 'CLIENTE_REGISTRADO',
              mode,
              role,
              state: 'exitoso',
              message: `Cliente registrado (solo navegador): ${c.id}`,
              clienteId: c.id,
              steps: [
                { id: 'cap', label: 'Captura de datos', status: 'exitoso' },
                { id: 'rol', label: 'Validacion de rol', status: 'exitoso', detail: `${roleLabel} autorizado.` },
                {
                  id: 'local',
                  label: 'Guardado en navegador',
                  status: 'exitoso',
                  detail: 'No se envió a la API; use modo API para ledger.',
                },
              ],
            })
          }
        } finally {
          setBusy(false)
        }
        return
      }

      if (!body.clienteId.trim()) {
        showToast('Indica un clienteId.', 'error')
        return
      }
      setBusy(true)
      setUltimaErr(null)
      setUltimaOk(null)
      const payload = sanitizeClienteApiBody(body)
      try {
        const res = await registrarClienteApi(payload)
        setUltimaOk(res)
        const row: ClienteApiCacheRow = { ...payload, _ultimoTxId: res.txId }
        upsertApiClienteRow(row)
        setSelectedId(payload.clienteId)
        mergeExternalEvent({
          tipo: 'registro_creado',
          estado: 'exito',
          titulo: 'Cliente registrado correctamente',
          mensaje: `${res.mensaje} · ${payload.clienteId}`,
          referencia: res.txId,
        })
        showToast(`Cliente registrado · TXID: ${res.txId}`, 'success')
        pushTrace({
          operationType: 'CLIENTE_REGISTRADO',
          mode,
          role,
          state: 'exitoso',
          message: `Cliente registrado en API: ${payload.clienteId}`,
          clienteId: payload.clienteId,
          txId: res.txId,
          txIdMint: res.txIdMint,
          steps: [
            { id: 'cap', label: 'Datos capturados en interfaz', status: 'exitoso' },
            { id: 'rol', label: 'Validacion de rol', status: 'exitoso', detail: `${roleLabel} habilitado para registrar.` },
            { id: 'api', label: 'Solicitud enviada al middleware/API', status: 'exitoso' },
            { id: 'res', label: 'Respuesta del backend', status: 'exitoso', detail: res.mensaje },
            { id: 'tx', label: 'TXID generado', status: 'exitoso', detail: 'Listo para validar en Explorer.' },
          ],
        })
        if (crearCuentaTokenTambien && permissions.canCreateVisibleTokenAccount) {
          try {
            await crearCuentaTokenApi(payload.clienteId.trim())
            mergeExternalEvent({
              tipo: 'registro_creado',
              estado: 'exito',
              titulo: 'Cuenta token creada',
              mensaje: `Cuenta visible para ${payload.clienteId}`,
            })
            showToast(`Cuenta token visible «${payload.clienteId}» creada.`, 'success')
          } catch (eCt) {
            showToast(`Cliente registrado; no se pudo crear la cuenta token: ${describeApiError(eCt)}`, 'info')
          }
        }
        setCrearCuentaTokenTambien(false)
        await refreshClientesLedger()
      } catch (e) {
        const msg = describeApiError(e)
        setUltimaErr({
          status: e instanceof ApiHttpError ? e.status : 0,
          codigo: e instanceof ApiHttpError ? e.payload?.codigo : undefined,
          mensaje: e instanceof ApiHttpError ? e.payload?.mensaje ?? msg : msg,
        })
        showToast(msg, 'error')
        mergeExternalEvent({
          tipo: 'consulta',
          estado: 'error',
          titulo:
            e instanceof ApiHttpError && (e.status === 401 || e.status === 403)
              ? e.status === 401
                ? '401 No autorizado'
                : '403 Prohibido'
              : 'Error al registrar cliente',
          mensaje: e instanceof ApiHttpError ? e.payload?.mensaje ?? msg : msg,
        })
        pushTrace({
          operationType: e instanceof ApiHttpError ? 'ERROR_API' : 'CLIENTE_REGISTRADO',
          mode,
          role,
          state: 'error',
          message: 'Error al registrar cliente en API.',
          clienteId: payload.clienteId || undefined,
          httpStatus: e instanceof ApiHttpError ? e.status : undefined,
          errorCode: e instanceof ApiHttpError ? e.payload?.codigo : undefined,
          errorMessage: e instanceof ApiHttpError ? e.payload?.mensaje ?? msg : msg,
          steps: [
            { id: 'cap', label: 'Datos capturados en interfaz', status: 'exitoso' },
            { id: 'rol', label: 'Validacion de rol', status: 'exitoso', detail: `${roleLabel} intento la operacion.` },
            { id: 'api', label: 'Solicitud enviada al middleware/API', status: 'exitoso' },
            { id: 'err', label: 'Error recibido', status: 'error', detail: msg },
          ],
        })
        throw e
      } finally {
        setBusy(false)
      }
    },
    [
      mode,
      role,
      roleLabel,
      permissions.canRegisterClients,
      permissions.canCreateVisibleTokenAccount,
      crearCuentaTokenTambien,
      editingId,
      registros,
      createRegistro,
      updateRegistro,
      mergeExternalEvent,
      pushTrace,
      showToast,
      upsertApiClienteRow,
      refreshClientesLedger,
    ],
  )

  const handleDelete = useCallback(
    (id: string) => {
      if (!permissions.canDeleteDemoRecords) {
        showToast('Tu rol no permite eliminar registros.', 'error')
        return
      }
      if (!window.confirm('¿Quitar esta fila de la vista? No elimina datos en blockchain.')) return
      deleteRegistro(id)
      if (selectedId === id) setSelectedId(null)
      if (editingId === id) setEditingId(null)
    },
    [deleteRegistro, editingId, permissions.canDeleteDemoRecords, selectedId, showToast],
  )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 xl:flex-row xl:gap-4 xl:overflow-hidden">
      <div className="flex w-full shrink-0 flex-col gap-3 xl:h-full xl:max-h-full xl:w-[380px] xl:overflow-y-auto">
        <div className="rounded-2xl border border-line bg-surface/40 p-4 text-xs text-muted shadow-card">
          <h3 className="text-sm font-semibold text-slate-200">Flujo de clientes</h3>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong className="text-slate-300">Crear:</strong> alta en cadena vía API (no borra datos previos).
            </li>
            <li>
              <strong className="text-slate-300">Consultar:</strong> menú Consultas por <span className="font-mono">clienteId</span>{' '}
              exacto.
            </li>
            <li>
              <strong className="text-slate-300">Editar:</strong> próximamente vía API (campos permitidos); la tabla en modo API es
              solo lectura.
            </li>
            <li>
              <strong className="text-slate-300">Baja lógica:</strong> en preparación (marcar inactivo en cadena); no elimina historial
              en blockchain.
            </li>
          </ul>
        </div>
        {permissions.canRegisterClients ? (
          <RegistroForm
            mode={mode}
            modo={modo}
            inicial={editingRegistro}
            busy={busy}
            onSubmit={handleSubmit}
            puedeEditar={Boolean(selectedId) && permissions.canEditDemoRecords}
            onPedirNuevo={() => setEditingId(null)}
            onPedirEditar={() => {
              if (selectedId && permissions.canEditDemoRecords) setEditingId(selectedId)
            }}
            onCancelarEdicion={() => setEditingId(null)}
            onLimpiar={() => {
              if (modo === 'crear') setSelectedId(null)
            }}
            opcionCrearCuentaTokenVisible={
              mode === 'api' && modo === 'crear' && permissions.canCreateVisibleTokenAccount
                ? { checked: crearCuentaTokenTambien, onChange: setCrearCuentaTokenTambien }
                : null
            }
          />
        ) : (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100 shadow-card">
            <h3 className="font-semibold">Accion restringida</h3>
            <p className="mt-1 text-xs text-amber-200/90">Tu rol solo permite consultar informacion.</p>
          </div>
        )}
        {mode === 'api' ? (
          <div className="rounded-2xl border border-line bg-surface/40 p-4 text-xs shadow-card">
            <h3 className="font-semibold text-slate-200">Última respuesta del servidor</h3>
            {ultimaOk ? (
              <dl className="mt-3 space-y-2 text-muted">
                <div>
                  <dt className="text-[10px] uppercase text-slate-500">ok</dt>
                  <dd className="font-mono text-slate-300">{String(ultimaOk.ok)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-slate-500">mensaje</dt>
                  <dd className="text-slate-300">{ultimaOk.mensaje}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-slate-500">txId</dt>
                  <dd className="break-all font-mono text-[11px] text-slate-400">{ultimaOk.txId}</dd>
                </div>
                {ultimaOk.txIdMint ? (
                  <div>
                    <dt className="text-[10px] uppercase text-slate-500">txIdMint</dt>
                    <dd className="break-all font-mono text-[11px] text-slate-400">{ultimaOk.txIdMint}</dd>
                  </div>
                ) : null}
              </dl>
            ) : ultimaErr ? (
              <dl className="mt-3 space-y-2 text-danger/90">
                <div>
                  <dt className="text-[10px] uppercase text-slate-500">HTTP</dt>
                  <dd className="font-mono">{ultimaErr.status || '—'}</dd>
                </div>
                {ultimaErr.codigo ? (
                  <div>
                    <dt className="text-[10px] uppercase text-slate-500">codigo</dt>
                    <dd className="font-mono">{ultimaErr.codigo}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[10px] uppercase text-slate-500">mensaje</dt>
                  <dd>{ultimaErr.mensaje}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-muted">Tras registrar un cliente verás ok, mensaje y txId aquí.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-[220px] min-w-0 flex-1 flex-col xl:h-full xl:min-h-0">
        <RegistrosTable
          items={mode === 'api' ? apiRows : registros}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEdit={(id) => {
            setSelectedId(id)
            setEditingId(id)
          }}
          onDelete={handleDelete}
          fillHeight
          readOnly={mode === 'api' || !permissions.canRegisterClients}
          allowMutations={permissions.canEditDemoRecords || permissions.canDeleteDemoRecords}
        />
      </div>

      <div className="flex w-full min-h-0 shrink-0 flex-col xl:h-full xl:w-[300px] xl:overflow-hidden">
        <RegistroDetailPanel
          registro={selected}
          fill
          readOnly={mode === 'api'}
          onEditar={() => selectedId && setEditingId(selectedId)}
          onEliminar={() => selected && handleDelete(selected.id)}
        />
      </div>
    </div>
  )
}
