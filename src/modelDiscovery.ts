import type { ValueModel } from './valueCatalog.ts'
export type AccessFilter = 'All Models'|'My AIs'|'Free'|'Local'
export const comparisonLimit=Infinity
export function selectComparison(ids:string[],id:string):string[]{
 return ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]
}
export const localRoute=(model:ValueModel)=>model.access==='Local runtime'
export function browseModels(models:ValueModel[],filter:AccessFilter,detected:string){
 return models.filter(m=>filter==='All Models'||filter==='Local'&&localRoute(m)||filter==='Free'&&localRoute(m)||filter==='My AIs'&&(
 (m.provider==='OpenAI'?/chatgpt|codex/.test(detected):m.provider==='Anthropic'?/claude/.test(detected):m.provider==='Google'?/gemini/.test(detected):m.provider==='xAI'?/grok/.test(detected):detected.includes(m.provider.toLowerCase().split(' ')[0]))))
}
export function modelIdentity(model:ValueModel){
 const families:Record<string,string>={OpenAI:'GPT',Anthropic:'Claude',Google:'Gemini',xAI:'Grok',Cursor:'Cursor routing'}
 return {family:families[model.provider]||(model.officialModelId.includes('deepseek')?'DeepSeek':model.officialModelId.includes('gpt-oss')?'GPT OSS':'Runtime-dependent'),version:model.officialModelId,state:model.availability}
}
