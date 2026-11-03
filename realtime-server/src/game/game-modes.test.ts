import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
    AVAILABLE_GAME_MODES,
    CHAOS_EVENT_DEFINITIONS,
    GAME_MODE_DEFINITIONS,
    getGameModeDefinition,
    normalizeGameSettingsForMode,
} from "./game-modes.js"
import { GameSettingsSchema } from "./types.js"

describe("game mode registry", () => {
    it("keeps ids unique and requires a shared 3-8 player range", () => {
        const ids = GAME_MODE_DEFINITIONS.map((mode) => mode.id)
        assert.equal(new Set(ids).size, ids.length)
        assert.ok(
            GAME_MODE_DEFINITIONS.every(
                (mode) => mode.minPlayers === 3 && mode.maxPlayers === 8
            )
        )
    })

    it("defines gameplay contracts for every selectable mode", () => {
        assert.ok(
            AVAILABLE_GAME_MODES.every(
                (mode) =>
                    mode.phases.length > 0 &&
                    mode.actions.length > 0 &&
                    mode.rules.length > 0 &&
                    mode.roundsPerPlayer.min >= 1 &&
                    mode.roundsPerPlayer.max >= mode.roundsPerPlayer.min &&
                    mode.scoring.winningAnswerPoints >= 0 &&
                    mode.scoring.selectorPoints >= 0 &&
                    mode.scoring.winningVoteBonus >= 0 &&
                    mode.completionCondition.length > 0
            )
        )
    })

    it("falls back to categories available for the selected mode", () => {
        const legacySettings = GameSettingsSchema.parse({
            mode: "absurd_situations",
            enabledCategories: ["friendship"],
        })

        assert.deepEqual(
            normalizeGameSettingsForMode(legacySettings).enabledCategories,
            getGameModeDefinition("absurd_situations").categories
        )
        assert.deepEqual(
            normalizeGameSettingsForMode({
                ...legacySettings,
                enabledCategories: ["absurd", "friendship"],
            }).enabledCategories,
            ["absurd"]
        )
    })

    it("exposes only implemented modes as selectable", () => {
        assert.deepEqual(
            AVAILABLE_GAME_MODES.map((mode) => mode.id),
            ["classic", "absurd_situations"]
        )
        assert.equal(getGameModeDefinition("classic").status, "available")
        assert.equal(getGameModeDefinition("absurd_situations").status, "available")
        assert.equal(getGameModeDefinition("bluff").status, "planned")
    })

    it("keeps chaos events scoped to compatible modes and valid duration", () => {
        assert.ok(
            CHAOS_EVENT_DEFINITIONS.every(
                (event) =>
                    event.compatibleModes.length > 0 &&
                    (event.duration === "phase" || event.duration === "round") &&
                    event.minPlayers >= 2 &&
                    event.minPlayers <= 8
            )
        )
    })
})
