import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient } from "./index.ts";

test("cliente usa contrato tipado, bearer e erro estável", async () => {
  const calls: Array<{
    url: string;
    authorization: string | null;
    method: string;
  }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: input.toString(),
      authorization: headers.get("authorization"),
      method: init?.method ?? "GET",
    });
    return Response.json({
      active: true,
      sub: "u",
      sid: "s",
      email: "a@example.test",
      email_verified: true,
      roles: ["USER"],
      seller_ids: [],
      scope: "openid",
    });
  };
  const session = await createApiClient({
    baseUrl: "https://api.example",
    fetcher,
  }).session("secret-token");
  assert.equal(session.sub, "u");
  assert.deepEqual(calls, [
    {
      url: "https://api.example/v1/session",
      authorization: "Bearer secret-token",
      method: "GET",
    },
  ]);
  const failed = createApiClient({
    baseUrl: "https://api.example",
    fetcher: async () =>
      Response.json(
        {
          error: {
            code: "AUTH_FORBIDDEN",
            message: "negado",
            requestId: "req-1",
          },
        },
        { status: 403 },
      ),
  });
  await assert.rejects(
    failed.session("token"),
    (error: Error & { code?: string; status?: number }) =>
      error.code === "AUTH_FORBIDDEN" && error.status === 403,
  );
});

test("cliente cobre assinatura e conclusão de upload do OpenAPI", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const client = createApiClient({
    baseUrl: "https://api.example",
    fetcher: async (input, init) => {
      calls.push({ url: input.toString(), init });
      return input.toString().endsWith("/sign")
        ? Response.json(
            {
              key: "uploads/seller/image.jpg",
              url: "https://s3",
              expiresIn: 300,
            },
            { status: 201 },
          )
        : Response.json({ jobId: "job-id" }, { status: 202 });
    },
  });
  await client.signUpload("token", "seller-id", {
    fileName: "foto.jpg",
    contentType: "image/jpeg",
    size: 1024,
  });
  await client.completeUpload("token", "seller-id", {
    key: "uploads/seller/image.jpg",
  });

  assert.deepEqual(
    calls.map(({ url, init }) => ({
      url,
      method: init?.method,
      sellerId: new Headers(init?.headers).get("x-seller-id"),
      contentType: new Headers(init?.headers).get("content-type"),
      body: init?.body,
    })),
    [
      {
        url: "https://api.example/v1/uploads/sign",
        method: "POST",
        sellerId: "seller-id",
        contentType: "application/json",
        body: JSON.stringify({
          fileName: "foto.jpg",
          contentType: "image/jpeg",
          size: 1024,
        }),
      },
      {
        url: "https://api.example/v1/uploads/complete",
        method: "POST",
        sellerId: "seller-id",
        contentType: "application/json",
        body: JSON.stringify({ key: "uploads/seller/image.jpg" }),
      },
    ],
  );
});
