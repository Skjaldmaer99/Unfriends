import { NextResponse } from "next/server"

import { DatabaseConfigurationError } from "./database"
import { RoomServiceError } from "./room-service"

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

export function roomErrorResponse(error: unknown): NextResponse {
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
  try {
    return await request.json()
  } catch {
    return null
  }
}
