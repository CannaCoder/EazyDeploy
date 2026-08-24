import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || null;

  const clientId =
    process.env.AZURE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ||
    "88602e5b-9361-4ff7-9ca4-6105aa7cdec9";

  const tenantId =
    process.env.AZURE_TENANT_ID ||
    process.env.NEXT_PUBLIC_AZURE_TENANT_ID ||
    "23543db5-54c7-4b3a-b22c-5f84b5594471";

  const redirectUri =
    process.env.AZURE_REDIRECT_URI ||
    "http://localhost:4000/auth/azure/callback";

  const stateObj = {
    projectId,
    nonce: randomUUID(),
  };
  const state = Buffer.from(JSON.stringify(stateObj)).toString("base64");

  const scopes = encodeURIComponent(
    "https://management.azure.com/.default offline_access"
  );

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_mode=query&scope=${scopes}&state=${state}`;

  return NextResponse.json({
    success: true,
    authUrl,
  });
}


