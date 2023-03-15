import * as vscode from "vscode";
import { API } from "./api/git";
import { YoutrackClient } from "./client";

const fmt = new Intl.DateTimeFormat("default", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export class RecentIssuesProvider implements vscode.TreeDataProvider<IssueItem | None> {
  client?: YoutrackClient;
  project?: Project;
  agile?: Agile;
  sprints?: Sprint[] | null;

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

  async getChildren(): Promise<IssueItem[] | None[]> {
    if (this.client && this.project) {
      // FILTER SETTINGS
      const sortOrder: string = (
        vscode.workspace.getConfiguration("youtrack").get<string>("sortOrder") || "desc"
      ).toLowerCase();
      const sortby: string = vscode.workspace.getConfiguration("youtrack").get("sortIssuesBy") || "Default";
      const assignedto: string = vscode.workspace.getConfiguration("youtrack").get("showIssuesAssignedTo") || "Anyone";

      // ISSUES
      let issues: Issue[] | null = await this.client.getIssues({
        query:
          `project:{${this.project.name || this.project.id}} ` +
          (sortby !== "Default" ? `sort by:{${sortby}} ${sortOrder} ` : "") +
          (assignedto !== "Anyone" ? `for:${assignedto} ` : ""),
      });

      if (issues && issues.length > 0) {
        return issues.map((issue) => new IssueItem(issue, this.client?.self));
      } else if (issues && issues.length === 0) {
        return [new None("No issues found")];
      } else {
        return [new None("Error occurred while retrieving issues")];
      }
    }

    return [new None("Select server to view repositories")];
  }

  setProject(project?: Project) {
    this.project = project;
  }
}

class None extends vscode.TreeItem {
  branch: string = "";

  constructor(label: string, state: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None) {
    super(label, state);
    this.iconPath = new vscode.ThemeIcon(label.startsWith("Error") ? "warning" : "info");
  }
}

export class IssueItem extends vscode.TreeItem {
  code: string;
  issue: Issue;

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

  prepareDescription(issue: Issue): string {
    let description = `<h1>${issue.project?.shortName || "Issue"}-${issue.numberInProject}: ${issue.summary}</h1>`;
    let reporter = issue.reporter ? `Created by ${issue.reporter.fullName}` : "";
    let reportDate = issue.created ? ` on ${fmt.format(issue.created)}` : "";
    description += `<p>${reporter}${reportDate}</p>`;
    let updater = issue.updater ? `Updated by ${issue.updater.fullName}` : "";
    let upDate = issue.updated ? ` on ${fmt.format(issue.updated)}` : "";
    description += `<p>${updater}${upDate}</p>`;
    description += `<h2>Description</h2>${issue.wikifiedDescription}`;
    return description;
  }

  constructor(issue: Issue, self?: User) {
    let shortName = issue.project?.shortName || "Issue";
    let summary = issue.summary || "No summary provided";
    let label = `${shortName}-${issue.numberInProject}: ${summary}`;
    let assignee = (issue.customFields?.find((field) => field.name === "Assignee") || {}).value;
    super(label, vscode.TreeItemCollapsibleState.None);

    let createInfo =
      (issue.reporter ? ` by ${issue.reporter.fullName}` : "") +
      (issue.created ? ` on ${fmt.format(issue.created)}` : "");
    let updateInfo =
      (issue.updater ? ` by ${issue.updater.fullName}` : "") +
      (issue.updated ? ` on ${fmt.format(issue.updated)}` : "");
    this.tooltip = [
      label + "\n",
      assignee ? `Assigned to ${assignee.fullName}` : null,
      createInfo ? "Created " + createInfo : "",
      updateInfo ? "Updated " + updateInfo : "",
    ]
      .filter((i) => !!i)
      .join("\n");
    this.contextValue = "issue";
    this.code = `${shortName}-${issue.numberInProject}`;
    this.iconPath = this.getIcon!(issue, self);
    this.issue = issue;
    this.command = {
      title: "Show Description",
      command: "youtrack.showIssueDescription",
      arguments: [this.prepareDescription(issue)],
    };
  }
}
