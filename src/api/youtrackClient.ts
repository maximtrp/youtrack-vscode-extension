import axios, { AxiosInstance } from "axios"
import { createHttpsAgent } from "./httpAgent.node"
import type { Agile, EnumBundle, Issue, IssueCustomFieldUpdate, NewIssue, Project, User } from "./types"

const REQUEST_TIMEOUT = 15000

const ISSUE_LIST_FIELDS = [
  "id",
  "numberInProject",
  "summary",
  "created",
  "updated",
  "resolved",
  "project(id,name,shortName)",
  "reporter(fullName)",
  "updater(fullName)",
  "customFields(name,value(id,name,fullName,login))",
].join(",")

const ISSUE_DESCRIPTION_FIELDS = "id,summary,wikifiedDescription"

const AGILE_FIELDS = [
  "id",
  "name",
  "owner(id,name)",
  "projects(id,name,shortName,archived,customFields(name,value(name)))",
  "sprints(id,name,unresolvedIssuesCount,start,finish,archived)",
  "columnSettings(field(id,name),columns(presentation,isResolved,fieldValues(id,name)))",
  "sprintsSettings(id,disableSprints)",
].join(",")

const USER_FIELDS = "id,login,fullName,banned"

export interface ClientOptions {
  url: string
  token: string
  validateCertificate: boolean
  caCertPath?: string
}

export interface IssueQueryParams {
  query: string
  top?: number
  skip?: number
}

export class YoutrackClient {
  readonly url: string
  private readonly http: AxiosInstance
  private currentUser?: User
  private priorityAndTypeBundles?: EnumBundle[]
  private bundlesError?: unknown

  private constructor(options: ClientOptions) {
    this.url = options.url.replace(/\/+$/, "")
    this.http = axios.create({
      timeout: REQUEST_TIMEOUT,
      baseURL: this.url,
      headers: { Authorization: `Bearer ${options.token}` },
      httpsAgent: createHttpsAgent({
        rejectUnauthorized: options.validateCertificate,
        caCertPath: options.caCertPath,
      }),
    })
  }

  static async create(options: ClientOptions): Promise<YoutrackClient> {
    const client = new YoutrackClient(options)
    client.currentUser = await client.get<User>("/api/users/me", { fields: USER_FIELDS })

    // Reading bundles needs project admin rights, so a token without them still gets a usable
    // connection - only grouping by priority or type is unavailable.
    try {
      client.priorityAndTypeBundles = await client.getEnumBundles()
    } catch (error) {
      client.bundlesError = error
    }

    return client
  }

  get self(): User | undefined {
    return this.currentUser
  }

  get enumBundles(): EnumBundle[] | undefined {
    return this.priorityAndTypeBundles
  }

  get enumBundlesError(): unknown {
    return this.bundlesError
  }

  private async get<T>(url: string, params?: object): Promise<T> {
    return (await this.http.get<T>(url, { params })).data
  }

  private async post<T>(url: string, data?: object, params?: object): Promise<T> {
    return (await this.http.post<T>(url, data, { params })).data
  }

  getAgiles(): Promise<Agile[]> {
    return this.get<Agile[]>("/api/agiles", { fields: AGILE_FIELDS })
  }

  getProjects(): Promise<Project[]> {
    return this.get<Project[]>("/api/admin/projects", {
      fields: "id,name,description,shortName,createdBy(name,login),archived",
    })
  }

  getEnumBundles(): Promise<EnumBundle[]> {
    return this.get<EnumBundle[]>("/api/admin/customFieldSettings/bundles/enum", {
      fields: "name,id,values(name,id,description,bundle(name),ordinal),isUpdateable",
    })
  }

  getUsers(): Promise<User[]> {
    return this.get<User[]>("/api/users", { fields: USER_FIELDS })
  }

  getIssues({ query, top, skip }: IssueQueryParams): Promise<Issue[]> {
    return this.get<Issue[]>("/api/issues", {
      fields: ISSUE_LIST_FIELDS,
      query,
      $top: top,
      $skip: skip,
    })
  }

  getIssueDescription(issueId: string): Promise<Issue> {
    return this.get<Issue>(`/api/issues/${issueId}`, { fields: ISSUE_DESCRIPTION_FIELDS })
  }

  addIssue(issue: NewIssue): Promise<Issue> {
    return this.post<Issue>("/api/issues", issue, { fields: "id" })
  }

  addIssueToSprint(agileId: string, sprintId: string, issueId: string): Promise<Issue> {
    return this.post<Issue>(`/api/agiles/${agileId}/sprints/${sprintId}/issues`, {
      id: issueId,
      $type: "Issue",
    })
  }

  updateIssueSummary(issueId: string, summary: string): Promise<Issue> {
    return this.post<Issue>(`/api/issues/${issueId}`, { summary })
  }

  updateIssueCustomField(issueId: string, field: IssueCustomFieldUpdate): Promise<Issue> {
    return this.post<Issue>(`/api/issues/${issueId}`, { customFields: [field] })
  }

  updateIssueState(issueId: string, state: string): Promise<Issue> {
    return this.updateIssueCustomField(issueId, {
      name: "State",
      $type: "StateIssueCustomField",
      value: { name: state, $type: "StateBundleElement" },
    })
  }

  updateIssueSingleEnum(issueId: string, name: string, value: string): Promise<Issue> {
    return this.updateIssueCustomField(issueId, {
      name,
      $type: "SingleEnumIssueCustomField",
      value: { name: value, $type: "EnumBundleElement" },
    })
  }

  updateIssueAssignee(issueId: string, userId: string): Promise<Issue> {
    return this.updateIssueCustomField(issueId, {
      name: "Assignee",
      $type: "SingleUserIssueCustomField",
      value: { id: userId, $type: "User" },
    })
  }

  async deleteIssue(issueId: string): Promise<void> {
    await this.http.delete(`/api/issues/${issueId}`)
  }
}
