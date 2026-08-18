import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface CodeBuildStackProps extends cdk.StackProps {
  appName?: string;
  ecrRepositoryArn?: string;
  ecrRepositoryUri?: string;
}

export class CodeBuildStack extends cdk.Stack {
  public readonly project: codebuild.Project;
  public readonly buildRole: iam.Role;

  constructor(scope: Construct, id: string, props?: CodeBuildStackProps) {
    super(scope, id, props);

    const appName = props?.appName || "shipora";

    // 1. IAM Service Role for CodeBuild
    this.buildRole = new iam.Role(this, "ShiporaCodeBuildRole", {
      roleName: `${appName}-codebuild-builder-role`,
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
      description: "Allows Shipora CodeBuild to build Docker images and push to ECR",
    });

    this.buildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
        ],
        resources: ["*"],
      })
    );

    this.buildRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["*"],
      })
    );

    // 2. CloudWatch Log Group for builds
    const logGroup = new logs.LogGroup(this, "ShiporaCodeBuildLogGroup", {
      logGroupName: `/aws/codebuild/${appName}-container-builder`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. CodeBuild Project
    this.project = new codebuild.Project(this, "ShiporaCodeBuildProject", {
      projectName: `${appName}-container-builder`,
      description: "Shipora automated multi-service container image builder",
      role: this.buildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true, // Required for Docker daemon
        environmentVariables: {
          AWS_ACCOUNT_ID: { value: this.account },
          AWS_REGION: { value: this.region },
          ECR_REPO_URI: { value: props?.ecrRepositoryUri || `${this.account}.dkr.ecr.${this.region}.amazonaws.com/${appName}-services` },
        },
      },
      logging: {
        cloudWatch: {
          logGroup,
          prefix: "builds",
        },
      },
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
      // Default buildspec template (can be overridden dynamically per build run)
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              "echo Logging in to Amazon ECR...",
              "aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI",
            ],
          },
          build: {
            commands: [
              "echo Build started on `date`",
              "echo Building Docker image for service $SERVICE_NAME...",
              "docker build -t $ECR_REPO_URI:$IMAGE_TAG -f $DOCKERFILE_PATH $BUILD_CONTEXT",
            ],
          },
          post_build: {
            commands: [
              "echo Build completed on `date`",
              "echo Pushing Docker image to ECR...",
              "docker push $ECR_REPO_URI:$IMAGE_TAG",
              "echo Image push successful!",
            ],
          },
        },
      }),
    });

    // 4. Outputs
    new cdk.CfnOutput(this, "CodeBuildProjectName", {
      value: this.project.projectName,
      description: "CodeBuild Project Name for Container Builds",
      exportName: `${appName}-CodeBuildProjectName`,
    });

    new cdk.CfnOutput(this, "CodeBuildProjectArn", {
      value: this.project.projectArn,
      description: "CodeBuild Project ARN",
      exportName: `${appName}-CodeBuildProjectArn`,
    });
  }
}
