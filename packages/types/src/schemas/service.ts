import { z } from "zod";

export const ServiceTypeEnum = z.enum([
  "nextjs",
  "vite",
  "node",
  "fastapi",
  "docker",
]);

export const ServiceSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1, "Service name is required"),
  type: ServiceTypeEnum,
  rootPath: z.string().min(1, "Root path is required"),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  buildCommand: z.string().nullable().optional(),
  ecsServiceArn: z.string().nullable().optional(),
  currentTaskDef: z.string().nullable().optional(),
  previousTaskDef: z.string().nullable().optional(),
  serviceUrl: z.string().url().nullable().optional(),
  createdAt: z.date().default(() => new Date()),
});

export const CreateServiceSchema = ServiceSchema.omit({
  id: true,
  createdAt: true,
});

export const UpdateServiceSchema = CreateServiceSchema.partial();

export type ServiceType = z.infer<typeof ServiceTypeEnum>;
export type Service = z.infer<typeof ServiceSchema>;
export type CreateService = z.infer<typeof CreateServiceSchema>;
export type UpdateService = z.infer<typeof UpdateServiceSchema>;
