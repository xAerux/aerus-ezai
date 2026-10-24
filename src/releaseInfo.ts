/** Build identity injected by Vite from the packaging script. Do not hand-edit version or commit values here. */
export interface EzAiBuildIdentity {
  version: string
  channel: string
  commit: string
  dirty: boolean
  buildTimeUtc: string
}

declare const __EZAI_BUILD__: EzAiBuildIdentity

export const EZ_AI_BUILD: EzAiBuildIdentity = __EZAI_BUILD__
export const EZ_AI_VERSION = EZ_AI_BUILD.version

const CHANNEL_LABELS: Record<string, string> = { production: 'Production', candidate: 'Candidate', development: 'Development' }

export function channelLabel(channel: string) {
  return CHANNEL_LABELS[channel] ?? channel
}

export function commitLabel(build: EzAiBuildIdentity) {
  if (build.commit === 'unknown') return 'Source commit not recorded'
  return build.dirty ? `${build.commit} · uncommitted changes` : build.commit
}

export function describeBuild(build: EzAiBuildIdentity) {
  return `EZ AI ${build.version} · ${channelLabel(build.channel)} · ${commitLabel(build)} · built ${build.buildTimeUtc}`
}
