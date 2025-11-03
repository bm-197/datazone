// ScraperAPI response types

export interface ProductData {
	asin: string;
	title: string;
	description?: string;
	price?: {
		current: number;
		original?: number;
		currency: string;
	};
	images?: string[];
	rating?: {
		value: number;
		count: number;
	};
	availability?: string;
	seller?: {
		name: string;
		rating?: number;
	};
	specifications?: Record<string, string>;
	features?: string[];
	brand?: string;
	category?: string;
}

export interface SearchResponse {
	products: ProductData[];
	totalResults: number;
	query: string;
}

export interface ReviewData {
	rating: number;
	title?: string;
	text: string;
	author: string;
	date?: string;
	verified?: boolean;
	helpfulCount?: number;
}

export interface ReviewsResponse {
	reviews: ReviewData[];
	averageRating: number;
	totalReviews: number;
}

export interface ScraperAPIError {
	message: string;
	code?: string;
	status?: number;
}

