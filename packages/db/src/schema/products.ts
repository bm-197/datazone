import {
	pgTable,
	text,
	timestamp,
	real,
	integer,
	jsonb,
	pgEnum,
	boolean,
	index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Job status enum
export const jobStatusEnum = pgEnum("job_status", [
	"pending",
	"running",
	"completed",
	"failed",
	"suspended",
]);

// Job type enum
export const jobTypeEnum = pgEnum("job_type", [
	"product",
	"search",
	"review",
	"price_update",
]);

// Products table
export const products = pgTable(
	"products",
	{
		id: text("id").primaryKey(),
		asin: text("asin").notNull().unique(),
		title: text("title").notNull(),
		description: text("description"),
		brand: text("brand"),
		category: text("category"),
		images: jsonb("images").$type<string[]>().default([]),
		rating: real("rating"),
		reviewCount: integer("review_count").default(0),
		availability: text("availability"),
		currency: text("currency").default("USD"),
		specifications: jsonb("specifications").$type<Record<string, string>>(),
		features: jsonb("features").$type<string[]>().default([]),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => ({
		asinIdx: index("products_asin_idx").on(table.asin),
		createdAtIdx: index("products_created_at_idx").on(table.createdAt),
	}),
);

// Prices table (price history)
export const prices = pgTable(
	"prices",
	{
		id: text("id").primaryKey(),
		productId: text("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		price: real("price").notNull(),
		originalPrice: real("original_price"),
		currency: text("currency").default("USD"),
		availability: text("availability"),
		sellerName: text("seller_name"),
		sellerRating: real("seller_rating"),
		primeEligible: boolean("prime_eligible").default(false),
		collectedAt: timestamp("collected_at").notNull().defaultNow(),
	},
	(table) => ({
		productIdIdx: index("prices_product_id_idx").on(table.productId),
		collectedAtIdx: index("prices_collected_at_idx").on(table.collectedAt),
	}),
);

// Reviews table
export const reviews = pgTable(
	"reviews",
	{
		id: text("id").primaryKey(),
		productId: text("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		rating: integer("rating").notNull(),
		title: text("title"),
		text: text("text"),
		author: text("author"),
		authorId: text("author_id"),
		date: timestamp("date"),
		verified: boolean("verified").default(false),
		helpfulCount: integer("helpful_count").default(0),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => ({
		productIdIdx: index("reviews_product_id_idx").on(table.productId),
		dateIdx: index("reviews_date_idx").on(table.date),
	}),
);

// Sellers table
export const sellers = pgTable(
	"sellers",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		rating: real("rating"),
		feedbackCount: integer("feedback_count").default(0),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => ({
		nameIdx: index("sellers_name_idx").on(table.name),
	}),
);

// Product-Seller junction table (many-to-many)
export const productSellers = pgTable("product_sellers", {
	id: text("id").primaryKey(),
	productId: text("product_id")
		.notNull()
		.references(() => products.id, { onDelete: "cascade" }),
	sellerId: text("seller_id")
		.notNull()
		.references(() => sellers.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Product searches table
export const productSearches = pgTable(
	"product_searches",
	{
		id: text("id").primaryKey(),
		query: text("query").notNull(),
		totalResults: integer("total_results").default(0),
		productsCollected: integer("products_collected").default(0),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => ({
		queryIdx: index("product_searches_query_idx").on(table.query),
	}),
);

// Scrape jobs table
export const scrapeJobs = pgTable(
	"scrape_jobs",
	{
		id: text("id").primaryKey(),
		type: jobTypeEnum("type").notNull(),
		status: jobStatusEnum("status").notNull().default("pending"),
		input: jsonb("input").$type<Record<string, any>>(),
		output: jsonb("output").$type<Record<string, any>>(),
		error: text("error"),
		isScheduled: boolean("is_scheduled").default(false),
		apiCallsUsed: integer("api_calls_used").default(0),
		startedAt: timestamp("started_at"),
		completedAt: timestamp("completed_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => ({
		statusIdx: index("scrape_jobs_status_idx").on(table.status),
		typeIdx: index("scrape_jobs_type_idx").on(table.type),
		createdAtIdx: index("scrape_jobs_created_at_idx").on(table.createdAt),
	}),
);

// API usage tracking table
export const apiUsage = pgTable(
	"api_usage",
	{
		id: text("id").primaryKey(),
		month: text("month").notNull(), // Format: YYYY-MM
		callsUsed: integer("calls_used").default(0),
		callsLimit: integer("calls_limit").default(1000),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => ({
		monthIdx: index("api_usage_month_idx").on(table.month),
	}),
);

// Relations
export const productsRelations = relations(products, ({ many }) => ({
	prices: many(prices),
	reviews: many(reviews),
	productSellers: many(productSellers),
}));

export const pricesRelations = relations(prices, ({ one }) => ({
	product: one(products, {
		fields: [prices.productId],
		references: [products.id],
	}),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
	product: one(products, {
		fields: [reviews.productId],
		references: [products.id],
	}),
}));

export const sellersRelations = relations(sellers, ({ many }) => ({
	productSellers: many(productSellers),
}));

export const productSellersRelations = relations(productSellers, ({ one }) => ({
	product: one(products, {
		fields: [productSellers.productId],
		references: [products.id],
	}),
	seller: one(sellers, {
		fields: [productSellers.sellerId],
		references: [sellers.id],
	}),
}));

