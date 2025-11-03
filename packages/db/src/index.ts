import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "./schema/auth";
import * as productsSchema from "./schema/products";

export const db = drizzle(process.env.DATABASE_URL || "");

// Export all schemas
export const schema = {
	...authSchema,
	...productsSchema,
};

// Re-export commonly used drizzle-orm functions
export {
	eq,
	ne,
	gt,
	gte,
	lt,
	lte,
	like,
	ilike,
	not,
	and,
	or,
	inArray,
	notInArray,
	isNull,
	isNotNull,
	desc,
	asc,
	count,
	sum,
	avg,
	max,
	min,
	sql,
} from "drizzle-orm";

// Re-export commonly used tables for convenience
export {
	user,
	session,
	account,
	verification,
} from "./schema/auth";

export {
	products,
	prices,
	reviews,
	sellers,
	productSellers,
	productSearches,
	scrapeJobs,
	apiUsage,
	jobStatusEnum,
	jobTypeEnum,
} from "./schema/products";
