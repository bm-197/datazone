import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { db, products, prices, reviews, scrapeJobs, count, sql, gte, eq, desc, inArray } from "@datazone/db";
import { UsageTracker, JobQueue } from "@datazone/api";

const router: ExpressRouter = Router();

const usageTracker = new UsageTracker(
  parseInt(process.env.SCRAPERAPI_FREE_TIER_LIMIT || "1000"),
);
const jobQueue = new JobQueue();

router.get("/stats", async (_req, res) => {
  try {
    const totalProducts = await db
      .select({ count: count() })
      .from(products);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentProducts = await db
      .select({ count: count() })
      .from(products)
      .where(gte(products.createdAt, sevenDaysAgo));

    const totalPrices = await db
      .select({ count: count() })
      .from(prices);

    const totalReviews = await db
      .select({ count: count() })
      .from(reviews);

    const totalJobs = await db
      .select({ count: count() })
      .from(scrapeJobs);

    const completedJobs = await db
      .select({ count: count() })
      .from(scrapeJobs)
      .where(eq(scrapeJobs.status, "completed"));

    const failedJobs = await db
      .select({ count: count() })
      .from(scrapeJobs)
      .where(eq(scrapeJobs.status, "failed"));

    const runningJobs = await db
      .select({ count: count() })
      .from(scrapeJobs)
      .where(eq(scrapeJobs.status, "running"));

    const recentJobs = await db
      .select()
      .from(scrapeJobs)
      .orderBy(desc(scrapeJobs.createdAt))
      .limit(10);

    const queueStats = await jobQueue.getQueueStats();

    const usageStats = await usageTracker.getUsageStats();

    const priceCounts = await db
      .select({
        productId: prices.productId,
        priceCount: count(),
      })
      .from(prices)
      .groupBy(prices.productId);

    const mostTrackedProducts = priceCounts
      .sort((a, b) => (b.priceCount || 0) - (a.priceCount || 0))
      .slice(0, 5);

    const mostTrackedIds = mostTrackedProducts.map((p) => p.productId);
    const mostTrackedProductsDetails = mostTrackedIds.length > 0
      ? await db
        .select()
        .from(products)
        .where(inArray(products.id, mostTrackedIds))
      : [];

    const reviewCounts = await db
      .select({
        productId: reviews.productId,
        reviewCount: count(),
      })
      .from(reviews)
      .groupBy(reviews.productId);

    const productsWithMostReviews = reviewCounts
      .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
      .slice(0, 5);

    const mostReviewsIds = productsWithMostReviews.map((p) => p.productId);
    const productsWithMostReviewsDetails = mostReviewsIds.length > 0
      ? await db
        .select()
        .from(products)
        .where(inArray(products.id, mostReviewsIds))
      : [];

    res.json({
      products: {
        total: totalProducts[0]?.count || 0,
        recent: recentProducts[0]?.count || 0,
      },
      prices: {
        total: totalPrices[0]?.count || 0,
      },
      reviews: {
        total: totalReviews[0]?.count || 0,
      },
      jobs: {
        total: totalJobs[0]?.count || 0,
        completed: completedJobs[0]?.count || 0,
        failed: failedJobs[0]?.count || 0,
        running: runningJobs[0]?.count || 0,
        recent: recentJobs,
      },
      queue: queueStats,
      usage: usageStats,
      mostTracked: mostTrackedProductsDetails.map((product) => {
        const tracked = mostTrackedProducts.find((p) => p.productId === product.id);
        return {
          ...product,
          priceCount: tracked?.priceCount || 0,
        };
      }),
      mostReviewed: productsWithMostReviewsDetails.map((product) => {
        const reviewed = productsWithMostReviews.find((p) => p.productId === product.id);
        return {
          ...product,
          reviewCount: reviewed?.reviewCount || 0,
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard stats",
    });
  }
});

export default router;

