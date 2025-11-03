import type { ProductData, ReviewsResponse } from "../types/scraperapi.js";
import { nanoid } from "nanoid";

export interface ProcessedProduct {
	id: string;
	asin: string;
	title: string;
	description?: string;
	brand?: string;
	category?: string;
	images: string[];
	rating?: number;
	reviewCount: number;
	availability?: string;
	currency: string;
	specifications?: Record<string, string>;
	features: string[];
}

export interface ProcessedPrice {
	id: string;
	productId: string;
	price: number;
	originalPrice?: number;
	currency: string;
	availability?: string;
	sellerName?: string;
	sellerRating?: number;
	primeEligible: boolean;
}

export interface ProcessedReview {
	id: string;
	productId: string;
	rating: number;
	title?: string;
	text: string;
	author: string;
	date?: Date;
	verified: boolean;
	helpfulCount: number;
}

export interface ProcessedSeller {
	id: string;
	name: string;
	rating?: number;
	feedbackCount: number;
}

export class DataProcessor {
	/**
	 * Process product data from ScraperAPI to database format
	 */
	processProduct(
		data: ProductData,
		productId?: string,
	): ProcessedProduct {
		const id = productId || nanoid();

		return {
			id,
			asin: this.validateASIN(data.asin),
			title: this.normalizeText(data.title),
			description: data.description
				? this.normalizeText(data.description)
				: undefined,
			brand: data.brand ? this.normalizeText(data.brand) : undefined,
			category: data.category ? this.normalizeText(data.category) : undefined,
			images: this.normalizeImages(data.images || []),
			rating: data.rating?.value,
			reviewCount: data.rating?.count || 0,
			availability: data.availability
				? this.normalizeText(data.availability)
				: undefined,
			currency: data.price?.currency || "USD",
			specifications: data.specifications || {},
			features: data.features || [],
		};
	}

	/**
	 * Process price data from product data
	 */
	processPrice(
		productData: ProductData,
		productId: string,
	): ProcessedPrice | null {
		if (!productData.price) {
			return null;
		}

		return {
			id: nanoid(),
			productId,
			price: productData.price.current,
			originalPrice: productData.price.original,
			currency: productData.price.currency || "USD",
			availability: productData.availability
				? this.normalizeText(productData.availability)
				: undefined,
			sellerName: productData.seller?.name,
			sellerRating: productData.seller?.rating,
			primeEligible: false, // Would need to parse from availability or separate field
		};
	}

	/**
	 * Process reviews data
	 */
	processReviews(
		reviewsData: ReviewsResponse,
		productId: string,
	): ProcessedReview[] {
		return reviewsData.reviews
			.filter((review) => {
				// Filter out invalid reviews
				if (!review.text || review.text.trim() === "") {
					return false;
				}
				if (!review.rating || review.rating < 1 || review.rating > 5) {
					return false;
				}
				return true;
			})
			.map((review) => {
				try {
					return {
						id: nanoid(),
						productId,
						rating: this.validateRating(review.rating),
						title: review.title ? this.normalizeText(review.title) : undefined,
						text: this.normalizeText(review.text),
						author: this.normalizeText(review.author || "Anonymous"),
						date: review.date ? this.parseDate(review.date) : undefined,
						verified: review.verified || false,
						helpfulCount: review.helpfulCount || 0,
					};
				} catch (error) {
					console.warn(`[DataProcessor] Error processing review:`, error, review);
					return null;
				}
			})
			.filter((review) => review !== null) as ProcessedReview[];
	}

	/**
	 * Process seller data
	 */
	processSeller(sellerData: {
		name: string;
		rating?: number;
	}): ProcessedSeller {
		return {
			id: nanoid(),
			name: this.normalizeText(sellerData.name),
			rating: sellerData.rating,
			feedbackCount: 0, // Not available from ScraperAPI directly
		};
	}

	/**
	 * Validate ASIN format
	 */
	private validateASIN(asin: string): string {
		if (!asin || typeof asin !== "string") {
			throw new Error(`Invalid ASIN: must be a non-empty string`);
		}
		const cleaned = asin.trim().toUpperCase();
		if (!/^B[A-Z0-9]{9}$/.test(cleaned)) {
			throw new Error(`Invalid ASIN format: ${asin}`);
		}
		return cleaned;
	}

	/**
	 * Check if ASIN is valid format (without throwing)
	 */
	isValidASIN(asin: string | undefined | null): boolean {
		if (!asin || typeof asin !== "string") {
			return false;
		}
		const cleaned = asin.trim().toUpperCase();
		return /^B[A-Z0-9]{9}$/.test(cleaned);
	}

	/**
	 * Validate rating (1-5)
	 */
	private validateRating(rating: number): number {
		if (rating < 1 || rating > 5) {
			throw new Error(`Invalid rating: ${rating}. Must be between 1 and 5.`);
		}
		return rating;
	}

	/**
	 * Normalize text (trim, remove extra whitespace)
	 */
	private normalizeText(text: string): string {
		return text.trim().replace(/\s+/g, " ");
	}

	/**
	 * Normalize images array
	 */
	private normalizeImages(images: string[]): string[] {
		return images.filter((img) => {
			try {
				new URL(img);
				return true;
			} catch {
				return false;
			}
		});
	}

	/**
	 * Parse date string to Date object
	 * Handles formats like:
	 * - "Reviewed in the United States on October 22, 2023"
	 * - "2023-10-22"
	 * - ISO date strings
	 */
	private parseDate(dateString: string): Date | undefined {
		if (!dateString || typeof dateString !== "string") {
			return undefined;
		}

		try {
			// Handle ScraperAPI date format: "Reviewed in the United States on October 22, 2023"
			if (dateString.includes("Reviewed") || dateString.includes("on ")) {
				// Extract date part after "on "
				const dateMatch = dateString.match(/on\s+(\w+\s+\d+,\s+\d+)/);
				if (dateMatch && dateMatch[1]) {
					const date = new Date(dateMatch[1]);
					if (!isNaN(date.getTime())) {
						return date;
					}
				}
			}

			// Try standard Date parsing
			const date = new Date(dateString);
			if (!isNaN(date.getTime())) {
				return date;
			}

			return undefined;
		} catch {
			return undefined;
		}
	}
}

