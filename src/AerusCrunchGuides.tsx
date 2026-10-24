import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Check, Clipboard, RotateCcw } from 'lucide-react'
import ClaudeEfficiencyGuide from './ClaudeEfficiencyGuide'
import type { ExperienceLevel } from './knowledgeCatalog'

export type CrunchGuide = 'claude' | 'codex'

const CLAUDE_ABOUT_DEFAULT = `I build Windows desktop software and local-first AI tools. I work across source code, Git repositories, and installed applications. Help me preserve working setups, inspect the current project before suggesting changes, and distinguish verified facts from assumptions. Keep separate projects and repositories separate. Prefer private, local workflows when they fit.`
const CLAUDE_RESPONSE_DEFAULT = `Be direct, practical, and evidence-based. Explain the next useful step in plain language. For coding work, inspect the repository instructions and current runtime first, make a focused change, and verify the changed behavior. Keep my original design and working behavior unless I ask for a redesign. Never claim something was installed, packaged, tested, or published unless it was verified. Flag actions that would change another app, install software, publish data, or remove files before taking them.`
const CLAUDE_MEMORY_DEFAULT = `Review what you have learned about me from our conversations and suggest concise Claude Memory updates that would help in future chats. Focus on durable work context, stable preferences, and active long-term projects. Keep separate projects distinct and label uncertain details instead of treating them as facts. Do not include passwords, account credentials, financial identifiers, health details, or other sensitive information unless I explicitly ask. Show proposed additions, corrections, and removals first; wait for my approval before changing Memory. Keep each item brief and easy to update.`
const CLAUDE_MD_DEFAULT = `Inspect this project before drafting a project-specific CLAUDE.md. First report the project root, current Git branch and status, existing CLAUDE.md/CLAUDE.local.md/AGENTS.md instructions, verified build and test commands, and the architecture facts you can confirm from the repository. Then propose a concise CLAUDE.md containing only durable project facts and workflows Claude cannot reliably infer. Preserve existing instructions, never invent commands or architecture, and do not overwrite or create files until I approve the exact draft. Keep personal secrets and private machine-specific details out of shared instructions. Do not install, publish, deploy, or package anything as part of this review.`

function readPrompt(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

export default function AerusCrunchGuides({ guide, level, onPricing, onBack }: { guide: CrunchGuide; level: ExperienceLevel; onPricing: () => void; onBack: () => void }) {
  const [about, setAbout] = useState(() => readPrompt('ez-ai-claude-profile-about-v1', CLAUDE_ABOUT_DEFAULT))
  const [response, setResponse] = useState(() => readPrompt('ez-ai-claude-profile-response-v1', CLAUDE_RESPONSE_DEFAULT))
  const [memoryPrompt, setMemoryPrompt] = useState(() => readPrompt('ez-ai-claude-memory-prompt-v1', CLAUDE_MEMORY_DEFAULT))
  const [claudeMdPrompt, setClaudeMdPrompt] = useState(() => readPrompt('ez-ai-claude-md-prompt-v1', CLAUDE_MD_DEFAULT))
  const [message, setMessage] = useState('')
  const isClaude = guide === 'claude'
  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied. Paste it into the matching Claude area and review it before applying.`) }
    catch { setMessage('Clipboard access is unavailable. Select the text and copy it manually.') }
  }
  useEffect(() => { try { localStorage.setItem('ez-ai-claude-profile-about-v1', about) } catch {} }, [about])
  useEffect(() => { try { localStorage.setItem('ez-ai-claude-profile-response-v1', response) } catch {} }, [response])
  useEffect(() => { try { localStorage.setItem('ez-ai-claude-memory-prompt-v1', memoryPrompt) } catch {} }, [memoryPrompt])
  useEffect(() => { try { localStorage.setItem('ez-ai-claude-md-prompt-v1', claudeMdPrompt) } catch {} }, [claudeMdPrompt])

  const restoreExamples = () => {
    setAbout(CLAUDE_ABOUT_DEFAULT)
    setResponse(CLAUDE_RESPONSE_DEFAULT)
    setMemoryPrompt(CLAUDE_MEMORY_DEFAULT)
    setClaudeMdPrompt(CLAUDE_MD_DEFAULT)
    setMessage('Claude setup prompt examples restored.')
  }

  return <section className="crunch-guide-view" aria-labelledby="crunch-guide-title">
    <div className="crunch-guide-heading">
      <button className="btn btn-outline" type="button" onClick={onBack}><ArrowLeft size={14}/> Tools</button>
      <div><span className="eyebrow">TOOLS / OFFLINE GUIDE</span><h2 id="crunch-guide-title">{isClaude ? 'Aerus Claude Crunch' : 'Aerus Codex Crunch'}</h2><p>{isClaude ? 'Protect your Claude Code budget and prepare a reusable working profile.' : 'Set up Codex with model routing and project rules. The setup script asks before it changes anything.'}</p></div>
      <BookOpen className="crunch-guide-mark" size={23}/>
    </div>

    {isClaude&&<p className="crunch-trial-note"><b>Your Claude trial plan:</b> put reusable guidance in the profile first, keep each project and local Git repository distinct, then judge the one-month trial from your real workflow before shifting more work from Grok.</p>}
    {isClaude&&<section className="claude-profile-prompts" aria-labelledby="claude-profile-title">
      <div className="panel-heading"><div><h3 id="claude-profile-title">Claude setup prompts</h3><p>Edit the examples, then copy each into the matching Claude profile, Memory, or Claude Code project setup area.</p></div><button className="text-link" type="button" onClick={restoreExamples}><RotateCcw size={13}/> Restore examples</button></div>
      <div className="claude-profile-grid">
        <label><span><b>What should Claude know about you?</b><small>Account profile · work context and stable preferences</small></span><textarea value={about} onChange={event=>setAbout(event.target.value)} rows={5}/><button className="btn btn-outline" type="button" onClick={()=>void copy(about,'The “what Claude should know” example')}><Clipboard size={13}/> Copy field</button></label>
        <label><span><b>How should Claude respond?</b><small>Account profile · communication and collaboration</small></span><textarea value={response} onChange={event=>setResponse(event.target.value)} rows={5}/><button className="btn btn-outline" type="button" onClick={()=>void copy(response,'The response-style example')}><Clipboard size={13}/> Copy field</button></label>
        <label><span><b>Review Claude Memory</b><small>Claude Settings → Memory → “Tell Claude what to change”</small></span><textarea value={memoryPrompt} onChange={event=>setMemoryPrompt(event.target.value)} rows={5}/><button className="btn btn-outline" type="button" onClick={()=>void copy(memoryPrompt,'The Claude Memory review prompt')}><Clipboard size={13}/> Copy prompt</button></label>
        <label><span><b>Draft a project CLAUDE.md</b><small>Claude Code · review the proposal before saving it</small></span><textarea value={claudeMdPrompt} onChange={event=>setClaudeMdPrompt(event.target.value)} rows={5}/><button className="btn btn-outline" type="button" onClick={()=>void copy(claudeMdPrompt,'The project CLAUDE.md prompt')}><Clipboard size={13}/> Copy prompt</button></label>
      </div>
      <p className="crunch-local-note">Your edited examples stay in this EZ AI profile on this device. Copying is manual: EZ AI does not connect to Claude, change account Memory, or create project files. Claude Memory stores learned context; CLAUDE.md gives Claude Code written project instructions.</p>
      {message&&<p className="crunch-copy-message" role="status" aria-live="polite"><Check size={13}/>{message}</p>}
    </section>}

    {isClaude ? <ClaudeEfficiencyGuide level={level} onPricing={onPricing}/> : <div className="crunch-embedded-guide"><iframe title="Codex Efficiency Setup guide" src="/knowledge/codex-efficiency-setup.html" sandbox="allow-scripts allow-downloads allow-popups" loading="eager"/></div>}
  </section>
}
