import type {
	ProductData,
	SearchResponse,
	ReviewsResponse,
} from "../types/scraperapi.js";
import {
	productDataSchema,
	searchResponseSchema,
	reviewsResponseSchema,
} from "../schemas/scraperapi.schema.js";

export class ScraperAPIClient {
	private apiKey: string;
	private baseUrl: string;

	constructor(apiKey: string, baseUrl ="https://api.scraperapi.com") {
		this.apiKey = apiKey;
		this.baseUrl = baseUrl;
	}

	/**
	 * Get product data by ASIN
	 */
	async getProductByASIN(asin: string): Promise<ProductData | null> {
		const endpoint = "/structured/amazon/product";
		const params = new URLSearchParams({
			api_key: this.apiKey,
			asin: asin,
		});

		console.log(`[ScraperAPIClient] Fetching product data for ASIN: ${asin}`);

		const response = await this.makeRequest<any>(
			endpoint,
			params,
		);

		console.log(`[ScraperAPIClient] Received response for ASIN ${asin}:`, {
			hasResponse: !!response,
			hasAsin: !!(response?.asin),
			hasNestedAsin: !!(response?.product_information?.asin),
			asinInResponse: response?.asin || response?.product_information?.asin,
			hasTitle: !!(response?.title || response?.name || response?.productName),
			hasPrice: !!(response?.price || response?.pricing || response?.currentPrice),
			priceValue: response?.price || response?.pricing || response?.currentPrice || "N/A",
			listPrice: response?.list_price || response?.originalPrice || "N/A",
			hasReviews: !!(response?.reviews && Array.isArray(response.reviews)),
			reviewsCount: response?.reviews?.length || 0,
			responseKeys: response ? Object.keys(response) : [],
		});

		// Normalize response - extract ASIN from nested structure if needed
		let normalizedResponse = { ...response };
		
		// If ASIN is nested in product_information, move it to root
		if (!normalizedResponse.asin && normalizedResponse.product_information?.asin) {
			console.log(`[ScraperAPIClient] Extracting ASIN from nested product_information`);
			normalizedResponse.asin = normalizedResponse.product_information.asin;
		}
		
		// If we still don't have ASIN, use the requested one
		if (!normalizedResponse.asin && asin) {
			console.log(`[ScraperAPIClient] ASIN not in response, using requested ASIN: ${asin}`);
			normalizedResponse.asin = asin;
		}

		// Validate response with safeParse to handle missing/invalid ASINs gracefully
		const validationResult = productDataSchema.safeParse(normalizedResponse);
		
		if (!validationResult.success) {
			console.warn(`[ScraperAPIClient] Product data validation failed for ASIN ${asin}:`, validationResult.error.format());
			console.warn(`[ScraperAPIClient] Normalized response:`, JSON.stringify(normalizedResponse, null, 2));
			
			// Return null if validation fails - caller should use fallback data
			return null;
		}

		const validatedData = validationResult.data;
		
		// Attach reviews to the validated data if they exist in the response
		if (response.reviews && Array.isArray(response.reviews) && response.reviews.length > 0) {
			console.log(`[ScraperAPIClient] Found ${response.reviews.length} reviews in product response`);
			(validatedData as any)._reviews = response.reviews;
			(validatedData as any)._averageRating = response.average_rating || response.averageRating || 0;
			(validatedData as any)._totalReviews = response.total_reviews || response.totalReviews || response.reviews.length;
		}

		console.log(`[ScraperAPIClient] Successfully validated product data for ASIN ${asin}`);
		return validatedData;
	}

	/**
	 * Search for products by query
	 */
	async searchProducts(
		query: string,
		country = "us",
	): Promise<SearchResponse> {
		const endpoint = "/structured/amazon/search";
		const params = new URLSearchParams({
			api_key: this.apiKey,
			query: query,
			country: country,
		});

		const response = await this.makeRequest<any>(
			endpoint,
			params,
		);

		// Handle different response structures
		let parsedResponse: any;
		
		// Check if response is null or undefined
		if (!response || typeof response !== "object") {
			console.warn("ScraperAPI returned invalid response:", response);
			parsedResponse = {
				products: [],
				totalResults: 0,
				query: query,
			};
		} else if (Array.isArray(response)) {
			// If response is directly an array
			parsedResponse = {
				products: response,
				totalResults: response.length,
				query: query,
			};
		} else if (response.results && !response.products) {
			// Some APIs return results instead of products
			parsedResponse = {
				products: Array.isArray(response.results) ? response.results : [],
				totalResults: response.totalResults || response.total || (Array.isArray(response.results) ? response.results.length : 0),
				query: response.query || query,
			};
		} else if (!response.products && !response.results) {
			// Empty or unexpected structure
			console.warn("ScraperAPI response missing products/results:", response);
			parsedResponse = {
				products: [],
				totalResults: 0,
				query: query,
			};
		} else {
			// Ensure query is set and products is an array
			parsedResponse = {
				products: Array.isArray(response.products) ? response.products : [],
				totalResults: response.totalResults ?? (Array.isArray(response.products) ? response.products.length : 0),
				query: response.query || query,
			};
		}

		// Validate and transform with schema
		// Note: The schema now handles partial failures gracefully by filtering out invalid products
		try {
			const validated = searchResponseSchema.parse(parsedResponse);
			console.log(`[ScraperAPIClient] Validated ${validated.products.length} products from search`);
			return validated;
		} catch (error) {
			// This should rarely happen now since we handle partial failures in the schema transform
			console.error("Schema validation failed for search response:", {
				error,
				parsedResponse,
				originalResponse: response,
			});
			// Return safe defaults
			return {
				products: [],
				totalResults: 0,
				query: query,
			};
		}
	}

	/**
	 * Get product reviews by ASIN
	 */
	async getProductReviews(
		asin: string,
		page = 1,
	): Promise<ReviewsResponse> {
		const endpoint = "/structured/amazon/reviews";
		const params = new URLSearchParams({
			api_key: this.apiKey,
			asin: asin,
			page: page.toString(),
		});

		console.log(`[ScraperAPIClient] Fetching reviews for ASIN: ${asin}, page: ${page}`);

		try {
			const response = await this.makeRequest<any>(
				endpoint,
				params,
			);

			console.log(`[ScraperAPIClient] Received reviews response:`, {
				hasReviews: !!response.reviews,
				reviewsCount: Array.isArray(response.reviews) ? response.reviews.length : 0,
				averageRating: response.averageRating,
				totalReviews: response.totalReviews,
			});

			// Validate response with safeParse to handle errors gracefully
			const validationResult = reviewsResponseSchema.safeParse(response);

			if (!validationResult.success) {
				console.warn(`[ScraperAPIClient] Reviews validation failed for ASIN ${asin}:`, validationResult.error.format());
				console.warn(`[ScraperAPIClient] Original response:`, JSON.stringify(response, null, 2));
				
				// Return safe defaults instead of throwing
				return {
					reviews: [],
					averageRating: 0,
					totalReviews: 0,
				};
			}

			console.log(`[ScraperAPIClient] Validated ${validationResult.data.reviews.length} reviews`);
			return validationResult.data;
		} catch (error) {
			// Handle 404 or other errors gracefully
			if (error instanceof Error && error.message.includes("404")) {
				console.warn(`[ScraperAPIClient] Reviews endpoint not available (404) for ASIN ${asin}. This endpoint may not be available in your ScraperAPI plan.`);
				console.warn(`[ScraperAPIClient] Reviews collection will be skipped for this product.`);
				return {
					reviews: [],
					averageRating: 0,
					totalReviews: 0,
				};
			}
			
			// For other errors, log and return empty reviews
			console.warn(`[ScraperAPIClient] Error fetching reviews for ASIN ${asin}:`, error);
			return {
				reviews: [],
				averageRating: 0,
				totalReviews: 0,
			};
		}
	}

	/**
	 * Make HTTP request to ScraperAPI
	 */
	private async makeRequest<T>(
		endpoint: string,
		params: URLSearchParams,
		maxRetries = 3,
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}?${params.toString()}`;

		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const response = await fetch(url, {
					method: "GET",
					headers: {
						"Content-Type": "application/json",
					},
				});

				if (!response.ok) {
					if (response.status === 429) {
						// Rate limited - wait and retry
						const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
						if (attempt < maxRetries) {
							await this.sleep(waitTime);
							continue;
						}
					}

					const errorText = await response.text();
					throw new Error(
						`ScraperAPI error (${response.status}): ${errorText}`,
					);
				}

				const data = await response.json();
				return data as T;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// If it's a network error, retry with exponential backoff
				if (attempt < maxRetries) {
					const waitTime = Math.pow(2, attempt) * 1000;
					await this.sleep(waitTime);
					continue;
				}
			}
		}

		throw lastError || new Error("Unknown error occurred");
	}

	/**
	 * Sleep utility for retries
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

