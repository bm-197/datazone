// Export services
export { ScraperAPIClient } from "./services/scraperapi-client.js";
export { AmazonCollector } from "./services/amazon-collector.js";
export { DataProcessor } from "./services/data-processor.js";
export { UsageTracker } from "./services/usage-tracker.js";
export { JobQueue } from "./services/job-queue.js";
export { JobScheduler } from "./services/scheduler.js";
export { getRedisConnection, closeRedisConnection } from "./services/redis-connection.js";

// Export types
export type {
	ProductData,
	SearchResponse,
	ReviewsResponse,
	ScraperAPIError,
} from "./types/scraperapi.js";

export type {
	ProcessedProduct,
	ProcessedPrice,
	ProcessedReview,
	ProcessedSeller,
} from "./services/data-processor.js";

export type { JobData, JobOptions } from "./services/job-queue.js";

// Export schemas
export {
	productDataSchema,
	searchResponseSchema,
	reviewDataSchema,
	reviewsResponseSchema,
} from "./schemas/scraperapi.schema.js";

