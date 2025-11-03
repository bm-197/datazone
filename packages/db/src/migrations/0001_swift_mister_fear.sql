CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('product', 'search', 'review', 'price_update');--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"month" text NOT NULL,
	"calls_used" integer DEFAULT 0,
	"calls_limit" integer DEFAULT 1000,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"price" real NOT NULL,
	"original_price" real,
	"currency" text DEFAULT 'USD',
	"availability" text,
	"seller_name" text,
	"seller_rating" real,
	"prime_eligible" boolean DEFAULT false,
	"collected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"total_results" integer DEFAULT 0,
	"products_collected" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_sellers" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"asin" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"brand" text,
	"category" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"rating" real,
	"review_count" integer DEFAULT 0,
	"availability" text,
	"currency" text DEFAULT 'USD',
	"specifications" jsonb,
	"features" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_asin_unique" UNIQUE("asin")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"text" text,
	"author" text,
	"author_id" text,
	"date" timestamp,
	"verified" boolean DEFAULT false,
	"helpful_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "job_type" NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"is_scheduled" boolean DEFAULT false,
	"api_calls_used" integer DEFAULT 0,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rating" real,
	"feedback_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sellers" ADD CONSTRAINT "product_sellers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sellers" ADD CONSTRAINT "product_sellers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_usage_month_idx" ON "api_usage" USING btree ("month");--> statement-breakpoint
CREATE INDEX "prices_product_id_idx" ON "prices" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "prices_collected_at_idx" ON "prices" USING btree ("collected_at");--> statement-breakpoint
CREATE INDEX "product_searches_query_idx" ON "product_searches" USING btree ("query");--> statement-breakpoint
CREATE INDEX "products_asin_idx" ON "products" USING btree ("asin");--> statement-breakpoint
CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reviews_product_id_idx" ON "reviews" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "reviews_date_idx" ON "reviews" USING btree ("date");--> statement-breakpoint
CREATE INDEX "scrape_jobs_status_idx" ON "scrape_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scrape_jobs_type_idx" ON "scrape_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "scrape_jobs_created_at_idx" ON "scrape_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sellers_name_idx" ON "sellers" USING btree ("name");