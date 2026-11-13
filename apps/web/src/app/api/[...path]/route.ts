import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, path: string[]) {
  const backend = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://citacs-api:4000";
  const url = `${backend}/api/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const isGetOrHead = ["GET", "HEAD"].includes(request.method);
  const body = isGetOrHead ? undefined : await request.blob();

  try {
    const res = await fetch(url, {
      method: request.method,
      headers,
      body,
    });

    const resBody = await res.blob();
    return new NextResponse(resBody, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erro de comunicação com o backend CITacs API", details: err.message },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolved = await params;
  return proxy(request, resolved.path || []);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolved = await params;
  return proxy(request, resolved.path || []);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolved = await params;
  return proxy(request, resolved.path || []);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolved = await params;
  return proxy(request, resolved.path || []);
}
