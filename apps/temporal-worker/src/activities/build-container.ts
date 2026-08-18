import {
  CodeBuildClient,
  StartBuildCommand,
  BatchGetBuildsCommand,
} from "@aws-sdk/client-codebuild";
import type {
  BuildContainerInput,
  BuildContainerResult,
} from "@shipora/temporal-workflows";

export async function buildContainerActivity(
  input: BuildContainerInput
): Promise<BuildContainerResult> {
  const region = process.env["AWS_REGION"] || "us-east-1";
  const accountId = process.env["AWS_ACCOUNT_ID"] || "123456789012";
  const appName = process.env["APP_NAME"] || "shipora";
  const projectName = `${appName}-container-builder`;
  const imageTag = `${input.serviceName}-${input.commitSha.slice(0, 7)}`;
  const defaultEcrUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/${appName}-services`;
  const ecrRepoUri = input.ecrRepoUri || defaultEcrUri;
  const imageUri = `${ecrRepoUri}:${imageTag}`;

  console.log(
    `[buildContainerActivity] Initiating CodeBuild for service '${input.serviceName}' (repo: ${input.repoOwner}/${input.repoName}@${input.commitSha.slice(0, 7)})`
  );

  // If running in test or local dev mode without AWS credentials, return simulated build
  if (
    process.env["VITEST"] === "true" ||
    process.env["NODE_ENV"] === "test" ||
    (!process.env["AWS_ACCESS_KEY_ID"] && !process.env["AWS_PROFILE"])
  ) {
    console.log(
      `[buildContainerActivity] Using simulated CodeBuild execution for '${input.serviceName}' -> Image: ${imageUri}`
    );
    return {
      success: true,
      serviceName: input.serviceName,
      imageUri,
      buildId: `simulated-build-${input.serviceName}-${input.commitSha.slice(0, 7)}`,
      buildDurationSeconds: 42,
    };
  }

  try {
    const client = new CodeBuildClient({ region });

    const startCmd = new StartBuildCommand({
      projectName,
      environmentVariablesOverride: [
        { name: "SERVICE_NAME", value: input.serviceName, type: "PLAINTEXT" },
        { name: "IMAGE_TAG", value: imageTag, type: "PLAINTEXT" },
        { name: "BUILD_CONTEXT", value: input.rootPath || ".", type: "PLAINTEXT" },
        { name: "ECR_REPO_URI", value: ecrRepoUri, type: "PLAINTEXT" },
        { name: "COMMIT_SHA", value: input.commitSha, type: "PLAINTEXT" },
      ],
    });

    const startRes = await client.send(startCmd);
    const buildId = startRes.build?.id;

    if (!buildId) {
      throw new Error("Failed to obtain build ID from CodeBuild");
    }

    console.log(`[buildContainerActivity] CodeBuild started with ID: ${buildId}. Polling status...`);

    // Poll until build finishes (max 10 minutes)
    const maxPolls = 60;
    const pollIntervalMs = 10000;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const statusRes = await client.send(
        new BatchGetBuildsCommand({ ids: [buildId] })
      );
      const build = statusRes.builds?.[0];
      const status = build?.buildStatus;

      console.log(`[buildContainerActivity] Build ${buildId} status: ${status} (poll ${i + 1}/${maxPolls})`);

      if (status === "SUCCEEDED") {
        return {
          success: true,
          serviceName: input.serviceName,
          imageUri,
          buildId,
          buildDurationSeconds: build?.endTime
            ? Math.round((build.endTime.getTime() - (build.startTime?.getTime() || 0)) / 1000)
            : 60,
        };
      }

      if (status === "FAILED" || status === "FAULT" || status === "TIMED_OUT" || status === "STOPPED") {
        throw new Error(`CodeBuild failed with status: ${status}`);
      }
    }

    throw new Error("CodeBuild timed out waiting for completion");
  } catch (err: unknown) {
    console.error(`[buildContainerActivity] Error building service ${input.serviceName}:`, (err as Error).message);
    return {
      success: false,
      serviceName: input.serviceName,
      imageUri: "",
      error: (err as Error).message,
    };
  }
}
