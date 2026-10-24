import type { HardwareScanResult } from './hardwareScan'
import type { DiscoveryResult, ModelFinding } from './softwareDiscovery'

export type FitStatus = 'Recommended' | 'Usable with Trade-offs' | 'Not Recommended' | 'Unknown'
export type TaskId = 'programming' | 'general-chat' | 'complex-reasoning' | 'long-documents' | 'marketing' | 'image-generation'

export interface RecommendationTask { id: TaskId; label: string; description: string }
export interface ModelCatalogEntry {
  id: string; family: string; match: (model: ModelFinding) => boolean
  capabilities: TaskId[]; parameterCount: number | null; quantizations: string[]
  runtime: string[]; approximateDownloadSize: string | null; approximateDownloadBytes: number | null; approximateContextLength: number | null; source: string; verifiedAt: string
  capabilityNote: string
}
export interface ModelFit { status: FitStatus; explanation: string; weightFootprintBytes: number | null; catalog: ModelCatalogEntry | null; caveats: string[] }
export interface TaskModelResult { model: ModelFinding; fit: ModelFit; explanation: string }

export const recommendationTasks: RecommendationTask[] = [
  { id: 'programming', label: 'Programming & debugging', description: 'Code generation, repair, and agent-oriented work.' },
  { id: 'general-chat', label: 'General AI chat', description: 'Writing, everyday questions, and explanation.' },
  { id: 'complex-reasoning', label: 'Complex reasoning', description: 'Multi-step analysis and planning.' },
  { id: 'long-documents', label: 'Books & long documents', description: 'Long-context drafting and document analysis.' },
  { id: 'marketing', label: 'Marketing & content', description: 'Drafting, editing, and content ideas.' },
  { id: 'image-generation', label: 'Image & creative generation', description: 'Creative generation and multimodal workflows.' },
]

// Exact families and task claims below are linked to their catalog sources. This is a small,
// versioned data file; no general intelligence scores or benchmark speed claims are stored.
export const MODEL_CATALOG_VERSION = '2026.10.20.1'
export const modelCatalog: ModelCatalogEntry[] = [
  { id: 'qwen2.5-coder', family: 'qwen2', match: m => /qwen2\.5-coder/i.test(m.name), capabilities: ['programming', 'general-chat'], parameterCount: 14_800_000_000, quantizations: ['Q4_K_M'], runtime: ['Ollama'], approximateDownloadSize: null, approximateDownloadBytes: null, approximateContextLength: 32768, source: 'https://ollama.com/library/qwen2.5-coder', verifiedAt: '2026-10-20', capabilityNote: 'Code-specific family; catalog documents code generation, reasoning, and fixing.' },
  { id: 'qwen3-coder', family: 'qwen3moe', match: m => /qwen3-coder/i.test(m.name), capabilities: ['programming', 'general-chat'], parameterCount: 30_500_000_000, quantizations: ['Q4_K_M'], runtime: ['Ollama'], approximateDownloadSize: null, approximateDownloadBytes: null, approximateContextLength: 262144, source: 'https://ollama.com/library/qwen3-coder', verifiedAt: '2026-10-20', capabilityNote: 'Coding and agentic tasks; this variant has 30B total parameters, 3.3B active, and a 256K advertised context.' },
  { id: 'qwen3', family: 'qwen3', match: m => /^qwen3(?::|$)/i.test(m.name), capabilities: ['general-chat', 'complex-reasoning', 'long-documents', 'marketing'], parameterCount: 14_800_000_000, quantizations: ['Q4_K_M'], runtime: ['Ollama'], approximateDownloadSize: null, approximateDownloadBytes: null, approximateContextLength: 40960, source: 'https://ollama.com/library/qwen3', verifiedAt: '2026-10-20', capabilityNote: 'Ollama reports thinking and tools; the installed 14B record advertises a 40K context window.' },
  { id: 'gpt-oss', family: 'gptoss', match: m => /gptoss/i.test(m.family || '') || /gpt-oss/i.test(m.name), capabilities: ['general-chat', 'complex-reasoning', 'programming', 'marketing'], parameterCount: 20_900_000_000, quantizations: ['MXFP4'], runtime: ['Ollama'], approximateDownloadSize: null, approximateDownloadBytes: null, approximateContextLength: 131072, source: 'https://ollama.com/library/gpt-oss', verifiedAt: '2026-10-20', capabilityNote: 'Base family supports reasoning, agentic tasks, and developer use cases. A community-named fine-tune is not independently quality-tested.' },
  { id: 'qwen2.5-coder-7b', family: 'qwen2', match: m => /qwen2\.5-coder:7b(?:$|[-_])/i.test(m.name), capabilities: ['programming', 'general-chat'], parameterCount: 7_620_000_000, quantizations: ['Q4_K_M'], runtime: ['Ollama'], approximateDownloadSize: 'about 4.7 GB in Ollama library', approximateDownloadBytes: 4_700_000_000, approximateContextLength: 32768, source: 'https://ollama.com/library/qwen2.5-coder', verifiedAt: '2026-10-20', capabilityNote: 'Catalog entry for a future option; no download action is available.' },
  { id: 'qwen3-8b', family: 'qwen3', match: m => /^qwen3:8b(?:$|[-_])/i.test(m.name), capabilities: ['general-chat', 'complex-reasoning', 'long-documents', 'marketing'], parameterCount: 8_190_000_000, quantizations: ['Q4_K_M'], runtime: ['Ollama'], approximateDownloadSize: 'about 5.2 GB in Ollama library', approximateDownloadBytes: 5_200_000_000, approximateContextLength: 40960, source: 'https://ollama.com/library/qwen3', verifiedAt: '2026-10-20', capabilityNote: 'Catalog entry for a future option; no download action is available.' },
]

export function catalogEntryFor(model: ModelFinding): ModelCatalogEntry | null {
  return modelCatalog.find(entry => entry.match(model)) || null
}

export function evaluateModelFit(model: ModelFinding, hardware: HardwareScanResult | null, discovery: DiscoveryResult | null): ModelFit {
  const catalog = catalogEntryFor(model)
  const footprint = model.sizeBytes
  const unknown = (explanation: string): ModelFit => ({ status: 'Unknown', explanation, weightFootprintBytes: footprint, catalog, caveats: [] })
  if (model.status !== 'Installed' && model.status !== 'Running') return unknown('This record is not a confirmed installed model.')
  if (!catalog) return unknown(model.runtime === 'ComfyUI' ? 'This is a ComfyUI asset. Its workflow, architecture, and companion components are not enough to estimate a standalone model fit.' : 'No verified family metadata is available for a hardware-fit estimate.')
  if (!footprint || !hardware?.memory?.installedBytes) return unknown('A verified model file size and installed RAM are required for a cautious fit estimate.')
  const runtime = discovery?.runtimes.find(item => item.name.toLowerCase() === model.runtime.toLowerCase())
  if (!runtime || !['Installed', 'Running'].includes(runtime.status)) return unknown(`${model.runtime} runtime was not verified as installed.`)
  const gpus = (hardware.gpus || []).map(gpu => gpu.dedicatedVideoMemoryBytes).filter((bytes): bytes is number => bytes != null && bytes > 0)
  const largestVram = gpus.length ? Math.max(...gpus) : null
  const ram = hardware.memory.installedBytes
  const ramHeadroomBudget = ram * 0.65
  const contextCaveat = model.contextLength ? ` The advertised ${model.contextLength.toLocaleString()}-token maximum can increase KV-cache use substantially; this estimate assumes a modest context.` : ' Context-window metadata is unavailable, so additional KV-cache use is unknown.'
  const caveats = ['File footprint is not inference memory. Runtime workspace, KV cache, and other GPU use are not measured.', 'No tokens-per-second or generation benchmark is performed.', ...(!model.quantization || model.quantization === 'Unknown' ? ['Quantization is unknown; the file footprint remains the only weight-size evidence.'] : [])]
  if (largestVram != null) {
    const vramHeadroomBudget = largestVram * 0.65
    if (footprint <= vramHeadroomBudget) return { status: 'Recommended', explanation: `The detected model file is ${formatGiB(footprint)}; it is below the conservative 65% dedicated-VRAM planning threshold for this ${formatGiB(largestVram)} GPU. This suggests room for runtime overhead, but does not guarantee full residency or speed.${contextCaveat}`, weightFootprintBytes: footprint, catalog, caveats }
    if (footprint <= largestVram * 0.9) return { status: 'Usable with Trade-offs', explanation: `The ${formatGiB(footprint)} model file is close to this GPU's ${formatGiB(largestVram)} dedicated-VRAM capacity. Runtime overhead and context cache may require reduced context or partial CPU offloading.${contextCaveat}`, weightFootprintBytes: footprint, catalog, caveats }
    if (footprint <= ramHeadroomBudget) return { status: 'Usable with Trade-offs', explanation: `The ${formatGiB(footprint)} model file exceeds dedicated VRAM (${formatGiB(largestVram)}). With ${formatGiB(ram)} installed RAM, CPU offloading may be possible, but likely reduces responsiveness and leaves less memory for long contexts.${contextCaveat}`, weightFootprintBytes: footprint, catalog, caveats }
    return { status: 'Not Recommended', explanation: `The ${formatGiB(footprint)} model file exceeds both the conservative GPU planning budget and the RAM headroom budget (${formatGiB(ramHeadroomBudget)}). The scanner cannot verify enough usable memory for a practical run.${contextCaveat}`, weightFootprintBytes: footprint, catalog, caveats }
  }
  if (footprint <= ramHeadroomBudget) return { status: 'Usable with Trade-offs', explanation: `No dedicated GPU memory was verified. The model file is ${formatGiB(footprint)} and below the conservative RAM headroom budget (${formatGiB(ramHeadroomBudget)} of ${formatGiB(ram)} installed). CPU-only inference may be slow; no speed is measured.${contextCaveat}`, weightFootprintBytes: footprint, catalog, caveats }
  return { status: 'Not Recommended', explanation: `No dedicated GPU memory was verified, and the ${formatGiB(footprint)} model file exceeds the conservative RAM headroom budget (${formatGiB(ramHeadroomBudget)}).${contextCaveat}`, weightFootprintBytes: footprint, catalog, caveats }
}

export function modelsForTask(task: TaskId, models: ModelFinding[], hardware: HardwareScanResult | null, discovery: DiscoveryResult | null): TaskModelResult[] {
  return models.filter(model => catalogEntryFor(model)?.capabilities.includes(task))
    .map(model => {
      const fit = evaluateModelFit(model, hardware, discovery)
      const explanation = task === 'programming' && model.family?.toLowerCase() === 'gptoss'
        ? 'General developer use is documented for the base family; this community-named coder fine-tune has no independent coding-quality evidence.'
        : catalogEntryFor(model)?.capabilityNote || 'Task capability is not verified.'
      return { model, fit, explanation }
    })
    .sort((a, b) => statusRank(a.fit.status) - statusRank(b.fit.status))
}

export function availableCatalogForTask(task: TaskId, models: ModelFinding[], discovery: DiscoveryResult | null): ModelCatalogEntry[] {
  const ollama = discovery?.runtimes.some(runtime => runtime.name.toLowerCase() === 'ollama' && ['Installed', 'Running'].includes(runtime.status))
  if (!ollama) return []
  return modelCatalog.filter(entry => entry.capabilities.includes(task) && entry.approximateDownloadSize && !models.some(model => entry.match(model)))
}

/** Scores a catalog record as an option without representing it as installed inventory. */
export function evaluateCatalogFit(entry: ModelCatalogEntry, hardware: HardwareScanResult | null, discovery: DiscoveryResult | null): ModelFit {
  const footprint = entry.approximateDownloadBytes
  const unknown = (explanation: string): ModelFit => ({ status: 'Unknown', explanation, weightFootprintBytes: footprint, catalog: entry, caveats: ['This is a catalog estimate, not a detected installation.'] })
  if (!footprint || !hardware?.memory?.installedBytes) return unknown('Catalog weight size or installed RAM is unavailable, so hardware fit cannot be estimated.')
  const runtime = discovery?.runtimes.find(item => item.name.toLowerCase() === 'ollama')
  if (!runtime || !['Installed', 'Running'].includes(runtime.status)) return unknown('Ollama was not verified as installed for this catalog option.')
  const largestVram = Math.max(0, ...(hardware.gpus || []).map(gpu => gpu.dedicatedVideoMemoryBytes || 0)) || null
  const ram = hardware.memory.installedBytes
  const ramBudget = ram * 0.65
  const context = entry.approximateContextLength ? ` The catalog advertises up to ${entry.approximateContextLength.toLocaleString()} tokens; long contexts increase KV-cache use.` : ' Catalog context metadata is unknown.'
  const caveats = ['Catalog download size is an approximate weight-file footprint, not inference memory.', 'No speed, free VRAM, or runtime placement is measured.']
  if (largestVram != null) {
    if (footprint <= largestVram * 0.65) return { status: 'Recommended', explanation: `The catalog lists about ${formatGiB(footprint)} of model files, below 65% of ${formatGiB(largestVram)} dedicated VRAM. This leaves planning headroom, but does not guarantee full residency.${context}`, weightFootprintBytes: footprint, catalog: entry, caveats }
    if (footprint <= largestVram * 0.9) return { status: 'Usable with Trade-offs', explanation: `The catalog footprint is close to dedicated VRAM and leaves less room for runtime workspace and context cache.${context}`, weightFootprintBytes: footprint, catalog: entry, caveats }
    if (footprint <= ramBudget) return { status: 'Usable with Trade-offs', explanation: `The catalog footprint exceeds dedicated VRAM; CPU offloading may be needed, with likely responsiveness and context trade-offs.${context}`, weightFootprintBytes: footprint, catalog: entry, caveats }
    return { status: 'Not Recommended', explanation: `The approximate model-file footprint exceeds the conservative GPU and RAM headroom budgets on this scan.${context}`, weightFootprintBytes: footprint, catalog: entry, caveats }
  }
  if (footprint <= ramBudget) return { status: 'Usable with Trade-offs', explanation: `No dedicated VRAM was verified. The catalog footprint fits the conservative RAM headroom budget, but CPU-only use may be slow.${context}`, weightFootprintBytes: footprint, catalog: entry, caveats }
  return { status: 'Not Recommended', explanation: `No dedicated VRAM was verified and the catalog footprint exceeds the conservative RAM headroom budget.${context}`, weightFootprintBytes: footprint, catalog: entry, caveats }
}

export function catalogStorageFit(entry: ModelCatalogEntry, models: ModelFinding[], hardware: HardwareScanResult | null): string {
  if (!entry.approximateDownloadBytes) return 'Download size unknown'
  const store = models.find(model => model.runtime.toLowerCase() === 'ollama' && model.location)?.location
  const drive = store?.match(/^([a-z]:)/i)?.[1]?.toUpperCase()
  const free = hardware?.drives.find(item => item.drive.toUpperCase() === drive)?.availableBytes
  if (free == null) return 'Free space unknown for Ollama model storage'
  return free >= entry.approximateDownloadBytes ? `Storage check: about ${formatGiB(entry.approximateDownloadBytes)} listed; ${formatGiB(free)} free on ${drive}` : `Storage may be insufficient: about ${formatGiB(entry.approximateDownloadBytes)} listed; ${formatGiB(free)} free on ${drive}`
}

export function formatGiB(bytes: number): string { return `${(bytes / (1024 ** 3)).toFixed(1)} GiB` }
function statusRank(value: FitStatus): number { return value === 'Recommended' ? 0 : value === 'Usable with Trade-offs' ? 1 : value === 'Unknown' ? 2 : 3 }
