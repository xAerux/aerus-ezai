import SaveMoney from './SaveMoney'
import ModelModes from './ModelModes'
import CreativeCosts from './CreativeAdvisor'
import { useState } from 'react'
import { valueModels, valueTasks, providerNames, catalogVerifiedAt } from './valueCatalog'
import type { ValueTask } from './valueCatalog'
import type { DiscoveryResult, ModelFinding } from './softwareDiscovery'
import type { HardwareScanResult } from './hardwareScan'
import { useStored } from './uiState'
import ModelCompare from './ModelCompare'
import ModelBrowser from './ModelBrowser'
import {browseModels, selectComparison} from './modelDiscovery'
import type {AccessFilter} from './modelDiscovery'
import { PricingPlans, PricingBudget, FreeDirectory } from './PricingExtras'
const views=['Compare Models','Intelligence & Value','Compare Plans','Budget Advisor','Free AI','Model Modes & Reasoning','Save Money']
export interface PricingProps {models:ModelFinding[];hardware:HardwareScanResult|null;discovery:DiscoveryResult|null;onModels?:()=>void;onLearn?:(topic:string)=>void}
export default function PricingWorkspace(props:PricingProps){
 const [showBrowser,setShowBrowser]=useStored('ez-ai-pricing-browser-r01',false)
 const [costMode,setCostMode]=useStored('ez-ai-cost-domain-v1','Language models')
 const [savedView,setView]=useStored('ez-ai-value-view-v1','Compare Models')
 const view=({'Costs':views[0],'Intelligence & value':views[1],'Compare plans':views[2],'Budget advisor':views[3],'Free AI options':views[4]} as Record<string,string>)[savedView]|| (views.includes(savedView)?savedView:views[0])
 const [provider,setProvider]=useStored('ez-ai-value-provider-v1','All providers'),[task,setTask]=useStored('ez-ai-value-task-v1','Programming'),[search,setSearch]=useStored('ez-ai-pricing-search-v2',''),[mode,setMode]=useStored('ez-ai-value-mode-v1','Explore all')
 const [ids,setIds]=useStored<string[]>('ez-ai-value-models-v1',valueModels.filter(m=>m.pricing.length).slice(0,4).map(m=>m.id))
 const selected=ids.filter(id=>valueModels.some(m=>m.id===id)),[message,setMessage]=useState('')
 const detected=[...(props.discovery?.applications||[]),...(props.discovery?.codingAgents||[]),...(props.discovery?.runtimes||[])].filter(x=>['Installed','Running'].includes(x.status)).map(x=>x.name.toLowerCase()).join(' ')
 const access:AccessFilter=mode==='Explore all'||mode==='Compare'?'All Models':(['All Models','My AIs','Free','Local'].includes(mode)?mode as AccessFilter:'All Models')
 const eligible=browseModels(valueModels,access,detected).filter(m=>(provider==='All providers'||m.provider===provider)&&(task==='All tasks'||m.tasks.includes(task as ValueTask))&&`${m.name} ${m.officialModelId} ${m.provider}`.toLowerCase().includes(search.toLowerCase()))
 const toggle=(id:string)=>{const next=selectComparison(selected,id);setIds(next);setMessage('')}
 return <section className="pricing-workspace"><header className="workspace-heading"><div><span className="eyebrow">PRICING / OFFLINE SNAPSHOT</span><h1>Find the right AI for your budget.</h1><p>API costs, subscriptions, free options and local alternatives. Catalog reviewed {catalogVerifiedAt}; see each record’s date and conditions.</p></div></header><nav className="workspace-tabs" aria-label="Pricing views">{views.map(v=><button type="button" key={v} className={view===v?'active':''} aria-current={view===v?'page':undefined} onClick={()=>setView(v)}>{v}</button>)}</nav>
 {view==='Compare Models'&&<div className='pricing-toolbar'><label>Compare<select aria-label='Comparison domain' value={costMode} onChange={e=>setCostMode(e.target.value)}><option>Language models</option><option>Creative generation</option></select></label></div>}{view==='Compare Models'&&costMode==='Creative generation'&&<CreativeCosts/>}{(['Compare Models','Intelligence & Value'].includes(view)&&(view!=='Compare Models'||costMode!=='Creative generation'))&&<><div className="pricing-toolbar"><label>Access filter<select value={access} onChange={e=>setMode(e.target.value)}><option>All Models</option><option>My AIs</option><option>Free</option><option>Local</option></select></label><label>Task<select value={task} onChange={e=>setTask(e.target.value)}><option>All tasks</option>{valueTasks.map(t=><option key={t}>{t}</option>)}</select></label><label>Provider<select value={provider} onChange={e=>setProvider(e.target.value)}><option>All providers</option>{providerNames.map(p=><option key={p}>{p}</option>)}</select></label><label className="grow">Search models<input aria-label="Search pricing models" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, official ID or provider"/></label></div>{mode==='My AIs'&&<p className="workspace-note">{props.discovery?'Detected installations highlight relevant providers; they do not confirm a paid plan.':'Not Scanned: use Home to discover applications, or choose Explore all.'}</p>}{access==='Free'&&<p className="workspace-note">Free local routes have no per-token API fee. Hosted offers have separate limits and privacy terms in Free AI.</p>}<div className="pricing-browse-switch"><button className={showBrowser?'active':''} aria-pressed={showBrowser} onClick={()=>setShowBrowser(true)}>Browse All Models</button><button className={!showBrowser?'active':''} aria-pressed={!showBrowser} onClick={()=>setShowBrowser(false)}>Compare Selected Models ({selected.length})</button></div>{showBrowser&&<ModelBrowser models={eligible} selected={selected} toggle={toggle} onFree={()=>setView('Free AI')}/>}<h2>Compare Selected Models</h2><div className="selection-chips">{selected.map(id=><button key={id} onClick={()=>toggle(id)} aria-label={`Remove ${valueModels.find(m=>m.id===id)?.name}`}>{valueModels.find(m=>m.id===id)?.name} ×</button>)}<span role="status">{message}</span></div><ModelCompare ids={selected} intelligence={view==='Intelligence & Value'} task={task} expanded={mode==='Compare'} onLearn={props.onLearn}/></>}
 {view==='Save Money'&&<SaveMoney {...props}/>}{view==='Model Modes & Reasoning'&&<ModelModes/>}{view==='Compare Plans'&&<PricingPlans onTrackPlans={()=>{localStorage.setItem('ez-ai-budget-manager-open-v1','true');setView('Budget Advisor')}}/>}{view==='Budget Advisor'&&<PricingBudget {...props}/>}{view==='Free AI'&&<FreeDirectory {...props}/>}
 </section>
}
