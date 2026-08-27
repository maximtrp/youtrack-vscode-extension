import * as vscode from "vscode"
import { ServerStore, normalizeUrl, type ServerInfo } from "../domain/serverStore"
import { ServerItem } from "./items"

const labelFromUrl = (url: string) => url.replace(/^https?:\/\//, "")

export class ServersProvider implements vscode.TreeDataProvider<ServerItem> {
  private readonly store: ServerStore
  private readonly changed = new vscode.EventEmitter<ServerItem | undefined | null | void>()
  readonly onDidChangeTreeData = this.changed.event

  servers: ServerInfo[] = []

  constructor(secrets: vscode.SecretStorage) {
    this.store = new ServerStore(secrets)
  }

  refresh(): void {
    this.changed.fire()
  }

  getTreeItem(element: ServerItem): vscode.TreeItem {
    return element
  }

  async getChildren(): Promise<ServerItem[]> {
    this.servers = await this.store.list()
    if (this.servers.length === 0) {
      vscode.commands.executeCommand("setContext", "hasServerSelected", false)
    }
    return this.servers.map((server) => new ServerItem(server))
  }

  getFirst(): ServerItem | undefined {
    const [first] = this.servers
    return first ? new ServerItem(first) : undefined
  }

  async addServer(): Promise<void> {
    const url = await this.askUrl()
    if (!url) {
      return
    }

    if (await this.store.find(url)) {
      vscode.window.showErrorMessage("A server with this URL already exists")
      return
    }

    const token = await this.askToken()
    if (!token) {
      vscode.window.showWarningMessage("You have not entered a YouTrack server token")
      return
    }

    const label = (await this.askLabel(labelFromUrl(url))) || labelFromUrl(url)
    const caCertPath = await this.askCaCertPath()

    await this.store.add({ url, token, label, caCertPath })
    vscode.window.showInformationMessage("You have successfully added a YouTrack server")
    this.refresh()
  }

  async editServer(item: ServerItem): Promise<ServerInfo | undefined> {
    const previous = item.server

    const url = await this.askUrl(previous.url)
    if (!url) {
      return undefined
    }

    const conflict = await this.store.find(url)
    if (conflict && conflict.url !== previous.url) {
      vscode.window.showErrorMessage("A server with this URL already exists")
      return undefined
    }

    const token = await this.askToken(previous.token)
    if (token === undefined) {
      return undefined
    }

    const label = (await this.askLabel(previous.label)) || previous.label
    const caCertPath = await this.askCaCertPath(previous.caCertPath)

    const updated: ServerInfo = { url, token: token || previous.token, label, caCertPath }
    await this.store.replace(previous.url, updated)
    vscode.window.showInformationMessage("You have successfully updated your YouTrack server")
    this.refresh()
    return updated
  }

  async deleteServer(item: ServerItem): Promise<void> {
    await this.store.remove(item.url)
    this.refresh()
  }

  private async askUrl(value = ""): Promise<string | undefined> {
    const url = await vscode.window.showInputBox({
      placeHolder: "https://youtrack.domain.name",
      prompt: "Please specify the YouTrack server address",
      value,
      ignoreFocusOut: true,
    })
    if (!url?.trim()) {
      vscode.window.showWarningMessage("You have not entered a YouTrack server address")
      return undefined
    }
    return normalizeUrl(url)
  }

  private askToken(existing?: string): Thenable<string | undefined> {
    return vscode.window.showInputBox({
      placeHolder: "API key",
      prompt: existing
        ? "Specify a new YouTrack API key, or leave it unchanged"
        : "Specify the YouTrack server API key",
      value: existing ?? "",
      password: true,
      ignoreFocusOut: true,
    })
  }

  private askLabel(value: string): Thenable<string | undefined> {
    return vscode.window.showInputBox({
      placeHolder: "Server label",
      prompt: "Please specify a YouTrack server label (optional)",
      value,
      ignoreFocusOut: true,
    })
  }

  private askCaCertPath(value = ""): Thenable<string | undefined> {
    return vscode.window.showInputBox({
      placeHolder: "/path/to/ca-cert.pem",
      prompt: "Path to a trusted CA certificate file (optional, for self-signed certificates)",
      value,
      ignoreFocusOut: true,
    })
  }
}
