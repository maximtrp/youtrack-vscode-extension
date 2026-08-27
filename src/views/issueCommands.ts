import * as vscode from "vscode"
import type { API as GitAPI } from "../api/git"
import type { NewIssue } from "../api/types"
import { YoutrackClient } from "../api/youtrackClient"
import { settings } from "../config/settings"
import { buildBranchName } from "../domain/branchName"
import { toUserMessage } from "../domain/errors"
import { STATE } from "../domain/issueFields"
import type { IssueItem } from "./items"
import type { SelectionContext } from "./issuesView"

export interface IssueCommandsDeps {
  client(): YoutrackClient | undefined
  context(): SelectionContext
  boardStates(): string[]
  bundleValues(bundleName: string): string[]
}

export class IssueCommands {
  constructor(private readonly deps: IssueCommandsDeps) {}

  async addIssue(): Promise<void> {
    const client = this.deps.client()
    const { project, agile, sprints } = this.deps.context()
    if (!client || !project) {
      vscode.window.showInformationMessage("Please select a project to add an issue")
      return
    }

    const summary = await vscode.window.showInputBox({ ignoreFocusOut: true, title: "Issue summary" })
    if (!summary) {
      vscode.window.showInformationMessage("Issue was not created due to the empty summary")
      return
    }

    const description = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      title: "Issue description (optional)",
    })

    const issue: NewIssue = { summary, description, project: { id: project.id }, customFields: [] }

    const state = await pick(this.deps.boardStates(), "Issue state")
    if (state) {
      issue.customFields.push({
        name: STATE,
        $type: "StateIssueCustomField",
        value: { name: state, $type: "StateBundleElement" },
      })
    }

    let created
    try {
      created = await client.addIssue(issue)
    } catch (error) {
      vscode.window.showErrorMessage(`Issue was not created. ${toUserMessage(error)}`)
      return
    }

    if (!agile || !sprints?.length) {
      return
    }

    const sprintName = await pick(
      sprints.map((sprint) => sprint.name).filter((name): name is string => !!name),
      "Add to sprint (optional)"
    )
    const sprint = sprints.find((candidate) => candidate.name === sprintName)
    if (!sprint) {
      return
    }

    try {
      await client.addIssueToSprint(agile.id, sprint.id, created.id)
    } catch (error) {
      vscode.window.showErrorMessage(`Issue was not added to ${sprint.name}. ${toUserMessage(error)}`)
    }
  }

  async updateSummary(item: IssueItem): Promise<void> {
    const client = this.deps.client()
    if (!client) {
      return
    }
    const summary = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      title: "Enter issue summary",
      value: item.issue.summary,
    })
    if (!summary) {
      vscode.window.showInformationMessage("Issue summary was not updated")
      return
    }
    await this.run(() => client.updateIssueSummary(item.issue.id, summary), "Issue summary was not updated")
  }

  async updateAssignee(item: IssueItem): Promise<void> {
    const client = this.deps.client()
    if (!client) {
      return
    }

    let users
    try {
      users = (await client.getUsers()).filter((user) => !user.banned)
    } catch (error) {
      vscode.window.showErrorMessage(`Could not retrieve users. ${toUserMessage(error)}`)
      return
    }

    if (users.length === 0) {
      vscode.window.showInformationMessage("No users found to assign this issue to")
      return
    }

    const selected = await pick(
      users.map((user) => `${user.login} (${user.fullName})`),
      "Select a user to assign this issue to"
    )
    const user = users.find((candidate) => candidate.login === selected?.split(" ")[0])
    if (!user) {
      vscode.window.showInformationMessage("Issue assignee was not set")
      return
    }

    await this.run(() => client.updateIssueAssignee(item.issue.id, user.id), "Issue assignee was not updated")
  }

  async updateState(item: IssueItem): Promise<void> {
    const client = this.deps.client()
    const state = await pick(this.deps.boardStates(), "Select an issue state")
    if (!client || !state) {
      return
    }
    await this.run(() => client.updateIssueState(item.issue.id, state), "Issue state was not updated")
  }

  async updateEnumField(item: IssueItem, field: string, bundleName: string): Promise<void> {
    const client = this.deps.client()
    const value = await pick(this.deps.bundleValues(bundleName), `Select an issue ${field.toLowerCase()}`)
    if (!client || !value) {
      return
    }
    await this.run(
      () => client.updateIssueSingleEnum(item.issue.id, field, value),
      `Issue ${field.toLowerCase()} was not updated`
    )
  }

  async deleteIssue(item: IssueItem): Promise<void> {
    const client = this.deps.client()
    if (!client) {
      return
    }
    const confirmed = await vscode.window.showWarningMessage(
      `Delete ${item.code}? This cannot be undone.`,
      { modal: true },
      "Delete"
    )
    if (confirmed !== "Delete") {
      return
    }
    await this.run(() => client.deleteIssue(item.issue.id), "Issue was not deleted")
  }

  gotoIssuePage(item: IssueItem): void {
    const client = this.deps.client()
    const { agile } = this.deps.context()
    if (!client) {
      return
    }
    const url = agile
      ? `${client.url}/agiles/${agile.id}/current?issue=${item.code}`
      : `${client.url}/issue/${item.code}`
    vscode.env.openExternal(vscode.Uri.parse(url))
  }

  async createBranch(item: IssueItem): Promise<void> {
    const repository = await gitRepository()
    if (!repository) {
      vscode.window.showInformationMessage("No git repositories found")
      return
    }

    const suggested = buildBranchName(settings.branchNameTemplate(), {
      code: item.code,
      summary: item.issue.summary ?? "",
    })

    const existing = repository.state.refs.some((ref) => ref.name === suggested)
    if (existing) {
      try {
        await repository.checkout(suggested)
      } catch (error) {
        vscode.window.showErrorMessage(`Could not check out ${suggested}. ${toUserMessage(error)}`)
      }
      return
    }

    const name = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: "Branch name",
      value: suggested,
      title: "Specify a branch name to create for this issue",
    })
    if (!name) {
      return
    }

    try {
      await repository.createBranch(name, true)
    } catch (error) {
      vscode.window.showErrorMessage(`Could not create ${name}. ${toUserMessage(error)}`)
    }
  }

  private async run(action: () => Promise<unknown>, failure: string): Promise<void> {
    try {
      await action()
    } catch (error) {
      vscode.window.showErrorMessage(`${failure}. ${toUserMessage(error)}`)
    }
  }
}

function pick(items: string[], title: string): Thenable<string | undefined> {
  if (items.length === 0) {
    return Promise.resolve(undefined)
  }
  return vscode.window.showQuickPick(items, { canPickMany: false, ignoreFocusOut: true, title })
}

async function gitRepository() {
  const extension = vscode.extensions.getExtension("vscode.git")
  if (!extension) {
    return undefined
  }
  const exports = extension.isActive ? extension.exports : await extension.activate()
  const api: GitAPI = exports.getAPI(1)
  return api.repositories[0]
}
