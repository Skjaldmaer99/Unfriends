import { NextResponse } from "next/server"

import { createFixedWindowRateLimiter } from "@/lib/fixed-window-rate-limiter"
import { createRoom } from "@/lib/room-service"
import { PlayerIdentitySchema } from "@/lib/room-input"
import {
  createPlayerSessionToken,
  hashPlayerSessionToken,
  setPlayerSessionCookie,
} from "@/lib/player-session"
import {
  invalidRequest,
  getRequestRateLimitKey,
  rateLimitedResponse,
  roomErrorResponse,
  readJsonBody,
} from "@/lib/room-http"

export const runtime = "nodejs"

const roomCreationRateLimiter = createFixedWindowRateLimiter({
  limit: 6,
  windowMs: 10 * 60 * 1000,
})

export async function POST(request: Request) {
  const rateLimit = roomCreationRateLimiter.consume(
    getRequestRateLimitKey(request)
  )
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds)
  }

  let body: unknown
  try {
    body = await readJsonBody(request)
  } catch (error) {
    return roomErrorResponse(error)
  }

  const parsed = PlayerIdentitySchema.safeParse(body)
  if (!parsed.success) {
    return invalidRequest(
      parsed.error.issues[0]?.message ?? "Invalid player details."
    )
  }

  const sessionToken = createPlayerSessionToken()

  try {
    const room = await createRoom(
      parsed.data,
      hashPlayerSessionToken(sessionToken)
    )
    const response = NextResponse.json(room, { status: 201 })
    setPlayerSessionCookie(response, sessionToken)
    return response
  } catch (error) {
    return roomErrorResponse(error)
  }
}
