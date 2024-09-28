import * as vscode from "vscode";

const fmt = new Intl.DateTimeFormat("default", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export class IssueItem extends vscode.TreeItem {
  issue: Issue;
  id: string;
  code: string;
  assignee?: User;

  constructor(issue: Issue, self?: User) {
    let shortName = issue.project?.shortName || "Issue";
    let summary = issue.summary || "No summary provided";
    let label = `${shortName}-${issue.numberInProject}: ${summary}`;
    let assignee: User = (issue.customFields?.find((field) => field.name === "Assignee") || {})
      .value;
    let state: IssueCustomField = (
      issue.customFields?.find((field) => field.name === "State") || {}
    ).value;
    let priority: IssueCustomField = (
      issue.customFields?.find((field) => field.name === "Priority") || {}
    ).value;
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
    description += `<h2>Description</h2>${item.issue.wikifiedDescription || "No description available"
      }`;
    return description;
  }
}

export class None extends vscode.TreeItem {
  id: string = "";
  branch: string = "";

  constructor(
    label: string,
    state: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, state);
    this.iconPath = new vscode.ThemeIcon(/error|fail/i.test(label) ? "warning" : "info");
  }
}

export class GroupingItem extends vscode.TreeItem {
  sprint?: Sprint;

  constructor(label: string, sprint?: Sprint) {
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
