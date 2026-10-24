import type {ValueModel} from './valueCatalog.ts'
export const modesVerifiedAt='2026-10-21'
export const modesCatalogVersion='2026-10-21.1'
export interface ModeProfile {efforts:string[];parameter:string;source:string;restriction:string;defaultEffort:string}
const openai=(id:string,efforts:string[],defaultEffort='medium'):ModeProfile=>({efforts,parameter:'reasoning.effort',defaultEffort,source:`https://developers.openai.com/api/docs/models/${id}`,restriction:'API support only. Product menus and entitlement can differ. Responses API required for the full tool surface.'})
const claude=(defaultEffort:string):ModeProfile=>({efforts:['low','medium','high','xhigh','max'],parameter:'output_config.effort',defaultEffort,source:'https://platform.claude.com/docs/en/build-with-claude/effort',restriction:'Claude API effort affects text, thinking and tool calls; it is not a Claude Code subscription allowance.'})
const gemini=(minimal=false):ModeProfile=>({efforts:[...(minimal?['minimal']:[]),'low','medium','high'],parameter:'thinking_level',defaultEffort:minimal?'minimal':'medium',source:'https://ai.google.dev/gemini-api/docs/thinking',restriction:'Gemini API thinking levels. App controls and subscription access may differ.'})
export const modeProfiles:Record<string,ModeProfile>={
 'gpt-6.1-sol':openai('gpt-6.1-sol',['low','medium','high','xhigh','max']),
 'gpt-6-astra':openai('gpt-6-astra',['low','medium','high','xhigh','max'],'Not asserted'),
 'gpt-6-luna':openai('gpt-6-luna',['none','low','medium','high','xhigh','max']),
 'gpt-5.6-sol':openai('gpt-5.6-sol',['none','low','medium','high','xhigh','max']),
 'gpt-5.3-codex':openai('gpt-5.3-codex',['low','medium','high','xhigh'],'Not asserted'),
 'claude-opus-5-5':claude('medium'),'claude-sonnet-5-5':claude('high'),'claude-haiku-5-5':claude('medium'),
 'gemini-4-argon':gemini(),'gemini-3.8-flash':gemini(),'gemini-3.5-flash-lite':gemini(true)
}
export const effortGuidance:Record<string,string>={none:'Skip optional reasoning where supported; try direct extraction or formatting.',minimal:'Minimal thinking for straightforward high-volume tasks; not the same as None.',low:'Try routine edits and tightly scoped tasks. Validate the result before keeping the cheaper run.',medium:'A starting point for everyday development and multi-step questions.',high:'Consider difficult bugs, competing constraints and careful analysis; check whether the extra work improves results.',xhigh:'Extra High: extended deliberation for demanding work; expect potentially longer responses and latency.',max:'Reserve for the hardest supported tasks after cheaper attempts fail. Token use and latency can rise substantially.'}
export const executionGuidance:Record<string,string>={Standard:'Default request processing; no speed guarantee.',Batch:'Asynchronous jobs. Lower rates do not make it suitable for interactive coding.',Flex:'Flexible lower-priority processing; availability, latency and timeout restrictions apply.',Fast:'Higher-priced speed tier. It does not itself increase reasoning effort.',Ultrafast:'Exact eligible OpenAI Responses API routes only; premium speed pricing.', 'Off-peak':'Provider time-window pricing; verify the window before sending requests.'}
export function supportedTiers(model:ValueModel){return [...new Set(model.pricing.filter(r=>r.status==='Verified'&&r.tier!=='Long context').flatMap(r=>r.label==='Flex / Batch'?['Batch','Flex']:[r.tier]))]}
