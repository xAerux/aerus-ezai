const icons: Record<string, string> = {
  ChatGPT: '/agent-logos/codex.ico', 'ChatGPT / Codex': '/agent-logos/codex.ico', 'Codex CLI': '/agent-logos/codex.ico', Codex: '/agent-logos/codex.ico',
  Claude: '/agent-logos/claude-code.png', 'Claude Desktop': '/agent-logos/claude-code.png', 'Claude Code': '/agent-logos/claude-code.png',
  Gemini: '/agent-logos/gemini.png', Grok: '/agent-logos/grok.ico', Cursor: '/agent-logos/cursor.ico',
  'LM Studio': '/agent-logos/lm-studio.ico', OpenCode: '/agent-logos/opencode.svg',
  Ollama: '/agent-logos/ollama.ico', StarNet: '/agent-logos/starnet.ico',
}
const marks: Record<string, string> = { Gemini: 'G', Cursor: 'C', 'LM Studio': 'LM', OpenCode: 'OC' }
const tones: Record<string, string> = { Gemini: 'gemini', Cursor: 'cursor', 'LM Studio': 'lmstudio', OpenCode: 'opencode' }

/** Bundled installed-app icons where present; brand-tinted monograms remain legible offline. */
export default function ProductBrand({ name, className = '' }: { name: string; className?: string }) {
  const src = icons[name]
  const localExecutableIcon = name === 'Grok' || name === 'StarNet'
  return <span className={`product-brand ${src ? 'has-product-icon' : `product-brand-${tones[name] || 'generic'}`} ${className}`.trim()} aria-label={`${name} application identity`} title={src ? localExecutableIcon ? `${name} icon extracted from the verified installed Windows app` : `${name} product icon bundled for offline use` : `${name} branded initials · full product icon unavailable offline`}>
    {src ? <img src={src} alt=""/> : <b aria-hidden="true">{marks[name] || name.slice(0, 2).toUpperCase()}</b>}
  </span>
}
