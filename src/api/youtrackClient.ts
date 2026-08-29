import axios, { AxiosInstance } from "axios"
import { createHttpsAgent } from "./httpAgent.node"
import type {
  Agile,
  EnumBundle,
  Issue,
  IssueActivity,
  IssueCustomFieldUpdate,
  IssueDetails,
  IssueWorkItem,
  NewIssue,
  Project,
  User,
  VcsChange,
} from "./types"

const REQUEST_TIMEOUT = 15000
const COLLECTION_PAGE_SIZE = 42

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

const ISSUE_DETAILS_FIELDS = [
  "id",
  "numberInProject",
  "summary",
  "wikifiedDescription",
  "created",
  "updated",
  "resolved",
  "votes",
  "project(id,name,shortName)",
  "reporter(id,login,fullName)",
  "updater(id,login,fullName)",
  "customFields(id,name,$type,value(id,name,fullName,login,$type))",
  "tags(id,name)",
  "attachments(id,name,url,size,mimeType,created,updated,author(id,login,fullName))",
  "comments(id,text,wikifiedText,created,updated,deleted,author(id,login,fullName),attachments(id,name,url,size,mimeType))",
  "links(id,direction,linkType(name,sourceToTarget,targetToSource),issues(id,numberInProject,summary,project(shortName)))",
].join(",")

const ISSUE_ACTIVITY_FIELDS = [
  "id",
  "timestamp",
  "author(id,login,fullName)",
  "category(id,name)",
  "field(id,name)",
  "added(id,name,text,fullName,login)",
  "removed(id,name,text,fullName,login)",
  "target(id,summary)",
].join(",")

const AGILE_FIELDS = [
  "id",
  "name",
  "owner(id,name)",
  "projects(id,name,shortName,archived,customFields(id,field(id,name),bundle(values(id,name))))",
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

  private async getAll<T>(url: string, params?: object): Promise<T[]> {
    const loadPage = async (skip: number): Promise<T[]> => {
      const page = await this.get<T[]>(url, { ...params, $top: COLLECTION_PAGE_SIZE, $skip: skip })
      if (page.length < COLLECTION_PAGE_SIZE) return page
      return [...page, ...(await loadPage(skip + COLLECTION_PAGE_SIZE))]
    }
    return loadPage(0)
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

  async getIssueDetails(issueId: string): Promise<IssueDetails> {
    const issue = await this.get<Issue>(`/api/issues/${issueId}`, { fields: ISSUE_DETAILS_FIELDS })
    const [activityResult, workItemResult, vcsResult] = await Promise.allSettled([
      this.getAll<IssueActivity>(`/api/issues/${issueId}/activities`, {
        fields: ISSUE_ACTIVITY_FIELDS,
        categories: "CustomFieldCategory,IssueResolvedCategory",
      }),
      this.getAll<IssueWorkItem>(`/api/issues/${issueId}/timeTracking/workItems`, {
        fields:
          "id,date,created,updated,text,textPreview,duration(minutes,presentation),type(id,name),author(id,login,fullName),creator(id,login,fullName)",
      }),
      this.getAll<VcsChange>(`/api/issues/${issueId}/vcsChanges`, {
        fields: "id,$type,date,files,text,urls,version,author(name,fullName,login)",
      }),
    ])
    const activities = activityResult.status === "fulfilled" ? activityResult.value : []
    const workItems = workItemResult.status === "fulfilled" ? workItemResult.value : []
    const vcsChanges = vcsResult.status === "fulfilled" ? vcsResult.value : []
    return {
      issue: { ...issue, workItems, vcsChanges },
      activities,
      activityError: activityResult.status === "rejected" ? activityResult.reason : undefined,
      workItemError: workItemResult.status === "rejected" ? workItemResult.reason : undefined,
      vcsError: vcsResult.status === "rejected" ? vcsResult.reason : undefined,
    }
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
