export const recorder = {
  commands: [] as string[],
  treeViews: [] as string[],

  reset() {
    this.commands = []
    this.treeViews = []
  },
}

class Disposable {
  dispose() {}
}

export class TreeItem {
  label?: string
  id?: string
  tooltip?: string
  description?: string
  iconPath?: unknown
  contextValue?: string
  command?: unknown
  collapsibleState?: number

  constructor(label?: string, collapsibleState?: number) {
    this.label = label
    this.collapsibleState = collapsibleState
  }
}

export class ThemeIcon {
  constructor(
    readonly id: string,
    readonly color?: unknown
  ) {}
}

export class ThemeColor {
  constructor(readonly id: string) {}
}

export class EventEmitter<T> {
  event = (_listener: (value: T) => void) => new Disposable()
  fire(_value?: T) {}
  dispose() {}
}

export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 }
export const ViewColumn = { One: 1 }
export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 }

export const window = {
  createTreeView(id: string, _options: unknown) {
    recorder.treeViews.push(id)
    return {
      selection: [] as unknown[],
      onDidChangeSelection: () => new Disposable(),
      reveal: () => Promise.resolve(),
      dispose: () => {},
    }
  },
  createWebviewPanel: () => ({
    title: "",
    webview: { html: "" },
    reveal: () => {},
    onDidDispose: () => new Disposable(),
    dispose: () => {},
  }),
  showErrorMessage: () => Promise.resolve(undefined),
  showWarningMessage: () => Promise.resolve(undefined),
  showInformationMessage: () => Promise.resolve(undefined),
  showInputBox: () => Promise.resolve(undefined),
  showQuickPick: () => Promise.resolve(undefined),
}

export const commands = {
  registerCommand(id: string, _handler: unknown) {
    recorder.commands.push(id)
    return new Disposable()
  },
  executeCommand: () => Promise.resolve(undefined),
}

export const workspace = {
  getConfiguration: () => ({
    get: () => undefined,
    update: () => Promise.resolve(),
  }),
  onDidChangeConfiguration: () => new Disposable(),
}

export const extensions = { getExtension: () => undefined }
export const env = { openExternal: () => Promise.resolve(true) }
export const Uri = { parse: (value: string) => value }
