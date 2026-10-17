import Fastify from "fastify";
import { createHealthPayload } from "@partsagricola/shared";
export function createApp() {
  const app = Fastify({ logger: true });
  app.get("/health", async () => createHealthPayload("api"));
  return app;
}
