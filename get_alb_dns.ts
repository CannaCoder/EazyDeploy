import { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import dotenv from "dotenv";
dotenv.config({ path: "/Users/binova/Documents/Projects/Suru/EazyDeploy/.env" });

async function run() {
  const client = new ElasticLoadBalancingV2Client({ region: "eu-north-1" });
  try {
    const res = await client.send(new DescribeLoadBalancersCommand({
      Names: ["shipora-alb"]
    }));
    console.log(res.LoadBalancers[0].DNSName);
  } catch (err) {
    console.error(err.message);
  }
}
run();
