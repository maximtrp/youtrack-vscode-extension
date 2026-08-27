import { AxiosError, AxiosHeaders } from "axios"
import { describe, expect, it } from "vitest"
import { toUserMessage } from "./errors"

const axiosError = (status: number, data: unknown) => {
  const error = new AxiosError("Request failed")
  error.response = {
    status,
    statusText: "",
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe("toUserMessage", () => {
  it("uses the YouTrack error body", () => {
    const error = axiosError(400, { error: "invalid_query", error_description: "Can't parse search query" })
    expect(toUserMessage(error)).toBe("400: invalid_query. Can't parse search query")
  })

  it("falls back to the status when the body is not a YouTrack error", () => {
    expect(toUserMessage(axiosError(502, "<html>gateway</html>"))).toBe("502: Request failed")
  })

  it("reports network failures without a response", () => {
    expect(toUserMessage(new AxiosError("Network Error"))).toBe("Network Error")
  })

  it("handles plain errors and non-errors", () => {
    expect(toUserMessage(new Error("boom"))).toBe("boom")
    expect(toUserMessage("boom")).toBe("boom")
  })
})
