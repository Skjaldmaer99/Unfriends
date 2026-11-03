import { NextResponse } from "next/server"

import { createFixedWindowRateLimiter } from "@/lib/fixed-window-rate-limiter"
import { JoinRoomSchema } from "@/lib/room-input"
import {
    createPlayerSessionToken,
    hashPlayerSessionToken,
    setPlayerSessionCookie,
} from "@/lib/player-session"
import {
    invalidRequest,
    getRequestRateLimitKey,
    rejectCrossOriginRequest,
    rejectNonJsonRequest,
    rateLimitedResponse,
    readJsonBody,
    roomErrorResponse,
} from "@/lib/room-http"
import { joinRoom } from "@/lib/room-service"

export const runtime = "nodejs"

const roomJoinRateLimiter = createFixedWindowRateLimiter({
    limit: 20,
    windowMs: 60 * 1000,
})

interface JoinRoomRouteContext {
    params: Promise<{ code: string }>
}

export async function POST(request: Request, context: JoinRoomRouteContext) {
    const originFailure = rejectCrossOriginRequest(request)
    if (originFailure) return originFailure
    const contentTypeFailure = rejectNonJsonRequest(request)
    if (contentTypeFailure) return contentTypeFailure

    const { code } = await context.params
    const rateLimit = roomJoinRateLimiter.consume(getRequestRateLimitKey(request))
    if (!rateLimit.allowed) {
        return rateLimitedResponse(rateLimit.retryAfterSeconds)
    }

    let body: unknown
    try {
        body = await readJsonBody(request)
    } catch (error) {
        return roomErrorResponse(error)
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return invalidRequest("Player details must be sent as a JSON object.")
    }

    const parsed = JoinRoomSchema.safeParse({
        ...body,
        code,
    })
    if (!parsed.success) {
        return invalidRequest(
            parsed.error.issues[0]?.message ?? "Invalid player details."
        )
    }

    const sessionToken = createPlayerSessionToken()

    try {
        const room = await joinRoom(
            parsed.data,
            hashPlayerSessionToken(sessionToken)
        )
        const response = NextResponse.json(room, { status: 200 })
        setPlayerSessionCookie(response, sessionToken)
        return response
    } catch (error) {
        return roomErrorResponse(error)
    }
}
