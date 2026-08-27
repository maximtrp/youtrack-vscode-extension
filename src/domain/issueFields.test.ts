import { describe, expect, it } from "vitest"
import type { Issue } from "../api/types"
import { ASSIGNEE, STATE, customFieldName, findCustomFieldValue } from "./issueFields"

const issue = (customFields: Issue["customFields"]): Issue => ({ id: "1", numberInProject: 1, customFields }) as Issue

describe("issue custom fields", () => {
  it("finds a single value", () => {
    const found = findCustomFieldValue(issue([{ name: STATE, value: { id: "s", name: "To Do" } }]), STATE)
    expect(found?.name).toBe("To Do")
  })

  it("takes the first value of a multi-value field", () => {
    const found = findCustomFieldValue(
      issue([
        {
          name: STATE,
          value: [
            { id: "a", name: "One" },
            { id: "b", name: "Two" },
          ],
        },
      ]),
      STATE
    )
    expect(found?.name).toBe("One")
  })

  it("returns undefined for a missing, empty or null field", () => {
    expect(findCustomFieldValue(issue([]), STATE)).toBeUndefined()
    expect(findCustomFieldValue(issue(undefined), STATE)).toBeUndefined()
    expect(findCustomFieldValue(issue([{ name: ASSIGNEE, value: null }]), ASSIGNEE)).toBeUndefined()
    expect(customFieldName(issue([{ name: STATE, value: { id: "s" } }]), STATE)).toBeUndefined()
  })
})
