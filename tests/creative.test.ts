import test from 'node:test'
import assert from 'node:assert/strict'
import {creativeCatalog,advisorTasks} from '../src/creativeCatalog.ts'
import {creativeCost,currentCreativeRate,creativeCandidates,creativeFit,detectedCreativeAssets} from '../src/creativeEngine.ts'
const date=new Date('2026-10-21T12:00:00Z')
test('creative catalog covers required providers and exact source/unit distinctions',()=>{
 assert.equal(advisorTasks.length,10)
 for(const id of ['higgsfield','runway','kling','flow-veo','pika','luma','wan-local','ltx-local','suno','ace-step','stable-audio','eleven-music','udio','whisper','comfy-image','flux-schnell','sd35','tripo','hunyuan3d'])assert.ok(creativeCatalog.some(r=>r.id===id),id)
 assert.equal(new Set(creativeCatalog.map(r=>r.id)).size,creativeCatalog.length)
 for(const r of creativeCatalog){assert.ok(r.limits&&r.licensing&&r.privacy);for(const s of r.sources)assert.equal(new URL(s.url).protocol,'https:')}
})
test('creative costs use exact units and rerolls, not subscriptions or token rates',()=>{
 const image=creativeCatalog.find(r=>r.id==='grok-image')!.rates[0],video=creativeCatalog.find(r=>r.id==='grok-video')!.rates[0],song=creativeCatalog.find(r=>r.id==='lyria')!.rates[0],mesh=creativeCatalog.find(r=>r.id==='tripo')!.rates[0]
 assert.equal(creativeCost(image,20,2,0,date).total,1.6)
 assert.equal(creativeCost(video,30,2,5,date).total,24)
 assert.equal(creativeCost(song,10,1,0,date).total,.8)
 assert.equal(creativeCost(mesh,10,1,0,date).total,150);assert.equal(mesh.currency,'credits');assert.equal(creativeCost(creativeCatalog.find(r=>r.id==='grok-tts')!.rates[0],10000,1,0,date).total,.15)
 assert.equal(creativeCost(image,0,1,0,date).total,0)
})
test('unknown, stale, expired and invalid creative workloads never become free quotes',()=>{
 const r=creativeCatalog.find(r=>r.id==='flow-veo')!.rates[0]
 assert.equal(currentCreativeRate(r,new Date('2026-10-22')),false)
 assert.equal(creativeCost(r,1,1,30,date).total,null)
 assert.equal(creativeCost(undefined,1,1,1,date).total,null)
 const i=creativeCatalog.find(r=>r.id==='grok-image')!.rates[0]
 for(const bad of [-1,NaN,Infinity,.5])assert.equal(creativeCost(i,bad,1,0,date).total,null)
 assert.equal(creativeCost(i,1,0,1,date).total,null)
 assert.equal(currentCreativeRate(i,new Date('2027-01-01')),false)
})
test('Free First, commercial restrictions, information-only and missing scans remain honest',()=>{
 const free=creativeCandidates(creativeCatalog,'Video Generation','Balanced',true,false,date)
 assert.ok(free.every(r=>['Free Local','Limited Free'].includes(r.access)))
 assert.ok(!creativeCandidates(creativeCatalog,'Music Generation','Balanced',false,false,date).some(r=>r.id==='udio'))
 assert.ok(!creativeCandidates(creativeCatalog,'Video Generation','Cloud',false,true,date).some(r=>r.id==='pika'))
 assert.equal(creativeCandidates(creativeCatalog,'Video Generation','Balanced',true,false,new Date('2027-01-01')).length,0);assert.equal(creativeCandidates(creativeCatalog,'Video Generation','Balanced',true,false,new Date('2026-10-01')).length,0)
 assert.equal(creativeFit(creativeCatalog.find(r=>r.id==='wan-local')!,null,null).status,'Unknown')
 assert.deepEqual(detectedCreativeAssets(creativeCatalog.find(r=>r.id==='flux-schnell')!,[]),[])
})
