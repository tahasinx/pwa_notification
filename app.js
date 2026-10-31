const button = document.querySelector("#subscribe");
const statusElement = document.querySelector("#status");
const sendForm = document.querySelector("#send-form");
const sendButton = document.querySelector("#send-button");
const sendStatus = document.querySelector("#send-status");

function setStatus(message) {
  statusElement.textContent = message;
}

function decodeVapidKey(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function saveSubscription(subscription) {
  const response = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  if (!response.ok) {
    throw new Error("Could not save this device subscription.");
  }
}

async function initialize() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    button.disabled = true;
    setStatus("Push notifications are not supported by this browser.");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await saveSubscription(subscription);
      button.disabled = true;
      setStatus("This device is subscribed to notifications.");
      return;
    }

    setStatus("Enable notifications on this device when you are ready.");
  } catch (error) {
    button.disabled = true;
    setStatus(error.message);
  }
}

button.addEventListener("click", async () => {
  button.disabled = true;
  setStatus("Requesting notification permission…");

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("Notification permission was not granted.");
      button.disabled = false;
      return;
    }

    const keyResponse = await fetch("/api/vapid-public-key");
    if (!keyResponse.ok) {
      throw new Error("Could not load the push configuration.");
    }
    const { publicKey } = await keyResponse.json();
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(publicKey),
    });

    await saveSubscription(subscription);
    setStatus("This device is subscribed to notifications.");
  } catch (error) {
    setStatus(error.message);
    button.disabled = false;
  }
});

initialize();

sendForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(sendForm);
  const token = formData.get("token").trim();
  const title = formData.get("title").trim();
  const body = formData.get("body").trim();
  const url = formData.get("url").trim() || "/";

  let isSameOriginPath = false;
  try {
    isSameOriginPath =
      url.startsWith("/") && new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    isSameOriginPath = false;
  }

  if (!isSameOriginPath) {
    sendStatus.textContent = "Enter a same-origin path beginning with /.";
    return;
  }

  sendButton.disabled = true;
  sendStatus.textContent = "Sending…";

  try {
    const response = await fetch("/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, body, url }),
    });
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Sender token was not accepted.");
      }
      if (response.status === 502 && typeof result.failed === "number") {
        sendStatus.textContent = `Sent to ${result.sent}; ${result.failed} failed; ${result.removed} expired subscription(s) removed.`;
        return;
      }
      throw new Error(result.error || "Could not send the notification.");
    }

    sendStatus.textContent = result.sent === 0
      ? "No devices are subscribed yet. Enable notifications on a device first."
      : `Notification sent to ${result.sent} device(s).`;
  } catch (error) {
    sendStatus.textContent = error.message;
  } finally {
    sendForm.elements.token.value = "";
    sendButton.disabled = false;
  }
});
