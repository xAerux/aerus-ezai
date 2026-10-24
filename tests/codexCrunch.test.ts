import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const guide = readFileSync(new URL('../public/knowledge/codex-efficiency-setup.html', import.meta.url), 'utf8')
const tool = readFileSync(new URL('../src/AerusCrunchGuides.tsx', import.meta.url), 'utf8')

test('Codex Crunch makes no unsupported plan, pricing or measured-savings claims', () => {
  for (const claim of ['no new purchase', 'no new subscription', 'rides on', '272K', '~250K', 'Built from the same measured', 'measured model-routing', 'gpt-6-luna', 'gpt-6.1-sol']) {
    assert.equal(guide.includes(claim) || tool.includes(claim), false, `claim removed: ${claim}`)
  }
  assert.equal(guide.includes('claude-mem'), false, 'claude-mem claims removed from the Codex guide')
})

test('the setup script is ASCII-only, so Windows PowerShell 5.1 reads it correctly', () => {
  const match = guide.match(/<code id="ps1-body">([\s\S]*?)<\/code><\/pre>/)
  assert.ok(match, 'script block exists')
  const nonAscii = [...match[1]].filter(c => c.charCodeAt(0) > 127)
  assert.equal(nonAscii.length, 0, 'no non-ASCII characters in the script')
})

test('the setup script asks before each step and writes nothing before the first approval', () => {
  const block = guide.slice(guide.indexOf('<code id="ps1-body">'))
  const stepA = block.indexOf("Step 'Step A")
  const stepB = block.indexOf("Step 'Step B")
  const stepC = block.indexOf("Step 'Step C")
  const firstWrite = block.indexOf('Write-Utf8NoBom $')
  const approvals = [...block.matchAll(/Ask-YesNo/g)].map(m => m.index)
  assert.ok(stepA > 0 && stepB > stepA && stepC > stepB, 'steps appear in order A, B, C')
  assert.equal(approvals.length >= 3, true, 'one approval per step')
  assert.ok(approvals[0] > 0 && approvals[0] < stepB, 'Step A approval comes before Step B')
  assert.ok(firstWrite > approvals[1], 'no Codex file is written before its approval')
  assert.match(block, /\$env:CODEX_HOME\.Trim\(\)/, 'CODEX_HOME is honoured')
  assert.doesNotMatch(block, /Set-Content[^\n]*-Encoding UTF8/, 'no BOM-writing Set-Content for Codex files')
  assert.doesNotMatch(block, /Add-Content[^\n]*-Encoding UTF8/, 'no BOM-writing Add-Content for Codex files')
})

test('every download and copy control points at content that exists on the page', () => {
  for (const id of ['ps1-body', 'prompt-body']) assert.ok(guide.includes(`id="${id}"`), `${id} exists`)
  assert.ok(guide.includes('data-download="ps1"') && guide.includes('data-download="prompt"'))
})
