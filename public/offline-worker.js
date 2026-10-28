/* Only the public offline shell and its static assets are cached. Never API/RSC/private HTML. */
const CACHE = "arbetsrapporter-shell-v1";
const SHELL = "/offline";
async function prepareShell() {
    const response = await fetch(SHELL, { cache: "reload", credentials: "omit", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Offline shell unavailable");
    const html = await response.clone().text();
    const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]+)"/g)]
      .map((match) => new URL(match[1].replaceAll("&amp;", "&"), self.location.origin))
      .filter((url) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/"))
      .map((url) => url.href))];
    const cache = await caches.open(CACHE);
    await cache.addAll(assets);
    await cache.put(SHELL, response);
}
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await prepareShell();
    await self.skipWaiting();
  })());
});
self.addEventListener("message", (event) => {
  if (event.data !== "PREPARE_OFFLINE") return;
  event.waitUntil(prepareShell().then(() => event.ports[0]?.postMessage({ ok: true }))
    .catch(() => event.ports[0]?.postMessage({ ok: false })));
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("arbetsrapporter-shell-") && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request, { signal: AbortSignal.timeout(5000) });
        if (response.ok) { await cache.put(event.request, response.clone()); return response; }
        return (await cache.match(event.request)) ?? response;
      } catch {
        return (await cache.match(event.request)) ?? Response.error();
      }
    })());
  } else if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try { return await fetch(event.request, { signal: AbortSignal.timeout(5000) }); }
      catch {
        if (url.pathname !== SHELL) return Response.redirect(new URL(SHELL, self.location.origin), 302);
        return (await (await caches.open(CACHE)).match(SHELL)) ?? Response.error();
      }
    })());
  }
});
