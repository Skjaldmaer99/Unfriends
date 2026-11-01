import { NextResponse } from "next/server"

import { JoinRoomSchema } from "@/lib/room-input"
import { createPlayerSessionToken, hashPlayerSessionToken, setPlayerSessionCookie } from "@/lib/player-session"
import { invalidRequest, readJsonBody, roomErrorResponse } from "@/lib/room-http"
import { joinRoom } from "@/lib/room-service"

export const runtime = "nodejs"

interface JoinRoomRouteContext {
  params: Promise<{ code: string }>
}

export async function POST(request: Request, context: JoinRoomRouteContext) {
  const { code } = await context.params
  const parsed = JoinRoomSchema.safeParse({
    ...(await readJsonBody(request) as Record<string, unknown> | null),
    code,
  })
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid player details.")
  }

  const sessionToken = createPlayerSessionToken()

  try {
    const room = await joinRoom(parsed.data, hashPlayerSessionToken(sessionToken))
    const response = NextResponse.json(room, { status: 200 })
    setPlayerSessionCookie(response, sessionToken)
    return response
  } catch (error) {
    return roomErrorResponse(error)
  }
}