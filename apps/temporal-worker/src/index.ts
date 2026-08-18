import { createWorker } from "./worker.js";

async function main() {
  try {
    const worker = await createWorker();
    console.log("⚡ Shipora Temporal Worker is running and awaiting tasks...");
    await worker.run();
  } catch (err) {
    console.error("[Temporal Worker] Fatal error running worker:", err);
    process.exit(1);
  }
}

if (process.env["NODE_ENV"] !== "test") {
  main().catch(console.error);
}

export * from "./worker.js";
export * from "./activities/index.js";
