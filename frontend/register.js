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
  const registration = await registrationFn("/sw.js");
  // PushManager.subscribe требует активный SW; иначе Firefox даёт
  // AbortError: "Error retrieving push subscription."
  if (navigator.serviceWorker?.ready) {
    await navigator.serviceWorker.ready;
  } else if (registration.installing) {
    await new Promise((resolve, reject) => {
      const worker = registration.installing;
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve();
        if (worker.state === "redundant") reject(new Error("Service Worker не активировался"));
      });
    });
  }
  return registration;
}

export async function subscribeWebPush(registration, vapidPublicKey) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Разрешение на уведомления не выдано");
  }
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    // Старая подписка с другим VAPID ломает subscribe.
    await existing.unsubscribe().catch(() => {});
  }
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  } catch (err) {
    const msg = err && err.message ? String(err.message) : String(err);
    if (/retrieving push subscription/i.test(msg) || err?.name === "AbortError") {
      throw new Error(
        "Не удалось создать push-подписку. В Firefox: about:config → dom.push.connection.enabled = true; " +
          "очистите данные сайта и попробуйте снова. Также проверьте, что браузер не режет WebSocket к push-сервису.",
      );
    }
    throw err;
  }
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
