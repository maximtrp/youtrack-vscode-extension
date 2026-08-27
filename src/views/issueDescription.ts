import * as vscode from "vscode"
import { YoutrackClient } from "../api/youtrackClient"
import { toUserMessage } from "../domain/errors"
import type { IssueItem } from "./items"

const fmt = new Intl.DateTimeFormat("default", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric",
})

export class IssueDescriptionPanel {
  private panel?: vscode.WebviewPanel

  async show(item: IssueItem, client?: YoutrackClient): Promise<void> {
    const panel = this.reveal()
    panel.title = item.code
    panel.webview.html = page("Loading…")

    if (!client) {
      panel.webview.html = page("<p>Select a server to view issue descriptions.</p>")
      return
    }

    try {
      const { wikifiedDescription } = await client.getIssueDescription(item.issue.id)
      panel.webview.html = page(body(item, wikifiedDescription))
    } catch (error) {
      panel.webview.html = page(`<p>Could not load the description. ${escapeHtml(toUserMessage(error))}</p>`)
    }
  }

  private reveal(): vscode.WebviewPanel {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One)
      return this.panel
    }
    this.panel = vscode.window.createWebviewPanel("issueDescription", "Issue Description", vscode.ViewColumn.One, {
      enableScripts: false,
      localResourceRoots: [],
    })
    this.panel.onDidDispose(() => {
      this.panel = undefined
    })
    return this.panel
  }

  dispose(): void {
    this.panel?.dispose()
  }
}

function body(item: IssueItem, description?: string): string {
  const { issue } = item
  const created = [
    issue.reporter ? `Created by ${issue.reporter.fullName}` : "",
    issue.created ? `on ${fmt.format(issue.created)}` : "",
  ]
    .filter(Boolean)
    .join(" ")
  const updated = [
    issue.updater ? `Updated by ${issue.updater.fullName}` : "",
    issue.updated ? `on ${fmt.format(issue.updated)}` : "",
  ]
    .filter(Boolean)
    .join(" ")

  return [
    `<h1>${escapeHtml(String(item.label))}</h1>`,
    created ? `<p>${escapeHtml(created)}</p>` : "",
    updated ? `<p>${escapeHtml(updated)}</p>` : "",
    `<h2>Description</h2>`,
    description || "<p>No description available</p>",
  ].join("")
}

function page(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline';">
<style>body { font-family: var(--vscode-font-family); padding: 0 1rem; }</style>
</head>
<body>${content}</body>
</html>`
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
