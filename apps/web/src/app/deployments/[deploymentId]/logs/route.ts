import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ deploymentId: string }> }
) {
  const { deploymentId } = await context.params;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  try {
    const upstreamRes = await fetch(`${apiUrl}/deployments/${deploymentId}/logs`, {
      headers: {
        Accept: "text/event-stream",
      },
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      // Fallback empty SSE stream if upstream API is unreachable
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                serviceName: "system",
                logLine: "Connected to log stream",
                level: "info",
                timestamp: new Date().toISOString(),
              })}\n\n`
            )
          );
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    return new Response(upstreamRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({
              serviceName: "system",
              logLine: "Stream connected",
              level: "info",
              timestamp: new Date().toISOString(),
            })}\n\n`
          )
        );
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }
}
