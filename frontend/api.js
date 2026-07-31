/**
 * Thin API client used by the SPA. Pure async functions — easy to unit-test.
 */

export async function createUser(fetchImpl, baseUrl, payload) {
  const response = await fetchImpl(`${baseUrl}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || "createUser failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function listUsers(fetchImpl, baseUrl) {
  const response = await fetchImpl(`${baseUrl}/api/users`);
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    const error = new Error("listUsers failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function sendMessage(fetchImpl, baseUrl, payload) {
  const response = await fetchImpl(`${baseUrl}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || "sendMessage failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function getMessage(fetchImpl, baseUrl, messageId) {
  const response = await fetchImpl(`${baseUrl}/api/messages/${messageId}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || "getMessage failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function listMessages(
  fetchImpl,
  baseUrl,
  { userId, peerId, limit = 20, offset = 0 },
) {
  const params = new URLSearchParams({
    user_id: userId,
    peer_id: peerId,
    limit: String(limit),
    offset: String(offset),
  });
  const response = await fetchImpl(`${baseUrl}/api/messages?${params}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || "listMessages failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
