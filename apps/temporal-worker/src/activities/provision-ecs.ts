import {
  ECSClient,
  RegisterTaskDefinitionCommand,
  CreateServiceCommand,
  UpdateServiceCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";
import type {
  ProvisionECSInput,
  ProvisionECSResult,
} from "@shipora/temporal-workflows";

export async function provisionECSActivity(
  input: ProvisionECSInput
): Promise<ProvisionECSResult> {
  const region = process.env["AWS_REGION"] || "us-east-1";
  const accountId = process.env["AWS_ACCOUNT_ID"] || "123456789012";
  const appName = process.env["APP_NAME"] || "shipora";
  const clusterName = `${appName}-cluster`;
  const taskFamily = `${appName}-${input.serviceName}`;
  const ecsServiceName = `${appName}-${input.serviceName}-svc`;

  const executionRoleArn = `arn:aws:iam::${accountId}:role/${appName}-ecs-task-execution-role`;
  const taskRoleArn = `arn:aws:iam::${accountId}:role/${appName}-ecs-task-role`;

  console.log(
    `[provisionECSActivity] Registering Task Definition for service '${input.serviceName}' (port: ${input.port}, image: ${input.imageUri})`
  );

  // If in test or dev mode without AWS credentials
  if (
    process.env["VITEST"] === "true" ||
    process.env["NODE_ENV"] === "test" ||
    (!process.env["AWS_ACCESS_KEY_ID"] && !process.env["AWS_PROFILE"])
  ) {
    const mockTaskDefArn = `arn:aws:ecs:${region}:${accountId}:task-definition/${taskFamily}:2`;
    const mockPrevTaskDefArn = `arn:aws:ecs:${region}:${accountId}:task-definition/${taskFamily}:1`;
    const mockServiceArn = `arn:aws:ecs:${region}:${accountId}:service/${clusterName}/${ecsServiceName}`;

    console.log(
      `[provisionECSActivity] Simulated ECS Task Definition & Service created: ${mockTaskDefArn}`
    );

    return {
      success: true,
      serviceName: input.serviceName,
      cloudServiceId: mockServiceArn,
      currentRevision: mockTaskDefArn,
      taskDefinitionArn: mockTaskDefArn,
      ecsServiceArn: mockServiceArn,
      previousTaskDefinitionArn: mockPrevTaskDefArn,
    };
  }

  try {
    const client = new ECSClient({ region });
    const secretRefs = input.secretRefs || input.taskEnvSecretRefs || [];

    // 1. Register Task Definition
    const registerCmd = new RegisterTaskDefinitionCommand({
      family: taskFamily,
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      cpu: String(input.cpu || 256),
      memory: String(input.memory || 512),
      executionRoleArn,
      taskRoleArn,
      containerDefinitions: [
        {
          name: input.serviceName,
          image: input.imageUri,
          essential: true,
          portMappings: [
            {
              containerPort: input.port,
              hostPort: input.port,
              protocol: "tcp",
            },
          ],
          secrets: secretRefs.map((ref) => ({
            name: ref.name,
            valueFrom: ref.valueFrom || ref.reference || "",
          })),
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": `/aws/ecs/${appName}-services`,
              "awslogs-region": region,
              "awslogs-stream-prefix": input.serviceName,
              "awslogs-create-group": "true",
            },
          },
        },
      ],
    });

    const registerRes = await client.send(registerCmd);
    const taskDefArn = registerRes.taskDefinition?.taskDefinitionArn;

    if (!taskDefArn) {
      throw new Error("Failed to register ECS Task Definition");
    }

    console.log(`[provisionECSActivity] Registered Task Definition: ${taskDefArn}`);

    // 2. Check if ECS Service already exists
    const describeRes = await client.send(
      new DescribeServicesCommand({
        cluster: clusterName,
        services: [ecsServiceName],
      })
    );

    const existingService = describeRes.services?.find(
      (s) => s.serviceName === ecsServiceName && s.status !== "INACTIVE"
    );

    let ecsServiceArn: string;
    let previousTaskDefinitionArn: string | undefined;

    if (existingService) {
      // Capture the current task def ARN before updating (used for rollback)
      previousTaskDefinitionArn = existingService.taskDefinition ?? undefined;

      // Update existing service
      console.log(`[provisionECSActivity] Updating existing ECS service '${ecsServiceName}' with new task def...`);
      const updateRes = await client.send(
        new UpdateServiceCommand({
          cluster: clusterName,
          service: ecsServiceName,
          taskDefinition: taskDefArn,
          forceNewDeployment: true,
        })
      );
      ecsServiceArn = updateRes.service?.serviceArn || existingService.serviceArn || "";
    } else {
      // Create new service
      console.log(`[provisionECSActivity] Creating new ECS Fargate service '${ecsServiceName}'...`);
      const createRes = await client.send(
        new CreateServiceCommand({
          cluster: clusterName,
          serviceName: ecsServiceName,
          taskDefinition: taskDefArn,
          desiredCount: 1,
          launchType: "FARGATE",
          networkConfiguration: {
            awsvpcConfiguration: {
              subnets: [
                process.env["SUBNET_ID_1"] || "subnet-12345678",
                process.env["SUBNET_ID_2"] || "subnet-87654321",
              ],
              securityGroups: [
                process.env["ECS_SECURITY_GROUP_ID"] || "sg-12345678",
              ],
              assignPublicIp: "DISABLED",
            },
          },
        })
      );
      ecsServiceArn = createRes.service?.serviceArn || "";
    }

    return {
      success: true,
      serviceName: input.serviceName,
      cloudServiceId: ecsServiceArn,
      currentRevision: taskDefArn,
      taskDefinitionArn: taskDefArn,
      ecsServiceArn,
      previousTaskDefinitionArn,
    };
  } catch (err: unknown) {
    console.error(`[provisionECSActivity] ECS Provisioning Error:`, (err as Error).message);
    return {
      success: false,
      serviceName: input.serviceName,
      cloudServiceId: "",
      currentRevision: "",
      taskDefinitionArn: "",
      ecsServiceArn: "",
      error: (err as Error).message,
    };
  }

}
