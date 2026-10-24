import assert from 'node:assert/strict'
import test from 'node:test'
import { installerAction, installerCatalog, ollamaDesktopStatus } from '../src/installerCatalog.ts'

test('primary installer catalog uses verified official HTTPS routes and unique IDs',()=>{
  assert.equal(new Set(installerCatalog.map(item=>item.id)).size,installerCatalog.length)
  for(const item of installerCatalog){assert.match(item.officialUrl,/^https:\/\//);assert.match(item.sourceUrl,/^https:\/\//);assert.ok(item.publisher);assert.ok(item.installerKind);assert.ok(item.note);assert.ok(item.detectionRules.length>0);assert.match(item.verifiedOn,/^2026-/);assert.ok(item.recoveryGuidance)}
})
test('the registry distinguishes web routes, setup guides, recommendations, and install handoffs',()=>{
  assert.equal(installerCatalog.find(item=>item.id==='gemini')?.installerKind,'Web application')
  assert.equal(installerCatalog.find(item=>item.id==='claude-code')?.installerKind,'Official setup guide')
  const comfy=installerCatalog.find(item=>item.id==='comfyui-desktop')!
  assert.equal(comfy.name,'ComfyUI Desktop')
  assert.equal(comfy.installerKind,'Official setup guide')
  assert.equal(comfy.officialUrl,'https://comfy.org/download')
  assert.equal(comfy.installable,false)
  assert.equal(comfy.downloadSupported,false)
  assert.equal(comfy.launchable,true)
  assert.equal(installerCatalog.find(item=>item.id==='cursor')?.installerKind,'Official interactive installer')
  assert.equal(installerCatalog.find(item=>item.id==='cursor')?.downloadSupported,true)
  assert.equal(installerCatalog.find(item=>item.id==='ollama')?.downloadSupported,true)
  assert.equal(installerCatalog.find(item=>item.id==='lm-studio')?.downloadSupported,true)
  assert.equal(installerCatalog.find(item=>item.id==='chatgpt')?.downloadSupported,false)
})
test('Muse is absent from the installer lineup',()=>{ assert.equal(installerCatalog.some(item=>item.id==='muse'),false) })
test('CLI and unsupported products cannot be routed through an arbitrary installer',()=>{
  for(const id of ['claude-code','codex-cli','opencode','gemini','grok','comfyui-desktop']) assert.equal(installerCatalog.find(item=>item.id===id)?.installable,false)
})


test('an installed app is never offered reinstall and uncertain evidence requires verification',()=>{
  const cursor=installerCatalog.find(item=>item.id==='cursor')!
  assert.equal(installerAction(cursor,'Installed',true),'Open')
  assert.equal(installerAction(cursor,'Running',true),'Open')
  assert.equal(installerAction(cursor,'Needs Verification',true),'Verify')
  assert.equal(installerAction(cursor,'Scan Incomplete',true),'Verify')
  assert.equal(installerAction(cursor,'Not Found',true),'Download installer')
  assert.equal(installerAction(cursor,'Not scanned',false),'Scan first')
  assert.equal(installerAction(cursor,'Not Found',false),'Scan first')
  const comfy=installerCatalog.find(item=>item.id==='comfyui-desktop')!
  assert.equal(installerAction(comfy,'Installed',true,true),'Open')
  assert.equal(installerAction(comfy,'Installed',true,false),'Verify')
  assert.equal(installerAction(comfy,'Needs Verification',true,false),'Verify')
  assert.equal(installerAction(comfy,'Not Found',true,false),'Official setup guide')
  assert.equal(installerAction(installerCatalog.find(item=>item.id==='gemini')!,'Installed',true,false),'Open web app')
  assert.equal(installerAction(installerCatalog.find(item=>item.id==='ollama')!,'Running',true,false),'Manage')
  assert.equal(installerAction(installerCatalog.find(item=>item.id==='ollama')!,'Running',true,true),'Open')
  assert.equal(ollamaDesktopStatus('Installed','Running','success',true),'Installed')
  assert.equal(ollamaDesktopStatus(undefined,'Running','success',true),'Runtime only')
  assert.equal(ollamaDesktopStatus(undefined,'Not Detected','success',true),'Not Found')
  assert.equal(ollamaDesktopStatus(undefined,undefined,'partial',true),'Scan Incomplete')
  assert.equal(ollamaDesktopStatus(undefined,undefined,undefined,false),'Not scanned')
  for(const id of ['codex-cli','opencode','claude-code','starnet']) assert.equal(installerAction(installerCatalog.find(item=>item.id===id)!,'Installed',true),'Open')
})
