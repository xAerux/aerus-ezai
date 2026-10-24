/** Classifies failures of the local EZ AI desktop service so each screen can explain the real condition. */
export type ServiceFailureKind = 'preview-unavailable' | 'connection' | 'unauthorized' | 'route-missing' | 'server' | 'invalid-response'

export class ServiceError extends Error {
  readonly kind: ServiceFailureKind
  readonly status?: number
  constructor(kind: ServiceFailureKind, message: string, status?: number) {
    super(message)
    this.name = 'ServiceError'
    this.kind = kind
    this.status = status
  }
}

/** The native window loads the interface with ?desktop=1; a browser or Vite preview does not. */
export function isDesktopHost(): boolean {
  try { return new URLSearchParams(window.location.search).has('desktop') } catch { return false }
}

export const PREVIEW_UNAVAILABLE_MESSAGE = 'Desktop service unavailable. Native Windows actions run only in the EZ AI desktop application. Guides, previews, copy and manual steps still work here.'

/**
 * Builds the error for a failed or unreadable service call. In a browser preview there is no native service, so every
 * failure is reported as preview-unavailable rather than as a raw HTTP status. In the desktop app failures are distinct.
 */
export function serviceFailure(label: string, response?: Response | null): ServiceError {
  if (!isDesktopHost()) return new ServiceError('preview-unavailable', PREVIEW_UNAVAILABLE_MESSAGE, response?.status)
  if (!response) return new ServiceError('connection', `${label} could not reach the EZ AI desktop service. Restart EZ AI. If this continues, check that security software is not blocking its local connection.`)
  const status = response.status
  if (status === 401 || status === 403) return new ServiceError('unauthorized', `${label} was refused by the desktop service's origin check (HTTP ${status}). Restart EZ AI from its own window.`, status)
  if (status === 404) return new ServiceError('route-missing', `${label} is not available in this build of the desktop service. Install the current EZ AI build.`, status)
  if (status >= 500) return new ServiceError('server', `${label} failed inside the desktop service (HTTP ${status}). Restart EZ AI and try again.`, status)
  return new ServiceError('invalid-response', `${label} returned a response EZ AI could not read (HTTP ${status}).`, status)
}

/** Reads a service JSON body, or throws a classified error. */
export async function readServiceJson<T>(response: Response, label: string): Promise<T> {
  try { return await response.json() as T }
  catch { throw serviceFailure(label, response) }
}

/** Sends a request to the local service; a network failure is classified rather than shown as a raw browser error. */
export async function fetchService(label: string, input: string, init: RequestInit): Promise<Response> {
  try { return await fetch(input, init) }
  catch { throw serviceFailure(label, null) }
}
