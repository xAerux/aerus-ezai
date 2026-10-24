import test from 'node:test'
import assert from 'node:assert/strict'
import { PREVIEW_UNAVAILABLE_MESSAGE, serviceFailure } from '../src/serviceErrors.ts'

const globals = globalThis as { window?: unknown }
const response = (status: number) => ({ status }) as Response

function asDesktop(search: string) {
  globals.window = { location: { search } }
}
function asPreview() {
  delete globals.window
}

test('a browser or Vite preview reports Desktop Service Unavailable instead of a raw HTTP status', () => {
  asPreview()
  for (const status of [404, 500]) {
    const error = serviceFailure('EZ AI', response(status))
    assert.equal(error.kind, 'preview-unavailable')
    assert.equal(error.message, PREVIEW_UNAVAILABLE_MESSAGE)
    assert.doesNotMatch(error.message, /HTTP/)
  }
  assert.equal(serviceFailure('EZ AI', null).kind, 'preview-unavailable')
  assert.match(PREVIEW_UNAVAILABLE_MESSAGE, /Guides, previews, copy and manual steps still work here/)
})

test('the desktop app distinguishes connection, refusal, missing route, server and invalid response failures', () => {
  asDesktop('?desktop=1')
  assert.equal(serviceFailure('EZ AI', null).kind, 'connection')
  assert.equal(serviceFailure('EZ AI', response(401)).kind, 'unauthorized')
  assert.equal(serviceFailure('EZ AI', response(403)).kind, 'unauthorized')
  assert.equal(serviceFailure('EZ AI', response(404)).kind, 'route-missing')
  assert.equal(serviceFailure('EZ AI', response(503)).kind, 'server')
  const invalid = serviceFailure('EZ AI', response(200))
  assert.equal(invalid.kind, 'invalid-response')
  assert.equal(invalid.status, 200)
  asPreview()
})

test('desktop messages never claim a missing companion when the service itself failed', () => {
  asDesktop('?desktop=1')
  const connection = serviceFailure('EZ AI', null)
  assert.doesNotMatch(connection.message, /not installed|missing/i)
  assert.match(connection.message, /could not reach the EZ AI desktop service/)
  asPreview()
})
