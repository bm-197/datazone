import "dotenv/config";
import cors from "cors";
import express from "express";
import { auth } from "@datazone/auth";
import { toNodeHandler } from "better-auth/node";
import productsRouter from "./routes/products.js";
import jobsRouter from "./routes/jobs.js";
import usageRouter from "./routes/usage.js";
import { CollectionWorker } from "./workers/collection-worker.js";

const app = express();

app.use(
	cors({
		origin: process.env.CORS_ORIGIN || "",
		methods: ["GET", "POST", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.all("/api/auth{/*path}", toNodeHandler(auth));

app.use(express.json());

// Product routes
app.use("/api/products", productsRouter);
// Job routes
app.use("/api/jobs", jobsRouter);
// Usage routes
app.use("/api/usage", usageRouter);

// Dashboard routes
import dashboardRouter from "./routes/dashboard.js";
app.use("/api/dashboard", dashboardRouter);

app.get("/", (_req, res) => {
	res.status(200).send("OK");
});

// Initialize collection worker
let collectionWorker: CollectionWorker | null = null;

if (process.env.ENABLE_WORKER !== "false") {
	try {
		collectionWorker = new CollectionWorker();
		console.log("Collection worker started");
	} catch (error) {
		console.error("Failed to start collection worker:", error);
	}
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("SIGTERM received, shutting down gracefully");
	if (collectionWorker) {
		await collectionWorker.close();
	}
	process.exit(0);
});

process.on("SIGINT", async () => {
	console.log("SIGINT received, shutting down gracefully");
	if (collectionWorker) {
		await collectionWorker.close();
	}
	process.exit(0);
});
