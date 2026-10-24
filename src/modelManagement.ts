import { fetchService, readServiceJson } from './serviceErrors.ts'
export interface ModelDownloadJob {
 jobId:string;catalogId:string;model:string;runtime:string;status:string;message:string
 downloadedBytes:number;totalBytes:number|null;progressPercent:number|null;bytesPerSecond:number|null
 cancellable:boolean;retryAllowed:boolean;installedVerified:boolean;updatedAtUtc:string
}
async function api<T>(path:string,body?:Record<string,unknown>):Promise<T>{
 const response=await fetchService('Model service',path,{method:body?'POST':'GET',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'})
 const value:unknown=await readServiceJson<unknown>(response,'Model service')
 if(!response.ok){const error=value as {message?:string};throw new Error(error.message||'Model service failed (HTTP '+response.status+').')}
 return value as T
}
export const requestModelJobs=()=>api<ModelDownloadJob[]>('/api/models/jobs')
export const startModelDownload=(catalogId:string,approved:boolean)=>api<ModelDownloadJob>('/api/models/download',{catalogId,approved})
export const cancelModelDownload=(jobId:string)=>api<ModelDownloadJob>('/api/models/cancel',{jobId})
export const retryModelDownload=(jobId:string,approved:boolean)=>api<ModelDownloadJob>('/api/models/retry',{jobId,approved})
export const verifyModelDownload=(jobId:string)=>api<ModelDownloadJob>('/api/models/verify',{jobId})
export interface ComfyNodeCheck { workflowId:string; checkedNodes:boolean; availableNodes:string[]; missingNodes:string[]; message:string }
export const checkComfyWorkflowNodes=(workflowId:string)=>api<ComfyNodeCheck>('/api/models/comfy-readiness',{workflowId})