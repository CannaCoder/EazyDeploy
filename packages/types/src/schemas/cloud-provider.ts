import { z } from "zod";

export const CloudProviderEnum = z.enum(["aws", "azure", "digitalocean", "gcp"]);

export const CloudConnectionStatusEnum = z.enum([
  "connected",
  "disconnected",
  "expired",
  "error",
]);

export const CloudConnectionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  provider: CloudProviderEnum,
  displayName: z.string().nullable().optional(),
  
  // AWS specific
  roleArn: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),

  // Azure specific
  tenantId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  clientSecretRef: z.string().nullable().optional(),
  subscriptionId: z.string().nullable().optional(),
  resourceGroup: z.string().nullable().optional(),

  // Common metadata
  status: CloudConnectionStatusEnum.default("connected"),
  connectedAt: z.date().nullable().optional(),
  expiresAt: z.date().nullable().optional(),
  lastUsedAt: z.date().nullable().optional(),
  createdAt: z.date().default(() => new Date()),
});

export const CreateCloudConnectionSchema = CloudConnectionSchema.omit({
  id: true,
  createdAt: true,
});

export const UpdateCloudConnectionSchema = CreateCloudConnectionSchema.partial();

export const EnvExampleEntrySchema = z.object({
  key: z.string().min(1),
  defaultValue: z.string().nullable(),
  description: z.string().nullable(),
  group: z.string().nullable(),
  isRequired: z.boolean(),
});

export type CloudProvider = z.infer<typeof CloudProviderEnum>;
export type CloudConnectionStatus = z.infer<typeof CloudConnectionStatusEnum>;
export type CloudConnection = z.infer<typeof CloudConnectionSchema>;
export type CreateCloudConnection = z.infer<typeof CreateCloudConnectionSchema>;
export type UpdateCloudConnection = z.infer<typeof UpdateCloudConnectionSchema>;
export type EnvExampleEntry = z.infer<typeof EnvExampleEntrySchema>;
