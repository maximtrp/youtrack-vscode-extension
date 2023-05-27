import * as vscode from "vscode";
import { ServersProvider, ServerItem } from "./servers";
import { AgilesProjectsProvider, AgileItem, ProjectItem, None as AgileNone } from "./agiles";
import { SprintsIssuesProvider } from "./sprints";
import { RecentIssuesProvider } from "./recent";
import { IssueItem } from "./sprints.items";
import { YoutrackClient } from "./client";

export function activate(context: vscode.ExtensionContext) {
  let youtrackClient: YoutrackClient | undefined;

  const serversProvider = new ServersProvider(context);
  vscode.window.registerTreeDataProvider("youtrack-servers", serversProvider);

  const agileProjectsProvider = new AgilesProjectsProvider();
  vscode.window.registerTreeDataProvider("youtrack-agiles", agileProjectsProvider);

  const sprintIssuesProvider = new SprintsIssuesProvider(context);
  vscode.window.registerTreeDataProvider("youtrack-sprints", sprintIssuesProvider);

  const recentIssuesProvider = new RecentIssuesProvider();
  vscode.window.registerTreeDataProvider("youtrack-recent-issues", recentIssuesProvider);

  const serversTree = vscode.window.createTreeView<ServerItem>("youtrack-servers", {
    treeDataProvider: serversProvider,
  });

  const agileProjectsTree = vscode.window.createTreeView("youtrack-agiles", {
    treeDataProvider: agileProjectsProvider,
  });

  serversTree.onDidChangeSelection(async (serversView: vscode.TreeViewSelectionChangeEvent<ServerItem>) => {
    if (serversView.selection.length > 0) {
      let baseUrl: string = serversView.selection[0].url;
      let token: string = serversView.selection[0].token;
      youtrackClient = new YoutrackClient(baseUrl, token);
      agileProjectsProvider.refresh(youtrackClient);
    }
  });

  agileProjectsTree.onDidChangeSelection(
    async (elements: vscode.TreeViewSelectionChangeEvent<AgileItem | ProjectItem | AgileNone>) => {
      if (youtrackClient && elements.selection.length > 0) {
        let selectedItem = elements.selection[0];

        if (selectedItem.contextValue === "agile") {
          const selectedAgile = selectedItem as AgileItem;
          sprintIssuesProvider.setEnumBundles(youtrackClient.enumBundles);
          sprintIssuesProvider.setAgile(selectedAgile.agile);
          sprintIssuesProvider.setProject((selectedAgile.projects || [])[0]);
          sprintIssuesProvider.setSprints(selectedAgile.sprints);
          sprintIssuesProvider.setColumnSettings(selectedAgile.columnSettings);
          recentIssuesProvider.setProject((selectedAgile.projects || [])[0]);
        } else if (selectedItem.contextValue?.startsWith("project")) {
          let selectedProject = selectedItem as ProjectItem;
          sprintIssuesProvider.setAgile(selectedProject.parent.agile);
          sprintIssuesProvider.setProject(selectedProject.project);
          sprintIssuesProvider.setSprints(selectedProject.parent.agile.sprints);
          sprintIssuesProvider.setColumnSettings(selectedProject.parent.agile.columnSettings);
          recentIssuesProvider.setProject(selectedProject.project);
        }
      }
      sprintIssuesProvider.refresh(youtrackClient);
      recentIssuesProvider.refresh(youtrackClient);
    }
  );

  let commandGroupIssuesByState = vscode.commands.registerCommand("youtrack.groupIssuesByState", async () => {
    await setConfiguration("youtrack.groupIssuesBy", "State");
    sprintIssuesProvider.refresh(youtrackClient);
  });
  let commandGroupIssuesByPriority = vscode.commands.registerCommand("youtrack.groupIssuesByPriority", async () => {
    await setConfiguration("youtrack.groupIssuesBy", "Priority");
    sprintIssuesProvider.refresh(youtrackClient);
  });
  let commandGroupIssuesByType = vscode.commands.registerCommand("youtrack.groupIssuesByType", async () => {
    await setConfiguration("youtrack.groupIssuesBy", "Type");
    sprintIssuesProvider.refresh(youtrackClient);
  });
  let commandGroupIssuesByNone = vscode.commands.registerCommand("youtrack.groupIssuesByNone", async () => {
    await setConfiguration("youtrack.groupIssuesBy", "None");
    sprintIssuesProvider.refresh(youtrackClient);
  });

  let commandSortIssuesByDefault = vscode.commands.registerCommand("youtrack.sortIssuesByDefault", async () => {
    await setConfiguration("youtrack.sortIssuesBy", "Default");
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandSortIssuesByPriority = vscode.commands.registerCommand("youtrack.sortIssuesByPriority", async () => {
    await setConfiguration("youtrack.sortIssuesBy", "Priority");
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandSortIssuesByState = vscode.commands.registerCommand("youtrack.sortIssuesByState", async () => {
    await setConfiguration("youtrack.sortIssuesBy", "State");
    recentIssuesProvider.refresh(youtrackClient);
    sprintIssuesProvider.refresh(youtrackClient);
  });
  let commandSortIssuesByType = vscode.commands.registerCommand("youtrack.sortIssuesByType", async () => {
    await setConfiguration("youtrack.sortIssuesBy", "Type");
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandSortIssuesByVotes = vscode.commands.registerCommand("youtrack.sortIssuesByVotes", async () => {
    await setConfiguration("youtrack.sortIssuesBy", "Votes");
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandSortIssuesByCreated = vscode.commands.registerCommand("youtrack.sortIssuesByCreated", async () => {
    await setConfiguration("youtrack.sortIssuesBy", "Created");
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandSortIssuesByUpdated = vscode.commands.registerCommand("youtrack.sortIssuesByUpdated", async () => {
    await setConfiguration("youtrack.sortIssuesBy", "Updated");
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandSortIssuesByResolvedDate = vscode.commands.registerCommand(
    "youtrack.sortIssuesByResolvedDate",
    async () => {
      await setConfiguration("youtrack.sortIssuesBy", "Resolved Date");
      sprintIssuesProvider.refresh(youtrackClient);
      recentIssuesProvider.refresh(youtrackClient);
    }
  );

  let commandShowIssuesAssignedToMe = vscode.commands.registerCommand("youtrack.showIssuesAssignedToMe", async () => {
    await setConfiguration("youtrack.showIssuesAssignedTo", "Me");
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandShowIssuesAssignedToAnyone = vscode.commands.registerCommand(
    "youtrack.showIssuesAssignedToAnyone",
    async () => {
      await setConfiguration("youtrack.showIssuesAssignedTo", "Anyone");
      sprintIssuesProvider.refresh(youtrackClient);
      recentIssuesProvider.refresh(youtrackClient);
    }
  );
  let commandShowUnassignedIssues = vscode.commands.registerCommand("youtrack.showUnassignedIssues", async () => {
    await setConfiguration("youtrack.showIssuesAssignedTo", "Unassigned");
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandUpdateIssuePriority = vscode.commands.registerCommand(
    "youtrack.updateIssuePriority",
    async (item: IssueItem) => {
      await sprintIssuesProvider.updateIssueEnumBundle(item.issue, "Priority", "Priorities");
      sprintIssuesProvider.refresh(youtrackClient);
      recentIssuesProvider.refresh(youtrackClient);
    }
  );
  let commandUpdateIssueType = vscode.commands.registerCommand("youtrack.updateIssueType", async (item: IssueItem) => {
    await sprintIssuesProvider.updateIssueEnumBundle(item.issue, "Type", "Types");
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandUpdateIssueState = vscode.commands.registerCommand(
    "youtrack.updateIssueState",
    async (item: IssueItem) => {
      await sprintIssuesProvider.updateIssueState(item.issue);
      sprintIssuesProvider.refresh(youtrackClient);
      recentIssuesProvider.refresh(youtrackClient);
    }
  );

  let commandAddServer = vscode.commands.registerCommand("youtrack.addServer", () => serversProvider.addServer());
  let commandEditServer = vscode.commands.registerCommand("youtrack.editServer", (server) =>
    serversProvider.editServer(server)
  );
  let commandDeleteServer = vscode.commands.registerCommand("youtrack.deleteServer", (server) => {
    vscode.window
      .showInformationMessage("Are you sure you want to delete this server?", "Yes", "No")
      .then(async (answer) => {
        if (answer === "Yes") {
          await serversProvider.deleteServer(server);

          if (
            serversProvider.servers.length === 0 ||
            (serversTree.selection.length > 0 && server.label === serversTree.selection[0].label)
          ) {
            youtrackClient = undefined;
            sprintIssuesProvider.refresh(youtrackClient);
            recentIssuesProvider.refresh(youtrackClient);
            agileProjectsProvider.refresh(youtrackClient);
            // vscode.commands.executeCommand("setContext", "hasServerSelected", false);
            // vscode.commands.executeCommand("setContext", "hasRepoSelected", false);
          }
        }
      });
  });

  let commandRefreshAgiles = vscode.commands.registerCommand("youtrack.refreshAgiles", () =>
    agileProjectsProvider.refresh(youtrackClient)
  );
  let commandRefreshSprints = vscode.commands.registerCommand("youtrack.refreshSprints", () =>
    sprintIssuesProvider.refresh(youtrackClient)
  );
  let commandRefreshRecentIssues = vscode.commands.registerCommand("youtrack.refreshRecentIssues", () =>
    recentIssuesProvider.refresh(youtrackClient)
  );
  let commandCreateBranch = vscode.commands.registerCommand("youtrack.createBranch", (issue) =>
    sprintIssuesProvider.createBranch(issue)
  );
  let commandAddIssue = vscode.commands.registerCommand("youtrack.addIssue", async () => {
    await sprintIssuesProvider.addIssue();
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandUpdateIssueSummary = vscode.commands.registerCommand("youtrack.updateIssueSummary", async (issue) => {
    await sprintIssuesProvider.updateIssueSummary(issue);
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandUpdateIssueAssignee = vscode.commands.registerCommand("youtrack.updateIssueAssignee", async (issue) => {
    await sprintIssuesProvider.updateIssueAssignee(issue);
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandGotoIssuePage = vscode.commands.registerCommand("youtrack.gotoIssuePage", (issue) =>
    sprintIssuesProvider.gotoIssuePage(issue)
  );
  let commandDeleteIssue = vscode.commands.registerCommand("youtrack.deleteIssue", async (issue) => {
    await sprintIssuesProvider.deleteIssue(issue);
    sprintIssuesProvider.refresh(youtrackClient);
    recentIssuesProvider.refresh(youtrackClient);
  });
  let commandShowIssueDescription = vscode.commands.registerCommand(
    "youtrack.showIssueDescription",
    (description: string) => {
      const panel = vscode.window.createWebviewPanel(
        "issueDescription",
        "Issue Description",
        vscode.ViewColumn.One,
        {}
      );
      panel.webview.html = description;
    }
  );

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
  );
}

export function deactivate() {}

async function setConfiguration(field: string, value: string) {
  await vscode.workspace.getConfiguration().update(field, value, vscode.ConfigurationTarget.Global);
}
