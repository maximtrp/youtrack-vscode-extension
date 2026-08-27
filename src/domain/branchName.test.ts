import { describe, expect, it } from "vitest"
import { buildBranchName } from "./branchName"

describe("buildBranchName", () => {
  it("substitutes the issue code", () => {
    expect(buildBranchName("${issue.id}", { code: "AN-16", summary: "" })).toBe("an-16")
  })

  it("substitutes the summary and replaces unsafe characters", () => {
    const name = buildBranchName("${issue.id}-${issue.summary}", {
      code: "AN-16",
      summary: "Improve side bar!",
    })
    expect(name).toBe("an-16-improve-side-bar")
  })

  it("keeps slashes so prefixes work", () => {
    expect(buildBranchName("feature/${issue.id}", { code: "AN-1", summary: "" })).toBe("feature/an-1")
  })

  it("collapses repeated and trailing separators", () => {
    expect(buildBranchName("${issue.summary}", { code: "AN-1", summary: "a  --  b " })).toBe("a-b")
  })
})
