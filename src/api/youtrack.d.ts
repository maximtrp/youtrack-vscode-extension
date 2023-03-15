interface User {
  login: string;
  fullName: string;
  online: boolean;
}

interface CustomField {
  id: string;
  name?: string;
  value?: { name?: string };
}

interface ColumnSettings {
  columns: AgileColumn[];
  field?: CustomField;
}

interface Agile {
  id: string;
  name: string;
  owner?: User;
  projects?: Project[];
  sprints?: Sprint[];
  columnSettings: ColumnSettings;
}

interface AgileColumn {
  isResolved: boolean;
  presentation?: string;
  fieldValues: AgileColumnFieldValue[];
}

interface AgileColumnFieldValue {
  id: string;
  name?: string;
}

interface Sprint {
  isDefault: boolean;
  unresolvedIssuesCount: number;
  start?: number;
  archived: boolean;
  finish?: number;
  goal?: string;
  name?: string;
  id: string;
}

interface Issue {
  readonly id: string;
  readonly numberInProject: number;
  summary?: string;
  description?: string;
  wikifiedDescription: string;
  readonly created?: number;
  readonly updated?: number;
  readonly resolved?: number;
  project?: Project;
  readonly reporter?: User;
  readonly updater?: User;
  readonly customFields?: IssueCustomField[];
}

interface IssueCustomField {
  name?: string;
  value?: any;
}

interface State {
  name?: string;
  id: string;
  isResolved: boolean;
}

interface Project {
  id: string;
  shortName?: string;
  description?: string;
  leader?: User;
  createdBy?: User;
  archived: boolean;
  name?: string;
}

interface EnumBundle {
  values: EnumBundleElement[];
  isUpdatable: boolean;
  id: string;
  name: string;
}

interface EnumBundleElement {
  description?: string;
  ordinal: number;
  name?: string;
  id: string;
}
