import * as fs from "fs"
import * as https from "https"

export interface HttpsAgentOptions {
  rejectUnauthorized: boolean
  caCertPath?: string
}

export class CaCertificateError extends Error {
  constructor(path: string, cause: unknown) {
    super(`Could not read the CA certificate at ${path}: ${(cause as Error).message}`)
    this.name = "CaCertificateError"
  }
}

export function createHttpsAgent({ rejectUnauthorized, caCertPath }: HttpsAgentOptions): https.Agent {
  const options: https.AgentOptions = { rejectUnauthorized }

  if (caCertPath) {
    try {
      options.ca = fs.readFileSync(caCertPath)
      options.rejectUnauthorized = true
    } catch (error) {
      throw new CaCertificateError(caCertPath, error)
    }
  }

  return new https.Agent(options)
}
