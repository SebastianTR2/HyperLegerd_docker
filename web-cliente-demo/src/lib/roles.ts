import type { AppRole } from '../types/demo'

export interface RolePermissions {
  canRegisterClients: boolean
  canEditDemoRecords: boolean
  canDeleteDemoRecords: boolean
  canConsultClients: boolean
  canEmitTokens: boolean
  canTransferTokens: boolean
  canViewHistory: boolean
  canViewTraceability: boolean
  /** Alta de cuenta token visible (Fase 2); admin e integrador. */
  canCreateVisibleTokenAccount: boolean
}

export type AppRoutePath =
  | '/'
  | '/registros'
  | '/tokens'
  | '/cuentas-visibles'
  | '/clientes-registrados'
  | '/consultas'
  | '/historial'
  | '/trazabilidad'
  | '/credenciales'

const ADMIN_KEY = 'sec-admin'
const INTEGRADOR_KEY = 'sec-int'
const LECTURA_KEY = 'sec-lect'

export function resolveRoleFromApiKey(apiKey: string): AppRole {
  const k = apiKey.trim()
  if (k === ADMIN_KEY) return 'admin'
  if (k === INTEGRADOR_KEY) return 'integrador'
  if (k === LECTURA_KEY || !k) return 'solo_lectura'
  return 'solo_lectura'
}

export function roleLabel(role: AppRole): string {
  if (role === 'admin') return 'Administrador'
  if (role === 'integrador') return 'Integrador'
  return 'Solo lectura'
}

export function workspaceLabel(role: AppRole): string {
  if (role === 'admin') return 'Panel administrativo'
  if (role === 'integrador') return 'Panel de integracion'
  return 'Panel de consulta'
}

export function rolePermissions(role: AppRole): RolePermissions {
  if (role === 'admin') {
    return {
      canRegisterClients: true,
      canEditDemoRecords: true,
      canDeleteDemoRecords: true,
      canConsultClients: true,
      canEmitTokens: true,
      canTransferTokens: true,
      canViewHistory: true,
      canViewTraceability: true,
      canCreateVisibleTokenAccount: true,
    }
  }
  if (role === 'integrador') {
    return {
      canRegisterClients: true,
      canEditDemoRecords: false,
      canDeleteDemoRecords: false,
      canConsultClients: true,
      canEmitTokens: false,
      canTransferTokens: false,
      canViewHistory: true,
      canViewTraceability: true,
      canCreateVisibleTokenAccount: true,
    }
  }
  return {
    canRegisterClients: false,
    canEditDemoRecords: false,
    canDeleteDemoRecords: false,
    canConsultClients: true,
    canEmitTokens: false,
    canTransferTokens: false,
    canViewHistory: true,
    canViewTraceability: true,
    canCreateVisibleTokenAccount: false,
  }
}

export function routeAllowedForRole(role: AppRole, path: AppRoutePath): boolean {
  if (path === '/tokens' && role !== 'admin') return false
  return true
}
