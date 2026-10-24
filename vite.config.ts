import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The packaging script passes the single build identity through EZAI_BUILD_IDENTITY so the UI and the native host agree.
// Plain development runs are labelled as unpackaged rather than given a release version.
const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const identity = processEnv.EZAI_BUILD_IDENTITY
  ? JSON.parse(processEnv.EZAI_BUILD_IDENTITY)
  : { version: 'unpackaged', channel: 'development', commit: 'unknown', dirty: false, buildTimeUtc: 'not packaged' }

export default defineConfig({
  plugins: [react()],
  define: { __EZAI_BUILD__: JSON.stringify(identity) },
})
