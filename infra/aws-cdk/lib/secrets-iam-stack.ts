import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface SecretsIamStackProps extends cdk.StackProps {
  appName?: string;
}

export class SecretsIamStack extends cdk.Stack {
  public readonly workerRole: iam.Role;
  public readonly workerPolicy: iam.ManagedPolicy;
  public readonly ecsExecutionRole: iam.Role;
  public readonly ecsTaskRole: iam.Role;

  constructor(scope: Construct, id: string, props?: SecretsIamStackProps) {
    super(scope, id, props);

    const appName = props?.appName || "shipora";

    // 1. Least-Privilege IAM Policy for Secrets Manager
    this.workerPolicy = new iam.ManagedPolicy(this, "ShiporaSecretsManagerPolicy", {
      managedPolicyName: `${appName}-secrets-manager-reader`,
      description: "Allows Shipora Temporal Worker and Deploy Engine to read secret keys and sync env vars",
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "secretsmanager:GetSecretValue",
            "secretsmanager:DescribeSecret",
            "secretsmanager:PutSecretValue",
            "secretsmanager:CreateSecret",
            "secretsmanager:UpdateSecret",
          ],
          resources: [
            `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${appName}/projects/*`,
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["secretsmanager:ListSecrets"],
          resources: ["*"],
        }),
      ],
    });

    // 2. Execution Role for Temporal Worker
    this.workerRole = new iam.Role(this, "ShiporaWorkerExecutionRole", {
      roleName: `${appName}-temporal-worker-role`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "IAM Role assumed by Shipora Temporal Worker containers on ECS Fargate",
    });

    this.workerRole.addManagedPolicy(this.workerPolicy);

    // 3. ECS Task Execution Role (assumed by ECS agent to pull images and inject secrets)
    this.ecsExecutionRole = new iam.Role(this, "ShiporaEcsTaskExecutionRole", {
      roleName: `${appName}-ecs-task-execution-role`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Allows ECS container agent to pull images from ECR, write logs, and inject secrets from Secrets Manager",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      ],
    });

    this.ecsExecutionRole.addManagedPolicy(this.workerPolicy);

    // 4. ECS Task Role (assumed by the application container itself at runtime)
    this.ecsTaskRole = new iam.Role(this, "ShiporaEcsTaskRole", {
      roleName: `${appName}-ecs-task-role`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "Minimal runtime role assumed by user application containers on ECS Fargate",
    });

    // 5. Stack Outputs
    new cdk.CfnOutput(this, "WorkerRoleArn", {
      value: this.workerRole.roleArn,
      description: "ARN of the Shipora Temporal Worker IAM Role",
      exportName: `${appName}-WorkerRoleArn`,
    });

    new cdk.CfnOutput(this, "EcsExecutionRoleArn", {
      value: this.ecsExecutionRole.roleArn,
      description: "ARN of the ECS Task Execution Role (for secret injection & ECR pull)",
      exportName: `${appName}-EcsExecutionRoleArn`,
    });

    new cdk.CfnOutput(this, "EcsTaskRoleArn", {
      value: this.ecsTaskRole.roleArn,
      description: "ARN of the ECS Container Task Role",
      exportName: `${appName}-EcsTaskRoleArn`,
    });

    new cdk.CfnOutput(this, "SecretsPolicyArn", {
      value: this.workerPolicy.managedPolicyArn,
      description: "ARN of the Secrets Manager Reader Policy",
      exportName: `${appName}-SecretsPolicyArn`,
    });
  }
}
