import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('the distributable notices file reproduces the licence texts of every shipped JavaScript package', () => {
  const notices = read('legal/THIRD_PARTY_LICENSES.txt')
  for (const name of ['react 19.3.1 (MIT)', 'react-dom 19.3.1 (MIT)', 'scheduler 0.28.0 (MIT)', 'lucide-react 0.468.0 (ISC)']) {
    assert.ok(notices.includes(name), `notices list ${name}`)
  }
  assert.match(notices, /Copyright \(c\) Meta Platforms, Inc\. and affiliates\./)
  assert.match(notices, /Permission is hereby granted, free of charge/)
  assert.match(notices, /Cole Bemis/)
  assert.match(notices, /WEBVIEW2-LICENSE\.txt/)
  assert.match(notices, /NSIS-COPYING\.txt/)
})

test('packaging copies the notices file into the release package', () => {
  const build = read('tools/Build-EzAiDesktop.ps1')
  assert.match(build, /legal\\THIRD_PARTY_LICENSES\.txt/)
  assert.match(build, /THIRD-PARTY-LICENSES\.txt/)
})

test('the UI never fetches brand artwork from the network', () => {
  const sources = readdirSync(new URL('../src/', import.meta.url))
    .filter(name => /\.(ts|tsx)$/.test(name))
    .map(name => read(`src/${name}`))
    .join('\n')
  assert.doesNotMatch(sources, /raw\.githubusercontent\.com/)
})

test('the privacy statement discloses Microsoft SmartScreen and the bundled-only ComfyUI icon', () => {
  const privacy = read('docs/PRIVACY-STATEMENT.md')
  assert.match(privacy, /SmartScreen/)
  assert.match(privacy, /bundled with the application/)
  assert.ok(statSync(new URL('../legal/THIRD_PARTY_LICENSES.txt', import.meta.url)).size > 1000)
})

test('every bundled third-party logo is recorded in the brand audit, and the About panel carries the non-affiliation disclosure', () => {
  const audit = read('docs/BRAND-ASSET-AUDIT.md')
  const logos = readdirSync(new URL('../public/agent-logos/', import.meta.url)).concat(['comfyui-desktop-icon.png'])
  for (const file of logos) assert.ok(audit.includes(file), `brand audit records ${file}`)
  assert.match(read('src/BuildIdentityPanel.tsx'), /not affiliated with, endorsed by or sponsored by any AI provider/)
})
