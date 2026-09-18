ALTER TABLE "user_organizations" ADD COLUMN "position" text DEFAULT 'staff' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD COLUMN "roles" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_organizations" DROP COLUMN "role";