import test from 'node:test'
import assert from 'node:assert/strict'
import {valueModels} from '../src/valueCatalog.ts'
import {browseModels,selectComparison,modelIdentity} from '../src/modelDiscovery.ts'
test('all-model browser includes every catalog route without limiting comparison selections',()=>{
 assert.equal(browseModels(valueModels,'All Models','').length,valueModels.length)
 let ids:string[]=[];for(const m of valueModels)ids=selectComparison(ids,m.id)
 assert.equal(ids.length,valueModels.length);assert.equal(selectComparison(ids,ids[0]).length,valueModels.length-1)
 assert.ok(browseModels(valueModels,'My AIs','chatgpt claude').every(m=>['OpenAI','Anthropic'].includes(m.provider)))
 assert.ok(browseModels(valueModels,'Local','').every(m=>m.access==='Local runtime'))
 assert.ok(!browseModels(valueModels,'Free','').some(m=>m.id==='ollama-cloud-gpt-oss-20b'))
 assert.ok(valueModels.every(m=>modelIdentity(m).version===m.officialModelId))
 assert.ok(browseModels(valueModels,'All Models','').some(m=>!m.pricing.length))
})

import {modeProfiles,supportedTiers} from '../src/modelModesCatalog.ts'
test('effort eligibility is exact-model and product-specific',()=>{
 assert.ok(!modeProfiles['gpt-6.1-sol'].efforts.includes('none'))
 assert.ok(modeProfiles['gpt-6-luna'].efforts.includes('none'))
 assert.ok(!modeProfiles['gpt-5.3-codex'].efforts.includes('max'))
 assert.deepEqual(modeProfiles['gemini-4-argon'].efforts,['low','medium','high'])
 assert.ok(modeProfiles['gemini-3.5-flash-lite'].efforts.includes('minimal'))
 assert.equal(modeProfiles['grok-4.7'],undefined)
 assert.deepEqual(supportedTiers(valueModels.find(m=>m.id==='cursor-router-auto')!),[])
})

import {costLessons} from '../src/costEducation.ts'
test('saving education covers cache fees, effort uncertainty and distinct billing routes',()=>{
 assert.equal(new Set(costLessons.map(l=>l.id)).size,9)
 assert.ok(costLessons.every(l=>l.body.length>150&&l.example.length>60&&l.source.startsWith('https://')))
 assert.match(costLessons.find(l=>l.id==='effort')!.body,/Unknown/)
 assert.match(costLessons.find(l=>l.id==='subscription')!.body,/API estimate does not predict/)
})
import {estimateApiCost} from '../src/valueEngine.ts'
import {defaultSavingWorkload,savingEstimate,savingsDelta,cacheLifetimes} from '../src/savingsEngine.ts'
const m=(id:string)=>valueModels.find(m=>m.officialModelId===id)!
const today='2026-10-21'
test('new tiers use verified exact routes, never a generic speed multiplier',()=>{
 for(const [tier,factor] of [['Standard',1],['Batch',.5],['Flex',.5],['Fast',2],['Ultrafast',6]] as const)
  assert.equal(estimateApiCost(m('gpt-6.1-sol'),100000,25000,0,today,tier).costUsd,.45*factor)
 assert.equal(estimateApiCost(m('gpt-6-luna'),1000,100,0,today,'Ultrafast').comparable,false)
 assert.equal(estimateApiCost(m('claude-sonnet-5-5'),1000,100,0,today,'Fast').comparable,false)
 assert.ok(Math.abs(estimateApiCost(m('claude-opus-5-5'),100000,10000,0,today,'Fast').costUsd!-1.2)<1e-10)
 assert.equal(estimateApiCost(m('gpt-6.1-sol'),1,1,0,today,'Fast + Batch').comparable,false)
})
test('cache reads, writes and ordinary input are disjoint and charged once',()=>{
 const result=estimateApiCost(m('gpt-6.1-sol'),100000,10000,40,today,'Standard',100000,{cacheWriteTokens:20000,cacheLifetime:'30 minutes'})
 assert.ok(Math.abs(result.costUsd!-.234)<1e-10)
 assert.equal(result.cacheWriteCostUsd,.05)
 assert.equal(estimateApiCost(m('gpt-6.1-sol'),1000,0,90,today,'Standard',1000,{cacheWriteTokens:200,cacheLifetime:'30 minutes'}).comparable,false)
 assert.equal(estimateApiCost(m('gemini-4-argon'),1000,0,0,today,'Standard',1000,{cacheWriteTokens:100,cacheLifetime:'30 minutes'}).comparable,false)
 assert.equal(estimateApiCost(m('gpt-6.1-sol'),1000,0,0,today,'Standard',1000,{cacheWriteTokens:10,cacheLifetime:'invented'}).comparable,false)
})
test('write lifetime and tier affect actual documented cache prices',()=>{
 assert.equal(estimateApiCost(m('gpt-6.1-sol'),100000,0,0,today,'Standard',100000,{cacheWriteTokens:100000,cacheLifetime:'12 hours'}).costUsd,.5)
 assert.equal(estimateApiCost(m('gpt-6.1-sol'),100000,0,0,today,'Flex',100000,{cacheWriteTokens:100000,cacheLifetime:'30 minutes'}).costUsd,.125)
 assert.equal(estimateApiCost(m('claude-opus-5-5'),100000,0,0,today,'Batch',100000,{cacheWriteTokens:100000,cacheLifetime:'1 hour'}).costUsd,.4)
 assert.deepEqual(cacheLifetimes(m('gpt-6-luna'),'Standard'),['30 minutes','12 hours'])
})
test('long context applies prompt threshold to cache writes and output',()=>{
 const short=estimateApiCost(m('gpt-6.1-sol'),272000,1000,0,today,'Standard',272000,{cacheWriteTokens:1000,cacheLifetime:'30 minutes'})
 const long=estimateApiCost(m('gpt-6.1-sol'),272001,1000,0,today,'Standard',272001,{cacheWriteTokens:1000,cacheLifetime:'30 minutes'})
 assert.equal(short.cacheWriteCostUsd,.0025);assert.equal(long.cacheWriteCostUsd,.005)
 assert.equal(short.outputCostUsd,.01);assert.equal(long.outputCostUsd,.015)
 const haiku=estimateApiCost(m('claude-haiku-5-5'),100001,0,0,today,'Standard',100001,{cacheWriteTokens:100001,cacheLifetime:'1 hour'})
 assert.equal(haiku.costUsd,.100001)
})
test('regional fees apply only to documented routes',()=>{
 const result=estimateApiCost(m('gpt-6.1-sol'),100000,10000,0,today,'Standard',100000,{regional:true})
 assert.ok(Math.abs(result.costUsd!-.33)<1e-10)
 assert.equal(estimateApiCost(m('grok-4.3'),100,100,0,today,'Standard',100,{regional:true}).costUsd,null)
})
test('monthly task math includes attempts and user-supplied extras without effort assumptions',()=>{
 const w={...defaultSavingWorkload,input:100000,output:10000,tasks:100,attempts:2,extraUnits:2,extraRate:.01}
 const result=savingEstimate(m('gpt-6.1-sol'),w,today)
 assert.ok(Math.abs(result.request!-.32)<1e-10);assert.ok(Math.abs(result.monthly!-64)<1e-10)
 assert.ok(Math.abs(savingsDelta(100,result.monthly)!-36)<1e-10)
 assert.equal(savingsDelta(null,5),null)
 assert.equal(savingEstimate(m('gpt-6.1-sol'),{...w,tasks:0},today).monthly,0)
})
test('invalid, stale, expired and variable routes never become zero-dollar savings',()=>{
 const w=defaultSavingWorkload
 for(const patch of [{input:-1},{attempts:0},{tasks:Infinity},{cachedPercent:101},{extraRate:-1}])assert.equal(savingEstimate(m('gpt-6.1-sol'),{...w,...patch},today).monthly,null)
 assert.equal(savingEstimate(m('gpt-6.1-sol'),w,'2027-01-01').monthly,null)
 assert.equal(savingEstimate(m('gpt-5.6-sol'),w,'2026-11-22').monthly,null)
 assert.equal(savingEstimate(m('Auto / routed per request'),w,today).monthly,null)
 assert.equal(savingEstimate(m('User-selected local model'),w,today).monthly,null)
})

import {knowledgeArticles} from '../src/knowledgeCatalog.ts'
test('every inline education destination resolves to a bundled Knowledge page',()=>{
 for(const lesson of costLessons)assert.ok(knowledgeArticles.some(a=>a.id===lesson.topic),lesson.topic)
})

import {grokBotAccess,grokLegacyPlans} from '../src/servicePlans.ts'
test('Grok Bot entitlement is distinct from API pricing and conditional legacy access',()=>{
 assert.match(grokBotAccess('x-sub-premium'),/Included/);assert.match(grokBotAccess('x-sub-plus'),/Not confirmed/)
 assert.match(grokBotAccess('supergrok-legacy'),/Conditional/);assert.match(grokBotAccess('supergrok-legacy',true),/Owner-confirmed/)
 assert.ok(grokLegacyPlans.every(p=>p.monthlyUsd===null&&p.status==='Unverified'&&p.apiSeparate))
})

import {comfyCloudPlans,comfyDeploymentEstimate,integrationLessons} from '../src/integrationLearning.ts'
test('Comfy hosted pricing and StarNet education stay separate from local model installation',()=>{
 assert.equal(comfyCloudPlans[0].monthlyUsd,20);assert.equal(comfyCloudPlans[0].annualUsd,192)
 assert.equal(comfyDeploymentEstimate('RTX PRO 6000',1,20)?.usd,8.54)
 assert.equal(comfyDeploymentEstimate('unknown',1,20),null);assert.equal(comfyDeploymentEstimate('H100 SXM',-1,20),null)
 assert.ok(integrationLessons.find(a=>a.id==='platform-starnet')?.levels.Beginner.join(' ').includes('providers can charge'))
 assert.ok(integrationLessons.find(a=>a.id==='platform-comfy-cloud')?.levels.Beginner.join(' ').includes('Partner Nodes'))
})

test('unlimited selections retain all identities without silently dropping saved choices',()=>{
 const ids=Array.from({length:200},(_,i)=>'model-'+i)
 assert.equal(selectComparison(ids,'another').length,201)
 assert.deepEqual(selectComparison(['one','two'],'one'),['two'])
})

test('current Grok API rates preserve per-million, Batch and exact regional eligibility',()=>{
 assert.equal(estimateApiCost(m('grok-4.7'),100000,0,0,today,'Batch',100000).costUsd,.16)
 assert.ok(Math.abs(estimateApiCost(m('grok-4.7'),100000,0,0,today,'Standard',100000,{regional:true}).costUsd!-.22)<1e-10)
 assert.equal(estimateApiCost(m('grok-4.7'),1000,0,0,today,'Fast',1000).costUsd,null)
})
