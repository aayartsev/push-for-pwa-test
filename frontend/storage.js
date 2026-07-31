/**
 * Persistence helpers for the PWA session (localStorage).
 */

const KEYS = {
  deviceId: "pwa_device_id",
  userId: "pwa_user_id",
  userName: "pwa_user_name",
  pushSubscriberId: "pwa_push_subscriber_id",
};

export function ensureDeviceId(storage = globalThis.localStorage, randomUUID = () => crypto.randomUUID()) {
  let id = storage.getItem(KEYS.deviceId);
  if (!id) {
    id = randomUUID();
    storage.setItem(KEYS.deviceId, id);
  }
  return id;
}

export function saveSession(storage, { userId, userName, pushSubscriberId }) {
  storage.setItem(KEYS.userId, userId);
  storage.setItem(KEYS.userName, userName);
  storage.setItem(KEYS.pushSubscriberId, pushSubscriberId);
}

export function loadSession(storage = globalThis.localStorage) {
  const userId = storage.getItem(KEYS.userId);
  const userName = storage.getItem(KEYS.userName);
  const pushSubscriberId = storage.getItem(KEYS.pushSubscriberId);
  if (!userId || !userName || !pushSubscriberId) {
    return null;
  }
  return { userId, userName, pushSubscriberId };
}

export function clearSession(storage = globalThis.localStorage) {
  storage.removeItem(KEYS.userId);
  storage.removeItem(KEYS.userName);
  storage.removeItem(KEYS.pushSubscriberId);
}

export function initialScreen(session) {
  return session ? "users" : "register";
}

export { KEYS };
