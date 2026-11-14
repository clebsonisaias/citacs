import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, path: string[]) {
  const backend = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://citacs-api:4000";
  // O Next entrega os segmentos já decodificados; re-codifica para a API não decodificar de novo
  // (IDs do GenieACS têm "%2D", ex. "00259E-WS7001%2D40-...").
  const url = `${backend}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

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

    // 204/205/304 não podem ter corpo: o construtor da Response recusa até um corpo vazio.
    const resBody = [204, 205, 304].includes(res.status) ? null : await res.blob();
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
