import test from 'node:test'
import assert from 'node:assert/strict'
import { valueModels, valuePlans } from '../src/valueCatalog.ts'
import { budgetAdvisor, compareModels, estimateApiCost, formatUsd } from '../src/valueEngine.ts'

const model=(id:string)=>valueModels.find(item=>item.id===id)!
test('standard cost includes input and output tokens',()=>{const result=estimateApiCost(model('openai-gpt-6-1-sol'),1_000_000,250_000,0,'2026-10-20');assert.equal(result.costUsd,4.5)})
test('cached input pricing is applied only to the selected cached share',()=>{const result=estimateApiCost(model('openai-gpt-6-1-sol'),1_000_000,250_000,50,'2026-10-20');assert.equal(result.costUsd,3.55)})
test('zero tokens have zero cost and currency remains readable',()=>{assert.equal(estimateApiCost(model('openai-gpt-6-1-sol'),0,0).costUsd,0);assert.equal(formatUsd(.00001),'$0.0000')})
test('missing fixed-rate routes are not directly comparable',()=>{const result=estimateApiCost(model('cursor-router-auto'),1_000_000,250_000);assert.equal(result.comparable,false);assert.equal(result.costUsd,null)})
test('long-context rate activates at published prompt threshold',()=>{const result=estimateApiCost(model('xai-grok-4-7'),200_000,0);assert.equal(result.costUsd,.8);assert.match(result.rateLabel||'',/long-context/)})
test('dated promotional pricing yields to scheduled rate after expiration',()=>{const record=model('google-gemini-4-argon');assert.equal(estimateApiCost(record,1_000_000,0,0,'2026-11-30').costUsd,2);assert.equal(estimateApiCost(record,1_000_000,0,0,'2026-12-01').costUsd,4)})
test('invalid negative and over-100 cached values are rejected',()=>{assert.equal(estimateApiCost(model('openai-gpt-6-1-sol'),-1,0).comparable,false);assert.equal(estimateApiCost(model('openai-gpt-6-1-sol'),1,0,101).comparable,false)})
test('batch tier resolves conditional Flex/Batch published record',()=>{assert.equal(estimateApiCost(model('openai-gpt-6-1-sol'),1_000_000,250_000,0,'2026-10-20','Flex').costUsd,2.25)})
test('budget advisor yields free plan at zero budget and paid choices within budgets',()=>{assert.equal(budgetAdvisor(0,[],'Programming','Balanced',[]).suggestedPlan?.monthlyUsd,0);assert.ok((budgetAdvisor(20,[],'Programming','Balanced',[]).suggestedPlan?.monthlyUsd||0)<=20);assert.ok((budgetAdvisor(50,[],'Programming','Balanced',[]).suggestedPlan?.monthlyUsd||0)<=50);assert.ok((budgetAdvisor(100,[],'Programming','Balanced',[]).suggestedPlan?.monthlyUsd||0)<=100)})
test('optional second provider is added only when combined subscription costs fit',()=>{const result=budgetAdvisor(50,[],'Programming','Balanced',[]);assert.ok(result.secondaryPlan);assert.ok(result.recurringUsd<=50);const smaller=budgetAdvisor(20,[],'Programming','Balanced',[]);assert.equal(smaller.secondaryPlan,null)})
test('custom budget, existing subscriptions and local alternative are accounted for',()=>{const result=budgetAdvisor(35,['chatgpt-plus'],'Book writing','Local first',['Qwen3 · Ollama · Recommended']);assert.equal(result.recurringUsd,20);assert.equal(result.remainingUsd,15);assert.equal(result.localModelNames.length,1)})
test('over-budget existing plan is surfaced instead of hidden',()=>{const result=budgetAdvisor(20,['chatgpt-pro-100'],'Marketing','Balanced',[]);assert.equal(result.overBudget,true);assert.equal(result.remainingUsd,-80)})
test('model comparison does not manufacture benchmark winners',()=>{const rows=compareModels(['openai-gpt-6-1-sol','anthropic-claude-sonnet-5-5'],'Programming');assert.equal(rows.length,2);assert.ok(rows.every(row=>row.benchmarkEvidence.length===0))})
test('plans preserve API billing distinction and uncertain prices',()=>{assert.equal(valuePlans.find(plan=>plan.id==='chatgpt-plus')?.apiSeparate,true);assert.equal(valuePlans.find(plan=>plan.id==='google-ai-plus')?.monthlyUsd,null)})
