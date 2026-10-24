import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const codex = readFileSync(new URL('../public/instruction-templates/codex-global-v1.md', import.meta.url), 'utf8')
const claude = readFileSync(new URL('../public/instruction-templates/claude-code-global-v1.md', import.meta.url), 'utf8')
const component = readFileSync(new URL('../src/AiInstructionsInstaller.tsx', import.meta.url), 'utf8')
const service = readFileSync(new URL('../InstructionInstallerService.cs', import.meta.url), 'utf8')
const api = readFileSync(new URL('../EzAiLauncher.cs', import.meta.url), 'utf8')
const tools = readFileSync(new URL('../src/AerusToolsShowcase.tsx', import.meta.url), 'utf8')
const companion = readFileSync(new URL('../src/companionStatus.ts', import.meta.url), 'utf8')
const toolStyles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const instructionStyles = readFileSync(new URL('../src/instructionInstaller.css', import.meta.url), 'utf8') + readFileSync(new URL('../src/instructionInstallerPolish.css', import.meta.url), 'utf8')

test('generic versioned Codex template contains engineering guidance without owner identity', () => {
  assert.match(codex, /Template version: 1\.0\.0/)
  assert.match(codex, /Inspect the relevant source/)
  assert.match(codex, /Stage only files belonging to the current task/)
  assert.doesNotMatch(codex, /Aeru Creations|C:\\AI-services|killi/i)
})

test('Claude template is distinct and explains written instructions versus auto memory', () => {
  assert.match(claude, /Claude Code auto memory is a separate system/)
  assert.match(claude, /These written instructions guide behavior; they are context, not enforced permissions/)
  assert.doesNotMatch(claude, /CODEX_HOME|Codex CLI/i)
})

test('installer interface includes dual approval, review, backup, and safe status states', () => {
  for (const phrase of ['Global instructions affect how the agent behaves across projects', 'Replace With Backup', 'Review Manual Merge', 'Install Instructions', 'unable-to-inspect', 'Copy Instructions', 'Manual installation steps']) assert.ok(component.includes(phrase), `Missing UI requirement: ${phrase}`)
  assert.match(service, /acknowledged/)
  assert.match(service, /approved/)
  assert.match(service, /File\.Replace/)
  assert.match(service, /currentHash/)
})

test('installer only exposes the two fixed global instruction file identities', () => {
  assert.match(service, /AGENTS\.md/)
  assert.match(service, /CLAUDE\.md/)
  assert.match(service, /Unsupported instruction template identity/)
  assert.match(service, /Network destinations are not allowed/)
  assert.match(api, /\/api\/instructions\/status/)
  assert.match(api, /\/api\/instructions\/install/)
  assert.match(api, /requestHeaders\.TryGetValue\("Origin"/)
})

test('development preview does not label a missing native companion API as an absent companion app', () => {
  assert.match(companion, /status: 'service-unavailable'/)
  assert.match(companion, /Desktop service unavailable/)
  assert.match(tools, /Open in desktop app/)
  assert.match(tools, /describeCompanion\('hud'/)
})

test('Tools sections fill the content width and preserve balanced responsive grids', () => {
  assert.match(toolStyles, /\.aerus-tools-page>\.aerus-tools-panel\{[^}]*max-width:none;width:100%\}/)
  assert.match(toolStyles, /\.instruction-installer\{max-width:none;width:100%/)
  assert.match(toolStyles, /\.aerus-tools-grid,\.knowledge-aerus-guides\{grid-template-columns:1fr\}/)
  assert.match(instructionStyles, /\.instruction-agent-grid\s*\{\s*grid-template-columns:\s*1fr/)
  assert.match(instructionStyles, /overflow-wrap:anywhere/)
})

test('instruction acknowledgment is a separate non-installing stage before operation review', () => {
  assert.match(component, /Review & Acknowledge Changes/)
  assert.match(component, /Confirm Acknowledgment/)
  assert.match(component, /Stage 1 complete/)
  assert.match(component, /Stage 2 · Review this/)
  assert.match(component, /Install Instructions/)
  assert.match(component, /native EZ AI desktop service can inspect and verify/)
  assert.match(component, /disabled=\{busy \|\| !acknowledged \|\| !state\?\.success\}/)
})
