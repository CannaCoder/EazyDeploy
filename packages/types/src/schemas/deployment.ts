import { z } from "zod";

export const DeploymentStatusEnum = z.enum([
  "pending",
  "building",
  "deploying",
  "verifying",
  "rolling_back",
  "success",
  "failed",
  "rolled_back",
]);

export const DeploymentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  commitSha: z.string().min(1, "Commit SHA is required"),
  branch: z.string().min(1, "Branch is required"),
  status: DeploymentStatusEnum,
  triggeredBy: z.string().uuid().nullable().optional(),
  temporalWorkflowId: z.string().nullable().optional(),
  startedAt: z.date().nullable().optional(),
  completedAt: z.date().nullable().optional(),
  createdAt: z.date().default(() => new Date()),
  // Phase 4 — Observability & Rollback
  deployedUrls: z.record(z.string()).nullable().optional(),
  previousRevisionRefs: z
    .record(
      z.object({
        aws: z.string().optional(),   // ECS task definition ARN
        azure: z.string().optional(), // Container Apps revision name
      })
    )
    .nullable()
    .optional(),
  rollbackReason: z.string().nullable().optional(),
  rolledBackTo: z.string().uuid().nullable().optional(),
});

export const CreateDeploymentSchema = DeploymentSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  status: DeploymentStatusEnum.default("pending"),
});

export const UpdateDeploymentSchema = CreateDeploymentSchema.partial();

export type DeploymentStatus = z.infer<typeof DeploymentStatusEnum>;
export type Deployment = z.infer<typeof DeploymentSchema>;
export type CreateDeployment = z.infer<typeof CreateDeploymentSchema>;
export type UpdateDeployment = z.infer<typeof UpdateDeploymentSchema>;

