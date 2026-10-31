const test = require("node:test");
const assert = require("node:assert/strict");
const {
  hasValidSenderToken,
  isValidNotification,
  isValidSubscription,
} = require("../lib/server");

test("accepts HTTPS subscriptions from supported push services", () => {
  assert.equal(isValidSubscription({
    endpoint: "https://fcm.googleapis.com/fcm/send/example",
    keys: { p256dh: "key", auth: "secret" },
  }), true);
});

test("rejects unsupported or insecure push endpoints", () => {
  assert.equal(isValidSubscription({
    endpoint: "http://fcm.googleapis.com/fcm/send/example",
    keys: { p256dh: "key", auth: "secret" },
  }), false);
  assert.equal(isValidSubscription({
    endpoint: "https://127.0.0.1/admin",
    keys: { p256dh: "key", auth: "secret" },
  }), false);
});

test("accepts notification payloads with same-origin paths", () => {
  assert.equal(isValidNotification({ title: "Update", url: "/news" }), true);
  assert.equal(isValidNotification({ title: "Update", url: "/" }), true);
});

test("rejects off-origin notification URLs and invalid payloads", () => {
  assert.equal(isValidNotification({ title: "Update", url: "//example.com" }), false);
  assert.equal(isValidNotification({ title: "Update", url: "https://example.com" }), false);
  assert.equal(isValidNotification({ title: " " }), false);
  assert.equal(isValidNotification({ title: "x".repeat(121) }), false);
});

test("sender authentication compares the bearer token", () => {
  process.env.PUSH_API_TOKEN = "test-token";
  assert.equal(hasValidSenderToken({ headers: { authorization: "Bearer test-token" } }), true);
  assert.equal(hasValidSenderToken({ headers: { authorization: "Bearer wrong" } }), false);
  assert.equal(hasValidSenderToken({ headers: {} }), false);
  delete process.env.PUSH_API_TOKEN;
});
