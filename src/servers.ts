import * as vscode from "vscode";

interface ServerInfo {
  id: number
  url: string
  token: string
  label: string
}

export class ServersProvider implements vscode.TreeDataProvider<ServerItem> {
  servers: ServerInfo[] = []

  constructor(private context: vscode.ExtensionContext) {}

  private _onDidChangeTreeData: vscode.EventEmitter<
    ServerItem | undefined | null | void
  > = new vscode.EventEmitter<ServerItem | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<
    ServerItem | undefined | null | void
  > = this._onDidChangeTreeData.event

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  async addServer() {
    let servers: ServerInfo[] = []

    const url = await vscode.window.showInputBox({
      placeHolder: "https://youtrack.domain.name",
      prompt: "Please specify YouTrack server address",
      value: "",
      ignoreFocusOut: true,
    })
    if (!url) {
      vscode.window.showWarningMessage(
        `You have not entered YouTrack server address`
      )
      return
    }

    const label = await vscode.window.showInputBox({
      placeHolder: "Server label",
      prompt: "Please specify YouTrack server label (optional)",
      value: url.replace("https://", ""),
      ignoreFocusOut: true,
    })

    servers = JSON.parse((await this.context.secrets.get("servers")) || "[]")
    const serverExists = servers.find((server: ServerInfo) => server.url === url)

    if (serverExists) { 
      vscode.window.showErrorMessage("Server with this URL already exists")
      return
    }

    const token = await vscode.window.showInputBox({
      placeHolder: "API key",
      prompt: "Specify YouTrack server API key",
      value: "",
      ignoreFocusOut: true,
    })
    if (!token) {
      vscode.window.showWarningMessage(
        `You have not entered YouTrack server token`
      )
      return
    }

    const server: ServerInfo = {
      id: this.servers.length,
      url: url.replace(/\/+$/, ""),
      token: token,
      label: label || url.replace("https://", ""),
    }
    servers.push(server)

    await this.context.secrets.store("servers", JSON.stringify(servers))
    vscode.window.showInformationMessage(
      `You have successfully added a YouTrack server`
    )
    this.refresh()
  }

  async editServer(server: ServerItem): Promise<ServerInfo | undefined> {
    let servers: ServerInfo[] = []

    const url = (
      (await vscode.window.showInputBox({
        placeHolder: "https://youtrack.domain.name",
        prompt: "Please specify YouTrack server address",
        value: server.url,
        ignoreFocusOut: true,
      })) || ""
    ).replace(/\/+$/, "")

    if (!url) {
      vscode.window.showWarningMessage(
        `You have not entered YouTrack server address`
      )
      return
    } else {
      servers = JSON.parse(
        (await this.context.secrets.get("servers")) || "[]"
      ).filter(
        (existingServer: ServerInfo) => server.url !== existingServer.url
      )

      const serverExists = servers.find(
        (server: ServerInfo) => server.url === url
      )
      if (serverExists) {
        vscode.window.showErrorMessage("Server with this URL already exists")
        return
      }
    }

    const label =
      (await vscode.window.showInputBox({
        placeHolder: "Server label",
        prompt: "Please specify YouTrack server label (optional)",
        value: server.label?.toString(),
        ignoreFocusOut: true,
      })) || url.replace("https://", "")

    const token =
      (await vscode.window.showInputBox({
        placeHolder: "API key",
        prompt: "Specify YouTrack server API key",
        ignoreFocusOut: true,
      })) || server.token

    const serverNew: ServerInfo = {
      id: this.servers.length,
      url: url,
      token: token,
      label: label,
    }
    servers.push(serverNew)

    await this.context.secrets.store("servers", JSON.stringify(servers))
    vscode.window.showInformationMessage(
      `You have successfully updated your YouTrack server`
    )
    this.refresh()
    return serverNew
  }

  async deleteServer(serverDeleted: vscode.TreeItem) {
    this.servers = this.servers.filter(
      (server: ServerInfo) => server.label !== serverDeleted.label
    )
    await this.context.secrets.store("servers", JSON.stringify(this.servers))
    this.refresh()
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element
  }

  async getChildren(): Promise<ServerItem[]> {
    return await this.getServers()
  }

  getFirst(): ServerItem | null {
    if (this.servers.length > 0) {
      return new ServerItem(this.servers[0])
    } else {
      return null
    }
  }

  async getServers(): Promise<ServerItem[]> {
    this.servers = JSON.parse(
      (await this.context.secrets.get("servers")) || "[]"
    )
    if (this.servers.length > 0) {
      return this.servers.map((s) => new ServerItem(s))
    } else {
      vscode.commands.executeCommand("setContext", "hasServerSelected", false)
      return []
    }
  }
}

export class ServerItem extends vscode.TreeItem {
  url: string
  token: string

  constructor(server: ServerInfo) {
    super(server.label, vscode.TreeItemCollapsibleState.None)
    this.url = server.url
    this.tooltip = server.url
    this.token = server.token
    this.iconPath = new vscode.ThemeIcon("server")
  }
}
