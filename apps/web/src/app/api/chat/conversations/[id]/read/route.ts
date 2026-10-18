import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const token = (await cookies()).get("pa_access")?.value;
  if (!token)
    return NextResponse.json(
      { error: { message: "Sessão ausente" } },
      { status: 401 },
    );
  const id = (await context.params).id;
  const response = await fetch(
    new URL(
      `/v1/chat/conversations/${encodeURIComponent(id)}/read`,
      process.env.API_ORIGIN ?? "http://localhost:4100",
    ),
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return new NextResponse(response.body, {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}
