import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogHardwareFit, isCatalogEntryInstalled, localModelCatalog, modelStorageSummary, workflowReadiness } from '../src/localModelCatalog.ts'
import type { ModelFinding } from '../src/softwareDiscovery.ts'

const ollama=(id:string,name:string,sizeBytes:number,location='D:\\Ollama\\models'):ModelFinding=>({id,name,family:null,runtime:'Ollama',location,sizeBytes,format:'gguf',quantization:'Q4_K_M',capabilities:null,status:'Installed',evidence:[],aliases:[]})
const comfy=(name:string,folder:string):ModelFinding=>({id:name,name,family:null,runtime:'ComfyUI',location:`D:\\ComfyUI\\models\\${folder}\\${name}`,sizeBytes:100,format:'safetensors',quantization:null,capabilities:folder,categories:[folder],status:'Installed',evidence:[]})
const hardware={schemaVersion:1 as const,scannedAtUtc:'2026-10-21T00:00:00Z',status:'success' as const,cpu:{manufacturer:null,model:null,logicalProcessors:null},memory:{installedBytes:32_000_000_000},gpus:[],windows:{edition:null,version:null,build:null,architecture:null},drives:[{drive:'D:',label:null,totalBytes:2_000_000_000_000,availableBytes:500_000_000_000}],acceleration:{direct3D12:'unknown' as const,aiAcceleration:'not evaluated' as const,note:''},warnings:[]}

test('catalog alias identifies an installed Ollama model and prevents duplicate recommendation',()=>{
 const entry=localModelCatalog.find(item=>item.id==='ollama-qwen3-coder-30b-a3b')!
 assert.equal(isCatalogEntryInstalled(entry,[ollama('sha256:model-1','qwen3-coder:30b-a3b-q4_K_M',18_000_000_000)]),true)
})
test('storage summary counts distinct Ollama digests once despite a shared store path',()=>{
 const a=ollama('digest-a','qwen3:8b',5_000_000_000),b=ollama('digest-b','llama3.2:3b',2_000_000_000)
 const summary=modelStorageSummary([a,{...a,name:'qwen3:8b-alias'},b],hardware)
 assert.equal(summary.totalBytes,7_000_000_000)
 assert.equal(summary.knownRecords,2)
 assert.equal(summary.byDrive.find(item=>item.drive==='D:')?.bytes,7_000_000_000)
 assert.equal(summary.byDrive.find(item=>item.drive==='D:')?.availableBytes,500_000_000_000)
})
test('model artifact bytes do not assert that a C: drive or inference memory will fit',()=>{
 const entry=localModelCatalog.find(item=>item.id==='ollama-qwen3-8b')!
 const result=catalogHardwareFit(entry,{...hardware,drives:[{...hardware.drives[0],drive:'E:'}]})
 assert.equal(result.status,'Unknown')
 assert.match(result.explanation,/configured drive/)
 assert.doesNotMatch(result.explanation,/C:/)
})
test('Comfy workflow readiness never claims Ready from matching names and nodes',()=>{
 const entry=localModelCatalog.find(item=>item.id==='comfy-flux2-klein-4b')!
 const absent=workflowReadiness(entry,[],true,['KSampler','VAEDecode','SaveImage'])
 assert.equal(absent.status,'Missing Models')
 const files=entry.requiredAssets.map(asset=>comfy(asset.name,asset.folder))
 const present=workflowReadiness(entry,files,true,['KSampler','VAEDecode','SaveImage'])
 assert.equal(present.status,'Compatibility Warning')
 assert.notEqual(present.status,'Ready')
 assert.equal(workflowReadiness(entry,files,false,null).status,'Unknown')
})
test('workflow with incomplete node checklist remains explicitly unknown',()=>{
 const entry=localModelCatalog.find(item=>item.id==='comfy-kandinsky5-t2v')!
 assert.equal(workflowReadiness(entry,[],true,[]).status,'Unknown')
})
