import { RoomCodeSchema } from "@/lib/room-input"
import { getPlayerSessionHash } from "@/lib/player-session"
import { invalidRequest, roomErrorResponse } from "@/lib/room-http"
import { getRoomLobby } from "@/lib/room-service"

export const runtime = "nodejs"

interface RoomRouteContext {
  params: Promise<{ code: string }>
}

export async function GET(_request: Request, context: RoomRouteContext) {
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

  try {
    const lobby = await getRoomLobby(parsedCode.data, sessionTokenHash)
    return Response.json(lobby, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return roomErrorResponse(error)
  }
}
