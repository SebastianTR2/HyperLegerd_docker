export type DemoEventType =
  | 'registro_creado'
  | 'registro_editado'
  | 'registro_eliminado'
  | 'token_emitido'
  | 'token_transferido'
  | 'consulta'

export interface DemoEvent {
  id: string
  tipo: DemoEventType
  estado: 'exito' | 'error'
  titulo: string
  mensaje: string
  fechaIso: string
  referencia?: string
}

export interface TokenOperacion {
  id: string
  tipo: 'emitir' | 'transferir'
  clienteOrigen: string
  clienteDestino?: string
  cantidad: number
  descripcion?: string
  tipoToken: string
  fechaIso: string
  referencia: string
  estado: 'exito' | 'error'
}

export type AppRole = 'admin' | 'integrador' | 'solo_lectura'

export type TraceOperationType =
  | 'CLIENTE_REGISTRADO'
  | 'CLIENTE_CONSULTADO'
  | 'CUENTA_VISIBLE_CREADA'
  | 'TOKEN_EMITIDO'
  | 'TOKEN_TRANSFERIDO'
  | 'ERROR_PERMISOS'
  | 'ERROR_API'

export type TraceState = 'exitoso' | 'error' | 'bloqueado' | 'pendiente'

export interface TraceStep {
  id: string
  label: string
  status: TraceState
  detail?: string
}

export interface TraceEntry {
  id: string
  operationType: TraceOperationType
  mode: 'demo' | 'api'
  role: AppRole
  state: TraceState
  createdAt: string
  message: string
  txId?: string
  txIdMint?: string
  clienteId?: string
  codigoToken?: string
  httpStatus?: number
  errorCode?: string
  errorMessage?: string
  steps: TraceStep[]
}

export interface PersistedDemoState {
  version: 2
  /** Solo sesión local (modo sin API); no sustituye al ledger. */
  registros: import('./registro').Registro[]
  eventos: DemoEvent[]
  tokenOps: TokenOperacion[]
}
