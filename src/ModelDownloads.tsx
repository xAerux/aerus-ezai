import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Box, CheckCircle2, CircleAlert, Download, HardDrive, RefreshCw, X } from 'lucide-react'
import type { HardwareScanResult } from './hardwareScan'
import type { DiscoveryResult } from './softwareDiscovery'
import { formatBytes } from './hardwareScan'
import { cancelModelDownload, checkComfyWorkflowNodes, requestModelJobs, retryModelDownload, startModelDownload, verifyModelDownload } from './modelManagement'
import type { ModelDownloadJob } from './modelManagement'
import { catalogHardwareFit, isCatalogEntryInstalled, localCategories, localModelCatalog, localModelCatalogVersion, modelStorageSummary, workflowReadiness } from './localModelCatalog'
import { requestApplicationLaunch } from './appActions'
import ComfyUiBrand from './ComfyUiBrand'
import {useStored} from './uiState'
import LocalCodingCenter from './LocalCodingCenter'

interface Props { discovery:DiscoveryResult|null;hardware:HardwareScanResult|null;onScan:()=>void;scanning:boolean;onLearn:(topic:string)=>void }
const terminal=(status:string)=>['Installed','Already Installed','Failed','Canceled','Needs Verification','Unsupported'].includes(status)

export default function ModelDownloads({discovery,hardware,onScan,scanning,onLearn}:Props){
 const [workspace,setWorkspace]=useStored('ez-ai-model-workspace-r01','Model catalog')
 const models=discovery?.models||[]
 const [category,setCategory]=useState<string>(()=>localStorage.getItem('ez-ai-download-category-v1')||'All')
 const [jobs,setJobs]=useState<ModelDownloadJob[]>([])
 const [selectedId,setSelectedId]=useState('')
 const [message,setMessage]=useState('')
 const [busy,setBusy]=useState(false)
 const [jobError,setJobError]=useState('')
 const [workflowChecks,setWorkflowChecks]=useState<Record<string,{availableNodes:string[]|null;message:string;loading:boolean}>>({})
 const [comfyLaunching,setComfyLaunching]=useState(false)
 const refreshed=useRef(new Set<string>())
 const selected=localModelCatalog.find(item=>item.id===selectedId)||null
 const summary=useMemo(()=>modelStorageSummary(models,hardware),[models,hardware])
 const freeFirst=localStorage.getItem('ez-ai-free-first-v1')==='true'
 const runtimes=discovery?.runtimes||[]
 const runtimeStatus=(name:string)=>runtimes.find(item=>item.name.toLowerCase()===name.toLowerCase()||item.id.toLowerCase()===name.toLowerCase())?.status||'Not Detected'
 const comfyModels=models.filter(model=>model.runtime==='ComfyUI')
 const comfyKnownBytes=comfyModels.reduce((sum,model)=>sum+(model.sizeBytes||0),0)
 const comfyRuntimeStatus=discovery?runtimeStatus('comfyui-local'):'Not scanned'
 const comfyDesktop=discovery?.applications.find(item=>item.id==='app-comfyui-desktop')
 const comfyDesktopStatus=comfyDesktop?.status||(!discovery?'Not scanned':discovery.status==='partial'?'Scan incomplete':'Not detected in checked locations')
 const comfyLaunchReady=Boolean(comfyDesktop&&(comfyDesktop.status==='Installed'||comfyDesktop.status==='Running')&&comfyDesktop.location?.toLowerCase().endsWith('.exe'))
 const openComfyDesktop=async()=>{if(!comfyLaunchReady)return;setComfyLaunching(true);setMessage('Verifying the signed ComfyUI Desktop application…');try{const result=await requestApplicationLaunch('comfyui-desktop');setMessage(result.message);onScan()}catch(error){setMessage(error instanceof Error?error.message:'ComfyUI Desktop could not be opened. Use its verified Windows shortcut or official setup guidance.')}finally{setComfyLaunching(false)}}
 const refreshJobs=async()=>{try{setJobs(await requestModelJobs());setJobError('')}catch(error){setJobError(error instanceof Error?error.message:'Model queue is unavailable in the current app build.')}}
 useEffect(()=>{let alive=true;const refresh=async()=>{try{const value=await requestModelJobs();if(alive){setJobs(value);setJobError('')}}catch(error){if(alive)setJobError(error instanceof Error?error.message:'Model queue is unavailable.')}};void refresh();const timer=window.setInterval(()=>void refresh(),1500);return()=>{alive=false;window.clearInterval(timer)}},[])
 useEffect(()=>{for(const job of jobs){if(job.installedVerified&&!refreshed.current.has(job.jobId)){refreshed.current.add(job.jobId);onScan()}}},[jobs,onScan])
 const chooseCategory=(value:string)=>{setCategory(value);localStorage.setItem('ez-ai-download-category-v1',value)}
 const start=async(retryJob?:ModelDownloadJob)=>{
  if(!selected)return
  setBusy(true);setMessage('')
  try{const job=retryJob?await retryModelDownload(retryJob.jobId,true):await startModelDownload(selected.id,true);setJobs(current=>[job,...current.filter(item=>item.jobId!==job.jobId)]);setSelectedId('');setMessage(job.message);void refreshJobs()}
  catch(error){setMessage(error instanceof Error?error.message:'Download could not be started.')}
  finally{setBusy(false)}
 }
 const cancel=async(job:ModelDownloadJob)=>{try{await cancelModelDownload(job.jobId);void refreshJobs()}catch(error){setMessage(error instanceof Error?error.message:'Cancellation could not be requested.')}}
 const verify=async(job:ModelDownloadJob)=>{try{const result=await verifyModelDownload(job.jobId);setJobs(current=>[result,...current.filter(item=>item.jobId!==result.jobId)]);setMessage(result.message);if(result.installedVerified)onScan()}catch(error){setMessage(error instanceof Error?error.message:'Inventory verification failed.')}}
 const checkWorkflow=async(entry:typeof localModelCatalog[number])=>{setWorkflowChecks(current=>({...current,[entry.id]:{availableNodes:null,message:'Checking the local ComfyUI node catalog…',loading:true}}));try{const result=await checkComfyWorkflowNodes(entry.id);setWorkflowChecks(current=>({...current,[entry.id]:{availableNodes:result.checkedNodes?result.availableNodes:null,message:result.message,loading:false}}))}catch(error){setWorkflowChecks(current=>({...current,[entry.id]:{availableNodes:null,message:error instanceof Error?error.message:'ComfyUI readiness could not be checked.',loading:false}}))}}
 const installed=(entry:typeof localModelCatalog[number])=>isCatalogEntryInstalled(entry,models)
 const available=(entry:typeof localModelCatalog[number])=>entry.runtime==='ComfyUI'||(entry.runtime==='Ollama'?runtimeStatus('Ollama')==='Running':runtimeStatus('LM Studio local server')==='Running')
 const latestJob=(entry:typeof localModelCatalog[number])=>jobs.find(job=>job.catalogId===entry.id)
 const visible=localModelCatalog.filter(entry=>category==='All'||(category==='ComfyUI'?entry.runtime==='ComfyUI':entry.categories.includes(category as never)))
 const approve=(entry:typeof localModelCatalog[number])=>{setSelectedId(entry.id);setMessage('')}
 return <section className="model-manager framed-panel" data-model-workspace={workspace}>
  <div className="manager-heading"><div><span className="eyebrow">LOCAL MODEL CATALOG / {localModelCatalogVersion}</span><h2>Discover and manage local models</h2><small>Ollama pulls are available after review and explicit approval. Model files remain managed by their runtime.</small></div><button className="btn btn-outline" type="button" onClick={onScan} disabled={scanning}><RefreshCw size={13} className={scanning?'spin':''}/>{scanning?'Refreshing':'Refresh inventory'}</button></div>
  <nav className='workspace-tabs' aria-label='My Models workspace'>{['Model catalog','Local Coding','Creative AI'].map(w=><button key={w} aria-pressed={workspace===w} className={workspace===w?'active':''} onClick={()=>setWorkspace(w)}>{w}</button>)}</nav><div className="local-workspace-grid" aria-label="Local coding and creative AI workspaces">
  {workspace==='Local Coding'&&<LocalCodingCenter discovery={discovery} hardware={hardware} onScan={onScan} scanning={scanning} onLearn={onLearn}/>}
  {workspace==='Creative AI'&&<section className="comfyui-feature" aria-labelledby="comfyui-feature-title">
   <div className="comfyui-feature-copy"><div className="comfyui-feature-title-row"><ComfyUiBrand/><div><span className="eyebrow">LOCAL CREATIVE WORKSPACE / COMFYUI DESKTOP</span><h2 id="comfyui-feature-title">Build and run creative workflows locally.</h2></div></div><p>Explore image, video, audio and 3D workflows built around ComfyUI. Your files stay in their existing model folders; EZ AI only reads the inventory reported by discovery. Optional partner or hosted services may require separate accounts or payment.</p><div className="comfyui-feature-facts"><span><b>Desktop</b>{comfyDesktopStatus}</span><span><i className={'comfyui-led '+(comfyRuntimeStatus==='Running'?'online':'')}/><b>Local backend</b>{comfyRuntimeStatus}</span><span><b>Workflow readiness</b>Checked per guide</span><span><Box size={14}/>{comfyModels.length} detected model assets</span><span><HardDrive size={14}/>{comfyKnownBytes?formatBytes(comfyKnownBytes):'Unknown'} known size</span></div></div>
   <div className="comfyui-feature-actions">{comfyLaunchReady?<button className="comfyui-feature-action" type="button" disabled={comfyLaunching} onClick={()=>void openComfyDesktop()}><span className="comfyui-action-icon"><ComfyUiBrand/></span><span><b>{comfyLaunching?'Verifying…':'Open ComfyUI Desktop'}</b><small>Open the verified installed application</small></span><ArrowRight size={20}/></button>:<a className="comfyui-feature-action" href="https://comfy.org/download" target="_blank" rel="noreferrer"><span className="comfyui-action-icon"><ComfyUiBrand/></span><span><b>Official ComfyUI setup guidance</b><small>{comfyDesktopStatus==='Installed'||comfyDesktopStatus==='Running'?'A safe native launch target is unavailable. View Comfy Org’s guidance.':comfyDesktopStatus==='Not scanned'?'Desktop installation has not been scanned. View official guidance.':'View official Windows setup guidance.'}</small></span><ArrowRight size={20}/></a>}<button className="comfyui-feature-action comfyui-workflow-action" type="button" onClick={()=>{setWorkspace('Creative AI');chooseCategory('ComfyUI');document.getElementById('local-model-catalog')?.scrollIntoView({behavior:'smooth',block:'start'})}}><span className="comfyui-action-icon"><Box size={26}/></span><span><b>Explore Workflows</b><small>Browse requirements and readiness guides</small></span><ArrowRight size={20}/></button></div>
  </section>}
  </div>
  {workspace!=='Local Coding'&&<>
  <div className="storage-summary"><span><HardDrive size={14}/> Detected model storage</span><b>{summary.knownRecords} known records · {summary.totalBytes?formatBytes(summary.totalBytes):'size unknown'} total</b>{summary.byDrive.map(item=><small key={item.drive}>{item.drive}: {formatBytes(item.bytes)} detected · {item.availableBytes==null?'free space unknown':formatBytes(item.availableBytes)+' available'}</small>)}<small>Read-only estimate from verified inventory metadata. No model file contents are read.</small></div>
  <div className="model-filters manager-filters" aria-label="Model categories">{localCategories.map(value=><button type="button" key={value} aria-pressed={category===value} className={category===value?'active':''} onClick={()=>chooseCategory(value)}>{value}</button>)}<button type="button" aria-pressed={category==='ComfyUI'} className={category==='ComfyUI'?'active comfyui-filter':''} onClick={()=>chooseCategory('ComfyUI')}>ComfyUI</button></div>
  {freeFirst&&<div className="free-first-note"><CheckCircle2 size={14}/> Free First is on: local options are shown separately from hosted offers. Local inference avoids metered API token fees, but still uses electricity and your hardware.</div>}
  {message&&<div className="model-operation-message" role="status" aria-live="polite"><span>{message}</span><button type="button" className="text-link" onClick={()=>setMessage('')} aria-label="Dismiss message"><X size={13}/></button></div>}
  {jobError&&<div className="model-operation-message warning" role="status"><CircleAlert size={14}/>{jobError}</div>}
  <div className="model-catalog-grid" id="local-model-catalog">{visible.map(entry=>{
    const fit=catalogHardwareFit(entry,hardware)
    const job=latestJob(entry)
    const exists=installed(entry)
    const readiness=workflowChecks[entry.id]
    const readinessResult=entry.kind==='creative-workflow'?workflowReadiness(entry,models,runtimeStatus('comfyui-local')==='Running',readiness?.availableNodes??null):null
    const status=exists?'Installed · '+entry.runtime:job?.status||((entry.runtime==='ComfyUI'?'Guided workflow':available(entry)?'Available':'Runtime unavailable'))
    return <article className="catalog-model-card" key={entry.id}>
      <div className="catalog-model-top"><span className="model-box"><Box size={16}/></span><div><b>{entry.name}</b><small>{entry.runtime} · {entry.categories.join(' / ')}</small></div><strong className={'catalog-status '+(exists?'is-installed':'')}>{status}</strong></div>
      <div className="catalog-model-meta"><span>{entry.sizeBytes==null?'Download size unknown':'About '+formatBytes(entry.sizeBytes)}</span><span>{entry.quantization||entry.parameters||'Precision unknown'}</span><span>{fit.status}</span></div>
      <p>{entry.note}</p>
      <details><summary>Requirements, license &amp; evidence</summary><div className="catalog-model-details"><b>Canonical identity</b><span>{entry.canonicalId}</span><b>Hardware</b><span>{fit.explanation} {entry.hardwareRequirement}</span><b>Evidence</b><span>{entry.hardwareEvidence}</span><b>License</b><span>{entry.license}</span><b>Verified</b><span>{entry.verifiedAt} · <a href={entry.sourceUrl} target="_blank" rel="noreferrer">Catalog source</a> · <a href={entry.docsUrl} target="_blank" rel="noreferrer">Documentation</a></span></div></details>
      {entry.kind==='creative-workflow'&&<div className="workflow-dependencies"><b>Workflow components</b>{entry.requiredAssets.length?entry.requiredAssets.map(asset=><small key={asset.name}>{asset.name} · models/{asset.folder} · size unknown</small>):<small>This is a hosted partner workflow; no local model file is catalogued.</small>}<div className="workflow-state">Readiness: {readinessResult?.status||'Unknown'} · {readinessResult?.explanation||'Check the local node catalog when ComfyUI is running.'}<small>{readiness?.message||'EZ AI does not infer readiness from filenames or start a workflow.'}</small><button className="btn btn-outline" type="button" onClick={()=>void checkWorkflow(entry)} disabled={workflowChecks[entry.id]?.loading||runtimeStatus('comfyui-local')!=='Running'} title={runtimeStatus('comfyui-local')!=='Running'?'Start ComfyUI and refresh detection first.':'Read-only check of fixed node IDs.'}>{workflowChecks[entry.id]?.loading?'Checking…':'Check readiness'}</button></div></div>}
      {entry.runtime!=='ComfyUI'&&<div className="catalog-model-action">{exists?<span className="model-action-note">Already present in detected inventory. No duplicate pull is offered.</span>:job&&!terminal(job.status)?<><button className="btn btn-outline" type="button" disabled>View progress</button>{job.cancellable&&<button className="btn btn-outline" type="button" onClick={()=>void cancel(job)}>Cancel</button>}</>:job?.status==='Installed'?<span className="model-action-note">Installed after runtime inventory verification.</span>:job?.status==='Needs Verification'?<button className="btn btn-outline" type="button" onClick={()=>void verify(job)}>Verify inventory</button>:job?.retryAllowed?<button className="btn btn-gold-outline" type="button" onClick={()=>approve(entry)}>Review retry</button>:entry.runtime==='LM Studio'?<a className="btn btn-outline" href="https://lmstudio.ai/docs/cli/local-models/get" target="_blank" rel="noreferrer">Use official LM Studio workflow <ArrowRight size={12}/></a>:!available(entry)?<button className="btn btn-outline" type="button" onClick={onScan} disabled={scanning}>Verify Ollama runtime <RefreshCw size={12}/></button>:<button className="btn btn-gold-outline" type="button" onClick={()=>approve(entry)}><Download size={13}/>Review download</button>}</div>}
    </article>
  })}</div>
  <div className="workflow-boundary"><b>Creative workflow downloads stay in their runtime's guide.</b><span>ComfyUI image, video, audio, and 3D entries show documented components. EZ AI does not modify shared folders or claim an end-to-end workflow is ready.</span></div>
  {jobs.length>0&&<section className="model-download-queue"><div><b>Model download queue</b><small>Only runtime-reported transfer bytes are shown. Installed means a fresh runtime inventory confirmed the model.</small></div>{jobs.map(job=><article key={job.jobId} className="model-job-row"><div><b>{job.model}</b><small>{job.runtime} · {job.status} · {job.message}</small></div><span>{job.totalBytes?formatBytes(job.downloadedBytes)+' / '+formatBytes(job.totalBytes):job.downloadedBytes?formatBytes(job.downloadedBytes):'Waiting for runtime progress'}{job.bytesPerSecond?' · '+formatBytes(job.bytesPerSecond)+'/s':''}</span>{job.progressPercent!=null&&<progress value={job.progressPercent} max="100" aria-label={job.model+' download progress'}/ >}{job.retryAllowed&&<button className="btn btn-gold-outline" type="button" disabled={busy} onClick={()=>{const entry=localModelCatalog.find(item=>item.id===job.catalogId);if(entry){setSelectedId(entry.id);setMessage('')}}}>Review retry</button>}</article>)}</section>}
  <div className="workflow-boundary"><b>LM Studio note</b><span>Its official REST API can download models, but this catalog does not have a verified pre-download artifact size for its model identifiers. EZ AI links to LM Studio's official guided workflow rather than risk starting an un-preflighted transfer.</span></div>
  </>}
  {selected&&<div className="model-approval-backdrop" role="presentation"><section className="model-approval framed-panel" role="dialog" aria-modal="true" aria-labelledby="model-approval-title"><button className="model-approval-close" type="button" onClick={()=>setSelectedId('')} aria-label="Close review"><X size={16}/></button><span className="eyebrow">DOWNLOAD REVIEW / EXPLICIT APPROVAL</span><h3 id="model-approval-title">Download {selected.name}?</h3><p>Runtime: {selected.runtime} · exact identifier <b>{selected.canonicalId}</b></p><p>Publisher/source: {selected.publisher} · {selected.sourceUrl}</p><p>Runtime-reported model location: {models.find(model=>model.runtime===selected.runtime)?.location||'Runtime-managed location was not reported'}</p><p>Approximate artifact size: {selected.sizeBytes==null?'Unknown':formatBytes(selected.sizeBytes)+' from the official model listing; the runtime progress reports actual bytes.'}</p><p>Hardware: {selected.hardwareRequirement}. File size is not inference memory or a performance estimate.</p><p>License: {selected.license}</p><p>EZ AI sends only this fixed model identifier to the selected local runtime. No prompt or project files are sent.</p><div className="model-approval-actions"><button className="btn btn-outline" type="button" onClick={()=>setSelectedId('')}>Cancel</button><button className="btn btn-gold" type="button" disabled={busy||!available(selected)} onClick={()=>void start(latestJob(selected)?.retryAllowed?latestJob(selected):undefined)}>{busy?'Starting…':'Approve & download'}</button></div></section></div>}
 </section>
}
