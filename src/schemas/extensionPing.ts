import { z } from "zod";

const uuidv4Regex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const extensionPingSchema = z.object({
  project_token: z.string().min(1),
  uuid: z.string().regex(uuidv4Regex),
  installed_at: z.number(),
  installed_version: z.string(),
  updated_at: z.number(),
  updated_version: z.string(),
  current_version: z.string(),
  update_url: z.string().nullable(),
  pinged_at: z.number(),
  last_pinged_at: z.number().nullable(),
  last_startup_at: z.number().nullable(),
  ping_sequence: z.number().int().min(0),
  uptime_ms: z.number(),
  is_webdriver: z.boolean(),
  is_headless: z.boolean(),
  browser: z.string(),
  platform: z.string(),
  language: z.string(),
});

export type ExtensionPing = z.infer<typeof extensionPingSchema>;

const PINGED_AT_TOLERANCE_MS = 5 * 60 * 1000;
const INSTALL_TO_PING_MIN_MS = 2000;
const UPTIME_MAX_REASONABLE_MS = 30 * 24 * 60 * 60 * 1000;

export const validatePingedAt = (pinged_at: number) => {
  const now = Date.now();
  const diff = Math.abs(now - pinged_at);
  return diff <= PINGED_AT_TOLERANCE_MS;
};

export const computeBotRisk = (ping: ExtensionPing) => ({
  is_webdriver: ping.is_webdriver,
  is_headless: ping.is_headless,
  install_to_first_ping_fast:
    ping.ping_sequence === 1 &&
    ping.last_pinged_at === null &&
    ping.pinged_at - ping.installed_at < INSTALL_TO_PING_MIN_MS,
  uptime_suspicious:
    ping.uptime_ms < 0 || ping.uptime_ms > UPTIME_MAX_REASONABLE_MS,
});
