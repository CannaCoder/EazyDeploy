/**
 * cleanup-listener-rules.ts
 * Lists all rules on the shipora ALB listener, shows their priorities and targets,
 * then deletes any rules NOT managed by a CloudFormation stack (orphaned).
 *
 * Run: pnpm --filter @shipora/infra tsx ../../scripts/cleanup-listener-rules.ts
 */

import {
  ElasticLoadBalancingV2Client,
  DescribeRulesCommand,
  DeleteRuleCommand,
  DescribeTagsCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";

const LISTENER_ARN =
  process.env["ALB_HTTP_LISTENER_ARN"] ||
  "arn:aws:elasticloadbalancing:eu-north-1:690990575414:listener/app/shipora-alb/e3a54fd0f9d6c44e/8a166fd107901e42";

const REGION = process.env["AWS_REGION"] || "eu-north-1";

const client = new ElasticLoadBalancingV2Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"]!,
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"]!,
  },
});

async function main() {
  console.log("Listing listener rules for:", LISTENER_ARN);

  const { Rules = [] } = await client.send(
    new DescribeRulesCommand({ ListenerArn: LISTENER_ARN })
  );

  console.log(`\nFound ${Rules.length} rules:\n`);

  const orphaned: string[] = [];

  for (const rule of Rules) {
    const priority = rule.IsDefault ? "default" : rule.Priority;
    const conditions = rule.Conditions?.map((c) => `${c.Field}=${c.Values?.join(",")}`).join(" | ") || "(default)";
    const actions = rule.Actions?.map((a) => a.Type).join(",") || "";
    console.log(`  Priority ${priority}: ${conditions} → ${actions}  [ARN: ${rule.RuleArn}]`);

    // Default rule is never orphaned
    if (rule.IsDefault) continue;

    // Never delete core system rules (priorities <= 100 or pointing to core services)
    const isCoreTarget = rule.Actions?.some(a => 
      a.TargetGroupArn?.includes("shipora-api") || 
      a.TargetGroupArn?.includes("shipora-web") || 
      a.TargetGroupArn?.includes("shipora-main")
    );
    const numPriority = Number(rule.Priority);
    if (isCoreTarget || (!isNaN(numPriority) && numPriority <= 100)) {
      console.log(`    → PROTECTED (core system rule priority ${rule.Priority})`);
      continue;
    }

    // Try to get tags to check if CFN-managed (CFN adds aws:cloudformation:stack-name tag)
    const { TagDescriptions = [] } = await client.send(
      new DescribeTagsCommand({ ResourceArns: [rule.RuleArn!] })
    );
    const tags = TagDescriptions[0]?.Tags || [];
    const cfnStack = tags.find((t) => t.Key === "aws:cloudformation:stack-name");

    if (!cfnStack) {
      console.log(`    → ORPHANED (no CloudFormation tag) — will delete`);
      orphaned.push(rule.RuleArn!);
    } else {
      console.log(`    → Managed by stack: ${cfnStack.Value}`);
    }
  }

  if (orphaned.length === 0) {
    console.log("\nNo orphaned rules found.");
    return;
  }

  console.log(`\nDeleting ${orphaned.length} orphaned rule(s)...`);
  for (const arn of orphaned) {
    await client.send(new DeleteRuleCommand({ RuleArn: arn }));
    console.log(`  ✅ Deleted: ${arn}`);
  }

  console.log("\nDone. Re-run CDK deploy now.");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
