import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { db, type Database } from "@shipora/db";
import { verifyToken } from "@clerk/fastify";

export interface ContextUser {
  id?: string;
  clerkId: string;
  email?: string;
}

export interface Context {
  user: ContextUser | null;
  db: Database;
}

export async function createContext({ req }: CreateFastifyContextOptions): Promise<Context> {
  const authHeader = req.headers.authorization;
  let user: ContextUser | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const isDev = process.env["NODE_ENV"] !== "production";

    // 1. In dev / test: allow simulated test tokens
    if (token.startsWith("test_user_")) {
      if (isDev) {
        user = {
          id: "550e8400-e29b-41d4-a716-446655440000",
          clerkId: token,
          email: "test@shipora.dev",
        };
      }
    } else if (process.env["CLERK_SECRET_KEY"]) {
      // 2. Production cryptographic token verification via Clerk
      try {
        const verified = await verifyToken(token, {
          secretKey: process.env["CLERK_SECRET_KEY"],
        });
        if (verified && verified.sub) {
          user = {
            id: (verified as any).sub_id,
            clerkId: verified.sub,
            email: (verified as any).email,
          };
        }
      } catch {
        // Token verification failed or expired — user remains null
      }
    } else if (isDev) {
      // 3. Fallback in dev when no CLERK_SECRET_KEY is provided
      try {
        const parts = token.split(".");
        if (parts.length === 3 && parts[1]) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
          user = {
            id: payload.sub_id,
            clerkId: payload.sub || payload.clerkId,
            email: payload.email,
          };
        }
      } catch {
        // invalid token format
      }
    }
  }

  return {
    user,
    db,
  };
}
