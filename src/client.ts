/* eslint-disable @typescript-eslint/naming-convention */
import axios, { AxiosInstance } from "axios";
import * as https from "https";

axios.defaults.httpsAgent;

export class YoutrackClient {
  private client: AxiosInstance;
  public url: string;
  public self?: User;
  public enumBundles?: EnumBundle[];

  constructor(url: string, token: string) {
    this.url = url.replace(/\/+$/, "");
    this.client = axios.create({
      timeout: 5000,
      baseURL: this.url,
      headers: { Authorization: `Bearer ${token}` },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
    this.getMe();
    this.getEnumBundles();
  }

  async _get(url: string, params?: object): Promise<any | null> {
    try {
      const request = await this.client.get(url, { params });
      return request?.data;
    } catch (error) {
      throw error;
    }
  }

  async _post(
    url: string,
    data?: object,
    params?: object,
  ): Promise<any | null> {
    let result: any | null = null;
    try {
      // console.log(url);
      // console.log(params);
      result = (
        await this.client.post(url, data, {
          params,
          headers: { "Content-Type": "application/json" },
        })
      ).data;
      // console.log(result);
      return result;
    } catch (error: any) {
      // console.log(error.toJSON());
      // console.log(error.request as ClientRequest);
      throw error;
    }
  }

  async _delete(url: string): Promise<any | null> {
    let result: any;
    try {
      result = await this.client.delete(url);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  getAgiles(): Promise<any | null> {
    return this._get("/api/agiles", {
      fields: [
        "id",
        "name",
        "owner(id,name)",
        "projects(id,name,shortName,archived,customFields(name,value(name)))",
        "sprints(id,name,unresolvedIssuesCount,start,finish,archived)",
        "columnSettings(field(id,name),columns(presentation,isResolved,fieldValues(id,name)))",
        "sprintsSettings(id,disableSprints)",
      ].join(","),
    });
  }

  getProjects(): Promise<any | null> {
    return this._get("/api/admin/projects", {
      fields: [
        "id",
        "name",
        "description",
        "shortName",
        "createdBy(name,login)",
        "archived",
      ].join(","),
    });
  }

  async getEnumBundles(): Promise<void> {
    try {
      this.enumBundles = await this._get(
        "/api/admin/customFieldSettings/bundles/enum",
        {
          fields: [
            "name",
            "id",
            "values(name,id,description,bundle(name),ordinal)",
            "isUpdateable",
          ].join(","),
        },
      );
    } catch (error: any) {
      console.log("youtrack-vscode-extension request failed:", error.response);
    }
  }

  getIssues(params?: object): Promise<any | null> {
    return this._get("/api/issues", {
      fields: [
        "id",
        "numberInProject",
        "summary",
        "description",
        "created",
        "updated",
        "resolved",
        "wikifiedDescription",
        "project(id,name,shortName)",
        "reporter(fullName)",
        "updater(fullName)",
        "customFields(name,value(id,name,fullName,login))",
      ].join(","),
      customFields: ["assignee", "state"],
      ...params,
    });
  }

  async updateIssueSummary(
    projectId: string,
    issueId: string,
    summary: string,
  ): Promise<Issue[] | null> {
    return await this._post(
      `/api/admin/projects/${projectId}/issues/${issueId}`,
      { summary },
    );
  }

  async updateIssueState(
    projectId: string,
    issueId: string,
    state: string,
  ): Promise<Issue[] | null> {
    return await this._post(
      `/api/admin/projects/${projectId}/issues/${issueId}`,
      {
        customFields: [
          {
            value: {
              name: state,
              $type: "StateBundleElement",
            },
            name: "State",
            $type: "StateIssueCustomField",
          },
        ],
      },
    );
  }

  async updateIssueSingleEnum(
    issueId: string,
    name: string,
    value: string,
  ): Promise<Issue[] | null> {
    return await this._post(`/api/issues/${issueId}`, {
      customFields: [
        {
          value: {
            name: value,
            $type: "EnumBundleElement",
          },
          name: name,
          $type: "SingleEnumIssueCustomField",
        },
      ],
    });
  }

  async updateIssueAssignee(
    issueId: string,
    userId?: string,
  ): Promise<Issue[] | null> {
    if (!userId && !this.self) {
      throw Error("Assignee was not updated due to missing user data");
    }
    return await this._post(`/api/issues/${issueId}`, {
      customFields: [
        {
          value: {
            id: userId || this.self!.id,
            $type: "User",
          },
          name: "Assignee",
          $type: "SingleUserIssueCustomField",
        },
      ],
    });
  }

  async updateIssue(
    issueId: string,
    data?: object,
    params?: object,
  ): Promise<Issue> {
    return await this._post(`/api/issues/${issueId}`, data, params);
  }

  async deleteIssue(issueId: string): Promise<null> {
    return await this._delete(`/api/issues/${issueId}`);
  }

  async addIssue(data?: object, params?: object): Promise<Issue> {
    return await this._post(`/api/issues`, data, params);
  }

  async addIssueToSprint(
    agileId: string,
    sprintId: string,
    issueId: string,
  ): Promise<Issue> {
    return await this._post(
      `/api/agiles/${agileId}/sprints/${sprintId}/issues`,
      {
        id: issueId,
        $type: "Issue",
      },
    );
  }

  getStates(params?: object): Promise<any | null> {
    return this._get("/api/admin/customFieldSettings/bundles/state", {
      fields: [
        "name",
        "id",
        "values(name,id,ordinal,isResolved)",
        "isUpdateable",
      ].join(","),
      ...params,
    });
  }

  getUsers(): Promise<any | null> {
    return this._get("/api/users", {
      fields: ["id", "login", "fullName", "banned"].join(","),
    });
  }

  async getMe(): Promise<void> {
    try {
      this.self = await this._get("/api/users/me", {
        fields: ["id", "login", "fullName", "banned"].join(","),
      });
    } catch (error: any) {
      console.log("youtrack-vscode-extension request failed:", error.response);
    }
  }
}
