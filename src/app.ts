import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { sendToFirehose } from "./firehose";
import {
  extensionEventSchema,
  getEnv,
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

app.post(
  "/extension-events",
  zValidator("json", extensionEventSchema),
  async (c) => {
    const event = c.req.valid("json");
    const projectToken = process.env.TELEMETRY_PROJECT_TOKEN;

    if (!projectToken || event.project_token !== projectToken) {
      return c.json({ error: "invalid project_token" }, 401);
    }

    if (!validateTimestamp(event.timestamp)) {
      return c.json({ error: "timestamp outside acceptable window" }, 400);
    }

    const env = getEnv();
    const record = toFlatRecord(event, Date.now(), env);

    const result = await sendToFirehose(record);
    if (!result.ok) {
      console.error("Firehose send failed:", result.error);
      return c.json({ error: "ingestion failed" }, 500);
    }

    return c.body(null, 204);
  },
);

export default app;
