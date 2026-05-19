import { portalJson } from './apiClient'

export interface PortalUser {
  id: string
  username: string
  nombreCompleto: string
  rol: 'admin' | 'integrador' | 'lectura' | string
}

interface LoginBody {
  username: string
  password: string
}

interface LoginResponse {
  ok: boolean
  token: string
  usuario: PortalUser
}

interface MeResponse {
  ok: boolean
  usuario: PortalUser
}

export async function loginPortal(body: LoginBody): Promise<LoginResponse> {
  return portalJson<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    skipAuth: true,
  })
}

export async function mePortal(): Promise<PortalUser> {
  const j = await portalJson<MeResponse>('/auth/me')
  return j.usuario
}

export async function logoutPortal(): Promise<void> {
  try {
    await portalJson('/auth/logout', { method: 'POST' })
  } catch {
    /* cerrar sesión local aunque falle red */
  }
}
