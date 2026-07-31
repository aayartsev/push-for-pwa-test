import assert from "node:assert/strict";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const push = await import(pathToFileURL(join(__dirname, "..", "push.js")).href);

test("extractMessageIdFromUrl читает query m", () => {
  assert.equal(push.extractMessageIdFromUrl("http://app/?m=abc-123"), "abc-123");
  assert.equal(push.extractMessageIdFromUrl("/?m=xyz"), "xyz");
  assert.equal(push.extractMessageIdFromUrl("/"), null);
});

test("buildAckPayload формирует delivered", () => {
  assert.deepEqual(push.buildAckPayload("mid"), {
    message_id: "mid",
    status: "delivered",
  });
});

test("registerPushSubscription шлёт X-API-Key и subscription", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(url, "http://push/api/subscribe");
    assert.equal(options.headers["X-API-Key"], "ph_key");
    assert.equal(JSON.parse(options.body).subscription.endpoint, "https://ep");
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, subscriberId: "sub1" }),
    };
  };
  const data = await push.registerPushSubscription(fetchImpl, {
    pushhiveUrl: "http://push",
    apiKey: "ph_key",
    subscription: { endpoint: "https://ep", keys: { p256dh: "a", auth: "b" } },
  });
  assert.equal(data.subscriberId, "sub1");
});

test("sw.js содержит обработчики push и ack", () => {
  const source = readFileSync(join(__dirname, "..", "sw.js"), "utf8");
  assert.match(source, /addEventListener\("push"/);
  assert.match(source, /\/api\/push\/ack/);
  assert.match(source, /searchParams\.get\("m"\)/);
  assert.match(source, /notificationclick/);
});
