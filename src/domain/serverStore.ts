export interface ServerInfo {
  url: string
  token: string
  label: string
  caCertPath?: string
}

export interface SecretStore {
  get(key: string): Thenable<string | undefined>
  store(key: string, value: string): Thenable<void>
}

const KEY = "servers"

export const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, "")

export class ServerStore {
  constructor(private readonly secrets: SecretStore) {}

  async list(): Promise<ServerInfo[]> {
    const stored = await this.secrets.get(KEY)
    if (!stored) {
      return []
    }
    try {
      const parsed: unknown = JSON.parse(stored)
      return Array.isArray(parsed) ? (parsed as ServerInfo[]) : []
    } catch {
      return []
    }
  }

  async find(url: string): Promise<ServerInfo | undefined> {
    const normalized = normalizeUrl(url)
    return (await this.list()).find((server) => server.url === normalized)
  }

  async add(server: ServerInfo): Promise<void> {
    const servers = await this.list()
    servers.push({ ...server, url: normalizeUrl(server.url) })
    await this.save(servers)
  }

  async replace(previousUrl: string, server: ServerInfo): Promise<void> {
    const normalized = normalizeUrl(previousUrl)
    const servers = (await this.list()).map((existing) =>
      existing.url === normalized ? { ...server, url: normalizeUrl(server.url) } : existing
    )
    await this.save(servers)
  }

  async remove(url: string): Promise<void> {
    const normalized = normalizeUrl(url)
    await this.save((await this.list()).filter((server) => server.url !== normalized))
  }

  private async save(servers: ServerInfo[]): Promise<void> {
    await this.secrets.store(KEY, JSON.stringify(servers))
  }
}
