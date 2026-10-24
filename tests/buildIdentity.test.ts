import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Vite replaces __EZAI_BUILD__ at bundle time; the test supplies the same shape before loading the module.
const identity = { version: '1.0.0-beta.3', channel: 'candidate', commit: '354b73919dbc', dirty: false, buildTimeUtc: '2026-10-23T04:49:58.874Z' }
;(globalThis as Record<string, unknown>).__EZAI_BUILD__ = identity
const { channelLabel, commitLabel, describeBuild, EZ_AI_VERSION } = await import('../src/releaseInfo.ts')

test('build description names version, channel, commit and build time from the single identity', () => {
  assert.equal(EZ_AI_VERSION, '1.0.0-beta.3')
  assert.equal(channelLabel('candidate'), 'Candidate')
  assert.equal(describeBuild(identity), 'EZ AI 1.0.0-beta.3 · Candidate · 354b73919dbc · built 2026-10-23T04:49:58.874Z')
})

test('uncommitted builds are labelled so they are never presented as a clean commit', () => {
  assert.equal(commitLabel({ ...identity, dirty: true }), '354b73919dbc · uncommitted changes')
  assert.equal(commitLabel({ ...identity, commit: 'unknown' }), 'Source commit not recorded')
})

test('packaging writes one identity to the bundled UI, the native host and the release manifest', () => {
  const build = readFileSync(new URL('../tools/Build-EzAiDesktop.ps1', import.meta.url), 'utf8')
  const manifest = readFileSync(new URL('../tools/New-EzAiReleaseManifest.ps1', import.meta.url), 'utf8')
  const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  assert.match(build, /EZAI_BUILD_IDENTITY/)
  assert.match(build, /BuildIdentity\.g\.cs/)
  assert.match(build, /build-identity\.json/)
  assert.match(build, /does not match the requested build version/)
  assert.match(manifest, /build-identity\.json/)
  assert.match(manifest, /does not match the manifest version/)
  assert.match(vite, /__EZAI_BUILD__/)
})

test('native assembly versions come only from the generated identity, and every executable carries Aeru Creations metadata', () => {
  const build = readFileSync(new URL('../tools/Build-EzAiDesktop.ps1', import.meta.url), 'utf8')
  const desktopInfo = readFileSync(new URL('../desktop/AssemblyInfo.cs', import.meta.url), 'utf8')
  const serviceInfo = readFileSync(new URL('../EzAiServiceAssemblyInfo.cs', import.meta.url), 'utf8')
  const installer = readFileSync(new URL('../installer/EzAiSetup.nsi', import.meta.url), 'utf8')
  const manifest = readFileSync(new URL('../tools/New-EzAiReleaseManifest.ps1', import.meta.url), 'utf8')
  assert.match(build, /AssemblyFileVersion\("\$numericVersion"\)/)
  assert.doesNotMatch(desktopInfo, /Assembly(File|Informational)?Version\(/)
  assert.doesNotMatch(serviceInfo, /Assembly(File|Informational)?Version\(/)
  assert.match(serviceInfo, /AssemblyTitle\("EZ AI Service"\)/)
  assert.match(serviceInfo, /AssemblyCompany\("Aeru Creations"\)/)
  assert.match(desktopInfo, /AssemblyCompany\("Aeru Creations"\)/)
  assert.match(build, /EzAiServiceAssemblyInfo\.cs \$identityFile/)
  assert.match(installer, /"CompanyName" "Aeru Creations"/)
  assert.match(installer, /"Publisher" "Aeru Creations"/)
  assert.doesNotMatch(manifest, /1\.0\.0-beta\.1/)
})
