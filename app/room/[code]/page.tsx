import { RoomLanding } from "@/components/room/room-landing"

interface RoomPageProps {
  params: Promise<{ code: string }>
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params
  return <RoomLanding code={code} />
}
