import { useEffect, useState } from 'react'
import { Activity, ArrowRight, BookOpen, HardDrive, Wrench } from 'lucide-react'
import { type AerusSdmStatus, type AerusUsageHudStatus, checkAerusSdm, checkAerusUsageHud } from './localAgents'
import { requestApplicationLaunch } from './appActions'
import { describeCompanion, needsUnsignedConfirmation, serviceUnavailable, UNSIGNED_CONFIRMATION, type CompanionApp } from './companionStatus'
import AerusCrunchGuides, { type CrunchGuide } from './AerusCrunchGuides'
import InstructionInstaller from './AiInstructionsInstaller'
import type { ExperienceLevel } from './knowledgeCatalog'

function readExperienceLevel(): ExperienceLevel {
  try {
    const saved = localStorage.getItem('ez-ai-knowledge-level-v1')
    return saved === 'Intermediate' || saved === 'Advanced' ? saved : 'Beginner'
  } catch { return 'Beginner' }
}

/** Opens a verified companion through the native launcher after the unsigned-executable confirmation. */
async function launchCompanion(app: CompanionApp, status: AerusUsageHudStatus | AerusSdmStatus | null) {
  if (needsUnsignedConfirmation(status) && !window.confirm(UNSIGNED_CONFIRMATION[app])) return null
  return requestApplicationLaunch(app === 'hud' ? 'aerus-usage-hud' : 'aerus-sdm')
}

function useCompanionStatus() {
  const [hud, setHud] = useState<AerusUsageHudStatus | null>(null)
  const [sdm, setSdm] = useState<AerusSdmStatus | null>(null)
  const refreshHud = async () => {
    try { setHud(await checkAerusUsageHud()) } catch (error) { setHud(serviceUnavailable(error)) }
  }
  const refreshSdm = async () => {
    try { setSdm(await checkAerusSdm()) } catch (error) { setSdm(serviceUnavailable(error)) }
  }
  useEffect(() => { void refreshHud(); void refreshSdm() }, [])
  return { hud, sdm, refreshHud, refreshSdm }
}

/** Compact Home shelf: status and launch only, with full instructions and approvals kept in the Tools tab. */
export function HomeAerusShelf({ onOpenTools }: { onOpenTools: (guide?: CrunchGuide) => void }) {
  const { hud, sdm, refreshHud, refreshSdm } = useCompanionStatus()
  const [busy, setBusy] = useState<'' | CompanionApp>('')
  const [message, setMessage] = useState('')
  const hudView = describeCompanion('hud', hud)
  const sdmView = describeCompanion('sdm', sdm)

  const open = async (app: CompanionApp) => {
    const status = app === 'hud' ? hud : sdm
    setBusy(app); setMessage('')
    try {
      const result = await launchCompanion(app, status)
      if (result) setMessage(result.message)
      if (app === 'hud') await refreshHud(); else await refreshSdm()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The companion could not be opened.') }
    finally { setBusy('') }
  }

  const rows: { app: CompanionApp; name: string; view: ReturnType<typeof describeCompanion>; icon: typeof Activity }[] = [
    { app: 'hud', name: 'Aerus AI Usage HUD', view: hudView, icon: Activity },
    { app: 'sdm', name: 'Aerus SDM', view: sdmView, icon: HardDrive },
  ]

  return <section className="side-panel framed-panel aerus-shelf" aria-labelledby="home-aerus-title">
    <div className="side-title"><div><Activity size={18}/><b id="home-aerus-title">Aerus Tools</b></div><small>BY AERU CREATIONS</small></div>
    <ul className="aerus-shelf-list">
      {rows.map(({ app, name, view, icon: Icon }) => <li className="aerus-shelf-row" key={app}>
        <span className="aerus-shelf-icon">{app === 'hud' ? <img src="/aerus-ai-usage-hud.ico" alt="" width={17} height={17}/> : <Icon size={16}/>}</span>
        <span className="aerus-shelf-copy"><b>{name}</b><small className={`aerus-shelf-status tone-${view.tone}`}>{view.label}</small></span>
        {view.canOpen
          ? <button className="aerus-shelf-action" type="button" disabled={busy !== ''} onClick={() => void open(app)} aria-label={`Open ${name}`}>{busy === app ? 'Opening…' : 'Open'} <ArrowRight size={11}/></button>
          : <button className="aerus-shelf-action secondary" type="button" onClick={() => onOpenTools()} aria-label={`${view.needsApproval ? 'Review' : 'View details for'} ${name} in Tools`}>{view.needsApproval ? 'Review' : 'Details'} <ArrowRight size={11}/></button>}
        {!view.canOpen && view.detail && <details className="aerus-shelf-detail"><summary>Why?</summary><p>{view.detail}</p></details>}
      </li>)}
      <li className="aerus-shelf-row">
        <span className="aerus-shelf-icon"><BookOpen size={16}/></span>
        <span className="aerus-shelf-copy"><b>Aerus Claude Crunch</b><small>Token efficiency guide</small></span>
        <button className="aerus-shelf-action" type="button" onClick={() => onOpenTools('claude')} aria-label="Open Aerus Claude Crunch guide">Open guide <ArrowRight size={11}/></button>
      </li>
      <li className="aerus-shelf-row">
        <span className="aerus-shelf-icon"><BookOpen size={16}/></span>
        <span className="aerus-shelf-copy"><b>Aerus Codex Crunch</b><small>Global rules and model routing</small></span>
        <button className="aerus-shelf-action" type="button" onClick={() => onOpenTools('codex')} aria-label="Open Aerus Codex Crunch guide">Open guide <ArrowRight size={11}/></button>
      </li>
    </ul>
    <button className="aerus-shelf-footer" type="button" onClick={() => onOpenTools()}>AI Setup · Development Instructions <ArrowRight size={11}/></button>
    {message && <p className="aerus-tools-message" role="status" aria-live="polite">{message}</p>}
  </section>
}

export default function AerusToolsShowcase({ initialCrunch = null, onPricing }: { initialCrunch?: CrunchGuide | null; onPricing?: () => void }) {
  const { hud, sdm, refreshHud, refreshSdm } = useCompanionStatus()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [crunchGuide, setCrunchGuide] = useState<CrunchGuide | null>(initialCrunch)
  const [level] = useState<ExperienceLevel>(readExperienceLevel)
  const hudView = describeCompanion('hud', hud)
  const sdmView = describeCompanion('sdm', sdm)

  const openHud = async () => {
    setBusy(true); setMessage('')
    try {
      const result = await launchCompanion('hud', hud)
      if (result) setMessage(result.message)
      await refreshHud()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Aerus AI Usage HUD could not be opened.') }
    finally { setBusy(false) }
  }
  const openSdm = async () => {
    setBusy(true); setMessage('')
    try {
      const result = await launchCompanion('sdm', sdm)
      if (result) setMessage(result.message)
      await refreshSdm()
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Aerus SDM could not be opened.') }
    finally { setBusy(false) }
  }

  return <div className="aerus-tools-page">
    <div className="page-intro framed-panel"><span className="intro-icon"><Wrench size={23}/></span><div><span className="eyebrow">EZ AI / 06</span><h1>Aerus Tools</h1><p>Local companion applications from Aeru Creations.</p></div><span className="intro-right">LOCAL FIRST<br/><b>VERIFIED LAUNCHERS</b></span></div>
    <section className="aerus-tools-panel framed-panel" aria-labelledby="aerus-tools-title">
    <div className="aerus-tools-heading"><div><Activity size={16}/><b id="aerus-tools-title">Aerus Tools</b></div><small>BY AERU CREATIONS</small></div>
    <p className="aerus-tools-subtitle">Open your locally installed Aeru applications. EZ AI verifies each app before it enables Open.</p>
    <div className="aerus-tools-grid">
      <article className="aerus-tool-card">
        <span className="aerus-tool-icon"><img src="/aerus-ai-usage-hud.ico" alt="" width={18} height={18}/></span>
        <div className="aerus-tool-copy"><b>Aerus AI Usage HUD</b><small>Unified token tracking for Codex, Claude, and Ollama</small><span className={`aerus-tool-status ${hudView.tone === 'ready' || hudView.tone === 'approval' ? 'available' : ''}`}>{hudView.label}</span></div>
        {hudView.canOpen
          ? <button className="aerus-tool-action" type="button" disabled={busy} onClick={() => void openHud()} aria-label={hud?.status === 'running' ? 'Restore Aerus AI Usage HUD' : 'Open Aerus AI Usage HUD'}>{busy ? 'Opening…' : hud?.status === 'running' ? 'Restore' : 'Open'} <ArrowRight size={12}/></button>
          : <button className="aerus-tool-action unavailable" type="button" disabled title={hudView.detail}>{hudView.tone === 'unavailable' ? 'Open in desktop app' : 'Not available'}</button>}
      </article>

      <article className="aerus-tool-card">
        <span className="aerus-tool-icon"><HardDrive size={17}/></span>
        <div className="aerus-tool-copy"><b>Aerus SDM</b><small>Super Disk Management</small><span className={`aerus-tool-status ${sdmView.tone === 'ready' ? 'available' : ''}`}>{sdmView.label}</span></div>
        {sdmView.canOpen
          ? <button className="aerus-tool-action" type="button" disabled={busy} onClick={() => void openSdm()} aria-label="Open Aerus SDM">{busy ? 'Opening…' : 'Open'} <ArrowRight size={12}/></button>
          : <button className="aerus-tool-action unavailable" type="button" disabled title={sdmView.detail}>{sdmView.tone === 'unavailable' ? 'Open in desktop app' : 'Not available'}</button>}
        <p className="aerus-tool-note">{sdm?.message || 'Checking the documented local install folder and Windows shortcuts. EZ AI will not guess an executable path.'}</p>
      </article>

    </div>
    {message && <p className="aerus-tools-message" role="status" aria-live="polite">{message}</p>}
  </section>
  <InstructionInstaller />
  <section className="aerus-crunch-panel framed-panel" aria-labelledby="aerus-crunch-title">
    <div className="aerus-tools-heading"><div><BookOpen size={16}/><b id="aerus-crunch-title">Aerus Crunch</b></div><small>EFFICIENCY GUIDES</small></div>
    <p className="aerus-tools-subtitle">Practical Claude and Codex guidance, with editable Claude profile starters and the supplied Codex setup guide.</p>
    {crunchGuide
      ? <AerusCrunchGuides guide={crunchGuide} level={level} onPricing={onPricing || (() => {})} onBack={() => setCrunchGuide(null)} />
      : <div className="aerus-crunch-guides">
        <button type="button" className="knowledge-guide available" onClick={() => setCrunchGuide('claude')}><span><b>Aerus Claude Crunch</b><small>Save credits · token efficiency and two profile fields</small></span><strong>Open guide →</strong></button>
        <button type="button" className="knowledge-guide available" onClick={() => setCrunchGuide('codex')}><span><b>Aerus Codex Crunch</b><small>Global rules, model routing and efficient workflows</small></span><strong>Open guide →</strong></button>
      </div>}
  </section>
  </div>
}
