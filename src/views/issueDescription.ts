import * as vscode from "vscode"
import { marked } from "marked"
import type {
  ActivityValues,
  Issue,
  IssueActivity,
  IssueAttachment,
  IssueCustomField,
  IssueDetails,
} from "../api/types"
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
    panel.webview.html = page("<main><p>Loading issue…</p></main>")

    if (!client) {
      panel.webview.html = page("<main><p>Select a server to view issue details.</p></main>")
      return
    }

    try {
      const details = await client.getIssueDetails(item.issue.id)
      panel.webview.html = page(renderIssueDetails(details, client.url))
    } catch (error) {
      panel.webview.html = page(`<main><p>Could not load the issue. ${escapeHtml(toUserMessage(error))}</p></main>`)
    }
  }

  private reveal(): vscode.WebviewPanel {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One)
      return this.panel
    }
    this.panel = vscode.window.createWebviewPanel("issueDescription", "Issue Details", vscode.ViewColumn.One, {
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

export function renderIssueDetails(
  { issue, activities, activityError, workItemError, vcsError }: IssueDetails,
  serverUrl: string
): string {
  const code = `${issue.project?.shortName ?? "Issue"}-${issue.numberInProject}`
  const issueUrl = safeUrl(`${serverUrl}/issue/${encodeURIComponent(code)}`)
  const description = issue.wikifiedDescription
    ? sanitizeYouTrackHtml(issue.wikifiedDescription, serverUrl)
    : '<p class="empty">No description available</p>'

  return `<main>
    <header>
      <div class="eyebrow"><a href="${issueUrl}">${escapeHtml(code)}</a>${issue.resolved ? '<span class="badge resolved">Resolved</span>' : '<span class="badge">Open</span>'}</div>
      <h1>${escapeHtml(issue.summary ?? "No summary provided")}</h1>
      <div class="timestamps">${peopleAndDates(issue)}</div>
    </header>
    <section class="details"><h2>Details</h2><dl>${detailFields(issue)}</dl></section>
    <section><h2>Description</h2><div class="rich-text">${description}</div></section>
    ${attachmentSection(issue.attachments, serverUrl)}
    ${linkSection(issue, serverUrl)}
    ${commentSection(issue, serverUrl)}
    ${workItemSection(issue, serverUrl, workItemError)}
    ${changeSection(activities, activityError)}
    ${commitSection(issue, serverUrl, vcsError)}
  </main>`
}

function peopleAndDates(issue: Issue): string {
  const parts = [
    issue.reporter?.fullName ? `Created by ${issue.reporter.fullName}` : undefined,
    issue.created ? fmt.format(issue.created) : undefined,
    issue.updater?.fullName ? `updated by ${issue.updater.fullName}` : undefined,
    issue.updated ? fmt.format(issue.updated) : undefined,
  ]
  return parts.flatMap((part) => (part ? [escapeHtml(part)] : [])).join(" · ")
}

function detailFields(issue: Issue): string {
  const fields = (issue.customFields ?? []).map((field) => detailField(field)).filter(Boolean)
  const standard = [
    issue.project?.name ? detail("Project", issue.project.name) : "",
    issue.votes !== undefined ? detail("Votes", String(issue.votes)) : "",
    issue.tags?.length
      ? detail(
          "Tags",
          issue.tags
            .map((tag) => tag.name)
            .filter(Boolean)
            .join(", ")
        )
      : "",
  ]
  return [...standard, ...fields].join("") || '<div class="empty">No fields available</div>'
}

function detailField(field: IssueCustomField): string {
  if (!field.name) return ""
  const values = Array.isArray(field.value) ? field.value : field.value ? [field.value] : []
  const value = values
    .map((item) => item.name ?? item.fullName ?? item.login)
    .filter(Boolean)
    .join(", ")
  return detail(field.name, value || "None")
}

function detail(name: string, value: string): string {
  return `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`
}

function attachmentSection(attachments: IssueAttachment[] | undefined, serverUrl: string): string {
  if (!attachments?.length) return section("Attachments", '<p class="empty">No attachments</p>')
  const content = `<ul class="files">${attachments
    .map((attachment) => {
      const url = attachment.url ? safeUrl(new URL(attachment.url, `${serverUrl}/`).toString()) : "#"
      const meta = [formatBytes(attachment.size), attachment.mimeType, attachment.author?.fullName]
        .filter(Boolean)
        .join(" · ")
      return `<li><a href="${url}">${escapeHtml(attachment.name)}</a>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}</li>`
    })
    .join("")}</ul>`
  return section(`Attachments <span>${attachments.length}</span>`, content)
}

function linkSection(issue: Issue, serverUrl: string): string {
  const links = (issue.links ?? []).flatMap((link) =>
    (link.issues ?? []).map((linked) => {
      const code = `${linked.project?.shortName ?? "Issue"}-${linked.numberInProject}`
      const relation = link.direction === "OUTWARD" ? link.linkType?.sourceToTarget : link.linkType?.targetToSource
      return `<li><span>${escapeHtml(relation ?? link.linkType?.name ?? "relates to")}</span><a href="${safeUrl(`${serverUrl}/issue/${encodeURIComponent(code)}`)}">${escapeHtml(code)} ${escapeHtml(linked.summary ?? "")}</a></li>`
    })
  )
  return links.length ? section("Linked issues", `<ul class="links">${links.join("")}</ul>`) : ""
}

function commentSection(issue: Issue, serverUrl: string): string {
  const comments = (issue.comments ?? []).filter((comment) => !comment.deleted)
  if (!comments.length) return section("Comments", '<p class="empty">No comments</p>')
  const content = comments
    .map((comment) => {
      const text = comment.text
        ? renderMarkdown(comment.text, serverUrl)
        : sanitizeYouTrackHtml(comment.wikifiedText ?? "", serverUrl)
      const attachments = comment.attachments?.length
        ? `<div class="comment-files">${comment.attachments.map((file) => attachmentLink(file, serverUrl)).join(" · ")}</div>`
        : ""
      return `<article class="event"><div class="avatar">${initials(comment.author?.fullName)}</div><div><div class="event-head"><strong>${escapeHtml(comment.author?.fullName ?? "Unknown user")}</strong><time>${formatDate(comment.created)}</time></div><div class="rich-text">${text}</div>${attachments}</div></article>`
    })
    .join("")
  return section(`Comments <span>${comments.length}</span>`, content)
}

function changeSection(activities: IssueActivity[], activityError?: unknown): string {
  if (activityError)
    return section("History", '<p class="empty">History is unavailable for this account or server.</p>')
  if (!activities.length) return section("History", '<p class="empty">No recorded changes</p>')
  const content = [...activities]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .map((activity) => {
      const field = activity.field?.name ?? activity.category?.name ?? "Issue"
      const removed = activityValues(activity.removed)
      const added = activityValues(activity.added)
      const change =
        removed && added
          ? `${removed} → ${added}`
          : added
            ? `set to ${added}`
            : removed
              ? `removed ${removed}`
              : "changed"
      return `<article class="history"><time>${formatDate(activity.timestamp)}</time><div><strong>${escapeHtml(activity.author?.fullName ?? "YouTrack")}</strong> changed <b>${escapeHtml(field)}</b> <span>${escapeHtml(change)}</span></div></article>`
    })
    .join("")
  return section(`History <span>${activities.length}</span>`, content)
}

function workItemSection(issue: Issue, serverUrl: string, workItemError?: unknown): string {
  if (workItemError)
    return section("Time spent", '<p class="empty">Time tracking is unavailable for this account or server.</p>')
  const workItems = issue.workItems ?? []
  if (!workItems.length) return section("Time spent", '<p class="empty">No time logged</p>')
  const totalMinutes = workItems.reduce((total, item) => total + (item.duration?.minutes ?? 0), 0)
  const content = workItems
    .map((item) => {
      const author = item.author?.fullName ?? item.author?.login ?? "Unknown user"
      const duration = item.duration?.presentation ?? formatDuration(item.duration?.minutes ?? 0)
      const kind = item.type?.name ? `<span class="work-type">${escapeHtml(item.type.name)}</span>` : ""
      const text = item.textPreview
        ? sanitizeYouTrackHtml(item.textPreview, serverUrl)
        : item.text
          ? `<p>${escapeHtml(item.text)}</p>`
          : ""
      return `<article class="work-item"><div class="event-head"><div><strong>${escapeHtml(duration)}</strong> ${kind} by ${escapeHtml(author)}</div><time>${formatDate(item.date)}</time></div>${text ? `<div class="rich-text">${text}</div>` : ""}</article>`
    })
    .join("")
  return section(
    `Time spent <span>${workItems.length}</span>`,
    `<p class="total-time">Total: <strong>${escapeHtml(formatDuration(totalMinutes))}</strong></p>${content}`
  )
}

function commitSection(issue: Issue, serverUrl: string, vcsError?: unknown): string {
  if (vcsError)
    return section("Commits", '<p class="empty">VCS changes are unavailable for this account or server.</p>')
  const commits = issue.vcsChanges ?? []
  if (!commits.length) return section("Commits", '<p class="empty">No commits linked</p>')
  const content = commits
    .map((commit) => {
      const links = (commit.urls ?? [])
        .map(
          (url, index) =>
            `<a href="${safeUrl(new URL(url, `${serverUrl}/`).toString())}">${index ? `Link ${index + 1}` : "Open commit"}</a>`
        )
        .join(" · ")
      const author = commit.author?.fullName ?? commit.author?.name ?? commit.author?.login ?? "Unknown author"
      const version = commit.version ? `<code>${escapeHtml(commit.version.slice(0, 12))}</code>` : ""
      const kind = commit.$type === "PullRequest" ? "Pull request" : "Commit"
      const files = commit.files !== undefined && commit.files >= 0 ? `${commit.files} files` : undefined
      const meta = [kind, files].filter(Boolean).join(" · ")
      return `<article class="commit"><div><strong>${escapeHtml(author)}</strong><time>${formatDate(commit.date)}</time></div><div class="commit-meta">${version}<span>${escapeHtml(meta)}</span></div><pre>${escapeHtml(commit.text ?? kind)}</pre>${links}</article>`
    })
    .join("")
  return section(`Commits <span>${commits.length}</span>`, content)
}

function section(title: string, content: string): string {
  return `<section><h2>${title}</h2>${content}</section>`
}

function attachmentLink(file: IssueAttachment, serverUrl: string): string {
  const url = file.url ? safeUrl(new URL(file.url, `${serverUrl}/`).toString()) : "#"
  return `<a href="${url}">${escapeHtml(file.name)}</a>`
}

function activityValues(values?: ActivityValues): string {
  const items = values === undefined || values === null ? [] : Array.isArray(values) ? values : [values]
  return items
    .map((value) =>
      typeof value === "object" ? (value.name ?? value.text ?? value.fullName ?? value.login) : String(value)
    )
    .filter(Boolean)
    .join(", ")
}

function initials(name?: string): string {
  return escapeHtml(
    (name ?? "?")
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
  )
}

function formatDate(value?: number): string {
  return value ? escapeHtml(fmt.format(value)) : ""
}

function formatBytes(value?: number): string | undefined {
  if (value === undefined) return undefined
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return [hours ? `${hours}h` : "", remainder ? `${remainder}m` : ""].filter(Boolean).join(" ") || "0m"
}

function sanitizeYouTrackHtml(html: string, serverUrl: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form)[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*(["'])\s*(?:javascript|vbscript):[\s\S]*?\2/gi, "")
    .replace(/\shref\s*=\s*(["'])(.*?)\1/gi, (_match, _quote: string, href: string) => {
      try {
        return ` href="${safeUrl(new URL(href, `${serverUrl}/`).toString())}"`
      } catch {
        return ' href="#"'
      }
    })
}

function renderMarkdown(markdown: string, serverUrl: string): string {
  return sanitizeYouTrackHtml(marked.parse(markdown, { async: false }), serverUrl)
}

function safeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? escapeHtml(parsed.toString()) : "#"
  } catch {
    return "#"
  }
}

function page(content: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline';">
<style>
:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;color:var(--vscode-foreground);font-family:var(--vscode-font-family);font-size:13px;background:var(--vscode-editor-background)}main{max-width:1000px;margin:auto;padding:28px 32px 64px}header{padding-bottom:24px;border-bottom:1px solid var(--vscode-panel-border)}h1{font-size:28px;line-height:1.25;margin:9px 0 12px}h2{font-size:16px;margin:0 0 16px;display:flex;gap:7px;align-items:center}h2 span{font-size:11px;font-weight:400;color:var(--vscode-descriptionForeground);background:var(--vscode-badge-background);padding:1px 6px;border-radius:10px}section{padding:24px 0;border-bottom:1px solid var(--vscode-panel-border)}a{color:var(--vscode-textLink-foreground);text-decoration:none}a:hover{text-decoration:underline}.eyebrow{display:flex;align-items:center;gap:9px;font-weight:600}.badge{font-size:11px;padding:2px 7px;border-radius:10px;color:var(--vscode-badge-foreground);background:var(--vscode-badge-background)}.badge.resolved{background:var(--vscode-testing-iconPassed);color:var(--vscode-editor-background)}.timestamps,.empty,small,time{color:var(--vscode-descriptionForeground)}dl{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:18px 28px;margin:0}dl div{min-width:0}dt{font-size:11px;color:var(--vscode-descriptionForeground);margin-bottom:4px}dd{margin:0;overflow-wrap:anywhere}.rich-text{line-height:1.55;overflow-wrap:anywhere}.rich-text>:first-child{margin-top:0}.rich-text>:last-child{margin-bottom:0}.rich-text pre,.commit pre{padding:12px;overflow:auto;background:var(--vscode-textCodeBlock-background);border-radius:4px}.rich-text img{max-width:100%;height:auto}.files,.links{list-style:none;padding:0;margin:0}.files li{display:flex;flex-direction:column;gap:3px;padding:8px 0}.links li{display:grid;grid-template-columns:minmax(100px,180px) 1fr;gap:16px;padding:5px 0}.links span{color:var(--vscode-descriptionForeground)}.event{display:grid;grid-template-columns:32px 1fr;gap:12px;padding:16px 0}.event+.event{border-top:1px solid var(--vscode-panel-border)}.avatar{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:600;color:var(--vscode-badge-foreground);background:var(--vscode-badge-background)}.event-head,.commit>div{display:flex;justify-content:space-between;gap:12px;margin-bottom:7px}.comment-files{margin-top:8px}.history{display:grid;grid-template-columns:145px 1fr;gap:18px;padding:6px 0}.history span{color:var(--vscode-descriptionForeground)}.work-item,.commit{padding:12px 0}.work-item+.work-item,.commit+.commit{border-top:1px solid var(--vscode-panel-border)}.work-type,.commit-meta span{color:var(--vscode-descriptionForeground)}.total-time{margin-top:0}.commit-meta{display:flex;align-items:center;gap:8px}.commit-meta code{font-family:var(--vscode-editor-font-family);background:var(--vscode-textCodeBlock-background);padding:2px 5px;border-radius:3px}
@media(max-width:650px){main{padding:20px 16px 48px}dl{grid-template-columns:repeat(2,minmax(120px,1fr))}.history{grid-template-columns:1fr;gap:3px}.links li{grid-template-columns:1fr;gap:2px}}
</style></head><body>${content}</body></html>`
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
