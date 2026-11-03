DROP INDEX "votes_round_voter_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "votes_round_voter_answer_unique" ON "votes" USING btree ("round_id","voter_id","selected_answer_id");