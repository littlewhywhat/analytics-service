import { z } from "zod";

const uuidv4Regex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const baseFields = {
  project_token: z.string().min(1),
  uuid: z.string().regex(uuidv4Regex),
  current_version: z.string(),
  timestamp: z.number(),
};

const lifecycleFields = {
  installed_at: z.number(),
  installed_version: z.string(),
  updated_at: z.number(),
  updated_version: z.string(),
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
};

const pingSchema = z.object({
  ...baseFields,
  event_type: z.literal("ping"),
  ...lifecycleFields,
});

const installSchema = z.object({
  ...baseFields,
  event_type: z.literal("install"),
  ...lifecycleFields,
});

const updateSchema = z.object({
  ...baseFields,
  event_type: z.literal("update"),
  ...lifecycleFields,
});

const userActionSchema = z.object({
  ...baseFields,
  event_type: z.literal("user_action"),
  action: z.enum([
    "pin_reply",
    "unpin_reply",
    "favourite_chat",
    "unfavourite_chat",
    "enable_favourites_chats",
    "disable_favourites_chats",
    "enable_pin_replies",
    "disable_pin_replies",
  ]),
  action_data: z.string().optional(),
});

export const extensionEventSchema = z.discriminatedUnion("event_type", [
  pingSchema,
  installSchema,
  updateSchema,
  userActionSchema,
]);

export type ExtensionEvent = z.infer<typeof extensionEventSchema>;
type LifecycleEvent =
  | z.infer<typeof pingSchema>
  | z.infer<typeof installSchema>
  | z.infer<typeof updateSchema>;

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const INSTALL_TO_PING_MIN_MS = 2000;
const UPTIME_MAX_REASONABLE_MS = 30 * 24 * 60 * 60 * 1000;

export const validateTimestamp = (timestamp: number) =>
  Math.abs(Date.now() - timestamp) <= TIMESTAMP_TOLERANCE_MS;

const computeBotRisk = (event: LifecycleEvent) => ({
  bot_risk_webdriver: event.is_webdriver,
  bot_risk_headless: event.is_headless,
  bot_risk_install_to_ping_fast:
    event.ping_sequence === 1 &&
    event.last_pinged_at === null &&
    event.pinged_at - event.installed_at < INSTALL_TO_PING_MIN_MS,
  bot_risk_uptime_suspicious:
    event.uptime_ms < 0 || event.uptime_ms > UPTIME_MAX_REASONABLE_MS,
});

const TRIVIAL_PROJECT_TOKENS = new Set([
  "dev",
  "development",
  "pub_dev",
  "test",
]);

export const getEnv = (projectToken: string): "development" | "production" =>
  TRIVIAL_PROJECT_TOKENS.has(projectToken) ? "development" : "production";

export interface FlatRecord {
  env: "development" | "production";
  uuid: string;
  current_version: string;
  timestamp: number;
  event_type: string;
  received_at: number;

  installed_at: number | null;
  installed_version: string | null;
  updated_at: number | null;
  updated_version: string | null;
  update_url: string | null;
  pinged_at: number | null;
  last_pinged_at: number | null;
  last_startup_at: number | null;
  ping_sequence: number | null;
  uptime_ms: number | null;
  is_webdriver: boolean | null;
  is_headless: boolean | null;
  browser: string | null;
  platform: string | null;
  language: string | null;

  bot_risk_webdriver: boolean | null;
  bot_risk_headless: boolean | null;
  bot_risk_install_to_ping_fast: boolean | null;
  bot_risk_uptime_suspicious: boolean | null;

  action: string | null;
  action_data: string | null;
}

const EMPTY_LIFECYCLE = {
  installed_at: null,
  installed_version: null,
  updated_at: null,
  updated_version: null,
  update_url: null,
  pinged_at: null,
  last_pinged_at: null,
  last_startup_at: null,
  ping_sequence: null,
  uptime_ms: null,
  is_webdriver: null,
  is_headless: null,
  browser: null,
  platform: null,
  language: null,
  bot_risk_webdriver: null,
  bot_risk_headless: null,
  bot_risk_install_to_ping_fast: null,
  bot_risk_uptime_suspicious: null,
  action_data: null,
} as const;

export const toFlatRecord = (
  event: ExtensionEvent,
  received_at: number,
  env: "development" | "production",
): FlatRecord => {
  const base = {
    env,
    uuid: event.uuid,
    current_version: event.current_version,
    timestamp: event.timestamp,
    event_type: event.event_type,
    received_at,
  };

  if (event.event_type === "user_action") {
    return {
      ...base,
      ...EMPTY_LIFECYCLE,
      action: event.action,
      action_data: event.action_data ?? null,
    };
  }

  return {
    ...base,
    installed_at: event.installed_at,
    installed_version: event.installed_version,
    updated_at: event.updated_at,
    updated_version: event.updated_version,
    update_url: event.update_url,
    pinged_at: event.pinged_at,
    last_pinged_at: event.last_pinged_at,
    last_startup_at: event.last_startup_at,
    ping_sequence: event.ping_sequence,
    uptime_ms: event.uptime_ms,
    is_webdriver: event.is_webdriver,
    is_headless: event.is_headless,
    browser: event.browser,
    platform: event.platform,
    language: event.language,
    ...computeBotRisk(event),
    action: null,
    action_data: null,
  };
};
