import Redis from "ioredis";

let redisClient: Redis | null = null;

export function getRedisConnection(): Redis {
	if (redisClient) {
		return redisClient;
	}

	const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
	
	redisClient = new Redis(redisUrl, {
		maxRetriesPerRequest: null,
		retryStrategy(times) {
			const delay = Math.min(times * 50, 2000);
			return delay;
		},
	});

	redisClient.on("error", (err) => {
		console.error("Redis connection error:", err);
	});

	redisClient.on("connect", () => {
		console.log("Redis connected");
	});

	return redisClient;
}


export async function closeRedisConnection(): Promise<void> {
	if (redisClient) {
		await redisClient.quit();
		redisClient = null;
	}
}

