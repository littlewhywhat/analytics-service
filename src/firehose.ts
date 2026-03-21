import {
  FirehoseClient,
  PutRecordCommand,
  type PutRecordCommandInput,
} from "@aws-sdk/client-firehose";
import type { FlatRecord } from "./schemas/extensionEvent.js";

let client: FirehoseClient | null = null;

const getClient = (): FirehoseClient | null => {
  if (client) return client;
  const region = process.env.AWS_REGION;
  if (!region) return null;
  client = new FirehoseClient({ region });
  return client;
};

export const sendToFirehose = async (
  record: FlatRecord,
  streamName: string,
): Promise<{ ok: true } | { ok: false; error: unknown }> => {
  const firehose = getClient();
  if (!firehose) {
    return { ok: false, error: new Error("Firehose not configured") };
  }
  const payload = JSON.stringify(record);
  const input: PutRecordCommandInput = {
    DeliveryStreamName: streamName,
    Record: {
      Data: new TextEncoder().encode(payload),
    },
  };
  try {
    await firehose.send(new PutRecordCommand(input));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
};
