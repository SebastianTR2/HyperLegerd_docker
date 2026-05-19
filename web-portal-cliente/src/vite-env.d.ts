/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORTAL_API_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
