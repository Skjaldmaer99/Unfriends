"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Wifi, WifiOff } from "lucide-react"

import { useRoomLobby } from "@/components/room/use-room-lobby"
import { AnswerForm } from "@/components/game/answer-form"
import { AnswerReveal } from "@/components/game/answer-reveal"
import { FinalGameSummary } from "@/components/game/final-game-summary"
import { GameHeader } from "@/components/game/game-header"
import { QuestionCard } from "@/components/game/question-card"
import { RoundResult } from "@/components/game/round-result"
import { WaitingPlayers } from "@/components/game/waiting-players"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { toast } from "@/components/ui/sonner"

function GameScreen({ code }: { code: string }) {
  const router = useRouter()
  const game = useRoomLobby(code)
  const view = game.gameView
  const playerId = game.room?.selfPlayerId
  const currentPlayer = game.room?.players.find(
    (player) => player.id === playerId
  )
  const isHost = currentPlayer?.isHost ?? false
  const isProtagonist = Boolean(
    view && playerId && view.currentRound.protagonistId === playerId
  )

  useEffect(() => {
    if (!game.isLoading && game.room?.status === "waiting") {
      router.replace(`/room/${encodeURIComponent(code)}`)
    }
  }, [code, game.isLoading, game.room?.status, router])

  useEffect(() => {
    if (game.error) toast.error(game.error)
  }, [game.error])

  if (game.isLoading || (!view && !game.error)) {
    return <LoadingState label="Rientro nella partita…" fullHeight />
  }

  if (game.error || !game.room || !view || !playerId) {
    return (
      <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center px-5 py-10">
        <p className="text-xs font-bold text-brand-coral uppercase">
          Partita non disponibile
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold">
          Non riusciamo a rientrare
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {game.error ||
            "Controlla la connessione e prova a rientrare nella stanza."}
        </p>
        <Button
          className="mt-6 w-fit"
          onPress={() => router.push(`/room/${encodeURIComponent(code)}`)}
        >
          <ArrowLeft aria-hidden="true" />
          Torna alla stanza
        </Button>
      </main>
    )
  }

  if (view.currentRound.phase === "finished" && game.gameSummary) {
    return (
      <FinalGameSummary
        view={view}
        summary={game.gameSummary}
        isHost={isHost}
        isReplaying={game.isReplaying}
        onReplay={game.replayGame}
        onHome={() => router.push("/")}
      />
    )
  }

  const phase = view.currentRound.phase
  const showAnswerForm =
    !view.currentRound.hasSubmittedAnswer &&
    (phase === "protagonist_answer"
      ? isProtagonist
      : phase === "players_answer" && !isProtagonist)
  const showWaiting =
    (phase === "protagonist_answer" && !isProtagonist) ||
    (phase === "players_answer" && !showAnswerForm)

  return (
    <main className="min-h-svh px-4 py-4 sm:px-8 sm:py-7">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button
            size="sm"
            variant="ghost"
            onPress={() => router.push(`/room/${encodeURIComponent(code)}`)}
          >
            <ArrowLeft aria-hidden="true" />
            Stanza
          </Button>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${game.isConnected ? "text-brand-teal" : "text-muted-foreground"}`}
          >
            {game.isConnected ? (
              <Wifi aria-hidden="true" className="size-4" />
            ) : (
              <WifiOff aria-hidden="true" className="size-4" />
            )}
            {game.isConnected ? "Connesso" : "Riconnessione…"}
          </span>
        </div>

        <GameHeader code={code} room={game.room} view={view} />
        <div className="space-y-6 py-6 sm:py-8">
          <QuestionCard view={view} />

          {showAnswerForm && (
            <AnswerForm
              key={`${view.currentRound.number}-${playerId}`}
              isProtagonist={isProtagonist}
              isSubmitting={game.isSubmittingAnswer}
              onSubmit={game.submitAnswer}
            />
          )}

          {showWaiting && <WaitingPlayers view={view} />}

          {(phase === "reveal" || phase === "protagonist_selection") && (
            <AnswerReveal
              view={view}
              isSelecting={game.isSelectingAnswer}
              onSelect={game.selectAnswer}
            />
          )}

          {(phase === "round_result" || phase === "finished") && (
            <RoundResult
              view={view}
              isHost={isHost}
              isAdvancing={game.isAdvancingRound}
              onNext={game.advanceRound}
            />
          )}
          {game.actionError && (
            <p
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
              role="alert"
            >
              {game.actionError}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

export { GameScreen }
