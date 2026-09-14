# GitHub Actions — Required Secrets

Go to **GitHub → Repository → Settings → Secrets and Variables → Actions → New repository secret** and add each of the following.

> ⚠️ Never put these values in `.env` or commit them to the repo. Rotate the AWS keys before adding them here.

## CD Pipeline (deploy.yml)

| Secret Name | Where to Find It | Example |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | IAM → Users → Security credentials (create new key after rotating) | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | Shown once on IAM key creation — rotate the old one first | `...` |
| `AWS_REGION` | The region your ECS cluster is in | `eu-north-1` |
| `AWS_ACCOUNT_ID` | AWS console top-right, or `aws sts get-caller-identity` | `690990575414` |
| `ECR_REGISTRY` | `<account_id>.dkr.ecr.<region>.amazonaws.com` | `690990575414.dkr.ecr.eu-north-1.amazonaws.com` |
| `ECS_CLUSTER_NAME` | Your CDK ECS stack output | `shipora-cluster` |
| `ALB_DNS_NAME` | CDK output or `aws elbv2 describe-load-balancers` | `shipora-alb-xxxx.eu-north-1.elb.amazonaws.com` |
| `API_SERVICE_NAME` | ECS service name for the Shipora API | `shipora-api` |
| `WORKER_SERVICE_NAME` | ECS service name for the temporal worker | `shipora-temporal-worker` |
| `API_TASK_FAMILY` | ECS task definition family for API | `shipora-api` |
| `WORKER_TASK_FAMILY` | ECS task definition family for worker | `shipora-temporal-worker` |

## CI Pipeline (ci.yml / test.yml)

| Secret Name | Where to Find It | Notes |
|---|---|---|
| `DATABASE_URL_TEST` | Neon → create a separate test branch/DB | Falls back to local Postgres if not set |

## IAM Permissions Required for Deploy User

The IAM user whose keys you add above needs these minimum permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["iam:PassRole"],
      "Resource": "arn:aws:iam::690990575414:role/shipora-*"
    }
  ]
}
```

## How to Get ALB DNS Name

```bash
aws elbv2 describe-load-balancers \
  --names shipora-alb \
  --region eu-north-1 \
  --query 'LoadBalancers[0].DNSName' \
  --output text
```
