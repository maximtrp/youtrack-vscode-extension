import { describe, expect, it } from "vitest"
import { buildIssueQuery } from "./issueQuery"

describe("buildIssueQuery", () => {
  it("filters by the project", () => {
    expect(buildIssueQuery({ project: "Accounting" })).toBe("project:{Accounting}")
  })

  it("adds the group clause when a group is given", () => {
    const query = buildIssueQuery({
      project: "Accounting",
      group: { field: "State", value: "To Do" },
    })
    expect(query).toBe("project:{Accounting} State:{To Do}")
  })

  it("uses the field the group carries rather than assuming State", () => {
    const query = buildIssueQuery({
      project: "Accounting",
      group: { field: "Stage", value: "To Do" },
    })
    expect(query).toContain("Stage:{To Do}")
  })

  it("omits the group clause only when there is no group", () => {
    expect(buildIssueQuery({ project: "Accounting" })).not.toContain("State")
  })

  it("scopes to a sprint", () => {
    const query = buildIssueQuery({ project: "Accounting", sprint: "Sprint 1" })
    expect(query).toBe("project:{Accounting} #{Sprint 1}")
  })

  it("escapes braces so a name cannot break out of the clause", () => {
    const query = buildIssueQuery({ project: "a}b", group: { field: "State", value: "c{d" } })
    expect(query).toBe(String.raw`project:{a\}b} State:{c\{d}`)
  })

  it("adds #Unresolved only when resolved issues are hidden", () => {
    expect(buildIssueQuery({ project: "P", showResolved: false })).toContain("#Unresolved")
    expect(buildIssueQuery({ project: "P", showResolved: true })).not.toContain("#Unresolved")
    expect(buildIssueQuery({ project: "P" })).not.toContain("#Unresolved")
  })

  it("omits sorting when it is Default", () => {
    expect(buildIssueQuery({ project: "P", sortBy: "Default", sortOrder: "DESC" })).toBe("project:{P}")
  })

  it("lowercases the sort order", () => {
    expect(buildIssueQuery({ project: "P", sortBy: "Updated", sortOrder: "DESC" })).toBe(
      "project:{P} sort by:{Updated} desc"
    )
  })

  it("omits the assignee clause for Anyone", () => {
    expect(buildIssueQuery({ project: "P", assignedTo: "Anyone" })).toBe("project:{P}")
    expect(buildIssueQuery({ project: "P", assignedTo: "Me" })).toBe("project:{P} for:Me")
  })

  it("never emits double spaces or trailing whitespace", () => {
    const query = buildIssueQuery({
      project: "P",
      group: { field: "State", value: "Open" },
      sprint: "S",
      sortBy: "Updated",
      sortOrder: "asc",
      assignedTo: "Me",
      showResolved: false,
    })
    expect(query).toBe("project:{P} State:{Open} sort by:{Updated} asc for:Me #Unresolved #{S}")
  })
})
