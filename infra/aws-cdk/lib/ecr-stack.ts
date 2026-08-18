import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";

export interface EcrStackProps extends cdk.StackProps {
  appName?: string;
}

export class EcrStack extends cdk.Stack {
  public readonly defaultRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: EcrStackProps) {
    super(scope, id, props);

    const appName = props?.appName || "shipora";

    // 1. Base ECR Repository for user container images
    this.defaultRepository = new ecr.Repository(this, "ShiporaServicesRepository", {
      repositoryName: `${appName}-services`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [
        {
          description: "Keep last 20 container image builds per service",
          maxImageCount: 20,
          rulePriority: 1,
        },
      ],
    });

    // 2. Outputs
    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      value: this.defaultRepository.repositoryUri,
      description: "ECR Repository URI for Shipora Service Images",
      exportName: `${appName}-EcrRepositoryUri`,
    });

    new cdk.CfnOutput(this, "EcrRepositoryArn", {
      value: this.defaultRepository.repositoryArn,
      description: "ECR Repository ARN",
      exportName: `${appName}-EcrRepositoryArn`,
    });
  }
}
