import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Search, Star, DollarSign, TrendingUp, AlertCircle, Calendar, Tag, Building2, CheckCircle2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { StarRating } from "@/components/star-rating";

export const Route = createFileRoute("/dashboard/products/")({
	component: ProductsPage,
});

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function fetchProducts(page = 1, limit = 20) {
	const response = await fetch(`${API_URL}/api/products?page=${page}&limit=${limit}`, {
		credentials: 'include',
	});
	if (!response.ok) {
		throw new Error("Failed to fetch products");
	}
	return response.json();
}

function ProductsPage() {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const limit = 20;

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: ["products", page, limit],
		queryFn: () => fetchProducts(page, limit),
	});

	const handleCollect = async () => {
		try {
		const response = await fetch(`${API_URL}/api/products/collect`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: 'include',
			body: JSON.stringify({
				keyword: search || undefined,
			}),
		});

			if (!response.ok) {
				throw new Error("Failed to trigger collection");
			}

			setIsDialogOpen(false);
			setSearch("");
			setTimeout(() => refetch(), 2000);
		} catch (error) {
			console.error("Error triggering collection:", error);
			alert("Failed to trigger collection");
		}
	};

	const products = data?.products || [];
	const pagination = data?.pagination || {};

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">Products</h2>
					<p className="text-muted-foreground">
						View and manage collected Amazon products
					</p>
				</div>
			</div>

			<div className="flex gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search products or enter keyword to collect..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-10"
					/>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button>Collect Products</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Collect Products</DialogTitle>
							<DialogDescription>
								Enter a keyword to search and collect products from Amazon.
							</DialogDescription>
						</DialogHeader>
						<Input
							placeholder="Enter search keyword (e.g., 'laptop', 'wireless mouse')..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && search.trim()) {
									e.preventDefault();
									handleCollect();
								}
							}}
							className="mt-4"
							autoFocus
						/>
						<DialogFooter>
							<Button variant="outline" onClick={() => setIsDialogOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleCollect} disabled={!search.trim()}>
								Collect
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{isLoading ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Card key={i}>
							<CardContent className="p-4">
								<Skeleton className="w-full h-48 mb-3" />
								<Skeleton className="h-6 mb-2" />
								<Skeleton className="h-4 w-1/2" />
							</CardContent>
						</Card>
					))}
				</div>
			) : error ? (
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						Error loading products: {error.message}
					</AlertDescription>
				</Alert>
			) : products.length === 0 ? (
				<Card className="p-8 text-center">
					<CardContent>
						<Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<p className="text-muted-foreground mb-4">
							No products found. Start collecting products by entering a keyword above.
						</p>
						<Button onClick={() => setIsDialogOpen(true)}>Collect Products</Button>
					</CardContent>
				</Card>
			) : (
				<>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{products.map((product: any) => (
							<Card key={product.id} className="hover:bg-accent transition-colors h-full flex flex-col group relative">
								<Link
									to="/dashboard/products/$asin"
									params={{ asin: product.asin }}
									className="absolute inset-0 z-0"
									aria-label={`View details for ${product.title}`}
								/>
								<div className="relative overflow-hidden z-10">
									{product.images && product.images.length > 0 ? (
										<img
											src={product.images[0]}
											alt={product.title}
											className="w-full h-56 object-contain bg-muted/50 p-4"
										/>
									) : (
										<div className="w-full h-56 bg-muted flex items-center justify-center">
											<Package className="h-16 w-16 text-muted-foreground" />
										</div>
									)}
									{product.rating && (
										<div className="absolute top-2 right-2">
											<Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
												<Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
												{product.rating.toFixed(1)}
											</Badge>
										</div>
									)}
								</div>
								<CardContent className="p-4 flex-grow flex flex-col gap-3 relative z-10">
									<div className="flex-grow">
										<div className="flex items-start justify-between gap-2 mb-2">
											<CardTitle className="line-clamp-2 text-base font-semibold flex-1">
												{product.title}
											</CardTitle>
											<a
												href={`https://www.amazon.com/dp/${product.asin}`}
												target="_blank"
												rel="noopener noreferrer"
												onClick={(e) => e.stopPropagation()}
												className="flex-shrink-0 p-1 hover:bg-accent rounded transition-colors relative z-20"
												aria-label={`View ${product.title} on Amazon`}
											>
												<ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
											</a>
										</div>
											{product.brand && (
												<div className="flex items-center gap-1.5 mb-2">
													<Building2 className="h-3 w-3 text-muted-foreground" />
													<span className="text-xs text-muted-foreground">{product.brand}</span>
												</div>
											)}
										</div>
										<div className="space-y-2 mt-auto">
											<div className="flex items-center gap-2 flex-wrap">
												<Badge variant="outline" className="text-xs font-mono">
													{product.asin}
												</Badge>
												{product.category && (
													<Badge variant="secondary" className="text-xs">
														<Tag className="h-3 w-3 mr-1" />
														{product.category}
													</Badge>
												)}
											</div>
											{product.rating && (
												<div className="flex items-center justify-between pt-2 border-t">
													<div className="flex items-center gap-2">
														<StarRating 
															rating={product.rating} 
															size="sm"
														/>
														<span className="text-xs text-muted-foreground">
															({product.reviewCount || 0})
														</span>
													</div>
													{product.availability && (
														<Badge variant={product.availability.toLowerCase().includes("in stock") ? "default" : "outline"} className="text-xs">
															<CheckCircle2 className="h-3 w-3 mr-1" />
															{product.availability}
														</Badge>
													)}
												</div>
											)}
											{product.createdAt && (
												<div className="flex items-center gap-1 text-xs text-muted-foreground">
													<Calendar className="h-3 w-3" />
													Added {new Date(product.createdAt).toLocaleDateString()}
												</div>
											)}
										</div>
									</CardContent>
								</Card>
						))}
					</div>

					{pagination.totalPages > 1 && (
						<div className="flex gap-2 justify-center mt-8">
							<Button
								variant="outline"
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page === 1}
							>
								Previous
							</Button>
							<Badge variant="secondary" className="flex items-center px-4">
								Page {page} of {pagination.totalPages}
							</Badge>
							<Button
								variant="outline"
								onClick={() =>
									setPage((p) => Math.min(pagination.totalPages, p + 1))
								}
								disabled={page === pagination.totalPages}
							>
								Next
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
