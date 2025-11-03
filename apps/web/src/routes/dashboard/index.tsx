import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SectionCards } from "@/components/section-cards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconTrendingUp, IconTrendingDown, IconPackage, IconStar } from "@tabler/icons-react";
import { CheckCircle2, XCircle, Clock, Package } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
	component: DashboardPage,
});

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function fetchDashboardStats() {
	const response = await fetch(`${API_URL}/api/dashboard/stats`, {
		credentials: 'include',
	});
	if (!response.ok) {
		throw new Error("Failed to fetch dashboard stats");
	}
	return response.json();
}

function DashboardPage() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["dashboardStats"],
		queryFn: fetchDashboardStats,
		refetchInterval: 30000,
	});

	if (isLoading) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="grid gap-4 md:grid-cols-4">
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
				</div>
				<Skeleton className="h-96" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Alert variant="destructive">
					<AlertDescription>
						Error loading dashboard: {error.message}
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	const stats = data || {};
	const products = stats.products || {};
	const mostTracked = stats.mostTracked || [];
	const mostReviewed = stats.mostReviewed || [];
	const recentJobs = stats.jobs?.recent || [];

	// Calculate recent products growth
	const recentProductsPercent = products.total > 0
		? ((products.recent / products.total) * 100).toFixed(1)
		: "0.0";

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<div className="mb-4">
				<h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
				<p className="text-muted-foreground">
					Real-time statistics and insights for your data collection
				</p>
			</div>

			{/* Statistics Cards */}
			<SectionCards
				totalProducts={products.total || 0}
				recentProducts={products.recent || 0}
				recentProductsPercent={recentProductsPercent}
				totalPrices={stats.prices?.total || 0}
				totalReviews={stats.reviews?.total || 0}
				totalJobs={stats.jobs?.total || 0}
				completedJobs={stats.jobs?.completed || 0}
				failedJobs={stats.jobs?.failed || 0}
				successRate={stats.jobs?.total > 0 
					? ((stats.jobs?.completed / stats.jobs?.total) * 100).toFixed(1) 
					: "0.0"}
				apiUsage={stats.usage?.callsUsed || 0}
				apiLimit={stats.usage?.callsLimit || 1000}
				apiUsagePercent={stats.usage?.percentageUsed || 0}
			/>

			{/* Most Tracked Products */}
			{mostTracked.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Most Tracked Products</CardTitle>
						<CardDescription>Products with the most price history data points</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{mostTracked.map((product: any) => (
								<Link
									key={product.id}
									to="/dashboard/products/$asin"
									params={{ asin: product.asin }}
									className="block"
								>
									<Card className="hover:bg-accent transition-colors">
										<CardContent className="p-4">
											<div className="flex items-start gap-3">
												{product.images && product.images.length > 0 ? (
													<img
														src={product.images[0]}
														alt={product.title}
														className="w-16 h-16 object-contain rounded"
													/>
												) : (
													<div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
														<Package className="h-8 w-8 text-muted-foreground" />
													</div>
												)}
												<div className="flex-1 min-w-0">
													<h3 className="font-semibold text-sm line-clamp-2 mb-1">
														{product.title}
													</h3>
													<div className="flex items-center gap-2">
														<Badge variant="outline" className="text-xs">
															{product.priceCount} prices
														</Badge>
														{product.rating && (
															<div className="flex items-center gap-1">
																<IconStar className="h-3 w-3 fill-yellow-400 text-yellow-400" />
																<span className="text-xs">{product.rating.toFixed(1)}</span>
															</div>
														)}
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								</Link>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Most Reviewed Products */}
			{mostReviewed.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Most Reviewed Products</CardTitle>
						<CardDescription>Products with the most customer reviews</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{mostReviewed.map((product: any) => (
								<Link
									key={product.id}
									to="/dashboard/products/$asin"
									params={{ asin: product.asin }}
									className="block"
								>
									<Card className="hover:bg-accent transition-colors">
										<CardContent className="p-4">
											<div className="flex items-start gap-3">
												{product.images && product.images.length > 0 ? (
													<img
														src={product.images[0]}
														alt={product.title}
														className="w-16 h-16 object-contain rounded"
													/>
												) : (
													<div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
														<Package className="h-8 w-8 text-muted-foreground" />
													</div>
												)}
												<div className="flex-1 min-w-0">
													<h3 className="font-semibold text-sm line-clamp-2 mb-1">
														{product.title}
													</h3>
													<div className="flex items-center gap-2">
														<Badge variant="outline" className="text-xs">
															{product.reviewCount} reviews
														</Badge>
														{product.rating && (
															<div className="flex items-center gap-1">
																<IconStar className="h-3 w-3 fill-yellow-400 text-yellow-400" />
																<span className="text-xs">{product.rating.toFixed(1)}</span>
															</div>
														)}
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								</Link>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Recent Jobs */}
			{recentJobs.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Recent Jobs</CardTitle>
						<CardDescription>Latest collection job activity</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{recentJobs.slice(0, 5).map((job: any) => (
								<div
									key={job.id}
									className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
								>
									<div className="flex items-center gap-3 flex-1 min-w-0">
										<Badge variant="outline" className="text-xs">
											{job.type}
										</Badge>
										<div className="flex items-center gap-2 min-w-0 flex-1">
											<Badge
												variant="outline"
												className={`text-xs ${
													job.status === "completed"
														? "border-green-500 text-green-600 dark:text-green-400"
														: job.status === "failed"
														? "border-red-500 text-red-600 dark:text-red-400"
														: job.status === "running"
														? "border-blue-500 text-blue-600 dark:text-blue-400"
														: job.status === "suspended"
														? "border-orange-500 text-orange-600 dark:text-orange-400"
														: ""
												}`}
											>
												{job.status === "completed" ? (
													<CheckCircle2 className="h-3 w-3 mr-1" />
												) : job.status === "failed" ? (
													<XCircle className="h-3 w-3 mr-1" />
												) : job.status === "running" ? (
													<Clock className="h-3 w-3 mr-1 animate-spin" />
												) : job.status === "suspended" ? (
													<Clock className="h-3 w-3 mr-1" />
												) : (
													<Clock className="h-3 w-3 mr-1" />
												)}
												{job.status.charAt(0).toUpperCase() + job.status.slice(1)}
											</Badge>
											{job.input && (
												<span className="text-xs text-muted-foreground truncate">
													{job.input.keyword || job.input.asin || "N/A"}
												</span>
											)}
										</div>
									</div>
									<span className="text-xs text-muted-foreground whitespace-nowrap">
										{job.createdAt
											? new Date(job.createdAt).toLocaleString()
											: "N/A"}
									</span>
								</div>
							))}
						</div>
						<div className="mt-4">
							<Link
								to="/dashboard/jobs"
								className="text-sm text-primary hover:underline"
							>
								View all jobs →
							</Link>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
