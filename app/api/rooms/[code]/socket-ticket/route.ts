import { NextResponse } from "next/server"

import {
  createSocketTicket,
  SocketTicketConfigurationError,
} from "@/realtime-server/src/auth/socket-ticket"
import { createFixedWindowRateLimiter } from "@/lib/fixed-window-rate-limiter"
import { RoomCodeSchema } from "@/lib/room-input"
import { getPlayerSessionHash } from "@/lib/player-session"
import {
  invalidRequest,
  rateLimitedResponse,
  roomErrorResponse,
} from "@/lib/room-http"
import { getRoomLobby } from "@/lib/room-service"

export const runtime = "nodejs"

const socketTicketRateLimiter = createFixedWindowRateLimiter({
  limit: 30,
  windowMs: 60 * 1000,
})

interface SocketTicketRouteContext {
  params: Promise<{ code: string }>
}

export async function GET(
  _request: Request,
  context: SocketTicketRouteContext
) {
  const { code: rawCode } = await context.params
  const parsedCode = RoomCodeSchema.safeParse(rawCode)
  if (!parsedCode.success) {
    return invalidRequest("Room code must contain six valid characters.")
  }

  const sessionTokenHash = await getPlayerSessionHash()
  if (!sessionTokenHash) {
    return Response.json(
      { error: "A player session is required." },
      { status: 401 }
    )
  }

  const rateLimit = socketTicketRateLimiter.consume(
    `session:${sessionTokenHash}`
  )
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds)
  }

  try {
    const lobby = await getRoomLobby(parsedCode.data, sessionTokenHash)
    const ticket = await createSocketTicket({
      playerId: lobby.selfPlayerId,
      roomCode: lobby.code,
    })
    return NextResponse.json(
      { ticket },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    if (error instanceof SocketTicketConfigurationError) {
      return NextResponse.json(
        { error: "Realtime authentication is not configured." },
        { status: 503 }
      )
    }
    return roomErrorResponse(error)
  }
}
