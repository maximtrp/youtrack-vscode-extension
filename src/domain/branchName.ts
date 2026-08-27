export interface BranchNameParts {
  code: string
  summary: string
}

export function buildBranchName(template: string, { code, summary }: BranchNameParts): string {
  return template
    .replace(/\$\{issue\.id\}/g, code)
    .replace(/\$\{issue\.summary\}/g, summary)
    .replace(/[^a-zA-Z0-9-_/]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}
