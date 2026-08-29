export interface User {
  id: string
  login: string
  fullName: string
  banned?: boolean
}

export interface IssueAttachment {
  id: string
  name: string
  url?: string
  size?: number
  mimeType?: string
  created?: number
  updated?: number
  author?: User
}

export interface IssueComment {
  id: string
  text?: string
  wikifiedText?: string
  created?: number
  updated?: number
  deleted?: boolean
  author?: User
  attachments?: IssueAttachment[]
}

export interface VcsChange {
  id: string
  $type?: string
  date?: number
  files?: number
  text?: string
  urls?: string[]
  version?: string
  author?: { name?: string; fullName?: string; login?: string }
}

export interface DurationValue {
  minutes?: number
  presentation?: string
}

export interface IssueWorkItem {
  id: string
  date?: number
  created?: number
  updated?: number
  text?: string
  textPreview?: string
  duration?: DurationValue
  type?: { id?: string; name?: string }
  author?: User
  creator?: User
}

export interface IssueLinkType {
  name?: string
  sourceToTarget?: string
  targetToSource?: string
}

export interface IssueLink {
  id: string
  direction?: string
  linkType?: IssueLinkType
  issues?: Pick<Issue, "id" | "numberInProject" | "summary" | "project">[]
}

export interface IssueTag {
  id: string
  name?: string
}

export interface ActivityValue {
  id?: string
  name?: string
  text?: string
  fullName?: string
  login?: string
}

export type ActivityValues = ActivityValue | ActivityValue[] | string | number | boolean | null

export interface IssueActivity {
  id: string
  timestamp?: number
  author?: User
  category?: { id?: string; name?: string }
  field?: { id?: string; name?: string }
  added?: ActivityValues
  removed?: ActivityValues
  target?: { id?: string; summary?: string }
}

export interface IssueDetails {
  issue: Issue
  activities: IssueActivity[]
  activityError?: unknown
  workItemError?: unknown
  vcsError?: unknown
}

export interface FieldValue {
  id: string
  name?: string
  fullName?: string
  login?: string
  $type?: string
}

export interface CustomField {
  id: string
  name?: string
  value?: FieldValue
}

export interface IssueCustomField {
  id?: string
  name?: string
  $type?: string
  value?: FieldValue | FieldValue[] | null
}

export interface IssueCustomFieldUpdate {
  name: string
  $type: string
  value: { id?: string; name?: string; $type: string }
}

export interface AgileColumnFieldValue {
  id: string
  name?: string
}

export interface AgileColumn {
  isResolved: boolean
  presentation?: string
  fieldValues: AgileColumnFieldValue[]
}

export interface ColumnSettings {
  columns: AgileColumn[]
  field?: CustomField
}

export interface SprintsSettings {
  id: string
  disableSprints: boolean
}

export interface Sprint {
  id: string
  name?: string
  goal?: string
  isDefault: boolean
  unresolvedIssuesCount: number
  start?: number
  finish?: number
  archived: boolean
}

export interface Project {
  id: string
  name?: string
  shortName?: string
  description?: string
  leader?: User
  createdBy?: User
  customFields?: ProjectCustomField[]
  archived: boolean
}

export interface ProjectCustomField {
  id: string
  field?: CustomField
  bundle?: { values?: FieldValue[] }
}

export interface Agile {
  id: string
  name: string
  owner?: User
  projects?: Project[]
  sprints?: Sprint[]
  columnSettings: ColumnSettings
  sprintsSettings?: SprintsSettings
}

export interface Issue {
  readonly id: string
  readonly numberInProject: number
  summary?: string
  description?: string
  wikifiedDescription?: string
  readonly created?: number
  readonly updated?: number
  readonly resolved?: number
  project?: Project
  readonly reporter?: User
  readonly updater?: User
  readonly customFields?: IssueCustomField[]
  readonly attachments?: IssueAttachment[]
  readonly comments?: IssueComment[]
  readonly vcsChanges?: VcsChange[]
  readonly workItems?: IssueWorkItem[]
  readonly links?: IssueLink[]
  readonly tags?: IssueTag[]
  readonly votes?: number
}

export interface NewIssue {
  summary: string
  description?: string
  project: { id: string }
  customFields: IssueCustomFieldUpdate[]
}

export interface EnumBundleElement {
  id: string
  name?: string
  description?: string
  ordinal: number
}

export interface EnumBundle {
  id: string
  name: string
  values: EnumBundleElement[]
  isUpdatable: boolean
}
