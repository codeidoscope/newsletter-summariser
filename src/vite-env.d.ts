/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GOOGLE_CLIENT_ID: string;
    readonly VITE_OPENAI_API_KEY: string;
    readonly VITE_API_BASE_URL: string;
    readonly VITE_RECIPIENT_FILTER?: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }