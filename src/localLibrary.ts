import type { ModelFinding } from './softwareDiscovery.ts'
export const libraryGroups=['Ollama Coding & Chat','Image Models','Video Models','Music & Audio','3D','Supporting Model Components','Unclassified']
export function localLibraryGroup(model:ModelFinding):string{
 if(model.runtime.toLowerCase()==='ollama')return libraryGroups[0]
 const path=(model.location||'').replaceAll('\\','/').toLowerCase(),name=`${model.name} ${model.capabilities||''}`.toLowerCase()
 if(/\/(vae|vaes|text_encoders|clip|clip_vision|loras|lora|controlnet|embeddings|upscale_models)\//.test(path))return libraryGroups[5]
 if(/wan[ _.-]?\d|ltx|hunyuanvideo|video diffusion/.test(name))return libraryGroups[2]
 if(/ace[-_ ]?step|stable[-_ ]?audio|whisper|speech|text.to.speech|tts|music/.test(name))return libraryGroups[3]
 if(/trellis|hunyuan.?3d|triposr|3d mesh/.test(name))return libraryGroups[4]
 if(/flux|stable.?diffusion|sdxl|image generation/.test(name))return libraryGroups[1]
 return libraryGroups[6]
}
export function groupLocalLibrary(models:ModelFinding[]){
 const seen=new Set<string>();const unique=models.filter(m=>{const key=(m.runtime.toLowerCase()==='ollama'?'ollama:'+m.id:m.location||m.id).toLowerCase();if(seen.has(key))return false;seen.add(key);return true})
 return libraryGroups.map(name=>{const items=unique.filter(m=>localLibraryGroup(m)===name);return {name,items,count:items.length,knownBytes:items.reduce((sum,m)=>sum+(m.sizeBytes||0),0),unknownSizes:items.filter(m=>m.sizeBytes==null).length}})
}
