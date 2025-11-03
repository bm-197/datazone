import type { Request, Response, NextFunction } from "express";
import { auth } from "@datazone/auth";

export interface AuthRequest extends Request {
	userId?: string;
	session?: {
		user: {
			id: string;
			email: string;
		};
		session: {
			id: string;
		};
	};
}

export async function requireAuth(
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) {
	try {
		// Use better-auth's API to verify session from request headers/cookies
		// Convert headers to a format better-auth expects
		const headers: Record<string, string> = {};
		for (const [key, value] of Object.entries(req.headers)) {
			if (value) {
				const headerValue = Array.isArray(value) ? (value[0] ?? "") : value;
				if (headerValue) {
					headers[key.toLowerCase()] = headerValue;
				}
			}
		}

		// better-auth expects cookies in the cookie header
		if (req.headers.cookie) {
			headers.cookie = Array.isArray(req.headers.cookie) 
				? req.headers.cookie.join('; ') 
				: req.headers.cookie;
		}

		// Get session using better-auth's internal API
		const session = await (auth as any).api.getSession({
			headers,
		});

		if (!session?.user) {
			return res.status(401).json({
				success: false,
				error: "Unauthorized: Authentication required",
			});
		}

		req.userId = session.user.id;
		req.session = session;

		next();
	} catch (error) {
		console.error("Auth middleware error:", error);
		return res.status(401).json({
			success: false,
			error: "Unauthorized: Invalid session",
		});
	}
}
