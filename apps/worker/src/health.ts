import { createServer } from "node:http";
import { createHealthPayload } from "@partsagricola/shared";
export function createHealthServer() {
  return createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(createHealthPayload("worker")));
  });
}
