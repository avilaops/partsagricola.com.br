import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function proxy(request: Request, id: string) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token)
    return NextResponse.json(
      { error: { message: "Sessão ausente" } },
      { status: 401 },
    );
  const response = await fetch(
    new URL(
      `/v1/chat/conversations/${encodeURIComponent(id)}/messages`,
      process.env.API_ORIGIN ?? "http://localhost:4100",
    ),
    {
      method: request.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(request.method === "POST"
          ? { "content-type": "application/json" }
          : {}),
      },
      ...(request.method === "POST" ? { body: await request.text() } : {}),
      cache: "no-store",
    },
  );
  return new NextResponse(response.body, {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return proxy(request, (await context.params).id);
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return proxy(request, (await context.params).id);
}
