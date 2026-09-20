#!/usr/bin/env node
import "source-map-support/register.js";
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/vpc-stack.js";
import { SecretsIamStack } from "../lib/secrets-iam-stack.js";
import { EcrStack } from "../lib/ecr-stack.js";
import { CodeBuildStack } from "../lib/codebuild-stack.js";
import { EcsClusterStack } from "../lib/ecs-cluster-stack.js";
import { WebServiceStack } from "../lib/web-service-stack.js";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env["CDK_DEFAULT_ACCOUNT"] || process.env["AWS_ACCOUNT_ID"] || "123456789012",
  region: process.env["CDK_DEFAULT_REGION"] || process.env["AWS_REGION"] || "us-east-1",
};

const appName = "shipora";

// 1. Networking Stack (VPC, Subnets, Security Groups)
const vpcStack = new VpcStack(app, "ShiporaVpcStack", {
  env,
  appName,
  description: "Shipora high-availability VPC and security groups",
});

// 2. IAM & Secrets Permissions Stack
const secretsStack = new SecretsIamStack(app, "ShiporaSecretsIamStack", {
  env,
  appName,
  description: "Shipora IAM roles and policies for Secrets Manager and ECS Task Execution",
});

// 3. Container Registry Stack
const ecrStack = new EcrStack(app, "ShiporaEcrStack", {
  env,
  appName,
  description: "Shipora Amazon ECR repositories for container images",
});

// 4. CodeBuild Container Build Stack
const codeBuildStack = new CodeBuildStack(app, "ShiporaCodeBuildStack", {
  env,
  appName,
  ecrRepositoryArn: ecrStack.defaultRepository.repositoryArn,
  ecrRepositoryUri: ecrStack.defaultRepository.repositoryUri,
  description: "Shipora AWS CodeBuild project for parallel Docker container builds",
});
codeBuildStack.addDependency(ecrStack);

// 5. ECS Fargate Cluster & Application Load Balancer Stack
const ecsClusterStack = new EcsClusterStack(app, "ShiporaEcsClusterStack", {
  env,
  appName,
  vpc: vpcStack.vpc,
  albSecurityGroup: vpcStack.albSecurityGroup,
  description: "Shipora shared ECS Fargate Cluster and Application Load Balancer",
});
ecsClusterStack.addStackDependency(vpcStack);

// 6. Web Service (Next.js) — ECS Fargate service + ALB listener rule
const webServiceStack = new WebServiceStack(app, "ShiporaWebServiceStack", {
  env,
  appName,
  imageUri: `${process.env["ECR_REGISTRY"] || "690990575414.dkr.ecr.eu-north-1.amazonaws.com"}/shipora-services:web-latest`,
  apiUrl: `http://${process.env["ALB_DNS_NAME"] || "shipora-alb-704239522.eu-north-1.elb.amazonaws.com"}`,
  clerkPublishableKey: process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] || "pk_test_Zmx5aW5nLXN1bmJlYW0tNjM5NC5jbGVyay5hY2NvdW50cy5kZXYk",
  httpListenerArn: process.env["ALB_HTTP_LISTENER_ARN"] || "arn:aws:elasticloadbalancing:eu-north-1:690990575414:listener/app/shipora-alb/e3a54fd0f9d6c44e/8a166fd107901e42",
  description: "Shipora Next.js web frontend — ECS Fargate service with ALB routing",
});
webServiceStack.addStackDependency(ecsClusterStack);

app.synth();
