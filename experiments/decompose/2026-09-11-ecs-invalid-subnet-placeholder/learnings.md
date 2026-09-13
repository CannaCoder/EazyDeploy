# Learnings: ECS Invalid Subnet Placeholders

## Root Cause (CONFIRMED)
`AwsAdapter.provisionService()` uses hardcoded placeholder subnet/SG IDs as env var fallbacks.
`SUBNET_ID_1`, `SUBNET_ID_2`, `ECS_SECURITY_GROUP_ID`, `VPC_ID`, `ALB_HTTP_LISTENER_ARN`
are not set in `.env`, so ECS CreateService is called with non-existent subnet IDs.

## Real CloudFormation Outputs (from ShiporaVpcStack + ShiporaEcsClusterStack)
- VPC_ID                  = vpc-0d2af61065462fb6e
- SUBNET_ID_1             = subnet-046c394a1a607f6db   (PublicSubnet1)
- SUBNET_ID_2             = subnet-050f2bf2bc7787468   (PublicSubnet2)
- ECS_SECURITY_GROUP_ID   = sg-0a43979da73f0921a      (ECS SG)
- ALB_SECURITY_GROUP_ID   = sg-06f2d95ebe60bace2
- ALB_HTTP_LISTENER_ARN   = arn:aws:elasticloadbalancing:eu-north-1:690990575414:listener/app/shipora-alb/e3a54fd0f9d6c44e/8a166fd107901e42
- ECS_CLUSTER_NAME        = shipora-cluster

## Fix
Write these values to .env so AwsAdapter picks them up without code changes.
