import { Hono } from "hono";

const app = new Hono().basePath("/api");

app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  }),
);

export default app;
