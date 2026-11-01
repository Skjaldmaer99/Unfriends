CREATE TYPE "public"."connection_status" AS ENUM('connected', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."question_category" AS ENUM('friendship', 'personality', 'preferences', 'habits', 'memories', 'hypotheticals', 'relationships', 'fun');--> statement-breakpoint
CREATE TYPE "public"."question_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('waiting', 'in_progress', 'finished');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('protagonist_answer', 'players_answer', 'reveal', 'protagonist_selection', 'round_result', 'finished');--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"content" varchar(240) NOT NULL,
	"is_original_answer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_content_not_blank_check" CHECK (length(trim("answers"."content")) > 0)
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"session_token_hash" varchar(64) NOT NULL,
	"nickname" varchar(24) NOT NULL,
	"avatar" varchar(32) DEFAULT 'sun' NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"connection_status" "connection_status" DEFAULT 'connected' NOT NULL,
	CONSTRAINT "players_score_non_negative_check" CHECK ("players"."score" >= 0),
	CONSTRAINT "players_session_token_hash_format_check" CHECK ("players"."session_token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "players_nickname_not_blank_check" CHECK (length(trim("players"."nickname")) > 0)
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" varchar(500) NOT NULL,
	"category" "question_category" NOT NULL,
	"difficulty" "question_difficulty" DEFAULT 'easy' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_text_not_blank_check" CHECK (length(trim("questions"."text")) > 0)
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(6) NOT NULL,
	"status" "room_status" DEFAULT 'waiting' NOT NULL,
	"max_players" smallint DEFAULT 8 NOT NULL,
	"settings" jsonb DEFAULT '{"roundsPerPlayer":1,"answerTimeLimitSeconds":60,"selectionTimeLimitSeconds":30,"enabledCategories":["friendship","personality","preferences","habits","memories","hypotheticals","relationships","fun"]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_code_format_check" CHECK ("rooms"."code" ~ '^[A-HJ-NP-Z2-9]{6}$'),
	CONSTRAINT "rooms_max_players_check" CHECK ("rooms"."max_players" between 2 and 8)
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"protagonist_id" uuid NOT NULL,
	"round_number" smallint NOT NULL,
	"status" "round_status" DEFAULT 'protagonist_answer' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "rounds_number_positive_check" CHECK ("rounds"."round_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"selected_answer_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "answers_id_round_unique" ON "answers" USING btree ("id","round_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_id_protagonist_unique" ON "rounds" USING btree ("id","protagonist_id");--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_protagonist_id_players_id_fk" FOREIGN KEY ("protagonist_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_round_protagonist_fk" FOREIGN KEY ("round_id","voter_id") REFERENCES "public"."rounds"("id","protagonist_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_selected_answer_same_round_fk" FOREIGN KEY ("selected_answer_id","round_id") REFERENCES "public"."answers"("id","round_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answers_round_player_unique" ON "answers" USING btree ("round_id","player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "answers_one_original_per_round_unique" ON "answers" USING btree ("round_id") WHERE "answers"."is_original_answer";--> statement-breakpoint
CREATE INDEX "answers_round_id_idx" ON "answers" USING btree ("round_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_session_token_hash_unique" ON "players" USING btree ("session_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "players_room_nickname_unique" ON "players" USING btree ("room_id",lower("nickname"));--> statement-breakpoint
CREATE UNIQUE INDEX "players_one_host_per_room_unique" ON "players" USING btree ("room_id") WHERE "players"."is_host";--> statement-breakpoint
CREATE INDEX "players_room_id_idx" ON "players" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_text_unique" ON "questions" USING btree ("text");--> statement-breakpoint
CREATE INDEX "questions_active_category_idx" ON "questions" USING btree ("is_active","category");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_code_unique" ON "rooms" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_room_number_unique" ON "rounds" USING btree ("room_id","round_number");--> statement-breakpoint
CREATE INDEX "rounds_room_id_idx" ON "rounds" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_round_voter_unique" ON "votes" USING btree ("round_id","voter_id");