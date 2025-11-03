import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RefreshCw, Star, Package, DollarSign, TrendingUp, Calendar, User, CheckCircle2, MessageSquare } from "lucide-react";
import { IconRefresh } from "@tabler/icons-react";
import { StarRating } from "@/components/star-rating";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/products/$asin")({
	component: ProductDetailPage,
});

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function fetchProduct(asin: string) {
	const response = await fetch(`${API_URL}/api/products/${asin}`, {
		credentials: 'include',
	});
	if (!response.ok) {
		throw new Error("Failed to fetch product");
	}
	return response.json();
}

async function fetchReviews(asin: string) {
	const response = await fetch(`${API_URL}/api/products/${asin}/reviews`, {
		credentials: 'include',
	});
	if (!response.ok) {
		throw new Error("Failed to fetch reviews");
	}
	return response.json();
}

function ProductDetailPage() {
	const { asin } = Route.useParams();
	const [refreshing, setRefreshing] = useState(false);

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["product", asin],
		queryFn: () => fetchProduct(asin),
	});

	const { data: reviewsData, isLoading: reviewsLoading, refetch: refetchReviews } = useQuery({
		queryKey: ["productReviews", asin],
		queryFn: () => fetchReviews(asin),
	});

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
		const response = await fetch(`${API_URL}/api/products/collect`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: 'include',
			body: JSON.stringify({ asin }),
		});

			if (!response.ok) {
				throw new Error("Failed to trigger refresh");
			}

			const result = await response.json();
			console.log("Collection job triggered:", result.jobId);

			// Wait a bit for the job to process, then refetch
			setTimeout(async () => {
				await refetch();
				await refetchReviews();
				setRefreshing(false);
			}, 5000); // Wait 5 seconds for job to complete
		} catch (err) {
			console.error("Error refreshing product:", err);
			alert("Failed to refresh product data.");
			setRefreshing(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Skeleton className="h-10 w-1/2 mb-6" />
				<div className="grid gap-6 md:grid-cols-2">
					<Card>
						<CardContent className="p-6">
							<Skeleton className="w-full h-96 mb-6" />
							<Skeleton className="h-6 w-3/4 mb-2" />
							<Skeleton className="h-4 w-1/2" />
						</CardContent>
					</Card>
					<Card>
						<CardContent className="p-6">
							<Skeleton className="h-6 w-full mb-4" />
							<Skeleton className="h-48 w-full" />
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Alert variant="destructive">
					<AlertDescription>
						Error loading product: {error.message}
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	const product = data?.product;
	const priceHistory = data?.priceHistory || [];
	const reviews = data?.reviews || reviewsData?.reviews || [];
	

	if (!product) {
		return (
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Alert>
					<AlertDescription>Product not found.</AlertDescription>
				</Alert>
			</div>
		);
	}

	// Prepare chart data
	const chartData = priceHistory
		.slice()
		.reverse()
		.map((price: any) => ({
			date: new Date(price.collectedAt).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			}),
			price: price.price,
			fullDate: price.collectedAt,
		}));

	const chartConfig: ChartConfig = {
		price: {
			label: "Price",
			color: "hsl(var(--chart-1))",
		},
	} satisfies ChartConfig;

	const latestPrice = priceHistory.length > 0 ? priceHistory[0] : null;
	const previousPrice = priceHistory.length > 1 ? priceHistory[1] : null;
	const priceChange = latestPrice && previousPrice 
		? latestPrice.price - previousPrice.price 
		: null;
	const priceChangePercent = latestPrice && previousPrice && previousPrice.price > 0
		? ((latestPrice.price - previousPrice.price) / previousPrice.price) * 100
		: null;

	const averageRating = (() => {
		if (product.rating && product.rating > 0) {
			return product.rating;
		}
		
		if (reviews && reviews.length > 0) {
			const validReviews = reviews.filter((r: any) => r.rating && r.rating > 0);
			if (validReviews.length > 0) {
				const sum = validReviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0);
				return sum / validReviews.length;
			}
		}
		
		return null;
	})();

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<Badge variant="outline" className="mb-2">ASIN: {asin}</Badge>
					<h2 className="text-2xl font-bold tracking-tight">{product.title}</h2>
				</div>
				<Button 
					onClick={handleRefresh} 
					disabled={refreshing}
					variant="outline"
					size="icon"
					aria-label="Refresh product data"
				>
					<IconRefresh className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
				</Button>
			</div>

			{/* Product Overview Cards */}
			<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4">
				<Card className="@container/card">
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardDescription className="flex items-center gap-2 text-xs">
								<DollarSign className="h-3.5 w-3.5" />
								Current Price
							</CardDescription>
							{priceChange !== null && priceChangePercent !== null && (
								<Badge variant={priceChange > 0 ? "destructive" : "secondary"} className="text-xs h-5">
									{priceChange > 0 ? (
										<TrendingUp className="h-2.5 w-2.5 mr-1" />
									) : (
										<TrendingUp className="h-2.5 w-2.5 mr-1 rotate-180" />
									)}
									{Math.abs(priceChangePercent).toFixed(1)}%
								</Badge>
							)}
						</div>
						<CardTitle className="text-2xl font-semibold tabular-nums mt-2">
							{latestPrice ? (
								<>
									{latestPrice.currency} {latestPrice.price.toFixed(2)}
									{latestPrice.originalPrice && latestPrice.originalPrice > latestPrice.price && (
										<span className="text-sm text-muted-foreground line-through ml-2">
											{latestPrice.currency} {latestPrice.originalPrice.toFixed(2)}
										</span>
									)}
								</>
							) : (
								"N/A"
							)}
						</CardTitle>
					</CardHeader>
					<CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
						{latestPrice ? (
							<>Last updated: {new Date(latestPrice.collectedAt).toLocaleDateString()}</>
						) : (
							"No price data"
						)}
					</CardFooter>
				</Card>

				<Card className="@container/card">
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardDescription className="flex items-center gap-2 text-xs">
								<Star className="h-3.5 w-3.5" />
								Average Rating
							</CardDescription>
							{averageRating && (
								<StarRating 
									rating={averageRating} 
									size="sm"
								/>
							)}
						</div>
						<CardTitle className="text-2xl font-semibold tabular-nums mt-2">
							{averageRating ? averageRating.toFixed(1) : "N/A"}
						</CardTitle>
					</CardHeader>
					<CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
						Based on {reviews.length} review{reviews.length !== 1 ? "s" : ""}
						{product.rating && product.rating > 0 && " • "}
						{product.rating && product.rating > 0 && `ScraperAPI: ${product.rating.toFixed(1)}`}
					</CardFooter>
				</Card>

				<Card className="@container/card">
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardDescription className="flex items-center gap-2 text-xs">
								<TrendingUp className="h-3.5 w-3.5" />
								Price Points
							</CardDescription>
							<Badge variant="outline" className="text-xs h-5">
								Collected
							</Badge>
						</div>
						<CardTitle className="text-2xl font-semibold tabular-nums mt-2">
							{priceHistory.length}
						</CardTitle>
					</CardHeader>
					<CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
						Price history data points
					</CardFooter>
				</Card>

				<Card className="@container/card">
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							<CardDescription className="flex items-center gap-2 text-xs">
								<MessageSquare className="h-3.5 w-3.5" />
								Reviews
							</CardDescription>
							<Badge variant="outline" className="text-xs h-5">
								Available
							</Badge>
						</div>
						<CardTitle className="text-2xl font-semibold tabular-nums mt-2">
							{reviews.length}
						</CardTitle>
					</CardHeader>
					<CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
						Customer reviews collected
					</CardFooter>
				</Card>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Product Details</CardTitle>
						<CardDescription>Product information and specifications</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div>
							{product.images && product.images.length > 0 ? (
								<img
									src={product.images[0]}
									alt={product.title}
									className="w-full h-96 object-contain rounded-lg border"
								/>
							) : (
								<div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center border">
									<Package className="h-24 w-24 text-muted-foreground" />
								</div>
							)}
						</div>

						<Separator />

						<div className="space-y-4">
							{product.description && (
								<div>
									<h3 className="text-sm font-medium mb-2">Description</h3>
									<p className="text-sm text-muted-foreground">{product.description}</p>
								</div>
							)}

							<div className="grid grid-cols-2 gap-4">
								{product.brand && (
									<div>
										<h3 className="text-sm font-medium mb-2">Brand</h3>
										<Badge variant="secondary">{product.brand}</Badge>
									</div>
								)}
								{product.category && (
									<div>
										<h3 className="text-sm font-medium mb-2">Category</h3>
										<Badge variant="outline">{product.category}</Badge>
									</div>
								)}
							</div>

							{product.specifications && Object.keys(product.specifications).length > 0 && (
								<div>
									<h3 className="text-sm font-medium mb-2">Specifications</h3>
									<div className="space-y-2">
										{Object.entries(product.specifications).map(([key, value]) => (
											<div key={key} className="flex justify-between text-sm">
												<span className="text-muted-foreground">{key}:</span>
												<span>{value as string}</span>
											</div>
										))}
									</div>
								</div>
							)}

							{product.features && product.features.length > 0 && (
								<div>
									<h3 className="text-sm font-medium mb-2">Features</h3>
									<ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
										{product.features.map((feature: string, index: number) => (
											<li key={index}>{feature}</li>
										))}
									</ul>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Price History</CardTitle>
						<CardDescription>
							Price changes over time ({priceHistory.length} data points)
						</CardDescription>
					</CardHeader>
					<CardContent>
						{priceHistory.length > 1 ? (
							<ChartContainer config={chartConfig}>
								<AreaChart data={chartData}>
									<CartesianGrid strokeDasharray="3 3" vertical={false} />
									<XAxis 
										dataKey="date" 
										tickLine={false}
										axisLine={false}
										tickMargin={8}
									/>
									<YAxis 
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										tickFormatter={(value) => `$${value}`}
									/>
									<ChartTooltip
										cursor={false}
										content={<ChartTooltipContent indicator="dot" />}
									/>
									<Area
										type="monotone"
										dataKey="price"
										fill="var(--color-price)"
										fillOpacity={0.6}
										stroke="var(--color-price)"
										stackId="a"
									/>
								</AreaChart>
							</ChartContainer>
						) : (
							<Alert>
								<AlertDescription>
									Not enough data to display price history. Collect more data points to see trends.
								</AlertDescription>
							</Alert>
						)}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Customer Reviews</CardTitle>
					<CardDescription>
						{reviews.length} review{reviews.length !== 1 ? "s" : ""} available
					</CardDescription>
				</CardHeader>
				<CardContent>
					{reviewsLoading ? (
						<div className="space-y-4">
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
						</div>
					) : reviews.length === 0 ? (
						<Alert>
							<AlertDescription>No reviews found for this product.</AlertDescription>
						</Alert>
					) : (
						<Tabs defaultValue="all" className="w-full">
							<TabsList className="mb-4">
								<TabsTrigger value="all">All Reviews ({reviews.length})</TabsTrigger>
								<TabsTrigger value="verified">Verified ({reviews.filter((r: any) => r.verified).length})</TabsTrigger>
							</TabsList>
							<TabsContent value="all" className="space-y-4">
								{reviews.map((review: any) => (
									<Card key={review.id} className="border-l-4 border-l-primary">
										<CardContent className="p-4">
											<div className="flex items-start gap-4">
												<Avatar className="h-10 w-10">
													<AvatarFallback>
														<User className="h-5 w-5" />
													</AvatarFallback>
												</Avatar>
												<div className="flex-1 space-y-2">
													<div className="flex items-center gap-2">
														<span className="font-semibold">{review.author}</span>
														{review.verified && (
															<Badge variant="secondary" className="text-xs">
																<CheckCircle2 className="h-3 w-3 mr-1" />
																Verified Purchase
															</Badge>
														)}
														<div className="flex items-center gap-1 ml-auto">
															{Array.from({ length: 5 }).map((_, i) => (
																<Star
																	key={i}
																	className={`h-3 w-3 ${
																		i < review.rating
																			? "fill-yellow-400 text-yellow-400"
																			: "text-muted-foreground"
																	}`}
																/>
															))}
															<span className="text-sm font-medium ml-1">{review.rating}</span>
														</div>
													</div>
													{review.title && (
														<h4 className="font-medium">{review.title}</h4>
													)}
													<p className="text-sm text-muted-foreground">{review.text}</p>
													<div className="flex items-center gap-4 text-xs text-muted-foreground">
													{review.date && (
														<div className="flex items-center gap-1">
															<Calendar className="h-3 w-3" />
															{(() => {
																try {
																	const dateValue = typeof review.date === "string" ? new Date(review.date) : review.date;
																	return dateValue instanceof Date && !isNaN(dateValue.getTime()) 
																		? dateValue.toLocaleDateString()
																		: typeof review.date === "string" ? review.date : "Unknown date";
																} catch {
																	return typeof review.date === "string" ? review.date : "Unknown date";
																}
															})()}
														</div>
													)}
														{review.helpfulCount !== undefined && review.helpfulCount > 0 && (
															<div className="flex items-center gap-1">
																{review.helpfulCount} helpful
															</div>
														)}
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</TabsContent>
							<TabsContent value="verified" className="space-y-4">
								{reviews.filter((r: any) => r.verified).map((review: any) => (
									<Card key={review.id} className="border-l-4 border-l-primary">
										<CardContent className="p-4">
											<div className="flex items-start gap-4">
												<Avatar className="h-10 w-10">
													<AvatarFallback>
														<User className="h-5 w-5" />
													</AvatarFallback>
												</Avatar>
												<div className="flex-1 space-y-2">
													<div className="flex items-center gap-2">
														<span className="font-semibold">{review.author}</span>
														<Badge variant="secondary" className="text-xs">
															<CheckCircle2 className="h-3 w-3 mr-1" />
															Verified Purchase
														</Badge>
														<div className="flex items-center gap-1 ml-auto">
															{Array.from({ length: 5 }).map((_, i) => (
																<Star
																	key={i}
																	className={`h-3 w-3 ${
																		i < review.rating
																			? "fill-yellow-400 text-yellow-400"
																			: "text-muted-foreground"
																	}`}
																/>
															))}
															<span className="text-sm font-medium ml-1">{review.rating}</span>
														</div>
													</div>
													{review.title && (
														<h4 className="font-medium">{review.title}</h4>
													)}
													<p className="text-sm text-muted-foreground">{review.text}</p>
													<div className="flex items-center gap-4 text-xs text-muted-foreground">
													{review.date && (
														<div className="flex items-center gap-1">
															<Calendar className="h-3 w-3" />
															{(() => {
																try {
																	const dateValue = typeof review.date === "string" ? new Date(review.date) : review.date;
																	return dateValue instanceof Date && !isNaN(dateValue.getTime()) 
																		? dateValue.toLocaleDateString()
																		: typeof review.date === "string" ? review.date : "Unknown date";
																} catch {
																	return typeof review.date === "string" ? review.date : "Unknown date";
																}
															})()}
														</div>
													)}
														{review.helpfulCount !== undefined && review.helpfulCount > 0 && (
															<div className="flex items-center gap-1">
																{review.helpfulCount} helpful
															</div>
														)}
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</TabsContent>
						</Tabs>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
