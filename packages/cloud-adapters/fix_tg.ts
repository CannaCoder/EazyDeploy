import { ElasticLoadBalancingV2Client, DescribeTargetGroupsCommand, ModifyTargetGroupCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/binova/Documents/Projects/Suru/EazyDeploy/.env" });

async function run() {
  const client = new ElasticLoadBalancingV2Client({ region: "eu-north-1" });
  try {
    const desc = await client.send(new DescribeTargetGroupsCommand({ Names: ["shipora-main-tg"] }));
    const tg = desc.TargetGroups?.[0];
    if (tg) {
      await client.send(new ModifyTargetGroupCommand({
        TargetGroupArn: tg.TargetGroupArn,
        HealthCheckPath: "/health",
      }));
      console.log("Updated target group:", tg.TargetGroupArn);
    }
  } catch (err) {
    console.error(err.message);
  }
}
run();
