import * as vscode from "vscode"
import type { Agile, ColumnSettings, EnumBundle, Project, Sprint } from "../api/types"
import { settings } from "../config/settings"
import { toUserMessage } from "../domain/errors"
import { PRIORITY, STATE, TYPE } from "../domain/issueFields"
import { buildIssueQuery, type IssueGroup } from "../domain/issueQuery"
import { GroupingItem, IssueItem, None, SprintItem } from "./items"
import { ClientTreeProvider } from "./treeProvider"

type IssueNode = SprintItem | GroupingItem | IssueItem | None

export interface SelectionContext {
  agile?: Agile
  project?: Project
  sprints?: Sprint[]
  columnSettings?: ColumnSettings
  enumBundles?: EnumBundle[]
}

const BUNDLE_BY_FIELD: Record<string, string> = { [PRIORITY]: "Priorities", [TYPE]: "Types" }

const byStartDescending = (a: Sprint, b: Sprint) => (b.start ?? 0) - (a.start ?? 0)

export class SprintsIssuesProvider extends ClientTreeProvider<IssueNode> {
  private context: SelectionContext = {}

  setContext(context: SelectionContext): void {
    this.context = context
  }

  get selection(): SelectionContext {
    return this.context
  }

  reset(): this {
    this.context = {}
    this.client = undefined
    return this
  }

  async getChildren(element?: IssueNode): Promise<IssueNode[]> {
    if (!this.client || !this.context.project) {
      return [new None("Select a project to view issues")]
    }

    const groupBy = settings.groupBy()

    if (!element) {
      if (this.context.agile?.sprintsSettings?.disableSprints) {
        return groupBy === "None" ? this.getIssues() : this.getGroups(groupBy)
      }
      const sprints = this.context.sprints
      return sprints?.length
        ? [...sprints].sort(byStartDescending).map((sprint) => new SprintItem(sprint))
        : [new None("Sprints not found")]
    }

    if (element instanceof SprintItem) {
      return groupBy === "None" ? this.getIssues(undefined, element.sprint) : this.getGroups(groupBy, element.sprint)
    }

    if (element instanceof GroupingItem) {
      return this.getIssues({ field: element.field, value: element.value }, element.sprint)
    }

    return []
  }

  private getGroups(groupBy: string, sprint?: Sprint): IssueNode[] {
    const values = groupBy === STATE ? this.boardColumnValues() : this.bundleValues(groupBy)
    if (!values) {
      return [new None(`No ${groupBy.toLowerCase()} values found`)]
    }
    const field = groupBy === STATE ? this.boardColumnField() : groupBy
    return values.map((value) => new GroupingItem(field, value, sprint))
  }

  private boardColumnField(): string {
    return this.context.columnSettings?.field?.name ?? STATE
  }

  private boardColumnValues(): string[] | undefined {
    const columns = this.context.columnSettings?.columns
    return columns?.flatMap((column) => column.fieldValues).map((value) => value.name ?? value.id)
  }

  private bundleValues(groupBy: string): string[] | undefined {
    const bundleName = BUNDLE_BY_FIELD[groupBy]
    const bundle = this.context.enumBundles?.find((candidate) => candidate.name === bundleName)
    return bundle?.values.map((value) => value.name ?? value.id)
  }

  private async getIssues(group?: IssueGroup, sprint?: Sprint): Promise<IssueNode[]> {
    const { project } = this.context
    if (!this.client || !project) {
      return [new None("Select a project to view issues")]
    }

    const query = buildIssueQuery({
      project: project.name ?? project.id,
      group,
      sprint: sprint?.name,
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

  boardStates(): string[] {
    return this.boardColumnValues() ?? []
  }

  bundleValuesFor(bundleName: string): string[] {
    const bundle = this.context.enumBundles?.find((candidate) => candidate.name === bundleName)
    return bundle?.values.map((value) => value.name ?? value.id) ?? []
  }
}
