import { Worker, NativeConnection } from "@temporalio/worker";
import * as activities from "./activities/index.js";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";

// Load .env files if present
function loadEnvSafe() {
  const envPaths = [
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), ".env"),
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const [key, ...rest] = trimmed.split("=");
            const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
            if (key && !process.env[key.trim()]) {
              process.env[key.trim()] = val;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }
}

loadEnvSafe();

export async function createWorker(): Promise<Worker> {
  const address = process.env["TEMPORAL_ADDRESS"] || "localhost:7233";
  const namespace = process.env["TEMPORAL_NAMESPACE"] || "default";
  const apiKey = process.env["TEMPORAL_API_KEY"];
  const cert = process.env["TEMPORAL_MTLS_TLS_CERT"] || process.env["TEMPORAL_CLIENT_CERT"];
  const key = process.env["TEMPORAL_MTLS_TLS_KEY"] || process.env["TEMPORAL_CLIENT_KEY"];

  console.log(`[Temporal Worker] Connecting to Temporal at ${address} (namespace: ${namespace})...`);

  let connection: NativeConnection;

  if (apiKey) {
    console.log("[Temporal Worker] Authenticating with Temporal Cloud API Key...");
    connection = await NativeConnection.connect({
      address,
      apiKey,
      tls: true,
    });
  } else if (cert && key) {
    console.log("[Temporal Worker] Authenticating with Temporal Cloud mTLS certificates...");
    connection = await NativeConnection.connect({
      address,
      tls: {
        clientCertPair: {
          crt: Buffer.from(cert, "utf-8"),
          key: Buffer.from(key, "utf-8"),
        },
      },
    });
  } else {
    console.log("[Temporal Worker] Connecting in local/insecure mode (no API key or certs provided)...");
    connection = await NativeConnection.connect({
      address,
    });
  }

  // Workflows path for Temporal bundler (bundles all workflows)
  const workflowsPath = resolve(
    process.cwd(),
    "../../packages/temporal-workflows/src/index.ts"
  );
  const taskQueue = process.env["TEMPORAL_TASK_QUEUE"] || "conflict-guard";

  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath,
    activities,
  });

  console.log(`[Temporal Worker] Worker initialized on taskQueue: ${taskQueue}`);
  return worker;
}
