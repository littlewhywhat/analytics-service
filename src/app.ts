import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { sendToFirehose } from "./firehose.js";
import {
  extensionEventSchema,
  getEnv,
  toFlatRecord,
  toUninstallFlatRecord,
  uninstallQuerySchema,
  validateTimestamp,
} from "./schemas/extensionEvent.js";

const api = new Hono().basePath("/api");

api.use(
  "*",
  cors({
    origin: (origin) =>
      origin?.startsWith("chrome-extension://") ? origin : null,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

api.options("/extension-events", (c) => c.body(null, 204));

api.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  }),
);

api.post(
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

const app = new Hono();

app.route("/", api);

app.get("/uninstall", zValidator("query", uninstallQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const projectToken = process.env.TELEMETRY_PROJECT_TOKEN;

  console.log("[uninstall] received", {
    uuid: query.uuid,
    env: process.env.TELEMETRY_ENV,
  });

  if (!projectToken || query.project_token !== projectToken) {
    console.log("[uninstall] invalid project_token");
    return c.body("Bad request", 400);
  }

  const env = getEnv();
  const record = toUninstallFlatRecord(query, Date.now(), env);
  const result = await sendToFirehose(record);
  console.log("[uninstall] firehose result", result);

  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sorry to see you go</title>
</head>
<body>
  <h1>Sorry to see you go</h1>
  <p>Bulavka has been uninstalled. Thanks for trying it out.</p>
</body>
</html>`);
});

export default app;
