import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { actualizarClienteDesdeApi, consultarClienteDesdeApi } from '../services/clientesApi'
import type { ClienteFormDto } from '../types/dto'
import { detalleToFormDto, formularioEdicionToPartialPayload } from '../lib/mappers'
import { ApiHttpError } from '../services/apiClient'
import { logTechnicalApiFailure } from '../lib/apiErrors'
import { Card, Button, Field, TextInput, TextArea, Select, Accordion } from '../components/ui'
import { AccesoServicioBloqueado } from '../components/PortalServiceMessages'
import { logClienteActualizado, useSessionLog } from '../context/SessionLogContext'
import { useAuth } from '../context/AuthContext'

export default function EditarClientePage() {
  const { clienteId: rawId } = useParams()
  const clienteId = rawId ? decodeURIComponent(rawId) : ''
  const navigate = useNavigate()
  const [form, setForm] = useState<ClienteFormDto | null>(null)
  const [bloqueadoBaja, setBloqueadoBaja] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [accessBlocked, setAccessBlocked] = useState(false)
  const [auditoria, setAuditoria] = useState<string | null>(null)
  const log = useSessionLog()
  const { readOnly } = useAuth()

  useEffect(() => {
    if (!clienteId) return
    let ok = true
    setLoading(true)
    setAccessBlocked(false)
    setServerError(null)
    consultarClienteDesdeApi(clienteId)
      .then((d) => {
        if (!ok) return
        if (d) {
          setBloqueadoBaja(d.esBajaLogica)
          setAuditoria(d.informacionAuditoria ?? null)
          setForm(detalleToFormDto(d))
        } else {
          setForm(null)
          setBloqueadoBaja(false)
          setAuditoria(null)
        }
      })
      .catch((e: unknown) => {
        if (!ok) return
        if (e instanceof ApiHttpError && (e.status === 401 || e.status === 403)) {
          logTechnicalApiFailure('clientes.editar.carga', e)
          setAccessBlocked(true)
          setForm(null)
          return
        }
        setForm(null)
      })
      .finally(() => {
        if (ok) setLoading(false)
      })
    return () => {
      ok = false
    }
  }, [clienteId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form || readOnly || bloqueadoBaja) return
    setSaving(true)
    setServerError(null)
    try {
      const payload = formularioEdicionToPartialPayload({
        nombreCompleto: form.nombreCompleto,
        tipoDocumento: form.tipoDocumento,
        numeroDocumento: form.numeroDocumento,
        estado: form.estado,
        telefono: form.telefono,
        correo: form.correo,
        notas: form.notas,
      })
      await actualizarClienteDesdeApi(clienteId, payload)
      logClienteActualizado(log, clienteId)
      navigate(`/clientes/${encodeURIComponent(clienteId)}`, {
        replace: false,
        state: { flashCliente: 'Cliente actualizado correctamente.' },
      })
    } catch (err: unknown) {
      logTechnicalApiFailure('clientes.editar.guardar', err)
      if (err instanceof ApiHttpError && err.payload?.mensaje) {
        setServerError(err.payload.mensaje)
      } else {
        setServerError('No se pudieron guardar los cambios. Intente nuevamente.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!clienteId) {
    return <p className="text-sm text-muted">Código de cliente no válido.</p>
  }

  if (loading) {
    return <p className="text-sm text-muted">Cargando…</p>
  }

  if (accessBlocked) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <AccesoServicioBloqueado />
        <Link className="text-sm text-accent hover:underline" to="/clientes">
          Volver al listado
        </Link>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="mx-auto max-w-lg">
        <Card title="Editar cliente">
          <p className="text-sm text-muted">No se encontró el cliente.</p>
          <Link className="mt-4 inline-block text-sm text-accent hover:underline" to="/clientes">
            Volver
          </Link>
        </Card>
      </div>
    )
  }

  if (readOnly) {
    return (
      <div className="mx-auto max-w-lg">
        <Card title="Editar cliente">
          <p className="text-sm text-muted">Su perfil no permite editar registros.</p>
        </Card>
      </div>
    )
  }

  if (bloqueadoBaja) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card title="Editar cliente">
          <p className="text-sm text-muted">
            Este cliente fue dado de baja y no admite modificaciones. Puede consultar la ficha desde el listado.
          </p>
          <Link className="mt-4 inline-block text-sm text-accent hover:underline" to={`/clientes/${encodeURIComponent(clienteId)}`}>
            Ver ficha
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card title="Editar cliente" subtitle="El código y la fecha de alta no se modifican.">
        {serverError ? (
          <p className="mb-4 rounded-lg border border-warning/35 bg-warning-soft px-3 py-2 text-sm text-warning-ink">
            {serverError}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código de cliente">
              <TextInput value={form.codigoCliente} disabled className="opacity-70" />
            </Field>
            <Field label="Fecha de alta">
              <TextInput type="date" value={form.fechaAlta} disabled className="opacity-70" />
            </Field>
            <Field label="Nombre completo" required>
              <TextInput
                value={form.nombreCompleto}
                onChange={(e) => setForm((f) => (f ? { ...f, nombreCompleto: e.target.value } : f))}
              />
            </Field>
            <Field label="Tipo de documento" required>
              <Select
                value={form.tipoDocumento}
                onChange={(e) => setForm((f) => (f ? { ...f, tipoDocumento: e.target.value } : f))}
              >
                <option value="CI">CI</option>
                <option value="NIT">NIT</option>
                <option value="PASAPORTE">PASAPORTE</option>
              </Select>
            </Field>
            <Field label="Número de documento" required>
              <TextInput
                value={form.numeroDocumento}
                onChange={(e) => setForm((f) => (f ? { ...f, numeroDocumento: e.target.value } : f))}
              />
            </Field>
            <Field label="Estado" required>
              <Select value={form.estado} onChange={(e) => setForm((f) => (f ? { ...f, estado: e.target.value } : f))}>
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </Select>
            </Field>
            <Field label="Teléfono">
              <TextInput
                value={form.telefono}
                onChange={(e) => setForm((f) => (f ? { ...f, telefono: e.target.value } : f))}
              />
            </Field>
            <Field label="Correo">
              <TextInput
                type="email"
                value={form.correo}
                onChange={(e) => setForm((f) => (f ? { ...f, correo: e.target.value } : f))}
              />
            </Field>
          </div>
          <Field label="Notas" hint="Solo la observación de negocio; no incluya datos técnicos del sistema.">
            <TextArea rows={3} value={form.notas} onChange={(e) => setForm((f) => (f ? { ...f, notas: e.target.value } : f))} />
          </Field>
          {auditoria ? (
            <Accordion title="Información de auditoría">
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">{auditoria}</pre>
            </Accordion>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <Link to={`/clientes/${encodeURIComponent(clienteId)}`}>
              <Button variant="secondary" type="button">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" loading={saving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
