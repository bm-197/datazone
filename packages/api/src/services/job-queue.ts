import { Queue, QueueEvents } from "bullmq";
import { getRedisConnection } from "./redis-connection.js";
import type { ConnectionOptions } from "ioredis";

export interface JobData {
	asin?: string;
	keyword?: string;
	limit?: number;
	country?: string;
	type: "product" | "search" | "review" | "price_update";
}

export interface JobOptions {
	priority?: number;
	delay?: number;
	attempts?: number;
	repeat?: {
		pattern?: string; // Cron pattern
		tz?: string; // Timezone
	};
}

export class JobQueue {
	private productQueue: Queue<JobData>;
	private queueEvents: QueueEvents;

	constructor() {
		const connection: ConnectionOptions = getRedisConnection();

		// Product collection queue
		this.productQueue = new Queue("product-collection", {
			connection,
			defaultJobOptions: {
				attempts: 3,
				backoff: {
					type: "exponential",
					delay: 2000,
				},
				removeOnComplete: {
					age: 86400, // Keep completed jobs for 24 hours
					count: 1000, // Keep last 1000 jobs
				},
				removeOnFail: {
					age: 604800, // Keep failed jobs for 7 days
				},
			},
		});

		// Queue events for monitoring
		this.queueEvents = new QueueEvents("product-collection", {
			connection,
		});
	}

	/**
	 * Add product collection job
	 */
	async addProductJob(
		data: { asin: string },
		options?: JobOptions,
	): Promise<string> {
		const job = await this.productQueue.add(
			"collect-product",
			{
				...data,
				type: "product",
			},
			{
				priority: options?.priority || 1,
				delay: options?.delay,
				attempts: options?.attempts,
			},
		);

		return job.id!;
	}

	/**
	 * Add search collection job
	 */
	async addSearchJob(
		data: { keyword: string; limit?: number; country?: string },
		options?: JobOptions,
	): Promise<string> {
		const job = await this.productQueue.add(
			"collect-search",
			{
				...data,
				type: "search",
			},
			{
				priority: options?.priority || 1,
				delay: options?.delay,
				attempts: options?.attempts,
			},
		);

		return job.id!;
	}

	/**
	 * Add review collection job
	 */
	async addReviewJob(
		data: { asin: string; limit?: number },
		options?: JobOptions,
	): Promise<string> {
		const job = await this.productQueue.add(
			"collect-reviews",
			{
				...data,
				type: "review",
			},
			{
				priority: options?.priority || 1,
				delay: options?.delay,
				attempts: options?.attempts,
			},
		);

		return job.id!;
	}

	/**
	 * Add recurring price update job
	 */
	async addRecurringPriceJob(
		data: { asin: string },
		cronPattern: string,
	): Promise<string> {
		const job = await this.productQueue.add(
			"update-price",
			{
				...data,
				type: "price_update",
			},
			{
				repeat: {
					pattern: cronPattern,
					tz: "UTC",
				},
			},
		);

		return job.id!;
	}

	/**
	 * Get job by ID
	 */
	async getJob(jobId: string) {
		return await this.productQueue.getJob(jobId);
	}

	/**
	 * Get job state
	 */
	async getJobState(jobId: string) {
		const job = await this.getJob(jobId);
		if (!job) {
			return null;
		}

		const state = await job.getState();
		return {
			id: job.id,
			state,
			data: job.data,
			progress: job.progress,
			returnvalue: job.returnvalue,
			failedReason: job.failedReason,
			processedOn: job.processedOn,
			finishedOn: job.finishedOn,
		};
	}

	/**
	 * Remove job
	 */
	async removeJob(jobId: string): Promise<void> {
		const job = await this.getJob(jobId);
		if (job) {
			await job.remove();
		}
	}

	/**
	 * Get queue stats
	 */
	async getQueueStats() {
		const [waiting, active, completed, failed, delayed] =
			await Promise.all([
				this.productQueue.getWaitingCount(),
				this.productQueue.getActiveCount(),
				this.productQueue.getCompletedCount(),
				this.productQueue.getFailedCount(),
				this.productQueue.getDelayedCount(),
			]);

		return {
			waiting,
			active,
			completed,
			failed,
			delayed,
			total: waiting + active + completed + failed + delayed,
		};
	}

	/**
	 * Clean old jobs
	 */
	async cleanOldJobs(grace = 86400000): Promise<number> {
		// Clean jobs older than grace period (default 24 hours)
		const cleaned = await this.productQueue.clean(grace, 1000, "completed");
		const failedCleaned = await this.productQueue.clean(
			grace,
			1000,
			"failed",
		);

		return cleaned.length + failedCleaned.length;
	}

	/**
	 * Close queues
	 */
	async close(): Promise<void> {
		await this.productQueue.close();
		await this.queueEvents.close();
	}

	/**
	 * Get queue events for monitoring
	 */
	getQueueEvents(): QueueEvents {
		return this.queueEvents;
	}
}

