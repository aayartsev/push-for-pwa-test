/**
 * High-level registration flow: SW + PushHive subscribe + our /api/users.
 */
import { ensureDeviceId, saveSession } from "./storage.js";
import { createUser } from "./api.js";
import {
  fetchPushHiveConfig,
  registerPushSubscription,
  urlBase64ToUint8Array,
} from "./push.js";
import { fetchAppConfig, assertPushHiveConfigured } from "./config.js";

export async function registerServiceWorker(registrationFn = navigator.serviceWorker?.register.bind(navigator.serviceWorker)) {
  if (!registrationFn) {
    throw new Error("Service Worker не поддерживается");
  }
  return registrationFn("/sw.js");
}

export async function subscribeWebPush(registration, vapidPublicKey) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Разрешение на уведомления не выдано");
  }
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
}

export async function completeRegistration({
  fetchImpl = fetch,
  storage = localStorage,
  name,
  baseUrl = "",
  registerSW = registerServiceWorker,
  subscribe = subscribeWebPush,
}) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Введите имя");
  }

  const appConfig = await fetchAppConfig(fetchImpl, baseUrl || window.location.origin);
  assertPushHiveConfigured(appConfig);

  const registration = await registerSW();
  const phConfig = await fetchPushHiveConfig(
    fetchImpl,
    appConfig.pushhive_url,
    appConfig.pushhive_api_key,
  );
  const subscription = await subscribe(registration, phConfig.vapidPublicKey);
  const subJson = subscription.toJSON ? subscription.toJSON() : subscription;

  const phSub = await registerPushSubscription(fetchImpl, {
    pushhiveUrl: appConfig.pushhive_url,
    apiKey: appConfig.pushhive_api_key,
    subscription: subJson,
  });
  if (!phSub.subscriberId) {
    throw new Error("PushHive не вернул subscriberId");
  }

  const deviceId = ensureDeviceId(storage);
  const user = await createUser(fetchImpl, baseUrl || window.location.origin, {
    name: trimmed,
    device_id: deviceId,
    push_subscriber_id: String(phSub.subscriberId),
  });

  saveSession(storage, {
    userId: user.id,
    userName: user.name,
    pushSubscriberId: String(phSub.subscriberId),
  });

  return user;
}
