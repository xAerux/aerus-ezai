import test from 'node:test'
import assert from 'node:assert/strict'
import { valueModels } from '../src/valueCatalog.ts'
import { comparisonRows, pricingCurrent, workloadPresets } from '../src/pricingCalculations.ts'
import { estimateApiCost, compareModels } from '../src/valueEngine.ts'
import { budgetPlansForPreference } from '../src/pricingCalculations.ts'
import { valuePlans } from '../src/valueCatalog.ts'
import { groupLocalLibrary } from '../src/localLibrary.ts'
import { freeAiOptions, isFreeOptionCurrent } from '../src/freeOptionsCatalog.ts'
import type { ModelFinding } from '../src/softwareDiscovery.ts'
import { readStored } from '../src/uiState.ts'

test('numeric-string preferences retain exact zero/custom choices across restart',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
 try{
  const values:Record<string,string>={budget:'0',plan:'50',level:'"Advanced"',free:'false',tokens:'1000',bad:'bad json'}
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values[key]??null}})
  assert.equal(readStored('budget','20'),'0');assert.equal(readStored('plan','20'),'50')
  assert.equal(readStored('level','Beginner'),'Advanced');assert.equal(readStored('free',true),false)
  assert.equal(readStored('tokens',0),1000);assert.deepEqual(readStored('bad',[]),[])
 }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage')}
})
test('monthly input volume does not trigger the per-request long-context tier',()=>{
 const m=valueModels.find(m=>m.id==='xai-grok-4-7')!
 assert.equal(estimateApiCost(m,1000000,0,0,undefined,'Standard',32000).costUsd,2)
 assert.equal(estimateApiCost(m,1000000,0,0,undefined,'Standard',200000).costUsd,4)
 const haiku=valueModels.find(m=>m.id==='anthropic-claude-haiku-5-5')!
 assert.equal(estimateApiCost(haiku,100000,0,0,undefined,'Standard',100000).costUsd,.01)
 assert.equal(estimateApiCost(haiku,100000,0,0,undefined,'Standard',100001).costUsd,.05)
})
test('Free First never adds a paid plan but still counts existing paid choices',()=>{
 const plans=budgetPlansForPreference(valuePlans,['chatgpt-plus'],true)
 assert.ok(plans.some(p=>p.id==='chatgpt-plus'))
 assert.ok(plans.filter(p=>p.id!=='chatgpt-plus').every(p=>p.monthlyUsd===0))
 const expired={...freeAiOptions[0],status:'Promotional Free' as const,verifiedAt:'2026-10-21',expiresAt:'2026-10-22'}
 assert.equal(isFreeOptionCurrent(expired,'2026-10-23'),false)
})
test('local inventory separates supporting assets, preserves unknowns and counts shared Ollama identities once',()=>{
 const fixture=(id:string,name:string,runtime:string,location:string|null,sizeBytes:number|null):ModelFinding=>({id,name,runtime,location,sizeBytes,family:null,format:null,quantization:null,capabilities:null,status:'Installed',evidence:[]})
 const a=fixture('digest','qwen','Ollama',null,100)
 const groups=groupLocalLibrary([a,{...a,name:'alias'},fixture('vae','Wan VAE','ComfyUI','D:\\models\\vae\\wan.safetensors',50),fixture('vid','Wan2.2','ComfyUI','D:\\models\\diffusion_models\\wan.safetensors',200),fixture('x','unknown','ComfyUI','D:\\models\\diffusion_models\\x.safetensors',null)])
 assert.equal(groups[0].count,1);assert.equal(groups[0].knownBytes,100)
 assert.equal(groups.find(g=>g.name==='Supporting Model Components')?.count,1)
 assert.equal(groups.find(g=>g.name==='Video Models')?.count,1)
 assert.equal(groups.find(g=>g.name==='Unclassified')?.unknownSizes,1)
 assert.ok(groupLocalLibrary([]).every(g=>g.count===0))
})
test('shared chart/table rows sort exact totals and retain zero and unavailable distinctions',()=>{
 const ids=['openai-gpt-6-astra','openai-gpt-6-luna','cursor-router-auto']
 const rows=comparisonRows(valueModels,ids,1000000,250000,0,'Standard',32000)
 assert.equal(rows[0].model.id,'openai-gpt-6-luna');assert.equal(rows.at(-1)?.cost.costUsd,null)
 assert.ok(rows[0].cost.costUsd!<rows[1].cost.costUsd!)
 assert.equal(comparisonRows(valueModels,[ids[0]],0,0,0,'Standard',0)[0].cost.costUsd,0)
})
test('stale/unverified identities and mismatched benchmark versions cannot claim verified comparisons',()=>{
 const m=valueModels[0]
 assert.equal(pricingCurrent(m,'2026-12-01'),false)
 assert.equal(estimateApiCost({...m,status:'Unverified'},1,1).costUsd,null)
 const b={name:'fixture',task:'Programming',testedModelId:'another-version',result:'100',evaluationDate:'2026-10-21',source:'https://example.com',kind:'Provider-reported' as const,limitations:'fixture'}
 assert.equal(compareModels([m.id],'Programming',[{...m,benchmarks:[b]}])[0].benchmarkEvidence.length,0)
 assert.equal(workloadPresets.length,3);assert.ok(workloadPresets.every(p=>p.input>0&&p.output>0&&p.prompt>0))
})
