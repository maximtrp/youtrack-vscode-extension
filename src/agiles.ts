import * as vscode from "vscode"
import { YoutrackClient } from "./client"
import type { AxiosError } from "axios"

export class AgilesProjectsProvider
  implements vscode.TreeDataProvider<ProjectItem | AgileItem | None>
{
  agiles: Agile[] | null = null
  client?: YoutrackClient

  constructor() {}

  private _onDidChangeTreeData: vscode.EventEmitter<
    ProjectItem | undefined | null | void
  > = new vscode.EventEmitter<ProjectItem | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<
    ProjectItem | undefined | null | void
  > = this._onDidChangeTreeData.event

  refresh(client?: YoutrackClient) {
    this.client = client
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: vscode.TreeItem) {
    return element
  }

  getParent(element: ProjectItem | AgileItem | None): AgileItem | null {
    if (element.contextValue?.startsWith("project")) {
      return (element as ProjectItem).parent
    } else {
      return null
    }
  }

  async getChildren(
    agile?: AgileItem
  ): Promise<AgileItem[] | None[] | ProjectItem[]> {
    if (this.client) {
      if (agile) {
        let projects: Project[] | undefined = agile.projects
        if (projects) {
          projects = projects.sort((i, j) =>
            i.name && j.name && i.name < j.name ? -1 : 1
          )
          return projects.map((project) => new ProjectItem(project, agile))
        } else {
          return [new None("No projects found")]
        }
      } else {
        try {
          const agiles: Agile[] | null = await this.client.getAgiles()

          if (agiles && agiles.length > 0) {
            return agiles!
              .filter((agile) => !!agile.projects)
              .map((agile) => new AgileItem(agile))
          } else {
            return [new None("Agiles not found")]
          }
        } catch (e) {
          const error = e as AxiosError & {
            response: { data: { error: string; error_description: string } }
          }
          vscode.window.showErrorMessage(
            `Failed to retrieve agiles, projects, and sprints. ` +
              (error.response
                ? `Error ${error.response.status}: ${error.response.data.error}. ${error.response.data.error_description}`
                : `Error: ${error.message}`)
          )
          return [new None("Agiles retrieving failed")]
        }
      }
    }
    return [new None("Select a server to view agiles and projects")]
  }
}

export class None extends vscode.TreeItem {
  constructor(
    label: string,
    state: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState
      .None
  ) {
    super(label, state)
    this.iconPath = new vscode.ThemeIcon(
      /error|fail/i.test(label) ? "warning" : "info"
    )
  }
}

export class AgileItem extends vscode.TreeItem {
  public agile: Agile
  public name: string
  public columnSettings: ColumnSettings
  public projects?: Project[]
  public sprints?: Sprint[] | null

  constructor(agile: Agile) {
    super(
      agile.name,
      agile.projects && agile.projects.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    )
    this.tooltip = agile.name
    this.contextValue = "agile"
    this.name = agile.name
    this.agile = agile
    this.projects = agile.projects
    this.sprints = agile.sprints
    this.columnSettings = agile.columnSettings
    this.iconPath = new vscode.ThemeIcon("folder")
  }
}

export class ProjectItem extends vscode.TreeItem {
  public project: Project
  public parent: AgileItem

  constructor(project: Project, agileItem: AgileItem) {
    const label = project.name || "Unnamed Project"
    super(label, vscode.TreeItemCollapsibleState.None)
    this.tooltip = [project.name].join("\n")
    this.contextValue = "project" + (project.archived ? "_archived" : "_active")
    this.project = project
    this.description = project.shortName ? `(${project.shortName})` : undefined
    this.parent = agileItem
    this.iconPath = new vscode.ThemeIcon(
      "project",
      project.archived ? new vscode.ThemeColor("disabledForeground") : undefined
    )
  }
}
