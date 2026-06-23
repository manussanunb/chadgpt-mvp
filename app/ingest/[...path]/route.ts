import { type NextRequest, NextResponse } from "next/server";

const POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_ASSETS_HOST = "https://us-assets.i.posthog.com";

async function proxyToPostHog(request: NextRequest, path: string[]) {
  const pathname = "/" + path.join("/");
  const isAsset = pathname.startsWith("/static/") || pathname.startsWith("/array/");
  const host = isAsset ? POSTHOG_ASSETS_HOST : POSTHOG_HOST;

  const target = new URL(pathname, host);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("host", new URL(host).hostname);

  const body = request.method === "POST" ? await request.arrayBuffer() : undefined;

  const response = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: body ? Buffer.from(body) : undefined,
  });

  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    if (!["content-encoding", "transfer-encoding", "connection"].includes(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToPostHog(request, (await params).path);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToPostHog(request, (await params).path);
}
