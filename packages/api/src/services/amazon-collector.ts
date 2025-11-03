import { ScraperAPIClient } from "./scraperapi-client.js";
import type {
	ProductData,
	SearchResponse,
	ReviewsResponse,
} from "../types/scraperapi.js";
import type { UsageTracker } from "./usage-tracker.js";

export interface CollectProductOptions {
	asin: string;
}

export interface CollectSearchOptions {
	keyword: string;
	limit?: number;
	country?: string;
}

export interface CollectReviewsOptions {
	asin: string;
	limit?: number;
}

export class AmazonCollector {
	private client: ScraperAPIClient;
	private usageTracker?: UsageTracker;

	constructor(client: ScraperAPIClient, usageTracker?: UsageTracker) {
		this.client = client;
		this.usageTracker = usageTracker;
	}

	/**
	 * Collect single product by ASIN
	 */
	async collectProductByASIN(
		options: CollectProductOptions,
	): Promise<ProductData | null> {
		await this.checkUsageLimit();

		const product = await this.client.getProductByASIN(options.asin);
		await this.trackUsage(1);

		return product;
	}

	/**
	 * Collect products by search keyword
	 */
	async collectProductsBySearch(
		options: CollectSearchOptions,
	): Promise<ProductData[]> {
		await this.checkUsageLimit();

		console.log(`[AmazonCollector] Searching for keyword: "${options.keyword}"`);

		const response = await this.client.searchProducts(
			options.keyword,
			options.country || "us",
		);
		await this.trackUsage(1);

		console.log(`[AmazonCollector] Received ${response.products.length} products from search`);

		// Limit results if specified
		if (options.limit) {
			const limited = response.products.slice(0, options.limit);
			console.log(`[AmazonCollector] Limited to ${limited.length} products`);
			return limited;
		}

		return response.products;
	}

	/**
	 * Collect reviews for a product
	 */
	async collectReviews(
		options: CollectReviewsOptions,
	): Promise<ReviewsResponse> {
		await this.checkUsageLimit();

		const response = await this.client.getProductReviews(
			options.asin,
			1, // Start with first page
		);
		await this.trackUsage(1);

		// If limit is specified and we need more pages, fetch additional pages
		if (options.limit && response.reviews.length < options.limit) {
			let currentPage = 2;
			let allReviews = [...response.reviews];

			while (
				allReviews.length < options.limit &&
				currentPage <= 5
			) {
				// Limit to 5 pages max
				await this.checkUsageLimit();

				const pageResponse = await this.client.getProductReviews(
					options.asin,
					currentPage,
				);
				await this.trackUsage(1);

				allReviews = [...allReviews, ...pageResponse.reviews];

				if (pageResponse.reviews.length === 0) {
					break; // No more reviews
				}

				currentPage++;
			}

			return {
				reviews: allReviews.slice(0, options.limit),
				averageRating: response.averageRating,
				totalReviews: response.totalReviews,
			};
		}

		// Limit reviews if specified
		if (options.limit) {
			return {
				...response,
				reviews: response.reviews.slice(0, options.limit),
			};
		}

		return response;
	}

	/**
	 * Track price history by collecting product multiple times
	 * Note: This would typically be done over time via scheduled jobs
	 */
	async collectPriceHistory(asin: string): Promise<ProductData> {
		return this.collectProductByASIN({ asin });
	}

	/**
	 * Check if we can make API calls (within free tier limit)
	 */
	private async checkUsageLimit(): Promise<void> {
		if (!this.usageTracker) {
			return; // No tracker, allow all calls
		}

		const canMakeCall = await this.usageTracker.canMakeCall();
		if (!canMakeCall) {
			throw new Error(
				"API usage limit reached. Please wait until next month or upgrade plan.",
			);
		}
	}

	/**
	 * Track API usage
	 */
	private async trackUsage(calls: number): Promise<void> {
		if (this.usageTracker) {
			await this.usageTracker.recordUsage(calls);
		}
	}
}

