import { fetchService, serviceFailure } from './serviceErrors.ts'
export type InstructionAgentId = 'codex' | 'claude-code'
export type InstructionStatus = 'not-installed' | 'installed' | 'modified' | 'unable-to-inspect'
export type InstructionOperation = 'create' | 'replace' | 'manual-merge'

export interface InstructionFileStatus {
  success: boolean
  agentId: InstructionAgentId
  displayName?: string
  destination?: string
  status: InstructionStatus
  templateVersion?: string
  templateHash?: string
  currentHash?: string | null
  currentContent?: string
  message: string
}

export interface InstructionInstallResult {
  success: boolean
  status: string
  destination?: string
  backupPath?: string
  installedHash?: string
  message: string
}

const templates: Record<InstructionAgentId, string> = {
  codex: '/instruction-templates/codex-global-v1.md',
  'claude-code': '/instruction-templates/claude-code-global-v1.md',
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetchService('The native instruction service', path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const raw = await response.text()
  let result: (T & { message?: string }) | undefined
  try { result = JSON.parse(raw) as T & { message?: string } } catch { /* Browser previews and missing routes return a non-JSON page. */ }
  if (!result) throw serviceFailure('The native instruction service', response)
  return result
}

export const fetchInstructionTemplate = async (agentId: InstructionAgentId): Promise<string> => {
  const response = await fetch(templates[agentId], { credentials: 'same-origin' })
  if (!response.ok) throw new Error('The bundled instruction template could not be loaded.')
  return response.text()
}

export const getInstructionStatus = (agentId: InstructionAgentId, includeContent = false) =>
  request<InstructionFileStatus>('/api/instructions/status', { agentId, includeContent })

export const installInstruction = (input: {
  agentId: InstructionAgentId
  operation: InstructionOperation
  acknowledged: boolean
  approved: boolean
  expectedCurrentHash: string
  templateVersion: string
  mergedContent?: string
}) => request<InstructionInstallResult>('/api/instructions/install', {
  agentId: input.agentId,
  operation: input.operation,
  acknowledged: input.acknowledged,
  approved: input.approved,
  expectedCurrentHash: input.expectedCurrentHash,
  templateVersion: input.templateVersion,
  mergedContentB64: input.mergedContent ? btoa(unescape(encodeURIComponent(input.mergedContent))) : '',
})
