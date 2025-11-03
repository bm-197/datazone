import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { z } from "zod";
import {
	ScraperAPIClient,
	AmazonCollector,
	DataProcessor,
	UsageTracker,
	JobQueue,
	JobScheduler,
	type JobData,
} from "@datazone/api";
import { db, products, prices, reviews, scrapeJobs, eq, desc, and } from "@datazone/db";

const router: ExpressRouter = Router();

const apiKey = process.env.SCRAPERAPI_API_KEY || "";
const client = new ScraperAPIClient(apiKey);
const usageTracker = new UsageTracker(
	parseInt(process.env.SCRAPERAPI_FREE_TIER_LIMIT || "1000"),
);
const collector = new AmazonCollector(client, usageTracker);
const processor = new DataProcessor();
const jobQueue = new JobQueue();
const scheduler = new JobScheduler(jobQueue, collector, processor);

const collectProductSchema = z.object({
	asin: z.string().optional(),
	keyword: z.string().optional(),
	limit: z.number().optional(),
	country: z.string().optional(),
});

const trackProductSchema = z.object({
	asin: z.string(),
	cronPattern: z.string().optional(),
});

router.post("/collect", async (req, res) => {
	try {
		const data = collectProductSchema.parse(req.body);
		const jobData: JobData = {
			type: data.asin ? "product" : "search",
			asin: data.asin,
			keyword: data.keyword,
			limit: data.limit,
			country: data.country,
		};

		const jobId = await scheduler.triggerManualCollection(jobData);

		res.json({
			success: true,
			jobId,
			message: "Collection job queued",
		});
	} catch (error) {
		console.error("Error triggering collection:", error);
		res.status(400).json({
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown error",
		});
	}
});


router.get("/", async (req, res) => {
	try {
		const page = parseInt(req.query.page as string) || 1;
		const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
		const offset = (page - 1) * limit;
		const search = req.query.search as string;

		let query = db.select().from(products);

		if (search) {
			query = db
				.select()
				.from(products)
				.where(
					and(
						eq(products.title, `%${search}%`),
					),
				) as any;
		}

		// Order by newest first (createdAt descending)
		const allProducts = await query
			.orderBy(desc(products.createdAt))
			.limit(limit)
			.offset(offset);
		const total = await db.select().from(products);

		res.json({
			products: allProducts,
			pagination: {
				page,
				limit,
				total: total.length,
				totalPages: Math.ceil(total.length / limit),
			},
		});
	} catch (error) {
		console.error("Error fetching products:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch products",
		});
	}
});


router.get("/:asin", async (req, res) => {
	try {
		const asin = req.params.asin;

		const product = await db
			.select()
			.from(products)
			.where(eq(products.asin, asin))
			.limit(1);

		if (product.length === 0) {
			return res.status(404).json({
				success: false,
				error: "Product not found",
			});
		}

		const priceHistory = await db
			.select()
			.from(prices)
			.where(eq(prices.productId, product[0].id))
			.orderBy(desc(prices.collectedAt))
			.limit(30);

		const productReviews = await db
			.select()
			.from(reviews)
			.where(eq(reviews.productId, product[0].id))
			.orderBy(desc(reviews.date))
			.limit(50);

		console.log(`[Products API] Product ${asin} - Found ${productReviews.length} reviews`);

		res.json({
			product: product[0],
			priceHistory,
			reviews: productReviews,
		});
	} catch (error) {
		console.error("Error fetching product:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch product",
		});
	}
});


router.get("/:asin/prices", async (req, res) => {
	try {
		const asin = req.params.asin;

		const product = await db
			.select()
			.from(products)
			.where(eq(products.asin, asin))
			.limit(1);

		if (product.length === 0) {
			return res.status(404).json({
				success: false,
				error: "Product not found",
			});
		}

		const priceHistory = await db
			.select()
			.from(prices)
			.where(eq(prices.productId, product[0].id))
			.orderBy(desc(prices.collectedAt));

		res.json({
			prices: priceHistory,
		});
	} catch (error) {
		console.error("Error fetching price history:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch price history",
		});
	}
});

router.get("/:asin/reviews", async (req, res) => {
	try {
		const asin = req.params.asin;
		const page = parseInt(req.query.page as string) || 1;
		const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
		const offset = (page - 1) * limit;

		const product = await db
			.select()
			.from(products)
			.where(eq(products.asin, asin))
			.limit(1);

		if (product.length === 0) {
			return res.status(404).json({
				success: false,
				error: "Product not found",
			});
		}

		const productReviews = await db
			.select()
			.from(reviews)
			.where(eq(reviews.productId, product[0].id))
			.orderBy(desc(reviews.date))
			.limit(limit)
			.offset(offset);

		const totalReviews = await db
			.select()
			.from(reviews)
			.where(eq(reviews.productId, product[0].id));

		console.log(`[Products API] Reviews endpoint for ${asin} - Found ${productReviews.length} reviews (page ${page})`);

		res.json({
			reviews: productReviews,
			pagination: {
				page,
				limit,
				total: totalReviews.length,
				totalPages: Math.ceil(totalReviews.length / limit),
			},
		});
	} catch (error) {
		console.error("Error fetching reviews:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch reviews",
		});
	}
});

router.post("/:asin/track", async (req, res) => {
	try {
		const asin = req.params.asin;
		const { cronPattern } = trackProductSchema.parse({
			asin,
			cronPattern: req.body.cronPattern || "0 */6 * * *",
		});

		const jobId = await scheduler.scheduleProductUpdates(asin, cronPattern as string);

		res.json({
			success: true,
			jobId,
			message: "Product tracking started",
		});
	} catch (error) {
		console.error("Error starting product tracking:", error);
		res.status(400).json({
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.delete("/:asin/track", async (req, res) => {
	try {
		const asin = req.params.asin;

		const jobs = await db
			.select()
			.from(scrapeJobs)
			.where(
				and(
					eq(scrapeJobs.type, "price_update"),
					eq(scrapeJobs.isScheduled, true),
				),
			);

		for (const job of jobs) {
			if (job.input?.asin === asin) {
				await scheduler.cancelScheduledJob(job.id);
			}
		}

		res.json({
			success: true,
			message: "Product tracking stopped",
		});
	} catch (error) {
		console.error("Error stopping product tracking:", error);
		res.status(500).json({
			success: false,
			error: "Failed to stop tracking",
		});
	}
});


export default router;

