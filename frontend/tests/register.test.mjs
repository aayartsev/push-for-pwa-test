import assert from "node:assert/strict";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const register = await import(pathToFileURL(join(__dirname, "..", "register.js")).href);

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test("completeRegistration проходит мок-цепочку и сохраняет сессию", async () => {
  const store = memoryStorage();
  const calls = [];

  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, method: options.method || "GET" });
    if (url.endsWith("/api/config")) {
      return {
        ok: true,
        json: async () => ({
          public_app_url: "http://app",
          pushhive_url: "http://push",
          pushhive_api_key: "ph_key",
        }),
      };
    }
    if (url.endsWith("/api/config") === false && url.includes("push") && url.endsWith("/api/config")) {
      // unreachable
    }
    if (url === "http://push/api/config") {
      return {
        ok: true,
        json: async () => ({ vapidPublicKey: "BPtest" }),
      };
    }
    if (url === "http://push/api/subscribe") {
      return {
        ok: true,
        json: async () => ({ success: true, subscriberId: "sub-9" }),
      };
    }
    if (url === "http://app/api/users" && options.method === "POST") {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: "user-1",
          name: "Alice",
          device_id: "dev",
          push_subscriber_id: "sub-9",
          created_at: "now",
        }),
      };
    }
    throw new Error(`unexpected url ${url}`);
  };

  const user = await register.completeRegistration({
    fetchImpl,
    storage: store,
    name: " Alice ",
    baseUrl: "http://app",
    registerSW: async () => ({
      pushManager: {
        subscribe: async () => ({
          toJSON: () => ({ endpoint: "https://ep", keys: { p256dh: "x", auth: "y" } }),
        }),
      },
    }),
    subscribe: async () => ({
      toJSON: () => ({ endpoint: "https://ep", keys: { p256dh: "x", auth: "y" } }),
    }),
  });

  assert.equal(user.name, "Alice");
  assert.equal(store.getItem("pwa_user_id"), "user-1");
  assert.equal(store.getItem("pwa_push_subscriber_id"), "sub-9");
  assert.ok(calls.some((c) => c.url === "http://push/api/subscribe"));
});

test("index.html подключает локальный owl и app.js", () => {
  const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /\/static\/libs\/owl\.iife\.js/);
  assert.doesNotMatch(html, /cdn\.jsdelivr|unpkg\.com|cdnjs/);
  assert.match(html, /app\.js/);
  assert.match(html, /manifest\.webmanifest/);
});

test("app.js описывает три экрана", () => {
  const source = readFileSync(join(__dirname, "..", "app.js"), "utf8");
  assert.match(source, /screen === 'register'/);
  assert.match(source, /screen === 'users'/);
  assert.match(source, /screen === 'service'/);
  assert.match(source, /screen === 'compose'/);
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /purgeStaleUsers|onPurgeStale/);
});
