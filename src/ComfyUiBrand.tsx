import { useState } from 'react'

// Bundled icon only: the app never fetches brand artwork from the network.
const iconSources = [
  '/comfyui-desktop-icon.png',
]

export default function ComfyUiBrand({ className = '' }: { className?: string }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  if (sourceIndex >= iconSources.length) return <a className={`comfyui-brand-fallback ${className}`} href="https://comfy.org/download" target="_blank" rel="noreferrer">ComfyUI</a>
  return <img className={`comfyui-brand-icon ${className}`} src={iconSources[sourceIndex]} alt="ComfyUI Desktop official icon" onError={() => setSourceIndex(value => value + 1)} />
}
