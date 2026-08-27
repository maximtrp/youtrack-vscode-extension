import * as vscode from "vscode"
import type { Project } from "../api/types"
import { settings } from "../config/settings"
import { toUserMessage } from "../domain/errors"
import { buildIssueQuery } from "../domain/issueQuery"
import { IssueItem, None } from "./items"
import { ClientTreeProvider } from "./treeProvider"

type RecentNode = IssueItem | None

export class RecentIssuesProvider extends ClientTreeProvider<RecentNode> {
  private project?: Project

  setProject(project?: Project): void {
    this.project = project
  }

  reset(): this {
    this.project = undefined
    this.client = undefined
    return this
  }

  async getChildren(): Promise<RecentNode[]> {
    if (!this.client || !this.project) {
      return [new None("Select a project to view issues")]
    }

    const query = buildIssueQuery({
      project: this.project.name ?? this.project.id,
      sortBy: settings.sortBy(),
      sortOrder: settings.sortOrder(),
      assignedTo: settings.assignedTo(),
      showResolved: settings.showResolved(),
    })

    try {
      const issues = await this.client.getIssues({ query, top: settings.pageSize() })
      return issues.length > 0
        ? issues.map((issue) => new IssueItem(issue, this.client?.self))
        : [new None("Issues not found")]
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to retrieve issues. ${toUserMessage(error)}`)
      return [new None("Issues retrieving failed")]
    }
  }
}
