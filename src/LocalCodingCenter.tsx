import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CircleAlert, Code2, FolderOpen, ShieldCheck, Terminal, X } from 'lucide-react'
import type { DiscoveryResult, SoftwareFinding } from './softwareDiscovery'
import type { HardwareScanResult } from './hardwareScan'
import ProductBrand from './ProductBrand'
import { requestApplicationLaunch } from './appActions'
import { canLaunchLocalAgent, checkAerusUsageHud, launchLocalAgent, requestAgentWorkspaceDefault, browseAgentWorkspace, validateAgentWorkspace, type AerusUsageHudStatus } from './localAgents'

interface Props { discovery:DiscoveryResult|null; hardware:HardwareScanResult|null; onScan:()=>void; scanning:boolean; onLearn:(topic:string)=>void }
type ProviderMode='normal'|'ollama'
type AgentId='codex'|'opencode'|'claude-code'
type Preferences=Record<string,{providerMode:ProviderMode}>
const PREFS_KEY='ez-ai-local-coding-center-v2'
const WORKSPACE_KEY='ez-ai-approved-agent-workspace-v2'
const WORKSPACE_DRAFT_KEY='ez-ai-agent-workspace-draft-v2'
function readPreferences():Preferences { try { return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}') as Preferences } catch { return {} } }
const statusText=(finding?:SoftwareFinding)=>finding?.status||'Not detected'

export default function LocalCodingCenter({discovery,hardware: _hardware,onScan,scanning,onLearn}:Props){
 const agents=discovery?.codingAgents||[]
 const codex=agents.find(item=>item.name==='Codex CLI')
 const opencode=agents.find(item=>item.name==='OpenCode')
 const claude=agents.find(item=>item.name==='Claude Code')
 const ollamaRuntime=discovery?.runtimes.find(item=>item.id==='ollama'||item.name.toLowerCase()==='ollama')
 const ollamaCli=discovery?.applications.find(item=>item.name==='Ollama')
 const [preferences,setPreferences]=useState<Preferences>(readPreferences)
 const [workspace,setWorkspace]=useState(()=>localStorage.getItem(WORKSPACE_KEY)||localStorage.getItem(WORKSPACE_DRAFT_KEY)||'')
 const [workspaceReady,setWorkspaceReady]=useState(false)
 const [launchTarget,setLaunchTarget]=useState<AgentId|null>(null)
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [monitor,setMonitor]=useState<AerusUsageHudStatus|null>(null)
 const [monitorBusy,setMonitorBusy]=useState(false)
 const preference=(id:AgentId):ProviderMode=>preferences[id]?.providerMode||'normal'
 const updateProvider=(id:AgentId,value:ProviderMode)=>{const next={...preferences,[id]:{providerMode:value}};setPreferences(next);localStorage.setItem(PREFS_KEY,JSON.stringify(next))}
 useEffect(()=>{let active=true;void requestAgentWorkspaceDefault().then(defaultPath=>{if(!active)return;const last=localStorage.getItem(WORKSPACE_KEY)||'';const draft=localStorage.getItem(WORKSPACE_DRAFT_KEY)||'';setWorkspace(last||draft||defaultPath);setWorkspaceReady(true)}).catch(error=>{if(active){setMessage(error instanceof Error?error.message:'EZ AI could not prepare its safe scratch workspace. Use Browse project folder.');setWorkspaceReady(true)}});return()=>{active=false}},[])
 useEffect(()=>{let active=true;void checkAerusUsageHud().then(value=>{if(active)setMonitor(value)}).catch(error=>{if(active)setMonitor({success:false,status:'unavailable',message:error instanceof Error?error.message:'The optional monitor could not be checked.'})});return()=>{active=false}},[])
 useEffect(()=>{const pending=localStorage.getItem('ez-ai-pending-agent-launch-r01');if(pending==='codex'||pending==='opencode'||pending==='claude-code'){localStorage.removeItem('ez-ai-pending-agent-launch-r01');setLaunchTarget(pending)}},[])
 const setWorkspaceValue=(value:string)=>{setWorkspace(value);localStorage.setItem(WORKSPACE_DRAFT_KEY,value)}
 const browseWorkspace=async()=>{setMessage('');setBusy(true);try{const picked=await browseAgentWorkspace(workspace);if(picked)setWorkspaceValue(picked)}catch(error){setMessage(error instanceof Error?error.message:'The Windows folder picker could not be opened.')}finally{setBusy(false)}}
 const modelsCount=discovery?.models.filter(item=>item.runtime.toLowerCase()==='ollama'&&!item.name.toLowerCase().endsWith(':cloud')).length||0
 const launchable=(id:AgentId,finding?:SoftwareFinding)=>preference(id)==='normal'?canLaunchLocalAgent(id,finding?.status,ollamaRuntime?.status,0,'normal'):canLaunchLocalAgent(id,finding?.status,ollamaRuntime?.status,modelsCount,'ollama-launch')&&['Installed','Running'].includes(ollamaCli?.status||'')
 const beginLaunch=async(id:AgentId)=>{setMessage('');setBusy(true);try{const canonical=await validateAgentWorkspace(workspace.trim());setWorkspace(canonical);setWorkspaceValue(canonical);setLaunchTarget(id)}catch(error){setMessage(error instanceof Error?error.message:'Choose a valid existing project folder before launch.')}finally{setBusy(false)}}
 const confirmLaunch=async()=>{
  if(!launchTarget)return
  setBusy(true);setMessage('')
  try{const result=await launchLocalAgent({agentId:launchTarget,workspace:workspace.trim(),providerMode:preference(launchTarget),approved:true});setMessage(result.message);localStorage.setItem(WORKSPACE_KEY,workspace.trim());setLaunchTarget(null)}
  catch(error){setMessage(error instanceof Error?error.message:'The selected agent could not be started.')}
  finally{setBusy(false)}
 }
 const openOllama=async()=>{setBusy(true);setMessage('');try{const result=await requestApplicationLaunch('ollama');setMessage(result.message);window.setTimeout(onScan,1200)}catch(error){setMessage(error instanceof Error?error.message:'Ollama Desktop could not be opened.')}finally{setBusy(false)}}
 const refreshMonitor=async()=>{setMonitorBusy(true);try{setMonitor(await checkAerusUsageHud())}catch(error){setMonitor({success:false,status:'unavailable',message:error instanceof Error?error.message:'The optional monitor could not be checked.'})}finally{setMonitorBusy(false)}}
 const openMonitor=async()=>{if(monitor?.message.toLowerCase().includes('unsigned')&&!window.confirm('Windows reports that this Aerus AI Usage HUD executable is unsigned. Open it only if you recognize this installation and trust its source. Continue?'))return;setMonitorBusy(true);setMessage('');try{const result=await requestApplicationLaunch('aerus-usage-hud');setMessage(result.message);await refreshMonitor()}catch(error){setMessage(error instanceof Error?error.message:'The Aerus AI Usage HUD could not be opened.')}finally{setMonitorBusy(false)}}
 const card=(id:AgentId,title:string,finding:SoftwareFinding|undefined,description:string,brand:string,docs:string)=>{
  const mode=preference(id),state=statusText(finding),ready=launchable(id,finding)
  const guide=id==='codex'?'codex':id==='claude-code'?'claude-code':'opencode'
  const unavailable=mode==='normal'&&!ready?`${title} CLI is not verified as installed. Refresh discovery or use its official setup guide.`:mode==='ollama'&&ollamaRuntime?.status!=='Running'?'Ollama’s local runtime is not running. Open Ollama Desktop, then refresh detection.':mode==='ollama'&&!['Installed','Running'].includes(ollamaCli?.status||'')?'The Ollama Windows CLI is not verified. Refresh discovery; the server status alone is not enough to launch.':null
  return <article className="local-agent-card" key={id}>
   <div className="local-agent-heading"><Brand name={brand}/><div className="local-agent-title"><b>{title}</b><span className={'local-agent-status '+(['Installed','Running'].includes(state)?'is-detected':'')}>{state}</span></div></div>
   <p>{description}</p>
   <label className="local-agent-field">Provider<select aria-label={`${title} provider`} value={mode} onChange={event=>updateProvider(id,event.target.value as ProviderMode)}><option value="normal">Normal provider · existing app configuration</option><option value="ollama">Local Ollama · native selector</option></select></label>
   <div className="agent-profile-note"><ShieldCheck size={13}/><span>{mode==='normal'?'Uses the agent’s existing provider setup and normal permission prompts. Launch opens an interactive terminal; EZ AI sends no prompt.':`Runs the verified Ollama CLI with “ollama launch ${id==='claude-code'?'claude':id}”. Ollama shows its own interactive selector. No model is preselected and no prompt is sent.`}</span></div>
   <div className="local-agent-actions"><button className="btn btn-cyan" type="button" disabled={!ready||busy||!workspaceReady} onClick={()=>beginLaunch(id)} title={!workspaceReady?'Preparing EZ AI scratch folder':unavailable||'Review the exact workspace before launch'}>{busy&&launchTarget===id?'Starting…':'Launch'} <ArrowRight size={13}/></button><button type="button" className="local-agent-learn" onClick={()=>onLearn(guide)}>Learn</button><a href={docs} target="_blank" rel="noreferrer">Official guide</a></div>
   {unavailable&&<small className="local-agent-unavailable">{unavailable}</small>}
  </article>
 }
 return <section className="local-coding-feature framed-panel" aria-labelledby="local-coding-title">
   <div className="local-coding-header"><div className="local-coding-mark"><Code2 size={20}/></div><div><span className="eyebrow">LOCAL AI / CODING WORKSPACE</span><h2 id="local-coding-title">Local AI Coding Center</h2><p>Choose an agent and provider, then launch it in a workspace you approve.</p></div><button className="btn btn-outline local-refresh" type="button" onClick={onScan} disabled={scanning}>{scanning?'Checking…':'Refresh status'}</button></div>
   <div className="local-provider-strip"><span className={'comfyui-led '+(ollamaRuntime?.status==='Running'?'online':'')}/><b>Ollama runtime</b><span>{statusText(ollamaRuntime)}</span><span className="local-provider-sep">·</span><span>{modelsCount} detected local model tags</span><small>{ollamaCli?.status==='Installed'?'Ollama CLI detected':'Desktop app and runtime are checked separately.'}</small>{ollamaRuntime?.status!=='Running'&&<button type="button" className="text-link" onClick={()=>void openOllama()} disabled={busy}>Open Ollama</button>}</div>
   <div className="local-workspace-field"><FolderOpen size={14}/><label htmlFor="agent-workspace-path">Project workspace</label><input id="agent-workspace-path" value={workspace} onChange={event=>setWorkspaceValue(event.target.value)} placeholder={workspaceReady?'Choose or enter an existing project folder':'Preparing safe scratch workspace…'} spellCheck={false}/><button type="button" className="btn btn-outline" onClick={()=>void browseWorkspace()} disabled={busy}>Browse project folder</button><small>Default: EZ AI’s per-user Scratch folder. The selected path is shown for your approval before the agent receives access.</small></div>
   <div className="local-agent-grid">{card('codex','Codex CLI',codex,'OpenAI’s command-line coding agent. The provider selector controls one direct launch route.','Codex','https://developers.openai.com/codex/cli')}{card('opencode','OpenCode',opencode,'Open-source coding agent. Local Ollama uses Ollama’s native integration selector.','OpenCode','https://opencode.ai/docs/providers/')}{card('claude-code','Claude Code',claude,'Anthropic’s coding CLI, separate from Claude Desktop.','Claude Code','https://docs.anthropic.com/en/docs/claude-code/overview')}</div>
   <section className="usage-hud-card" aria-label="Aerus AI Usage HUD"><div><span className="eyebrow">LOCAL COMPANION</span><h3>Aerus AI Usage HUD</h3><p>Opens the verified native dashboard for Codex, Claude and Ollama usage. EZ AI does not read its private usage data.</p><small>{monitorBusy?'Checking HUD…':monitor?.message||'Checking the bundled or installed HUD.'}</small></div><div className="usage-hud-actions"><button className="btn btn-outline" type="button" disabled={monitorBusy||!monitor?.success} onClick={()=>void openMonitor()}>{monitorBusy?'Working…':monitor?.status==='running'?'Restore HUD':'Open HUD'} <ArrowRight size={13}/></button><button className="btn btn-outline" type="button" disabled={monitorBusy} onClick={()=>void refreshMonitor()}>Refresh</button></div></section>
   <div className="local-coding-footnote"><Terminal size={13}/><span>Each Launch opens one interactive terminal after your approval. Ollama routes run the fixed documented “ollama launch” command and leave model choice to Ollama. No agent profile is relaxed and no global settings are changed.</span><button type="button" className="text-link" onClick={()=>onLearn('ollama')}>Learn about local models <BookOpen size={12}/></button></div>
   {message&&<div className="local-agent-message" role="status" aria-live="polite"><CircleAlert size={14}/><span>{message}</span><button type="button" onClick={()=>setMessage('')} aria-label="Dismiss message"><X size={13}/></button></div>}
  {launchTarget&&<div className="agent-confirm-backdrop" role="presentation"><section className="agent-confirm framed-panel" role="dialog" aria-modal="true" aria-labelledby="agent-confirm-title"><button type="button" className="agent-confirm-close" onClick={()=>setLaunchTarget(null)} aria-label="Cancel launch"><X size={16}/></button><span className="eyebrow">DIRECT USER APPROVAL REQUIRED</span><h3 id="agent-confirm-title">Launch {launchTarget==='codex'?'Codex CLI':launchTarget==='opencode'?'OpenCode':'Claude Code'}?</h3><dl><dt>Provider</dt><dd>{preference(launchTarget)==='normal'?'Existing provider configuration · normal permissions':`Ollama native selector · ollama launch ${launchTarget==='claude-code'?'claude':launchTarget}`}</dd><dt>Project folder</dt><dd>{workspace||'Workspace not available'}</dd><dt>Permission mode</dt><dd>Agent’s normal interactive approvals</dd></dl><p>The agent can access files in this exact folder after launch. EZ AI will not submit a prompt, change persistent agent settings, or enable unrestricted permissions.</p><div className="agent-confirm-actions"><button className="btn btn-outline" type="button" disabled={busy} onClick={()=>setLaunchTarget(null)}>Cancel</button><button className="btn btn-gold" type="button" disabled={busy||!workspace.trim()||!workspaceReady} onClick={()=>void confirmLaunch()}>{busy?'Verifying…':'Approve and Launch'} <ArrowRight size={13}/></button></div></section></div>}
 </section>
}
function Brand({name}:{name:string}){return <ProductBrand name={name} className="local-product-brand"/>}
