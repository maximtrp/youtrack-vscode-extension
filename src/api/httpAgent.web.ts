export interface HttpsAgentOptions {
  rejectUnauthorized: boolean
  caCertPath?: string
}

export class CaCertificateError extends Error {}

export function createHttpsAgent(_options: HttpsAgentOptions): undefined {
  return undefined
}
