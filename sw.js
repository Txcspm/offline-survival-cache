"use strict";

// Build 0.6. Catalog and module updates are refreshed when online.
const VERSION = "osc-core-v0.6.0";
const PREFIX = "osc-core-";
const CORE = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg",
  "./survival_cache_starter_25.json", "./knowledge/catalog.json",
  "./knowledge/search-index.json"
];
const scope = new URL(self.registration.scope);
const catalogURL = new URL("./knowledge/catalog.json", scope).href;
const searchURL = new URL("./knowledge/search-index.json", scope).href;
const baseURL = new URL("./", scope);

function safeModuleURL(path) {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\") || path.includes("..") || path.includes(":") || path.includes("?") || path.includes("#")) return null;
  const url = new URL(path, baseURL);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || !url.pathname.endsWith(".json")) return null;
  return url.href;
}

async function cacheModuleFiles(catalog, cache) {
  const paths = [...new Set((catalog.articles || []).map(item => safeModuleURL(item.module_path)).filter(Boolean))];
  const failed = [];
  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw Error(String(response.status));
      await cache.put(path, response);
    } catch (error) {
      if (!(await cache.match(path))) failed.push(path);
    }
  }
  return failed;
}

async function updateLibrary() {
  const cache = await caches.open(VERSION);
  // Keep the last complete catalog if a download fails.
  const response = await fetch(catalogURL, { cache: "no-store" });
  if (!response.ok) throw Error("Catalog unavailable");
  const catalog = await response.clone().json();
  if (!catalog || !Array.isArray(catalog.articles)) throw Error("Invalid catalog");
  const failed = await cacheModuleFiles(catalog, cache);
  if (failed.length) throw Error("Some modules are unavailable: " + failed.length);
  const search = await fetch(searchURL, { cache: "no-store" });
  if (!search.ok) throw Error("Search index unavailable");
  await cache.put(searchURL, search);
  await cache.put(catalogURL, response);
  return catalog.articles.length;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    const catalog = await (await cache.match(catalogURL)).json();
    const missing = await cacheModuleFiles(catalog, cache);
    if (missing.length) throw Error("Required knowledge modules missing");
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (request.mode === "navigate") {
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(new URL("./index.html", scope).href, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(new URL("./index.html", scope).href)) || Response.error();
      }
    }
    // Library metadata and modules are cached as a consistent set by updateLibrary.
    if (url.href === catalogURL || url.href === searchURL || url.pathname.endsWith(".json")) {
      return (await cache.match(request)) || fetch(request);
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) { return Response.error(); }
  })());
});

self.addEventListener("message", event => {
  const port = event.ports && event.ports[0];
  if (event.data?.type === "CHECK_OFFLINE_READY") {
    event.waitUntil((async () => {
      const cache = await caches.open(VERSION);
      const present = await Promise.all(CORE.map(file => cache.match(file)));
      let modulesReady = false;
      try {
        const catalog = await (await cache.match(catalogURL)).json();
        const paths = [...new Set(catalog.articles.map(item => safeModuleURL(item.module_path)).filter(Boolean))];
        modulesReady = (await Promise.all(paths.map(path => cache.match(path)))).every(Boolean);
      } catch (_) {}
      port?.postMessage({ ready: present.every(Boolean) && modulesReady, version: VERSION });
    })());
  }
  if (event.data?.type === "UPDATE_LIBRARY") {
    event.waitUntil((async () => {
      try {
        const count = await updateLibrary();
        port?.postMessage({ ok: true, count, version: VERSION });
      } catch (error) {
        port?.postMessage({ ok: false, error: String(error.message || error) });
      }
    })());
  }
});
