import assert from "node:assert/strict";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const storage = await import(pathToFileURL(join(__dirname, "..", "storage.js")).href);

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test("ensureDeviceId создаёт и переиспользует id", () => {
  const store = memoryStorage();
  const a = storage.ensureDeviceId(store, () => "uuid-1");
  const b = storage.ensureDeviceId(store, () => "uuid-2");
  assert.equal(a, "uuid-1");
  assert.equal(b, "uuid-1");
});

test("save/load/clear session", () => {
  const store = memoryStorage();
  assert.equal(storage.loadSession(store), null);
  storage.saveSession(store, {
    userId: "u1",
    userName: "Alice",
    pushSubscriberId: "s1",
  });
  assert.deepEqual(storage.loadSession(store), {
    userId: "u1",
    userName: "Alice",
    pushSubscriberId: "s1",
  });
  storage.clearSession(store);
  assert.equal(storage.loadSession(store), null);
});

test("initialScreen зависит от сессии", () => {
  assert.equal(storage.initialScreen(null), "register");
  assert.equal(storage.initialScreen({ userId: "1" }), "users");
});
