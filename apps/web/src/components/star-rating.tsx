import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
	rating: number;
	maxRating?: number;
	showNumber?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
}

const sizeClasses = {
	sm: "h-3 w-3",
	md: "h-4 w-4",
	lg: "h-5 w-5",
};

export function StarRating({
	rating,
	maxRating = 5,
	showNumber = false,
	size = "md",
	className,
}: StarRatingProps) {
	const fullStars = Math.floor(rating);
	const hasHalfStar = rating % 1 >= 0.5;
	const emptyStars = maxRating - fullStars - (hasHalfStar ? 1 : 0);

	return (
		<div className={cn("flex items-center gap-1", className)}>
			<div className="flex items-center gap-0.5">
				{/* Full stars */}
				{Array.from({ length: fullStars }).map((_, i) => (
					<Star
						key={`full-${i}`}
						className={cn(
							sizeClasses[size],
							"fill-yellow-400 text-yellow-400"
						)}
					/>
				))}
				{/* Half star */}
				{hasHalfStar && (
					<div className="relative">
						<Star
							className={cn(
								sizeClasses[size],
								"text-muted-foreground"
							)}
						/>
						<Star
							className={cn(
								sizeClasses[size],
								"fill-yellow-400 text-yellow-400 absolute inset-0 overflow-hidden"
							)}
							style={{ clipPath: "inset(0 50% 0 0)" }}
						/>
					</div>
				)}
				{/* Empty stars */}
				{Array.from({ length: emptyStars }).map((_, i) => (
					<Star
						key={`empty-${i}`}
						className={cn(
							sizeClasses[size],
							"text-muted-foreground"
						)}
					/>
				))}
			</div>
			{showNumber && (
				<span className="text-sm font-medium ml-1">
					{rating.toFixed(1)}
				</span>
			)}
		</div>
	);
}

