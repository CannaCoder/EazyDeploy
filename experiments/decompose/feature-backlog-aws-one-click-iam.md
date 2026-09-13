# Feature Backlog: AWS One-Click IAM Auth (for tenant users)

**Status**: PARKED — implement after core deploy pipeline is stable

## Concept
Allow EazyDeploy users to connect their own AWS accounts via a "one-click" flow,
rather than using EazyDeploy's shared AWS account.

## Flow
1. User clicks "Connect AWS Account" in the UI
2. EazyDeploy generates a unique `ExternalId` (stored in DB against the connection)
3. User is redirected to AWS Console with a pre-built CloudFormation Quick-Create URL
4. CloudFormation creates an IAM Role in the user's account that trusts EazyDeploy's account (690990575414)
5. User pastes the Role ARN back (or it's auto-read from CF outputs)
6. EazyDeploy uses `sts:AssumeRole(RoleArn, ExternalId)` for all deployments to that account

## Already implemented
- `AwsAdapter.authenticate()` in packages/cloud-adapters/src/aws/index.ts (lines 148-168)
  already handles the AssumeRole flow with ExternalId.
- Just needs: frontend "Connect AWS" page + CloudFormation template + DB storage of roleArn/externalId

## CloudFormation template (to create)
IAM Role that trusts arn:aws:iam::690990575414:root with ExternalId condition.
Managed policies: AmazonECS_FullAccess, AmazonEC2ContainerRegistryFullAccess,
AWSCodeBuildDeveloperAccess, ElasticLoadBalancingFullAccess, AWSCloudFormationFullAccess

## Security Note
ExternalId prevents the "confused deputy" attack — always validate it on AssumeRole.
