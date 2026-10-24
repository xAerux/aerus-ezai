import { useState } from 'react'
import { ArrowRight, Box, ChevronRight, Cpu, PanelRight, Search } from 'lucide-react'
import { formatBytes, formatTimestamp } from './hardwareScan'
import ModelDownloads from './ModelDownloads'
import type { HardwareScanResult } from './hardwareScan'
import type { DiscoveryState, ModelFinding } from './softwareDiscovery'
import { availableCatalogForTask, catalogStorageFit, evaluateCatalogFit, evaluateModelFit, formatGiB, modelsForTask, recommendationTasks } from './modelRecommendations'
import type { TaskId } from './modelRecommendations'

interface Props {
  discovery: DiscoveryState
  hardware: HardwareScanResult | null
  hardwareCached?: boolean
  customFolders: string[]
  onCustomFoldersChange: (folders: string[]) => void
  onScan: () => void
  scanning: boolean
  onLearn: (family: string) => void
}

export default function Models({ discovery, hardware, hardwareCached, customFolders, onCustomFoldersChange, onScan, scanning, onLearn }: Props) {
  const models = discovery.result?.models || []
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('ez-ai-selected-model-id') || '')
  const [query, setQuery] = useState('')
  const [folderDraft, setFolderDraft] = useState('')
  const [folderMessage, setFolderMessage] = useState('')
  const [category, setCategory] = useState(() => { const saved = localStorage.getItem('ez-ai-model-category-v1') || 'All'; return saved === 'Uncategorized' ? 'Unclassified' : saved })
  const [task, setTask] = useState<TaskId>(() => {
    const saved = localStorage.getItem('ez-ai-model-task-v1')
    return recommendationTasks.some(item => item.id === saved) ? saved as TaskId : 'programming'
  })
  const categories = ['All', 'Coding Models', 'Chat & Reasoning', 'Creative & Multimodal', 'Unclassified']
  const isUnclassified = (model: ModelFinding) => !(model.categories?.length)
  const visible = models.filter(model => `${model.name} ${model.runtime} ${model.family || ''} ${model.format || ''}`.toLowerCase().includes(query.toLowerCase()) && (category === 'All' || (category === 'Unclassified' ? isUnclassified(model) : model.categories?.includes(category))))
  const selected = visible.find(model => model.id === selectedModel) || visible.find(model => model.id === localStorage.getItem('ez-ai-selected-model-id')) || visible[0] || null
  const selectedFit = selected ? evaluateModelFit(selected, hardware, discovery.result) : null
  const taskModels = modelsForTask(task, models, hardware, discovery.result)
  const downloadOptions = availableCatalogForTask(task, models, discovery.result)
  const chooseCategory = (value: string) => { setCategory(value); localStorage.setItem('ez-ai-model-category-v1', value) }
  const chooseTask = (value: TaskId) => { setTask(value); localStorage.setItem('ez-ai-model-task-v1', value) }
  const selectModel = (model: ModelFinding) => { setSelectedModel(model.id); localStorage.setItem('ez-ai-selected-model-id', model.id) }
  const addFolder = () => {
    const path = folderDraft.trim()
    if (!/^[a-z]:\\/i.test(path)) { setFolderMessage('Enter an absolute local Windows folder path, for example D:\\AI\\Models.'); return }
    if (customFolders.some(existing => existing.toLowerCase() === path.toLowerCase())) { setFolderMessage('That folder is already saved.'); return }
    if (customFolders.length >= 8) { setFolderMessage('Up to eight custom folders can be saved.'); return }
    onCustomFoldersChange([...customFolders, path]); setFolderDraft(''); setFolderMessage('Saved on this device. Run a scan to inspect this folder.')
  }
  const modelStatus = discovery.result ? `${discovery.cached ? 'Cached' : 'Scanned'} ${models.length} verified model record${models.length === 1 ? '' : 's'} · ${formatTimestamp(discovery.result.scannedAtUtc)} · ${(discovery.result.durationMs / 1000).toFixed(1)}s` : 'Run Scan My Computer to inspect recognized model locations.'

  return <>
    <PageIntro number="03" title="My Models" subtitle="Installed models first, with task-based guidance from your verified hardware scan." icon={PanelRight}/>
    <div className="state-strip"><span className={`status-led ${discovery.result && !discovery.cached ? '' : 'muted'}`}/>{discovery.phase === 'error' ? discovery.message : discovery.phase === 'scanning' ? discovery.message : modelStatus}<span>Inventory is read-only · downloads require review and approval.</span></div>
    <DiscoveryNotes state={discovery}/>
    <div className="model-inventory-note framed-panel"><b>What is already on this PC?</b><span>{discovery.result ? `${models.filter(model=>model.status==='Installed'||model.status==='Running').length} detected model records and files are listed below, including Ollama tags and ComfyUI assets.` : 'Scan My Computer reads recognized local runtime inventories and model folders. Nothing is downloaded or changed.'} Catalog suggestions are separate and clearly marked <em>not installed</em>. Ollama coding models are also available in the Local Coding selectors.</span></div>
    <section className="task-recommendations framed-panel">
      <div className="task-rec-heading"><div><span className="eyebrow">LOCAL MODEL ADVISOR / CATALOG v2026.10.20.1</span><h2>Find a model for a task</h2><small>{hardware ? `Hardware input: ${hardware.gpus?.find(gpu => gpu.dedicatedVideoMemoryBytes)?.model || 'No dedicated GPU memory'} · ${hardware.memory.installedBytes ? `${formatGiB(hardware.memory.installedBytes)} RAM` : 'RAM unavailable'}. ${hardwareCached ? 'Cached' : 'Fresh scan'} data.` : 'Run Scan My Computer to enable hardware-aware fit estimates.'}</small></div><label className="task-select-label">TASK<select aria-label="Recommendation task" value={task} onChange={event => chooseTask(event.target.value as TaskId)}>{recommendationTasks.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>
      <p className="task-summary">{taskModels.length ? <>Installed candidates: {taskModels.map(item => item.model.name).join(', ')}. Compare hardware fit and limitations below.</> : 'No detected installed model has verified metadata for this task.'} {task === 'image-generation' ? 'ComfyUI assets remain Unknown until architecture and workflow requirements are verified.' : ''}</p>
      {taskModels.length > 0 && <div className="task-model-list">{taskModels.map(({ model, fit, explanation }) => <button type="button" className="task-model-row" key={model.id} onClick={() => selectModel(model)}><span><b>{model.name}</b><small>{model.runtime} · {model.quantization || 'quantization unknown'} · {formatBytes(model.sizeBytes)}</small><em>{explanation}</em></span><strong className={`fit-pill fit-${fit.status.toLowerCase().replaceAll(' ', '-')}`}>{fit.status}</strong></button>)}</div>}
      {downloadOptions.length > 0 && <details className="download-catalog"><summary>Other catalog options · available to consider, not installed</summary><div>{downloadOptions.map(entry => { const fit = evaluateCatalogFit(entry, hardware, discovery.result); return <article key={entry.id}><b>{entry.id}</b><strong className={`fit-pill fit-${fit.status.toLowerCase().replaceAll(' ', '-')}`}>{fit.status} · not installed</strong><small>About {((entry.parameterCount || 0) / 1e9).toFixed(2)}B · {entry.quantizations.join(', ')} · {entry.approximateDownloadSize}</small><small>{catalogStorageFit(entry, models, hardware)}</small><p>{fit.explanation} {entry.capabilityNote} Review supported downloads in Model catalog; availability depends on the exact runtime and artifact. Source: {entry.source}</p></article> })}</div></details>}
      <p className="fit-disclaimer">Estimates compare verified model-file footprint with installed memory capacity. File size is not inference memory; available VRAM, runtime overhead, KV cache, and workload are not measured. No speed is predicted.</p>
    </section>
    <ModelDownloads discovery={discovery.result} hardware={hardware} onScan={onScan} scanning={scanning} onLearn={onLearn}/>
    <div className="model-layout">
      <section className="model-list framed-panel">
        <div className="subhead"><div><b>LOCAL MODEL LIBRARY</b><small>{visible.length} of {models.length} detected models · installed first</small></div><label className="model-search"><Search size={14}/><input aria-label="Search models" placeholder="Search models" value={query} onChange={event => setQuery(event.target.value)}/></label></div>
        <div className="model-filters" aria-label="Model categories">{categories.map(value => <button type="button" key={value} aria-pressed={category === value} className={category === value ? 'active' : ''} onClick={() => chooseCategory(value)}>{value}{value !== 'All' && <small>{models.filter(model => value === 'Unclassified' ? isUnclassified(model) : model.categories?.includes(value)).length}</small>}</button>)}</div>
        <details className="custom-folder-panel"><summary>Add a user-approved scan folder</summary><div><label htmlFor="custom-model-folder">Local Windows folder path</label><div className="custom-folder-entry"><input id="custom-model-folder" value={folderDraft} onChange={event => setFolderDraft(event.target.value)} placeholder="D:\\AI\\Models"/><button type="button" className="btn btn-outline" onClick={addFolder}>Add folder</button><button type="button" className="btn btn-cyan" onClick={onScan} disabled={scanning}>{scanning ? 'Scanning' : 'Scan now'}</button></div><small>{folderMessage || 'After you add this folder, EZ AI checks it for recognized AI application files and model formats. It is saved locally and never uploaded.'}</small>{customFolders.map(path => <div className="custom-folder-row" key={path}><span title={path}>{path}</span><button type="button" className="text-link" onClick={() => { onCustomFoldersChange(customFolders.filter(item => item !== path)); setFolderMessage('Folder removed from EZ AI’s saved scan locations. No files were changed.') }}>Remove</button></div>)}</div></details>
        {visible.length === 0 && <p className="model-empty">{discovery.result ? 'No locally detected models match this filter.' : 'No scan results yet. Start a read-only scan to populate your library.'}</p>}
        {visible.map(model => { const fit = evaluateModelFit(model, hardware, discovery.result); return <button className={`model-row ${model.id === selected?.id ? 'model-selected' : ''}`} key={model.id} onClick={() => selectModel(model)} aria-pressed={model.id === selected?.id}><span className="model-box"><Box size={17}/></span><span className="model-copy"><b>{model.name}{model.aliases?.length ? ` · ${model.aliases.length} aliases` : ''}</b><span>{model.runtime}{model.family ? ` · ${model.family}` : ''}{model.quantization && model.quantization !== 'Unknown' ? ` · ${model.quantization}` : ''}</span></span><span className="model-status">{fit.status}<small>{model.sizeBytes == null ? 'Size unknown' : formatBytes(model.sizeBytes)}</small></span><ChevronRight size={15}/></button> })}
      </section>
      <section className="model-detail framed-panel">{selected && selectedFit ? <><span className="eyebrow">MODEL PROFILE / DETECTED</span><div className="model-hero"><div className="model-emblem"><Box size={28}/></div><div><h2>{selected.name}</h2><p>{selected.runtime}{selected.family ? ` · ${selected.family}` : ''}</p><button className="text-link model-learn-link" type="button" onClick={()=>onLearn(selected.family||selected.name)}>Learn about this model family <ArrowRight size={12}/></button></div></div><div className="compatibility"><h3><Cpu size={16}/> Hardware fit</h3><p className={`fit-status fit-${selectedFit.status.toLowerCase().replaceAll(' ', '-')}`}>{selectedFit.status}</p><p>{selectedFit.explanation}</p><div className="compat-row"><span>Installation</span><b>{selected.status} · {selected.runtime}</b></div><div className="compat-row"><span>Model file</span><b>{selected.sizeBytes == null ? 'Unknown' : formatBytes(selected.sizeBytes)} · {selected.format || 'format unknown'}</b></div><div className="compat-row"><span>Parameters</span><b>{selected.parameterCount ? `${(selected.parameterCount / 1e9).toFixed(1)}B · runtime metadata` : selectedFit.catalog?.parameterCount ? `About ${(selectedFit.catalog.parameterCount / 1e9).toFixed(1)}B · catalog` : 'Unknown'}</b></div><div className="compat-row"><span>Quantization</span><b>{selected.quantization || 'Unknown'}</b></div><div className="compat-row"><span>Context window</span><b>{selected.contextLength ? `${selected.contextLength.toLocaleString()} tokens · runtime metadata` : selectedFit.catalog?.approximateContextLength ? `About ${selectedFit.catalog.approximateContextLength.toLocaleString()} tokens · catalog` : 'Unknown'}</b></div><div className="compat-row"><span>Recommended tasks</span><b>{selectedFit.catalog?.capabilities.map(id => recommendationTasks.find(item => item.id === id)?.label).filter(Boolean).join(' · ') || 'Unclassified'}</b></div><div className="compat-row"><span>Category</span><b>{selected.categories?.join(', ') || 'Unclassified'}</b></div><div className="compat-row"><span>Location</span><b className="model-path" title={selected.location || ''}>{selected.location || 'Unknown'}</b></div><div className="fit-limitations"><b>Known limitations</b><span>{selected.runtime === 'ComfyUI' ? 'ComfyUI asset, not treated as a standalone model; workflow and companion components determine memory fit.' : `${selected.capabilities || 'Capabilities unavailable'}. ${selectedFit.caveats.join(' ')}`}</span></div>{selectedFit.catalog && <div className="catalog-source">Catalog {selectedFit.catalog.id} · verified {selectedFit.catalog.verifiedAt}<br/>{selectedFit.catalog.source}</div>}{(selected.aliases || []).length > 0 && <div className="compat-row"><span>Aliases</span><b>{(selected.aliases || []).join(', ')}</b></div>}</div><details className="detection-evidence"><summary>Discovery evidence</summary><ul>{selected.evidence.map((line, index) => <li key={index}>{line}</li>)}</ul></details></> : <div className="model-empty detail-empty">{discovery.result ? 'No detected model selected.' : 'Model details will appear after a discovery scan.'}</div>}<div className="model-controls"><span className="integration-note">Approved Ollama downloads are managed in the catalog above. Deletion and model updates remain unavailable. A ComfyUI asset is not proof of workflow readiness.</span></div></section>
    </div>
  </>
}

function PageIntro({number,title,subtitle,icon:Icon}: {number:string;title:string;subtitle:string;icon:typeof PanelRight}) {return <div className="page-intro framed-panel"><span className="intro-icon"><Icon size={23}/></span><div><span className="eyebrow">EZ AI / {number}</span><h1>{title}</h1><p>{subtitle}</p></div><span className="intro-right">LOCAL FIRST<br/><b>LOCAL MODE</b></span></div>}
function DiscoveryNotes({state}:{state:DiscoveryState}) {const notes=state.result?.warnings||[];return notes.length?<details className="scan-warnings discovery-notes"><summary>{notes.length} AI discovery note{notes.length===1?'':'s'} · some results may need verification</summary><ul>{notes.map((note,index)=><li key={index}>{note}</li>)}</ul></details>:null}
