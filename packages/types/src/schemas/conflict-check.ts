import { z } from "zod";

export const ConflictCheckStatusEnum = z.enum([
  "running",
  "passed",
  "failed",
]);

export const FailureDetailSchema = z.object({
  type: z.enum(["merge_conflict", "lockfile_inconsistency", "missing_env_vars"]),
  message: z.string(),
  files: z.array(z.string()).optional(),
  missingVars: z.array(z.string()).optional(),
});

export const ConflictCheckSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  commitSha: z.string().min(1, "Commit SHA is required"),
  branch: z.string().min(1, "Branch is required"),
  status: ConflictCheckStatusEnum,
  mergeConflicts: z.boolean().nullable().optional(),
  lockfileHealthy: z.boolean().nullable().optional(),
  envVarsValid: z.boolean().nullable().optional(),
  failureDetails: z.array(FailureDetailSchema).nullable().optional(),
  createdAt: z.date().default(() => new Date()),
});

export const CreateConflictCheckSchema = ConflictCheckSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  status: ConflictCheckStatusEnum.default("running"),
});

export const UpdateConflictCheckSchema = CreateConflictCheckSchema.partial();

export type FailureDetail = z.infer<typeof FailureDetailSchema>;
export type ConflictCheckStatus = z.infer<typeof ConflictCheckStatusEnum>;
export type ConflictCheck = z.infer<typeof ConflictCheckSchema>;
export type CreateConflictCheck = z.infer<typeof CreateConflictCheckSchema>;
export type UpdateConflictCheck = z.infer<typeof UpdateConflictCheckSchema>;
