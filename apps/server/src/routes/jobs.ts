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
} from "@datazone/api";
import { db, scrapeJobs, eq } from "@datazone/db";

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

router.get("/list", async (req, res) => {
	try {
		const limit = parseInt(req.query.limit as string) || 50;
		const jobs = await scheduler.getJobHistory(limit);

		const queueStats = await jobQueue.getQueueStats();

		res.json({
			jobs,
			queue: queueStats,
		});
	} catch (error) {
		console.error("Error fetching jobs:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch jobs",
		});
	}
});

router.post("/schedule", async (req, res) => {
	try {
		const { asin, cronPattern } = z
			.object({
				asin: z.string(),
				cronPattern: z.string(),
			})
			.parse(req.body);

		const jobId = await scheduler.scheduleProductUpdates(asin, cronPattern);

		res.json({
			success: true,
			jobId,
			message: "Scheduled job created",
		});
	} catch (error) {
		console.error("Error scheduling job:", error);
		res.status(400).json({
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.post("/:jobId/suspend", async (req, res) => {
	try {
		const { jobId } = req.params;

		const result = await db
			.update(scrapeJobs)
			.set({
				status: "suspended",
				updatedAt: new Date(),
			})
			.where(eq(scrapeJobs.id, jobId))
			.returning();

		if (result.length === 0) {
			return res.status(404).json({
				success: false,
				error: "Job not found",
			});
		}

		try {
			const queueJob = await jobQueue.getJob(jobId);
			if (queueJob && (await queueJob.getState()) === "waiting") {
				await queueJob.remove();
			}
		} catch (error) {
			console.log(`Job ${jobId} not found in queue or already processed`);
		}

		res.json({
			success: true,
			message: "Job suspended successfully",
		});
	} catch (error) {
		console.error("Error suspending job:", error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.post("/:jobId/resume", async (req, res) => {
	try {
		const { jobId } = req.params;

		// Get job from database
		const jobs = await db
			.select()
			.from(scrapeJobs)
			.where(eq(scrapeJobs.id, jobId))
			.limit(1);

		if (jobs.length === 0 || !jobs[0]) {
			return res.status(404).json({
				success: false,
				error: "Job not found",
			});
		}

		const job = jobs[0];

		if (job.status !== "suspended") {
			return res.status(400).json({
				success: false,
				error: `Job is not suspended. Current status: ${job.status}`,
			});
		}

		await db
			.update(scrapeJobs)
			.set({
				status: "pending",
				updatedAt: new Date(),
			})
			.where(eq(scrapeJobs.id, jobId));

		if (job.isScheduled && job.input) {
			try {
				if (job.type === "price_update" && typeof job.input === "object" && job.input !== null && "asin" in job.input) {
				// The scheduler will pick it up on next cycle
				} else {
					await scheduler.triggerManualCollection({
						type: job.type as any,
						...(job.input as any),
					});
				}
			} catch (error) {
				console.error("Error re-adding job to queue:", error);
			}
		}

		res.json({
			success: true,
			message: "Job resumed successfully",
		});
	} catch (error) {
		console.error("Error resuming job:", error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

export default router;


