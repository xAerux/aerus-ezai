import test from 'node:test'
import assert from 'node:assert/strict'
import { availableCatalogForTask, catalogStorageFit, evaluateCatalogFit, evaluateModelFit, modelsForTask } from '../src/modelRecommendations.ts'
import type { HardwareScanResult } from '../src/hardwareScan.ts'
import type { DiscoveryResult, ModelFinding } from '../src/softwareDiscovery.ts'

const gib = 1024 ** 3
const model: ModelFinding = {
  id: 'qwen-coder-14b', name: 'qwen2.5-coder:14b', family: 'qwen2', runtime: 'Ollama', location: 'C:\\Users\\test\\.ollama\\models',
  sizeBytes: 8_988_124_298, parameterCount: 14_770_033_664, contextLength: 32_768, format: 'gguf', quantization: 'Q4_K_M',
  capabilities: 'completion, tools, insert', categories: ['Coding Models', 'Chat & Reasoning'], status: 'Installed', evidence: ['fixture'],
}

function hardware(vramGiB: number | null, ramGiB: number): HardwareScanResult {
  return {
    schemaVersion: 1, scannedAtUtc: '2026-10-20T00:00:00Z', status: 'success',
    cpu: { manufacturer: 'Fixture', model: 'Fixture CPU', logicalProcessors: 8 }, memory: { installedBytes: ramGiB * gib },
    gpus: vramGiB == null ? [] : [{ manufacturer: 'Fixture', model: `${vramGiB} GB GPU`, dedicatedVideoMemoryBytes: vramGiB * gib, sharedSystemMemoryBytes: null, memorySource: 'synthetic fixture' }],
    windows: { edition: 'Fixture', version: '1', build: '1', architecture: '64-bit' }, drives: [{ drive: 'C:', label: 'Fixture', totalBytes: 100 * gib, availableBytes: 50 * gib }],
    acceleration: { direct3D12: 'unknown', aiAcceleration: 'not evaluated', note: 'fixture' }, warnings: [],
  }
}

function discovery(runtimeStatus = 'Running'): DiscoveryResult {
  return { schemaVersion: 1, scannedAtUtc: '2026-10-20T00:00:00Z', durationMs: 1, status: 'success', applications: [], codingAgents: [],
    runtimes: [{ id: 'ollama', name: 'Ollama', status: runtimeStatus as 'Running', version: null, installationType: 'Local runtime', location: 'C:\\Users\\test\\.ollama', operationalStatus: runtimeStatus, evidence: [] }],
    models: [model], warnings: [], sources: [] }
}

test('low-memory integrated graphics does not confuse shared memory for VRAM', () => {
  assert.equal(evaluateModelFit(model, hardware(null, 8), discovery()).status, 'Not Recommended')
})
test('8 GiB dedicated VRAM requires trade-offs when the model does not fit the headroom budget', () => {
  assert.equal(evaluateModelFit(model, hardware(8, 32), discovery()).status, 'Usable with Trade-offs')
})
test('12 GiB VRAM is conservative about a 14B Q4 model and high context', () => {
  const fit = evaluateModelFit(model, hardware(12, 32), discovery())
  assert.equal(fit.status, 'Usable with Trade-offs')
  assert.match(fit.explanation, /KV-cache|context/i)
})
test('16 GiB VRAM clears the conservative weight-file threshold for this model', () => {
  assert.equal(evaluateModelFit(model, hardware(16, 32), discovery()).status, 'Recommended')
})
test('24 GiB VRAM recommends 14B model and treats the larger coder as trade-off fit', () => {
  assert.equal(evaluateModelFit(model, hardware(24, 64), discovery()).status, 'Recommended')
  const large = { ...model, id: 'qwen3-coder', name: 'qwen3-coder:30b-a3b-q4_K_M', family: 'qwen3moe', sizeBytes: 18_556_700_761, parameterCount: 30_532_122_624, contextLength: 262_144 }
  assert.equal(evaluateModelFit(large, hardware(24, 64), discovery()).status, 'Usable with Trade-offs')
})
test('CPU-only inference is labeled trade-off and never predicts speed', () => {
  const fit = evaluateModelFit(model, hardware(null, 32), discovery())
  assert.equal(fit.status, 'Usable with Trade-offs')
  assert.match(fit.explanation, /CPU-only/i)
  assert.match(fit.caveats.join(' '), /No tokens-per-second/)
})
test('insufficient RAM, unavailable runtime, unknown family, and ComfyUI component remain honest', () => {
  assert.equal(evaluateModelFit(model, hardware(8, 8), discovery()).status, 'Not Recommended')
  assert.equal(evaluateModelFit(model, hardware(24, 64), { ...discovery(), runtimes: [] }).status, 'Unknown')
  assert.equal(evaluateModelFit({ ...model, family: 'unknown', name: 'mystery' }, hardware(24, 64), discovery()).status, 'Unknown')
  assert.equal(evaluateModelFit({ ...model, runtime: 'ComfyUI', name: 'checkpoint.safetensors', family: null }, hardware(24, 64), discovery()).status, 'Unknown')
})
test('unknown quantization can use real file footprint but stays an explicit caveat', () => {
  const fit = evaluateModelFit({ ...model, quantization: null }, hardware(12, 32), discovery())
  assert.match(fit.caveats.join(' '), /Quantization is unknown/)
})
test('task recommendations put only source-supported installed candidates in the result', () => {
  const results = modelsForTask('programming', [model], hardware(16, 32), discovery())
  assert.deepEqual(results.map(item => item.model.id), [model.id])
})
test('catalog alternatives are clearly separate and compare approximate download size to the runtime drive', () => {
  const candidates = availableCatalogForTask('programming', [model], discovery())
  assert.ok(candidates.some(entry => entry.id === 'qwen2.5-coder-7b'))
  const text = catalogStorageFit(candidates.find(entry => entry.id === 'qwen2.5-coder-7b')!, [model], hardware(12, 32))
  assert.match(text, /Storage check/)
  assert.match(text, /C:/)
  assert.equal(evaluateCatalogFit(candidates.find(entry => entry.id === 'qwen2.5-coder-7b')!, hardware(12, 32), discovery()).status, 'Recommended')
  assert.equal(evaluateCatalogFit(candidates.find(entry => entry.id === 'qwen2.5-coder-7b')!, hardware(null, 8), discovery()).status, 'Usable with Trade-offs')
  assert.equal(availableCatalogForTask('programming', [model], { ...discovery(), runtimes: [] }).length, 0)
})
