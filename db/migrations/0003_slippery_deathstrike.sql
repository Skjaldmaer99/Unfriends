CREATE TYPE "public"."game_mode" AS ENUM('classic', 'absurd_situations', 'bluff', 'who_among_us', 'secret_character');--> statement-breakpoint
CREATE TABLE "game_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "game_mode" NOT NULL,
	"text" varchar(500) NOT NULL,
	"category" "question_category" DEFAULT 'fun' NOT NULL,
	"difficulty" "question_difficulty" DEFAULT 'easy' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_prompts_text_not_blank_check" CHECK (length(trim("game_prompts"."text")) > 0)
);
--> statement-breakpoint
ALTER TABLE "votes" DROP CONSTRAINT "votes_round_protagonist_fk";
--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "settings" SET DEFAULT '{"mode":"classic","roundsPerPlayer":1,"answerTimeLimitSeconds":60,"selectionTimeLimitSeconds":30,"enabledCategories":["friendship","personality","preferences","habits","memories","hypotheticals","relationships","fun"]}'::jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "game_prompts_mode_text_unique" ON "game_prompts" USING btree ("mode","text");--> statement-breakpoint
CREATE INDEX "game_prompts_mode_active_idx" ON "game_prompts" USING btree ("mode","is_active");--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_voter_player_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;