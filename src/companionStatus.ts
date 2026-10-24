import type { AerusSdmStatus, AerusUsageHudStatus } from './localAgents'

/** Shared launcher status for Home and Tools: one place that decides labels, tones and whether Open is enabled. */
export type CompanionApp = 'hud' | 'sdm'
export type CompanionStatus = AerusUsageHudStatus | AerusSdmStatus
export type CompanionTone = 'ready' | 'approval' | 'missing' | 'unavailable' | 'checking'

export interface CompanionView {
  label: string
  tone: CompanionTone
  canOpen: boolean
  needsApproval: boolean
  detail: string
}

const READY_STATUSES = ['available', 'running']

export function serviceUnavailable(error?: unknown): CompanionStatus {
  return {
    success: false,
    status: 'service-unavailable',
    message: error instanceof Error && error.message
      ? error.message
      : 'The native EZ AI service is unavailable in this preview. This does not prove the companion is missing.',
  }
}

export function describeCompanion(app: CompanionApp, status: CompanionStatus | null): CompanionView {
  if (!status) {
    return { label: 'Checking…', tone: 'checking', canOpen: false, needsApproval: false, detail: 'Checking verified install locations.' }
  }
  if (status.status === 'service-unavailable') {
    return { label: 'Desktop service unavailable', tone: 'unavailable', canOpen: false, needsApproval: false, detail: 'Detection needs the EZ AI desktop app. This is not proof that the companion is missing.' }
  }
  const ready = status.success === true && READY_STATUSES.includes(status.status)
  if (ready) {
    if (app === 'hud') {
      const label = status.status === 'running' ? 'Running · native window' : 'Installed · launchable'
      return { label, tone: 'ready', canOpen: true, needsApproval: false, detail: status.message }
    }
    return { label: status.status === 'running' ? 'Running · detected' : 'Installed · detected', tone: 'ready', canOpen: true, needsApproval: false, detail: status.message }
  }
  if (status.status === 'launched') {
    return { label: 'Opened', tone: 'ready', canOpen: true, needsApproval: false, detail: status.message }
  }
  return { label: 'Not available', tone: 'missing', canOpen: false, needsApproval: false, detail: status.message }
}

/** Windows reports unsigned executables in the status message; the caller must confirm before opening one. */
export function needsUnsignedConfirmation(status: CompanionStatus | null) {
  return Boolean(status?.message.toLowerCase().includes('unsigned'))
}

export const UNSIGNED_CONFIRMATION: Record<CompanionApp, string> = {
  hud: 'Windows reports that this Aerus AI Usage HUD executable is unsigned. Open it only if you recognize this installation and trust its source. Continue?',
  sdm: 'Windows reports that this Aerus SDM executable is unsigned. Open it only if you recognize this installation and trust its source. Continue?',
}
