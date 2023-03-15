import * as vscode from "vscode";
import { YoutrackClient } from "./client";

export class AgilesProjectsProvider implements vscode.TreeDataProvider<ProjectItem | AgileItem | None> {
  agiles: Agile[] | null = null;
  client?: YoutrackClient;

  constructor() {}

  private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<
    ProjectItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(client?: YoutrackClient) {
    this.client = client;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem) {
    return element;
  }

  async getChildren(agile?: AgileItem): Promise<AgileItem[] | None[] | ProjectItem[]> {
    if (this.client) {
      if (agile) {
        let projects: Project[] | undefined = agile.projects;
        if (projects) {
          projects = projects.sort((i, j) => (i.name && j.name && i.name < j.name ? -1 : 1));
          return projects.map((project) => new ProjectItem(project));
        } else {
          return [new None("No projects found")];
        }
      } else {
        let agiles: Agile[] | null = await this.client.getAgiles();
        if (agiles) {
          if (agiles.length > 0) {
            return agiles.filter((agile) => !!agile.projects).map((agile) => new AgileItem(agile));
          } else if (agiles && agiles.length === 0) {
            return [new None("No agiles found")];
          }
        } else {
          return [new None("Error occurred while retrieving agiles")];
        }
      }
    }
    return [new None("Select server to view repositories")];
  }
}

class None extends vscode.TreeItem {
  constructor(label: string, state: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None) {
    super(label, state);
    this.iconPath = new vscode.ThemeIcon(label.startsWith("Error") ? "warning" : "info");
  }
}

export class AgileItem extends vscode.TreeItem {
  public name?: string;
  public projects?: Project[];
  public sprints?: Sprint[] | null;
  public agile?: Agile;
  public columnSettings?: ColumnSettings;

  constructor(agile: Agile) {
    super(
      agile.name,
      agile.projects && agile.projects.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.tooltip = agile.name;
    this.contextValue = "agile";
    this.name = agile.name;
    this.agile = agile;
    this.projects = agile.projects;
    this.sprints = agile.sprints;
    this.columnSettings = agile.columnSettings;
    this.iconPath = new vscode.ThemeIcon("folder");
  }
}

export class ProjectItem extends vscode.TreeItem {
  public project: Project;

  constructor(project: Project) {
    let label = project.name || "Unnamed Project";
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = [project.name].join("\n");
    this.contextValue = "project" + (project.archived ? "_archived" : "_active");
    this.project = project;
    this.description = project.shortName ? `(${project.shortName})` : undefined;
    this.iconPath = new vscode.ThemeIcon(
      "project",
      project.archived ? new vscode.ThemeColor("disabledForeground") : undefined
    );
  }
}
