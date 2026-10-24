import { fetchService, readServiceJson, serviceFailure } from './serviceErrors.ts'

export interface LocalAgentLaunchRequest {
  agentId:'codex'|'opencode'|'claude-code'
  workspace:string
  providerMode:'normal'|'ollama'
  approved:true
}
export interface LocalAgentLaunchResult { success:boolean; status:string; message:string; processId?:number|null }
export interface AerusUsageHudStatus { success:boolean; status:string; message:string; processId?:number|null; target?:string }
export interface AerusSdmStatus { success:boolean; status:string; message:string; processId?:number|null; target?:string }
export function canLaunchLocalAgent(agentId:string,agentStatus?:string,runtimeStatus?:string,_modelCount=0,providerMode:'normal'|'ollama-launch'='normal'):boolean {
 if(!(agentId==='codex'||agentId==='opencode'||agentId==='claude-code'))return false
 if(providerMode==='ollama-launch')return runtimeStatus==='Running'
 return ['Installed','Running'].includes(agentStatus||'')
}
async function postResult<T>(url:string,body:unknown):Promise<T>{
 const response=await fetchService('EZ AI',url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),cache:'no-store'})
 const result=await readServiceJson<T & {success?:boolean;message?:string}>(response,'EZ AI')
 if(!response.ok||result.success===false)throw new Error(result.message||`Request failed (HTTP ${response.status}).`)
 return result
}
export async function requestAgentWorkspaceDefault():Promise<string>{const result=await postResult<{workspace:string}>('/api/agents/workspace/default',{});if(!result.workspace)throw new Error('EZ AI did not return its safe scratch workspace. Use Browse project folder.');return result.workspace}
export async function browseAgentWorkspace(currentPath:string):Promise<string|null>{const result=await postResult<{workspace:string|null}>('/api/agents/workspace/browse',{currentPath});return result.workspace||null}
export async function validateAgentWorkspace(path:string):Promise<string>{const result=await postResult<{workspace:string}>('/api/agents/workspace/validate',{path});if(!result.workspace)throw new Error('Windows could not confirm the project folder. Browse to an existing folder and retry.');return result.workspace}
export async function launchLocalAgent(request:LocalAgentLaunchRequest):Promise<LocalAgentLaunchResult>{
 if(request.providerMode==='ollama')return launchWithOllama(request.agentId,request.workspace,request.approved)
 return postResult<LocalAgentLaunchResult>('/api/agents/launch',{...request,modelId:'',profile:'manual'})
}
export async function launchWithOllama(agentId:'codex'|'opencode'|'claude-code',workspace:string,approved=true):Promise<LocalAgentLaunchResult>{return postResult<LocalAgentLaunchResult>('/api/agents/launch-ollama',{agentId,workspace,approved})}
/** Status answers are authoritative even when the native service reports "not available" with HTTP 404 and a JSON body. */
async function postStatus<T extends {status:string}>(url:string,body:unknown):Promise<T>{
 const response=await fetchService('EZ AI',url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),cache:'no-store'})
 const result=await readServiceJson<T>(response,'EZ AI')
 if(typeof result.status!=='string')throw serviceFailure('EZ AI',response)
 return result
}
export async function checkAerusUsageHud():Promise<AerusUsageHudStatus>{return postStatus<AerusUsageHudStatus>('/api/companions/aerus-usage-hud/status',{})}
export async function checkAerusSdm():Promise<AerusSdmStatus>{return postStatus<AerusSdmStatus>('/api/companions/aerus-sdm/status',{})}
