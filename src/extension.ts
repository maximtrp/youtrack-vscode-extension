import * as vscode from "vscode"
import { ServersProvider, ServerItem } from "./servers"
import {
  AgilesProjectsProvider,
  AgileItem,
  ProjectItem,
  None as AgileNone,
} from "./agiles"
import { SprintsIssuesProvider } from "./sprints"
import { RecentIssuesProvider } from "./recent"
import { IssueItem } from "./sprints.items"
import { YoutrackClient } from "./client"

export function activate(context: vscode.ExtensionContext) {
  let youtrackClient: YoutrackClient | undefined

  const serversProvider = new ServersProvider(context)
  vscode.window.registerTreeDataProvider("youtrack-servers", serversProvider)

  const agileProjectsProvider = new AgilesProjectsProvider()
  vscode.window.registerTreeDataProvider(
    "youtrack-agiles",
    agileProjectsProvider
  )

  const sprintIssuesProvider = new SprintsIssuesProvider()
  vscode.window.registerTreeDataProvider(
    "youtrack-sprints",
    sprintIssuesProvider
  )

  const recentIssuesProvider = new RecentIssuesProvider()
  vscode.window.registerTreeDataProvider(
    "youtrack-recent-issues",
    recentIssuesProvider
  )

  const serversTree = vscode.window.createTreeView<ServerItem>(
    "youtrack-servers",
    {
      treeDataProvider: serversProvider,
    }
  )

  const agileProjectsTree = vscode.window.createTreeView("youtrack-agiles", {
    treeDataProvider: agileProjectsProvider,
  })

  vscode.workspace.onDidChangeConfiguration(async (event) => {
    if (
      !event.affectsConfiguration("youtrack.validateCertificate") ||
      serversTree.selection.length == 0
    )
      return

    const serverSelected = serversTree.selection[0]
    serversTree.reveal(serverSelected, { select: true, focus: true })
  })

  serversTree.onDidChangeSelection(
    async (serversView: vscode.TreeViewSelectionChangeEvent<ServerItem>) => {
      if (serversView.selection.length > 0) {
        const baseUrl: string = serversView.selection[0].url
        const token: string = serversView.selection[0].token
        const isCertificateValidated =
          !!vscode.workspace
            .getConfiguration("youtrack")
            .get<boolean>("validateCertificate");

        youtrackClient = new YoutrackClient(
          baseUrl,
          token,
          isCertificateValidated
        )
        agileProjectsProvider.refresh(youtrackClient)
        sprintIssuesProvider.reset().refresh(youtrackClient)
        recentIssuesProvider.reset().refresh(youtrackClient)

        const agiles = await agileProjectsProvider.getChildren()
        if (agiles[0] instanceof AgileItem) {
          agileProjectsTree.reveal(agiles[0], {
            select: true,
            focus: true,
          })
        }
      }
    }
  )

  agileProjectsTree.onDidChangeSelection(
    async (
      elements: vscode.TreeViewSelectionChangeEvent<
        AgileItem | ProjectItem | AgileNone
      >
    ) => {
      if (youtrackClient && elements.selection.length > 0) {
        const selectedItem = elements.selection[0]

        if (selectedItem.contextValue === "agile") {
          const selectedAgile = selectedItem as AgileItem
          sprintIssuesProvider.setEnumBundles(youtrackClient.enumBundles)
          sprintIssuesProvider.setAgile(selectedAgile.agile)
          sprintIssuesProvider.setProject((selectedAgile.projects || [])[0])
          sprintIssuesProvider.setSprints(selectedAgile.sprints)
          sprintIssuesProvider.setColumnSettings(selectedAgile.columnSettings)
          recentIssuesProvider.setProject((selectedAgile.projects || [])[0])
        } else if (selectedItem.contextValue?.startsWith("project")) {
          const selectedProject = selectedItem as ProjectItem
          sprintIssuesProvider.setAgile(selectedProject.parent.agile)
          sprintIssuesProvider.setProject(selectedProject.project)
          sprintIssuesProvider.setSprints(selectedProject.parent.agile.sprints)
          sprintIssuesProvider.setColumnSettings(
            selectedProject.parent.agile.columnSettings
          )
          recentIssuesProvider.setProject(selectedProject.project)
        }
      }
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )

  const commandGroupIssuesByState = vscode.commands.registerCommand(
    "youtrack.groupIssuesByState",
    async () => {
      await setConfiguration("youtrack.groupIssuesBy", "State")
      sprintIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandGroupIssuesByPriority = vscode.commands.registerCommand(
    "youtrack.groupIssuesByPriority",
    async () => {
      await setConfiguration("youtrack.groupIssuesBy", "Priority")
      sprintIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandGroupIssuesByType = vscode.commands.registerCommand(
    "youtrack.groupIssuesByType",
    async () => {
      await setConfiguration("youtrack.groupIssuesBy", "Type")
      sprintIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandGroupIssuesByNone = vscode.commands.registerCommand(
    "youtrack.groupIssuesByNone",
    async () => {
      await setConfiguration("youtrack.groupIssuesBy", "None")
      sprintIssuesProvider.refresh(youtrackClient)
    }
  )

  const commandSortIssuesByDefault = vscode.commands.registerCommand(
    "youtrack.sortIssuesByDefault",
    async () => {
      await setConfiguration("youtrack.sortIssuesBy", "Default")
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandSortIssuesByPriority = vscode.commands.registerCommand(
    "youtrack.sortIssuesByPriority",
    async () => {
      await setConfiguration("youtrack.sortIssuesBy", "Priority")
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandSortIssuesByState = vscode.commands.registerCommand(
    "youtrack.sortIssuesByState",
    async () => {
      await setConfiguration("youtrack.sortIssuesBy", "State")
      recentIssuesProvider.refresh(youtrackClient)
      sprintIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandSortIssuesByType = vscode.commands.registerCommand(
    "youtrack.sortIssuesByType",
    async () => {
      await setConfiguration("youtrack.sortIssuesBy", "Type")
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandSortIssuesByVotes = vscode.commands.registerCommand(
    "youtrack.sortIssuesByVotes",
    async () => {
      await setConfiguration("youtrack.sortIssuesBy", "Votes")
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandSortIssuesByCreated = vscode.commands.registerCommand(
    "youtrack.sortIssuesByCreated",
    async () => {
      await setConfiguration("youtrack.sortIssuesBy", "Created")
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandSortIssuesByUpdated = vscode.commands.registerCommand(
    "youtrack.sortIssuesByUpdated",
    async () => {
      await setConfiguration("youtrack.sortIssuesBy", "Updated")
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandSortIssuesByResolvedDate = vscode.commands.registerCommand(
    "youtrack.sortIssuesByResolvedDate",
    async () => {
      await setConfiguration("youtrack.sortIssuesBy", "Resolved Date")
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )

  const commandShowIssuesAssignedToMe = vscode.commands.registerCommand(
    "youtrack.showIssuesAssignedToMe",
    async () => {
      await setConfiguration("youtrack.showIssuesAssignedTo", "Me")
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandShowIssuesAssignedToAnyone = vscode.commands.registerCommand(
    "youtrack.showIssuesAssignedToAnyone",
    async () => {
      await setConfiguration("youtrack.showIssuesAssignedTo", "Anyone")
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandShowUnassignedIssues = vscode.commands.registerCommand(
    "youtrack.showUnassignedIssues",
    async () => {
      await setConfiguration("youtrack.showIssuesAssignedTo", "Unassigned")
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandUpdateIssuePriority = vscode.commands.registerCommand(
    "youtrack.updateIssuePriority",
    async (item: IssueItem) => {
      await sprintIssuesProvider.updateIssueEnumBundle(
        item.issue,
        "Priority",
        "Priorities"
      )
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandUpdateIssueType = vscode.commands.registerCommand(
    "youtrack.updateIssueType",
    async (item: IssueItem) => {
      await sprintIssuesProvider.updateIssueEnumBundle(
        item.issue,
        "Type",
        "Types"
      )
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandUpdateIssueState = vscode.commands.registerCommand(
    "youtrack.updateIssueState",
    async (item: IssueItem) => {
      await sprintIssuesProvider.updateIssueState(item.issue)
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )

  const commandAddServer = vscode.commands.registerCommand(
    "youtrack.addServer",
    () => serversProvider.addServer()
  )
  const commandEditServer = vscode.commands.registerCommand(
    "youtrack.editServer",
    async (server) => {
      const serverSelected = serversTree.selection[0]
      const serverNew = await serversProvider.editServer(server)

      if (serverNew && serverSelected.url === server.url) {
        const isCertificateValidated =
          vscode.workspace
            .getConfiguration("youtrack")
            .get<boolean>("validateCertificate") || true
        youtrackClient = new YoutrackClient(
          serverNew.url,
          serverNew.token,
          isCertificateValidated
        )
        agileProjectsProvider.refresh(youtrackClient)
        sprintIssuesProvider.reset().refresh(youtrackClient)
        recentIssuesProvider.reset().refresh(youtrackClient)
      }
    }
  )

  const commandDeleteServer = vscode.commands.registerCommand(
    "youtrack.deleteServer",
    (server) => {
      vscode.window
        .showInformationMessage(
          "Are you sure you want to delete this server?",
          "Yes",
          "No"
        )
        .then(async (answer) => {
          if (answer === "Yes") {
            await serversProvider.deleteServer(server)

            if (
              serversProvider.servers.length === 0 ||
              (serversTree.selection.length > 0 &&
                server.label === serversTree.selection[0].label)
            ) {
              youtrackClient = undefined
              sprintIssuesProvider.reset().refresh(youtrackClient)
              recentIssuesProvider.reset().refresh(youtrackClient)
              agileProjectsProvider.refresh(youtrackClient)
              // vscode.commands.executeCommand("setContext", "hasServerSelected", false);
              // vscode.commands.executeCommand("setContext", "hasRepoSelected", false);
            }
          }
        })
    }
  )

  const commandRefreshAgiles = vscode.commands.registerCommand(
    "youtrack.refreshAgiles",
    () => agileProjectsProvider.refresh(youtrackClient)
  )
  const commandRefreshSprints = vscode.commands.registerCommand(
    "youtrack.refreshSprints",
    () => sprintIssuesProvider.refresh(youtrackClient)
  )
  const commandRefreshRecentIssues = vscode.commands.registerCommand(
    "youtrack.refreshRecentIssues",
    () => recentIssuesProvider.refresh(youtrackClient)
  )
  const commandCreateBranch = vscode.commands.registerCommand(
    "youtrack.createBranch",
    (issue) => sprintIssuesProvider.createBranch(issue)
  )
  const commandAddIssue = vscode.commands.registerCommand(
    "youtrack.addIssue",
    async () => {
      await sprintIssuesProvider.addIssue()
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandUpdateIssueSummary = vscode.commands.registerCommand(
    "youtrack.updateIssueSummary",
    async (issue) => {
      await sprintIssuesProvider.updateIssueSummary(issue)
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandUpdateIssueAssignee = vscode.commands.registerCommand(
    "youtrack.updateIssueAssignee",
    async (issue) => {
      await sprintIssuesProvider.updateIssueAssignee(issue)
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandGotoIssuePage = vscode.commands.registerCommand(
    "youtrack.gotoIssuePage",
    (issue) => sprintIssuesProvider.gotoIssuePage(issue)
  )
  const commandDeleteIssue = vscode.commands.registerCommand(
    "youtrack.deleteIssue",
    async (issue) => {
      await sprintIssuesProvider.deleteIssue(issue)
      sprintIssuesProvider.refresh(youtrackClient)
      recentIssuesProvider.refresh(youtrackClient)
    }
  )
  const commandShowIssueDescription = vscode.commands.registerCommand(
    "youtrack.showIssueDescription",
    (description: string) => {
      const panel = vscode.window.createWebviewPanel(
        "issueDescription",
        "Issue Description",
        vscode.ViewColumn.One,
        {}
      )
      panel.webview.html = description
    }
  )

  context.subscriptions.push(
    ...[
      serversTree,
      agileProjectsTree,
      commandAddServer,
      commandEditServer,
      commandGroupIssuesByState,
      commandGroupIssuesByPriority,
      commandGroupIssuesByType,
      commandGroupIssuesByNone,
      commandSortIssuesByDefault,
      commandSortIssuesByPriority,
      commandSortIssuesByState,
      commandSortIssuesByType,
      commandSortIssuesByVotes,
      commandSortIssuesByCreated,
      commandSortIssuesByUpdated,
      commandSortIssuesByResolvedDate,
      commandShowIssuesAssignedToMe,
      commandShowIssuesAssignedToAnyone,
      commandShowUnassignedIssues,
      commandUpdateIssueAssignee,
      commandUpdateIssueSummary,
      commandUpdateIssuePriority,
      commandUpdateIssueType,
      commandUpdateIssueState,
      commandAddServer,
      commandEditServer,
      commandDeleteServer,
      commandRefreshAgiles,
      commandRefreshSprints,
      commandRefreshRecentIssues,
      commandCreateBranch,
      commandAddIssue,
      commandDeleteServer,
      commandGotoIssuePage,
      commandDeleteIssue,
      commandShowIssueDescription,
    ]
  )
}

export function deactivate() {}

async function setConfiguration(field: string, value: string) {
  await vscode.workspace
    .getConfiguration()
    .update(field, value, vscode.ConfigurationTarget.Global)
}
