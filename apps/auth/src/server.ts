import pg from "pg";
import { parseServiceEnv } from "@partsagricola/config";
import { createApp } from "./app.js";
import { parseAuthConfig } from "./config.js";
import { AuthRepository } from "./repository.js";
import { TokenService } from "./tokens.js";

const service = parseServiceEnv(process.env);
const config = parseAuthConfig(process.env);
const pool = new pg.Pool({ connectionString: config.databaseUrl });
const tokens = await TokenService.create(config.signingJwk, config.issuer.href);
const app = createApp({ config, repository: new AuthRepository(pool), tokens });
app.addHook("onClose", async () => pool.end());
await app.listen({ host: service.HOST, port: service.PORT });
