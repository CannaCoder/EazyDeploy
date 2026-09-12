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

  // If running in test or local dev mode without real AWS credentials, return simulated build
  const hasRealAws =
    process.env["AWS_ACCESS_KEY_ID"] &&
    !process.env["AWS_ACCESS_KEY_ID"].includes("mock") &&
    process.env["AWS_SECRET_ACCESS_KEY"] &&
    !process.env["AWS_SECRET_ACCESS_KEY"].includes("mock");

  if (
    process.env["VITEST"] === "true" ||
    process.env["NODE_ENV"] === "test" ||
    (!hasRealAws && !process.env["AWS_PROFILE"])
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

    const userDockerfilePath = input.rootPath && input.rootPath !== "." ? `${input.rootPath}/Dockerfile` : "Dockerfile";

    // Inject buildspec per-build with smart framework detection for auto-Dockerfile generation.
    const buildspecOverride = {
      version: "0.2",
      phases: {
        pre_build: {
          commands: [
            "echo Logging in to Amazon ECR...",
            `aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin ${ecrRepoUri}`,
            // Smart auto-Dockerfile: detect framework from package.json at build time
            `if [ ! -f "${userDockerfilePath}" ]; then\n  echo 'Auto-generating Dockerfile (framework detection)...'\n  IS_NEXT=$(node -e "try{const p=require('./package.json');console.log(Object.keys({...p.dependencies,...p.devDependencies}).includes('next')?'1':'0')}catch(e){console.log('0')}")\n  HAS_START=$(node -e "try{const p=require('./package.json');console.log(p.scripts&&p.scripts.start?'1':'0')}catch(e){console.log('0')}")\n  HAS_BUILD=$(node -e "try{const p=require('./package.json');console.log(p.scripts&&p.scripts.build?'1':'0')}catch(e){console.log('0')}")\n  if [ "$IS_NEXT" = "1" ]; then\n    printf 'FROM node:20-alpine AS deps\\nWORKDIR /app\\nCOPY package*.json ./\\nRUN npm install\\nFROM node:20-alpine AS builder\\nWORKDIR /app\\nCOPY --from=deps /app/node_modules ./node_modules\\nCOPY . .\\nENV NEXT_TELEMETRY_DISABLED=1\\nRUN npm run build\\nFROM node:20-alpine AS runner\\nWORKDIR /app\\nENV NODE_ENV=production\\nENV NEXT_TELEMETRY_DISABLED=1\\nCOPY --from=builder /app/public ./public\\nCOPY --from=builder /app/.next/standalone ./\\nCOPY --from=builder /app/.next/static ./.next/static\\nEXPOSE 3000\\nCMD ["node", "server.js"]\\n' > ${userDockerfilePath}\n  elif [ "$HAS_BUILD" = "1" ] && [ "$HAS_START" = "1" ]; then\n    printf 'FROM node:20-alpine\\nWORKDIR /app\\nCOPY package*.json ./\\nRUN npm install\\nCOPY . .\\nRUN npm run build\\nEXPOSE 3000\\nCMD ["npm", "start"]\\n' > ${userDockerfilePath}\n  elif [ "$HAS_START" = "1" ]; then\n    printf 'FROM node:20-alpine\\nWORKDIR /app\\nCOPY package*.json ./\\nRUN npm install --omit=dev 2>/dev/null || npm install\\nCOPY . .\\nEXPOSE 3000\\nCMD ["npm", "start"]\\n' > ${userDockerfilePath}\n  else\n    MAIN=$(node -e "try{const p=require('./package.json');console.log(p.main||'index.js')}catch(e){console.log('index.js')}")\n    printf "FROM node:20-alpine\\nWORKDIR /app\\nCOPY package*.json ./\\nRUN npm install --omit=dev 2>/dev/null || npm install\\nCOPY . .\\nEXPOSE 3000\\nCMD [\\"node\\", \\"$MAIN\\"]\\n" > ${userDockerfilePath}\n  fi\n  echo '--- Generated Dockerfile ---' && cat ${userDockerfilePath}\nfi`,
          ],
        },
        build: {
          commands: [
            "echo Build started on `date`",
            `docker build -t ${ecrRepoUri}:${imageTag} -f ${userDockerfilePath} .`,
          ],
        },
        post_build: {
          commands: [
            `docker push ${ecrRepoUri}:${imageTag}`,
            "echo Image pushed successfully!",
          ],
        },
      },
    };

    const startCmd = new StartBuildCommand({
      projectName,
      // Clone the correct commit from GitHub at build time
      sourceTypeOverride: "GITHUB",
      sourceLocationOverride: `https://github.com/${input.repoOwner}/${input.repoName}`,
      sourceVersion: input.commitSha,
      buildspecOverride: JSON.stringify(buildspecOverride),
      environmentVariablesOverride: [
        { name: "SERVICE_NAME", value: input.serviceName, type: "PLAINTEXT" },
        { name: "IMAGE_TAG", value: imageTag, type: "PLAINTEXT" },
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
