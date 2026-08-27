import * as vscode from "vscode"
import { YoutrackClient } from "../api/youtrackClient"

export abstract class ClientTreeProvider<T extends vscode.TreeItem> implements vscode.TreeDataProvider<T> {
  protected client?: YoutrackClient

  private readonly changed = new vscode.EventEmitter<T | undefined | null | void>()
  readonly onDidChangeTreeData = this.changed.event

  refresh(client?: YoutrackClient): void {
    this.client = client
    this.changed.fire()
  }

  getTreeItem(element: T): vscode.TreeItem {
    return element
  }

  abstract getChildren(element?: T): Promise<T[]>
}
