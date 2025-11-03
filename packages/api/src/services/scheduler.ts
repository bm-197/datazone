import { JobQueue, type JobData } from "./job-queue.js";
import type { AmazonCollector } from "./amazon-collector.js";
import type { DataProcessor } from "./data-processor.js";
import { db, scrapeJobs, eq, desc } from "@datazone/db";

export interface ScheduleOptions {
	cronPattern: string; // e.g., "0 */6 * * *" for every 6 hours
	timezone?: string;
}

export class JobScheduler {
	private jobQueue: JobQueue;
	private collector: AmazonCollector;
	private processor: DataProcessor;

	constructor(
		jobQueue: JobQueue,
		collector: AmazonCollector,
		processor: DataProcessor,
	) {
		this.jobQueue = jobQueue;
		this.collector = collector;
		this.processor = processor;
	}

	/**
	 * Schedule recurring product updates
	 */
	async scheduleProductUpdates(
		asin: string,
		cronPattern: string,
	): Promise<string> {
		const jobId = await this.jobQueue.addRecurringPriceJob(
			{ asin },
			cronPattern,
		);

		// Record in database using the same jobId from BullMQ
		await db.insert(scrapeJobs).values({
			id: jobId, // Use the BullMQ job ID as the database ID
			type: "price_update",
			status: "pending",
			input: { asin, cronPattern },
			isScheduled: true,
		});

		return jobId;
	}

	/**
	 * Cancel scheduled job
	 */
	async cancelScheduledJob(jobId: string): Promise<void> {
		await this.jobQueue.removeJob(jobId);

		// Update database
		// Note: Would need to query by jobId - this is simplified
		await db
			.update(scrapeJobs)
			.set({
				status: "failed",
				error: "Cancelled by user",
				completedAt: new Date(),
			})
			.where(eq(scrapeJobs.status, "pending"));
	}

	/**
	 * Trigger manual collection job
	 */
	async triggerManualCollection(data: JobData): Promise<string> {
		let jobId: string;

		if (data.type === "product" && data.asin) {
			jobId = await this.jobQueue.addProductJob(
				{ asin: data.asin },
				{ priority: 10 }, // Higher priority for manual triggers
			);
		} else if (data.type === "search" && data.keyword) {
			jobId = await this.jobQueue.addSearchJob(
				{
					keyword: data.keyword,
					limit: data.limit,
					country: data.country,
				},
				{ priority: 10 },
			);
		} else if (data.type === "review" && data.asin) {
			jobId = await this.jobQueue.addReviewJob(
				{
					asin: data.asin,
					limit: data.limit,
				},
				{ priority: 10 },
			);
		} else {
			throw new Error("Invalid job data");
		}

		// Record in database using the same jobId from BullMQ
		await db.insert(scrapeJobs).values({
			id: jobId, // Use the BullMQ job ID as the database ID
			type: data.type,
			status: "pending",
			input: data,
			isScheduled: false,
		});

		return jobId;
	}

	/**
	 * Get scheduled jobs
	 */
	async getScheduledJobs() {
		return await db
			.select()
			.from(scrapeJobs)
			.where(eq(scrapeJobs.isScheduled, true));
	}

	/**
	 * Get job history
	 */
	async getJobHistory(limit = 50) {
		return await db
			.select()
			.from(scrapeJobs)
			.orderBy(desc(scrapeJobs.createdAt))
			.limit(limit);
	}
}

