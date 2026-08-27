import * as vscode from "vscode"
import type { Agile, Issue, Project, Sprint, User } from "../api/types"
import { ASSIGNEE, PRIORITY, STATE, customFieldName, findCustomFieldValue } from "../domain/issueFields"
import type { ServerInfo } from "../domain/serverStore"

const fmt = new Intl.DateTimeFormat("default", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric",
})

export class None extends vscode.TreeItem {
  constructor(label: string, state: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None) {
    super(label, state)
    this.iconPath = new vscode.ThemeIcon(/error|fail/i.test(label) ? "warning" : "info")
  }
}

export class ServerItem extends vscode.TreeItem {
  readonly server: ServerInfo

  constructor(server: ServerInfo) {
    super(server.label, vscode.TreeItemCollapsibleState.None)
    this.server = server
    this.tooltip = server.url
    this.description = server.url
    this.iconPath = new vscode.ThemeIcon("server")
    this.contextValue = "server"
  }

  get url(): string {
    return this.server.url
  }
}

export class AgileItem extends vscode.TreeItem {
  readonly agile: Agile

  constructor(agile: Agile) {
    super(
      agile.name,
      agile.projects?.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    )
    this.agile = agile
    this.tooltip = agile.name
    this.contextValue = "agile"
    this.iconPath = new vscode.ThemeIcon("folder")
  }

  get projects(): Project[] {
    return this.agile.projects ?? []
  }
}

export class ProjectItem extends vscode.TreeItem {
  readonly project: Project
  readonly parent: AgileItem

  constructor(project: Project, parent: AgileItem) {
    super(project.name ?? "Unnamed Project", vscode.TreeItemCollapsibleState.None)
    this.project = project
    this.parent = parent
    this.tooltip = project.name
    this.contextValue = project.archived ? "project_archived" : "project_active"
    this.description = project.shortName ? `(${project.shortName})` : undefined
    this.iconPath = new vscode.ThemeIcon(
      "project",
      project.archived ? new vscode.ThemeColor("disabledForeground") : undefined
    )
  }
}

export class SprintItem extends vscode.TreeItem {
  readonly sprint: Sprint

  constructor(sprint: Sprint) {
    super(sprint.name ?? "Unnamed Sprint", vscode.TreeItemCollapsibleState.Collapsed)
    this.sprint = sprint
    this.iconPath = new vscode.ThemeIcon("history")
    this.contextValue = "sprint"
  }
}

export class GroupingItem extends vscode.TreeItem {
  readonly field: string
  readonly value: string
  readonly sprint?: Sprint

  constructor(field: string, value: string, sprint?: Sprint) {
    super(value, vscode.TreeItemCollapsibleState.Collapsed)
    this.field = field
    this.value = value
    this.sprint = sprint
    this.tooltip = `${field}: ${value}`
    this.iconPath = new vscode.ThemeIcon("folder")
    this.contextValue = "group"
  }
}

export class IssueItem extends vscode.TreeItem {
  readonly issue: Issue
  readonly code: string

  constructor(issue: Issue, self?: User) {
    const code = `${issue.project?.shortName ?? "Issue"}-${issue.numberInProject}`
    const label = `${code}: ${issue.summary ?? "No summary provided"}`
    super(label, vscode.TreeItemCollapsibleState.None)

    const assignee = findCustomFieldValue(issue, ASSIGNEE)
    this.issue = issue
    this.code = code
    this.id = issue.id
    this.contextValue = "issue"
    this.iconPath = issueIcon(issue, assignee?.login, self?.login)
    this.tooltip = [
      `${label}\n`,
      assignee ? `Assigned to: ${assignee.fullName}` : undefined,
      describeField(issue, STATE),
      describeField(issue, PRIORITY),
      issue.reporter ? `Created by: ${issue.reporter.fullName}` : undefined,
      issue.updater ? `Updated by: ${issue.updater.fullName}` : undefined,
      issue.created ? `Created on: ${fmt.format(issue.created)}` : undefined,
      issue.updated ? `Updated on: ${fmt.format(issue.updated)}` : undefined,
    ]
      .filter(Boolean)
      .join("\n")
    this.command = {
      title: "Show Description",
      command: "youtrack.showIssueDescription",
      arguments: [this],
    }
  }
}

function describeField(issue: Issue, field: string): string | undefined {
  const name = customFieldName(issue, field)
  return name ? `${field}: ${name}` : undefined
}

function issueIcon(issue: Issue, assigneeLogin?: string, selfLogin?: string): vscode.ThemeIcon {
  if (issue.resolved) {
    return new vscode.ThemeIcon("pass", new vscode.ThemeColor("charts.green"))
  }
  if (assigneeLogin && assigneeLogin === selfLogin) {
    return new vscode.ThemeIcon("warning")
  }
  return new vscode.ThemeIcon("note")
}
