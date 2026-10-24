import test from 'node:test'
import assert from 'node:assert/strict'
import { checkAerusSdm, checkAerusUsageHud } from '../src/localAgents.ts'

const globals = globalThis as { window?: unknown; fetch?: unknown }
const realFetch = globals.fetch

function nativeReply(status: number, body: unknown) {
  globals.window = { location: { search: '?desktop=1' } }
  globals.fetch = async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

test('a native "not installed" answer delivered with HTTP 404 is reported as that status, not as a service outage', async () => {
  nativeReply(404, { success: false, status: 'not-available', message: 'Aerus SDM is not installed at its documented location.' })
  const status = await checkAerusSdm()
  assert.equal(status.status, 'not-available')
  assert.equal(status.success, false)
  assert.match(status.message, /not installed/)
  globals.fetch = realFetch
  delete globals.window
})

test('a successful HUD status is returned unchanged', async () => {
  nativeReply(200, { success: true, status: 'available', message: 'Verified HUD.' })
  const status = await checkAerusUsageHud()
  assert.equal(status.status, 'available')
  globals.fetch = realFetch
  delete globals.window
})

test('an unreadable native reply is still classified as an error, not a status', async () => {
  globals.window = { location: { search: '?desktop=1' } }
  globals.fetch = async () => new Response('<html>not json</html>', { status: 404 })
  await assert.rejects(() => checkAerusSdm(), (error: Error) => error.name === 'ServiceError' && /route|not available/.test(error.message))
  globals.fetch = realFetch
  delete globals.window
})
