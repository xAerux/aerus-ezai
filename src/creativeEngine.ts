import type {CreativeRecord,CreativeRate,AdvisorTask,CreativeKind} from './creativeCatalog.ts'
import type {HardwareScanResult} from './hardwareScan'
import type {ModelFinding,DiscoveryResult} from './softwareDiscovery'
export function creativeKind(task:AdvisorTask):CreativeKind|null{return ({'Image Generation':'Image','Video Generation':'Video','Music Generation':'Music','Voice & Audio':'Voice & Audio','3D Generation':'3D'} as Partial<Record<AdvisorTask,CreativeKind>>)[task]||null}
export function currentCreativeRate(rate:CreativeRate,date=new Date()):boolean{const age=(date.getTime()-Date.parse(rate.verifiedAt+'T00:00:00Z'))/86400000;return age>=0&&age<=30&&(!rate.expiresAt||date.toISOString().slice(0,10)<=rate.expiresAt)}
export function creativeCost(rate:CreativeRate|undefined,count:number,attempts:number,duration:number,date=new Date()):{total:number|null;reason:string}{
 if(![count,attempts,duration].every(v=>Number.isFinite(v)&&v>=0)||attempts<1||!Number.isInteger(count)||!Number.isInteger(attempts))return{total:null,reason:'Use a whole non-negative output count, at least one whole attempt, and a valid duration.'}
 if(!rate)return{total:null,reason:'No verified comparable rate; this is not a zero-cost quote.'}
 if(!currentCreativeRate(rate,date))return{total:null,reason:'Rate expired or requires a fresh review.'}
 if(!Number.isFinite(rate.amount)||rate.amount<0)return{total:null,reason:'Invalid catalog rate.'}
 if(rate.unit==='video second'&&(duration<=0||(rate.minDuration!==undefined&&duration<rate.minDuration)||(rate.maxDuration!==undefined&&duration>rate.maxDuration)))return{total:null,reason:'Duration is outside the documented rate conditions.'}
 const total=rate.amount*count*attempts*(rate.unit==='video second'?duration:1)
 return Number.isFinite(total)?{total,reason:'Estimate for the specified route/settings; excludes input media, taxes, regional premiums, post-processing and unlisted tools.'}:{total:null,reason:'Workload too large.'}
}
export function creativeFit(record:CreativeRecord,hardware:HardwareScanResult|null,discovery:DiscoveryResult|null):{status:string;reason:string}{
 if(record.route==='Cloud')return{status:'Hosted service',reason:'Local VRAM does not determine provider access, quota or output quality.'}
 const notes=record.hardwareNote||'No verified complete-workflow hardware requirement is available.'
 if(!hardware)return{status:'Unknown',reason:'Not Scanned. '+notes}
 const vram=Math.max(0,...hardware.gpus.map(g=>g.dedicatedVideoMemoryBytes||0))/1024**3
 if(record.vramGuidanceGb&&vram>0&&vram<record.vramGuidanceGb)return{status:'Trade-offs / below published guidance',reason:`Detected dedicated VRAM ${vram.toFixed(1)} GB; guidance ${record.vramGuidanceGb} GB. Offloading or a different workload may be needed. ${notes}`}
 const comfy=discovery?.runtimes?.find(r=>/comfy/i.test(r.name)&&['Installed','Running'].includes(r.status))
 return{status:'Unknown',reason:`${notes} ${record.id.includes('comfy')||record.id.includes('local')?comfy?'ComfyUI detected; dependencies and workflow execution remain unverified.':'ComfyUI runtime readiness is not verified.':''} RAM, available storage, precision, nodes and full workflow memory still require verification.`}
}
export function creativeCandidates(records:CreativeRecord[],task:AdvisorTask,preference:string,freeFirst:boolean,commercial:boolean,date=new Date()):CreativeRecord[]{
 return records.filter(r=>r.kind===creativeKind(task)&&!r.informationalOnly&&(preference!=='Local'||r.route==='Local')&&(preference!=='Cloud'||r.route==='Cloud'))
 .filter(r=>!commercial||r.commercial==='Documented with conditions')
 .filter(r=>!freeFirst||(r.access==='Free Local'||r.access==='Limited Free')&&r.reviewStatus==='Verified'&&date.getTime()>=Date.parse(r.checkedAt+'T00:00:00Z')&&(date.getTime()-Date.parse(r.checkedAt+'T00:00:00Z'))/86400000<=30)
 .sort((a,b)=>Number(b.access==='Free Local')-Number(a.access==='Free Local'))
}
export function detectedCreativeAssets(record:CreativeRecord,models:ModelFinding[]):ModelFinding[]{
 const match:Record<string,RegExp>={'wan-local':/wan.?2[._-]?2/i,'ltx-local':/ltx.?2[._-]?5/i,'ace-step':/ace.?step/i,'flux-schnell':/flux.*schnell/i,sd35:/sd.?3[._-]?5|stable.diffusion.?3[._-]?5/i,hunyuan3d:/hunyuan.?3d.?2/i,whisper:/whisper.*small/i}
 return match[record.id]?models.filter(m=>match[record.id].test(m.name)):[]
}
