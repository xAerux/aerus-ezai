import test from 'node:test'
import assert from 'node:assert/strict'
import { freeAiOptions, freeCatalogVersion, isFreeOptionCurrent } from '../src/freeOptionsCatalog.ts'

test('Mission 08 free options distinguish hosted routes, local inference, and access tiers',()=>{
 assert.ok(freeCatalogVersion)
 assert.ok(freeAiOptions.some(item=>item.kind==='Hosted model'&&item.modelId==='opencode/deepseek-v4.1-flash-free'))
 assert.ok(freeAiOptions.some(item=>item.kind==='Local model'&&item.route.includes('local')))
 assert.ok(freeAiOptions.some(item=>item.kind==='Access tier'&&item.provider==='OpenRouter'))
 for(const item of freeAiOptions){assert.ok(item.source.startsWith('https://'));assert.ok(item.privacy);assert.ok(item.training);assert.ok(item.payment)}
})
test('free status ages out and an unknown or paid offer is never treated as verified free',()=>{
 const base={...freeAiOptions[0],verifiedAt:'2026-10-01'}
 assert.equal(isFreeOptionCurrent(base,'2026-10-20'),true)
 assert.equal(isFreeOptionCurrent(base,'2026-11-01'),false)
 assert.equal(isFreeOptionCurrent({...base,status:'Promotional Free',verifiedAt:'2026-10-20'},'2026-10-20'),true)
 assert.equal(isFreeOptionCurrent({...base,status:'Paid'},'2026-10-20'),false)
 assert.equal(isFreeOptionCurrent({...base,status:'Unverified'} as typeof base,'2026-10-20'),false)
 assert.equal(isFreeOptionCurrent({...base,verifiedAt:'2026-11-01'},'2026-10-20'),false)
})
