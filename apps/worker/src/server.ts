import { parseServiceEnv } from "@partsagricola/config";
import { createHealthServer } from "./health.js";
const env = parseServiceEnv(process.env);
createHealthServer().listen(env.PORT, env.HOST, () =>
  console.log(`worker health on ${env.HOST}:${env.PORT}`),
);
