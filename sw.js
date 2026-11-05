"use strict";
const VERSION = "osc-core-v0.5.0";
const PREFIX = "osc-core-";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./survival_cache_starter_25.json", "./knowledge/catalog.json", "./knowledge/search-index.json"];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    const catalog = await (await cache.match("./knowledge/catalog.json")).json();
    const paths = [...new Set((catalog.articles || []).map(a => a.module_path).filter(p => typeof p === "string" && !p.startsWith("/") && !p.includes("..") && !p.includes(":")))];
    await cache.addAll(paths.map(p => "./" + p));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (req.mode === "navigate") {
      try {
        const response = await fetch(req);
        if (response.ok) await cache.put("./index.html", response.clone());
        return response;
      } catch (error) { return (await cache.match("./index.html")) || Response.error(); }
    }
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const response = await fetch(req);
      if (response.ok && response.type === "basic") await cache.put(req, response.clone());
      return response;
    } catch (error) { return Response.error(); }
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type !== "CHECK_OFFLINE_READY") return;
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const present = await Promise.all(CORE.map(f => cache.match(f)));
    event.ports[0]?.postMessage({ready:present.every(Boolean),version:VERSION});
  })());
});
