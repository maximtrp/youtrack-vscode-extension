import * as vscode from "vscode"
import type { Project } from "../api/types"
import { toUserMessage } from "../domain/errors"
import { AgileItem, None, ProjectItem } from "./items"
import { ClientTreeProvider } from "./treeProvider"

type AgileNode = AgileItem | ProjectItem | None

const byName = (a: Project, b: Project) => (a.name ?? "").localeCompare(b.name ?? "")

export class AgilesProjectsProvider extends ClientTreeProvider<AgileNode> {
  getParent(element: AgileNode): AgileItem | null {
    return element instanceof ProjectItem ? element.parent : null
  }

  async getChildren(element?: AgileNode): Promise<AgileNode[]> {
    if (!this.client) {
      return [new None("Select a server to view agiles and projects")]
    }

    if (element instanceof AgileItem) {
      return [...element.projects].sort(byName).map((project) => new ProjectItem(project, element))
    }

    if (element) {
      return []
    }

    try {
      const agiles = await this.client.getAgiles()
      const withProjects = agiles.filter((agile) => agile.projects?.length)
      return withProjects.length > 0
        ? withProjects.map((agile) => new AgileItem(agile))
        : [new None("Agiles not found")]
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to retrieve agiles, projects and sprints. ${toUserMessage(error)}`)
      return [new None("Agiles retrieving failed")]
    }
  }
}
