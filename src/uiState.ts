import { useEffect, useState } from 'react'
export function readStored<T>(key:string,fallback:T):T{
 try{const raw=localStorage.getItem(key);if(raw===null)return fallback;let value:unknown;try{value=JSON.parse(raw)}catch{value=raw}
 if(typeof fallback==='string')return (typeof value==='string'?value:raw) as T
 if(Array.isArray(fallback))return (Array.isArray(value)?value.filter(item=>typeof item==='string'):fallback) as T
 return value!==null&&typeof value===typeof fallback&&(typeof value!=='number'||Number.isFinite(value))?value as T:fallback}catch{return fallback}
}
export function useStored<T>(key:string,fallback:T){const [value,setValue]=useState<T>(()=>readStored(key,fallback));useEffect(()=>{try{localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value))}catch{/* Storage may be unavailable; current session still works. */}},[key,value]);return [value,setValue] as const}
