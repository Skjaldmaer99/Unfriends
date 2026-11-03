import { UsersRound } from "lucide-react"

import { Progress } from "@/components/ui/progress"
import type { PlayerGameView } from "@/realtime-server/src/game/types"

function WaitingPlayers({ view }: { view: PlayerGameView }) {
    const { answerCount, requiredAnswerCount, phase } = view.currentRound
    const protagonist = view.players.find(
        (player) => player.id === view.currentRound.protagonistId
    )
    const isProtagonist = protagonist?.isProtagonist ?? false
    const isWritingProtagonistAnswer = phase === "protagonist_answer"
    const title =
        view.mode === "absurd_situations" || view.mode === "bluff"
            ? "La tua risposta è al sicuro."
            : isWritingProtagonistAnswer
                ? `${protagonist?.nickname ?? "Il protagonista"} sta pensando alla sua risposta.`
                : isProtagonist
                    ? "Gli amici stanno preparando le loro ipotesi."
                    : "La tua risposta è al sicuro."

    return (
        <section
            className="space-y-4 rounded-xl border border-brand-teal/25 bg-brand-teal/5 p-5 sm:p-6"
            aria-live="polite"
        >
            <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-teal/15 text-brand-teal">
                    <UsersRound aria-hidden="true" className="size-5" />
                </span>
                <div>
                    <h2 className="font-heading text-lg font-bold">
                        Un momento di suspense
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {title}
                    </p>
                </div>
            </div>
            {!isWritingProtagonistAnswer && (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium text-muted-foreground">
                        <span>Risposte ricevute</span>
                        <span>
                            {answerCount} di {requiredAnswerCount}
                        </span>
                    </div>
                    <Progress
                        value={answerCount}
                        max={requiredAnswerCount}
                        label="Risposte ricevute"
                    />
                </div>
            )}
            <p className="text-xs text-muted-foreground">
                Le risposte restano nascoste fino alla rivelazione.
            </p>
        </section>
    )
}

export { WaitingPlayers }
