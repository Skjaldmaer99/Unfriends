import { RoomCodeSchema } from "@/lib/room-input"
import { getPlayerSessionHash } from "@/lib/player-session"
import { invalidRequest, roomErrorResponse } from "@/lib/room-http"
import { startRoom } from "@/lib/room-service"

export const runtime = "nodejs"

interface StartRoomRouteContext {
  params: Promise<{ code: string }>
}

export async function POST(_request: Request, context: StartRoomRouteContext) {
  const { code: rawCode } = await context.params
  const parsedCode = RoomCodeSchema.safeParse(rawCode)
  if (!parsedCode.success) {
    return invalidRequest("Room code must contain six valid characters.")
  }

  const sessionTokenHash = await getPlayerSessionHash()
  if (!sessionTokenHash) {
    return Response.json({ error: "A player session is required." }, { status: 401 })
  }

  try {
    await startRoom(parsedCode.data, sessionTokenHash)
    return Response.json({ status: "in_progress" })
  } catch (error) {
    return roomErrorResponse(error)
  }
}