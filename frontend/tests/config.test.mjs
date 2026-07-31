import assert from "node:assert/strict";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mod = await import(pathToFileURL(join(__dirname, "..", "config.js")).href);
const { fetchAppConfig, assertPushHiveConfigured } = mod;

test("fetchAppConfig читает /api/config", async () => {
  const fetchImpl = async (url) => {
    assert.equal(url, "http://app/api/config");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        public_app_url: "http://app",
        pushhive_url: "http://push",
        pushhive_api_key: "ph_abc",
      }),
    };
  };
  const config = await fetchAppConfig(fetchImpl, "http://app");
  assert.equal(config.pushhive_api_key, "ph_abc");
});

test("assertPushHiveConfigured требует api key", () => {
  assert.throws(
    () => assertPushHiveConfigured({ pushhive_url: "http://push" }),
    /pushhive_api_key/,
  );
  assert.equal(
    assertPushHiveConfigured({
      pushhive_url: "http://push",
      pushhive_api_key: "ph_x",
    }),
    true,
  );
});
