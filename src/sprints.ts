import * as vscode from "vscode";
import { API } from "./api/git";
import { YoutrackClient } from "./client";

let fmt = new Intl.DateTimeFormat("default", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export class SprintsIssuesProvider implements vscode.TreeDataProvider<IssueItem | SprintItem | GroupingItem | None> {
  client?: YoutrackClient;
  project?: Project;
  agile?: Agile;
  sprints?: Sprint[] | null;
  columnSettings?: ColumnSettings;
  enumBundles?: EnumBundle[];

  constructor(private context: vscode.ExtensionContext) {}

  private _onDidChangeTreeData: vscode.EventEmitter<IssueItem | undefined | null | void> = new vscode.EventEmitter<
    IssueItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<IssueItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(client?: YoutrackClient) {
    this.client = client;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem) {
    return element;
  }

  async getStates(element: SprintItem) {
    if (this.columnSettings) {
      return this.columnSettings.columns
        .flatMap((col) => col.fieldValues)
        .map((cfv) => new GroupingItem(cfv.name || cfv.id, element.sprint));
    } else {
      return [new None("No states found")];
    }
  }

  async getPriorities(element: SprintItem) {
    console.log(this.enumBundles);
    if (this.enumBundles) {
      const priorities = (this.enumBundles.find((bundle) => bundle.name === "Priorities") || {}).values;
      if (priorities) {
        return priorities.map((priority) => new GroupingItem(priority.name || priority.id, element.sprint));
      }
    }
    return [new None("No priorities found")];
  }

  async getTypes(element: SprintItem) {
    if (this.enumBundles) {
      const types = (this.enumBundles.find((bundle) => bundle.name === "Types") || {}).values;
      if (types) {
        return types.map((type) => new GroupingItem(type.name || type.id, element.sprint));
      }
    }
    return [new None("No types found")];
  }

  async getChildren(
    element?: SprintItem | GroupingItem | None
  ): Promise<IssueItem[] | SprintItem[] | GroupingItem[] | None[]> {
    if (this.client) {
      if (element) {
        // FILTER SETTINGS
        const groupby: string = vscode.workspace.getConfiguration("youtrack").get("groupIssuesBy") || "None";
        const sortOrder: string = (
          vscode.workspace.getConfiguration("youtrack").get<string>("sortOrder") || "desc"
        ).toLowerCase();
        const sortby: string = vscode.workspace.getConfiguration("youtrack").get("sortIssuesBy") || "Default";
        const assignedto: string =
          vscode.workspace.getConfiguration("youtrack").get("showIssuesAssignedTo") || "Anyone";

        // GROUPING LOGIC
        if (element.contextValue === "sprint" && groupby !== "None") {
          if (groupby === "State") {
            return this.getStates(element as SprintItem);
          } else if (groupby === "Priority") {
            return this.getPriorities(element as SprintItem);
          } else if (groupby === "Type") {
            return this.getTypes(element as SprintItem);
          } else {
            return this.getStates(element as SprintItem);
          }
        } else if ((element.contextValue !== "sprint" || groupby === "None") && this.project) {
          // ISSUES
          const sprintName = (element as GroupingItem).sprint.name;

          let issues: Issue[] | null = await this.client.getIssues({
            query:
              `project:{${this.project.name || this.project.id}} ` +
              (groupby !== "None" && !!element.contextValue ? `${groupby}:{${element.label}} ` : "") +
              (sortby !== "Default" ? `sort by:{${sortby}} ${sortOrder} ` : "") +
              (assignedto !== "Anyone" ? `for:${assignedto} ` : "") +
              (sprintName ? `#{${sprintName}}` : ""),
          });

          if (issues && issues.length > 0) {
            return issues.map((issue) => new IssueItem(issue, this.client?.self));
          } else if (issues && issues.length === 0) {
            return [new None("No issues found")];
          } else {
            return [new None("Error occurred while retrieving issues")];
          }
        }

        return [new None("No issues found")];
      } else {
        if (this.sprints) {
          return this.sprints.map((sprint) => new SprintItem(sprint));
        } else if (this.sprints === null) {
          return [new None("Error occurred while getting sprints")];
        } else {
          return [new None("No sprints found")];
        }
      }
    }
    return [new None("Select server to view repositories")];
  }

  gotoIssuePage(item: IssueItem) {
    if (this.client && this.agile) {
      const issueUrl = `${this.client.url}/agiles/${this.agile.id}//current?issue=${item.issue.id}`;
      vscode.env.openExternal(vscode.Uri.parse(issueUrl));
    }
  }

  async deleteIssue(item: IssueItem) {
    if (this.client && this.project) {
      const confirm: boolean =
        (await vscode.window.showInformationMessage("Do you want to delete this issue?", "Yes", "No")) === "Yes";
      if (confirm) {
        try {
          await this.client.deleteIssue(this.project.id, item.issue.id);
        } catch (e: any) {
          vscode.window.showWarningMessage(`Issue was not deleted due to the error: ${e.message}`);
        }
      }
    }
  }

  async updateIssueState(issue: Issue) {
    if (this.client && this.project && this.columnSettings) {
      const states: string[] = this.columnSettings.columns
        .flatMap((col) => col.fieldValues)
        .map((cfv) => cfv.name || cfv.id);
      const state: string | undefined = await vscode.window.showQuickPick(states, {
        canPickMany: false,
        ignoreFocusOut: true,
      });
      if (state) {
        try {
          await this.client.updateIssueState(this.project.id, issue.id, state);
        } catch (e) {
          vscode.window.showWarningMessage(`Issue was not updated due to this error: ${e}`);
        }
      }
    }
  }

  async updateIssueEnumBundle(issue: Issue, name: string, bundleName: string) {
    if (this.client && this.project && this.enumBundles) {
      const values: string[] = (
        this.enumBundles.find((bundle) => bundle.name === bundleName) || { values: [] }
      ).values.map((item) => item.name || item.id);

      const value: string | undefined = await vscode.window.showQuickPick(values, {
        canPickMany: false,
        ignoreFocusOut: true,
      });

      if (value) {
        try {
          await this.client.updateIssueSingleEnum(this.project.id, issue.id, name, value);
        } catch (e) {
          vscode.window.showWarningMessage(`Issue was not updated due to this error: ${e}`);
        }
      }
    }
  }

  async createBranch(item: IssueItem) {
    try {
      const extension = vscode.extensions.getExtension("vscode.git");
      if (extension !== undefined) {
        const gitExtension = extension.isActive ? extension.exports : await extension.activate();
        const gitAPI: API = gitExtension.getAPI(1);

        const repo = gitAPI.repositories[0];
        if (repo) {
          try {
            await repo.checkout(item.code.toLowerCase());
            // console.log(repo.state.HEAD?.name);
          } catch (e) {
            let branchName: string | undefined = await vscode.window.showInputBox({
              ignoreFocusOut: true,
              placeHolder: "Branch name",
              value: item.code.toLowerCase(),
              title: "Specify a branch name to create for this issue",
            });
            if (branchName) {
              await repo.createBranch(branchName, true);
            }
          }
        } else {
          vscode.window.showInformationMessage("No git repositories found");
        }
      }
    } catch (error) {}
  }

  setSprints(sprints?: Sprint[] | null) {
    this.sprints = sprints?.sort((spr1, spr2) => (spr1.start && spr2.start && spr1.start < spr2.start ? 1 : -1));
  }
  setColumnSettings(columnSettings?: ColumnSettings) {
    this.columnSettings = columnSettings;
  }
  setEnumBundles(enumBundles?: EnumBundle[]) {
    this.enumBundles = enumBundles;
  }
  setProject(projects?: Project) {
    this.project = projects;
  }
  setAgile(agile?: Agile) {
    this.agile = agile;
  }
}

class None extends vscode.TreeItem {
  id: string = "";
  branch: string = "";

  constructor(label: string, state: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None) {
    super(label, state);
    this.iconPath = new vscode.ThemeIcon(label.startsWith("Error") ? "warning" : "info");
  }
}

export class GroupingItem extends vscode.TreeItem {
  sprint: Sprint;

  constructor(label: string, sprint: Sprint) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("folder");
    this.tooltip = `${label}`;
    this.contextValue = "state";
    this.sprint = sprint;
  }
}

export class SprintItem extends vscode.TreeItem {
  sprint: Sprint;

  constructor(sprint: Sprint) {
    super(sprint.name || "Unnamed Sprint", vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("history");
    this.sprint = sprint;
    this.contextValue = "sprint";
  }
}

export class IssueItem extends vscode.TreeItem {
  issue: Issue;
  id: string;
  code: string;
  assignee?: User;

  getIcon?(issue: Issue, self?: User) {
    let assignee = (issue.customFields?.find((field) => field.name === "Assignee") || {}).value;
    if (issue.resolved) {
      return new vscode.ThemeIcon("pass", new vscode.ThemeColor("charts.green"));
    } else if (assignee && self && assignee.login === self.login) {
      return new vscode.ThemeIcon("warning");
    } else {
      return new vscode.ThemeIcon("note");
    }
  }

  prepareDescription(item: IssueItem): string {
    let description = `<h1>${item.label}</h1>`;
    let reporter = item.issue.reporter ? `Created by ${item.issue.reporter.fullName}` : "";
    let reportDate = item.issue.created ? ` on ${fmt.format(item.issue.created)}` : "";
    description += `<p>${reporter}${reportDate}</p>`;
    let updater = item.issue.updater ? `Updated by ${item.issue.updater.fullName}` : "";
    let upDate = item.issue.updated ? ` on ${fmt.format(item.issue.updated)}` : "";
    description += `<p>${updater}${upDate}</p>`;
    description += `<h2>Description</h2>${item.issue.wikifiedDescription || "No description available"}`;
    return description;
  }

  constructor(issue: Issue, self?: User) {
    let shortName = issue.project?.shortName || "Issue";
    let summary = issue.summary || "No summary provided";
    let label = `${shortName}-${issue.numberInProject}: ${summary}`;
    let assignee: User = (issue.customFields?.find((field) => field.name === "Assignee") || {}).value;
    let state: IssueCustomField = (issue.customFields?.find((field) => field.name === "State") || {}).value;
    let priority: IssueCustomField = (issue.customFields?.find((field) => field.name === "Priority") || {}).value;
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = [
      label + "\n",
      assignee ? `Assigned to: ${assignee.fullName}` : null,
      state ? `State: ${state.name}` : null,
      priority ? `Priority: ${priority.name}` : null,
      issue.reporter ? `Created by: ${issue.reporter.fullName}` : null,
      issue.updater ? `Updated by: ${issue.updater.fullName}` : null,
      issue.created ? `Created on: ${fmt.format(issue.created)}` : null,
      issue.updated ? `Updated on: ${fmt.format(issue.updated)}` : null,
    ]
      .filter((i) => !!i)
      .join("\n");
    this.contextValue = "issue";
    this.id = issue.id;
    this.assignee = assignee;
    this.code = `${shortName}-${issue.numberInProject}`;
    this.iconPath = this.getIcon!(issue, self);
    this.issue = issue;
    this.command = {
      title: "Show Description",
      command: "youtrack.showIssueDescription",
      arguments: [this.prepareDescription(this)],
    };
  }
}
