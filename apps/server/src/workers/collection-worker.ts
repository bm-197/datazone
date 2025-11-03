import { Worker } from "bullmq";
import {
  getRedisConnection,
  AmazonCollector,
  DataProcessor,
  ScraperAPIClient,
  UsageTracker,
  type JobData,
} from "@datazone/api";
import { db, products, prices, reviews, scrapeJobs, eq } from "@datazone/db";

// Extract PostgreSQL error code from error detail
function extractPostgresErrorCode(detail: string): string | null {
  const match = detail.match(/code:\s*"([^"]+)"/);
  return match && match[1] ? match[1] : null;
}

export class CollectionWorker {
  private worker: Worker<JobData>;
  private collector: AmazonCollector;
  private processor: DataProcessor;
  private usageTracker: UsageTracker;

  constructor() {
    const connection = getRedisConnection();

    const apiKey = process.env.SCRAPERAPI_API_KEY || "";
    if (!apiKey) {
      throw new Error("SCRAPERAPI_API_KEY is required");
    }

    const client = new ScraperAPIClient(apiKey);
    this.usageTracker = new UsageTracker(
      parseInt(process.env.SCRAPERAPI_FREE_TIER_LIMIT || "1000"),
    );
    this.collector = new AmazonCollector(client, this.usageTracker);
    this.processor = new DataProcessor();

    // Create worker with rate limiting 
    this.worker = new Worker<JobData>(
      "product-collection",
      async (job) => {
        await this.processJob(job);
      },
      {
        connection,
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 60000,
        },
      },
    );

    this.worker.on("completed", (job) => {
      console.log(`Job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    this.worker.on("error", (err) => {
      console.error("Worker error:", err);
    });
  }


  private async processJob(job: any): Promise<void> {
    const jobData = job.data;
    const jobId = job.id!;
    let dbJobId: string | undefined;

    try {
      // BullMQ job ID as the database job ID
      dbJobId = jobId;

      const existingJob = await db
        .select()
        .from(scrapeJobs)
        .where(eq(scrapeJobs.id, jobId))
        .limit(1);

      if (existingJob.length > 0 && existingJob[0]) {
        if (existingJob[0].status === "suspended") {
          console.log(`Job ${jobId} is suspended, skipping execution`);
          return;
        }

        await db
          .update(scrapeJobs)
          .set({
            status: "running",
            startedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(scrapeJobs.id, jobId));
      } else {
        try {
          await db.insert(scrapeJobs).values({
            id: jobId,
            type: jobData.type,
            status: "running",
            input: jobData,
            isScheduled: false,
            startedAt: new Date(),
          });
        } catch (insertError: any) {
          const errorMessage = String(insertError?.message || insertError?.cause?.message || insertError || "");
          const errorString = String(insertError || "");
          const errorCode = insertError?.code || insertError?.cause?.code ||
            (insertError?.cause?.detail ? extractPostgresErrorCode(insertError.cause.detail) : null);

          const isDuplicateKey =
            errorCode === "23505" ||
            errorMessage.includes("duplicate key") ||
            errorMessage.includes("23505") ||
            errorString.includes("duplicate key") ||
            errorString.includes("23505");

          if (isDuplicateKey) {
            console.log(`Job ${jobId} was created concurrently, updating instead`);
            const recheckJob = await db
              .select()
              .from(scrapeJobs)
              .where(eq(scrapeJobs.id, jobId))
              .limit(1);

            if (recheckJob.length > 0) {
              await db
                .update(scrapeJobs)
                .set({
                  status: "running",
                  startedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(scrapeJobs.id, jobId));
            } else {
              console.warn(`Job ${jobId} duplicate key error but job not found on recheck`);
              throw insertError;
            }
          } else {
            throw insertError; // Re-throw if it's a different error
          }
        }
      }
      switch (jobData.type) {
        case "product":
          await this.processProductJob(jobData, dbJobId);
          break;
        case "search":
          await this.processSearchJob(jobData, dbJobId);
          break;
        case "review":
          await this.processReviewJob(jobData, dbJobId);
          break;
        case "price_update":
          await this.processPriceUpdateJob(jobData, dbJobId);
          break;
        default:
          throw new Error(`Unknown job type: ${jobData.type}`);
      }

      if (dbJobId) {
        await db
          .update(scrapeJobs)
          .set({
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(scrapeJobs.id, dbJobId));
      }
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);

      if (dbJobId) {
        await db
          .update(scrapeJobs)
          .set({
            status: "failed",
            error:
              error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(scrapeJobs.id, dbJobId));
      }

      throw error;
    }
  }


  private async processProductJob(data: JobData, dbJobId: string | undefined) {
    if (!data.asin) {
      throw new Error("ASIN is required for product job");
    }

    console.log(`Starting product job for ASIN: ${data.asin}`);

    const existingProduct = await db
      .select()
      .from(products)
      .where(eq(products.asin, data.asin))
      .limit(1);

    const productData = await this.collector.collectProductByASIN({
      asin: data.asin,
    });

    if (!productData) {
      if (existingProduct.length > 0 && existingProduct[0]) {
        console.warn(`[CollectionWorker] Product validation failed for ASIN ${data.asin}, but product exists in database. Skipping update.`);
        console.warn(`[CollectionWorker] This usually means ScraperAPI returned invalid data or the product is no longer available.`);
        return;
      }

      throw new Error(`Failed to fetch product data for ASIN: ${data.asin}. Product validation failed or product not found. ScraperAPI have returned invalid data.`);
    }

    console.log(`Received product data for ASIN: ${productData.asin} - ${productData.title || "No title"}`);
    console.log(`Product has price: ${!!productData.price}, price details:`, productData.price);
    console.log(`Rating: ${productData.rating?.value || "N/A"}, description: ${productData.description ? "Yes" : "No"}`);

    const processed = this.processor.processProduct(productData);

    const existing = await db
      .select()
      .from(products)
      .where(eq(products.asin, data.asin))
      .limit(1);

    let productId: string;
    if (existing.length > 0 && existing[0]) {
      productId = existing[0].id;
      await db
        .update(products)
        .set({
          ...processed,
          id: productId,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId));

      console.log(`Updated product: ${processed.asin} - ${processed.title}`);
    } else {
      productId = processed.id;
      await db.insert(products).values(processed);
      console.log(`Inserted product: ${processed.asin} - ${processed.title}`);
    }

    const price = this.processor.processPrice(productData, productId);
    if (price) {
      console.log(`[CollectionWorker] Saving price for ${processed.asin}:`, {
        price: price.price,
        originalPrice: price.originalPrice,
        currency: price.currency,
      });
      await db.insert(prices).values(price);
      console.log(`✓ Added price entry for product: ${processed.asin} - Price: ${price.currency} ${price.price}`);
    } else {
      console.warn(`⚠ No price data available for product: ${processed.asin}`);
      console.warn(`[CollectionWorker] Product price object:`, productData.price);
    }

    let reviewsToProcess: any[] = [];
    let averageRating = 0;
    let totalReviews = 0;

    if ((productData as any)._reviews && Array.isArray((productData as any)._reviews)) {
      console.log(`[CollectionWorker] Using reviews from product response: ${(productData as any)._reviews.length} reviews`);
      reviewsToProcess = (productData as any)._reviews;
      averageRating = (productData as any)._averageRating || 0;
      totalReviews = (productData as any)._totalReviews || reviewsToProcess.length;
    } else {
      try {
        console.log(`[CollectionWorker] Collecting reviews for product: ${processed.asin}`);
        const reviewsResponse = await this.collector.collectReviews({
          asin: data.asin,
          limit: 50,
        });

        console.log(`[CollectionWorker] Reviews response received:`, {
          reviewsCount: reviewsResponse.reviews.length,
          averageRating: reviewsResponse.averageRating,
          totalReviews: reviewsResponse.totalReviews,
        });

        if (reviewsResponse.reviews.length > 0) {
          reviewsToProcess = reviewsResponse.reviews;
          averageRating = reviewsResponse.averageRating;
          totalReviews = reviewsResponse.totalReviews;
        }
      } catch (error) {
        console.warn(`[CollectionWorker] Could not fetch reviews separately for ${processed.asin}:`, error);
        // Continue without reviews
      }
    }

    if (reviewsToProcess.length > 0) {
      try {
        const transformedReviews = reviewsToProcess.map((review: any) => {
          let reviewTitle = review.title;
          if (reviewTitle && typeof reviewTitle === "string") {
            reviewTitle = reviewTitle.replace(/^\d+\.?\d*\s+out\s+of\s+\d+\s+stars\s*\n*\s*/i, "").trim();
            if (reviewTitle === "") {
              reviewTitle = undefined;
            }
          }

          return {
            rating: review.stars || review.rating || 0,
            title: reviewTitle,
            text: review.review || review.text || "",
            author: review.username || review.author || "Anonymous",
            date: review.date || undefined,
            verified: review.verified_purchase || review.verified || false,
            helpfulCount: review.total_found_helpful || review.helpfulCount || 0,
          };
        });

        const reviewsResponse = {
          reviews: transformedReviews,
          averageRating: averageRating,
          totalReviews: totalReviews,
        };

        const processedReviews = this.processor.processReviews(
          reviewsResponse,
          productId,
        );

        console.log(`[CollectionWorker] Processed ${processedReviews.length} reviews for product: ${processed.asin}`);

        await db
          .delete(reviews)
          .where(eq(reviews.productId, productId));

        for (const review of processedReviews) {
          await db.insert(reviews).values(review);
        }

        console.log(`[CollectionWorker] ✓ Saved ${processedReviews.length} reviews for product: ${processed.asin}`);
      } catch (error) {
        console.error(`[CollectionWorker] ✗ Error processing reviews for ${processed.asin}:`, error);
        if (error instanceof Error) {
          console.error(`[CollectionWorker] Error details:`, error.message, error.stack);
        }
      }
    } else {
      console.warn(`[CollectionWorker] No reviews found for product: ${processed.asin}`);
    }
  }

  private async processSearchJob(data: JobData, dbJobId: string | undefined) {
    if (!data.keyword) {
      throw new Error("Keyword is required for search job");
    }

    console.log(`Starting search job for keyword: "${data.keyword}"`);

    const productsList = await this.collector.collectProductsBySearch({
      keyword: data.keyword,
      limit: data.limit,
      country: data.country,
    });

    console.log(`Received ${productsList.length} products from ScraperAPI`);

    if (productsList.length === 0) {
      console.warn(`No products returned for keyword: "${data.keyword}"`);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const productData of productsList) {
      try {
        console.log(`Processing product: ${productData.asin} - ${productData.title || "No title"}`);

        if (!this.processor.isValidASIN(productData.asin)) {
          console.warn(`Invalid ASIN format: ${productData.asin}, skipping full details fetch`);
        }

        let fullProductData = productData;
        if (this.processor.isValidASIN(productData.asin)) {
          try {
            const detailedProduct = await this.collector.collectProductByASIN({
              asin: productData.asin,
            });
            if (detailedProduct) {
              fullProductData = detailedProduct;
              console.log(`Fetched full product details for ${productData.asin}`);
            } else {
              console.warn(`Product validation failed for ${productData.asin}, using search data`);
            }
          } catch (error) {
            console.warn(`Could not fetch full details for ${productData.asin}, using search data:`, error);
          }
        }

        const processed = this.processor.processProduct(fullProductData);

        const existing = await db
          .select()
          .from(products)
          .where(eq(products.asin, processed.asin))
          .limit(1);

        let productId: string;
        if (existing.length > 0 && existing[0]) {
          productId = existing[0].id;
          await db
            .update(products)
            .set({
              ...processed,
              id: productId,
              updatedAt: new Date(),
            })
            .where(eq(products.id, productId));
          console.log(`Updated product: ${processed.asin} - ${processed.title}`);
        } else {
          productId = processed.id;
          await db.insert(products).values(processed);
          console.log(`Inserted product: ${processed.asin} - ${processed.title}`);
        }

        // Save price if available
        const price = this.processor.processPrice(fullProductData, productId);
        if (price) {
          console.log(`[CollectionWorker] Saving price for ${processed.asin}:`, {
            price: price.price,
            originalPrice: price.originalPrice,
            currency: price.currency,
          });
          await db.insert(prices).values(price);
          console.log(`✓ Added price entry for product: ${processed.asin} - Price: ${price.currency} ${price.price}`);
        } else {
          console.warn(`No price data available for product: ${processed.asin}`);
          console.warn(`[CollectionWorker] Product price object:`, fullProductData.price);
        }

        let reviewsToProcess: any[] = [];
        let reviewAverageRating = 0;
        let reviewTotalReviews = 0;

        if ((fullProductData as any)._reviews && Array.isArray((fullProductData as any)._reviews)) {
          console.log(`[CollectionWorker] Using reviews from product response: ${(fullProductData as any)._reviews.length} reviews`);
          reviewsToProcess = (fullProductData as any)._reviews;
          reviewAverageRating = (fullProductData as any)._averageRating || 0;
          reviewTotalReviews = (fullProductData as any)._totalReviews || reviewsToProcess.length;
        } else if (this.processor.isValidASIN(processed.asin)) {
          try {
            console.log(`[CollectionWorker] Collecting reviews for product: ${processed.asin}`);
            const reviewsResponse = await this.collector.collectReviews({
              asin: processed.asin,
              limit: 50,
            });

            console.log(`[CollectionWorker] Reviews response received:`, {
              reviewsCount: reviewsResponse.reviews.length,
              averageRating: reviewsResponse.averageRating,
              totalReviews: reviewsResponse.totalReviews,
            });

            if (reviewsResponse.reviews.length > 0) {
              reviewsToProcess = reviewsResponse.reviews;
              reviewAverageRating = reviewsResponse.averageRating;
              reviewTotalReviews = reviewsResponse.totalReviews;
            }
          } catch (error) {
            console.warn(`[CollectionWorker] Could not fetch reviews separately for ${processed.asin}:`, error);
          }
        } else {
          console.warn(`[CollectionWorker] Invalid ASIN format, skipping review collection: ${processed.asin}`);
        }

        if (reviewsToProcess.length > 0) {
          try {
            // Transform reviews to match expected format (ScraperAPI uses different field names)
            const transformedReviews = reviewsToProcess.map((review: any) => {
              let reviewTitle = review.title;
              if (reviewTitle && typeof reviewTitle === "string") {
                reviewTitle = reviewTitle.replace(/^\d+\.?\d*\s+out\s+of\s+\d+\s+stars\s*\n*\s*/i, "").trim();
                if (reviewTitle === "") {
                  reviewTitle = undefined;
                }
              }

              return {
                rating: review.stars || review.rating || 0,
                title: reviewTitle,
                text: review.review || review.text || "",
                author: review.username || review.author || "Anonymous",
                date: review.date || undefined,
                verified: review.verified_purchase || review.verified || false,
                helpfulCount: review.total_found_helpful || review.helpfulCount || 0,
              };
            });

            const reviewsResponse = {
              reviews: transformedReviews,
              averageRating: reviewAverageRating,
              totalReviews: reviewTotalReviews,
            };

            const processedReviews = this.processor.processReviews(
              reviewsResponse,
              productId,
            );

            console.log(`[CollectionWorker] Processed ${processedReviews.length} reviews for product: ${processed.asin}`);

            await db
              .delete(reviews)
              .where(eq(reviews.productId, productId));

            for (const review of processedReviews) {
              await db.insert(reviews).values(review);
            }

            console.log(`[CollectionWorker] ✓ Saved ${processedReviews.length} reviews for product: ${processed.asin}`);
          } catch (error) {
            console.error(`[CollectionWorker] ✗ Error processing reviews for ${processed.asin}:`, error);
            if (error instanceof Error) {
              console.error(`[CollectionWorker] Error details:`, error.message, error.stack);
            }
          }
        } else {
          console.warn(`[CollectionWorker] No reviews found for product: ${processed.asin}`);
        }

        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Error processing product ${productData?.asin || "unknown"}:`, error);
      }
    }

    console.log(`Search job completed: ${successCount} products saved, ${errorCount} errors`);
  }

  private async processReviewJob(data: JobData, dbJobId: string | undefined) {
    if (!data.asin) {
      throw new Error("ASIN is required for review job");
    }

    const product = await db
      .select()
      .from(products)
      .where(eq(products.asin, data.asin))
      .limit(1);

    if (product.length === 0 || !product[0]) {
      throw new Error(`Product with ASIN ${data.asin} not found`);
    }

    const productRecord = product[0];
    const reviewsData = await this.collector.collectReviews({
      asin: data.asin,
      limit: data.limit,
    });

    const processedReviews = this.processor.processReviews(
      reviewsData,
      productRecord.id,
    );

    for (const review of processedReviews) {
      await db.insert(reviews).values(review);
    }

    await db
      .update(products)
      .set({
        reviewCount: reviewsData.totalReviews,
        rating: reviewsData.averageRating,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productRecord.id));
  }

  private async processPriceUpdateJob(data: JobData, dbJobId: string | undefined) {
    if (!data.asin) {
      throw new Error("ASIN is required for price update job");
    }

    const product = await db
      .select()
      .from(products)
      .where(eq(products.asin, data.asin))
      .limit(1);

    if (product.length === 0 || !product[0]) {
      throw new Error(`Product with ASIN ${data.asin} not found`);
    }

    const productRecord = product[0];

    const productData = await this.collector.collectPriceHistory(data.asin);
    const price = this.processor.processPrice(productData, productRecord.id);

    if (price) {
      await db.insert(prices).values(price);
    }
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

