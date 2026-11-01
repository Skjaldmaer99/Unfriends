import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  getRequestRateLimitKey,
  MAX_ROOM_REQUEST_BODY_BYTES,
  rateLimitedResponse,
  readJsonBody,
  roomErrorResponse,
  RequestBodyTooLargeError,
} from "./room-http.js"

describe("room HTTP request protections", () => {
  it("parses small JSON request bodies", async () => {
    const request = new Request("http://localhost/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: "Ada" }),
    })

    assert.deepEqual(await readJsonBody(request), { nickname: "Ada" })
  })

  it("rejects oversized bodies before parsing", async () => {
    const request = new Request("http://localhost/api/rooms", {
      method: "POST",
      body: "x".repeat(MAX_ROOM_REQUEST_BODY_BYTES + 1),
    })

    await assert.rejects(readJsonBody(request), RequestBodyTooLargeError)
    assert.equal(roomErrorResponse(new RequestBodyTooLargeError()).status, 413)
  })

  it("uses the last forwarded address and returns retry metadata", () => {
    const request = new Request("http://localhost/api/rooms", {
      headers: { "x-forwarded-for": "spoofed, trusted-proxy-client" },
    })
    assert.equal(
      getRequestRateLimitKey(request),
      "address:trusted-proxy-client"
    )

    const response = rateLimitedResponse(7)
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("retry-after"), "7")
  })
})
