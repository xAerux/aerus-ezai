import { fetchService, readServiceJson } from './serviceErrors.ts'

export interface InstallerActionResult { success:boolean; status:string; message:string; processId?:number|null }
export async function requestApplicationLaunch(appId:string):Promise<InstallerActionResult> {
  const response=await fetchService('Application launch','/api/apps/launch',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({appId}),cache:'no-store'})
  const result=await readServiceJson<InstallerActionResult>(response,'Application launch')
  if(!response.ok || !result.success) throw new Error(result.message || `Application launch failed (HTTP ${response.status}).`)
  return result
}

export async function verifyExistingApplication(appId:string,target:string):Promise<InstallerActionResult>{
 const response=await fetch('/api/apps/verify-target',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appId,target})});const result=await response.json() as InstallerActionResult;if(!response.ok||!result.success)throw new Error(result.message||'Launch identity could not be verified.');return result
}
