import { db, apiUsage, eq, desc } from "@datazone/db";

export class UsageTracker {
	private monthlyLimit: number;
	private currentMonth: string;

	constructor(monthlyLimit = 1000) {
		this.monthlyLimit = monthlyLimit;
		this.currentMonth = this.getCurrentMonth();
	}

	/**
	 * Get current month in YYYY-MM format
	 */
	private getCurrentMonth(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		return `${year}-${month}`;
	}

	/**
	 * Get or create usage record for current month
	 */
	async getCurrentUsage() {
		const currentMonthRecord = await db
			.select()
			.from(apiUsage)
			.where(eq(apiUsage.month, this.currentMonth))
			.limit(1);

		if (currentMonthRecord.length > 0) {
			return currentMonthRecord[0];
		}

		// Create new record for current month
		const newRecord = {
			id: crypto.randomUUID(),
			month: this.currentMonth,
			callsUsed: 0,
			callsLimit: this.monthlyLimit,
		};

		const [created] = await db
			.insert(apiUsage)
			.values(newRecord)
			.returning();

		return created;
	}

	/**
	 * Record API usage
	 */
	async recordUsage(calls: number): Promise<void> {
		const usage = await this.getCurrentUsage();

		await db
			.update(apiUsage)
			.set({
				callsUsed: usage.callsUsed + calls,
				updatedAt: new Date(),
			})
			.where(eq(apiUsage.id, usage.id));
	}

	/**
	 * Check if we can make an API call
	 */
	async canMakeCall(): Promise<boolean> {
		const usage = await this.getCurrentUsage();
		return usage.callsUsed < usage.callsLimit;
	}

	/**
	 * Get remaining API calls
	 */
	async getRemainingCalls(): Promise<number> {
		const usage = await this.getCurrentUsage();
		return Math.max(0, usage.callsLimit - usage.callsUsed);
	}

	/**
	 * Get usage statistics
	 */
	async getUsageStats() {
		const usage = await this.getCurrentUsage();
		return {
			month: usage.month,
			callsUsed: usage.callsUsed,
			callsLimit: usage.callsLimit,
			remaining: usage.callsLimit - usage.callsUsed,
			percentageUsed: (usage.callsUsed / usage.callsLimit) * 100,
		};
	}
}

