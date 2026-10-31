const webpush = require("web-push");
const {
  ENDPOINTS_KEY,
  getRedis,
  hasValidSenderToken,
  isValidNotification,
  subscriptionKey,
} = require("../lib/server");

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  if (!hasValidSenderToken(request)) {
    return response.status(401).json({ error: "Unauthorized." });
  }

  if (!isValidNotification(request.body)) {
    return response.status(400).json({ error: "Provide a title and optional body and same-origin path." });
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return response.status(503).json({ error: "Push notifications are not configured." });
  }

  try {
    const redis = getRedis();
    const endpoints = await redis.smembers(ENDPOINTS_KEY);
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const payload = JSON.stringify({
      title: request.body.title.trim(),
      body: request.body.body || "",
      url: request.body.url || "/",
    });

    let sent = 0;
    let removed = 0;
    let failed = 0;

    await Promise.all(
      endpoints.map(async (endpoint) => {
        try {
          const key = subscriptionKey(endpoint);
          const subscription = await redis.get(key);
          if (!subscription) {
            await redis.srem(ENDPOINTS_KEY, endpoint);
            removed += 1;
            return;
          }

          await webpush.sendNotification(subscription, payload);
          sent += 1;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await redis.del(subscriptionKey(endpoint));
            await redis.srem(ENDPOINTS_KEY, endpoint);
            removed += 1;
          } else {
            failed += 1;
            console.error("Could not deliver a push notification:", error);
          }
        }
      }),
    );

    if (failed > 0) {
      return response.status(502).json({ sent, removed, failed });
    }
    return response.status(200).json({ sent, removed, failed });
  } catch (error) {
    console.error("Push notification send failed:", error);
    return response.status(500).json({ error: "Could not send notifications." });
  }
};
