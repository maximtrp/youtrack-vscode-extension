import axios from "axios"

interface YoutrackErrorBody {
  error?: string
  error_description?: string
}

export function toUserMessage(error: unknown): string {
  if (axios.isAxiosError<YoutrackErrorBody>(error)) {
    const response = error.response
    if (!response) {
      return error.message
    }
    const body = typeof response.data === "object" ? response.data : undefined
    const details = [body?.error, body?.error_description].filter(Boolean).join(". ")
    return details ? `${response.status}: ${details}` : `${response.status}: ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
}
