import type {PlanRecord} from './valueCatalog.ts'
export const serviceReviewDate='2026-10-21'
export function grokBotAccess(planId:string,legacyConnected=false){
 if(['x-sub-premium','x-sub-super','x-sub-ultra'].includes(planId))return 'Included · shared weekly Grok / Grok Bot / Cursor allowance'
 if(['supergrok-legacy','supergrok-plus-legacy','supergrok-heavy-legacy'].includes(planId))return legacyConnected?'Owner-confirmed connected SuperGrok route; verify allowance in account':'Conditional · some connected SuperGrok customers qualify; not inferred'
 return 'Not confirmed included by this catalog'
}
export const grokLegacyPlans:PlanRecord[]=['SuperGrok','SuperGrok Plus','SuperGrok Heavy'].map((name,i)=>({id:['supergrok-legacy','supergrok-plus-legacy','supergrok-heavy-legacy'][i],provider:'X Subscription / SuperGrok legacy',name,monthlyUsd:null,status:'Unverified',availability:'Legacy continuation',access:['Subscription','Cloud'],modelAccess:'Existing SuperGrok access; some accounts connected to Cursor include Grok Bot. Confirm your entitlement manually.',usage:'Account-specific; no fixed numerical allowance verified here.',apiSeparate:true,limitations:'New unified X plans differ. Enter your actual monthly cost; no new purchase price asserted. Switching account unification is optional and can be permanent.',source:'https://docs.x.ai/x-subscription/grok-bot',verifiedAt:serviceReviewDate}))
