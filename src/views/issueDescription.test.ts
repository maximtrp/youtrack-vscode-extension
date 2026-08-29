import { describe, expect, it } from "vitest"
import type { IssueDetails } from "../api/types"
import { renderIssueDetails } from "./issueDescription"

const details: IssueDetails = {
  issue: {
    id: "i",
    numberInProject: 42,
    summary: "Unsafe <title>",
    project: { id: "p", shortName: "APP", name: "Application", archived: false },
    wikifiedDescription:
      '<p>Hello <strong>world</strong> <a href="/issue/APP-1">related issue</a></p><script>alert(1)</script><a href="javascript:x">bad</a>',
    customFields: [{ name: "State", value: { id: "s", name: "In Progress" } }],
    attachments: [{ id: "f", name: "spec.pdf", url: "/files/spec.pdf", size: 2048 }],
    comments: [
      {
        id: "c",
        author: { id: "u", login: "ada", fullName: "Ada Lovelace" },
        created: Date.UTC(2026, 0, 1),
        text: "Reviewed **carefully** with [documentation](https://docs.example/review)",
        wikifiedText: '<p onclick="bad()">Reviewed <a href="https://docs.example/review">documentation</a></p>',
      },
    ],
    workItems: [
      {
        id: "w1",
        author: { id: "u", login: "ada", fullName: "Ada Lovelace" },
        date: Date.UTC(2026, 0, 2),
        duration: { minutes: 90, presentation: "1h 30m" },
        type: { id: "t", name: "Development" },
        textPreview: '<p>Implemented <a href="/issue/APP-2">dependency</a></p>',
      },
      { id: "w2", duration: { minutes: 30 }, text: "Review" },
    ],
    vcsChanges: [
      {
        id: "v",
        $type: "VcsChange",
        author: { fullName: "Ada Lovelace" },
        text: "Implement feature",
        version: "1234567890abcdef",
        files: 4,
        urls: ["https://git.example/c/1"],
      },
    ],
  },
  activities: [
    {
      id: "a",
      author: { id: "u", login: "ada", fullName: "Ada Lovelace" },
      field: { name: "State" },
      removed: { name: "Open" },
      added: { name: "In Progress" },
    },
  ],
}

describe("renderIssueDetails", () => {
  it("renders all issue sections", () => {
    const html = renderIssueDetails(details, "https://youtrack.example")

    expect(html).toContain("APP-42")
    expect(html).toContain("Unsafe &lt;title&gt;")
    expect(html).toContain("In Progress")
    expect(html).toContain("spec.pdf")
    expect(html).toContain("Ada Lovelace")
    expect(html).toContain("<strong>carefully</strong>")
    expect(html).toContain("Open → In Progress")
    expect(html).toContain("Total: <strong>2h</strong>")
    expect(html).toContain("Development")
    expect(html).toContain("Implement feature")
    expect(html).toContain("1234567890ab")
    expect(html).toContain("4 files")
  })

  it("removes executable server markup", () => {
    const html = renderIssueDetails(details, "https://youtrack.example")

    expect(html).not.toContain("<script")
    expect(html).not.toContain("javascript:")
    expect(html).not.toContain("onclick=")
    expect(html).toContain("<strong>world</strong>")
  })

  it("shows absolute and relative links in descriptions and comments", () => {
    const html = renderIssueDetails(details, "https://youtrack.example")

    expect(html).toContain('href="https://youtrack.example/issue/APP-1"')
    expect(html).toContain('href="https://docs.example/review">documentation</a>')
  })

  it("shows a useful message when history cannot be read", () => {
    const html = renderIssueDetails(
      { ...details, activities: [], activityError: new Error() },
      "https://youtrack.example"
    )

    expect(html).toContain("History is unavailable")
  })

  it("shows useful messages when work items and commits cannot be read", () => {
    const html = renderIssueDetails(
      {
        ...details,
        issue: { ...details.issue, workItems: [], vcsChanges: [] },
        workItemError: new Error(),
        vcsError: new Error(),
      },
      "https://youtrack.example"
    )

    expect(html).toContain("Time tracking is unavailable")
    expect(html).toContain("VCS changes are unavailable")
  })
})
