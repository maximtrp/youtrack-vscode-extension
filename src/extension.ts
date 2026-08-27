import * as vscode from "vscode"
import { YoutrackClient } from "./api/youtrackClient"
import { settings } from "./config/settings"
import { CaCertificateError } from "./api/httpAgent.node"
import { toUserMessage } from "./domain/errors"
import { PRIORITY, TYPE } from "./domain/issueFields"
import { AgilesProjectsProvider } from "./views/agilesView"
import { IssueCommands } from "./views/issueCommands"
import { IssueDescriptionPanel } from "./views/issueDescription"
import { SprintsIssuesProvider } from "./views/issuesView"
import { AgileItem, IssueItem, ProjectItem, ServerItem } from "./views/items"
import { RecentIssuesProvider } from "./views/recentView"
import { ServersProvider } from "./views/serversView"

export function activate(context: vscode.ExtensionContext) {
  let client: YoutrackClient | undefined

  const serversProvider = new ServersProvider(context.secrets)
  const agilesProvider = new AgilesProjectsProvider()
  const issuesProvider = new SprintsIssuesProvider()
  const recentProvider = new RecentIssuesProvider()
  const descriptionPanel = new IssueDescriptionPanel()

  const serversTree = vscode.window.createTreeView("youtrack-servers", { treeDataProvider: serversProvider })
  const agilesTree = vscode.window.createTreeView("youtrack-agiles", { treeDataProvider: agilesProvider })
  const issuesTree = vscode.window.createTreeView("youtrack-sprints", { treeDataProvider: issuesProvider })
  const recentTree = vscode.window.createTreeView("youtrack-recent-issues", { treeDataProvider: recentProvider })

  const refreshIssueViews = () => {
    issuesProvider.refresh(client)
    recentProvider.refresh(client)
  }

  const refreshAll = () => {
    agilesProvider.refresh(client)
    refreshIssueViews()
  }

  const connect = async (server: ServerItem) => {
    try {
      client = await YoutrackClient.create({
        url: server.url,
        token: server.server.token,
        validateCertificate: settings.validateCertificate(),
        caCertPath: server.server.caCertPath,
      })
    } catch (error) {
      client = undefined
      const message =
        error instanceof CaCertificateError
          ? error.message
          : `Could not connect to ${server.url}. ${toUserMessage(error)}`
      vscode.window.showErrorMessage(message)
    }

    issuesProvider.reset()
    recentProvider.reset()
    refreshAll()

    if (!client) {
      return
    }

    if (client.enumBundlesError) {
      vscode.window.showWarningMessage(
        `Connected, but issue priorities and types could not be read. ${toUserMessage(client.enumBundlesError)}`
      )
    }

    const agiles = await agilesProvider.getChildren()
    const [first] = agiles
    if (first instanceof AgileItem) {
      agilesTree.reveal(first, { select: true, focus: true })
    }
  }

  const issueCommands = new IssueCommands({
    client: () => client,
    context: () => issuesProvider.selection,
    boardStates: () => issuesProvider.boardStates(),
    bundleValues: (bundleName) => issuesProvider.bundleValuesFor(bundleName),
  })

  serversTree.onDidChangeSelection(async ({ selection }) => {
    const [server] = selection
    if (server) {
      await connect(server)
    }
  })

  agilesTree.onDidChangeSelection(({ selection }) => {
    const [item] = selection

    if (item instanceof AgileItem) {
      const project = item.projects[0]
      issuesProvider.setContext({
        agile: item.agile,
        project,
        sprints: item.agile.sprints,
        columnSettings: item.agile.columnSettings,
        enumBundles: client?.enumBundles,
      })
      recentProvider.setProject(project)
    } else if (item instanceof ProjectItem) {
      const { agile } = item.parent
      issuesProvider.setContext({
        agile,
        project: item.project,
        sprints: agile.sprints,
        columnSettings: agile.columnSettings,
        enumBundles: client?.enumBundles,
      })
      recentProvider.setProject(item.project)
    } else {
      return
    }

    refreshIssueViews()
  })

  vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (!event.affectsConfiguration("youtrack.validateCertificate")) {
      return
    }
    const [server] = serversTree.selection
    if (server) {
      await connect(server)
    }
  })

  const settingCommands: [string, () => Promise<void>][] = [
    ["youtrack.groupIssuesByNone", () => settings.update("groupIssuesBy", "None")],
    ["youtrack.groupIssuesByState", () => settings.update("groupIssuesBy", "State")],
    ["youtrack.groupIssuesByPriority", () => settings.update("groupIssuesBy", "Priority")],
    ["youtrack.groupIssuesByType", () => settings.update("groupIssuesBy", "Type")],
    ["youtrack.sortIssuesByDefault", () => settings.update("sortIssuesBy", "Default")],
    ["youtrack.sortIssuesByPriority", () => settings.update("sortIssuesBy", "Priority")],
    ["youtrack.sortIssuesByState", () => settings.update("sortIssuesBy", "State")],
    ["youtrack.sortIssuesByType", () => settings.update("sortIssuesBy", "Type")],
    ["youtrack.sortIssuesByVotes", () => settings.update("sortIssuesBy", "Votes")],
    ["youtrack.sortIssuesByCreated", () => settings.update("sortIssuesBy", "Created")],
    ["youtrack.sortIssuesByUpdated", () => settings.update("sortIssuesBy", "Updated")],
    ["youtrack.sortIssuesByResolvedDate", () => settings.update("sortIssuesBy", "Resolved Date")],
    ["youtrack.showIssuesAssignedToMe", () => settings.update("showIssuesAssignedTo", "Me")],
    ["youtrack.showIssuesAssignedToAnyone", () => settings.update("showIssuesAssignedTo", "Anyone")],
    ["youtrack.showUnassignedIssues", () => settings.update("showIssuesAssignedTo", "Unassigned")],
  ]

  const toggleResolved = async () => {
    await settings.update("showResolvedIssues", !settings.showResolved())
    refreshIssueViews()
  }

  const withRefresh =
    <T extends unknown[]>(action: (...args: T) => Promise<void> | void) =>
    async (...args: T) => {
      await action(...args)
      refreshIssueViews()
    }

  context.subscriptions.push(
    serversTree,
    agilesTree,
    issuesTree,
    recentTree,

    ...settingCommands.map(([id, apply]) => vscode.commands.registerCommand(id, withRefresh(apply))),

    vscode.commands.registerCommand("youtrack.toggleResolvedIssues", toggleResolved),
    vscode.commands.registerCommand("youtrack.toggleResolvedIssuesUnchecked", toggleResolved),

    vscode.commands.registerCommand("youtrack.addServer", () => serversProvider.addServer()),
    vscode.commands.registerCommand("youtrack.editServer", async (item: ServerItem) => {
      const updated = await serversProvider.editServer(item)
      const [selected] = serversTree.selection
      if (updated && selected?.url === item.url) {
        await connect(new ServerItem(updated))
      }
    }),
    vscode.commands.registerCommand("youtrack.deleteServer", async (item: ServerItem) => {
      const answer = await vscode.window.showWarningMessage(`Delete ${item.label}?`, { modal: true }, "Delete")
      if (answer !== "Delete") {
        return
      }
      const [selected] = serversTree.selection
      await serversProvider.deleteServer(item)
      if (selected?.url === item.url) {
        client = undefined
        issuesProvider.reset()
        recentProvider.reset()
        refreshAll()
      }
    }),

    vscode.commands.registerCommand("youtrack.refreshAgiles", () => agilesProvider.refresh(client)),
    vscode.commands.registerCommand("youtrack.refreshSprints", () => issuesProvider.refresh(client)),
    vscode.commands.registerCommand("youtrack.refreshRecentIssues", () => recentProvider.refresh(client)),

    vscode.commands.registerCommand(
      "youtrack.addIssue",
      withRefresh(() => issueCommands.addIssue())
    ),
    vscode.commands.registerCommand(
      "youtrack.updateIssueSummary",
      withRefresh((item: IssueItem) => issueCommands.updateSummary(item))
    ),
    vscode.commands.registerCommand(
      "youtrack.updateIssueAssignee",
      withRefresh((item: IssueItem) => issueCommands.updateAssignee(item))
    ),
    vscode.commands.registerCommand(
      "youtrack.updateIssueState",
      withRefresh((item: IssueItem) => issueCommands.updateState(item))
    ),
    vscode.commands.registerCommand(
      "youtrack.updateIssuePriority",
      withRefresh((item: IssueItem) => issueCommands.updateEnumField(item, PRIORITY, "Priorities"))
    ),
    vscode.commands.registerCommand(
      "youtrack.updateIssueType",
      withRefresh((item: IssueItem) => issueCommands.updateEnumField(item, TYPE, "Types"))
    ),
    vscode.commands.registerCommand(
      "youtrack.deleteIssue",
      withRefresh((item: IssueItem) => issueCommands.deleteIssue(item))
    ),
    vscode.commands.registerCommand("youtrack.gotoIssuePage", (item: IssueItem) => issueCommands.gotoIssuePage(item)),
    vscode.commands.registerCommand("youtrack.createBranch", (item: IssueItem) => issueCommands.createBranch(item)),
    vscode.commands.registerCommand("youtrack.showIssueDescription", (item: IssueItem) =>
      descriptionPanel.show(item, client)
    ),

    { dispose: () => descriptionPanel.dispose() }
  )
}

export function deactivate() {}
