self.addEventListener("push", (event) => {
  let notification = {};
  try {
    notification = event.data ? event.data.json() : {};
  } catch {
    notification = { body: event.data ? event.data.text() : "" };
  }

  const title = typeof notification.title === "string" ? notification.title : "Notification";
  const options = {
    body: typeof notification.body === "string" ? notification.body : "",
    icon: "/icon-192.png",
    data: { url: typeof notification.url === "string" ? notification.url : "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data.url, self.location.origin);
    if (target.origin !== self.location.origin) {
      return;
    }

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        await client.navigate(target.href);
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});
