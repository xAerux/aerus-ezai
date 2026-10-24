import { fetchService, readServiceJson } from './serviceErrors.ts'
/** Versioned, browser-facing contract for the local Windows hardware scan endpoint. */
export type ScanStatus = 'success' | 'partial' | 'failed'

export interface CpuInfo {
  manufacturer: string | null
  model: string | null
  logicalProcessors: number | null
}

export interface MemoryInfo { installedBytes: number | null }

export interface GpuInfo {
  manufacturer: string | null
  model: string | null
  adapterCount?: number
  dedicatedVideoMemoryBytes: number | null
  sharedSystemMemoryBytes: number | null
  memorySource: string | null
}

export interface WindowsInfo {
  edition: string | null
  version: string | null
  build: string | null
  architecture: string | null
}

export interface DriveInfo {
  drive: string
  label: string | null
  totalBytes: number | null
  availableBytes: number | null
}

export interface AccelerationInfo {
  direct3D12: 'supported' | 'not detected' | 'unknown'
  aiAcceleration: 'not evaluated'
  note: string
}

export interface HardwareScanResult {
  schemaVersion: 1
  scannedAtUtc: string
  status: ScanStatus
  cpu: CpuInfo
  memory: MemoryInfo
  gpus: GpuInfo[]
  windows: WindowsInfo
  drives: DriveInfo[]
  acceleration: AccelerationInfo
  warnings: string[]
}

export type HardwareScanState =
  | { phase: 'idle'; result: HardwareScanResult | null; cached: boolean; message: string }
  | { phase: 'scanning'; result: HardwareScanResult | null; cached: boolean; message: string }
  | { phase: 'error'; result: HardwareScanResult | null; cached: boolean; message: string }

const STORAGE_KEY = 'ez-ai-hardware-scan-v1'

export function loadHardwareScan(): HardwareScanResult | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as HardwareScanResult
    return parsed.schemaVersion === 1 && typeof parsed.scannedAtUtc === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function saveHardwareScan(result: HardwareScanResult): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)) } catch { /* UI still uses the current result for this session. */ }
}

export async function requestHardwareScan(): Promise<HardwareScanResult> {
  const response = await fetchService('The Windows hardware scanner', '/api/hardware/scan', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const payload = await readServiceJson<Partial<HardwareScanResult> & { error?: string }>(response, 'The Windows hardware scanner')
  if (!response.ok || payload.status === 'failed') {
    const details = payload.warnings?.filter(Boolean).join(' ')
    throw new Error(payload.error || details || `Hardware scan failed (HTTP ${response.status}). You can retry.`)
  }
  if (payload.schemaVersion !== 1 || !payload.scannedAtUtc || !payload.cpu || !payload.windows || !Array.isArray(payload.gpus)) {
    throw new Error('The scanner response was incomplete. No new hardware result was saved.')
  }
  return payload as HardwareScanResult
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return 'Unavailable'
  const gib = bytes / (1024 ** 3)
  return `${gib.toFixed(gib >= 100 ? 0 : 1)} GB`
}

export function formatTimestamp(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'time unavailable' : date.toLocaleString()
}
