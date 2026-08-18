# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| Latest (main) | ✅ |
| Older releases | ❌ |

---

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, report them via:
- **Email:** security@shipora.dev
- **GitHub Security Advisories:** [Report a vulnerability](https://github.com/your-org/shipora/security/advisories/new)

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

We aim to respond within **48 hours** and provide a fix within **7 days** for critical issues.

---

## Security Design Principles

### Secrets
- User secrets are **never stored in plaintext** anywhere in the Shipora system
- All secrets are stored in **AWS Secrets Manager** and injected into ECS tasks as `valueFrom` references
- Secrets never appear in ECS console, CloudWatch logs, or Shipora's database
- Shipora employees cannot view user secret values

### Authentication
- All API routes are protected by **Clerk JWT verification**
- GitHub OAuth tokens are managed by Clerk and never stored by Shipora
- GitHub App private key is stored as an environment secret — never committed

### Webhooks
- All GitHub webhooks are validated using **HMAC-SHA256** with `GITHUB_APP_WEBHOOK_SECRET`
- Invalid signatures are rejected with `403 Forbidden`

### Network
- User-deployed ECS tasks run in **private subnets**
- Only the Application Load Balancer is internet-facing
- Task-to-task communication uses private VPC IPs

### Audit Logging
- All deploy events, conflict guard results, and secret access are logged to the `audit_logs` table
- Logs are immutable (insert-only)
