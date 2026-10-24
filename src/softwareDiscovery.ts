import { fetchService, readServiceJson } from './serviceErrors.ts'
/** Versioned local Windows AI inventory returned by SoftwareDiscoveryService.cs. */
export type DiscoveryStatus = 'success' | 'partial' | 'failed'
export type FindingStatus = 'Installed' | 'Running' | 'Needs Verification' | 'Data Found Only' | 'Not Detected' | 'Not Found' | 'Scan Incomplete'
export interface SoftwareFinding {
  id: string; name: string; status: FindingStatus; version: string | null
  installationType: string; location: string | null; activationId?: string | null; operationalStatus: string; evidence: string[]
}
export interface ModelFinding {
  id: string; name: string; family: string | null; runtime: string; location: string | null
  sizeBytes: number | null; format: string | null; quantization: string | null
  parameterCount?: number | null; contextLength?: number | null
  capabilities: string | null; categories?: string[]; aliases?: string[]; status: FindingStatus; evidence: string[]
}
export interface EnhancementFinding { id:string; name:string; status:FindingStatus; configured:string; enabled:string; running:string; coverage:string; evidence:string[] }
export interface DiscoveryResult {
  schemaVersion: 1; scannedAtUtc: string; durationMs: number; status: DiscoveryStatus
  applications: SoftwareFinding[]; codingAgents: SoftwareFinding[]; runtimes: SoftwareFinding[]
  models: ModelFinding[]; warnings: string[]; sources: string[]; enhancements?: EnhancementFinding[]
}
export type DiscoveryState =
  | { phase: 'idle' | 'scanning' | 'error'; result: DiscoveryResult | null; cached: boolean; message: string }

const STORAGE_KEY = 'ez-ai-software-discovery-v1'
export function loadDiscovery(): DiscoveryResult | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as DiscoveryResult | null
    return parsed?.schemaVersion === 1 && Array.isArray(parsed.applications) && Array.isArray(parsed.models) ? parsed : null
  } catch { return null }
}
export function saveDiscovery(result: DiscoveryResult): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)) } catch { /* keep the live result visible if storage is unavailable */ }
}
export async function requestDiscovery(customModelFolders: string[] = []): Promise<DiscoveryResult> {
  const customModelFoldersB64 = customModelFolders.slice(0, 8).map(path => {
    const bytes = new TextEncoder().encode(path)
    return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
  })
  const response = await fetchService('AI discovery', '/api/discovery/scan', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ customModelFoldersB64 }), cache: 'no-store' })
  const payload = await readServiceJson<Partial<DiscoveryResult> & { error?: string }>(response, 'AI discovery')
  if (!response.ok || payload.status === 'failed') throw new Error(payload.error || `AI discovery failed (HTTP ${response.status}). Retry when ready.`)
  if (payload.schemaVersion !== 1 || !payload.scannedAtUtc || !Array.isArray(payload.applications) || !Array.isArray(payload.models) || !Array.isArray(payload.codingAgents)) throw new Error('The AI inventory response was incomplete. No new inventory was saved.')
  return payload as DiscoveryResult
}
