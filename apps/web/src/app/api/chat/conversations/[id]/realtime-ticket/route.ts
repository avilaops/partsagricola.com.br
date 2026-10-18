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
  const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4100";
  const response = await fetch(
    new URL(
      `/v1/chat/conversations/${encodeURIComponent(id)}/realtime-ticket`,
      apiOrigin,
    ),
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as { ticket?: string };
  if (!response.ok)
    return NextResponse.json(payload, { status: response.status });
  const publicOrigin = new URL(process.env.API_PUBLIC_ORIGIN ?? apiOrigin);
  publicOrigin.protocol = publicOrigin.protocol === "https:" ? "wss:" : "ws:";
  publicOrigin.pathname = `/v1/chat/conversations/${encodeURIComponent(id)}/events`;
  publicOrigin.searchParams.set("ticket", payload.ticket!);
  return NextResponse.json({ ...payload, wsUrl: publicOrigin.toString() });
}
