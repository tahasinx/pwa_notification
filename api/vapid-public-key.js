module.exports = (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return response.status(503).json({ error: "Push notifications are not configured." });
  }

  return response.status(200).json({ publicKey });
};
