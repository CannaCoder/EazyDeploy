# Variable Tree: ECS Fargate Provisioning — InvalidSubnetID.NotFound

**Objective**: "ECS CreateService fails because subnet IDs are hardcoded placeholders in AwsAdapter.provisionService()"

**Slug**: 2026-09-11-ecs-invalid-subnet-placeholder

---

## Root Failure (OBSERVED)
```
Provisioning failed for service 'web': Error retrieving subnet information
for [subnet-12345678, subnet-87654321]: The subnet ID 'subnet-12345678'
does not exist (ErrorCode: InvalidSubnetID.NotFound)
```

---

## Variables

### VAR-1: Where do the placeholder subnet IDs come from?
- type: leaf
- status: PROVEN — AwsAdapter.provisionService() line 446-451 uses env vars
  SUBNET_ID_1, SUBNET_ID_2, ECS_SECURITY_GROUP_ID with hardcoded fallbacks
  ("subnet-12345678", "subnet-87654321", "sg-12345678"). These env vars are
  NOT set in .env, so placeholders are used.

### VAR-2: Do the real subnet/SG IDs exist in AWS?
- type: leaf
- depends_on: [VAR-1]
- status: PENDING — ShiporaVpcStack was deployed by CDK. Real VPC/subnets/SGs
  should exist. Need to query CloudFormation stack outputs.

### VAR-3: What VPC/subnet/SG outputs did ShiporaVpcStack produce?
- type: leaf
- depends_on: [VAR-2]
- sandbox: query CloudFormation API for ShiporaVpcStack outputs
- status: PENDING

### VAR-4: Are VPC_ID, SUBNET_ID_1, SUBNET_ID_2, ECS_SECURITY_GROUP_ID, ALB_HTTP_LISTENER_ARN missing from .env?
- type: leaf
- status: PROVEN — these variables are absent from .env (confirmed by grep earlier)

### VAR-5: Fix path
- type: composite
- status: PENDING
- Options:
  A) Look up subnet/SG dynamically from CloudFormation outputs at deploy time (robust)
  B) Write real IDs to .env from CDK stack outputs (simple, correct for now)
