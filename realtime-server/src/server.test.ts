import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { io as createSocketClient } from "socket.io-client"

import { createRealtimeServer } from "./server.js"

process.env.SOCKET_TICKET_SECRET = "test-secret-with-at-least-32-characters"

const allowedOrigin = "http://localhost:3000"
const { httpServer, io } = createRealtimeServer({
    allowedOrigins: [allowedOrigin],
})

before(async () => {
    await new Promise<void>((resolve, reject) => {
        httpServer.once("error", reject)
        httpServer.listen(0, "127.0.0.1", resolve)
    })
})

after(async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()))
})

describe("realtime server", () => {
    it("serves a process health check", async () => {
        const address = httpServer.address()
        assert.ok(address && typeof address !== "string")

        const response = await fetch(`http://127.0.0.1:${address.port}/healthz`)
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), { status: "ok" })
    })

    it("rejects a socket handshake with an invalid ticket", async () => {
        const address = httpServer.address()
        assert.ok(address && typeof address !== "string")

        const socket = createSocketClient(`http://127.0.0.1:${address.port}`, {
            auth: { ticket: "invalid-ticket" },
            extraHeaders: { origin: allowedOrigin },
            reconnection: false,
            timeout: 3_000,
            transports: ["websocket"],
        })

        try {
            const error = await new Promise<Error>((resolve, reject) => {
                socket.once("connect_error", resolve)
                socket.once("connect", () =>
                    reject(new Error("Invalid ticket connected."))
                )
            })
            assert.match(error.message, /invalid or expired/)
        } finally {
            socket.disconnect()
        }
    })

    it("rejects socket handshakes from an unlisted origin", async () => {
        const address = httpServer.address()
        assert.ok(address && typeof address !== "string")

        const socket = createSocketClient(`http://127.0.0.1:${address.port}`, {
            auth: { ticket: "not-read-before-origin-check" },
            extraHeaders: { origin: "http://attacker.localhost:3000" },
            reconnection: false,
            timeout: 3_000,
            transports: ["websocket"],
        })

        try {
            await new Promise<void>((resolve, reject) => {
                socket.once("connect_error", () => resolve())
                socket.once("connect", () =>
                    reject(new Error("A socket from an unlisted origin connected."))
                )
            })
        } finally {
            socket.disconnect()
        }
    })
})
