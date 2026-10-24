import { fetchService, readServiceJson } from './serviceErrors.ts'
export interface InstallerJob {
  jobId:string;installerId:string;name:string;publisher:string;status:string;message:string;sourceHost:string
  version:string|null;downloadedBytes:number;totalBytes:number|null;progressPercent:number|null
  installerExitCode:number|null;retryAllowed:boolean;updatedAtUtc:string
}
async function api<T>(path:string,body?:Record<string,unknown>):Promise<T>{
  const response=await fetchService('Installer service',path,{method:body?'POST':'GET',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'})
  const value:unknown=await readServiceJson<unknown>(response,'Installer service')
  if(!response.ok){const error=value as {message?:string};throw new Error(error.message||`Installer service failed (HTTP ${response.status}).`)}
  return value as T
}
export const requestInstallerJobs=()=>api<InstallerJob[]>('/api/installers/jobs')
export const startInstallerDownload=(installerId:string)=>api<InstallerJob>('/api/installers/download',{installerId})
export const cancelInstallerDownload=(jobId:string)=>api<InstallerJob>('/api/installers/cancel',{jobId})
export const executeInstaller=(jobId:string,approved:boolean)=>api<InstallerJob>('/api/installers/execute',{jobId,approved})
export const verifyInstaller=(jobId:string)=>api<InstallerJob>('/api/installers/verify',{jobId})
