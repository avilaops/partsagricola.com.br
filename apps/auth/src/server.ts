import { parseServiceEnv } from "@partsagricola/config";
import { createApp } from "./app.js";
const env = parseServiceEnv(process.env);
await createApp().listen({ host: env.HOST, port: env.PORT });
