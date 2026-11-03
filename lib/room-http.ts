import { NextResponse } from "next/server"

import { DatabaseConfigurationError } from "./database"
import { RoomServiceError } from "./room-service"

export class RequestBodyTooLargeError extends Error {
    constructor() {
        super("Request body exceeds the allowed size.")
        this.name = "RequestBodyTooLargeError"
    }
}

export const MAX_ROOM_REQUEST_BODY_BYTES = 8 * 1024

const roomErrorStatus: Record<RoomServiceError["code"], number> = {
    ROOM_NOT_FOUND: 404,
    ROOM_UNAVAILABLE: 409,
    ROOM_FULL: 409,
    NICKNAME_TAKEN: 409,
    UNAUTHORIZED: 401,
    HOST_REQUIRED: 403,
    TOO_FEW_PLAYERS: 409,
    ROOM_CODE_EXHAUSTED: 503,
}

export function invalidRequest(message: string): NextResponse {
    return NextResponse.json({ error: message }, { status: 400 })
}

export function rejectCrossOriginRequest(request: Request): NextResponse | null {
    const origin = request.headers.get("origin")
    if (!origin || origin === "null") {
        return NextResponse.json(
            { error: "A same-origin request is required." },
            { status: 403 }
        )
    }

    try {
        if (new URL(origin).origin === new URL(request.url).origin) return null
    } catch {
        // Invalid Origin values are rejected below.
    }

    return NextResponse.json(
        { error: "A same-origin request is required." },
        { status: 403 }
    )
}

export function rejectNonJsonRequest(request: Request): NextResponse | null {
    const contentType = request.headers.get("content-type")
    if (contentType?.split(";", 1)[0]?.trim().toLowerCase() === "application/json") {
        return null
    }

    return NextResponse.json(
        { error: "Content-Type must be application/json." },
        { status: 415 }
    )
}

export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
    return NextResponse.json(
        { error: "Troppe richieste. Riprova tra poco." },
        {
            status: 429,
            headers: { "Retry-After": String(retryAfterSeconds) },
        }
    )
}

export function getRequestRateLimitKey(request: Request): string {
    const forwardedAddress = request.headers
        .get("x-forwarded-for")
        ?.split(",")
        .at(-1)
        ?.trim()
    const realAddress = request.headers.get("x-real-ip")?.trim()
    const address = forwardedAddress || realAddress || "unknown"
    return `address:${address.slice(0, 128)}`
}

export function roomErrorResponse(error: unknown): NextResponse {
    if (error instanceof RequestBodyTooLargeError) {
        return NextResponse.json(
            { error: "Request body exceeds the allowed size." },
            { status: 413 }
        )
    }

    if (error instanceof RoomServiceError) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: roomErrorStatus[error.code] }
        )
    }

    if (error instanceof DatabaseConfigurationError) {
        return NextResponse.json(
            { error: "Room service is not configured." },
            { status: 503 }
        )
    }

    console.error("Room request failed.", error)
    return NextResponse.json(
        { error: "The room request could not be completed." },
        { status: 500 }
    )
}

export async function readJsonBody(request: Request): Promise<unknown> {
    const contentLength = request.headers.get("content-length")
    if (contentLength !== null) {
        const declaredLength = Number(contentLength)
        if (
            Number.isFinite(declaredLength) &&
            declaredLength > MAX_ROOM_REQUEST_BODY_BYTES
        ) {
            throw new RequestBodyTooLargeError()
        }
    }

    const reader = request.body?.getReader()
    if (!reader) return null

    try {
        const chunks: Uint8Array[] = []
        let totalBytes = 0

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            totalBytes += value.byteLength
            if (totalBytes > MAX_ROOM_REQUEST_BODY_BYTES) {
                try {
                    await reader.cancel()
                } catch {
                    // The stream may already be closed by the request adapter.
                }
                throw new RequestBodyTooLargeError()
            }
            chunks.push(value)
        }

        const body = new Uint8Array(totalBytes)
        let offset = 0
        for (const chunk of chunks) {
            body.set(chunk, offset)
            offset += chunk.byteLength
        }

        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body))
    } catch (error) {
        if (error instanceof RequestBodyTooLargeError) throw error
        return null
    } finally {
        reader.releaseLock()
    }
}
