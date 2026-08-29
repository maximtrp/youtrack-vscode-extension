import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const read = (name: string): Record<string, unknown> => JSON.parse(readFileSync(resolve(process.cwd(), name), "utf8"))

describe("formatter configuration", () => {
  it("keeps .prettierrc in step with .oxfmtrc.json", () => {
    const prettier = read(".prettierrc")
    const oxfmt = read(".oxfmtrc.json")

    for (const [option, value] of Object.entries(prettier)) {
      expect(oxfmt[option], `${option} differs between .prettierrc and .oxfmtrc.json`).toEqual(value)
    }
  })
})
