/* eslint-disable @typescript-eslint/naming-convention */
import axios, { AxiosInstance } from "axios";

export class YoutrackClient {
  private client: AxiosInstance;
  public url: string;
  public self?: User;
  public enumBundles?: EnumBundle[];

  constructor(url: string, token: string) {
    this.url = url.replace(/\/+$/, "");
    this.client = axios.create({ baseURL: this.url, headers: { Authorization: `Bearer ${token}` } });
    this.getMe();
    this.getEnumBundles();
  }

  async _get(url: string, params?: object): Promise<any | null> {
    let result: any | null = null;
    try {
      result = (await this.client.get(url, { params })).data;
      // console.log(this.client.getUri({ baseURL: url, params }));
      // console.log(result);
      return result;
    } catch (error: any) {
      // console.log(error.toJSON());
      // console.log(error.request as ClientRequest);
      return result;
    }
  }

  async _post(url: string, data?: object, params?: object): Promise<any | null> {
    let result: any | null = null;
    try {
      // console.log(url);
      // console.log(params);
      result = (await this.client.post(url, data, { params, headers: { "Content-Type": "application/json" } })).data;
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

  async getAgiles(): Promise<Agile[] | null> {
    return await this._get("/api/agiles", {
      fields: [
        "id",
        "name",
        "owner(id,name)",
        "projects(id,name,shortName,archived,customFields(name,value(name)))",
        "sprints(id,name,unresolvedIssuesCount,start,finish,archived)",
        "columnSettings(field(id,name),columns(presentation,isResolved,fieldValues(id,name)))",
      ].join(","),
    });
  }

  async getProjects(): Promise<Project[] | null> {
    return await this._get("/api/admin/projects", {
      fields: ["id", "name", "description", "shortName", "createdBy(name,login)", "archived"].join(","),
    });
  }

  async getEnumBundles(): Promise<void> {
    this.enumBundles = await this._get("/api/admin/customFieldSettings/bundles/enum", {
      fields: ["name", "id", "values(name,id,description,bundle(name),ordinal)", "isUpdateable"].join(","),
    });
  }

  async getIssues(params?: object): Promise<Issue[] | null> {
    return await this._get("/api/issues", {
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

  async updateIssueSummary(projectId: string, issueId: string, summary: string): Promise<Issue[] | null> {
    return await this._post(`/api/admin/projects/${projectId}/issues/${issueId}`, { summary });
  }

  async updateIssueState(projectId: string, issueId: string, state: string): Promise<Issue[] | null> {
    return await this._post(`/api/admin/projects/${projectId}/issues/${issueId}`, {
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
    });
  }

  async deleteIssue(issueId: string): Promise<null> {
    return await this._delete(`/api/issues/${issueId}`);
  }

  async updateIssueSingleEnum(
    projectId: string,
    issueId: string,
    name: string,
    value: string
  ): Promise<Issue[] | null> {
    return await this._post(`/api/admin/projects/${projectId}/issues/${issueId}`, {
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

  async getStates(params?: object): Promise<State[] | null> {
    return await this._get("/api/admin/customFieldSettings/bundles/state", {
      fields: ["name", "id", "values(name,id,ordinal,isResolved)", "isUpdateable"].join(","),
      ...params,
    });
  }

  async getMe(): Promise<void> {
    this.self = await this._get("/api/users/me", { fields: ["id", "login", "fullName", "banned"].join(",") });
  }

  async addIssue(data?: object, params?: object): Promise<Issue> {
    return await this._post(`/api/issues`, data, params);
  }

  async addIssueToSprint(agileId: string, sprintId: string, issueId: string): Promise<Issue> {
    return await this._post(`/api/agiles/${agileId}/sprints/${sprintId}/issues`, { id: issueId, $type: "Issue" });
  }
}
