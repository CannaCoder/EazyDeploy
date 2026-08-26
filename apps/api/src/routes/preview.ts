import { type FastifyPluginAsync } from "fastify";
import fs from "node:fs";
import path from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

export const previewRoutes: FastifyPluginAsync = async (app) => {
  const serveIndex = (projectId: string, reply: any) => {
    const baseDir = path.join("/tmp", "shipora-static-sites", projectId);
    const indexPath = path.join(baseDir, "index.html");

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, "utf-8");
      // Inject <base> tag so relative CSS, JS, and image assets resolve correctly
      if (!html.includes("<base ") && !html.includes("<BASE ")) {
        if (html.includes("<head>")) {
          html = html.replace("<head>", `<head>\n  <base href="/preview/${projectId}/">`);
        } else if (html.includes("<head ")) {
          html = html.replace(/<head[^>]*>/i, `$& \n  <base href="/preview/${projectId}/">`);
        } else {
          html = `<base href="/preview/${projectId}/">\n` + html;
        }
      }
      reply.type("text/html; charset=utf-8");
      return html;
    }

    return reply.status(404).send({ error: "Static preview index.html not found for project" });
  };

  app.get("/preview/:projectId", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    return serveIndex(projectId, reply);
  });

  app.get("/preview/:projectId/", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    return serveIndex(projectId, reply);
  });

  app.get("/preview/:projectId/*", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const wildcard = (req.params as any)["*"] as string;
    const baseDir = path.join("/tmp", "shipora-static-sites", projectId);
    const safePath = path.normalize(wildcard).replace(/^(\.\.[\/\\])+/, "");
    const filePath = path.join(baseDir, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      reply.type(mime);
      return fs.readFileSync(filePath);
    }

    // SPA fallback
    return serveIndex(projectId, reply);
  });
};
