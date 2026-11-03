import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
    getRequestRateLimitKey,
    MAX_ROOM_REQUEST_BODY_BYTES,
    rateLimitedResponse,
    rejectCrossOriginRequest,
    rejectNonJsonRequest,
    readJsonBody,
    roomErrorResponse,
    RequestBodyTooLargeError,
} from "./room-http.js"

describe("room HTTP request protections", () => {
    it("requires an exact same-origin header for state-changing requests", () => {
        const sameOrigin = new Request("https://game.example/api/rooms", {
            method: "POST",
            headers: { origin: "https://game.example" },
        })
        const crossOrigin = new Request("https://game.example/api/rooms", {
            method: "POST",
            headers: { origin: "https://attacker.game.example" },
        })
        const opaqueOrigin = new Request("https://game.example/api/rooms", {
            method: "POST",
            headers: { origin: "null" },
        })
        const missingOrigin = new Request("https://game.example/api/rooms", {
            method: "POST",
        })

        assert.equal(rejectCrossOriginRequest(sameOrigin), null)
        assert.equal(rejectCrossOriginRequest(crossOrigin)?.status, 403)
        assert.equal(rejectCrossOriginRequest(opaqueOrigin)?.status, 403)
        assert.equal(rejectCrossOriginRequest(missingOrigin)?.status, 403)
    })

    it("rejects non-JSON content types on JSON room endpoints", () => {
        const jsonRequest = new Request("https://game.example/api/rooms", {
            method: "POST",
            headers: { "content-type": "application/json; charset=utf-8" },
        })
        const textRequest = new Request("https://game.example/api/rooms", {
            method: "POST",
            headers: { "content-type": "text/plain" },
        })

        assert.equal(rejectNonJsonRequest(jsonRequest), null)
        assert.equal(rejectNonJsonRequest(textRequest)?.status, 415)
    })

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
