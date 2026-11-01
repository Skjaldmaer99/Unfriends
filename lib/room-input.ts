import { z } from "zod"

export const PlayerIdentitySchema = z.object({
  nickname: z.string().trim().min(1).max(24),
  avatar: z.string().trim().regex(/^[a-z0-9-]{1,32}$/).default("sun"),
})

export const JoinRoomSchema = PlayerIdentitySchema.extend({
  code: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/),
})

export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/)

export type PlayerIdentity = z.infer<typeof PlayerIdentitySchema>
export type JoinRoomInput = z.infer<typeof JoinRoomSchema>