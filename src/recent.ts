import * as vscode from "vscode";
import { YoutrackClient } from "./client";
import { IssueItem, None } from "./sprints.items";

export class RecentIssuesProvider implements vscode.TreeDataProvider<IssueItem | None> {
  client?: YoutrackClient;
  project?: Project;

  constructor() {}

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

    return [new None("Select a project to view issues")];
  }

  setProject(project?: Project) {
    this.project = project;
  }
}
