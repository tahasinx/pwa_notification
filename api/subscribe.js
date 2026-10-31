const {
  ENDPOINTS_KEY,
  getRedis,
  isValidSubscription,
  subscriptionKey,
} = require("../lib/server");

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const subscription = request.body;
  if (!isValidSubscription(subscription)) {
    return response.status(400).json({ error: "Invalid or unsupported push subscription." });
  }

  try {
    const redis = getRedis();
    await redis.set(subscriptionKey(subscription.endpoint), subscription);
    await redis.sadd(ENDPOINTS_KEY, subscription.endpoint);
    return response.status(201).json({ ok: true });
  } catch (error) {
    console.error("Could not store push subscription:", error);
    return response.status(500).json({ error: "Could not save this subscription." });
  }
};
