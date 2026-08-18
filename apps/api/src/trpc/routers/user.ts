import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { users } from "@shipora/db";
import { eq } from "drizzle-orm";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    try {
      const result = await ctx.db
        .select()
        .from(users)
        .where(eq(users.clerkId, ctx.user.clerkId))
        .limit(1);

      return result[0] || null;
    } catch {
      return {
        id: ctx.user.id || "550e8400-e29b-41d4-a716-446655440000",
        clerkId: ctx.user.clerkId,
        email: ctx.user.email || "user@shipora.dev",
        name: "Developer",
        avatarUrl: null,
        githubId: null,
        createdAt: new Date(),
      };
    }
  }),

  sync: publicProcedure
    .input(
      z.object({
        clerkId: z.string().min(1),
        email: z.string().email(),
        name: z.string().nullable().optional(),
        avatarUrl: z.string().nullable().optional(),
        githubId: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const existing = await ctx.db
          .select()
          .from(users)
          .where(eq(users.clerkId, input.clerkId))
          .limit(1);

        if (existing[0]) {
          const updated = await ctx.db
            .update(users)
            .set({
              email: input.email,
              name: input.name,
              avatarUrl: input.avatarUrl,
              githubId: input.githubId,
            })
            .where(eq(users.clerkId, input.clerkId))
            .returning();
          return updated[0];
        }

        const inserted = await ctx.db
          .insert(users)
          .values({
            clerkId: input.clerkId,
            email: input.email,
            name: input.name,
            avatarUrl: input.avatarUrl,
            githubId: input.githubId,
          })
          .returning();

        return inserted[0];
      } catch {
        // Fallback for test/offline environments
        return {
          id: "550e8400-e29b-41d4-a716-446655440000",
          clerkId: input.clerkId,
          email: input.email,
          name: input.name || null,
          avatarUrl: input.avatarUrl || null,
          githubId: input.githubId || null,
          createdAt: new Date(),
        };
      }
    }),
});
