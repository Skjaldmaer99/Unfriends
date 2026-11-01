import { GameScreen } from "@/components/game/game-screen"

interface GamePageProps {
  params: Promise<{ code: string }>
}

export default async function GamePage({ params }: GamePageProps) {
  const { code } = await params
  return <GameScreen code={code} />
}
