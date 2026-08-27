import { beforeEach, describe, expect, it } from "vitest"
import { ServerStore, normalizeUrl, type SecretStore } from "./serverStore"

class MemorySecrets implements SecretStore {
  private values = new Map<string, string>()

  constructor(initial?: string) {
    if (initial !== undefined) {
      this.values.set("servers", initial)
    }
  }

  get(key: string) {
    return Promise.resolve(this.values.get(key))
  }

  store(key: string, value: string) {
    this.values.set(key, value)
    return Promise.resolve()
  }
}

const server = (url: string, label = url) => ({ url, label, token: "perm:token" })

describe("ServerStore", () => {
  let store: ServerStore

  beforeEach(() => {
    store = new ServerStore(new MemorySecrets())
  })

  it("starts empty and survives corrupted storage", async () => {
    expect(await store.list()).toEqual([])
    expect(await new ServerStore(new MemorySecrets("not json")).list()).toEqual([])
    expect(await new ServerStore(new MemorySecrets('{"a":1}')).list()).toEqual([])
  })

  it("identifies servers by url, not label", async () => {
    await store.add(server("https://a.example", "same label"))
    await store.add(server("https://b.example", "same label"))
    await store.remove("https://a.example")

    expect((await store.list()).map((s) => s.url)).toEqual(["https://b.example"])
  })

  it("normalizes trailing slashes on write and lookup", async () => {
    await store.add(server("https://a.example///"))
    expect(await store.find("https://a.example")).toBeDefined()
    expect(normalizeUrl("https://a.example/ ".trim())).toBe("https://a.example")
  })

  it("replaces in place, keeping order", async () => {
    await store.add(server("https://a.example"))
    await store.add(server("https://b.example"))
    await store.replace("https://a.example", { ...server("https://c.example"), label: "renamed" })

    expect((await store.list()).map((s) => s.url)).toEqual(["https://c.example", "https://b.example"])
  })
})
