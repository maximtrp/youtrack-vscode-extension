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
})
