import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { rankGamePlayers } from "./leaderboard.js"

describe("game leaderboard", () => {
    it("assigns shared ranks to equal scores and preserves deterministic order", () => {
        const ranking = rankGamePlayers([
            { id: "p3", nickname: "Mina", score: 7 },
            { id: "p2", nickname: "Leo", score: 10 },
            { id: "p1", nickname: "Ada", score: 10 },
            { id: "p4", nickname: "Nico", score: 3 },
        ])

        assert.deepEqual(
            ranking.map(({ player, rank }) => [player.nickname, player.score, rank]),
            [
                ["Ada", 10, 1],
                ["Leo", 10, 1],
                ["Mina", 7, 3],
                ["Nico", 3, 4],
            ]
        )
    })
})