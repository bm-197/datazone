import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { Package, DollarSign, MessageSquare, Activity, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardAction,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface SectionCardsProps {
	totalProducts: number;
	recentProducts: number;
	recentProductsPercent: string;
	totalPrices: number;
	totalReviews: number;
	totalJobs: number;
	completedJobs: number;
	failedJobs: number;
	successRate: string;
	apiUsage: number;
	apiLimit: number;
	apiUsagePercent: number;
}

export function SectionCards({
	totalProducts,
	recentProducts,
	recentProductsPercent,
	totalPrices,
	totalReviews,
	totalJobs,
	completedJobs,
	failedJobs,
	successRate,
	apiUsage,
	apiLimit,
	apiUsagePercent,
}: SectionCardsProps) {
	const hasGrowth = parseFloat(recentProductsPercent) > 0;

	return (
		<div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 md:grid-cols-2 lg:grid-cols-4">
			<Card className="@container/card">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardDescription className="flex items-center gap-2 text-xs">
							<Package className="h-3.5 w-3.5" />
							Total Products
						</CardDescription>
						{recentProducts > 0 && (
							<Badge variant="outline" className="text-xs h-5">
								{hasGrowth ? (
									<IconTrendingUp className="h-2.5 w-2.5 mr-1" />
								) : (
									<IconTrendingDown className="h-2.5 w-2.5 mr-1" />
								)}
								{recentProducts}
							</Badge>
						)}
					</div>
					<CardTitle className="text-2xl font-semibold tabular-nums mt-2">
						{totalProducts.toLocaleString()}
					</CardTitle>
				</CardHeader>
				<CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
					{recentProducts > 0 ? `${recentProducts} new in 7d` : "No new products"} · {totalPrices.toLocaleString()} prices
				</CardFooter>
			</Card>

			<Card className="@container/card">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardDescription className="flex items-center gap-2 text-xs">
							<MessageSquare className="h-3.5 w-3.5" />
							Total Reviews
						</CardDescription>
						<Badge variant="outline" className="text-xs h-5">
							<IconTrendingUp className="h-2.5 w-2.5 mr-1" />
							Collected
						</Badge>
					</div>
					<CardTitle className="text-2xl font-semibold tabular-nums mt-2">
						{totalReviews.toLocaleString()}
					</CardTitle>
				</CardHeader>
				<CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
					Avg: {totalProducts > 0 ? (totalReviews / totalProducts).toFixed(1) : 0} per product
				</CardFooter>
			</Card>

			<Card className="@container/card">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardDescription className="flex items-center gap-2 text-xs">
							<Activity className="h-3.5 w-3.5" />
							Success Rate
						</CardDescription>
						<Badge variant={parseFloat(successRate) >= 80 ? "default" : "destructive"} className="text-xs h-5">
							{parseFloat(successRate) >= 80 ? (
								<IconTrendingUp className="h-2.5 w-2.5 mr-1" />
							) : (
								<IconTrendingDown className="h-2.5 w-2.5 mr-1" />
							)}
							{completedJobs}/{totalJobs}
						</Badge>
					</div>
					<CardTitle className="text-2xl font-semibold tabular-nums mt-2">
						{successRate}%
					</CardTitle>
				</CardHeader>
				<CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
					{completedJobs} completed · {failedJobs} failed
				</CardFooter>
			</Card>

			<Card className="@container/card">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardDescription className="flex items-center gap-2 text-xs">
							<DollarSign className="h-3.5 w-3.5" />
							API Usage
						</CardDescription>
						<Badge
							variant={
								apiUsagePercent > 80
									? "destructive"
									: apiUsagePercent > 50
									? "outline"
									: "default"
							}
							className="text-xs h-5"
						>
							{apiUsagePercent > 80 ? (
								<AlertTriangle className="h-2.5 w-2.5 mr-1" />
							) : (
								<IconTrendingUp className="h-2.5 w-2.5 mr-1" />
							)}
							{apiUsage}/{apiLimit}
						</Badge>
					</div>
					<CardTitle className="text-2xl font-semibold tabular-nums mt-2">
						{apiUsagePercent.toFixed(1)}%
					</CardTitle>
				</CardHeader>
				<CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
					{apiLimit - apiUsage} remaining this month
				</CardFooter>
			</Card>
		</div>
	);
}
