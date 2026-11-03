import {
    ArrowLeft,
    Award,
    Check,
    RotateCcw,
    Sparkles,
    Target,
    UsersRound,
} from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScoreBadge } from "@/components/ui/score-badge"
import type { PlayerGameView } from "@/realtime-server/src/game/types"
import type { GameSummary } from "@/realtime-server/src/game/game-summary"
import { rankGamePlayers } from "@/realtime-server/src/game/leaderboard"

const avatarEmoji: Record<string, string> = {
    sun: "☀️",
    sparkle: "✨",
    flower: "🌼",
    leaf: "🍃",
    moon: "🌙",
    star: "⭐",
    cherry: "🍒",
    wave: "🌊",
}

interface FinalGameSummaryProps {
    view: PlayerGameView
    summary: GameSummary
    isHost: boolean
    isReplaying: boolean
    onReplay: () => Promise<void>
    onHome: () => void
}

function FinalGameSummary({
    view,
    summary,
    isHost,
    isReplaying,
    onReplay,
    onHome,
}: FinalGameSummaryProps) {
    const ranking = rankGamePlayers(view.players)
    const winnerScore = ranking[0]?.player.score
    const winners = ranking.filter(({ player }) => player.score === winnerScore)

    return (
        <main className="min-h-svh px-4 py-6 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-3xl space-y-8">
                <header className="text-center">
                    <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-lemon text-accent-foreground shadow-[0_3px_0_color-mix(in_oklch,var(--foreground)_12%,transparent)]">
                        <Sparkles aria-hidden="true" className="size-7" />
                    </span>
                    <p className="mt-4 text-xs font-bold text-brand-coral uppercase">
                        Partita conclusa
                    </p>
                    <h1 className="mt-1 font-heading text-3xl font-extrabold sm:text-4xl">
                        {winners.length === 1
                            ? "Il tavolo ha un campione"
                            : "Vittoria condivisa"}
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        {winners.map(({ player }) => player.nickname).join(" e ")} ·{" "}
                        {winnerScore ?? 0} punti
                    </p>
                </header>

                <section aria-labelledby="final-ranking-title">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h2
                            id="final-ranking-title"
                            className="font-heading text-xl font-bold"
                        >
                            Classifica finale
                        </h2>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <UsersRound aria-hidden="true" className="size-4" />
                            {ranking.length} giocatori
                        </span>
                    </div>
                    <ol className="divide-y divide-border border-y border-border">
                        {ranking.map(({ player, rank }) => (
                            <li key={player.id} className="flex items-center gap-3 py-3">
                                <span className="w-7 font-mono text-sm font-bold text-muted-foreground">
                                    {String(rank).padStart(2, "0")}
                                </span>
                                <Avatar
                                    name={player.nickname}
                                    emoji={avatarEmoji[player.avatar ?? "sun"]}
                                    color={player.score === winnerScore ? "lemon" : "teal"}
                                />
                                <span className="min-w-0 flex-1 truncate font-semibold">
                                    {player.nickname}
                                </span>
                                {player.score === winnerScore && (
                                    <Award
                                        aria-label="Vincitore"
                                        className="size-5 text-brand-coral"
                                    />
                                )}
                                <ScoreBadge score={player.score} />
                            </li>
                        ))}
                    </ol>
                </section>

                <section
                    className="grid gap-3 sm:grid-cols-3"
                    aria-label="Statistiche partita"
                >
                    <div className="border-l-4 border-brand-teal bg-brand-teal/10 p-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase">
                            Round
                        </p>
                        <p className="mt-1 font-heading text-2xl font-extrabold">
                            {summary.roundsPlayed}
                        </p>
                    </div>
                    <div className="border-l-4 border-brand-coral bg-brand-coral/10 p-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase">
                            Risposte
                        </p>
                        <p className="mt-1 font-heading text-2xl font-extrabold">
                            {summary.answersSubmitted}
                        </p>
                    </div>
                    <div className="border-l-4 border-brand-lemon bg-brand-lemon/30 p-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase">
                            {view.mode === "absurd_situations"
                                ? "Voti alle risposte più votate"
                                : view.mode === "who_among_us"
                                    ? "Voti ai più votati"
                                    : view.mode === "bluff"
                                        ? "Voti alla risposta vera"
                                        : "Indovinate esatte"}
                        </p>
                        <p className="mt-1 font-heading text-2xl font-extrabold">
                            {view.mode === "absurd_situations" ? (
                                <>{summary.winningVotes} / {summary.votesCast}</>
                            ) : view.mode === "who_among_us" ? (
                                <>{summary.winningVotes} / {summary.votesCast}</>
                            ) : view.mode === "bluff" ? (
                                <>{summary.correctVotes} / {summary.votesCast}</>
                            ) : (
                                <>
                                    {summary.originalAnswersGuessedExactly}{" "}
                                    <span className="text-base">
                                        ({summary.exactGuessPercentage}%)
                                    </span>
                                </>
                            )}
                        </p>
                    </div>
                </section>

                {summary.recognitions.length > 0 && (
                    <section aria-labelledby="recognitions-title">
                        <div className="mb-3 flex items-center gap-2">
                            <Target aria-hidden="true" className="size-5 text-brand-teal" />
                            <h2
                                id="recognitions-title"
                                className="font-heading text-xl font-bold"
                            >
                                Riconoscimenti
                            </h2>
                        </div>
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {summary.recognitions.map((recognition) => {
                                const player = view.players.find(
                                    (item) => item.id === recognition.playerId
                                )
                                return (
                                    <li
                                        key={`${recognition.title}-${recognition.playerId}`}
                                        className="flex items-center gap-3 border-b border-border bg-card/70 p-3"
                                    >
                                        <Avatar
                                            name={recognition.nickname}
                                            emoji={avatarEmoji[player?.avatar ?? "sun"]}
                                            color="lilac"
                                            size="sm"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold">{recognition.title}</p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {recognition.nickname} · {recognition.detail}
                                            </p>
                                        </div>
                                        <Check
                                            aria-hidden="true"
                                            className="size-4 shrink-0 text-brand-teal"
                                        />
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                )}

                <footer className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
                    <Button
                        className="w-full sm:w-auto"
                        variant="outline"
                        onPress={onHome}
                    >
                        <ArrowLeft aria-hidden="true" />
                        Torna alla home
                    </Button>
                    {isHost ? (
                        <Button
                            className="w-full sm:w-auto"
                            size="lg"
                            onPress={() => void onReplay()}
                            isDisabled={isReplaying}
                        >
                            <RotateCcw aria-hidden="true" />
                            {isReplaying ? "Preparazione…" : "Gioca ancora"}
                        </Button>
                    ) : (
                        <p className="self-center text-center text-sm text-muted-foreground">
                            L&apos;host può riaprire il tavolo per una nuova partita.
                        </p>
                    )}
                </footer>
            </div>
        </main>
    )
}

export { FinalGameSummary }
