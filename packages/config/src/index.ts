import { z } from "zod";

export const BRAND = {
  name: "PARTSAGRICOLA",
  domain: "partsagricola.com.br",
} as const;

const serviceEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().ip().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535),
});

export function parseServiceEnv(env: Record<string, string | undefined>) {
  return serviceEnvSchema.parse(env);
}

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
});
