export type HealthResponse = { ok: true; service: "api" | "auth" | "worker" };
export async function getHealth(baseUrl: string): Promise<HealthResponse> {
  const response = await fetch(new URL("/health", baseUrl));
  if (!response.ok)
    throw new Error(`health request failed: ${response.status}`);
  return response.json() as Promise<HealthResponse>;
}
