export interface IssueGroup {
  field: string
  value: string
}

export interface IssueQueryOptions {
  project: string
  group?: IssueGroup
  sprint?: string
  sortBy?: string
  sortOrder?: string
  assignedTo?: string
  showResolved?: boolean
}

const escapeValue = (value: string) => value.replace(/[{}\\]/g, String.raw`\$&`)

const braced = (value: string) => `{${escapeValue(value)}}`

export function buildIssueQuery({
  project,
  group,
  sprint,
  sortBy,
  sortOrder,
  assignedTo,
  showResolved = true,
}: IssueQueryOptions): string {
  return [
    `project:${braced(project)}`,
    group ? `${group.field}:${braced(group.value)}` : "",
    sortBy && sortBy !== "Default" ? `sort by:${braced(sortBy)} ${(sortOrder ?? "desc").toLowerCase()}` : "",
    assignedTo && assignedTo !== "Anyone" ? `for:${assignedTo}` : "",
    showResolved ? "" : "#Unresolved",
    sprint ? `#${braced(sprint)}` : "",
  ]
    .filter(Boolean)
    .join(" ")
}
