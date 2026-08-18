import { describe, it } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { VpcStack } from "../lib/vpc-stack.js";
import { SecretsIamStack } from "../lib/secrets-iam-stack.js";
import { EcrStack } from "../lib/ecr-stack.js";
import { CodeBuildStack } from "../lib/codebuild-stack.js";
import { EcsClusterStack } from "../lib/ecs-cluster-stack.js";

describe("Shipora Phase 3 CDK Infrastructure Stacks", () => {
  const env: cdk.Environment = {
    account: "123456789012",
    region: "us-east-1",
  };

  it("synthesizes VpcStack with public/private subnets and security groups", () => {
    const app = new cdk.App();
    const vpcStack = new VpcStack(app, "TestVpcStack", { env });
    const template = Template.fromStack(vpcStack);

    // Assert VPC exists
    template.hasResourceProperties("AWS::EC2::VPC", {
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
    });

    // Assert ALB Security Group exists
    template.hasResourceProperties("AWS::EC2::SecurityGroup", {
      GroupDescription: "Allow inbound HTTP/HTTPS traffic to Shipora Application Load Balancer",
    });

    // Assert ECS Security Group exists
    template.hasResourceProperties("AWS::EC2::SecurityGroup", {
      GroupDescription: "Allow inbound traffic to ECS tasks from Shipora ALB only",
    });
  });

  it("synthesizes SecretsIamStack with worker and ECS execution roles", () => {
    const app = new cdk.App();
    const secretsStack = new SecretsIamStack(app, "TestSecretsStack", { env });
    const template = Template.fromStack(secretsStack);

    // Assert IAM Managed Policy for Secrets Manager exists
    template.hasResourceProperties("AWS::IAM::ManagedPolicy", {
      ManagedPolicyName: "shipora-secrets-manager-reader",
    });

    // Assert Task Execution Role and Task Role exist
    template.hasResourceProperties("AWS::IAM::Role", {
      RoleName: "shipora-ecs-task-execution-role",
    });
    template.hasResourceProperties("AWS::IAM::Role", {
      RoleName: "shipora-ecs-task-role",
    });
  });

  it("synthesizes EcrStack with container repository and lifecycle rule", () => {
    const app = new cdk.App();
    const ecrStack = new EcrStack(app, "TestEcrStack", { env });
    const template = Template.fromStack(ecrStack);

    template.hasResourceProperties("AWS::ECR::Repository", {
      RepositoryName: "shipora-services",
      ImageScanningConfiguration: {
        ScanOnPush: true,
      },
    });
  });

  it("synthesizes CodeBuildStack with privileged Docker environment", () => {
    const app = new cdk.App();
    const codeBuildStack = new CodeBuildStack(app, "TestCodeBuildStack", { env });
    const template = Template.fromStack(codeBuildStack);

    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Environment: Match.objectLike({
        PrivilegedMode: true,
      }),
    });
  });

  it("synthesizes EcsClusterStack with Fargate Cluster and ALB HTTP listener", () => {
    const app = new cdk.App();
    const vpcStack = new VpcStack(app, "TestVpcStack2", { env });
    const ecsStack = new EcsClusterStack(app, "TestEcsStack", {
      env,
      vpc: vpcStack.vpc,
      albSecurityGroup: vpcStack.albSecurityGroup,
    });
    const template = Template.fromStack(ecsStack);

    // Assert ECS Cluster
    template.hasResourceProperties("AWS::ECS::Cluster", {
      ClusterName: "shipora-cluster",
    });

    // Assert Application Load Balancer
    template.hasResourceProperties("AWS::ElasticLoadBalancingV2::LoadBalancer", {
      Scheme: "internet-facing",
      Type: "application",
    });

    // Assert HTTP Listener
    template.hasResourceProperties("AWS::ElasticLoadBalancingV2::Listener", {
      Port: 80,
      Protocol: "HTTP",
    });
  });
});
