/* Service worker: cache shell, show push, ack delivery. */

const CACHE = "pwa-messenger-v2";
const SHELL = ["/", "/static/styles.css", "/static/app.js", "/static/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Нужен Chromium'у для installability (beforeinstallprompt).
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        const url = new URL(request.url);
        if (
          response.ok &&
          url.origin === self.location.origin &&
          (url.pathname === "/" || url.pathname.startsWith("/static/"))
        ) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    }),
  );
});

function extractMessageId(url) {
  try {
    return new URL(url, self.location.origin).searchParams.get("m");
  } catch {
    return null;
  }
}

async function ackDelivered(messageId) {
  if (!messageId) return;
  const headers = { "Content-Type": "application/json" };
  // Optional secret can be injected later via query; MVP posts without it if unset.
  await fetch("/api/push/ack", {
    method: "POST",
    headers,
    body: JSON.stringify({ message_id: messageId, status: "delivered" }),
  }).catch(() => {});
}

self.addEventListener("push", (event) => {
  let payload = { title: "Сообщение", body: "", url: "/" };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    payload.body = event.data ? event.data.text() : "";
  }

  const messageId = extractMessageId(payload.url || "/");
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title || "Сообщение", {
        body: payload.body || "",
        data: { url: payload.url || "/", messageId },
        icon: payload.icon || "/static/icons/icon-192.png",
      });
      await ackDelivered(messageId);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
      return undefined;
    }),
  );
});

// Exported for Node tests via duplication in push.js — keep extractMessageId in sync.
