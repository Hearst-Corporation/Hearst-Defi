// gpu1-backend/src/index.ts — entrypoint.
import { loadEnv } from "./config/env.js";
import { createGpu1Server } from "./api/server.js";

const env = loadEnv();
const server = createGpu1Server();

server.listen(env.PORT, env.HOST, () => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg: "gpu1-backend listening", host: env.HOST, port: env.PORT, env: env.NODE_ENV }));
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), msg: `received ${sig}, closing` }));
    server.close(() => process.exit(0));
  });
}
