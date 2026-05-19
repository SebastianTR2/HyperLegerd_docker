import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Field, TextInput, TextArea, Select, Accordion } from '../components/ui'
import type { ClienteFormDto } from '../types/dto'
import { emptyFormDto, formularioNuevoToPayload } from '../lib/mappers'
import { registrarClienteDesdeApi } from '../services/clientesApi'
import {
  logTechnicalApiFailure,
  mensajeErrorAltaCliente,
  MENSAJE_ACCESO_SERVICIO,
} from '../lib/apiErrors'
import { logErrorGuardar, logRegistroClienteExitoso, useSessionLog } from '../context/SessionLogContext'
import { useAuth } from '../context/AuthContext'

function validar(f: ClienteFormDto): Partial<Record<keyof ClienteFormDto, string>> {
  const e: Partial<Record<keyof ClienteFormDto, string>> = {}
  if (!f.codigoCliente.trim()) e.codigoCliente = 'Campo obligatorio'
  if (!f.nombreCompleto.trim()) e.nombreCompleto = 'Campo obligatorio'
  if (!f.tipoDocumento.trim()) e.tipoDocumento = 'Campo obligatorio'
  if (!f.numeroDocumento.trim()) e.numeroDocumento = 'Campo obligatorio'
  if (!f.fechaAlta.trim()) e.fechaAlta = 'Campo obligatorio'
  if (!f.estado.trim()) e.estado = 'Campo obligatorio'
  if (f.correo.trim()) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!re.test(f.correo.trim())) e.correo = 'Correo no válido'
  }
  return e
}

export default function NuevoClientePage() {
  const [form, setForm] = useState<ClienteFormDto>(() => emptyFormDto())
  const [errors, setErrors] = useState<Partial<Record<keyof ClienteFormDto, string>>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState<{ txId?: string } | null>(null)
  const navigate = useNavigate()
  const log = useSessionLog()
  const { readOnly } = useAuth()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setExito(null)
    setServerError(null)
    const v = validar(form)
    setErrors(v)
    if (Object.keys(v).length > 0) return
    if (readOnly) return
    setLoading(true)
    try {
      const payload = formularioNuevoToPayload(form)
      const res = await registrarClienteDesdeApi(payload)
      logRegistroClienteExitoso(log, form.codigoCliente.trim(), res.txId)
      setExito({ txId: res.txId })
      setForm(emptyFormDto())
    } catch (err) {
      logTechnicalApiFailure('clientes.registrar', err)
      const msg = mensajeErrorAltaCliente(err)
      logErrorGuardar(log, msg)
      setServerError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (readOnly) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card title="Nuevo cliente">
          <p className="text-sm text-[#6B7280]">Su perfil no permite registrar clientes.</p>
          <p className="mt-3 text-sm text-[#6B7280]">
            Si necesita permisos de registro, solicítelos al administrador del sistema.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card title="Registrar cliente" subtitle="Complete los campos obligatorios.">
        {exito ? (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <p className="font-medium">Cliente registrado correctamente.</p>
            {exito.txId ? (
              <div className="mt-3">
                <Accordion title="Referencia de registro">
                  <span className="break-all font-mono text-[11px] text-[#6B7280]">{exito.txId}</span>
                </Accordion>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => navigate('/clientes')}>
                Ver listado
              </Button>
              <Button variant="secondary" type="button" onClick={() => setExito(null)}>
                Registrar otro
              </Button>
            </div>
          </div>
        ) : null}

        {!exito ? (
          <>
            {serverError ? (
              <div
                className={[
                  'mb-4 rounded-xl border px-4 py-3 text-sm',
                  serverError === MENSAJE_ACCESO_SERVICIO
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-[#E8E1D8] bg-white/90 text-[#1F2937]',
                ].join(' ')}
              >
                {serverError}
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código de cliente" required error={errors.codigoCliente}>
              <TextInput
                value={form.codigoCliente}
                onChange={(e) => setForm((f) => ({ ...f, codigoCliente: e.target.value }))}
                placeholder="CLI001"
              />
            </Field>
            <Field label="Nombre completo" required error={errors.nombreCompleto}>
              <TextInput
                value={form.nombreCompleto}
                onChange={(e) => setForm((f) => ({ ...f, nombreCompleto: e.target.value }))}
              />
            </Field>
            <Field label="Tipo de documento" required error={errors.tipoDocumento}>
              <Select
                value={form.tipoDocumento}
                onChange={(e) => setForm((f) => ({ ...f, tipoDocumento: e.target.value }))}
              >
                <option value="CI">CI</option>
                <option value="NIT">NIT</option>
                <option value="PASAPORTE">PASAPORTE</option>
              </Select>
            </Field>
            <Field label="Número de documento" required error={errors.numeroDocumento}>
              <TextInput
                value={form.numeroDocumento}
                onChange={(e) => setForm((f) => ({ ...f, numeroDocumento: e.target.value }))}
              />
            </Field>
            <Field label="Fecha de alta" required hint="Formato AAAA-MM-DD" error={errors.fechaAlta}>
              <TextInput
                type="date"
                value={form.fechaAlta}
                onChange={(e) => setForm((f) => ({ ...f, fechaAlta: e.target.value }))}
              />
            </Field>
            <Field label="Estado" required error={errors.estado}>
              <Select value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </Select>
            </Field>
            <Field label="Teléfono" error={errors.telefono}>
              <TextInput
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
              />
            </Field>
            <Field label="Correo" error={errors.correo}>
              <TextInput
                type="email"
                value={form.correo}
                onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Notas" error={errors.notas}>
            <TextArea rows={3} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
          </Field>
          <div className="flex justify-end border-t border-[#E8E1D8] pt-4">
            <Button type="submit" loading={loading}>
              Guardar cliente
            </Button>
          </div>
        </form>
          </>
        ) : null}
      </Card>
    </div>
  )
}
