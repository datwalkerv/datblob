/* datblob service worker: push notifications only. No caching, no offline copies of chats. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const url = typeof data.url === "string" && data.url.startsWith("/c/") ? data.url : "/";

  event.waitUntil(
    self.registration.showNotification(data.title || "datblob", {
      body: data.body || "New message",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      // One notification per chat: new messages replace the previous one…
      tag: data.tag || "datblob",
      // …but still buzz/ding again.
      renotify: true,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((w) => w.url === target);
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    })(),
  );
});
