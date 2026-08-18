import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  clerkId: z.string().min(1, "Clerk ID is required"),
  githubId: z.number().nullable().optional(),
  email: z.string().email("Invalid email address"),
  name: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  createdAt: z.date().default(() => new Date()),
});

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
});

export const UpdateUserSchema = CreateUserSchema.partial();

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
