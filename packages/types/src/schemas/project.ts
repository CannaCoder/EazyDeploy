import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string().min(1, "Project name is required"),
  githubRepoOwner: z.string().min(1, "GitHub repo owner is required"),
  githubRepoName: z.string().min(1, "GitHub repo name is required"),
  githubInstallationId: z.number().int().positive("Installation ID must be positive"),
  productionBranch: z.string().default("main"),
  envSecretArn: z.string().nullable().optional(),
  createdAt: z.date().default(() => new Date()),
});

export const CreateProjectSchema = ProjectSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  productionBranch: z.string().default("main").optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type Project = z.infer<typeof ProjectSchema>;
export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;
