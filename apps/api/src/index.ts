import { buildApp } from "./app.js";
import { env } from "./env.js";

async function main() {
  const app = await buildApp({ logger: true });

  try {
    const address = await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });
    console.log(`⚡ Shipora API running on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
