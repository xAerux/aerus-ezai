import test from 'node:test'
import assert from 'node:assert/strict'
import { browseAgentWorkspace, canLaunchLocalAgent, checkAerusSdm, checkAerusUsageHud, launchLocalAgent, requestAgentWorkspaceDefault, validateAgentWorkspace } from '../src/localAgents.ts'

test('normal provider launch requires a detected CLI while Ollama launch uses runtime readiness and no per-agent model selector',()=>{
 assert.equal(canLaunchLocalAgent('codex','Installed','Running',0,'normal'),true)
 assert.equal(canLaunchLocalAgent('opencode','Needs Verification','Running',0,'normal'),false)
 assert.equal(canLaunchLocalAgent('opencode','Not Found','Running',0,'ollama-launch'),true)
 assert.equal(canLaunchLocalAgent('claude-code','Not Found','Not Detected',0,'ollama-launch'),false)
 assert.equal(canLaunchLocalAgent('cmd.exe','Installed','Running',0,'ollama-launch'),false)
})

test('provider selector routes to exactly one launch endpoint with the reviewed workspace',async()=>{
 const original=globalThis.fetch;const calls:Array<{url:string;body:unknown}>=[]
 globalThis.fetch=async(input,init)=>{calls.push({url:String(input),body:JSON.parse(String(init?.body))});return new Response(JSON.stringify({success:true,status:'launched',message:'Terminal opened'}),{status:200})}
 try{
  await launchLocalAgent({agentId:'opencode',workspace:'C:\\AI\\Scratch',providerMode:'normal',approved:true})
  await launchLocalAgent({agentId:'opencode',workspace:'C:\\AI\\Scratch',providerMode:'ollama',approved:true})
  assert.deepEqual(calls.map(call=>call.url),['/api/agents/launch','/api/agents/launch-ollama'])
  assert.equal((calls[0].body as {profile:string}).profile,'manual')
  assert.deepEqual(calls[1].body,{agentId:'opencode',workspace:'C:\\AI\\Scratch',approved:true})
 }finally{globalThis.fetch=original}
})

test('workspace default and native folder selection wrappers expose only the chosen path',async()=>{
 const original=globalThis.fetch;const calls:Array<{url:string;body:unknown}>=[]
 globalThis.fetch=async(input,init)=>{calls.push({url:String(input),body:JSON.parse(String(init?.body))});return new Response(JSON.stringify({success:true,workspace:'C:\\Users\\Test\\AppData\\Local\\EZ AI\\Workspaces\\Scratch'}),{status:200})}
 try{
  assert.match(await requestAgentWorkspaceDefault(),/Workspaces\\Scratch$/)
  assert.match((await browseAgentWorkspace('C:\\Projects\\Demo'))||'',/Scratch$/)
  assert.equal(await validateAgentWorkspace('C:\\Projects\\Demo'),'C:\\Users\\Test\\AppData\\Local\\EZ AI\\Workspaces\\Scratch')
  assert.deepEqual(calls.map(call=>call.url),['/api/agents/workspace/default','/api/agents/workspace/browse','/api/agents/workspace/validate'])
  assert.deepEqual(calls[1].body,{currentPath:'C:\\Projects\\Demo'})
  assert.deepEqual(calls[2].body,{path:'C:\\Projects\\Demo'})
 }finally{globalThis.fetch=original}
})

test('Aerus AI Usage HUD status uses only its native read-only endpoint',async()=>{
 const original=globalThis.fetch;const urls:string[]=[]
 globalThis.fetch=async(input)=>{urls.push(String(input));return new Response(JSON.stringify({success:true,status:'available',message:'Verified HUD'}),{status:200})}
 try{const status=await checkAerusUsageHud();assert.equal(status.status,'available');assert.deepEqual(urls,['/api/companions/aerus-usage-hud/status'])}
 finally{globalThis.fetch=original}
})

test('Aerus SDM status uses its native read-only identity endpoint',async()=>{
 const original=globalThis.fetch;let call:{url:string;method:string;body:unknown}|null=null
 globalThis.fetch=async(input,init)=>{call={url:String(input),method:String(init?.method),body:JSON.parse(String(init?.body))};return new Response(JSON.stringify({success:true,status:'available',message:'Verified local product identity'}),{status:200})}
 try{
  const result=await checkAerusSdm()
  assert.equal(result.status,'available')
  assert.deepEqual(call,{url:'/api/companions/aerus-sdm/status',method:'POST',body:{}})
 }finally{globalThis.fetch=original}
})
