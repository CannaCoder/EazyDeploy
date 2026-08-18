import crypto from "node:crypto";

export function validateWebhookSignature(
  rawPayload: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawPayload)
    .digest("hex")}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export interface PushEventPayload {
  ref: string;
  before: string;
  after: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
      id: number;
    };
    default_branch: string;
  };
  installation?: {
    id: number;
  };
  head_commit?: {
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  };
}

export function parsePushPayload(payload: unknown): PushEventPayload | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "ref" in payload &&
    "repository" in payload
  ) {
    return payload as PushEventPayload;
  }
  return null;
}
