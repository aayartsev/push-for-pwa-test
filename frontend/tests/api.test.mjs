import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiUrl = pathToFileURL(join(__dirname, "..", "api.js")).href;
const { createUser, listUsers, sendMessage } = await import(apiUrl);

function mockFetch(handler) {
  return async (url, options = {}) => handler(url, options);
}

test("createUser отправляет POST /api/users и возвращает JSON", async () => {
  const fetchImpl = mockFetch(async (url, options) => {
    assert.equal(url, "http://app/api/users");
    assert.equal(options.method, "POST");
    assert.equal(JSON.parse(options.body).name, "Alice");
    return {
      ok: true,
      status: 201,
      json: async () => ({ id: "1", name: "Alice" }),
    };
  });
  const user = await createUser(fetchImpl, "http://app", {
    name: "Alice",
    device_id: "d1",
    push_subscriber_id: "s1",
  });
  assert.equal(user.name, "Alice");
});

test("createUser пробрасывает 409 при занятом имени", async () => {
  const fetchImpl = mockFetch(async () => ({
    ok: false,
    status: 409,
    json: async () => ({ detail: "name already taken" }),
  }));
  await assert.rejects(
    () =>
      createUser(fetchImpl, "http://app", {
        name: "Alice",
        device_id: "d1",
        push_subscriber_id: "s1",
      }),
    (err) => err.status === 409 && /taken/.test(err.message),
  );
});

test("listUsers вызывает GET /api/users", async () => {
  const fetchImpl = mockFetch(async (url, options) => {
    assert.equal(url, "http://app/api/users");
    assert.equal(options.method, undefined);
    return {
      ok: true,
      status: 200,
      json: async () => [{ id: "1", name: "Alice" }],
    };
  });
  const users = await listUsers(fetchImpl, "http://app");
  assert.equal(users.length, 1);
});

test("sendMessage отправляет POST /api/messages", async () => {
  const fetchImpl = mockFetch(async (url, options) => {
    assert.equal(url, "http://app/api/messages");
    assert.equal(options.method, "POST");
    return {
      ok: true,
      status: 201,
      json: async () => ({ id: "m1", push_status: "pending" }),
    };
  });
  const message = await sendMessage(fetchImpl, "http://app", {
    from_user_id: "a",
    to_user_id: "b",
    text: "hi",
  });
  assert.equal(message.push_status, "pending");
});
