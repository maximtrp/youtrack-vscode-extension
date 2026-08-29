import { describe, expect, it } from "vitest"
import type { SelectionContext } from "./issuesView"
import { stateValues } from "./issuesView"

const stateNames = ["Open", "Submitted", "In Progress", "Blocked", "Fixed", "Verified"]
const stateCustomField = {
  id: "state-field",
  field: { id: "state", name: "State" },
  bundle: { values: stateNames.map((name) => ({ id: name, name })) },
}

const context: SelectionContext = {
  project: {
    id: "p",
    name: "Project",
    archived: false,
    customFields: [stateCustomField],
  },
  columnSettings: {
    field: { id: "state", name: "State" },
    columns: [
      { isResolved: false, fieldValues: [{ id: "Open", name: "Open" }] },
      { isResolved: false, fieldValues: [{ id: "In Progress", name: "In Progress" }] },
      { isResolved: true, fieldValues: [{ id: "Fixed", name: "Fixed" }] },
    ],
  },
}

describe("stateValues", () => {
  it("uses every project state instead of only agile columns", () => {
    expect(stateValues(context)).toEqual(["Open", "Submitted", "In Progress", "Blocked", "Fixed", "Verified"])
  })

  it("falls back to agile columns when the project bundle is unavailable", () => {
    expect(stateValues({ ...context, project: { id: "p", archived: false } })).toEqual(["Open", "In Progress", "Fixed"])
  })

  it("uses the custom field configured for agile columns", () => {
    const custom = {
      ...context,
      project: {
        id: "p",
        archived: false,
        customFields: [
          {
            id: "stage-field",
            field: { id: "stage", name: "Stage" },
            bundle: {
              values: [
                { id: "Backlog", name: "Backlog" },
                { id: "Done", name: "Done" },
              ],
            },
          },
        ],
      },
      columnSettings: {
        field: { id: "stage", name: "Stage" },
        columns: context.columnSettings?.columns ?? [],
      },
    }

    expect(stateValues(custom)).toEqual(["Backlog", "Done"])
  })

  it("deduplicates values while preserving their order", () => {
    const duplicated = stateCustomField.bundle.values[0]
    const customFields = [
      {
        ...stateCustomField,
        bundle: { values: [...stateCustomField.bundle.values, duplicated] },
      },
    ]

    expect(stateValues({ ...context, project: { id: "p", archived: false, customFields } })).toEqual([
      "Open",
      "Submitted",
      "In Progress",
      "Blocked",
      "Fixed",
      "Verified",
    ])
  })
})
