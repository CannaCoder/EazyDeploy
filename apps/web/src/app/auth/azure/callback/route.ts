import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = new URL(request.url).origin;

  if (error || !code) {
    const errorMsg = errorDescription || error || "Azure authorization was cancelled or failed";
    return NextResponse.redirect(
      `${baseUrl}/dashboard/settings/cloud-connections?status=error&message=${encodeURIComponent(
        errorMsg
      )}`
    );
  }

  // Successfully received OAuth code
  return NextResponse.redirect(
    `${baseUrl}/dashboard/settings/cloud-connections?status=connected&provider=azure`
  );
}
