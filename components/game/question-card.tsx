import { Badge } from "@/components/ui/badge"
import { Timer } from "@/components/ui/timer"
import type { PlayerGameView } from "@/realtime-server/src/game/types"

const categoryLabels: Record<string, string> = {
    friendship: "Amicizia",
    personality: "Personalità",
    preferences: "Preferenze",
    habits: "Abitudini",
    memories: "Ricordi",
    hypotheticals: "Situazioni ipotetiche",
    relationships: "Relazioni",
    fun: "Divertimento",
}

interface QuestionCardProps {
    view: PlayerGameView
}

function QuestionCard({ view }: QuestionCardProps) {
    const round = view.currentRound
    const protagonist = view.players.find(
        (player) => player.id === round.protagonistId
    )
    const canShowTimer =
        round.deadlineAt !== null &&
        (round.phase === "protagonist_answer" ||
            round.phase === "players_answer" ||
            round.phase === "protagonist_selection")

    return (
        <section className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-[0_4px_0_color-mix(in_oklch,var(--foreground)_9%,transparent)] sm:p-7">
            <div
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1.5 bg-brand-coral"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pl-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="accent">
                        {categoryLabels[round.question.category] ?? "Domanda"}
                    </Badge>
                    {view.mode === "absurd_situations" ? (
                        <Badge variant="secondary">Tutti rispondono</Badge>
                    ) : protagonist ? (
                        <Badge variant="secondary">
                            Protagonista: {protagonist.nickname}
                        </Badge>
                    ) : null}
                </div>
                {canShowTimer && <Timer deadlineAt={round.deadlineAt!} />}
            </div>
            <h1 className="mt-5 pl-2 font-heading text-2xl leading-snug font-extrabold sm:text-3xl">
                {round.question.text}
            </h1>
        </section>
    )
}

export { QuestionCard }
