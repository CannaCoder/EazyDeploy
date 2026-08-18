import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface EcsClusterStackProps extends cdk.StackProps {
  appName?: string;
  vpc: ec2.IVpc;
  albSecurityGroup: ec2.ISecurityGroup;
}

export class EcsClusterStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly httpListener: elbv2.ApplicationListener;
  public readonly containerLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: EcsClusterStackProps) {
    super(scope, id, props);

    const appName = props.appName || "shipora";

    // 1. Shared ECS Fargate Cluster
    this.cluster = new ecs.Cluster(this, "ShiporaEcsCluster", {
      vpc: props.vpc,
      clusterName: `${appName}-cluster`,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    // 2. CloudWatch Log Group for ECS Fargate Containers
    this.containerLogGroup = new logs.LogGroup(this, "ShiporaContainerLogs", {
      logGroupName: `/aws/ecs/${appName}-services`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. Application Load Balancer (ALB)
    this.alb = new elbv2.ApplicationLoadBalancer(this, "ShiporaAlb", {
      vpc: props.vpc,
      loadBalancerName: `${appName}-alb`,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // 4. HTTP Listener with default 404 response (Service routes added dynamically)
    this.httpListener = this.alb.addListener("HttpListener", {
      port: 80,
      open: false, // Managed by albSecurityGroup
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "application/json",
        messageBody: JSON.stringify({
          error: "Not Found",
          message: "No active Shipora service route matches this host or path.",
        }),
      }),
    });

    // 5. Outputs
    new cdk.CfnOutput(this, "EcsClusterName", {
      value: this.cluster.clusterName,
      description: "ECS Fargate Cluster Name",
      exportName: `${appName}-EcsClusterName`,
    });

    new cdk.CfnOutput(this, "EcsClusterArn", {
      value: this.cluster.clusterArn,
      description: "ECS Fargate Cluster ARN",
      exportName: `${appName}-EcsClusterArn`,
    });

    new cdk.CfnOutput(this, "AlbDnsName", {
      value: this.alb.loadBalancerDnsName,
      description: "Application Load Balancer DNS Name",
      exportName: `${appName}-AlbDnsName`,
    });

    new cdk.CfnOutput(this, "AlbArn", {
      value: this.alb.loadBalancerArn,
      description: "Application Load Balancer ARN",
      exportName: `${appName}-AlbArn`,
    });

    new cdk.CfnOutput(this, "HttpListenerArn", {
      value: this.httpListener.listenerArn,
      description: "ALB HTTP Listener ARN",
      exportName: `${appName}-HttpListenerArn`,
    });

    new cdk.CfnOutput(this, "ContainerLogGroupName", {
      value: this.containerLogGroup.logGroupName,
      description: "ECS Container CloudWatch Log Group",
      exportName: `${appName}-ContainerLogGroupName`,
    });
  }
}
