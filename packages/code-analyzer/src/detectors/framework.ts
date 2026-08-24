import type { DetectedService, RepoFile } from "../types.js";

/**
 * Detects services across a repository (monorepo or standalone).
 * Supports Next.js, Vite, Node/Fastify/Express, FastAPI, Bun, and Docker.
 */
export function detectServices(files: (string | RepoFile)[]): DetectedService[] {
  const filePaths = files.map((f) => (typeof f === "string" ? f : f.path));
  const fileMap = new Map<string, string | undefined>();
  for (const f of files) {
    if (typeof f !== "string" && f.content) {
      fileMap.set(f.path, f.content);
    }
  }

  const services: DetectedService[] = [];
  const handledRoots = new Set<string>();

  // Helper to extract service directory
  function getRootDirectory(filePath: string): string {
    const parts = filePath.split("/");
    if (parts.length > 1 && (parts[0] === "apps" || parts[0] === "services")) {
      return `${parts[0]}/${parts[1]}`;
    }
    return ".";
  }

  // Find all candidate service directories
  const candidateRoots = new Set<string>();
  for (const path of filePaths) {
    candidateRoots.add(getRootDirectory(path));
  }

  const isMonorepo = Array.from(candidateRoots).some((r) => r !== ".");

  for (const root of candidateRoots) {
    // If it's a monorepo with distinct apps/services, ignore the root directory as a standalone service
    if (isMonorepo && root === ".") continue;
    if (handledRoots.has(root)) continue;

    const rootFiles = filePaths.filter((p) => (root === "." ? !p.includes("/") : p.startsWith(root + "/")));
    const rootName = root === "." ? "main" : root.split("/").pop() || "app";

    // 1. Next.js
    const isNext = rootFiles.some((p) => p.endsWith("next.config.js") || p.endsWith("next.config.mjs") || p.endsWith("next.config.ts"));
    if (isNext) {
      services.push({
        name: rootName,
        type: "nextjs",
        rootPath: root,
        port: 3000,
        buildCommand: root === "." ? "pnpm build" : `pnpm --filter ${rootName} build`,
        envVars: [],
      });
      handledRoots.add(root);
      continue;
    }

    // 2. Vite
    const isVite = rootFiles.some((p) => p.endsWith("vite.config.js") || p.endsWith("vite.config.ts") || p.endsWith("vite.config.mjs"));
    if (isVite) {
      services.push({
        name: rootName,
        type: "vite",
        rootPath: root,
        port: 5173,
        buildCommand: root === "." ? "pnpm build" : `pnpm --filter ${rootName} build`,
        envVars: [],
      });
      handledRoots.add(root);
      continue;
    }

    // 3. Node (Fastify / Express / Nest / generic Node)
    const pkgJsonPath = root === "." ? "package.json" : `${root}/package.json`;
    const pkgContent = fileMap.get(pkgJsonPath);
    const hasPackageJson = rootFiles.some((p) => p.endsWith("package.json"));

    if (hasPackageJson) {
      const isFastify = pkgContent?.includes('"fastify"') || rootFiles.some((p) => p.includes("fastify"));
      const isExpress = pkgContent?.includes('"express"') || rootFiles.some((p) => p.includes("express"));

      const dockerfilePath = root === "." ? "Dockerfile" : `${root}/Dockerfile`;
      const dockerfileContent = fileMap.get(dockerfilePath);
      let detectedPort = isFastify ? 4000 : isExpress ? 3000 : 3000;
      if (dockerfileContent) {
        const match = dockerfileContent.match(/EXPOSE\s+(\d+)/i);
        if (match) detectedPort = parseInt(match[1], 10);
      }

      services.push({
        name: rootName,
        type: "node",
        rootPath: root,
        port: detectedPort,
        buildCommand: root === "." ? "pnpm build" : `pnpm --filter ${rootName} build`,
        envVars: [],
      });
      handledRoots.add(root);
      continue;
    }

    // 4. FastAPI / Python
    const isPython = rootFiles.some(
      (p) => p.endsWith("requirements.txt") || p.endsWith("pyproject.toml") || p.endsWith("Pipfile") || p.endsWith("main.py")
    );
    if (isPython) {
      services.push({
        name: rootName,
        type: "fastapi",
        rootPath: root,
        port: 8000,
        buildCommand: "pip install -r requirements.txt",
        envVars: [],
      });
      handledRoots.add(root);
      continue;
    }

    // 5. Dockerfile
    const hasDockerfile = rootFiles.some((p) => p.endsWith("Dockerfile"));
    if (hasDockerfile) {
      const dockerfilePath = root === "." ? "Dockerfile" : `${root}/Dockerfile`;
      const dockerfileContent = fileMap.get(dockerfilePath);
      let detectedPort = 3000;
      if (dockerfileContent) {
        const match = dockerfileContent.match(/EXPOSE\s+(\d+)/i);
        if (match) detectedPort = parseInt(match[1], 10);
      }

      services.push({
        name: rootName,
        type: "docker",
        rootPath: root,
        port: detectedPort,
        buildCommand: `docker build -t ${rootName} ${root}`,
        envVars: [],
      });
      handledRoots.add(root);
      continue;
    }
  }

  return services;
}
