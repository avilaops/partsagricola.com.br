import { writeFile } from "node:fs/promises";
import { createApp } from "./app.ts";

const app = await createApp({ logger: false });
await app.ready();
await writeFile(
  new URL("../openapi.json", import.meta.url),
  `${JSON.stringify(app.swagger(), null, 2)}\n`,
  "utf8",
);
await app.close();
