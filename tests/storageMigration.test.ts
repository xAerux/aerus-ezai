import test from 'node:test'
import assert from 'node:assert/strict'
import { countExistingAppData, exportAppData, isBackupKey, parseAppData, restoreAppData } from '../src/storageMigration.ts'

class MemoryStorage {
  private items = new Map<string, string>()
  get length() { return this.items.size }
  key(index: number) { return [...this.items.keys()][index] ?? null }
  getItem(key: string) { return this.items.has(key) ? this.items.get(key)! : null }
  setItem(key: string, value: string) { this.items.set(key, String(value)) }
  removeItem(key: string) { this.items.delete(key) }
  clear() { this.items.clear() }
}

function sample(): MemoryStorage {
  const storage = new MemoryStorage()
  storage.setItem('aerus-theme-v1', '{"hue":180}')
  storage.setItem('ez-ai-claude-profile-about-v1', 'My edited Crunch prompt')
  storage.setItem('ez-ai-claude-md-prompt-v1', 'My edited CLAUDE.md prompt')
  storage.setItem('ez-ai-knowledge-bookmarks-v1', '["claude-basics"]')
  storage.setItem('ez-ai-free-first-v1', 'true')
  storage.setItem('ez-ai-approved-agent-workspace-v2', 'C:\\Projects\\approved')
  storage.setItem('ez-ai-pending-agent-launch-r01', 'codex')
  storage.setItem('ez-ai-value-cached-v1', '{"cache":true}')
  storage.setItem('unrelated-site-key', 'not ours')
  return storage
}

test('export includes every EZ AI preference and saved prompt, including edited Crunch prompts', () => {
  const backup = exportAppData(sample())
  for (const key of ['aerus-theme-v1', 'ez-ai-claude-profile-about-v1', 'ez-ai-claude-md-prompt-v1', 'ez-ai-knowledge-bookmarks-v1', 'ez-ai-free-first-v1']) {
    assert.ok(key in backup.values, `${key} is exported`)
  }
  assert.equal(backup.values['ez-ai-claude-profile-about-v1'], 'My edited Crunch prompt')
})

test('export never includes approval state, one-time handoffs, caches or keys that are not EZ AI\'s', () => {
  const backup = exportAppData(sample())
  for (const key of ['ez-ai-approved-agent-workspace-v2', 'ez-ai-pending-agent-launch-r01', 'ez-ai-value-cached-v1', 'unrelated-site-key']) {
    assert.ok(!(key in backup.values), `${key} is not exported`)
  }
})

test('a crafted backup cannot set approval state or foreign keys on import', () => {
  const crafted = JSON.stringify({ format: 'ez-ai-data-v1', values: { 'ez-ai-approved-agent-workspace-v2': 'C:\\Windows', 'ez-ai-free-first-v1': 'false', 'document.cookie': 'x' } })
  const backup = parseAppData(crafted)
  const target = new MemoryStorage()
  const restored = restoreAppData(backup, target)
  assert.equal(restored, 1)
  assert.equal(target.getItem('ez-ai-approved-agent-workspace-v2'), null)
  assert.equal(target.getItem('document.cookie'), null)
  assert.equal(target.getItem('ez-ai-free-first-v1'), 'false')
})

test('export and import round-trip the same data for a new profile', () => {
  const source = sample()
  const backup = JSON.parse(JSON.stringify(exportAppData(source)))
  const fresh = new MemoryStorage()
  restoreAppData(parseAppData(JSON.stringify(backup)), fresh)
  assert.equal(fresh.getItem('ez-ai-claude-profile-about-v1'), 'My edited Crunch prompt')
  assert.equal(fresh.getItem('ez-ai-knowledge-bookmarks-v1'), '["claude-basics"]')
  assert.equal(countExistingAppData(fresh), 5)
})

test('invalid or oversized backups are rejected with a clear message', () => {
  assert.throws(() => parseAppData('not json'), /not valid EZ AI JSON/)
  assert.throws(() => parseAppData('[]'), /not an EZ AI data backup/)
  assert.throws(() => parseAppData(JSON.stringify({ format: 'other', values: {} })), /Unsupported backup format/)
  assert.throws(() => parseAppData(JSON.stringify({ format: 'ez-ai-data-v1', values: { 'ez-ai-free-first-v1': 1 } })), /No supported EZ AI settings/)
})

test('the key rule matches the EZ AI namespaces only', () => {
  assert.equal(isBackupKey('ez-ai-claude-md-prompt-v1'), true)
  assert.equal(isBackupKey('aerus-prompt'), true)
  assert.equal(isBackupKey('ez-ai-approved-agent-workspace-v2'), false)
  assert.equal(isBackupKey('localStorage-other'), false)
})
