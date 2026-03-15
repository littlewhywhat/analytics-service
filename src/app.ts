import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  extensionEventSchema,
  toFlatRecord,
  validateTimestamp,
} from "./schemas/extensionEvent";

const app = new Hono().basePath("/api");

app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  }),
);

app.post("/extension-events", zValidator("json", extensionEventSchema), (c) => {
  const event = c.req.valid("json");
  const projectToken = process.env.TELEMETRY_PROJECT_TOKEN;

  if (!projectToken || event.project_token !== projectToken) {
    return c.json({ error: "invalid project_token" }, 401);
  }

  if (!validateTimestamp(event.timestamp)) {
    return c.json({ error: "timestamp outside acceptable window" }, 400);
  }

  const record = toFlatRecord(event, Date.now());

  // TODO: add @aws-sdk/client-firehose, PUT record batch to stream
  console.log(JSON.stringify(record));

  return c.body(null, 204);
});

export default app;
