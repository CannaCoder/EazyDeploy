import { z } from "zod";

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  actorId: z.string().uuid().nullable().optional(),
  event: z.string().min(1, "Event name is required"),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.date().default(() => new Date()),
});

export const CreateAuditLogSchema = AuditLogSchema.omit({
  id: true,
  createdAt: true,
});

export type AuditLog = z.infer<typeof AuditLogSchema>;
export type CreateAuditLog = z.infer<typeof CreateAuditLogSchema>;
