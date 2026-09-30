import { NextRequest } from "next/server";

const backendOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").origin;

const forwardedRequestHeaders = new Set(["accept", "content-type", "cookie", "origin", "referer", "user-agent", "x-paystack-signature"]);
const skippedResponseHeaders = new Set(["connection", "content-encoding", "content-length", "keep-alive", "transfer-encoding"]);

async function forward(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${backendOrigin}/api/v1/${path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (forwardedRequestHeaders.has(key)) headers.set(key, value);
  });

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  });
  const responseHeaders = new Headers();

  upstream.headers.forEach((value, key) => {
    if (key !== "set-cookie" && !skippedResponseHeaders.has(key)) responseHeaders.set(key, value);
  });

  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    for (const cookie of setCookies) responseHeaders.append("set-cookie", cookie);
  } else {
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) responseHeaders.append("set-cookie", setCookie);
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;