import { AxiosError, AxiosHeaders } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { YoutrackClient } from "./youtrackClient"

const get = vi.fn<(url: string, config?: unknown) => Promise<{ data: unknown }>>()
const post = vi.fn<() => Promise<unknown>>()
const remove = vi.fn<() => Promise<unknown>>()

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>()
  return {
    ...actual,
    default: { ...actual.default, create: () => ({ get, post, delete: remove }) },
  }
})

const options = { url: "https://youtrack.example/", token: "perm:x", validateCertificate: true }
const me = { id: "1", login: "me", fullName: "Me" }
const forbidden = () => {
  const error = new AxiosError("Request failed")
  error.response = {
    status: 403,
    statusText: "",
    data: { error: "Forbidden", error_description: "Insufficient rights" },
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe("YoutrackClient.create", () => {
  beforeEach(() => get.mockReset())

  it("connects when everything succeeds", async () => {
    get.mockResolvedValueOnce({ data: me }).mockResolvedValueOnce({ data: [{ id: "b", name: "Priorities" }] })

    const client = await YoutrackClient.create(options)

    expect(client.self).toEqual(me)
    expect(client.enumBundles).toHaveLength(1)
    expect(client.enumBundlesError).toBeUndefined()
  })

  it("still connects when the token cannot read bundles", async () => {
    get.mockResolvedValueOnce({ data: me }).mockRejectedValueOnce(forbidden())

    const client = await YoutrackClient.create(options)

    expect(client.self).toEqual(me)
    expect(client.enumBundles).toBeUndefined()
    expect(client.enumBundlesError).toBeDefined()
  })

  it("fails when the token is rejected", async () => {
    get.mockRejectedValueOnce(forbidden())

    await expect(YoutrackClient.create(options)).rejects.toThrow("Request failed")
  })

  it("strips trailing slashes from the server url", async () => {
    get.mockResolvedValueOnce({ data: me }).mockResolvedValueOnce({ data: [] })

    const client = await YoutrackClient.create(options)

    expect(client.url).toBe("https://youtrack.example")
  })

  it("loads issue details and activities", async () => {
    const issue = { id: "i", numberInProject: 1, summary: "Issue" }
    const activities = [{ id: "a", timestamp: 1 }]
    const workItems = [{ id: "w", duration: { minutes: 60 } }]
    const vcsChanges = [{ id: "v", version: "abc" }]
    get.mockResolvedValueOnce({ data: me }).mockResolvedValueOnce({ data: [] })
    get
      .mockResolvedValueOnce({ data: issue })
      .mockResolvedValueOnce({ data: activities })
      .mockResolvedValueOnce({ data: workItems })
      .mockResolvedValueOnce({ data: vcsChanges })

    const client = await YoutrackClient.create(options)
    const details = await client.getIssueDetails("i")

    expect(details).toEqual({
      issue: { ...issue, workItems, vcsChanges },
      activities,
      activityError: undefined,
      workItemError: undefined,
      vcsError: undefined,
    })
    expect(get).toHaveBeenCalledWith(
      "/api/issues/i/activities",
      expect.objectContaining({
        params: expect.objectContaining({
          fields: expect.stringContaining("timestamp"),
          categories: "CustomFieldCategory,IssueResolvedCategory",
          $top: 42,
          $skip: 0,
        }),
      })
    )
    expect(get).toHaveBeenCalledWith(
      "/api/issues/i/timeTracking/workItems",
      expect.objectContaining({
        params: expect.objectContaining({ fields: expect.stringContaining("duration"), $top: 42, $skip: 0 }),
      })
    )
    expect(get).toHaveBeenCalledWith(
      "/api/issues/i/vcsChanges",
      expect.objectContaining({
        params: expect.objectContaining({ fields: expect.stringContaining("version"), $top: 42, $skip: 0 }),
      })
    )
  })

  it("returns issue details when activities are forbidden", async () => {
    const issue = { id: "i", numberInProject: 1 }
    get.mockResolvedValueOnce({ data: me }).mockResolvedValueOnce({ data: [] })
    get
      .mockResolvedValueOnce({ data: issue })
      .mockRejectedValueOnce(forbidden())
      .mockRejectedValueOnce(forbidden())
      .mockRejectedValueOnce(forbidden())

    const client = await YoutrackClient.create(options)
    const details = await client.getIssueDetails("i")

    expect(details.issue).toEqual({ ...issue, workItems: [], vcsChanges: [] })
    expect(details.activities).toEqual([])
    expect(details.activityError).toBeDefined()
    expect(details.workItemError).toBeDefined()
    expect(details.vcsError).toBeDefined()
  })

  it("loads every activity page", async () => {
    const firstPage = Array.from({ length: 42 }, (_, index) => ({ id: `a${index}` }))
    get.mockResolvedValueOnce({ data: me }).mockResolvedValueOnce({ data: [] })
    get
      .mockResolvedValueOnce({ data: { id: "i", numberInProject: 1 } })
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: "a42" }] })

    const client = await YoutrackClient.create(options)
    const details = await client.getIssueDetails("i")

    expect(details.activities).toHaveLength(43)
    expect(get).toHaveBeenCalledWith(
      "/api/issues/i/activities",
      expect.objectContaining({ params: expect.objectContaining({ $top: 42, $skip: 42 }) })
    )
  })
})
