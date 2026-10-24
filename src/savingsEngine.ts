import type {ValueModel} from './valueCatalog.ts'
import {estimateApiCost} from './valueEngine.ts'
import {pricingCurrent} from './pricingCalculations.ts'
export interface SavingWorkload {input:number;output:number;cachedPercent:number;writes:number;lifetime:string;tier:string;tasks:number;attempts:number;regional:boolean;extraUnits:number;extraRate:number}
export const defaultSavingWorkload:SavingWorkload={input:12000,output:2000,cachedPercent:0,writes:0,lifetime:'30 minutes',tier:'Standard',tasks:100,attempts:1,regional:false,extraUnits:0,extraRate:0}
export const savingPresets=[{id:'programming',name:'Programming · focused change',input:12000,output:2000},{id:'research',name:'Research · document analysis',input:50000,output:4000},{id:'writing',name:'Writing · chapter revision',input:20000,output:6000}]
export function savingEstimate(model:ValueModel,w:SavingWorkload,date=new Date().toISOString().slice(0,10)){
 const invalid=![w.input,w.output,w.cachedPercent,w.writes,w.tasks,w.attempts,w.extraUnits,w.extraRate].every(Number.isFinite)||[w.input,w.output,w.writes,w.tasks,w.extraUnits,w.extraRate].some(n=>n<0)||w.attempts<1||w.cachedPercent<0||w.cachedPercent>100
 if(invalid)return {request:null,monthly:null,reason:'Use finite non-negative values; average attempts must be at least one.',tokenCost:null}
 if(!pricingCurrent(model,date))return {request:null,monthly:null,reason:'This record needs verification; the snapshot is over 30 days old or identity is unverified.',tokenCost:null}
 const tokenCost=estimateApiCost(model,w.input,w.output,w.cachedPercent,date,w.tier,w.input,{cacheWriteTokens:w.writes,cacheLifetime:w.lifetime,regional:w.regional})
 if(tokenCost.costUsd==null)return {request:null,monthly:null,reason:tokenCost.reason,tokenCost}
 const request=tokenCost.costUsd+w.extraUnits*w.extraRate,monthly=request*w.tasks*w.attempts
 if(!Number.isFinite(monthly)||!Number.isFinite(request))return {request:null,monthly:null,reason:'Workload is too large to calculate safely.',tokenCost:null}
 return {request,monthly,reason:'Scenario estimate, not a provider quote. Each attempt uses the same stated workload; retries may differ.',tokenCost}
}
export const savingsDelta=(baseline:number|null,candidate:number|null)=>baseline==null||candidate==null?null:baseline-candidate
export function cacheLifetimes(model:ValueModel,tier:string){return [...new Set(model.pricing.filter(r=>r.tier===tier).flatMap(r=>Object.keys(r.cacheWriteRates||{})))]}
