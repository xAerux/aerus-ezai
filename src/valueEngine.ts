import type { ValueModel, PlanRecord, ValueTask } from './valueCatalog.ts'
import { valueModels, valuePlans } from './valueCatalog.ts'

export interface CostExtras {cacheWriteTokens?:number;cacheLifetime?:string;regional?:boolean}
export interface CostResult { cacheWriteCostUsd?:number;regionalCostUsd?:number; modelId:string; costUsd:number|null; inputCostUsd:number|null; outputCostUsd:number|null; comparable:boolean; reason:string; rateLabel?:string; provider:string }
export interface BudgetResult { budgetUsd:number; recurringUsd:number; remainingUsd:number; overBudget:boolean; existingPlans:PlanRecord[]; suggestedPlan:PlanRecord|null; secondaryPlan:PlanRecord|null; localModelNames:string[]; explanation:string }
export const estimateApiCost=(model:ValueModel,inputTokens:number,outputTokens:number,cachedPercent=0,date=new Date().toISOString().slice(0,10),tier='Standard',maxPromptTokens=inputTokens,extras:CostExtras={}):CostResult=>{
 const base={modelId:model.id,provider:model.provider}
 if(model.status!=='Verified')return {...base,costUsd:null,inputCostUsd:null,outputCostUsd:null,comparable:false,reason:'Model identity or price is not verified; excluded from authoritative price estimates.'}
 if(![inputTokens,outputTokens,cachedPercent,maxPromptTokens].every(Number.isFinite)||inputTokens<0||maxPromptTokens<0||outputTokens<0||cachedPercent<0||cachedPercent>100)return {...base,costUsd:null,inputCostUsd:null,outputCostUsd:null,comparable:false,reason:'Enter non-negative token counts and a cached-input percentage from 0 to 100.'}
 const writes=extras.cacheWriteTokens??0
 if(!Number.isFinite(writes)||writes<0||writes>inputTokens*(1-cachedPercent/100)+1e-8)return {...base,costUsd:null,inputCostUsd:null,outputCostUsd:null,comparable:false,reason:'Cache reads and writes must be disjoint portions of total input.'}
 const requestedTier=tier
 const possible=model.pricing.filter(rate=>rate.status==='Verified'&&rate.effectiveFrom<=date&&(!rate.effectiveThrough||date<=rate.effectiveThrough)&& (requestedTier==='Standard'?rate.tier==='Standard':(rate.tier===requestedTier||(requestedTier==='Flex'&&rate.label.includes('Flex')))))
 if(!possible.length)return {...base,costUsd:null,inputCostUsd:null,outputCostUsd:null,comparable:false,reason:model.pricing.length?'Price requires verification for this date or tier.':'This billing route does not have a fixed token rate.'}
 let rate=possible.sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
 let rateLabel=rate.label
 const thresholdRate=possible.find(item=>item.longContextThreshold)
 const isLong=(r:typeof rate)=>r.longContextThreshold!=null&&(r.longContextInclusive?maxPromptTokens>=r.longContextThreshold:maxPromptTokens>r.longContextThreshold)
 if(thresholdRate&&isLong(thresholdRate)){
  if(rate===thresholdRate){ rateLabel=`${rate.label} · long-context rates`; }
  else if(rate.label.includes('≤')){rate=thresholdRate;rateLabel=rate.label}
 }
 const inputRate=isLong(rate)?rate.longInputUsdPerMillion:rate.inputUsdPerMillion
 const cachedRate=isLong(rate)?rate.longCachedInputUsdPerMillion:rate.cachedInputUsdPerMillion
 const outputRate=isLong(rate)?rate.longOutputUsdPerMillion:rate.outputUsdPerMillion
 if(inputRate==null||outputRate==null||(cachedPercent>0&&cachedRate==null))return {...base,costUsd:null,inputCostUsd:null,outputCostUsd:null,comparable:false,reason:'This catalog record does not publish every rate needed for the selected workload.'}
 const cachedTokens=inputTokens*cachedPercent/100
 const regularTokens=inputTokens-cachedTokens-writes
 let writeRate=rate.cacheWriteRates?.[extras.cacheLifetime||'']
 if(writes>0&&writeRate==null)return {...base,costUsd:null,inputCostUsd:null,outputCostUsd:null,comparable:false,reason:'Cache-write rate is not verified for this exact tier and lifetime.'}
 if(extras.regional&&rate.regionalPremium==null)return {...base,costUsd:null,inputCostUsd:null,outputCostUsd:null,comparable:false,reason:'Regional uplift is not verified for this route.'}
 if(writeRate!=null&&isLong(rate))writeRate*=inputRate/rate.inputUsdPerMillion!
 const cacheWriteCostUsd=writes*(writeRate??0)/1_000_000
 const inputCostUsd=(regularTokens*inputRate+cachedTokens*(cachedRate??inputRate))/1_000_000+cacheWriteCostUsd
 const outputCostUsd=outputTokens*outputRate/1_000_000
 const regionalCostUsd=extras.regional?(inputCostUsd+outputCostUsd)*rate.regionalPremium!:0
 return {...base,costUsd:inputCostUsd+outputCostUsd+regionalCostUsd,inputCostUsd,outputCostUsd,cacheWriteCostUsd,regionalCostUsd,comparable:true,reason:'Token estimate only; tools, storage, regional uplifts, subscription limits, and retries may add cost.',rateLabel}
}
export const compareModels=(ids:string[],task:ValueTask,models=valueModels)=>models.filter(model=>ids.includes(model.id)).map(model=>({model,taskMatch:model.tasks.includes(task),benchmarkEvidence:model.benchmarks.filter(item=>item.task===task&&item.testedModelId===model.officialModelId),apiComparable:model.pricing.some(item=>item.status==='Verified')}))
export const budgetAdvisor=(budgetUsd:number,existingPlanIds:string[],task:ValueTask,workflow:'Cloud first'|'Local first'|'Balanced',localModels:string[],plans=valuePlans):BudgetResult=>{
 const budget=Number.isFinite(budgetUsd)&&budgetUsd>=0?budgetUsd:0
 const existingPlans=plans.filter(plan=>existingPlanIds.includes(plan.id)&&plan.monthlyUsd!=null&&plan.status==='Verified')
 const recurringUsd=existingPlans.reduce((sum,plan)=>sum+plan.monthlyUsd!,0)
 const providers=task==='Programming'||task==='Web development'?['OpenAI / ChatGPT','Anthropic / Claude','Google AI','X Subscription','Ollama Cloud']:task==='Book writing'||task==='Long-document editing'?['Anthropic / Claude','OpenAI / ChatGPT','Google AI']:['OpenAI / ChatGPT','Google AI','Anthropic / Claude','X Subscription']
 const already=existingPlans.find(plan=>providers.some(provider=>plan.provider.startsWith(provider.split(' / ')[0])))
 const candidates=plans.filter(plan=>providers.some(provider=>plan.provider.startsWith(provider.split(' / ')[0]))&&plan.status==='Verified'&&plan.availability==='Current'&&plan.monthlyUsd!=null&&plan.monthlyUsd>0&&!existingPlans.some(item=>item.id===plan.id)).sort((a,b)=>a.monthlyUsd!-b.monthlyUsd!)
 const suggestedPlan=already?null:(candidates.find(plan=>recurringUsd+plan.monthlyUsd!<=budget)|| (budget===0?plans.find(plan=>providers.some(provider=>plan.provider.startsWith(provider.split(' / ')[0]))&&plan.monthlyUsd===0&&plan.status==='Verified')||null:null))
 const secondaryPlan=suggestedPlan&&workflow!=='Local first'?candidates.find(plan=>plan.id!==suggestedPlan.id&&plan.provider!==suggestedPlan.provider&&recurringUsd+suggestedPlan.monthlyUsd!+plan.monthlyUsd!<=budget)||null:null
 const local=workflow==='Cloud first'?[]:localModels
 const suggestedCost=(suggestedPlan?.monthlyUsd||0)+(secondaryPlan?.monthlyUsd||0)
 const total=recurringUsd+suggestedCost
 const explanation=already?`An entered ${already.provider} plan already covers a relevant cloud option; subscription access does not include API credits.`:suggestedPlan?`A ${suggestedPlan.provider} ${suggestedPlan.name} plan is a candidate within budget. Plan limits vary; this is not a guarantee of workload capacity.`:workflow==='Local first'&&local.length?`No additional paid plan fits after existing costs. Use a detected local model where its verified task capability and hardware fit are suitable.`:'No verified candidate plan fits after the existing subscriptions you entered. Consider a free tier or adjust the budget.'
 return {budgetUsd:budget,recurringUsd:total,remainingUsd:budget-total,overBudget:total>budget,existingPlans,suggestedPlan,secondaryPlan,localModelNames:local,explanation}
}
export const formatUsd=(value:number|null)=>value==null?'Not directly comparable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:value!==0&&Math.abs(value)<.01?4:2,maximumFractionDigits:value!==0&&Math.abs(value)<.01?4:2}).format(value)
