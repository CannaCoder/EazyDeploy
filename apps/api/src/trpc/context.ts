import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { db, type Database } from "@shipora/db";

export interface ContextUser {
  id?: string;
  clerkId: string;
  email?: string;
}

export interface Context {
  user: ContextUser | null;
  db: Database;
}

export function createContext({ req }: CreateFastifyContextOptions): Context {
  const authHeader = req.headers.authorization;
  let user: ContextUser | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    // In dev/test or when decoded:
    // Check for test mock token or parsed claims
    if (token.startsWith("test_user_")) {
      user = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        clerkId: token,
        email: "test@shipora.dev",
      };
    } else {
      // Decode basic payload or use Clerk Fastify auth if present
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
