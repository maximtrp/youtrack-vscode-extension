import * as vscode from "vscode";
import { API } from "./api/git";
import { YoutrackClient } from "./client";
import { GroupingItem, IssueItem, SprintItem, None } from "./sprints.items";
import { AxiosError } from "axios";

export class SprintsIssuesProvider
  implements vscode.TreeDataProvider<IssueItem | SprintItem | GroupingItem | None> {
  client?: YoutrackClient;
  project?: Project;
  agile?: Agile;
  sprints?: Sprint[] | null;
  columnSettings?: ColumnSettings;
  enumBundles?: EnumBundle[];

  constructor() { }

  private _onDidChangeTreeData: vscode.EventEmitter<IssueItem | undefined | null | void> =
    new vscode.EventEmitter<IssueItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<IssueItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  refresh(client?: YoutrackClient) {
    this.client = client;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem) {
    return element;
  }

  async getStates(element?: SprintItem) {
    if (this.columnSettings) {
      return this.columnSettings.columns
        .flatMap((col) => col.fieldValues)
        .map((cfv) => new GroupingItem(cfv.name || cfv.id, element?.sprint));
    } else {
      return [new None("No states found")];
    }
  }

  async getPriorities(element?: SprintItem) {
    // console.log(this.enumBundles);
    if (this.enumBundles) {
      const priorities = (this.enumBundles.find((bundle) => bundle.name === "Priorities") || {})
        .values;
      if (priorities) {
        return priorities.map(
          (priority) => new GroupingItem(priority.name || priority.id, element?.sprint)
        );
      }
    }
    return [new None("No priorities found")];
  }

  async getTypes(element?: SprintItem) {
    if (this.enumBundles) {
      const types = (this.enumBundles.find((bundle) => bundle.name === "Types") || {}).values;
      if (types) {
        return types.map((type) => new GroupingItem(type.name || type.id, element?.sprint));
      }
    }
    return [new None("No types found")];
  }

  getGroups(groupby: string, sprint?: SprintItem | GroupingItem | None) {
    if (groupby === "State") {
      return this.getStates(sprint as SprintItem);
    } else if (groupby === "Priority") {
      return this.getPriorities(sprint as SprintItem);
    } else if (groupby === "Type") {
      return this.getTypes(sprint as SprintItem);
    } else {
      return this.getStates(sprint as SprintItem);
    }
  }

  async getChildren(
    element?: SprintItem | GroupingItem | None
  ): Promise<IssueItem[] | SprintItem[] | GroupingItem[] | None[]> {
    const groupby: string =
      vscode.workspace.getConfiguration("youtrack").get("groupIssuesBy") || "None";

    if (this.client && this.project) {
      if (element) {
        // FILTER SETTINGS
        const sortOrder: string = (
          vscode.workspace.getConfiguration("youtrack").get<string>("sortOrder") || "desc"
        ).toLowerCase();
        const sortby: string =
          vscode.workspace.getConfiguration("youtrack").get("sortIssuesBy") || "Default";
        const assignedto: string =
          vscode.workspace.getConfiguration("youtrack").get("showIssuesAssignedTo") || "Anyone";

        // GROUPING LOGIC
        if (element.contextValue === "sprint" && groupby !== "None") {
          return this.getGroups(groupby, element);
        } else if (element.contextValue !== "sprint" || groupby === "None") {
          const sprintName = (element as GroupingItem).sprint?.name;

          // ISSUES
          try {
            const issues: Issue[] | null = await this.client.getIssues({
              query:
                `project:{${this.project.name || this.project.id}} ` +
                (groupby !== "None" && !!element.contextValue
                  ? `${groupby}:{${element.label}} `
                  : "") +
                (sortby !== "Default" ? `sort by:{${sortby}} ${sortOrder} ` : "") +
                (assignedto !== "Anyone" ? `for:${assignedto} ` : "") +
                (sprintName ? `#{${sprintName}}` : ""),
            });

            if (issues && issues.length > 0) {
              return issues.map((issue) => new IssueItem(issue, this.client?.self));
            } else {
              return [new None("Issues not found")];
            }
          } catch (e) {
            const error = e as AxiosError;
            vscode.window.showErrorMessage(
              `Failed to retrieve sprint issues. ` +
              (error.response
                ? `Error ${error.response.status}: ${error.response.data?.error}. ${error.response.data?.error_description}`
                : `Error: ${error.message}`)
            );
            return [new None("Sprint issues retrieving failed")];
          }
        }

        return [new None("Issues not found")];
      } else {
        if (this.agile?.sprintsSettings.disableSprints) {
          return this.getGroups(groupby);
        } else if (this.sprints) {
          return this.sprints.map((sprint) => new SprintItem(sprint));
        } else if (this.sprints === null) {
          return [new None("Sprints retrieving failed")];
        } else {
          return [new None("Issues not found")];
        }
      }
    }
    return [new None("Select a project to view issues")];
  }

  async addIssue() {
    if (this.client && this.project) {
      const summary =
        (await vscode.window.showInputBox({ ignoreFocusOut: true, title: "Issue summary" })) || "";
      if (!summary) {
        vscode.window.showInformationMessage("Issue was not created due to the empty summary");
        return;
      }

      const description = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        title: "Issue description (optional)",
      });

      const issue: NewIssue = {
        summary,
        description,
        project: {
          id: this.project.id,
        },
        customFields: [],
      };

      // Issue state
      if (this.columnSettings) {
        const states: string[] = this.columnSettings.columns
          .flatMap((col) => col.fieldValues)
          .map((cfv) => cfv.name || cfv.id);

        const state: string | undefined = await vscode.window.showQuickPick(states, {
          canPickMany: false,
          ignoreFocusOut: true,
        });

        if (state) {
          issue.customFields.push({
            value: {
              name: state,
              $type: "StateBundleElement",
            },
            name: "State",
            $type: "StateIssueCustomField",
          });
        }
      }

      // // Issue enum fields
      // if (this.enumBundles) {
      //   // eslint-disable-next-line @typescript-eslint/naming-convention
      //   const bundlesDict: { [key: string]: string } = { Types: "Type", Priorities: "Priority" };

      //   for (let bundle of this.enumBundles) {
      //     const values: string[] = bundle.values.map((item) => item.name || "").filter((item) => !!item);

      //     const value = await vscode.window.showQuickPick(values, {
      //       canPickMany: false,
      //       ignoreFocusOut: true,
      //       title: "Issue " + bundle.name,
      //     });
      //     if (!value) {
      //       continue;
      //     } else {
      //       issue.customFields.push({
      //         value: {
      //           name: value,
      //           $type: "EnumBundleElement",
      //         },
      //         name: bundlesDict[bundle.name],
      //         $type: "SingleEnumIssueCustomField",
      //       });
      //     }
      //   }
      // }

      let createdIssue: Issue;
      try {
        // Creating an issue
        createdIssue = await this.client.addIssue(issue, { fields: "id" });
      } catch (error) {
        vscode.window.showErrorMessage(`Issue was not created due to the error: ${(error as Error).message}`);
        return;
      }

      // Adding issue to a sprint
      if (this.agile && this.sprints) {
        const sprints: string[] = this.sprints
          .map((sprint) => sprint.name || "")
          .filter((name) => !!name);
        const selectedSprint: string | undefined = await vscode.window.showQuickPick(sprints, {
          canPickMany: false,
          ignoreFocusOut: true,
        });

        if (selectedSprint) {
          const selectedSprintId = this.sprints.find(
            (sprint) => sprint.name === selectedSprint
          )!.id;
          try {
            await this.client.addIssueToSprint(this.agile.id, selectedSprintId, createdIssue.id);
          } catch (error) {
            vscode.window.showErrorMessage(
              `Issue was not added to ${selectedSprint} due to this error: ${(error as Error).message}`
            );
          }
        }
      }
    } else {
      vscode.window.showInformationMessage("Please select a project to add an issue");
    }
  }

  async updateIssueAssignee(item: IssueItem) {
    if (this.client) {
      const users: User[] | null = await this.client.getUsers();
      if (!users || users.length === 0) {
        vscode.window.showInformationMessage(`No users found to assign this issue to`);
        return;
      }

      const selectedUserInfo: string | undefined = await vscode.window.showQuickPick(
        users.map((user) => `${user.login} (${user.fullName})`),
        {
          canPickMany: false,
          ignoreFocusOut: true,
          title: "Select a user to assign this issue to",
        }
      );
      const selectedUserLogin = selectedUserInfo?.split(" ")[0];
      const selectedUser = users.find((user) => user.login === selectedUserLogin);
      if (!selectedUser) {
        vscode.window.showInformationMessage("Issue assignee was not set");
        return;
      }

      try {
        await this.client.updateIssueAssignee(item.issue.id, selectedUser.id);
      } catch (e) {
        vscode.window.showErrorMessage(`Issue assignee was not updated due to this error: ${e}`);
      }
    }
  }

  async updateIssueSummary(item: IssueItem) {
    if (this.client) {
      const summary = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        title: "Enter issue summary",
        value: item.issue.summary,
      });
      if (!summary) {
        vscode.window.showInformationMessage("Issue summary was not updated");
        return;
      }
      try {
        await this.client.updateIssue(item.issue.id, { summary });
      } catch (e) {
        vscode.window.showWarningMessage(`Issue was not updated due to this error: ${e}`);
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
    if (this.client && this.enumBundles) {
      const values: string[] = (
        this.enumBundles.find((bundle) => bundle.name === bundleName) || { values: [] }
      ).values.map((item) => item.name || item.id);

      const value: string | undefined = await vscode.window.showQuickPick(values, {
        canPickMany: false,
        ignoreFocusOut: true,
      });

      if (value) {
        try {
          await this.client.updateIssueSingleEnum(issue.id, name, value);
        } catch (e) {
          vscode.window.showWarningMessage(`Issue was not updated due to this error: ${e}`);
        }
      }
    }
  }

  gotoIssuePage(item: IssueItem) {
    if (this.client && this.agile) {
      const issueUrl = `${this.client.url}/agiles/${this.agile.id}/current?issue=${item.issue.id}`;
      vscode.env.openExternal(vscode.Uri.parse(issueUrl));
    }
  }

  async deleteIssue(item: IssueItem) {
    if (this.client) {
      const confirm: boolean =
        (await vscode.window.showInformationMessage(
          "Do you want to delete this issue?",
          "Yes",
          "No"
        )) === "Yes";
      if (confirm) {
        try {
          await this.client.deleteIssue(item.issue.id);
        } catch (error) {
          vscode.window.showWarningMessage(`Issue was not deleted due to the error: ${(error as Error).message}`);
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
          } catch (error) {
            console.error(error);
            const branchName: string | undefined = await vscode.window.showInputBox({
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
    } catch (error) {
      vscode.window.showInformationMessage(`Error occurred while creating a git branch: ${(error as Error).message}`);
    }
  }

  setSprints(sprints?: Sprint[] | null) {
    this.sprints = sprints?.sort((spr1, spr2) =>
      spr1.start && spr2.start && spr1.start < spr2.start ? 1 : -1
    );
  }
  setColumnSettings(columnSettings?: ColumnSettings) {
    this.columnSettings = columnSettings;
  }
  setEnumBundles(enumBundles?: EnumBundle[]) {
    // console.log(enumBundles);
    this.enumBundles = enumBundles;
  }
  setProject(projects?: Project) {
    this.project = projects;
  }
  setAgile(agile?: Agile) {
    this.agile = agile;
  }

  reset(): SprintsIssuesProvider {
    this.client = undefined;
    this.project = undefined;
    this.agile = undefined;
    this.sprints = undefined;
    return this;
  }
}
