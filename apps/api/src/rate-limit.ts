import { ApiError } from "./errors.ts";

export function createPrincipalRateLimiter(options: {
  max: number;
  windowMs: number;
}) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    consume(principalId: string, now = Date.now()) {
      const current = buckets.get(principalId);
      if (!current || current.resetAt <= now) {
        buckets.set(principalId, {
          count: 1,
          resetAt: now + options.windowMs,
        });
        return;
      }
      current.count += 1;
      if (current.count > options.max)
        throw new ApiError(
          429,
          "RATE_LIMITED",
          "Limite de requisições excedido",
        );
    },
  };
}
