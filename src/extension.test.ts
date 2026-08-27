import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { activate, deactivate } from "./extension"
import { recorder } from "./test/vscodeStub"

interface Manifest {
  contributes: {
    commands: { command: string }[]
    views: Record<string, { id: string }[]>
    configuration: { properties: Record<string, { default: unknown }> }[]
  }
}

const manifest: Manifest = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"))

const declaredCommands = manifest.contributes.commands.map((command) => command.command)
const declaredViews = manifest.contributes.views["youtrack-container"].map((view) => view.id)

function activateExtension() {
  recorder.reset()
  const subscriptions: { dispose(): void }[] = []
  activate({
    subscriptions,
    secrets: { get: () => Promise.resolve(undefined), store: () => Promise.resolve() },
  } as never)
  return subscriptions
}

describe("extension manifest", () => {
  it("registers a handler for every declared command", () => {
    activateExtension()
    expect([...recorder.commands].sort()).toEqual([...declaredCommands].sort())
  })

  it("creates a tree view for every declared view", () => {
    activateExtension()
    expect([...recorder.treeViews].sort()).toEqual([...declaredViews].sort())
  })

  it("agrees with the code on every setting and its default", async () => {
    const { DEFAULTS } = await import("./config/settings")
    const declared = manifest.contributes.configuration[0].properties

    for (const [key, value] of Object.entries(DEFAULTS)) {
      const property = declared[`youtrack.${key}`]
      expect(property, `youtrack.${key} is read by the code but not declared in package.json`).toBeDefined()
      expect(property.default, `youtrack.${key} default differs between package.json and settings.ts`).toEqual(value)
    }

    const undeclaredInCode = Object.keys(declared).filter((key) => !(key.slice("youtrack.".length) in DEFAULTS))
    expect(undeclaredInCode, "settings declared in package.json that the code never reads").toEqual([])
  })

  it("disposes everything it registers", () => {
    const subscriptions = activateExtension()
    expect(subscriptions.length).toBe(declaredCommands.length + declaredViews.length + 1)
    expect(() => deactivate()).not.toThrow()
  })
})
