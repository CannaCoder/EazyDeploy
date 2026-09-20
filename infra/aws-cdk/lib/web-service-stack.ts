import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface WebServiceStackProps extends cdk.StackProps {
  appName?: string;
  /** ECR image URI including tag, e.g. 123456.dkr.ecr.eu-north-1.amazonaws.com/shipora-services:web-latest */
  imageUri: string;
  /** NEXT_PUBLIC_API_URL passed to Next.js at runtime */
  apiUrl: string;
  /** NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY */
  clerkPublishableKey: string;
  /** Concrete ARN of the existing ALB HTTP listener */
  httpListenerArn: string;
}

export class WebServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebServiceStackProps) {
    super(scope, id, props);

    const appName = props.appName ?? "shipora";

    // ── Import existing infra by IDs (no re-deploy of upstream stacks) ──────
    const vpc = ec2.Vpc.fromLookup(this, "Vpc", {
      vpcName: `${appName}-vpc`,
    });

    const ecsSecurityGroup = ec2.SecurityGroup.fromLookupByName(
      this,
      "EcsSecurityGroup",
      `${appName}-ecs-sg`,
      vpc
    );

    const cluster = ecs.Cluster.fromClusterAttributes(this, "Cluster", {
      clusterName: `${appName}-cluster`,
      vpc,
      securityGroups: [],
    });

    const httpListener = elbv2.ApplicationListener.fromLookup(this, "HttpListener", {
      listenerArn: props.httpListenerArn,
    });

    const executionRole = iam.Role.fromRoleName(
      this,
      "EcsExecutionRole",
      `${appName}-ecs-task-execution-role`
    );

    const taskRole = iam.Role.fromRoleName(
      this,
      "EcsTaskRole",
      `${appName}-ecs-task-role`
    );

    // ── CloudWatch log group for web container ────────────────────────────────
    const logGroup = new logs.LogGroup(this, "WebLogGroup", {
      logGroupName: `/aws/ecs/${appName}-web`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Task definition ───────────────────────────────────────────────────────
    const taskDef = new ecs.FargateTaskDefinition(this, "WebTaskDef", {
      family: `${appName}-web`,
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole,
      taskRole,
    });

    taskDef.addContainer("web", {
      image: ecs.ContainerImage.fromRegistry(props.imageUri),
      portMappings: [{ containerPort: 3000 }],
      environment: {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: props.apiUrl,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: props.clerkPublishableKey,
        // Clerk redirect URLs
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
        NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "/dashboard",
        NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: "/dashboard",
      },
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: "web",
      }),
      healthCheck: {
        command: ["CMD-SHELL", "wget -qO- http://localhost:3000/ || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ── ALB Target Group ──────────────────────────────────────────────────────
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "WebTargetGroup", {
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/",
        healthyHttpCodes: "200-399",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Route /* → web at priority 10 (lowest priority = catch-all behind API routes)
    // API service's /health and /api/* should be at higher priority (lower number)
    new elbv2.ApplicationListenerRule(this, "WebListenerRule", {
      listener: httpListener,
      priority: 100,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/*"])],
      action: elbv2.ListenerAction.forward([targetGroup]),
    });

    // ── ECS Fargate Service ───────────────────────────────────────────────────
    const service = new ecs.FargateService(this, "WebService", {
      serviceName: `${appName}-web`,
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [ecsSecurityGroup],
      circuitBreaker: { rollback: true },
      deploymentController: { type: ecs.DeploymentControllerType.ECS },
    });

    service.attachToApplicationTargetGroup(targetGroup);

    // ── Outputs ───────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "WebServiceName", {
      value: service.serviceName,
      description: "ECS Service name for Shipora Web (Next.js)",
      exportName: `${appName}-WebServiceName`,
    });

    new cdk.CfnOutput(this, "WebTargetGroupArn", {
      value: targetGroup.targetGroupArn,
      description: "ALB Target Group ARN for Shipora Web",
      exportName: `${appName}-WebTargetGroupArn`,
    });
  }
}
