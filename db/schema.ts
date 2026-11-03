import {
    boolean,
    check,
    foreignKey,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    smallint,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

import {
    QUESTION_CATEGORIES,
    GAME_MODES,
    type GameSettings,
} from "../realtime-server/src/game/types"

export const roomStatusEnum = pgEnum("room_status", [
    "waiting",
    "in_progress",
    "finished",
])

export const gameModeEnum = pgEnum("game_mode", GAME_MODES)

export const connectionStatusEnum = pgEnum("connection_status", [
    "connected",
    "disconnected",
])

export const questionCategoryEnum = pgEnum(
    "question_category",
    QUESTION_CATEGORIES
)

export const questionDifficultyEnum = pgEnum("question_difficulty", [
    "easy",
    "medium",
    "hard",
])

export const roundStatusEnum = pgEnum("round_status", [
    "protagonist_answer",
    "players_answer",
    "reveal",
    "protagonist_selection",
    "round_result",
    "finished",
])

const defaultGameSettings: GameSettings = {
    mode: "classic",
    roundsPerPlayer: 1,
    answerTimeLimitSeconds: 60,
    selectionTimeLimitSeconds: 30,
    enabledCategories: [...QUESTION_CATEGORIES],
}

export const rooms = pgTable(
    "rooms",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        code: varchar("code", { length: 6 }).notNull(),
        status: roomStatusEnum("status").notNull().default("waiting"),
        maxPlayers: smallint("max_players").notNull().default(8),
        settings: jsonb("settings")
            .$type<GameSettings>()
            .notNull()
            .default(defaultGameSettings),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        uniqueIndex("rooms_code_unique").on(table.code),
        check(
            "rooms_code_format_check",
            sql`${table.code} ~ '^[A-HJ-NP-Z2-9]{6}$'`
        ),
        check("rooms_max_players_check", sql`${table.maxPlayers} between 2 and 8`),
    ]
)

export const players = pgTable(
    "players",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        roomId: uuid("room_id")
            .notNull()
            .references(() => rooms.id, { onDelete: "cascade" }),
        sessionTokenHash: varchar("session_token_hash", { length: 64 }).notNull(),
        nickname: varchar("nickname", { length: 24 }).notNull(),
        avatar: varchar("avatar", { length: 32 }).notNull().default("sun"),
        isHost: boolean("is_host").notNull().default(false),
        score: integer("score").notNull().default(0),
        joinedAt: timestamp("joined_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        connectionStatus: connectionStatusEnum("connection_status")
            .notNull()
            .default("connected"),
    },
    (table) => [
        uniqueIndex("players_session_token_hash_unique").on(table.sessionTokenHash),
        uniqueIndex("players_room_nickname_unique").on(
            table.roomId,
            sql`lower(${table.nickname})`
        ),
        uniqueIndex("players_one_host_per_room_unique")
            .on(table.roomId)
            .where(sql`${table.isHost}`),
        index("players_room_id_idx").on(table.roomId),
        check("players_score_non_negative_check", sql`${table.score} >= 0`),
        check(
            "players_session_token_hash_format_check",
            sql`${table.sessionTokenHash} ~ '^[a-f0-9]{64}$'`
        ),
        check(
            "players_nickname_not_blank_check",
            sql`length(trim(${table.nickname})) > 0`
        ),
    ]
)

export const questions = pgTable(
    "questions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        text: varchar("text", { length: 500 }).notNull(),
        category: questionCategoryEnum("category").notNull(),
        difficulty: questionDifficultyEnum("difficulty").notNull().default("easy"),
        isActive: boolean("is_active").notNull().default(true),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex("questions_text_unique").on(table.text),
        index("questions_active_category_idx").on(table.isActive, table.category),
        check(
            "questions_text_not_blank_check",
            sql`length(trim(${table.text})) > 0`
        ),
    ]
)

export const gamePrompts = pgTable(
    "game_prompts",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        mode: gameModeEnum("mode").notNull(),
        text: varchar("text", { length: 500 }).notNull(),
        category: questionCategoryEnum("category").notNull().default("fun"),
        difficulty: questionDifficultyEnum("difficulty").notNull().default("easy"),
        isActive: boolean("is_active").notNull().default(true),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex("game_prompts_mode_text_unique").on(table.mode, table.text),
        index("game_prompts_mode_active_idx").on(table.mode, table.isActive),
        check(
            "game_prompts_text_not_blank_check",
            sql`length(trim(${table.text})) > 0`
        ),
    ]
)

export const gameSessions = pgTable(
    "game_sessions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        roomId: uuid("room_id")
            .notNull()
            .references(() => rooms.id, { onDelete: "cascade" }),
        hostPlayerId: uuid("host_player_id")
            .notNull()
            .references(() => players.id, { onDelete: "restrict" }),
        roundOffset: smallint("round_offset").notNull().default(0),
        state: jsonb("state")
            .$type<import("../realtime-server/src/game/types").GameState>()
            .notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => [
        index("game_sessions_room_id_idx").on(table.roomId),
        check("game_sessions_round_offset_check", sql`${table.roundOffset} >= 0`),
    ]
)

export const rounds = pgTable(
    "rounds",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        roomId: uuid("room_id")
            .notNull()
            .references(() => rooms.id, { onDelete: "cascade" }),
        questionId: uuid("question_id")
            .references(() => questions.id, { onDelete: "restrict" }),
        gamePromptId: uuid("game_prompt_id").references(() => gamePrompts.id, {
            onDelete: "restrict",
        }),
        gameSessionId: uuid("game_session_id").references(() => gameSessions.id, {
            onDelete: "cascade",
        }),
        protagonistId: uuid("protagonist_id")
            .notNull()
            .references(() => players.id, { onDelete: "restrict" }),
        roundNumber: smallint("round_number").notNull(),
        status: roundStatusEnum("status").notNull().default("protagonist_answer"),
        deadlineAt: timestamp("deadline_at", { withTimezone: true }),
        startedAt: timestamp("started_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        completedAt: timestamp("completed_at", { withTimezone: true }),
    },
    (table) => [
        uniqueIndex("rounds_room_number_unique").on(
            table.roomId,
            table.roundNumber
        ),
        uniqueIndex("rounds_id_protagonist_unique").on(
            table.id,
            table.protagonistId
        ),
        index("rounds_room_id_idx").on(table.roomId),
        check("rounds_number_positive_check", sql`${table.roundNumber} > 0`),
        check(
            "rounds_question_source_check",
            sql`(${table.questionId} is not null and ${table.gamePromptId} is null) or (${table.questionId} is null and ${table.gamePromptId} is not null)`
        ),
    ]
)

export const answers = pgTable(
    "answers",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        roundId: uuid("round_id")
            .notNull()
            .references(() => rounds.id, { onDelete: "cascade" }),
        playerId: uuid("player_id")
            .notNull()
            .references(() => players.id, { onDelete: "restrict" }),
        content: varchar("content", { length: 240 }).notNull(),
        isOriginalAnswer: boolean("is_original_answer").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex("answers_round_player_unique").on(
            table.roundId,
            table.playerId
        ),
        uniqueIndex("answers_id_round_unique").on(table.id, table.roundId),
        uniqueIndex("answers_one_original_per_round_unique")
            .on(table.roundId)
            .where(sql`${table.isOriginalAnswer}`),
        index("answers_round_id_idx").on(table.roundId),
        check(
            "answers_content_not_blank_check",
            sql`length(trim(${table.content})) > 0`
        ),
    ]
)

export const votes = pgTable(
    "votes",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        roundId: uuid("round_id").notNull(),
        voterId: uuid("voter_id").notNull(),
        selectedAnswerId: uuid("selected_answer_id").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex("votes_round_voter_answer_unique").on(
            table.roundId,
            table.voterId,
            table.selectedAnswerId
        ),
        foreignKey({
            name: "votes_voter_player_fk",
            columns: [table.voterId],
            foreignColumns: [players.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "votes_selected_answer_same_round_fk",
            columns: [table.selectedAnswerId, table.roundId],
            foreignColumns: [answers.id, answers.roundId],
        }).onDelete("cascade"),
    ]
)
