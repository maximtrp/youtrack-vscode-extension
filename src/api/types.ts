export interface User {
  id: string
  login: string
  fullName: string
  banned?: boolean
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
  archived: boolean
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
