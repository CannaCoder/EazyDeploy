import { App, Octokit } from "octokit";

export interface GitHubAppConfig {
  appId: string | number;
  privateKey: string;
  clientId?: string;
  clientSecret?: string;
}

export async function createGitHubApp(config?: Partial<GitHubAppConfig>): Promise<App | null> {
  const appId = config?.appId || process.env["GITHUB_APP_ID"];
  const privateKey =
    config?.privateKey ||
    (process.env["GITHUB_APP_PRIVATE_KEY"]
      ? process.env["GITHUB_APP_PRIVATE_KEY"].replace(/\\n/g, "\n")
      : undefined);

  if (!appId || !privateKey) {
    return null;
  }

  try {
    return new App({
      appId,
      privateKey,
      oauth: {
        clientId: config?.clientId || process.env["GITHUB_CLIENT_ID"] || "",
        clientSecret: config?.clientSecret || process.env["GITHUB_CLIENT_SECRET"] || "",
      },
    });
  } catch {
    return null;
  }
}

export async function getInstallationOctokit(
  installationId: number,
  config?: Partial<GitHubAppConfig>
): Promise<Octokit | null> {
  const app = await createGitHubApp(config);
  if (!app) {
    return null;
  }
  try {
    return (await app.getInstallationOctokit(installationId)) as unknown as Octokit;
  } catch {
    return null;
  }
}

export async function listInstallationRepositories(
  installationId: number,
  config?: Partial<GitHubAppConfig>
) {
  const octokit = await getInstallationOctokit(installationId, config);
  if (!octokit) {
    return [];
  }

  try {
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
      per_page: 100,
    });

    return data.repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
    }));
  } catch {
    return [];
  }
}
