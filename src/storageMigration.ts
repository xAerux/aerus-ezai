/**
 * Export and import of EZ AI's own browser-profile data.
 *
 * Every EZ AI-owned key is included, so saved prompts (including edited Crunch prompts), theme, Knowledge bookmarks and
 * preferences all survive an export. Three kinds of key are never exported or restored:
 *  - approval state (the approved agent workspace), so a file can never grant launch permission;
 *  - one-time handoffs (a pending agent launch) and activity logs;
 *  - caches that are recomputed on the next run.
 */
const EXCLUDED_KEYS = new Set([
  'ez-ai-approved-agent-workspace-v2',
  'ez-ai-pending-agent-launch-r01',
  'ez-ai-installer-activity-v1',
  'ez-ai-value-cached-v1',
  'ez-ai-desktop',
  'ez-ai-data-v1',
  'aerus-sdm',
])
const MAX_VALUE_LENGTH = 2 * 1024 * 1024
const MAX_BACKUP_BYTES = 10 * 1024 * 1024

export type StorageBackup = {
  format: 'ez-ai-data-v1'
  exportedAtUtc: string
  values: Record<string, string>
}

export function isBackupKey(key: string): boolean {
  return (key.startsWith('ez-ai-') || key.startsWith('aerus-')) && !EXCLUDED_KEYS.has(key)
}

function backupKeys(storage: Storage): string[] {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key !== null && isBackupKey(key)) keys.push(key)
  }
  return keys.sort()
}

export function exportAppData(storage: Storage = localStorage): StorageBackup {
  const values: Record<string, string> = {}
  for (const key of backupKeys(storage)) {
    const value = storage.getItem(key)
    if (value !== null && value.length <= MAX_VALUE_LENGTH) values[key] = value
  }
  return { format: 'ez-ai-data-v1', exportedAtUtc: new Date().toISOString(), values }
}

export function parseAppData(text: string): StorageBackup {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('This backup is larger than the 10 MB import limit.')
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error('The selected file is not valid EZ AI JSON data.') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('This file is not an EZ AI data backup.')
  const candidate = parsed as { format?: unknown; values?: unknown; exportedAtUtc?: unknown }
  if (candidate.format !== 'ez-ai-data-v1' || !candidate.values || typeof candidate.values !== 'object' || Array.isArray(candidate.values)) {
    throw new Error('Unsupported backup format. Export data from EZ AI first, then select that JSON file.')
  }
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(candidate.values as Record<string, unknown>)) {
    if (isBackupKey(key) && typeof value === 'string' && value.length <= MAX_VALUE_LENGTH) values[key] = value
  }
  if (Object.keys(values).length === 0) throw new Error('No supported EZ AI settings or saved data were found in this backup.')
  return { format: 'ez-ai-data-v1', exportedAtUtc: typeof candidate.exportedAtUtc === 'string' ? candidate.exportedAtUtc : '', values }
}

export function restoreAppData(backup: StorageBackup, storage: Storage = localStorage): number {
  let restored = 0
  for (const [key, value] of Object.entries(backup.values)) {
    if (!isBackupKey(key)) continue
    storage.setItem(key, value)
    restored += 1
  }
  return restored
}

export function countExistingAppData(storage: Storage = localStorage): number {
  return backupKeys(storage).length
}
