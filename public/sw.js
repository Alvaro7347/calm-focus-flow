/* CalmApp – Service Worker dedicado a Web Push.
 * Sin caché offline; solo gestiona push + notificationclick.
 * Convive con el manifest de la PWA sin cambiar el modo standalone.
 */
/* global self, clients */

self.addEventListener("install", (event) => {
  // Activa el nuevo SW inmediatamente al instalarse.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "CalmApp", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "CalmApp";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/foco", type: data.type || "generic" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = (event.notification.data && event.notification.data.url) || "/foco";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reutilizar una ventana existente si la hay.
      for (const client of all) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            if ("navigate" in client) {
              try {
                await client.navigate(targetPath);
              } catch {
                // Algunos navegadores impiden navigate cross-scope silenciosamente.
              }
            } else {
              client.postMessage({ type: "calmapp:navigate", to: targetPath });
            }
            return;
          }
        } catch {
          // ignore malformed URLs
        }
      }
      // Si no hay ninguna ventana, abrir CalmApp.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetPath);
      }
    })(),
  );
});
