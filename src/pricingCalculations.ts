import { estimateApiCost } from './valueEngine.ts'
import type { PlanRecord, ValueModel } from './valueCatalog.ts'
export function budgetPlansForPreference(plans:PlanRecord[],existing:string[],freeFirst:boolean){
 return plans.filter(p=>existing.includes(p.id)||(!freeFirst||p.monthlyUsd===0))
}
export const workloadPresets=[
 {id:'light',label:'Light everyday use',input:100000,output:25000,prompt:8000},
 {id:'regular',label:'Regular AI use',input:1000000,output:250000,prompt:32000},
 {id:'heavy',label:'Heavy coding / research',input:10000000,output:2500000,prompt:128000},
]
export function pricingCurrent(model:ValueModel,date=new Date().toISOString().slice(0,10)){
 const age=(Date.parse(date)-Date.parse(model.verifiedAt))/86400000
 return model.status==='Verified'&&Number.isFinite(age)&&age>=0&&age<=30
}
export function comparisonRows(models:ValueModel[],ids:string[],input:number,output:number,cached:number,tier:string,prompt:number,ascending=true,metric='Total cost'){
 return models.filter(model=>ids.includes(model.id)).map(model=>({model,cost:estimateApiCost(model,input,output,cached,undefined,tier,prompt)})).sort((a,b)=>{
 const get=(row:typeof a)=>metric==='Input cost'?row.cost.inputCostUsd:metric==='Output cost'?row.cost.outputCostUsd:row.cost.costUsd
 const aa=get(a),bb=get(b);if(aa==null)return bb==null?0:1;if(bb==null)return -1;return ascending?aa-bb:bb-aa
 })
}
