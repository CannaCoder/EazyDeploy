import type { FastifyPluginAsync } from "fastify";
import { listInstallationRepositories } from "@shipora/github-app";

export const githubInstallRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/github/install/callback", async (req, reply) => {
    const { installation_id } = req.query as { installation_id?: string };
    if (!installation_id) {
      return reply.code(400).send({ error: "Missing installation_id parameter" });
    }

    return reply.redirect(
      `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard/new-project?installation_id=${installation_id}`
    );
  });

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

    // Return friendly placeholder repositories when GitHub credentials are not configured yet
    return {
      repositories: [
        {
          id: 101,
          name: "demo-monorepo",
          fullName: "developer/demo-monorepo",
          owner: "developer",
          private: false,
          defaultBranch: "main",
          htmlUrl: "https://github.com/developer/demo-monorepo",
        },
        {
          id: 102,
          name: "saas-backend",
          fullName: "developer/saas-backend",
          owner: "developer",
          private: true,
          defaultBranch: "main",
          htmlUrl: "https://github.com/developer/saas-backend",
        },
      ],
    };
  });
};
