export const STORAGE_KEY_PORTAL_JWT = 'campuschain-portal-jwt'

export function getAuthToken(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY_PORTAL_JWT) ?? ''
  } catch {
    return ''
  }
}

export function setAuthToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY_PORTAL_JWT, token)
  } catch {
    /* ignore */
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_PORTAL_JWT)
  } catch {
    /* ignore */
  }
}
