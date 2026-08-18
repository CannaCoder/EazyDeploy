import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface VpcStackProps extends cdk.StackProps {
  appName?: string;
  maxAzs?: number;
}

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ecsSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: VpcStackProps) {
    super(scope, id, props);

    const appName = props?.appName || "shipora";
    const maxAzs = props?.maxAzs ?? 2;

    // 1. VPC with Public & Private Subnets
    this.vpc = new ec2.Vpc(this, "ShiporaVpc", {
      vpcName: `${appName}-vpc`,
      maxAzs,
      natGateways: 1, // Cost-efficient single NAT gateway for dev/staging, scalable in prod
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // 2. ALB Security Group (Internet-facing HTTP/HTTPS)
    this.albSecurityGroup = new ec2.SecurityGroup(this, "ShiporaAlbSecurityGroup", {
      vpc: this.vpc,
      securityGroupName: `${appName}-alb-sg`,
      description: "Allow inbound HTTP/HTTPS traffic to Shipora Application Load Balancer",
      allowAllOutbound: true,
    });

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow inbound HTTP traffic"
    );

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow inbound HTTPS traffic"
    );

    // 3. ECS Fargate Security Group (Ingress allowed only from ALB)
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, "ShiporaEcsSecurityGroup", {
      vpc: this.vpc,
      securityGroupName: `${appName}-ecs-sg`,
      description: "Allow inbound traffic to ECS tasks from Shipora ALB only",
      allowAllOutbound: true,
    });

    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.allTcp(),
      "Allow inbound container traffic strictly from ALB"
    );

    // 4. CloudFormation Outputs
    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
      description: "VPC ID for Shipora Cloud Deploy Engine",
      exportName: `${appName}-VpcId`,
    });

    new cdk.CfnOutput(this, "AlbSecurityGroupId", {
      value: this.albSecurityGroup.securityGroupId,
      description: "Security Group ID for Shipora ALB",
      exportName: `${appName}-AlbSecurityGroupId`,
    });

    new cdk.CfnOutput(this, "EcsSecurityGroupId", {
      value: this.ecsSecurityGroup.securityGroupId,
      description: "Security Group ID for Shipora ECS Fargate Tasks",
      exportName: `${appName}-EcsSecurityGroupId`,
    });
  }
}
