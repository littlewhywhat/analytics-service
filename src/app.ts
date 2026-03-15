import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  computeBotRisk,
  extensionPingSchema,
  validatePingedAt,
} from "./schemas/extensionPing";

const app = new Hono().basePath("/api");

app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  }),
);

app.post("/extension-events", zValidator("json", extensionPingSchema), (c) => {
  const payload = c.req.valid("json");
  const projectToken = process.env.TELEMETRY_PROJECT_TOKEN;

  if (!projectToken || payload.project_token !== projectToken) {
    return c.json({ error: "Invalid project_token" }, 401);
  }

  if (!validatePingedAt(payload.pinged_at)) {
    return c.json({ error: "pinged_at outside acceptable time window" }, 400);
  }

  const now = Date.now();
  const event = {
    ...payload,
    bot_risk: computeBotRisk(payload),
    received_at: now,
  };

  console.log(JSON.stringify({ type: "extension_ping", event }));

  return c.body(null, 204);
});

export default app;
