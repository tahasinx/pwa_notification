const { Redis } = require("@upstash/redis");
const { createHash, timingSafeEqual } = require("node:crypto");

const ENDPOINTS_KEY = "push:subscription-endpoints";

function getRedis() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash Redis environment variables are not configured.");
  }
  return new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN });
}

function subscriptionKey(endpoint) {
  const digest = createHash("sha256").update(endpoint).digest("hex");
  return `push:subscription:${digest}`;
}

function hasValidSenderToken(request) {
  const expected = process.env.PUSH_API_TOKEN;
  const authorization = request.headers.authorization || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!expected || !supplied) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function isValidSubscription(subscription) {
  if (!subscription || typeof subscription !== "object") {
    return false;
  }

  const { endpoint, keys } = subscription;
  if (
    typeof endpoint !== "string" ||
    endpoint.length > 2048 ||
    typeof keys?.p256dh !== "string" ||
    keys.p256dh.length > 512 ||
    typeof keys?.auth !== "string" ||
    keys.auth.length > 512
  ) {
    return false;
  }

  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    const supportedHost =
      host === "fcm.googleapis.com" ||
      host === "updates.push.services.mozilla.com" ||
      host === "web.push.apple.com" ||
      host.endsWith(".notify.windows.com");
    return url.protocol === "https:" && supportedHost;
  } catch {
    return false;
  }
}

function isValidNotification(body) {
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.title !== "string" ||
    body.title.trim().length === 0 ||
    body.title.length > 120 ||
    (body.body !== undefined && (typeof body.body !== "string" || body.body.length > 1000)) ||
    (body.url !== undefined && (typeof body.url !== "string" || body.url.length > 2048))
  ) {
    return false;
  }

  if (body.url === undefined) {
    return true;
  }

  try {
    const target = new URL(body.url, "https://push.invalid");
    return body.url.startsWith("/") && target.origin === "https://push.invalid";
  } catch {
    return false;
  }
}

module.exports = {
  ENDPOINTS_KEY,
  getRedis,
  hasValidSenderToken,
  isValidNotification,
  isValidSubscription,
  subscriptionKey,
};
