/* CalmApp – Service Worker dedicado a Web Push.
 * Sin caché offline; solo gestiona push + notificationclick.
 *
 * Regla de navegación al tocar una notificación:
 *  - Si CalmApp ya está abierta → enfocar esa ventana y pedirle al
 *    cliente que navegue in-app vía postMessage ("calmapp:navigate").
 *    Esto evita el reload que rompía el destino y terminaba en /foco.
 *  - Si no hay ventana abierta → abrir la URL destino directamente.
 *
 * IMPORTANTE: nunca se navega desde el ícono de la home screen; solo
 * se navega cuando el usuario toca una notificación push.
 */
/* global self, clients */

self.addEventListener("install", (event) => {
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
  const targetPath =
    (event.notification.data && event.notification.data.url) || "/foco";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Reutilizar una ventana existente sin recargarla.
      for (const client of all) {
        try {
          const url = new URL(client.url);
          if (url.origin !== self.location.origin) continue;
          await client.focus();
          // Mandamos SIEMPRE el destino por postMessage: client.navigate
          // no es fiable en iOS/PWA standalone y produce reload silencioso
          // que descarta search params (por eso caía a /foco).
          client.postMessage({ type: "calmapp:navigate", to: targetPath });
          return;
        } catch {
          // ignore malformed URLs
        }
      }

      // Si no hay ninguna ventana, abrir CalmApp directamente en el destino.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetPath);
      }
    })(),
  );
});
