import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowRight, BookOpen, Box, Check, ChevronDown, ChevronRight, Code2, Cpu, FileText, FolderOpen, HardDrive, Lightbulb, MessageCircle, Monitor, PanelRight, RefreshCw, Settings, ShieldCheck, Sparkles, Terminal, Wrench } from 'lucide-react'
import { formatBytes, formatTimestamp, loadHardwareScan, requestHardwareScan, saveHardwareScan } from './hardwareScan'
import type { HardwareScanState } from './hardwareScan'
import { loadDiscovery, requestDiscovery, saveDiscovery } from './softwareDiscovery'
import { requestApplicationLaunch,verifyExistingApplication } from './appActions'
import { installerAction, installerCatalog, ollamaDesktopStatus } from './installerCatalog'
import type { InstallerProduct } from './installerCatalog'
import { cancelInstallerDownload, executeInstaller, requestInstallerJobs, startInstallerDownload, verifyInstaller } from './installerEngine'
import type { InstallerJob } from './installerEngine'
import type { DiscoveryState } from './softwareDiscovery'
import { countExistingAppData, exportAppData, parseAppData, restoreAppData } from './storageMigration'
import Models from './Models'
import KnowledgeCenter from './KnowledgeCenter'
import ComfyUiBrand from './ComfyUiBrand'
import ValueAdvisor from './ValueAdvisor'
import ProductBrand from './ProductBrand'
import AerusToolsShowcase, { HomeAerusShelf } from './AerusToolsShowcase'
import type { CrunchGuide } from './AerusCrunchGuides'
import BuildIdentityPanel from './BuildIdentityPanel'
import { EZ_AI_VERSION } from './releaseInfo'

type Tab = 'HOME' | 'AI INSTALLERS' | 'MY MODELS' | 'PRICING' | 'KNOWLEDGE' | 'AERUS TOOLS'
type IconType = typeof Activity
const isTab = (value: string | null): value is Tab => value === 'HOME' || value === 'AI INSTALLERS' || value === 'MY MODELS' || value === 'PRICING' || value === 'KNOWLEDGE' || value === 'AERUS TOOLS'
const tabs: { label: Tab; icon: IconType }[] = [
  { label: 'HOME', icon: Activity }, { label: 'AI INSTALLERS', icon: Box },
  { label: 'MY MODELS', icon: PanelRight }, { label: 'PRICING', icon: Sparkles }, { label: 'KNOWLEDGE', icon: BookOpen }, { label: 'AERUS TOOLS', icon: Wrench },
]
const CUSTOM_FOLDERS_KEY = 'ez-ai-custom-model-folders-v1'
type ThemeSettings = { hue: number; saturation: number; brightness: number; contrast: number }
const DEFAULT_THEME: ThemeSettings = { hue: 180, saturation: 82, brightness: 54, contrast: 52 }
function loadTheme(): ThemeSettings {
  try {
    const value = JSON.parse(localStorage.getItem('aerus-theme-v1') || 'null') as Partial<ThemeSettings> | null
    if (!value) return DEFAULT_THEME
    const clamp = (n: unknown, min: number, max: number, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
    return { hue: clamp(value.hue, 0, 359, DEFAULT_THEME.hue), saturation: clamp(value.saturation, 0, 100, DEFAULT_THEME.saturation), brightness: clamp(value.brightness, 0, 100, DEFAULT_THEME.brightness), contrast: clamp(value.contrast, 0, 100, DEFAULT_THEME.contrast) }
  } catch { return DEFAULT_THEME }
}
function loadCustomModelFolders(): string[] {
  try { const value = JSON.parse(localStorage.getItem(CUSTOM_FOLDERS_KEY) || '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : [] } catch { return [] }
}

function App() {
  const [tab, setTab] = useState<Tab>(() => { const saved = localStorage.getItem('aerus-tab'); if(saved==='KNOWLEDGE'&&localStorage.getItem('ez-ai-knowledge-view-v1')==='Value Advisor'){localStorage.setItem('ez-ai-knowledge-view-v1','Learning');return 'PRICING'} return isTab(saved) ? saved : 'HOME' })
  const desktopMode = new URLSearchParams(window.location.search).has('desktop')
  const [compact, setCompact] = useState(() => localStorage.getItem('aerus-compact') === 'true')
  const [toolsCrunch, setToolsCrunch] = useState<CrunchGuide | null>(null)
  const [theme, setTheme] = useState<ThemeSettings>(loadTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dataMessage, setDataMessage] = useState('')
  const importFile = useRef<HTMLInputElement>(null)
  const [selectedInstaller, setSelectedInstaller] = useState(() => localStorage.getItem('ez-ai-installer-focus') || 'ChatGPT')
  const [learnProduct, setLearnProduct] = useState(() => localStorage.getItem('ez-ai-learning-focus') || '')
  const [learnRequest, setLearnRequest] = useState(0)
  const [consumedLearnRequest, setConsumedLearnRequest] = useState(0)
  const [customModelFolders, setCustomModelFolders] = useState<string[]>(loadCustomModelFolders)
  const [hardware, setHardware] = useState<HardwareScanState>(() => {
    const result = loadHardwareScan()
    return { phase: 'idle', result, cached: Boolean(result), message: result ? `Cached · scanned ${formatTimestamp(result.scannedAtUtc)}` : 'Hardware scan not run' }
  })
  const [discovery, setDiscovery] = useState<DiscoveryState>(() => {
    const result = loadDiscovery()
    return { phase: 'idle', result, cached: Boolean(result), message: result ? `Cached inventory · scanned ${formatTimestamp(result.scannedAtUtc)}` : 'AI software and model discovery not run' }
  })
  const scanHardware = async () => {
    setHardware(current => ({ phase: 'scanning', result: current.result, cached: current.cached, message: 'Stage 1 of 2 · reading Windows hardware…' }))
    setDiscovery(current => ({ ...current, phase: 'scanning', message: 'Stage 2 of 2 · checking recognized AI software and model locations…' }))
    try {
      const result = await requestHardwareScan()
      saveHardwareScan(result)
      setHardware({ phase: 'scanning', result, cached: false, message: `${result.status === 'partial' ? 'Partial hardware scan' : 'Hardware scan complete'} · ${formatTimestamp(result.scannedAtUtc)}` })
    } catch (error) {
      setHardware(current => ({ phase: 'error', result: current.result, cached: current.cached, message: error instanceof Error ? error.message : 'Hardware scan failed. Retry when ready.' }))
    }
    try {
      const inventory = await requestDiscovery(customModelFolders)
      saveDiscovery(inventory)
      setDiscovery({ phase: 'idle', result: inventory, cached: false, message: `${inventory.status === 'partial' ? 'Partial inventory' : 'Inventory complete'} · ${formatTimestamp(inventory.scannedAtUtc)}` })
    } catch (error) {
      setDiscovery(current => ({ ...current, phase: 'error', message: error instanceof Error ? error.message : 'AI discovery failed. Retry the scan.' }))
    }
    setHardware(current => current.phase === 'scanning' ? { ...current, phase: 'idle' } : current)
  }
  useEffect(() => localStorage.setItem('ez-ai-installer-focus', selectedInstaller), [selectedInstaller])
  useEffect(() => localStorage.setItem('ez-ai-learning-focus', learnProduct), [learnProduct])
  useEffect(() => localStorage.setItem('aerus-tab', tab), [tab])
  // A Crunch guide requested from Home opens once; leaving Tools clears the request so Tools reopens on its list.
  useEffect(() => { if (tab !== 'AERUS TOOLS') setToolsCrunch(null) }, [tab])
  const openTools = (guide?: CrunchGuide) => { setToolsCrunch(guide ?? null); setTab('AERUS TOOLS') }
  useEffect(() => localStorage.setItem('aerus-compact', String(compact)), [compact])
  useEffect(() => { try { localStorage.setItem('aerus-theme-v1', JSON.stringify(theme)) } catch {} }, [theme])
  const themeSaturation = Math.min(100, theme.saturation * (0.65 + theme.contrast * 0.007))
  const themeAccentLightness = 8 + theme.brightness * 0.84
  const themeStyle = {
    '--cyan': `hsl(${theme.hue} ${themeSaturation}% ${themeAccentLightness}%)`,
    '--cyan-soft': `hsl(${theme.hue} ${Math.min(100, themeSaturation)}% ${12 + theme.brightness * 0.31}%)`,
    '--edge': `hsl(${theme.hue} ${Math.round(themeSaturation * 0.22)}% ${18 + theme.contrast * 0.19}%)`,
    '--theme-hue': `${theme.hue}`,
  } as React.CSSProperties
  const exportData = () => {
    const backup = exportAppData()
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'ez-ai-data-backup.json'
    link.click()
    URL.revokeObjectURL(url)
    setDataMessage(`Exported ${Object.keys(backup.values).length} saved settings and data items.`)
  }
  const importData = async (file?: File) => {
    if (!file) return
    try {
      const backup = parseAppData(await file.text())
      const existing = countExistingAppData()
      if (existing > 0 && !window.confirm(`This EZ AI profile already has ${existing} saved data items. Importing will replace matching items. Export a backup first if you want to keep this profile's current values. Continue?`)) {
        setDataMessage('Import cancelled. Existing data was not changed.')
        return
      }
      const restored = restoreAppData(backup)
      setDataMessage(`Imported ${restored} items. Reloading EZ AI to apply them…`)
      window.setTimeout(() => window.location.reload(), 350)
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : 'Could not read this EZ AI data backup.')
    } finally {
      if (importFile.current) importFile.current.value = ''
    }
  }
  const resetAppData = () => {
    if (!window.confirm('Reset this EZ AI profile? This removes EZ AI saved prompts, preferences, selections, and cached scan results from this Windows user profile. Export a backup first if you want to keep them. This does not change other applications or model files.')) return
    localStorage.clear()
    window.location.reload()
  }
  return <div className={`app-shell ${compact ? 'compact' : ''} ${desktopMode ? 'ez-ai-desktop' : ''}`} style={themeStyle}>
    <header className="topbar">
      <button className="brand" onClick={() => setTab('HOME')} aria-label="EZ AI home">
        <span className="brand-mark"><span>A</span></span><span className="brand-word"><b>EZ <em>AI</em></b><small>LOCAL AI. MADE EASY.</small></span>
      </button>
      <nav className="main-nav" aria-label="Main navigation">{tabs.map(({label, icon: Icon}) => <button key={label} className={`nav-item ${tab === label ? 'active' : ''}`} aria-current={tab === label ? 'page' : undefined} onClick={() => setTab(label)}><Icon size={17}/><span>{label === 'HOME' ? 'Home' : label === 'AI INSTALLERS' ? 'AI Installers' : label === 'MY MODELS' ? 'My Models' : label === 'PRICING' ? 'Pricing' : label === 'AERUS TOOLS' ? 'Tools' : 'Knowledge'}</span></button>)}</nav>
      <div className="header-tagline">LOCAL AI<br/><strong>HIGHER CONTROL</strong><br/>A BRIGHTER TOMORROW</div>
      <div className="settings-control"><button className="icon-button settings-button" type="button" aria-label="Application settings" aria-expanded={settingsOpen} title="Application settings" onClick={() => setSettingsOpen(!settingsOpen)}><Settings size={17}/></button>{settingsOpen&&<div className="settings-popover" role="dialog" aria-label="Application settings"><b>EZ AI SETTINGS</b><button type="button" onClick={() => setCompact(!compact)}><Settings size={14}/>{compact?'Use standard layout':'Use compact layout'}<span>{compact?'ON':'OFF'}</span></button><ThemeControls theme={theme} setTheme={setTheme}/><hr/><BuildIdentityPanel/><hr/><small>Move saved prompts and preferences between the browser preview and desktop app.</small><button type="button" onClick={exportData}><FileText size={14}/> Export app data</button><button type="button" onClick={() => importFile.current?.click()}><FolderOpen size={14}/> Import app data</button><button type="button" onClick={resetAppData}><RefreshCw size={14}/> Reset EZ AI profile</button><input ref={importFile} className="sr-only" type="file" accept="application/json,.json" onChange={event => void importData(event.target.files?.[0])}/>{dataMessage&&<p role="status">{dataMessage}</p>}<small className="settings-storage-note">EZ AI v{EZ_AI_VERSION} · Stored locally in your Windows user profile. Uninstall preserves your settings.</small></div>}</div>
      {!desktopMode && <div className="window-actions" aria-hidden="true"><i/><i/><i/></div>}
    </header>
    <main className={`page-layout ${tab === 'PRICING' || tab === 'KNOWLEDGE' || tab === 'AERUS TOOLS' ? 'wide-workspace' : ''}`}>
      <section className={'main-column ' + (tab === 'AI INSTALLERS' ? 'page-installers' : tab === 'MY MODELS' ? 'page-models' : tab === 'PRICING' ? 'page-pricing' : tab === 'KNOWLEDGE' ? 'page-knowledge' : tab === 'AERUS TOOLS' ? 'page-tools' : 'page-home')} data-page={tab}>{tab === 'HOME' ? <Home onExplore={(name) => { setSelectedInstaller(name); setTab('AI INSTALLERS') }} onLearn={(name) => { setLearnProduct(name); setLearnRequest(value=>value+1); setTab('KNOWLEDGE') }} onScan={scanHardware} scanState={hardware} discovery={discovery} onModels={()=>setTab('MY MODELS')}/> : tab === 'AI INSTALLERS' ? <Installers selectedApplication={selectedInstaller} discovery={discovery} onCoding={(agentId)=>{localStorage.setItem('ez-ai-model-workspace-r01','Local Coding');localStorage.setItem('ez-ai-pending-agent-launch-r01',agentId);setTab('MY MODELS')}} onRescan={scanHardware} onLearn={name=>{setLearnProduct(name);setLearnRequest(value=>value+1);setTab('KNOWLEDGE')}}/> : tab === 'MY MODELS' ? <Models discovery={discovery} hardware={hardware.result} hardwareCached={hardware.cached} customFolders={customModelFolders} onCustomFoldersChange={folders=>{setCustomModelFolders(folders);localStorage.setItem(CUSTOM_FOLDERS_KEY,JSON.stringify(folders))}} onScan={scanHardware} scanning={hardware.phase==='scanning'||discovery.phase==='scanning'} onLearn={name=>{setLearnProduct(name);setLearnRequest(value=>value+1);setTab('KNOWLEDGE')}}/> : tab === 'PRICING' ? <ValueAdvisor onModels={()=>setTab('MY MODELS')} onLearn={name=>{setLearnProduct(name);setLearnRequest(v=>v+1);setTab('KNOWLEDGE')}} models={discovery.result?.models||[]} hardware={hardware.result} discovery={discovery.result}/> : tab === 'AERUS TOOLS' ? <AerusToolsShowcase initialCrunch={toolsCrunch} onPricing={()=>{localStorage.setItem('ez-ai-value-view-v1','Save Money');setTab('PRICING')}}/> : <KnowledgeCenter onModels={()=>setTab('MY MODELS')} onPricing={()=>setTab('PRICING')} key={learnRequest} focusProduct={learnRequest>consumedLearnRequest?learnProduct:''} models={discovery.result?.models||[]} hardware={hardware.result} discovery={discovery.result} onLearn={name=>setLearnProduct(name)} onFocusConsumed={()=>setConsumedLearnRequest(learnRequest)} onBack={()=>setTab('HOME')}/>}</section>
      {tab!=='PRICING'&&tab!=='KNOWLEDGE'&&tab!=='AERUS TOOLS'&&<SystemSidebar scanState={hardware} onRefresh={scanHardware} showTools={tab==='HOME'} onOpenTools={openTools}/>}
    </main>
    <footer className="app-footer"><span><span className="status-led"/> EZ AI <i>•</i> LOCAL SYSTEM</span><span>LOCAL FIRST <i>•</i> LOCAL ACTIONS REQUIRE EXPLICIT APPROVAL</span></footer>
  </div>
}

function ThemeControls({ theme, setTheme }: { theme: ThemeSettings; setTheme: React.Dispatch<React.SetStateAction<ThemeSettings>> }) {
  const updateWheel = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const dx = event.clientX - bounds.left - bounds.width / 2
    const dy = event.clientY - bounds.top - bounds.height / 2
    const radius = Math.min(1, Math.hypot(dx, dy) / (Math.min(bounds.width, bounds.height) / 2))
    const hue = (Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360) + 360) % 360
    setTheme(current => ({ ...current, hue, saturation: Math.round(radius * 100) }))
  }
  const hueRadians = (theme.hue - 90) * Math.PI / 180
  const markerRadius = theme.saturation * 0.43
  return <section className="theme-controls" aria-labelledby="theme-controls-title">
    <div className="theme-controls-heading"><b id="theme-controls-title">Color & contrast</b><button type="button" onClick={() => setTheme(DEFAULT_THEME)}>Reset</button></div>
    <div className="theme-controls-body">
      <div className="theme-wheel" role="slider" tabIndex={0} aria-label="Accent color wheel" aria-valuemin={0} aria-valuemax={359} aria-valuenow={theme.hue} aria-valuetext={`Hue ${theme.hue} degrees, saturation ${theme.saturation} percent`} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); updateWheel(event) }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateWheel(event) }} onKeyDown={event => {
        if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return
        event.preventDefault()
        setTheme(current => event.key === 'ArrowUp' || event.key === 'ArrowDown'
          ? { ...current, saturation: Math.max(0, Math.min(100, current.saturation + (event.key === 'ArrowUp' ? 2 : -2))) }
          : { ...current, hue: (current.hue + (event.key === 'ArrowRight' ? 2 : 358)) % 360 })
      }}>
        <span className="theme-wheel-marker" style={{ left: `${50 + Math.cos(hueRadians) * markerRadius}%`, top: `${50 + Math.sin(hueRadians) * markerRadius}%` }}/>
      </div>
      <div className="theme-slider-stack">
        <label>Saturation <output>{theme.saturation}%</output><input type="range" min="0" max="100" value={theme.saturation} onChange={event => setTheme(current => ({ ...current, saturation: Number(event.target.value) }))}/></label>
        <label>Brightness <output>{theme.brightness}%</output><input type="range" min="0" max="100" value={theme.brightness} onChange={event => setTheme(current => ({ ...current, brightness: Number(event.target.value) }))}/></label>
        <label>Contrast <output>{theme.contrast}%</output><input type="range" min="0" max="100" value={theme.contrast} onChange={event => setTheme(current => ({ ...current, contrast: Number(event.target.value) }))}/></label>
      </div>
    </div>
    <small className="theme-controls-note">Adjust the main accent color. Changes save on this device.</small>
  </section>
}

function SectionTitle({number, title, sub, right}: {number: string; title: string; sub?: string; right?: React.ReactNode}) {
  return <div className="section-heading"><span className="section-index">{number}</span><div className="section-heading-copy"><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{right && <div className="section-right">{right}</div>}</div>
}

function Home({onExplore,onLearn,onScan,onModels,scanState,discovery}: {onExplore: (name:string)=>void; onLearn: (name:string)=>void; onScan:()=>void; onModels:()=>void; scanState:HardwareScanState; discovery:DiscoveryState}) {
  const [prompt, setPrompt] = useState(() => localStorage.getItem('aerus-prompt') || '')
  const [saveMessage, setSaveMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const templates: Record<string, string> = {
    'Plan My Project': 'Act as a thoughtful project planner. Help me turn this idea into a clear, achievable software project.\n\nProject idea: [describe your idea]\n\nPlease provide: goals, a minimal first version, recommended technology, a step-by-step build plan, and the biggest risks. Ask clarifying questions before making assumptions.',
    'Start Coding': 'Act as a patient senior developer and pair-programming partner. First explain the approach in plain language, then help me implement one small step at a time.\n\nWhat I want to build: [describe the feature]\nLanguage or framework: [if known]\n\nShow complete, runnable code for each step and tell me exactly where it belongs. Do not invent project files or claim you ran code you have not run.',
    'Fix Errors': 'Help me diagnose this error carefully. Explain what it means in beginner-friendly language, identify the most likely cause from the evidence, and suggest the smallest safe fix.\n\nError message: [paste the full error]\nWhat I was doing: [describe the action]\nRelevant code or logs: [paste a focused excerpt]\n\nSeparate confirmed facts from guesses. Do not suggest destructive commands.',
    'UI Design': 'You are a product designer and frontend engineer. Help me design a clear, accessible interface for this task.\n\nUser and goal: [who is using it and what they need]\nPlatform: [web / desktop / mobile]\nExisting design constraints: [describe them]\n\nPropose the information hierarchy, key states, responsive behavior, and a compact visual direction. Keep controls understandable and do not hide important actions behind decoration.',
  }
  const products = [
    {name:'ChatGPT', match:'ChatGPT', desc:'Ask questions, write, and work with code.', mark:'◎', color:'white'}, {name:'Claude',match:'Claude Desktop',desc:'Think through ideas, writing, and creative work.',mark:'✳',color:'orange'},
    {name:'Gemini',match:'Gemini',desc:'Explore Google AI for text and multimodal tasks.',mark:'✦',color:'blue'}, {name:'Grok',match:'Grok',desc:'Research topics and explore new ideas.',mark:'◉',color:'white'},
    {name:'Cursor',match:'Cursor',desc:'Build software in an AI-assisted code editor.',mark:'⬡',color:'silver'}, {name:'Ollama',match:'Ollama',desc:'Run language models locally on your PC.',mark:'♧',color:'white'},
  ]
  const setTemplate = (name: string) => { if (!name) { setSelectedTemplate(''); return } setPrompt(templates[name]); setSelectedTemplate(name); localStorage.setItem('aerus-prompt', templates[name]); setSaveMessage(`${name} loaded`) }
  const save = () => { localStorage.setItem('aerus-prompt', prompt); localStorage.setItem('aerus-saved-prompt', prompt); setSaveMessage('Prompt saved on this device') }
  const loadSaved = () => { const saved=localStorage.getItem('aerus-saved-prompt'); if(saved!==null){setPrompt(saved);localStorage.setItem('aerus-prompt',saved);setSaveMessage('Saved prompt loaded')}else setSaveMessage('No saved prompt yet') }
  const copy = async () => { try { await navigator.clipboard.writeText(prompt); setSaveMessage('Copied to clipboard') } catch { setSaveMessage('Clipboard access unavailable in this context') } }
  return <>
    <section className="discovery-panel framed-panel"><div className="discovery-glow"/><SectionTitle number="01" title="System Discovery" sub="Read-only hardware, AI software, coding agent, runtime, and local model inventory." right={<span className="ops-mark">EZ AI OPS <small>SYSTEM INTELLIGENCE • LOCAL • PRIVATE</small></span>}/>
      <div className="discovery-content"><div className="discovery-steps" aria-label="Discovery steps"><div><Cpu/><span><b>Detect Hardware</b><small>CPU, GPU, memory, Windows</small></span></div><i/><div><FileText/><span><b>Find AI Tools</b><small>Apps, coding agents, runtimes</small></span></div><i/><div><Box/><span><b>Find Local Models</b><small>Recognized metadata only</small></span></div></div><div className="scan-wrap"><span>LOCAL DISCOVERY <b>{scanState.phase === 'scanning' || discovery.phase === 'scanning' ? 'ACTIVE' : scanState.phase === 'error' || discovery.phase === 'error' ? 'RETRY' : discovery.result ? discovery.result.status.toUpperCase() : 'STANDBY'}</b></span><button className="btn btn-gold" type="button" onClick={onScan} disabled={scanState.phase === 'scanning' || discovery.phase === 'scanning'} aria-busy={scanState.phase === 'scanning' || discovery.phase === 'scanning'}>{scanState.phase === 'scanning' || discovery.phase === 'scanning' ? <RefreshCw size={15} className="spin"/> : null}{scanState.phase === 'error' || discovery.phase === 'error' ? 'Retry Scan' : discovery.result ? 'Refresh Scan' : 'Scan My Computer'} <ArrowRight size={16}/></button><small role="status" aria-live="polite">{combinedScanMessage(scanState, discovery)}. Read-only local inspection; no software or model files are changed.</small></div></div>
    </section>
    <section className="ai-app-section"><SectionTitle number="02" title="AI Applications" sub="Explore tools, choose what fits, and learn the basics."/><div className="product-grid">{products.map(p=>{const finding=discovery.result?.applications.find(x=>x.name===p.match);const agent=discovery.result?.codingAgents.find(x=>x.name===p.name);const status=finding?.status==='Running'?'Running':finding?.status==='Installed'?'Installed':finding?.status==='Needs Verification'?'Verify':finding?.status==='Data Found Only'?'Data found only':finding?.status==='Scan Incomplete'?'Scan incomplete':finding?.status==='Not Found'||finding?.status==='Not Detected'?'Not detected':discovery.result?'Not detected':'Not scanned';return <article className="product-card framed-panel" key={p.name}><button className={`product-main ${p.color}`} type="button" aria-label={`Open ${p.name} installer details`} onClick={()=>onExplore(p.name)}><ProductBrand name={p.name}/><b>{p.name}</b><small>{p.desc}</small></button><span className={`product-detection ${status==='Installed'||status==='Running'?'found':''}`} title={[finding?.installationType,...(finding?.evidence||[]),agent?.status==='Installed'?`${agent.name} is bundled with the ChatGPT app`:null].filter(Boolean).join(' · ')}>{status}</span><button className="product-learn" type="button" onClick={()=>onLearn(p.name)}><BookOpen size={12}/> Learn</button></article>})}</div>
      <ComfyUiHomeFeature discovery={discovery} onExplore={onExplore} onLearn={onLearn} onScan={onScan}/></section>
    <section className="coding-section home-local-ai-callout"><SectionTitle number="03" title="Local AI Coding Center" sub="Choose installed local models and configure a coding workspace in My Models." right={<button className="btn btn-cyan" type="button" onClick={onModels}>Open Coding Center <ArrowRight size={13}/></button>}/><p>Connect Codex CLI or OpenCode to Ollama without changing global configuration. Launch modes and workspace protections are explained before you start.</p></section>
    <section className="prompt-section framed-panel"><div className="prompt-header"><div className="prompt-label"><span className="prompt-icon"><MessageCircle size={15}/></span><div><b>Quick Prompt Pad</b><small>A reusable prompt area for your coding workflow.</small></div></div><label className="template-select-label"><span className="sr-only">Templates</span><select aria-label="Templates" value={selectedTemplate} onChange={e=>setTemplate(e.target.value)}><option value="">Templates</option>{Object.keys(templates).map(name=><option key={name} value={name}>{name}</option>)}</select><ChevronDown size={12}/></label></div><textarea aria-label="Prompt text" maxLength={4000} value={prompt} onChange={e=>{setPrompt(e.target.value);localStorage.setItem('aerus-prompt',e.target.value)}} placeholder="Type your prompt here... (e.g. plan a project, debug code, design a UI, etc.)"/><div className="prompt-footer"><span aria-live="polite">{saveMessage || 'Saved locally on this device'} <small>{prompt.length}/4000</small></span><div className="prompt-tools"><button type="button" onClick={copy}><CopyGlyph/> Copy</button><button type="button" onClick={save}><Check size={14}/> Save Prompt</button><details className="saved-menu"><summary>Saved prompt <ChevronDown size={12}/></summary><div><p>{localStorage.getItem('aerus-saved-prompt') !== null ? 'A saved prompt is available on this device.' : 'No saved prompt yet. Save the current prompt to load it later.'}</p><button type="button" disabled={localStorage.getItem('aerus-saved-prompt') === null} onClick={loadSaved}><FolderOpen size={13}/> Load saved prompt</button></div></details></div></div></section>
  </>
}

function ComfyUiHomeFeature({discovery,onExplore,onLearn,onScan}:{discovery:DiscoveryState;onExplore:(name:string)=>void;onLearn:(name:string)=>void;onScan:()=>void}) {
  const [launching,setLaunching]=useState(false)
  const [message,setMessage]=useState('')
  const desktop=discovery.result?.applications.find(item=>item.id==='app-comfyui-desktop')
  const backend=discovery.result?.runtimes.find(item=>item.id==='comfyui-local')
  const launchReady=Boolean(desktop&&(desktop.status==='Installed'||desktop.status==='Running')&&desktop.location?.toLowerCase().endsWith('.exe'))
  const desktopStatus=desktop?.status||(!discovery.result?'Not scanned':discovery.result.status==='partial'?'Scan incomplete':'Not detected in checked locations')
  const backendStatus=backend?.status||(!discovery.result?'Not scanned':'Not detected')
  const open=async()=>{
    if(!launchReady){onExplore('ComfyUI Desktop');return}
    setLaunching(true);setMessage('Verifying the signed Desktop application…')
    try{const result=await requestApplicationLaunch('comfyui-desktop');setMessage(result.message);onScan()}
    catch(error){setMessage(error instanceof Error?error.message:'ComfyUI Desktop could not be opened. Use its official shortcut or setup page.')}
    finally{setLaunching(false)}
  }
  return <section className="comfyui-home-feature framed-panel" aria-labelledby="comfyui-home-title">
    <div className="comfyui-home-brand"><ComfyUiBrand/></div>
    <div className="comfyui-home-copy"><span className="eyebrow">FEATURED LOCAL CREATIVE APPLICATION</span><h3 id="comfyui-home-title">ComfyUI Desktop</h3><p>Build image, video, audio, and 3D generation workflows with a visual node graph. ComfyUI’s core can run locally; optional partner or hosted services may require accounts or payment.</p>
      <div className="comfyui-home-states"><span><b>Desktop</b>{desktopStatus}</span><span><b>Local backend</b>{backendStatus}</span><span><b>Workflow readiness</b>Checked per workflow in My Models</span></div>
      {message&&<small className="comfyui-home-message" role="status" aria-live="polite">{message}</small>}
    </div>
    <div className="comfyui-home-actions"><button className="btn btn-cyan" type="button" disabled={launching} onClick={()=>void open()}>{launching?'Verifying…':launchReady?'Open ComfyUI Desktop':'Official setup guidance'} <ArrowRight size={14}/></button><button className="text-link" type="button" onClick={()=>onLearn('ComfyUI Desktop')}><BookOpen size={12}/> Learn ComfyUI</button></div>
  </section>
}

function CopyGlyph() { return <FileText size={14}/> }

function SystemSidebar({scanState,onRefresh,showTools,onOpenTools}: {scanState:HardwareScanState; onRefresh:()=>void; showTools:boolean; onOpenTools:(guide?:CrunchGuide)=>void}) {
  const [expanded, setExpanded] = useState('')
  const result = scanState.result
  const windows = result?.windows
  const cpu = result?.cpu
  const gpu = result?.gpus?.[0]
  const gpuLabel = gpu ? (gpu.manufacturer && gpu.model?.toLowerCase().includes(gpu.manufacturer.toLowerCase()) ? gpu.model : `${gpu.manufacturer || ''} ${gpu.model || ''}`.trim()) : null
  const specs = [
    {name:'Windows',value:windows?.edition || 'Unavailable',detail:[windows?.edition, windows?.version && `Version ${windows.version}`, windows?.build && `Build ${windows.build}`, windows?.architecture].filter(Boolean).join(' · ') || 'Windows details are unavailable.',icon:Monitor},
    {name:'CPU',value:cpu?.model || 'Unavailable',detail:[cpu?.manufacturer, cpu?.model, cpu?.logicalProcessors != null && `${cpu.logicalProcessors} logical processors`].filter(Boolean).join(' · ') || 'CPU details are unavailable.',icon:Cpu},
    {name:'GPU',value:gpuLabel || 'Unavailable',detail:gpu ? `${gpu.dedicatedVideoMemoryBytes != null ? `${formatBytes(gpu.dedicatedVideoMemoryBytes)} dedicated VRAM` : 'Dedicated VRAM unavailable'} · ${gpu.sharedSystemMemoryBytes != null ? `${formatBytes(gpu.sharedSystemMemoryBytes)} shared system memory` : 'Shared memory unavailable'}. ${gpu.memorySource || ''}${gpu.adapterCount && gpu.adapterCount > 1 ? ` ${gpu.adapterCount} identical DXGI adapter identities were grouped; physical GPU count is not inferred.` : ''}` : 'GPU details are unavailable.',icon:Activity},
    {name:'RAM',value:formatBytes(result?.memory?.installedBytes),detail:result?.memory?.installedBytes != null ? `${formatBytes(result.memory.installedBytes)} installed physical memory.` : 'Installed memory is unavailable.',icon:PanelRight},
    {name:'Storage',value:result?.drives?.length ? `${result.drives.length} fixed drive${result.drives.length===1?'':'s'}` : 'Unavailable',detail:result?.drives?.length ? result.drives.map(d=>`${d.drive}${d.label ? ` (${d.label})` : ''}: ${formatBytes(d.availableBytes)} available of ${formatBytes(d.totalBytes)}`).join(' · ') : 'No ready fixed drives were reported.',icon:HardDrive},
  ]
  const recs = [{name:'Programming',desc:'Build and debug software with Codex, Claude Code, OpenCode, Cursor, or local models through Ollama.',icon:Code2},{name:'General Chat',desc:'Explore assistants for writing, research and everyday work.',icon:MessageCircle},{name:'Reasoning & Analysis',desc:'Compare local and hosted reasoning models.',icon:Cpu},{name:'Image Generation',desc:'Explore local image generation tools.',icon:Sparkles}]
  return <aside className="sidebar"><section className="side-panel system-panel framed-panel"><div className="side-title"><div><Monitor size={18}/><b>Your System</b></div><button className="refresh-btn" type="button" onClick={onRefresh} disabled={scanState.phase==='scanning'}><RefreshCw size={11} className={scanState.phase==='scanning'?'spin':''}/> {scanState.phase==='scanning'?'Scanning':'Refresh'}</button></div><div className={`not-detected scan-status scan-${scanState.phase}`} role="status" aria-live="polite"><span className={`status-led ${result && !scanState.cached ? '' : 'muted'}`}/> {scanState.cached ? 'Cached hardware data' : result ? (result.status === 'partial' ? 'Partial hardware scan' : 'Hardware scan complete') : scanState.phase === 'scanning' ? 'Reading Windows hardware' : scanState.phase === 'error' ? 'Last scan failed' : 'Hardware scan not run'}</div>{result&&<div className="scan-timestamp">{scanState.cached?'Cached from':'Scanned'} {formatTimestamp(result.scannedAtUtc)}</div>}{scanState.phase==='error'&&<div className="scan-error">{scanState.message}</div>}{specs.map(s=><button key={s.name} className="spec-row" type="button" aria-expanded={expanded===s.name} onClick={()=>setExpanded(expanded===s.name?'':s.name)}><s.icon size={16}/><b>{s.name}</b><span>{s.value}</span><ChevronRight size={14}/>{expanded===s.name&&<small className="row-detail">{s.detail}{s.name==='GPU'&&result?.acceleration&&` Direct3D 12: ${result.acceleration.direct3D12}. AI acceleration: ${result.acceleration.aiAcceleration}.`}</small>}</button>)}{result?.warnings?.length ? <details className="scan-warnings"><summary>{result.warnings.length} scan note{result.warnings.length===1?'':'s'}</summary><ul>{result.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details> : null}</section>
    <section className="side-panel rec-panel framed-panel"><div className="side-title recommendation-title"><div><Lightbulb size={18}/><b>Popular AI Uses</b></div></div><p className="side-muted">General examples · not personalized; scan-based local model fit is available in My Models</p>{recs.map(r=><button className={`recommendation-row ${r.name==='Programming'?'program-rec':''}`} key={r.name} type="button" aria-expanded={expanded===r.name} onClick={()=>setExpanded(expanded===r.name?'':r.name)}><span className="rec-icon"><r.icon size={19}/></span><span><b>{r.name}</b><small>{r.desc}</small></span><ChevronRight size={14}/>{expanded===r.name&&<em>{r.desc} Hardware-aware personalization will follow in Phase 4.</em>}</button>)}</section>
    {showTools&&<HomeAerusShelf onOpenTools={onOpenTools}/>}
    <div className="sidebar-note"><ShieldCheck size={14}/> Your hardware scan stays on this device.</div>
  </aside>
}

function PageIntro({number,title,subtitle,icon:Icon}: {number:string;title:string;subtitle:string;icon:IconType}) {return <div className="page-intro framed-panel"><span className="intro-icon"><Icon size={23}/></span><div><span className="eyebrow">EZ AI / {number}</span><h1>{title}</h1><p>{subtitle}</p></div><span className="intro-right">LOCAL FIRST<br/><b>LOCAL MODE</b></span></div>}

function DiscoveryNotes({state}:{state:DiscoveryState}) {const notes=state.result?.warnings||[];return notes.length?<details className="scan-warnings discovery-notes"><summary>{notes.length} AI discovery note{notes.length===1?'':'s'} · some results may need verification</summary><ul>{notes.map((note,index)=><li key={index}>{note}</li>)}</ul></details>:null}
function combinedScanMessage(hardware:HardwareScanState,discovery:DiscoveryState) {
  if(hardware.phase==='scanning')return hardware.message
  if(discovery.phase==='scanning')return discovery.message
  if(hardware.phase==='error')return hardware.message
  if(discovery.phase==='error')return discovery.message
  const hardwareText=hardware.result?`${hardware.cached?'Hardware cached':'Hardware scanned'} · ${formatTimestamp(hardware.result.scannedAtUtc)}`:hardware.message
  const softwareText=discovery.result?`${discovery.cached?'AI inventory cached':'AI inventory scanned'} · ${formatTimestamp(discovery.result.scannedAtUtc)}`:discovery.message
  return `${hardwareText} · ${softwareText}`
}

function Installers({selectedApplication,discovery,onLearn,onRescan,onCoding}: {onCoding:(agentId:'codex'|'opencode'|'claude-code')=>void;selectedApplication:string; discovery:DiscoveryState; onLearn:(name:string)=>void; onRescan:()=>void}) {
  const [located,setLocated]=useState<Record<string,string>>({}),[verified,setVerified]=useState<Record<string,boolean>>({})
  const verifyLocation=async(product:InstallerProduct)=>{setMessage('Verifying publisher and native identity...');try{const r=await verifyExistingApplication(product.id,located[product.id]||labels(product).find(x=>x?.location?.endsWith('.exe'))?.location||'');setVerified(v=>({...v,[product.id]:true}));setMessage(r.message)}catch(e){setVerified(v=>({...v,[product.id]:false}));setMessage(e instanceof Error?e.message:'Verification failed.')}}
  const [appQuery,setAppQuery]=useState('')
  type Activity={id:string;name:string;status:string;at:string}
  const [confirmProduct,setConfirmProduct]=useState<InstallerProduct|null>(null)
  const [executeJob,setExecuteJob]=useState<InstallerJob|null>(null)
  const [jobs,setJobs]=useState<InstallerJob[]>([])
  const [installerBusy,setInstallerBusy]=useState(false)
  const [launching,setLaunching]=useState('')
  const [message,setMessage]=useState('')
  const [activity,setActivity]=useState<Activity[]>(()=>{try{const raw=JSON.parse(localStorage.getItem('ez-ai-installer-activity-v1')||'[]');return Array.isArray(raw)?raw.slice(0,5):[]}catch{return []}})
  useEffect(()=>{let active=true;const refresh=async()=>{try{const current=await requestInstallerJobs();if(active)setJobs(current)}catch{}};void refresh();const timer=window.setInterval(()=>void refresh(),1000);return()=>{active=false;window.clearInterval(timer)}},[])
  const jobFor=(product:InstallerProduct)=>jobs.find(job=>job.installerId===product.id)
  const findings=[...(discovery.result?.applications||[]),...(discovery.result?.codingAgents||[]),...(discovery.result?.runtimes||[])]
  const selected=selectedApplication==='Claude'?'Claude Desktop':selectedApplication==='Codex'?'Codex Desktop':selectedApplication
  const selectedProduct=installerCatalog.find(item=>item.detectedNames.includes(selected))
  const selectedFinding=findings.find(item=>selectedProduct?.detectedNames.includes(item.name))
  const labels=(product:InstallerProduct)=>product.detectedNames.map(name=>findings.find(item=>item.name===name)).filter(Boolean)
  const stateFor=(product:InstallerProduct)=>{
    if(product.id==='ollama')return ollamaDesktopStatus(discovery.result?.applications.find(item=>item.name==='Ollama Desktop')?.status,discovery.result?.runtimes.find(item=>item.id==='ollama')?.status,discovery.result?.status,Boolean(discovery.result))
    const found=labels(product)
    if(found.some(item=>item?.status==='Running'))return 'Running'
    if(found.some(item=>item?.status==='Installed'))return 'Installed'
    const job=jobFor(product)
    if(job&&['Downloading','Canceling','Verifying','Awaiting approval','Installing','Failed','Canceled','Needs Verification','Installed'].includes(job.status))return job.status
    if(found.some(item=>item?.status==='Needs Verification'))return 'Needs Verification'
    if(found.some(item=>item?.status==='Data Found Only'))return 'Data Found Only'
    if(found.some(item=>item?.status==='Scan Incomplete'))return 'Scan Incomplete'
    if(!discovery.result)return 'Not scanned'
    if(!found.length)return 'Not scanned'
    return discovery.result.status==='success'?'Not Found':'Scan Incomplete'
  }
  const addActivity=(item:Activity)=>{const next=[item,...activity].slice(0,5);setActivity(next);try{localStorage.setItem('ez-ai-installer-activity-v1',JSON.stringify(next))}catch{}}
  const storeJob=(job:InstallerJob)=>setJobs(current=>[job,...current.filter(item=>item.jobId!==job.jobId)])
  const requestDownload=async(product:InstallerProduct)=>{setInstallerBusy(true);try{const job=await startInstallerDownload(product.id);storeJob(job);setConfirmProduct(null);setMessage(job.message)}catch(error){setMessage(error instanceof Error?error.message:'Could not start the verified download. Retry when ready.')}finally{setInstallerBusy(false)}}
  const cancelDownload=async(job:InstallerJob)=>{try{storeJob(await cancelInstallerDownload(job.jobId))}catch(error){setMessage(error instanceof Error?error.message:'Could not cancel the download.')} }
  const runInstaller=async(job:InstallerJob)=>{setInstallerBusy(true);try{storeJob(await executeInstaller(job.jobId,true));setExecuteJob(null)}catch(error){setMessage(error instanceof Error?error.message:'Could not start the approved installer.')}finally{setInstallerBusy(false)}}
  const verifyJob=async(job:InstallerJob)=>{setInstallerBusy(true);try{storeJob(await verifyInstaller(job.jobId));onRescan()}catch(error){setMessage(error instanceof Error?error.message:'Installation verification failed.')}finally{setInstallerBusy(false)}}
  const launch=async(product:InstallerProduct)=>{
    setLaunching(product.id);setMessage('Checking fresh installation evidence…')
    try{const result=await requestApplicationLaunch(product.id);setMessage(result.message);onRescan()}
    catch(error){setMessage(error instanceof Error?error.message:'Could not launch the application. Refresh discovery and retry.')}
    finally{setLaunching('')}
  }
  const openOfficial=(product:InstallerProduct)=>{
    const anchor=document.createElement('a');anchor.href=product.officialUrl;anchor.target='_blank';anchor.rel='noopener noreferrer';document.body.appendChild(anchor);anchor.click();anchor.remove()
    const isInstaller=product.installable && product.installerKind!=='Web application'
    const status=isInstaller?'Official installer source opened · installation not verified':'Official link opened · no local change made'
    const item={id:product.id,name:product.name,status,at:new Date().toISOString()}
    addActivity(item);setMessage(isInstaller?`${product.name}: official page opened. EZ AI did not download or execute the installer. Scan again after you complete the provider's setup flow.`:`${product.name}: official link opened after your click. EZ AI did not install software or change local settings.`);setConfirmProduct(null)
  }
  const action=(product:InstallerProduct)=>{
    const state=stateFor(product),packageLaunchReady=(product.id==='chatgpt'&&labels(product).some(item=>item?.installationType==='ChatGPT MSIX application'&&Boolean(item?.activationId)))||(product.id==='claude-desktop'&&labels(product).some(item=>item?.installationType==='Microsoft Store / MSIX'&&Boolean(item?.activationId)))||(product.id==='ollama'&&labels(product).some(item=>item?.name==='Ollama Desktop'&&(item?.status==='Installed'||item?.status==='Running')&&item.location?.toLowerCase().endsWith('ollama app.exe'))),launchReady=product.id==='ollama'?packageLaunchReady:product.launchable && ['chatgpt','claude-desktop','cursor','lm-studio','comfyui-desktop','starnet'].includes(product.id) && labels(product).some(item=>(item?.status==='Installed'||item?.status==='Running') && (item.location?.toLowerCase().endsWith('.exe')||packageLaunchReady)),kind=installerAction(product,state,Boolean(discovery.result && !discovery.cached && discovery.phase!=='scanning'),launchReady)
    if(['claude-code','codex-cli','opencode'].includes(product.id)&&['Installed','Running'].includes(state)){const agentId=product.id==='codex-cli'?'codex':product.id as 'opencode'|'claude-code';const agentName=product.id==='codex-cli'?'Codex CLI':product.name;return <button className='btn btn-cyan' type='button' onClick={()=>onCoding(agentId)} title='Opens the project and agent approval step; no prompt is submitted'>{`Launch ${agentName}`} <ArrowRight size={13}/></button>}
    if(kind==='Open'&&!verified[product.id]&&!packageLaunchReady)return <button className='btn btn-outline' onClick={()=>void verifyLocation(product)}>Verify launch</button>
    if(kind==='Open'||verified[product.id])return <button className="btn btn-cyan" type="button" disabled={launching===product.id} onClick={()=>void launch(product)}>{launching===product.id?'Checking…':'Open'} <ArrowRight size={13}/></button>
    const currentJob=jobFor(product)
    if(currentJob?.status==='Downloading')return <button className="btn btn-outline" type="button" onClick={()=>void cancelDownload(currentJob)}>Cancel download</button>
    if(currentJob?.status==='Canceling')return <button className="btn btn-outline" type="button" disabled>Canceling…</button>
    if(currentJob?.status==='Verifying'&&currentJob.installerExitCode!==null)return <button className="btn btn-outline" type="button" disabled={installerBusy} onClick={()=>void verifyJob(currentJob)}>Verify installation</button>
    if(currentJob?.status==='Verifying')return <button className="btn btn-outline" type="button" disabled>Verifying file…</button>
    if(currentJob?.status==='Awaiting approval')return <button className="btn btn-gold-outline" type="button" onClick={()=>setExecuteJob(currentJob)}>Review &amp; run</button>
    if(currentJob?.status==='Installing')return <button className="btn btn-outline" type="button" disabled>Installer open</button>
    if(currentJob?.status==='Needs Verification'||(currentJob?.status==='Failed'&&currentJob.installerExitCode!==null))return <button className="btn btn-outline" type="button" disabled={installerBusy} onClick={()=>void verifyJob(currentJob)}>Check installation</button>
    if((currentJob?.status==='Failed'&&currentJob.retryAllowed)||currentJob?.status==='Canceled')return <button className="btn btn-gold-outline" type="button" onClick={()=>setConfirmProduct(product)}>Retry download</button>
    if(kind==='Manage')return <button className="btn btn-outline" type="button" onClick={()=>{setMessage(product.note);document.querySelector('.runtime-status-panel')?.scrollIntoView({behavior:'smooth',block:'center'})}}>{product.id==='ollama'?'View runtime status':'Manage'} <ArrowRight size={13}/></button>
    if(kind==='Verify')return <button className="btn btn-outline" type="button" disabled={discovery.phase==='scanning'} onClick={()=>{setMessage(`${product.name} is detected, but EZ AI has not verified a safe launch target. Refresh discovery or review Technical details & recovery.`);onRescan()}}>Verify launch <RefreshCw size={13}/></button>
    if(kind==='Scan first')return <button className="btn btn-outline" type="button" disabled={discovery.phase==='scanning'} onClick={onRescan}>Scan first <RefreshCw size={13}/></button>
    if(kind==='Open web app')return <button className="btn btn-outline" type="button" onClick={()=>openOfficial(product)}>Open web app <ArrowRight size={13}/></button>
    if(kind==='Official setup guide')return <button className="btn btn-outline" type="button" onClick={()=>openOfficial(product)}>Official setup guide <ArrowRight size={13}/></button>
    if(kind==='Setup information')return <button className="btn btn-outline" type="button" onClick={()=>openOfficial(product)}>Setup information <ArrowRight size={13}/></button>
    if(kind==='Official installer')return <button className="btn btn-gold-outline" type="button" onClick={()=>setConfirmProduct(product)}>Official installer <ArrowRight size={13}/></button>
    if(kind==='Download installer')return <button className="btn btn-gold-outline" type="button" onClick={()=>setConfirmProduct(product)}>Review &amp; download <ArrowRight size={13}/></button>
    return <button className="btn btn-outline" type="button" onClick={()=>setMessage(product.note)}>Details <ArrowRight size={13}/></button>
  }
  const cards=installerCatalog.filter(p=>`${p.name} ${p.description}`.toLowerCase().includes(appQuery.toLowerCase()))
  const learningName=(product:InstallerProduct)=>product.id==='chatgpt'?'ChatGPT':product.id==='claude-code'?'Claude Code':product.name
  return <><PageIntro number="02" title="AI Installers" subtitle="Open verified apps or continue through official provider setup." icon={Box}/>
    <div className="explore-focus framed-panel"><div><span className="eyebrow">APPLICATION DETAILS / EVIDENCE-BASED STATUS</span><b>{selectedProduct?.name||selected}</b><small>{selectedFinding?`${selectedFinding.installationType}${selectedFinding.version?` · version ${selectedFinding.version}`:''}. A detected app is never reinstalled automatically.`:'Installation actions require a successful, current discovery scan.'}</small></div><span className="detect-state"><i/> {selectedProduct?stateFor(selectedProduct):'Not scanned'}</span></div>
    <div className="state-strip"><span className={`status-led ${discovery.result&&!discovery.cached?'':'muted'}`}/>{discovery.phase==='scanning'?discovery.message:discovery.phase==='error'?discovery.message:discovery.result?`${discovery.cached?'Cached':'Scanned'} inventory · ${formatTimestamp(discovery.result.scannedAtUtc)} · ${discovery.result.status}`:'Run Scan My Computer to verify application status.'}<span>Verified downloads stay in a local approval queue; other providers use their official setup flow.</span></div>
    <DiscoveryNotes state={discovery}/>{message&&<div className="installer-notice framed-panel" role="status" aria-live="polite"><span>{message}</span><button type="button" className="text-link" onClick={()=>setMessage('')} aria-label="Dismiss message">Dismiss</button></div>}
    <label className="installer-search">Search applications<input value={appQuery} onChange={e=>setAppQuery(e.target.value)} placeholder="Application or purpose"/></label><div className="installer-grid mission09-installer-grid">{cards.map(product=>{
      const state=stateFor(product),found=labels(product),primary=found[0]
      const isSelected=selectedProduct?.id===product.id
      const statusClass=state.toLowerCase().replaceAll(' ','-')
      return <article className={`installer-card framed-panel ${isSelected?'installer-focused':''}`} key={product.id}>
        <div className="installer-symbol" aria-hidden="true">{product.id==='comfyui-desktop'?<ComfyUiBrand/>:<ProductBrand name={product.id==='claude-desktop'?'Claude Desktop':product.id==='claude-code'?'Claude Code':product.id==='codex-cli'?'Codex CLI':product.name}/>}</div>
        <div className="installer-info"><small>{['ollama','lm-studio','comfyui-desktop'].includes(product.id)?'Local':['chatgpt','claude-desktop','gemini','grok'].includes(product.id)?'Cloud-connected application':'Hybrid agent / editor'}</small><h3>{product.name}</h3><p>{product.description}</p><span className={`state-chip state-${statusClass}`}><i/> {state}</span></div>
        <div className="installer-bottom"><details className="installer-technical"><summary>Technical details &amp; recovery</summary><div><label>Locate Existing Installation<input aria-label={'Existing '+product.name+' executable'} placeholder='Full path to the existing .exe' value={located[product.id]||''} onChange={e=>{setLocated({...located,[product.id]:e.target.value});setVerified({...verified,[product.id]:false})}}/></label><button type='button' className='text-link' onClick={()=>void verifyLocation(product)}>Verify selected installation</button><small>Launch: {verified[product.id]?'Launchable · verified this session':'Launch Unverified · installation status is separate'}</small><small><b>Publisher</b> · {product.publisher}</small>{primary?.version&&<small>Verified version {primary.version}</small>}{primary?.location&&<small className="detected-location" title={primary.location}>{primary.location}</small>}{found.length>0&&<details className="detection-evidence"><summary>Detection evidence ({found.reduce((n,item)=>n+(item?.evidence.length||0),0)})</summary><ul>{found.flatMap(item=>item?.evidence||[]).slice(0,5).map((line,j)=><li key={j}>{line}</li>)}</ul></details>}<small className="installer-method">{product.installerKind} · {product.silentInstall==='Not documented'?'Silent install not verified':product.silentInstall}</small><small>Windows: {product.architectures?.join(' / ')||'not specified'}{product.expectedExecutable?` · expected ${product.expectedExecutable}`:''}</small><small>{product.note}</small><details className="detection-evidence"><summary>Detection, verification &amp; recovery</summary><ul>{product.detectionRules.map((rule,index)=><li key={index}>{rule}</li>)}<li>Source last reviewed: {product.verifiedOn}</li><li>{product.recoveryGuidance}</li></ul></details></div></details>
          <div className="installer-card-actions"><button className="text-link" type="button" onClick={()=>onLearn(learningName(product))}><BookOpen size={12}/> Learn</button>{action(product)}</div>
        </div>
      </article>
    })}</div>
    <section className="queue-panel framed-panel"><div><Terminal size={19}/><div><b>Installer queue &amp; setup activity</b><small>Verified downloads report byte progress. Provider-managed installers remain external handoffs.</small></div></div><span className="queue-empty">{jobs.some(job=>['Downloading','Verifying','Awaiting approval','Installing'].includes(job.status))?'ACTIVE':'NO ACTIVE TASKS'}</span>{jobs.map(job=><div className="installer-job" key={job.jobId}><div className="installer-job-top"><b>{job.name}</b><span className={`state-chip state-${job.status.toLowerCase().replaceAll(' ','-')}`}><i/> {job.status}</span><small>{job.message}</small></div>{job.status==='Downloading'&&<><div className="installer-progress-track" role="progressbar" aria-valuenow={job.progressPercent??undefined} aria-valuemin={0} aria-valuemax={100}><span className={job.progressPercent===null?'indeterminate':''} style={job.progressPercent===null?undefined:{width:`${job.progressPercent}%`}}/></div><div className="installer-job-meta"><span>{formatBytes(job.downloadedBytes)}{job.totalBytes!==null?` / ${formatBytes(job.totalBytes)}`:' downloaded'}</span><button className="text-link" type="button" onClick={()=>void cancelDownload(job)}>Cancel download</button></div></>}{job.status==='Awaiting approval'&&<small>Signature checked · {job.publisher}{job.version?` · ${job.version}`:''} · {formatBytes(job.downloadedBytes)}</small>}{job.status==='Installing'&&<small>Progress is controlled by the provider installer. EZ AI waits for exit, then requires a discovery check.</small>}</div>)}{activity.length>0&&<div className="installer-activity">{activity.map((item,index)=><div key={`${item.id}-${item.at}-${index}`}><b>{item.name}</b><span>{item.status}</span><time>{formatTimestamp(item.at)}</time></div>)}</div>}</section>
    <section className="runtime-status-panel framed-panel"><div className="subhead"><div><b>LOCAL RUNTIME STATUS</b><small>Installed application presence and runtime endpoint health remain separate.</small></div></div>{(discovery.result?.runtimes||[]).map(runtime=><div className="runtime-row" key={runtime.id}><div><b>{runtime.name}</b><small>{runtime.installationType} · {runtime.operationalStatus}</small>{runtime.evidence.length>0&&<details className="detection-evidence"><summary>Runtime evidence ({runtime.evidence.length})</summary><ul>{runtime.evidence.slice(0,5).map((item,index)=><li key={index}>{item}</li>)}</ul></details>}</div><span className={`state-chip state-${runtime.status.toLowerCase().replaceAll(' ','-')}`}><i/> {runtime.status}</span></div>)}</section>
    <div className="installer-confirm-layer" hidden={!confirmProduct} aria-hidden={!confirmProduct}>
      {confirmProduct&&<div className="installer-confirm framed-panel" role="dialog" aria-modal="true" aria-labelledby="installer-confirm-title"><span className="eyebrow">EXPLICIT APPROVAL REQUIRED</span><h2 id="installer-confirm-title">{confirmProduct.downloadSupported?'Review download for':'Continue to'} {confirmProduct.name}?</h2><dl><dt>Publisher</dt><dd>{confirmProduct.publisher}</dd><dt>Version</dt><dd>{confirmProduct.version||'Resolved from official source when downloaded'}</dd><dt>Source</dt><dd><a href={confirmProduct.sourceUrl} target="_blank" rel="noreferrer">Official documentation</a></dd><dt>Download size</dt><dd>{confirmProduct.downloadSupported?'Measured from the official HTTPS response before saving':'Not published in the bundled catalog'}</dd><dt>Destination / admin</dt><dd>{confirmProduct.downloadSupported?'Temporary installer file is stored under LocalAppData\EZ AI\Installers. The provider installer chooses the application destination and may request administrator approval.':'Chosen by the provider installer; may request administrator approval'}</dd><dt>Expected changes</dt><dd>{confirmProduct.downloadSupported?'This step downloads and verifies the signed installer only. A separate approval is required before running it.':'The provider interactive installer may add application files, shortcuts, and related registrations.'} EZ AI does not update or remove existing software.</dd><dt>Potential conflicts</dt><dd>Different install scopes or an incomplete scan can conflict with an existing copy. Verify current installations before continuing.</dd></dl><p>{confirmProduct.note}</p><div><button className="btn btn-outline" type="button" onClick={()=>setConfirmProduct(null)}>Cancel</button><button className="btn btn-gold" type="button" disabled={installerBusy} onClick={()=>confirmProduct.downloadSupported?void requestDownload(confirmProduct):openOfficial(confirmProduct)}>{installerBusy?'Starting…':confirmProduct.downloadSupported?'I approve · download &amp; verify':'I approve · open official source'} <ArrowRight size={13}/></button></div></div>}
    </div>
    <div className="installer-confirm-layer" hidden={!executeJob} aria-hidden={!executeJob}>
      {executeJob&&<div className="installer-confirm framed-panel" role="dialog" aria-modal="true" aria-labelledby="run-installer-title"><span className="eyebrow">SECOND EXPLICIT APPROVAL</span><h2 id="run-installer-title">Run the verified {executeJob.name} installer?</h2><dl><dt>Publisher</dt><dd>{executeJob.publisher} · Authenticode chain and product identity verified</dd><dt>Version</dt><dd>{executeJob.version||'Not supplied by official route'}</dd><dt>Source</dt><dd>HTTPS source host {executeJob.sourceHost}</dd><dt>File size</dt><dd>{formatBytes(executeJob.downloadedBytes)}</dd><dt>Install destination</dt><dd>Selected inside the provider interactive installer</dd><dt>Administrator</dt><dd>The installer may request elevation; EZ AI does not elevate it.</dd><dt>Changes</dt><dd>Running the installer may create application files, shortcuts, and registrations. Existing apps are not updated or removed by EZ AI.</dd></dl><p>EZ AI will open this signed installer without silent-install flags or command arguments. Installation success will require a fresh discovery scan.</p><div><button className="btn btn-outline" type="button" onClick={()=>setExecuteJob(null)}>Cancel</button><button className="btn btn-gold" type="button" disabled={installerBusy} onClick={()=>void runInstaller(executeJob)}>{installerBusy?'Opening…':'I approve · run installer'} <ArrowRight size={13}/></button></div></div>}
    </div>
  </>
}
export default App
