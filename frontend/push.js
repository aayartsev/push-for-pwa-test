/**
 * Web Push subscribe helpers (VAPID via PushHive /api/config).
 */

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function extractMessageIdFromUrl(url) {
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.searchParams.get("m");
  } catch {
    return null;
  }
}

export async function fetchPushHiveConfig(fetchImpl, pushhiveUrl, apiKey) {
  const response = await fetchImpl(
    `${pushhiveUrl.replace(/\/$/, "")}/api/config`,
    { headers: { "X-API-Key": apiKey } },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("PushHive config failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function registerPushSubscription(
  fetchImpl,
  { pushhiveUrl, apiKey, subscription, device },
) {
  const response = await fetchImpl(
    `${pushhiveUrl.replace(/\/$/, "")}/api/subscribe`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        subscription,
        device: device || "desktop",
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "subscribe failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function buildAckPayload(messageId) {
  return { message_id: messageId, status: "delivered" };
}
