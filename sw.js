
"use strict";

const VERSION = "osc-core-v0.2.0";
const CACHE_PREFIX = "osc-core-";

const CORE_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => {
      return cache.addAll(CORE_FILES);
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith(CACHE_PREFIX) &&
            key !== VERSION
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (!url.pathname.startsWith(
    new URL(self.registration.scope).pathname
  )) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);

      if (request.mode === "navigate") {
        try {
          const response = await fetch(request);

          if (response.ok) {
            await cache.put(
              "./index.html",
              response.clone()
            );
          }

          return response;
        } catch (error) {
          const fallback =
            await cache.match("./index.html");

          if (fallback) return fallback;
          return Response.error();
        }
      }

      const cached = await cache.match(request);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok &&
            response.type === "basic") {
          await cache.put(
            request,
            response.clone()
          );
        }

        return response;
      } catch (error) {
        return Response.error();
      }
    })()
  );
});

self.addEventListener("message", event => {
  if (event.data?.type !== "CHECK_OFFLINE_READY") {
    return;
  }

  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);

      const results = await Promise.all(
        CORE_FILES.map(file => cache.match(file))
      );

      event.ports[0]?.postMessage({
        ready: results.every(Boolean),
        version: VERSION
      });
    })()
  );
});
