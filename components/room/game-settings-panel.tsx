"use client"

import { useState } from "react"
import {
    Check,
    Drama,
    Eye,
    Sparkles,
    SlidersHorizontal,
    UsersRound,
    WandSparkles,
    type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
    GAME_MODE_DEFINITIONS,
    type GameModeDefinition,
} from "@/realtime-server/src/game/game-modes"
import {
    GameSettingsSchema,
    QUESTION_CATEGORIES,
    type GameSettings,
} from "@/realtime-server/src/game/types"

const categoryLabels: Record<(typeof QUESTION_CATEGORIES)[number], string> = {
    friendship: "Amicizia",
    personality: "Personalità",
    preferences: "Preferenze",
    habits: "Abitudini",
    memories: "Ricordi",
    hypotheticals: "Situazioni ipotetiche",
    relationships: "Relazioni",
    fun: "Divertimento",
}

const gameModeIcons: Record<GameModeDefinition["icon"], LucideIcon> = {
    sparkles: Sparkles,
    "wand-sparkles": WandSparkles,
    eye: Eye,
    "users-round": UsersRound,
    drama: Drama,
}

interface GameSettingsPanelProps {
    settings: GameSettings
    disabled: boolean
    saving: boolean
    onSave: (settings: GameSettings) => Promise<void>
}

function GameSettingsPanel({
    settings,
    disabled,
    saving,
    onSave,
}: GameSettingsPanelProps) {
    const [draft, setDraft] = useState<GameSettings>(() =>
        GameSettingsSchema.parse(settings)
    )
    const [error, setError] = useState("")

    function updateCategory(
        category: GameSettings["enabledCategories"][number],
        enabled: boolean
    ) {
        const enabledCategories = enabled
            ? [...new Set([...draft.enabledCategories, category])]
            : draft.enabledCategories.filter((item) => item !== category)

        if (enabledCategories.length === 0) {
            setError("Lascia attiva almeno una categoria.")
            return
        }

        setError("")
        setDraft({ ...draft, enabledCategories })
    }

    async function submitSettings() {
        if (draft.enabledCategories.length === 0) {
            setError("Lascia attiva almeno una categoria.")
            return
        }
        setError("")
        await onSave(draft)
    }

    const enabledCount = draft.enabledCategories.length

    return (
        <section
            className="space-y-5 border-t border-border pt-5"
            aria-labelledby="settings-title"
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-bold text-brand-coral uppercase">
                        Il tuo tavolo
                    </p>
                    <h2
                        id="settings-title"
                        className="mt-1 inline-flex items-center gap-2 font-heading text-lg font-bold"
                    >
                        <SlidersHorizontal
                            aria-hidden="true"
                            className="size-4 text-brand-teal"
                        />
                        Impostazioni partita
                    </h2>
                </div>
                <span className="text-xs text-muted-foreground">Solo host</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-2 text-sm font-medium">
                    Round per giocatore
                    <select
                        className="min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:text-sm"
                        disabled={disabled || saving}
                        value={draft.roundsPerPlayer}
                        onChange={(event) =>
                            setDraft({
                                ...draft,
                                roundsPerPlayer: Number(event.target.value),
                            })
                        }
                    >
                        {[1, 2, 3, 4, 5].map((count) => (
                            <option key={count} value={count}>
                                {count}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                    Tempo risposte
                    <select
                        className="min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:text-sm"
                        disabled={disabled || saving}
                        value={draft.answerTimeLimitSeconds}
                        onChange={(event) =>
                            setDraft({
                                ...draft,
                                answerTimeLimitSeconds: Number(event.target.value),
                            })
                        }
                    >
                        {[30, 45, 60, 90, 120].map((seconds) => (
                            <option key={seconds} value={seconds}>
                                {seconds} secondi
                            </option>
                        ))}
                    </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                    Tempo scelta
                    <select
                        className="min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/25 sm:text-sm"
                        disabled={disabled || saving}
                        value={draft.selectionTimeLimitSeconds}
                        onChange={(event) =>
                            setDraft({
                                ...draft,
                                selectionTimeLimitSeconds: Number(event.target.value),
                            })
                        }
                    >
                        {[15, 20, 30, 45, 60].map((seconds) => (
                            <option key={seconds} value={seconds}>
                                {seconds} secondi
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="space-y-3">
                <div>
                    <h3 className="text-sm font-semibold">Modalità di gioco</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Le modalità non ancora disponibili sono mostrate come anteprima.
                    </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                    {GAME_MODE_DEFINITIONS.map((mode) => (
                        <GameModeOption
                            key={mode.id}
                            mode={mode}
                            selected={draft.mode === mode.id}
                            disabled={disabled || saving || mode.status !== "available"}
                            onSelect={() => setDraft({ ...draft, mode: mode.id })}
                        />
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Categorie</h3>
                    <span className="text-xs text-muted-foreground">
                        {enabledCount} di {QUESTION_CATEGORIES.length}
                    </span>
                </div>
                <Progress
                    value={enabledCount}
                    max={QUESTION_CATEGORIES.length}
                    label="Categorie attive"
                    className="h-1.5"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                    {QUESTION_CATEGORIES.map((category, index) => {
                        const checked = draft.enabledCategories.includes(category)
                        return (
                            <label
                                key={category}
                                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${checked ? "border-brand-teal/40 bg-brand-teal/5" : "border-border bg-background"} ${disabled || saving ? "cursor-not-allowed opacity-55" : ""}`}
                            >
                                <input
                                    className="peer sr-only"
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled || saving}
                                    onChange={(event) =>
                                        updateCategory(category, event.target.checked)
                                    }
                                />
                                <span
                                    aria-hidden="true"
                                    className={`grid size-5 place-items-center rounded border ${checked ? "border-brand-teal bg-brand-teal text-white" : "border-input bg-card"}`}
                                >
                                    {checked && <Check className="size-3.5" />}
                                </span>
                                <span className="flex-1">{categoryLabels[category]}</span>
                                <span
                                    aria-hidden="true"
                                    className={
                                        index % 2 === 0
                                            ? "size-2 rounded-full bg-brand-coral/70"
                                            : "size-2 rounded-full bg-brand-teal/70"
                                    }
                                />
                            </label>
                        )
                    })}
                </div>
            </div>

            {error && (
                <p className="text-sm font-medium text-destructive" role="alert">
                    {error}
                </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                    Le modifiche si applicano a tutto il tavolo.
                </p>
                <Button
                    size="sm"
                    variant="secondary"
                    onPress={submitSettings}
                    isDisabled={disabled || saving}
                >
                    {saving ? "Salvataggio…" : "Salva impostazioni"}
                </Button>
            </div>
        </section>
    )
}

function GameModeOption({
    mode,
    selected,
    disabled,
    onSelect,
}: {
    mode: GameModeDefinition
    selected: boolean
    disabled: boolean
    onSelect: () => void
}) {
    const ModeIcon = gameModeIcons[mode.icon]

    return (
        <button
            type="button"
            className={`flex min-h-24 items-start gap-3 rounded-lg border p-3 text-left transition-colors ${selected ? "border-brand-teal bg-brand-teal/10 ring-2 ring-brand-teal/20" : "border-border bg-background"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-brand-teal/60"}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={onSelect}
        >
            <span
                aria-hidden="true"
                className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${selected ? "bg-brand-teal text-white" : "bg-brand-lemon text-accent-foreground"}`}
            >
                <ModeIcon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{mode.name}</span>
                    <span className="shrink-0 text-[10px] font-bold text-muted-foreground uppercase">
                        {mode.status === "available" ? "Disponibile" : "In arrivo"}
                    </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {mode.description}
                </span>
                <span className="mt-2 block text-[10px] text-muted-foreground">
                    {mode.minPlayers}–{mode.maxPlayers} giocatori
                </span>
            </span>
        </button>
    )
}

export { GameSettingsPanel }
