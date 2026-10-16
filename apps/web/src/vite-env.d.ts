/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Browser-facing URL of the API, e.g. https://playdamnit.com */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
