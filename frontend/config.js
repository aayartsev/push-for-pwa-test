/**
 * Helpers for reading public app config (PushHive URL / API key).
 */

export async function fetchAppConfig(fetchImpl, baseUrl) {
  const response = await fetchImpl(`${baseUrl}/api/config`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("fetchAppConfig failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function assertPushHiveConfigured(config) {
  if (!config?.pushhive_url) {
    throw new Error("pushhive_url is missing");
  }
  if (!config?.pushhive_api_key) {
    throw new Error("pushhive_api_key is missing — run ./scripts/seed-pushhive.sh");
  }
  return true;
}
