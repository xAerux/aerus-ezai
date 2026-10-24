import { useEffect, useState } from 'react'
import { AlertTriangle, BookOpen, Check, Clipboard, FileText, RefreshCw, ShieldCheck, Sparkles, Wrench } from 'lucide-react'
import { fetchInstructionTemplate, getInstructionStatus, installInstruction, type InstructionAgentId, type InstructionFileStatus, type InstructionOperation } from './instructionInstaller'
import './instructionInstaller.css'
import './instructionInstallerPolish.css'

type AgentCard = { id: InstructionAgentId; name: string; product: string; icon: 'codex' | 'claude'; file: string; doc: string; location: string; memoryNote?: string }
const agents: AgentCard[] = [
  { id: 'codex', name: 'OpenAI Codex', product: 'Global engineering instructions', icon: 'codex', file: 'AGENTS.md', doc: 'https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex', location: '%USERPROFILE%\\.codex\\AGENTS.md', },
  { id: 'claude-code', name: 'Anthropic Claude Code', product: 'Global Claude Code instructions', icon: 'claude', file: 'CLAUDE.md', doc: 'https://code.claude.com/docs/en/memory', location: '%USERPROFILE%\\.claude\\CLAUDE.md', memoryNote: 'Claude Code written instructions are separate from Claude auto memory. This installer only manages CLAUDE.md.', },
]
const statusLabels: Record<string, string> = { 'not-installed': 'Not installed', installed: 'Installed · template matches', modified: 'Modified · review required', 'unable-to-inspect': 'Unable to inspect' }

export default function InstructionInstaller() {
  const [templates, setTemplates] = useState<Record<InstructionAgentId, string>>({ codex: '', 'claude-code': '' })
  const [statuses, setStatuses] = useState<Partial<Record<InstructionAgentId, InstructionFileStatus>>>({})
  const [acknowledged, setAcknowledged] = useState(false)
  const [acknowledgmentOpen, setAcknowledgmentOpen] = useState(false)
  const [acknowledgmentChecked, setAcknowledgmentChecked] = useState(false)
  const [active, setActive] = useState<InstructionAgentId | null>(null)
  const [operation, setOperation] = useState<InstructionOperation | null>(null)
  const [mergeText, setMergeText] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = async (id: InstructionAgentId, includeContent = false) => {
    let template = templates[id]
    try { if (!template) template = await fetchInstructionTemplate(id) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The bundled template could not be loaded.') }
    if (template) setTemplates(current => ({ ...current, [id]: template }))
    try {
      const status = await getInstructionStatus(id, includeContent)
      setStatuses(current => ({ ...current, [id]: status }))
      if (!status.success) setMessage(status.message)
    } catch (error) {
      setStatuses(current => ({ ...current, [id]: { success: false, agentId: id, status: 'unable-to-inspect', message: error instanceof Error ? error.message : 'The local instruction service is unavailable.' } }))
    }
  }

  useEffect(() => { void refresh('codex'); void refresh('claude-code') }, [])

  const preview = async (id: InstructionAgentId) => {
    setBusy(true); setMessage('')
    try { await refresh(id, true); setActive(id) }
    finally { setBusy(false) }
  }
  const copy = async (id: InstructionAgentId) => {
    try { await navigator.clipboard.writeText(templates[id] || await fetchInstructionTemplate(id)); setMessage(`${agents.find(a => a.id === id)?.file} template copied.`) }
    catch { setMessage('Clipboard access is unavailable. Select Preview Instructions and copy the text manually.') }
  }
  const begin = async (id: InstructionAgentId, next: InstructionOperation) => {
    const current = statuses[id]
    if (!acknowledged || !current?.success) return
    if (next === 'manual-merge') {
      const inspect = await getInstructionStatus(id, true)
      setStatuses(old => ({ ...old, [id]: inspect }))
      setMergeText(`${inspect.currentContent || ''}${inspect.currentContent?.endsWith('\n') || !inspect.currentContent ? '' : '\n'}\n\n${templates[id]}`)
    }
    setActive(id); setOperation(next); setMessage('')
  }
  const confirmInstall = async () => {
    if (!active || !operation || !acknowledged) return
    const current = statuses[active]
    if (!current?.success) return
    const confirmation = operation === 'create'
      ? `Create ${agents.find(a => a.id === active)?.file} at:\n${current.destination}?`
      : operation === 'replace'
        ? `Replace the modified instruction file at:\n${current.destination}\n\nA verified timestamped backup will be created first. Continue?`
        : `Install your reviewed manual merge at:\n${current.destination}\n\nA verified timestamped backup will be created first. Continue?`
    if (!window.confirm(confirmation)) return
    setBusy(true); setMessage('')
    try {
      const result = await installInstruction({ agentId: active, operation, acknowledged: true, approved: true, expectedCurrentHash: current.currentHash || '', templateVersion: current.templateVersion || '1.0.0', mergedContent: operation === 'manual-merge' ? mergeText : undefined })
      setMessage(result.message + (result.backupPath ? ` Backup: ${result.backupPath}` : ''))
      setOperation(null); await refresh(active)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Instruction installation failed.') }
    finally { setBusy(false) }
  }

  return <section className="instruction-installer framed-panel" aria-labelledby="instruction-installer-title">
    <div className="instruction-heading"><div className="instruction-heading-icon"><Wrench size={18}/></div><div><span className="eyebrow">TOOLS / LOCAL SETUP</span><h2 id="instruction-installer-title">AI Setup · Development Instructions</h2><p>Review and optionally install reusable global guidance for Codex or Claude Code.</p></div><span className="instruction-offline">OFFLINE · USER APPROVAL REQUIRED</span></div>
    <div className="instruction-warning" role="note"><AlertTriangle size={19}/><div><b>Global instructions affect how the agent behaves across projects.</b><span>Existing files may contain personal customizations. EZ AI inspects the destination and proposed operation first. Any approved replacement is backed up and verified. No model settings, paid APIs, credentials, subscriptions, or unrelated configuration files are changed.</span><button type="button" className="instruction-button acknowledge" onClick={() => { setAcknowledgmentOpen(open => !open); setAcknowledgmentChecked(false) }}>{acknowledged ? 'Review Acknowledgment' : 'Review & Acknowledge Changes'}</button></div></div>
    {acknowledgmentOpen && <div className="instruction-acknowledgment" aria-label="Safety acknowledgment">
      <div><b>Stage 1 · Confirm you understand</b><span>This approval only records that you understand the global effect. It does not install, merge, or replace any file. Each destination and write operation still needs its own review and confirmation.</span></div>
      <label className="instruction-ack"><input type="checkbox" checked={acknowledgmentChecked} onChange={event => setAcknowledgmentChecked(event.target.checked)}/><span>I understand these instructions apply across projects, and existing custom instructions must be reviewed before any change.</span></label>
      <div className="instruction-ack-controls"><button type="button" className="instruction-button secondary" onClick={() => { setAcknowledgmentOpen(false); setAcknowledgmentChecked(false) }}>Cancel</button><button type="button" className="instruction-button acknowledge-confirm" disabled={!acknowledgmentChecked} onClick={() => { setAcknowledged(true); setAcknowledgmentOpen(false); setAcknowledgmentChecked(false) }}>Confirm Acknowledgment</button></div>
    </div>}
    {acknowledged && <div className="instruction-acknowledged" role="status"><ShieldCheck size={15}/><span><b>Stage 1 complete.</b> Review a destination and operation below before any installation can proceed.</span><button type="button" onClick={() => { setAcknowledged(false); setOperation(null); setAcknowledgmentOpen(true) }}>Reset</button></div>}
    <div className="instruction-service-note" role="status"><ShieldCheck size={15}/><span>Installation is available only when the native EZ AI desktop service can inspect and verify the destination. When that service is unavailable, preview, copy, and manual guidance remain available while file writes stay disabled.</span></div>
    <div className="instruction-agent-grid">{agents.map(agent => {
      const state = statuses[agent.id]
      const status = state?.status || 'unable-to-inspect'
      const canAct = acknowledged && state?.success === true && !busy
      return <article className="instruction-agent-card" key={agent.id}>
        <header><span className={`instruction-agent-mark ${agent.icon}`} aria-hidden="true">{agent.icon === 'codex' ? <Sparkles size={19}/> : <span>✳</span>}</span><div><h3>{agent.name}</h3><p>{agent.product}</p></div><span className={`instruction-status ${status}`}>{state ? statusLabels[status] || status : 'Checking…'}</span></header>
        <div className="instruction-metadata"><span>Template <b>{state?.templateVersion || '1.0.0'}</b></span><span>Destination <code>{state?.destination || agent.location}</code></span><span>File <b>{agent.file}</b></span></div>
        <p className="instruction-agent-note">{agent.memoryNote || 'Codex reads optional AGENTS.md guidance from its user-level Codex home; project instructions remain separate.'}</p>
        {state && !state.success && <p className="instruction-inline-error" role="status">{state.message} Installation stays disabled until this location can be checked by the native EZ AI service.</p>}
        <div className="instruction-actions">
          <button type="button" className="instruction-button" onClick={() => void preview(agent.id)} disabled={busy}><BookOpen size={13}/> Preview Instructions</button>
          <button type="button" className="instruction-button" onClick={() => void copy(agent.id)} disabled={!templates[agent.id]}><Clipboard size={13}/> Copy Instructions</button>
          <button type="button" className="instruction-button secondary" onClick={() => setActive(active === agent.id ? null : agent.id)}><FileText size={13}/> Manual Installation Instructions</button>
          {state?.status === 'not-installed' && <button type="button" className="instruction-button gold" onClick={() => void begin(agent.id, 'create')} disabled={!canAct}>Review Create Operation</button>}
          {state?.status === 'modified' && <><button type="button" className="instruction-button" onClick={() => void begin(agent.id, 'manual-merge')} disabled={!canAct}>Review Manual Merge</button><button type="button" className="instruction-button gold" onClick={() => void begin(agent.id, 'replace')} disabled={!canAct}>Review Replace With Backup</button></>}
          {state?.status === 'installed' && <span className="instruction-matched"><Check size={13}/> Already installed · no change needed</span>}
          <button type="button" className="instruction-button icon-only" aria-label={`Refresh ${agent.name} status`} onClick={() => void refresh(agent.id)} disabled={busy}><RefreshCw size={13}/></button>
        </div>
        {active === agent.id && !operation && <div className="instruction-review"><div className="instruction-review-title"><b>Instruction review</b><a href={agent.doc} target="_blank" rel="noreferrer">Official location guidance ↗</a></div>{state?.currentContent !== undefined && <pre className="instruction-existing">Current destination contents · read only{'\n'}{state.currentContent || '(empty file)'}</pre>}<pre className="instruction-template">{templates[agent.id] || 'Loading bundled template…'}</pre></div>}
        {active === agent.id && <details className="instruction-manual" open><summary>Manual installation steps</summary><ol><li>Confirm the destination path shown above matches your intended global config home.</li><li>Open your preferred text editor and copy the bundled {agent.file} template.</li><li>Create or update the file manually, preserving any custom instructions you want to keep.</li><li>Save as UTF-8, then start a new agent session to load the guidance.</li></ol><small>Official guidance: <a href={agent.doc} target="_blank" rel="noreferrer">{agent.doc}</a></small></details>}
        {active === agent.id && operation && <div className="instruction-confirmation"><div className="instruction-confirm-title"><ShieldCheck size={16}/><b>Stage 2 · Review this {operation === 'create' ? 'create' : operation === 'replace' ? 'replace with backup' : 'manual merge'} operation</b></div><p>Proposed operation: <strong>{operation === 'create' ? 'Create a new global instruction file' : operation === 'replace' ? 'Replace the current file after creating and verifying a backup' : 'Write the manually reviewed merged instructions after creating and verifying a backup'}</strong></p><p>Exact destination: <code>{state?.destination}</code></p>{operation === 'manual-merge' && <label>Review the merged instructions before approval<textarea value={mergeText} onChange={event => setMergeText(event.target.value)} rows={10}/></label>}<div className="instruction-final-warning"><AlertTriangle size={14}/><span>The native service will re-check the current file before writing. A changed destination or stale review will stop the operation.</span></div><div><button type="button" className="instruction-button secondary" onClick={() => setOperation(null)} disabled={busy}>Cancel</button><button type="button" className="instruction-button green" onClick={() => void confirmInstall()} disabled={busy || !acknowledged || !state?.success}>{busy ? 'Verifying…' : operation === 'create' ? 'Install Instructions' : operation === 'replace' ? 'Replace With Verified Backup' : 'Install Reviewed Merge'}</button></div></div>}
      </article>
    })}</div>
    <p className="instruction-memory-note"><ShieldCheck size={14}/> Written instructions are guidance, not enforced permissions. Claude Code auto memory is a separate learning store and is not changed here.</p>
    {message && <p className="instruction-feedback" role="status" aria-live="polite">{message}</p>}
  </section>
}
