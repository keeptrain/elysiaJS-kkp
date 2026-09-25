ALTER TABLE "products" DROP CONSTRAINT "products_id_uuid_v7_check";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "uq_products_org_slug" UNIQUE("organization_id","slug");