CREATE TYPE "public"."competition_status" AS ENUM('DRAFT', 'UPCOMING', 'IN_PROGRESS', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."competition_type" AS ENUM('LEAGUE', 'LEAGUE_PLAYOFF', 'CONTINENTAL', 'INTERCONTINENTAL', 'CUP');--> statement-breakpoint
CREATE TYPE "public"."continent" AS ENUM('SOUTH_AMERICA', 'EUROPE', 'NORTH_AMERICA', 'AFRICA', 'ASIA', 'OCEANIA');--> statement-breakpoint
CREATE TYPE "public"."match_event_type" AS ENUM('GOAL', 'OWN_GOAL', 'PENALTY_GOAL', 'PENALTY_MISS', 'YELLOW_CARD', 'RED_CARD');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."news_status" AS ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."position" AS ENUM('GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."round_type" AS ENUM('REGULAR', 'GROUP', 'KNOCKOUT');--> statement-breakpoint
CREATE TYPE "public"."transfer_type" AS ENUM('SIGNING', 'TRANSFER', 'LOAN', 'RELEASE');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_season_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"club_id" text NOT NULL,
	"season_id" text NOT NULL,
	"league_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_season_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"club_id" text NOT NULL,
	"season_id" text NOT NULL,
	"competition_id" text NOT NULL,
	"played" integer DEFAULT 0 NOT NULL,
	"won" integer DEFAULT 0 NOT NULL,
	"drawn" integer DEFAULT 0 NOT NULL,
	"lost" integer DEFAULT 0 NOT NULL,
	"goals_for" integer DEFAULT 0 NOT NULL,
	"goals_against" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"form" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#e5e7eb' NOT NULL,
	"secondary_color" text DEFAULT '#0b0f17' NOT NULL,
	"owner_name" text,
	"captain_id" text,
	"league_id" text NOT NULL,
	"nation_id" text,
	"founded_at" timestamp with time zone,
	"stadium" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clubs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "competition_rounds" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "round_type" DEFAULT 'KNOCKOUT' NOT NULL,
	"order" integer NOT NULL,
	"legs" integer DEFAULT 1 NOT NULL,
	"slots" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_teams" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"club_id" text NOT NULL,
	"group_name" text,
	"seed" integer,
	"eliminated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"type" "competition_type" NOT NULL,
	"status" "competition_status" DEFAULT 'DRAFT' NOT NULL,
	"season_id" text NOT NULL,
	"league_id" text,
	"logo_url" text,
	"accent" text,
	"parent_slug" text,
	"champion_club_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"logo_url" text,
	"accent" text,
	"continent" "continent" NOT NULL,
	"nation_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "leagues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "match_appearances" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"player_id" text NOT NULL,
	"club_id" text NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"started" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"club_id" text NOT NULL,
	"player_id" text,
	"assist_player_id" text,
	"type" "match_event_type" NOT NULL,
	"minute" integer,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"season_id" text NOT NULL,
	"competition_id" text NOT NULL,
	"round_id" text,
	"home_club_id" text NOT NULL,
	"away_club_id" text NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"home_penalties" integer,
	"away_penalties" integer,
	"status" "match_status" DEFAULT 'SCHEDULED' NOT NULL,
	"kickoff_at" timestamp with time zone NOT NULL,
	"venue" text,
	"matchday" integer,
	"bracket_slot" integer,
	"leg" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nations" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"flag_emoji" text NOT NULL,
	CONSTRAINT "nations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"excerpt" text,
	"content" text NOT NULL,
	"cover_image_url" text,
	"category_id" text,
	"author_id" text,
	"status" "news_status" DEFAULT 'DRAFT' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"scheduled_for" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "news_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#e5e7eb' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "news_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "player_season_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"season_id" text NOT NULL,
	"competition_id" text NOT NULL,
	"club_id" text,
	"matches" integer DEFAULT 0 NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"yellow_cards" integer DEFAULT 0 NOT NULL,
	"red_cards" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"nation_id" text,
	"current_club_id" text,
	"shirt_number" integer,
	"position" "position" DEFAULT 'MIDFIELDER' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone,
	"roblox_username" text NOT NULL,
	"roblox_user_id" text,
	"roblox_display_name" text,
	"roblox_avatar_url" text,
	"roblox_headshot_url" text,
	"roblox_created_at" timestamp with time zone,
	"roblox_description" text,
	"roblox_is_verified" boolean,
	"roblox_synced_at" timestamp with time zone,
	"roblox_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_slug_unique" UNIQUE("slug"),
	CONSTRAINT "players_roblox_username_unique" UNIQUE("roblox_username"),
	CONSTRAINT "players_roblox_user_id_unique" UNIQUE("roblox_user_id")
);
--> statement-breakpoint
CREATE TABLE "qualification_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"league_id" text NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"from_position" integer NOT NULL,
	"to_position" integer NOT NULL,
	"target_slug" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"tagline" text,
	"banner_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_year_unique" UNIQUE("year")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"from_club_id" text,
	"to_club_id" text,
	"season_id" text NOT NULL,
	"type" "transfer_type" DEFAULT 'TRANSFER' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"discord_id" text,
	"discord_username" text,
	"discord_global_name" text,
	"role" "role" DEFAULT 'USER' NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_season_memberships" ADD CONSTRAINT "club_season_memberships_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_season_memberships" ADD CONSTRAINT "club_season_memberships_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_season_memberships" ADD CONSTRAINT "club_season_memberships_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_season_stats" ADD CONSTRAINT "club_season_stats_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_season_stats" ADD CONSTRAINT "club_season_stats_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_season_stats" ADD CONSTRAINT "club_season_stats_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_captain_id_players_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_rounds" ADD CONSTRAINT "competition_rounds_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_champion_club_id_clubs_id_fk" FOREIGN KEY ("champion_club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_appearances" ADD CONSTRAINT "match_appearances_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_appearances" ADD CONSTRAINT "match_appearances_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_appearances" ADD CONSTRAINT "match_appearances_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_assist_player_id_players_id_fk" FOREIGN KEY ("assist_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_competition_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."competition_rounds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_club_id_clubs_id_fk" FOREIGN KEY ("home_club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_club_id_clubs_id_fk" FOREIGN KEY ("away_club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_category_id_news_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."news_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_nation_id_nations_id_fk" FOREIGN KEY ("nation_id") REFERENCES "public"."nations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_current_club_id_clubs_id_fk" FOREIGN KEY ("current_club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_zones" ADD CONSTRAINT "qualification_zones_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_club_id_clubs_id_fk" FOREIGN KEY ("from_club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_club_id_clubs_id_fk" FOREIGN KEY ("to_club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "club_season_unique" ON "club_season_memberships" USING btree ("club_id","season_id");--> statement-breakpoint
CREATE INDEX "club_season_league_idx" ON "club_season_memberships" USING btree ("season_id","league_id");--> statement-breakpoint
CREATE UNIQUE INDEX "club_stat_unique" ON "club_season_stats" USING btree ("club_id","competition_id");--> statement-breakpoint
CREATE INDEX "club_stat_position_idx" ON "club_season_stats" USING btree ("competition_id","position");--> statement-breakpoint
CREATE INDEX "club_stat_season_idx" ON "club_season_stats" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "clubs_league_idx" ON "clubs" USING btree ("league_id");--> statement-breakpoint
CREATE UNIQUE INDEX "round_slug_unique" ON "competition_rounds" USING btree ("competition_id","slug");--> statement-breakpoint
CREATE INDEX "round_order_idx" ON "competition_rounds" USING btree ("competition_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "competition_team_unique" ON "competition_teams" USING btree ("competition_id","club_id");--> statement-breakpoint
CREATE INDEX "competition_team_group_idx" ON "competition_teams" USING btree ("competition_id","group_name");--> statement-breakpoint
CREATE INDEX "competitions_season_type_idx" ON "competitions" USING btree ("season_id","type");--> statement-breakpoint
CREATE INDEX "competitions_league_idx" ON "competitions" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "leagues_continent_idx" ON "leagues" USING btree ("continent");--> statement-breakpoint
CREATE UNIQUE INDEX "appearance_unique" ON "match_appearances" USING btree ("match_id","player_id");--> statement-breakpoint
CREATE INDEX "appearance_player_idx" ON "match_appearances" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "events_match_idx" ON "match_events" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "events_player_type_idx" ON "match_events" USING btree ("player_id","type");--> statement-breakpoint
CREATE INDEX "matches_season_status_idx" ON "matches" USING btree ("season_id","status");--> statement-breakpoint
CREATE INDEX "matches_competition_matchday_idx" ON "matches" USING btree ("competition_id","matchday");--> statement-breakpoint
CREATE INDEX "matches_kickoff_idx" ON "matches" USING btree ("kickoff_at");--> statement-breakpoint
CREATE INDEX "news_status_published_idx" ON "news" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "news_category_idx" ON "news" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_stat_unique" ON "player_season_stats" USING btree ("player_id","competition_id");--> statement-breakpoint
CREATE INDEX "player_stat_goals_idx" ON "player_season_stats" USING btree ("competition_id","goals");--> statement-breakpoint
CREATE INDEX "player_stat_season_idx" ON "player_season_stats" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "players_club_idx" ON "players" USING btree ("current_club_id");--> statement-breakpoint
CREATE INDEX "players_position_idx" ON "players" USING btree ("position");--> statement-breakpoint
CREATE INDEX "players_nation_idx" ON "players" USING btree ("nation_id");--> statement-breakpoint
CREATE INDEX "zones_league_idx" ON "qualification_zones" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "seasons_active_idx" ON "seasons" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "transfers_player_idx" ON "transfers" USING btree ("player_id","occurred_at");--> statement-breakpoint
CREATE INDEX "transfers_season_idx" ON "transfers" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");