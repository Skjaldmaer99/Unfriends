ALTER TYPE "public"."question_category" ADD VALUE 'absurd';--> statement-breakpoint
ALTER TYPE "public"."question_category" ADD VALUE 'everyday_life';--> statement-breakpoint
ALTER TYPE "public"."question_category" ADD VALUE 'travel';--> statement-breakpoint
ALTER TYPE "public"."question_category" ADD VALUE 'general_knowledge';--> statement-breakpoint
ALTER TYPE "public"."question_category" ADD VALUE 'embarrassing';--> statement-breakpoint
ALTER TYPE "public"."question_category" ADD VALUE 'fantasy';--> statement-breakpoint
ALTER TYPE "public"."question_category" ADD VALUE 'impossible_situations';--> statement-breakpoint
CREATE TABLE "bluff_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" varchar(500) NOT NULL,
	"correct_answer" varchar(300) NOT NULL,
	"explanation" varchar(1200) NOT NULL,
	"source_url" varchar(1000) NOT NULL,
	"category" "question_category" NOT NULL,
	"difficulty" "question_difficulty" DEFAULT 'easy' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bluff_questions_content_not_blank_check" CHECK (length(trim("bluff_questions"."text")) > 0 and length(trim("bluff_questions"."correct_answer")) > 0 and length(trim("bluff_questions"."explanation")) > 0),
	CONSTRAINT "bluff_questions_https_source_check" CHECK ("bluff_questions"."source_url" ~ '^https://')
);
--> statement-breakpoint
CREATE TABLE "secret_character_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" varchar(600) NOT NULL,
	"secret_objective" varchar(600) NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "secret_character_roles_position_positive_check" CHECK ("secret_character_roles"."position" > 0),
	CONSTRAINT "secret_character_roles_content_not_blank_check" CHECK (length(trim("secret_character_roles"."title")) > 0 and length(trim("secret_character_roles"."description")) > 0 and length(trim("secret_character_roles"."secret_objective")) > 0)
);
--> statement-breakpoint
CREATE TABLE "secret_character_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" varchar(1200) NOT NULL,
	"category" "question_category" NOT NULL,
	"min_players" smallint DEFAULT 3 NOT NULL,
	"max_players" smallint DEFAULT 8 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "secret_character_scenarios_player_count_check" CHECK ("secret_character_scenarios"."min_players" >= 3 and "secret_character_scenarios"."max_players" >= "secret_character_scenarios"."min_players" and "secret_character_scenarios"."max_players" <= 8),
	CONSTRAINT "secret_character_scenarios_content_not_blank_check" CHECK (length(trim("secret_character_scenarios"."title")) > 0 and length(trim("secret_character_scenarios"."description")) > 0)
);
--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "settings" SET DEFAULT '{"mode":"classic","roundsPerPlayer":1,"answerTimeLimitSeconds":60,"selectionTimeLimitSeconds":30,"enabledCategories":["friendship","personality","preferences","habits","memories","hypotheticals","relationships","fun","absurd","everyday_life","travel","general_knowledge","embarrassing","fantasy","impossible_situations"]}'::jsonb;--> statement-breakpoint
ALTER TABLE "secret_character_roles" ADD CONSTRAINT "secret_character_roles_scenario_id_secret_character_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."secret_character_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bluff_questions_text_unique" ON "bluff_questions" USING btree ("text");--> statement-breakpoint
CREATE INDEX "bluff_questions_active_category_idx" ON "bluff_questions" USING btree ("is_active","category");--> statement-breakpoint
CREATE UNIQUE INDEX "secret_character_roles_scenario_title_unique" ON "secret_character_roles" USING btree ("scenario_id","title");--> statement-breakpoint
CREATE UNIQUE INDEX "secret_character_roles_scenario_position_unique" ON "secret_character_roles" USING btree ("scenario_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "secret_character_scenarios_title_unique" ON "secret_character_scenarios" USING btree ("title");--> statement-breakpoint
CREATE INDEX "secret_character_scenarios_active_idx" ON "secret_character_scenarios" USING btree ("is_active");