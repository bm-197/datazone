import { Router } from "express";
import type { Router as ExpressRouter } from "express";

import { UsageTracker } from "@datazone/api";

const router: ExpressRouter = Router();

const usageTracker = new UsageTracker(
	parseInt(process.env.SCRAPERAPI_FREE_TIER_LIMIT || "1000"),
);


router.get("/", async (_req, res) => {
	try {
		const stats = await usageTracker.getUsageStats();
		res.json(stats);
	} catch (error) {
		console.error("Error fetching usage stats:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch usage stats",
		});
	}
});

export default router;


