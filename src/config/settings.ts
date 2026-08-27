import * as vscode from "vscode"

export type GroupBy = "None" | "State" | "Priority" | "Type"

export const SECTION = "youtrack"

export const DEFAULTS = {
  groupIssuesBy: "None" as GroupBy,
  sortIssuesBy: "Default",
  sortOrder: "DESC",
  showIssuesAssignedTo: "Anyone",
  showResolvedIssues: true,
  validateCertificate: true,
  branchNameTemplate: "${issue.id}",
  pageSize: 100,
}

type Settings = typeof DEFAULTS

function read<K extends keyof Settings>(key: K): Settings[K] {
  return vscode.workspace.getConfiguration(SECTION).get<Settings[K]>(key) ?? DEFAULTS[key]
}

export const settings = {
  groupBy: () => read("groupIssuesBy"),
  sortBy: () => read("sortIssuesBy"),
  sortOrder: () => read("sortOrder").toLowerCase(),
  assignedTo: () => read("showIssuesAssignedTo"),
  showResolved: () => read("showResolvedIssues"),
  validateCertificate: () => read("validateCertificate"),
  branchNameTemplate: () => read("branchNameTemplate"),
  pageSize: () => read("pageSize"),

  async update<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    await vscode.workspace.getConfiguration().update(`${SECTION}.${key}`, value, vscode.ConfigurationTarget.Global)
  },
}
