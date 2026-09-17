import type { FastifyPluginAsync } from "fastify";
import { listInstallationRepositories } from "@shipora/github-app";

export const githubInstallRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. GitHub App Info
  fastify.get("/github/app-info", async (_req, reply) => {
    const appSlug = process.env["GITHUB_APP_SLUG"] || process.env["NEXT_PUBLIC_GITHUB_APP_SLUG"];
    const appId = process.env["GITHUB_APP_ID"];
    const isConfigured = Boolean(appSlug && appId && appId !== "123456");

    return reply.send({
      configured: isConfigured,
      slug: appSlug || null,
      installUrl: isConfigured ? `https://github.com/apps/${appSlug}/installations/new` : null,
    });
  });

  // 2. GitHub App Install URL
  fastify.get("/github/install-url", async (_req, reply) => {
    const appSlug = process.env["GITHUB_APP_SLUG"] || process.env["NEXT_PUBLIC_GITHUB_APP_SLUG"] || "shipora";
    const installUrl = `https://github.com/apps/${appSlug}/installations/new`;
    return reply.send({
      success: true,
      url: installUrl,
    });
  });

  // 3. GitHub App Callback
  fastify.get("/github/install/callback", async (req, reply) => {
    const { installation_id } = req.query as { installation_id?: string };
    if (!installation_id) {
      return reply.code(400).send({ error: "Missing installation_id parameter" });
    }

    return reply.redirect(
      `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard/new-project?installation_id=${installation_id}`
    );
  });

  // 4. Real Live GitHub Repo Verification & Metadata Lookup
  fastify.post<{
    Body: {
      repo: string;
      token?: string;
    };
  }>("/github/verify-repo", async (req, reply) => {
    const { repo, token } = req.body || {};

    if (!repo || typeof repo !== "string") {
      return reply.code(400).send({ success: false, error: "Missing repository name or URL" });
    }

    // Clean "https://github.com/owner/name" or "owner/name"
    const cleaned = repo
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/\/$/, "");

    const parts = cleaned.split("/");
    if (parts.length < 2) {
      return reply.code(400).send({
        success: false,
        error: "Invalid repository format. Please use 'owner/repository' (e.g. facebook/react)",
      });
    }

    const owner = parts[0]!;
    const repoName = parts[1]!;

    const headers: Record<string, string> = {
      "User-Agent": "Shipora-Deployer",
      Accept: "application/vnd.github.v3+json",
    };

    const effectiveToken = (token && token.trim()) || process.env["GITHUB_TOKEN"];
    if (effectiveToken && effectiveToken.trim()) {
      headers["Authorization"] = `Bearer ${effectiveToken.trim()}`;
    }

    try {
      // 1. Fetch Repository Details from GitHub
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
        headers,
      });

      if (!repoRes.ok) {
        if (repoRes.status === 404) {
          return reply.code(404).send({
            success: false,
            error: `Repository '${owner}/${repoName}' was not found on GitHub. If this is a private repository, please connect with a GitHub Personal Access Token.`,
          });
        }
        if (repoRes.status === 401 || repoRes.status === 403) {
          return reply.code(403).send({
            success: false,
            error: `GitHub API rate limit or authentication required to access '${owner}/${repoName}'. Please provide a GitHub Token.`,
          });
        }
        return reply.code(repoRes.status).send({
          success: false,
          error: `GitHub API returned status ${repoRes.status}`,
        });
      }

      const repoData = (await repoRes.json()) as any;

      // 2. Fetch Branches
      let branches: string[] = [repoData.default_branch || "main"];
      try {
        const branchesRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/branches?per_page=30`,
          { headers }
        );
        if (branchesRes.ok) {
          const branchesData = (await branchesRes.json()) as any;
          if (Array.isArray(branchesData)) {
            branches = branchesData.map((b: { name: string }) => b.name);
          }
        }
      } catch {
        // use default branch
      }

      // 3. Detect Framework & Static vs Dynamic
      let isStatic = false;
      let detectedType = "dynamic";

      try {
        const defaultBranch = repoData.default_branch || "main";
        const treeRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/git/trees/${defaultBranch}?recursive=1`,
          { headers }
        );
        if (treeRes.ok) {
          const treeData = (await treeRes.json()) as { tree?: Array<{ path: string; type: string }> };
          const paths = (treeData.tree || [])
            .filter((t) => t.type === "blob")
            .map((t) => t.path);

          const hasServerBackend = paths.some(
            (p) =>
              p === "Dockerfile" ||
              p.endsWith("/Dockerfile") ||
              p === "requirements.txt" ||
              p === "Pipfile" ||
              p === "main.py" ||
              p.endsWith("/main.py") ||
              p === "go.mod" ||
              p === "Cargo.toml"
          );

          const hasHtml = paths.some((p) => p.endsWith("index.html") || p.endsWith(".html"));
          const hasVite = paths.some((p) => p.includes("vite.config"));
          const hasNext = paths.some((p) => p.includes("next.config"));
          const hasPkgJson = paths.includes("package.json");

          if (!hasServerBackend && !hasNext) {
            if (hasVite) {
              isStatic = true;
              detectedType = "vite";
            } else if (hasHtml && !hasPkgJson) {
              // Pure HTML/CSS/JS static site
              isStatic = true;
              detectedType = "static";
            } else if (hasPkgJson && hasHtml) {
              try {
                const pkgRes = await fetch(
                  `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}/package.json`,
                  { headers: token && token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {} }
                );
                if (pkgRes.ok) {
                  const pkgText = await pkgRes.text();
                  const isNodeServer =
                    pkgText.includes('"express"') ||
                    pkgText.includes('"fastify"') ||
                    pkgText.includes('"@nestjs"') ||
                    pkgText.includes('"koa"');
                  if (!isNodeServer) {
                    isStatic = true;
                    detectedType = pkgText.includes('"vite"') ? "vite" : "static";
                  }
                }
              } catch {
                // ignore
              }
            }
          }

          if (!isStatic) {
            if (hasNext) detectedType = "nextjs";
            else if (hasServerBackend) detectedType = "backend";
            else detectedType = "node";
          }
        }
      } catch {
        // Fallback
      }

      return reply.send({
        success: true,
        repository: {
          id: repoData.id,
          name: repoData.name,
          fullName: repoData.full_name,
          owner: repoData.owner?.login || owner,
          ownerAvatar: repoData.owner?.avatar_url,
          defaultBranch: repoData.default_branch || "main",
          branches,
          description: repoData.description,
          stars: repoData.stargazers_count || 0,
          isPrivate: repoData.private || false,
          language: repoData.language || "TypeScript",
          htmlUrl: repoData.html_url,
          isStatic,
          detectedType,
        },
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: `Could not reach GitHub API: ${(err as Error).message}`,
      });
    }
  });

  // 5. Verify GitHub Token & List User's Real Repositories
  fastify.post<{
    Body: {
      token: string;
    };
  }>("/github/verify-token", async (req, reply) => {
    const { token } = req.body || {};

    if (!token || typeof token !== "string" || !token.trim()) {
      return reply.code(400).send({ success: false, error: "Please enter a valid GitHub token" });
    }

    const headers = {
      "User-Agent": "Shipora-Deployer",
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${token.trim()}`,
    };

    try {
      // 1. Get User profile
      const userRes = await fetch("https://api.github.com/user", { headers });
      if (!userRes.ok) {
        return reply.code(401).send({
          success: false,
          error: "Invalid GitHub Token. Please check token permissions (requires 'repo' or 'public_repo' scope).",
        });
      }
      const userData = (await userRes.json()) as any;

      // 2. Get User repositories
      const reposRes = await fetch(
        "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
        { headers }
      );

      let repositories: any[] = [];
      if (reposRes.ok) {
        const reposData = await reposRes.json();
        if (Array.isArray(reposData)) {
          repositories = reposData.map((r: any) => ({
            id: r.id,
            name: r.name,
            fullName: r.full_name,
            owner: r.owner?.login,
            defaultBranch: r.default_branch || "main",
            isPrivate: r.private,
            stars: r.stargazers_count,
            language: r.language,
            description: r.description,
            htmlUrl: r.html_url,
          }));
        }
      }

      return reply.send({
        success: true,
        user: {
          login: userData.login,
          name: userData.name,
          avatarUrl: userData.avatar_url,
        },
        repositories,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: `Failed to authenticate with GitHub: ${(err as Error).message}`,
      });
    }
  });

  // 6. List App Installation Repositories
  fastify.get("/github/repos", async (req, reply) => {
    const { installation_id } = req.query as { installation_id?: string };
    if (!installation_id) {
      return reply.code(400).send({ error: "Missing installation_id parameter" });
    }

    try {
      const repos = await listInstallationRepositories(Number(installation_id));
      if (repos.length > 0) {
        return { repositories: repos };
      }
    } catch {
      // Fallback
    }

    return {
      repositories: [],
    };
  });
};
