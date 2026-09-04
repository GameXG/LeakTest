import { buildServer } from "./server.js";

const portFromEnv = Number(process.env.PORT);
const port = Number.isFinite(portFromEnv) && portFromEnv > 0 ? portFromEnv : 4000;
const host = process.env.HOST ?? "0.0.0.0";

const server = buildServer();

try {
  await server.listen({ port, host });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
