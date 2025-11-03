import { z } from "zod";


// Helper function to parse price strings like "$171.95" to numbers
const parsePriceString = (price: unknown): number | undefined => {
	if (typeof price === "number") {
		return price;
	}
	if (typeof price === "string") {
		// Remove currency symbols, commas, and whitespace, then parse
		const cleaned = price.replace(/[$,€£¥₹\s,]/g, "");
		const parsed = parseFloat(cleaned);
		return isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
};

// Flexible schema that accepts ScraperAPI's actual response structure
// ASIN is optional because some products may not have it, but we'll filter those out
const rawProductSchema = z.object({
	asin: z.string().optional(), // Make optional - we'll filter out products without ASIN
	title: z.string().optional(), // Can be missing
	name: z.string().optional(), // Alternative field name
	productName: z.string().optional(), // Another alternative
	description: z.string().optional(),
	// Price can be a number, string, or an object
	price: z.union([
		z.number(),
		z.string(),
		z.object({
			current: z.number(),
			original: z.number().optional(),
			currency: z.string().optional(),
		}),
	]).optional(),
	// ScraperAPI also returns pricing and list_price as strings
	pricing: z.union([z.string(), z.number()]).optional(), // Current price as string "$171.95"
	list_price: z.union([z.string(), z.number()]).optional(), // Original/list price as string "$188.00"
	currentPrice: z.number().optional(), // Alternative field
	originalPrice: z.number().optional(),
	currency: z.string().optional(),
	images: z.array(z.string()).optional(),
	image: z.string().optional(), // Single image
	imageUrls: z.array(z.string()).optional(), // Alternative field name
	rating: z.union([
		z.number(), // Can be just a number
		z.object({
			value: z.number(),
			count: z.number(),
		}),
	]).optional(),
	averageRating: z.number().optional(), // Alternative field
	reviewCount: z.number().optional(), // Alternative field
	availability: z.string().optional(),
	seller: z.union([
		z.string(), // Can be just a string
		z.object({
			name: z.string(),
			rating: z.number().optional(),
		}),
	]).optional(),
	sellerName: z.string().optional(), // Alternative field
	specifications: z.record(z.string(), z.string()).optional(),
	features: z.array(z.string()).optional(),
	brand: z.string().optional(),
	category: z.string().optional(),
});

// Transform to our normalized structure - only processes products WITH ASIN
export const productDataSchema = rawProductSchema
	.refine((data) => data.asin && typeof data.asin === "string" && data.asin.trim() !== "", {
		message: "Product must have a valid ASIN",
	})
	.transform((data) => {
		// Get title from various possible fields
		const title = data.title || data.name || data.productName || "Untitled Product";
		
		// Normalize price - handle number, string, object formats, and ScraperAPI-specific fields
		let priceObj: {
			current: number;
			original?: number;
			currency: string;
		} | undefined;
		
		// Try to extract current price from various fields
		let currentPrice: number | undefined;
		let originalPrice: number | undefined;
		
		// Priority order: pricing (ScraperAPI field) > price > currentPrice
		if (data.pricing !== undefined) {
			currentPrice = parsePriceString(data.pricing);
		} else if (typeof data.price === "number") {
			currentPrice = data.price;
		} else if (typeof data.price === "string") {
			currentPrice = parsePriceString(data.price);
		} else if (data.price && typeof data.price === "object") {
			currentPrice = data.price.current;
			originalPrice = data.price.original;
		} else if (data.currentPrice !== undefined) {
			currentPrice = typeof data.currentPrice === "number" ? data.currentPrice : parsePriceString(data.currentPrice);
		}
		
		// Try to extract original price from various fields
		if (!originalPrice) {
			if (data.list_price !== undefined) {
				originalPrice = parsePriceString(data.list_price);
			} else if (data.originalPrice !== undefined) {
				originalPrice = typeof data.originalPrice === "number" ? data.originalPrice : parsePriceString(data.originalPrice);
			}
		}
		
		// Create price object if we have a current price
		if (currentPrice !== undefined) {
			priceObj = {
				current: currentPrice,
				original: originalPrice,
				currency: data.currency || "USD",
			};
		}
		
		// Normalize rating - handle both number and object formats
		let ratingObj: { value: number; count: number } | undefined;
		if (typeof data.rating === "number") {
			ratingObj = {
				value: data.rating,
				count: data.reviewCount || 0,
			};
		} else if (data.rating && typeof data.rating === "object") {
			ratingObj = data.rating;
		} else if (data.averageRating !== undefined) {
			ratingObj = {
				value: data.averageRating,
				count: data.reviewCount || 0,
			};
		}
		
		// Normalize seller
		let sellerObj: { name: string; rating?: number } | undefined;
		if (typeof data.seller === "string") {
			sellerObj = { name: data.seller };
		} else if (data.seller && typeof data.seller === "object") {
			sellerObj = data.seller;
		} else if (data.sellerName) {
			sellerObj = { name: data.sellerName };
		}
		
		// Normalize images
		const images = data.images || data.imageUrls || (data.image ? [data.image] : []);
		
		return {
			asin: data.asin!,
			title,
			description: data.description,
			price: priceObj,
			images,
			rating: ratingObj,
			availability: data.availability,
			seller: sellerObj,
			specifications: data.specifications,
			features: data.features,
			brand: data.brand,
			category: data.category,
		};
	});

export const searchResponseSchema = z
	.object({
		products: z.array(rawProductSchema).optional(), // Use raw schema here - we'll validate individually
		totalResults: z.number().optional(),
		query: z.string().optional(),
	})
	.transform((data) => {
		// Validate products individually, filtering out invalid ones
		const rawProducts = data.products ?? [];
		const validProducts: z.infer<typeof productDataSchema>[] = [];
		let skippedCount = 0;
		
		for (const rawProduct of rawProducts) {
			// Try to validate each product
			const result = productDataSchema.safeParse(rawProduct);
			if (result.success) {
				validProducts.push(result.data);
			} else {
				skippedCount++;
				console.warn(`Skipping product without ASIN or validation error:`, result.error.format());
			}
		}
		
		if (skippedCount > 0) {
			console.log(`Filtered out ${skippedCount} invalid products (missing ASIN or other issues)`);
		}
		
		return {
			products: validProducts,
			totalResults: data.totalResults ?? validProducts.length,
			query: data.query ?? "",
		};
	});

export const reviewDataSchema = z.object({
	rating: z.union([
		z.number().min(1).max(5),
		z.string().transform((val) => {
			const num = parseFloat(val);
			return isNaN(num) ? 0 : Math.max(1, Math.min(5, num));
		}),
	]).transform((val) => typeof val === "number" ? val : parseFloat(val)),
	title: z.string().optional().or(z.undefined()),
	text: z.string().or(z.undefined()).default(""),
	author: z.string().or(z.undefined()).default("Anonymous"),
	date: z.string().optional().or(z.undefined()),
	verified: z.boolean().optional().or(z.undefined()),
	helpfulCount: z.union([z.number(), z.string()]).optional().transform((val) => {
		if (val === undefined || val === null) return undefined;
		const num = typeof val === "string" ? parseFloat(val) : val;
		return isNaN(num) ? undefined : num;
	}),
}).transform((data) => ({
	rating: typeof data.rating === "number" ? data.rating : parseFloat(String(data.rating)) || 0,
	title: data.title || undefined,
	text: data.text || "",
	author: data.author || "Anonymous",
	date: data.date || undefined,
	verified: data.verified || false,
	helpfulCount: data.helpfulCount,
}));

export const reviewsResponseSchema = z.object({
	reviews: z.array(reviewDataSchema).optional().default([]),
	averageRating: z.union([z.number(), z.string()]).optional().transform((val) => {
		if (val === undefined || val === null) return 0;
		const num = typeof val === "string" ? parseFloat(val) : val;
		return isNaN(num) ? 0 : num;
	}).default(0),
	totalReviews: z.union([z.number(), z.string()]).optional().transform((val) => {
		if (val === undefined || val === null) return 0;
		const num = typeof val === "string" ? parseInt(val, 10) : val;
		return isNaN(num) ? 0 : num;
	}).default(0),
}).transform((data) => ({
	reviews: Array.isArray(data.reviews) ? data.reviews : [],
	averageRating: typeof data.averageRating === "number" ? data.averageRating : parseFloat(String(data.averageRating)) || 0,
	totalReviews: typeof data.totalReviews === "number" ? data.totalReviews : parseInt(String(data.totalReviews), 10) || 0,
}));

