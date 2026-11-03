import type { GameMode, RoundPhase } from "./types.js"

export type GameModeAction =
    | "submit_original_answer"
    | "submit_answer"
    | "select_winning_answers"
    | "vote_answer"
    | "advance_round"

export interface GameModeScoring {
    winningAnswerPoints: number
    selectorPoints: number
    winningVoteBonus: number
}

export interface GameModeDefinition {
    id: GameMode
    name: string
    description: string
    icon: "sparkles" | "wand-sparkles" | "eye" | "users-round" | "drama"
    minPlayers: number
    maxPlayers: number
    status: "available" | "planned"
    roundsPerPlayer: { min: number; max: number }
    phases: readonly RoundPhase[]
    actions: readonly GameModeAction[]
    scoring: GameModeScoring
    rules: readonly string[]
    completionCondition: string
}

export const GAME_MODE_DEFINITIONS: readonly GameModeDefinition[] = [
    {
        id: "classic",
        name: "Classica",
        description: "Indovina quale risposta rappresenta meglio il protagonista.",
        icon: "sparkles",
        minPlayers: 3,
        maxPlayers: 8,
        status: "available",
        roundsPerPlayer: { min: 1, max: 5 },
        phases: [
            "protagonist_answer",
            "players_answer",
            "reveal",
            "protagonist_selection",
            "round_result",
            "finished",
        ],
        actions: [
            "submit_original_answer",
            "submit_answer",
            "select_winning_answers",
            "advance_round",
        ],
        scoring: {
            winningAnswerPoints: 3,
            selectorPoints: 1,
            winningVoteBonus: 0,
        },
        rules: [
            "Il protagonista risponde in privato.",
            "Gli altri giocatori inviano ipotesi anonime.",
            "Il protagonista può selezionare più risposte vincenti.",
        ],
        completionCondition: "Tutti i round configurati hanno un risultato.",
    },
    {
        id: "absurd_situations",
        name: "Situazioni assurde",
        description: "Inventate risposte creative a scenari improbabili.",
        icon: "wand-sparkles",
        minPlayers: 3,
        maxPlayers: 8,
        status: "available",
        roundsPerPlayer: { min: 1, max: 5 },
        phases: [
            "players_answer",
            "reveal",
            "protagonist_selection",
            "round_result",
            "finished",
        ],
        actions: ["submit_answer", "vote_answer", "advance_round"],
        scoring: {
            winningAnswerPoints: 3,
            selectorPoints: 0,
            winningVoteBonus: 1,
        },
        rules: [
            "Tutti inviano una risposta anonima.",
            "Ogni giocatore vota una risposta diversa dalla propria.",
            "I voti restano segreti fino al risultato; i pareggi condividono la vittoria.",
        ],
        completionCondition:
            "Il voto si chiude quando tutti i giocatori eleggibili votano o scade il timer.",
    },
    {
        id: "bluff",
        name: "Il bluff",
        description: "Mescola invenzioni plausibili e verità: chi saprà distinguerle?",
        icon: "eye",
        minPlayers: 3,
        maxPlayers: 8,
        status: "planned",
        roundsPerPlayer: { min: 1, max: 5 },
        phases: [],
        actions: [],
        scoring: { winningAnswerPoints: 0, selectorPoints: 0, winningVoteBonus: 0 },
        rules: [],
        completionCondition: "Da definire prima di rendere disponibile la modalità.",
    },
    {
        id: "who_among_us",
        name: "Chi tra noi?",
        description: "Votate in segreto chi si adatta meglio alla situazione.",
        icon: "users-round",
        minPlayers: 3,
        maxPlayers: 8,
        status: "planned",
        roundsPerPlayer: { min: 1, max: 5 },
        phases: [],
        actions: [],
        scoring: { winningAnswerPoints: 0, selectorPoints: 0, winningVoteBonus: 0 },
        rules: [],
        completionCondition: "Da definire prima di rendere disponibile la modalità.",
    },
    {
        id: "secret_character",
        name: "Personaggio segreto",
        description: "Interpretate ruoli nascosti e provate a scoprirli.",
        icon: "drama",
        minPlayers: 3,
        maxPlayers: 8,
        status: "planned",
        roundsPerPlayer: { min: 1, max: 5 },
        phases: [],
        actions: [],
        scoring: { winningAnswerPoints: 0, selectorPoints: 0, winningVoteBonus: 0 },
        rules: [],
        completionCondition: "Da definire prima di rendere disponibile la modalità.",
    },
]

export const AVAILABLE_GAME_MODES = GAME_MODE_DEFINITIONS.filter(
    (mode) => mode.status === "available"
)

export function getGameModeDefinition(modeId: GameMode): GameModeDefinition {
    const definition = GAME_MODE_DEFINITIONS.find((mode) => mode.id === modeId)
    if (!definition) throw new Error(`Unknown game mode: ${modeId}`)
    return definition
}

export interface ChaosEventDefinition {
    id: string
    name: string
    description: string
    duration: "phase" | "round"
    compatibleModes: readonly GameMode[]
    minPlayers: number
}

export const CHAOS_EVENT_DEFINITIONS: readonly ChaosEventDefinition[] = [
    {
        id: "question-only",
        name: "Solo domande",
        description: "Formula la risposta come una domanda.",
        duration: "phase",
        compatibleModes: ["classic", "absurd_situations"],
        minPlayers: 3,
    },
    {
        id: "opposite-opinion",
        name: "Avvocato del contrario",
        description: "Difendi per questo round una posizione opposta alla tua.",
        duration: "round",
        compatibleModes: ["classic", "absurd_situations"],
        minPlayers: 3,
    },
]
