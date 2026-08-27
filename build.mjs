import * as esbuild from "esbuild"
import { fileURLToPath } from "node:url"

const watch = process.argv.includes("--watch")
const production = process.argv.includes("--production")

const webAgentPlugin = {
  name: "web-https-agent",
  setup(build) {
    build.onResolve({ filter: /httpAgent\.node$/ }, () => ({
      path: fileURLToPath(new URL("src/api/httpAgent.web.ts", import.meta.url)),
    }))
  },
}

const problemMatcherPlugin = {
  name: "problem-matcher",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"))
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`)
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`)
        }
      }
      console.log("[watch] build finished")
    })
  },
}

const shared = {
  bundle: true,
  external: ["vscode"],
  format: "cjs",
  minify: production,
  sourcemap: production ? "external" : true,
  sourcesContent: false,
  logLevel: "warning",
  plugins: watch ? [problemMatcherPlugin] : [],
}

const targets = [
  {
    ...shared,
    entryPoints: ["src/extension.ts"],
    outfile: "out/extension.js",
    platform: "node",
    target: "node18",
  },
  {
    ...shared,
    entryPoints: ["src/extension.ts"],
    outfile: "out/webExtension.js",
    platform: "browser",
    target: "es2020",
    mainFields: ["browser", "module", "main"],
    plugins: [webAgentPlugin, ...shared.plugins],
  },
]

if (watch) {
  const contexts = await Promise.all(targets.map((options) => esbuild.context(options)))
  await Promise.all(contexts.map((context) => context.watch()))
} else {
  await Promise.all(targets.map((options) => esbuild.build(options)))
}
