import { describe, it, expect } from "vitest";
import { parseEnvExample, parseRawEnv } from "../index.js";

describe(".env.example Auto-Detection & Parsing", () => {
  it("parses .env.example with comments, default values, and section groups", () => {
    const exampleContent = `
# ========================
# Database Configuration
# ========================
# Main PostgreSQL connection string
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb # Required in production
DB_POOL_SIZE=10

# --- Authentication ---
NEXTAUTH_SECRET= # Secret used to encrypt session tokens
NEXTAUTH_URL="http://localhost:3000"

# Storage
AWS_S3_BUCKET='my-app-uploads'
AWS_REGION=us-east-1 # Target AWS region
`;

    const entries = parseEnvExample(exampleContent);

    expect(entries).toHaveLength(6);

    const dbUrl = entries.find((e) => e.key === "DATABASE_URL");
    expect(dbUrl).toBeDefined();
    expect(dbUrl?.defaultValue).toBe("postgresql://user:pass@localhost:5432/mydb");
    expect(dbUrl?.description).toBe("Required in production");
    expect(dbUrl?.group).toBe("Database Configuration");
    expect(dbUrl?.isRequired).toBe(false);

    const authSecret = entries.find((e) => e.key === "NEXTAUTH_SECRET");
    expect(authSecret).toBeDefined();
    expect(authSecret?.defaultValue).toBeNull();
    expect(authSecret?.description).toBe("Secret used to encrypt session tokens");
    expect(authSecret?.group).toBe("Authentication");
    expect(authSecret?.isRequired).toBe(true);

    const authUrl = entries.find((e) => e.key === "NEXTAUTH_URL");
    expect(authUrl?.defaultValue).toBe("http://localhost:3000");

    const s3Bucket = entries.find((e) => e.key === "AWS_S3_BUCKET");
    expect(s3Bucket?.defaultValue).toBe("my-app-uploads");
    expect(s3Bucket?.group).toBe("Storage");
  });

  it("handles raw paste of KEY=value pairs into a text area", () => {
    const rawPasted = `
DATABASE_URL=postgresql://prod-db.internal:5432/prod
JWT_SECRET="super-secret-production-key-12345"
PORT=8080
# Comment to ignore
API_KEY='live_key_xyz987'
`;

    const parsed = parseRawEnv(rawPasted);

    expect(parsed["DATABASE_URL"]).toBe("postgresql://prod-db.internal:5432/prod");
    expect(parsed["JWT_SECRET"]).toBe("super-secret-production-key-12345");
    expect(parsed["PORT"]).toBe("8080");
    expect(parsed["API_KEY"]).toBe("live_key_xyz987");
    expect(Object.keys(parsed)).toHaveLength(4);
  });
});
