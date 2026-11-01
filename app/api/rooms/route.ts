import { NextResponse } from "next/server"

import { createRoom } from "@/lib/room-service"
import { PlayerIdentitySchema } from "@/lib/room-input"
import {
  createPlayerSessionToken,
  hashPlayerSessionToken,
  setPlayerSessionCookie,
} from "@/lib/player-session"
import { invalidRequest, readJsonBody, roomErrorResponse } from "@/lib/room-http"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const parsed = PlayerIdentitySchema.safeParse(await readJsonBody(request))
  if (!parsed.success) {
    return invalidRequest(parsed.error.issues[0]?.message ?? "Invalid player details.")
  }

  const sessionToken = createPlayerSessionToken()

  try {
    const room = await createRoom(
      parsed.data,
      hashPlayerSessionToken(sessionToken),
    )
    const response = NextResponse.json(room, { status: 201 })
    setPlayerSessionCookie(response, sessionToken)
    return response
  } catch (error) {
    return roomErrorResponse(error)
  }
}