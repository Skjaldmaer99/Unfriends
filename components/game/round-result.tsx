import { ArrowRight, PartyPopper, Sparkles } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScoreBadge } from "@/components/ui/score-badge"
import type { PlayerGameView } from "@/realtime-server/src/game/types"
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

interface RoundResultProps {
    view: PlayerGameView
    isHost: boolean
    isAdvancing: boolean
    onNext: () => Promise<void>
}

function RoundResult({ view, isHost, isAdvancing, onNext }: RoundResultProps) {
    const selectedAnswers = view.currentRound.answers.filter((answer) =>
        view.currentRound.selectedAnswerIds.includes(answer.id)
    )
    const selectedPlayers = selectedAnswers
        .map((answer) =>
            view.players.find((player) => player.id === answer.authorId)
        )
        .filter((player) => player !== undefined)
    const winnerNames = [
        ...new Set(selectedPlayers.map((player) => player.nickname)),
    ]
    const protagonist = view.players.find(
        (player) => player.id === view.currentRound.protagonistId
    )
    const finalRound = view.currentRound.phase === "finished"

    if (finalRound) {
        const ranking = rankGamePlayers(view.players)
        const winnerScore = ranking[0]?.player.score
        const winners = ranking.filter(({ player }) => player.score === winnerScore)
        return (
            <section className="space-y-5" aria-labelledby="game-finished-title">
                <div className="text-center">
                    <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-lemon text-accent-foreground">
                        <PartyPopper aria-hidden="true" className="size-7" />
                    </span>
                    <p className="mt-4 text-xs font-bold text-brand-coral uppercase">
                        Partita conclusa
                    </p>
                    <h2
                        id="game-finished-title"
                        className="mt-1 font-heading text-3xl font-extrabold"
                    >
                        {winners.length > 1
                            ? "Vittoria condivisa"
                            : ranking[0]?.player.nickname ?? "Grazie per aver giocato"}
                    </h2>
                    <p className="text-muted-foreground">
                        {winners.map(({ player }) => player.nickname).join(" e ")} {" "}
                        {winners.length > 1 ? "hanno" : "ha"} conquistato il tavolo
                    </p>
                </div>
                <ol className="divide-y divide-border border-y border-border">
                    {ranking.map(({ player, rank }) => (
                        <li key={player.id} className="flex items-center gap-3 py-3">
                            <span className="w-6 font-mono text-sm font-bold text-muted-foreground">
                                {rank}
                            </span>
                            <Avatar
                                name={player.nickname}
                                emoji={avatarEmoji[player.avatar ?? "sun"]}
                                color={rank === 1 ? "lemon" : "teal"}
                            />
                            <span className="min-w-0 flex-1 truncate font-semibold">
                                {player.nickname}
                            </span>
                            <ScoreBadge score={player.score} />
                        </li>
                    ))}
                </ol>
            </section>
        )
    }

    if (view.mode === "who_among_us") {
        const tiedCandidates = selectedAnswers
            .map((answer) => ({
                answer,
                player: view.players.find((player) => player.id === answer.authorId),
            }))
            .filter((entry) => entry.player !== undefined)

        return (
            <section className="space-y-5" aria-labelledby="who-result-title">
                <div className="text-center">
                    <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-lemon text-accent-foreground">
                        <Sparkles aria-hidden="true" className="size-6" />
                    </span>
                    <p className="mt-3 text-xs font-bold text-brand-coral uppercase">
                        Chi tra noi?
                    </p>
                    <h2 id="who-result-title" className="mt-1 font-heading text-2xl font-extrabold">
                        {tiedCandidates.length > 1
                            ? `Pareggio: ${tiedCandidates.map(({ player }) => player!.nickname).join(", ")}`
                            : tiedCandidates.length === 1
                                ? `${tiedCandidates[0].player!.nickname} ha ricevuto più voti`
                                : "Nessun voto ricevuto"}
                    </h2>
                </div>

                <ul className="grid gap-3 sm:grid-cols-2">
                    {view.currentRound.answers.map((answer) => {
                        const candidate = view.players.find(
                            (player) => player.id === answer.authorId
                        )
                        return (
                            <li
                                key={answer.id}
                                className={`flex items-center gap-3 rounded-lg border p-4 ${answer.isCorrectAnswer ? "border-brand-teal/50 bg-brand-teal/10" : "border-border bg-card"}`}
                            >
                                <span className="min-w-0 flex-1 font-semibold">
                                    {candidate?.nickname ?? answer.content}
                                </span>
                                {answer.isCorrectAnswer && (
                                    <span className="text-xs font-bold text-brand-teal">Più votato</span>
                                )}
                                <span className="text-sm font-bold tabular-nums">
                                    {answer.voteCount ?? 0}
                                </span>
                            </li>
                        )
                    })}
                </ul>

                <ol className="divide-y divide-border border-y border-border">
                    {rankGamePlayers(view.players).map(({ player, rank }) => (
                        <li key={player.id} className="flex items-center gap-3 py-2.5">
                            <span className="w-6 font-mono text-xs font-bold text-muted-foreground">
                                {rank}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                {player.nickname}
                            </span>
                            <ScoreBadge score={player.score} />
                        </li>
                    ))}
                </ol>

                {isHost ? (
                    <Button
                        className="w-full sm:w-auto"
                        size="lg"
                        onPress={() => void onNext()}
                        isDisabled={isAdvancing}
                    >
                        {isAdvancing ? "Un attimo…" : "Prossimo round"}
                        <ArrowRight aria-hidden="true" />
                    </Button>
                ) : (
                    <p className="text-center text-sm text-muted-foreground">
                        In attesa che l&apos;host continui.
                    </p>
                )}
            </section>
        )
    }

    if (view.mode === "bluff") {
        return (
            <section className="space-y-5" aria-labelledby="bluff-result-title">
                <div className="text-center">
                    <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-lemon text-accent-foreground">
                        <Sparkles aria-hidden="true" className="size-6" />
                    </span>
                    <p className="mt-3 text-xs font-bold text-brand-coral uppercase">
                        Risultato del Bluff
                    </p>
                    <h2
                        id="bluff-result-title"
                        className="mt-1 font-heading text-2xl font-extrabold"
                    >
                        La risposta vera era {view.currentRound.answers.find((answer) => answer.isCorrectAnswer)?.content ?? "non disponibile"}
                    </h2>
                    {view.currentRound.bluffExplanation && (
                        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                            {view.currentRound.bluffExplanation}
                        </p>
                    )}
                    {view.currentRound.bluffSourceUrl && (
                        <a
                            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-teal underline underline-offset-4"
                            href={view.currentRound.bluffSourceUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Apri la fonte verificata
                        </a>
                    )}
                </div>

                <ul className="grid gap-3 sm:grid-cols-2">
                    {view.currentRound.answers.map((answer) => (
                        <li
                            key={answer.id}
                            className={`rounded-lg border p-4 ${answer.isCorrectAnswer ? "border-brand-teal/50 bg-brand-teal/10" : "border-border bg-card"}`}
                        >
                            <p className="text-xs font-bold text-muted-foreground uppercase">
                                {answer.isCorrectAnswer ? "Risposta verificata" : "Bluff anonimo"}
                            </p>
                            <p className="mt-2 text-lg font-semibold">{answer.content}</p>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span>
                                    {answer.authorNickname
                                        ? `Bluff di ${answer.authorNickname}`
                                        : answer.isCorrectAnswer
                                            ? "Fonte verificata"
                                            : "Autore non disponibile"}
                                </span>
                                <span className="font-semibold">
                                    {answer.voteCount ?? 0} {(answer.voteCount ?? 0) === 1 ? "voto" : "voti"}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>

                <ol className="divide-y divide-border border-y border-border">
                    {rankGamePlayers(view.players).map(({ player, rank }) => (
                        <li key={player.id} className="flex items-center gap-3 py-2.5">
                            <span className="w-6 font-mono text-xs font-bold text-muted-foreground">
                                {rank}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                {player.nickname}
                            </span>
                            <ScoreBadge score={player.score} />
                        </li>
                    ))}
                </ol>

                {isHost ? (
                    <Button
                        className="w-full sm:w-auto"
                        size="lg"
                        onPress={() => void onNext()}
                        isDisabled={isAdvancing}
                    >
                        {isAdvancing ? "Un attimo…" : "Prossimo round"}
                        <ArrowRight aria-hidden="true" />
                    </Button>
                ) : (
                    <p className="text-center text-sm text-muted-foreground">
                        In attesa che l&apos;host continui.
                    </p>
                )}
            </section>
        )
    }

    return (
        <section className="space-y-5" aria-labelledby="round-result-title">
            <div className="text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-lemon text-accent-foreground">
                    <Sparkles aria-hidden="true" className="size-6" />
                </span>
                <p className="mt-3 text-xs font-bold text-brand-coral uppercase">
                    Risultato del round
                </p>
                <h2
                    id="round-result-title"
                    className="mt-1 font-heading text-2xl font-extrabold"
                >
                    {winnerNames.length === 1
                        ? view.mode === "absurd_situations"
                            ? `${winnerNames[0]} ha fatto centro!`
                            : `${winnerNames[0]} ci ha preso!`
                        : winnerNames.length > 1
                            ? view.mode === "absurd_situations"
                                ? `Pareggio: ${winnerNames.join(", ")}`
                                : `Scelta condivisa: ${winnerNames.join(", ")}`
                            : "Round completato"}
                </h2>
            </div>

            <div className="space-y-3">
                {view.mode === "classic" && (
                    <div className="rounded-lg border border-border bg-card p-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase">
                            Risposta originale · {protagonist?.nickname}
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                            {view.currentRound.originalAnswer ?? "Nessuna risposta inviata"}
                        </p>
                    </div>
                )}
                {selectedAnswers.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {selectedAnswers.map((answer) => {
                            const author = view.players.find(
                                (player) => player.id === answer.authorId
                            )
                            return (
                                <div
                                    key={answer.id}
                                    className="rounded-lg border border-brand-teal/35 bg-brand-teal/5 p-4"
                                >
                                    <p className="text-xs font-bold text-muted-foreground uppercase">
                                        {view.mode === "absurd_situations"
                                            ? "Risposta più votata"
                                            : "Risposta vincente"}
                                    </p>
                                    <p className="mt-2 text-lg font-semibold">{answer.content}</p>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Scritta da {author?.nickname ?? "Giocatore"}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="rounded-lg border border-border bg-card p-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase">
                            {view.mode === "absurd_situations"
                                ? "Risposta più votata"
                                : "Risposta vincente"}
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                            Nessuna risposta selezionata
                        </p>
                    </div>
                )}
            </div>

            <ol className="divide-y divide-border border-y border-border">
                {rankGamePlayers(view.players).map(({ player, rank }) => (
                    <li key={player.id} className="flex items-center gap-3 py-2.5">
                        <span className="w-6 font-mono text-xs font-bold text-muted-foreground">
                            {rank}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {player.nickname}
                        </span>
                        <ScoreBadge score={player.score} />
                    </li>
                ))}
            </ol>

            {isHost ? (
                <Button
                    className="w-full sm:w-auto"
                    size="lg"
                    onPress={() => void onNext()}
                    isDisabled={isAdvancing}
                >
                    {isAdvancing ? "Un attimo…" : "Prossimo round"}
                    <ArrowRight aria-hidden="true" />
                </Button>
            ) : (
                <p className="text-center text-sm text-muted-foreground">
                    In attesa che l&apos;host continui.
                </p>
            )}
        </section>
    )
}

export { RoundResult }
