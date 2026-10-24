import { useState } from 'react'
import { Clipboard } from 'lucide-react'
import { channelLabel, commitLabel, describeBuild, EZ_AI_BUILD } from './releaseInfo'

export default function BuildIdentityPanel() {
  const [message, setMessage] = useState('')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(describeBuild(EZ_AI_BUILD))
      setMessage('Build information copied.')
    } catch {
      setMessage('Clipboard is unavailable. Select the build details to copy them.')
    }
  }
  return <div className="build-identity" aria-label="About this build">
    <b>About this build</b>
    <dl>
      <div><dt>Version</dt><dd>{EZ_AI_BUILD.version}</dd></div>
      <div><dt>Channel</dt><dd>{channelLabel(EZ_AI_BUILD.channel)}</dd></div>
      <div><dt>Source</dt><dd>{commitLabel(EZ_AI_BUILD)}</dd></div>
      <div><dt>Built (UTC)</dt><dd>{EZ_AI_BUILD.buildTimeUtc}</dd></div>
    </dl>
    <p className="build-identity-notice">EZ AI is an independent project by Aeru Creations. It is not affiliated with, endorsed by or sponsored by any AI provider or product it names. Product names are the trademarks of their owners and are used only to identify them.</p>
    <button type="button" onClick={copy}><Clipboard size={14}/> Copy build info</button>
    {message && <small role="status">{message}</small>}
  </div>
}
