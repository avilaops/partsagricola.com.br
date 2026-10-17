export type ServiceName = "api" | "auth" | "worker";

export function createHealthPayload(service: ServiceName) {
  if (!service) throw new Error("service is required");
  return { ok: true as const, service };
}
