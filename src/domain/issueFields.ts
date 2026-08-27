import type { FieldValue, Issue, IssueCustomField } from "../api/types"

export const ASSIGNEE = "Assignee"
export const STATE = "State"
export const PRIORITY = "Priority"
export const TYPE = "Type"

export function findCustomField(issue: Issue, name: string): IssueCustomField | undefined {
  return issue.customFields?.find((field) => field.name === name)
}

export function findCustomFieldValue(issue: Issue, name: string): FieldValue | undefined {
  const value = findCustomField(issue, name)?.value
  if (!value) {
    return undefined
  }
  return Array.isArray(value) ? value[0] : value
}

export function customFieldName(issue: Issue, name: string): string | undefined {
  return findCustomFieldValue(issue, name)?.name
}
