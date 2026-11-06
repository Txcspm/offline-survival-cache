"use strict";

// Shell versions change with application releases; library generations commit independently.
const VERSION = "osc-core-v0.7.0";
const PREFIX = "osc-core-";
const CORE = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png",
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

const META = "osc-library-pointer";
let updating;
async function libraryCache() {
  const meta = await caches.open(META);
  const pointer = await meta.match(new URL("./active-library", scope));
  return caches.open(pointer ? await pointer.text() : VERSION);
}
async function updateLibrary() {
  if (updating) return updating;
  updating = stageLibrary().finally(() => { updating = null; });
  return updating;
}
async function stageLibrary() {
  const name = "osc-library-" + Date.now() + "-" + Math.random();
  const staged = await caches.open(name);
  try {
    const response = await fetch(catalogURL, {cache:"no-store"});
    if (!response.ok) throw Error("Catalog unavailable");
    const catalog = await response.clone().json();
    if (!Array.isArray(catalog.articles) || !catalog.modules) throw Error("Invalid catalog");
    for (const [path, digest] of Object.entries(catalog.modules)) {
      const url = safeModuleURL(path);
      if (!url || !/^[a-f0-9]{64}$/.test(digest)) throw Error("Invalid module record");
      const module = await fetch(url, {cache:"no-store"});
      if (!module.ok) throw Error("Module unavailable");
      const bytes = await module.clone().arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), x=>x.toString(16).padStart(2,"0")).join("");
      if (hash !== digest) throw Error("Module checksum mismatch");
      const data = await module.clone().json();
      if (!Array.isArray(data.articles)) throw Error("Invalid module");
      await staged.put(url, module);
    }
    for (const article of catalog.articles) if (!catalog.modules[article.module_path]) throw Error("Missing module record");
    const search = await fetch(searchURL, {cache:"no-store"});
    if (!search.ok || !Array.isArray((await search.clone().json()).articles)) throw Error("Invalid search index");
    await staged.put(searchURL,search);
    await staged.put(catalogURL,response);
    // One durable pointer write commits the entire validated generation.
    const meta = await caches.open(META);
    const previous = await meta.match(new URL("./active-library",scope));
    const previousName = previous ? await previous.text() : null;
    await meta.put(new URL("./active-library",scope),new Response(name));
    // Retain the previous generation while bounding storage growth. Cleanup is best effort.
    try {
      for (const key of await caches.keys()) {
        if (key.startsWith("osc-library-") && key !== META && key !== name && key !== previousName) await caches.delete(key);
      }
    } catch (_) {}
    return catalog.articles.length;
  } catch (error) { await caches.delete(name); throw error; }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    await updateLibrary();
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
      return (await cache.match(new URL("./index.html", scope).href)) || fetch(request);
    }
    // Library metadata and modules are cached as a consistent set by updateLibrary.
    if (url.href === catalogURL || url.href === searchURL || url.pathname.endsWith(".json")) {
      return (await (await libraryCache()).match(request)) || (await cache.match(request)) || fetch(request);
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
        const library = await libraryCache();
        const catalog = await (await library.match(catalogURL)).json();
        const paths = [...new Set(catalog.articles.map(item => safeModuleURL(item.module_path)).filter(Boolean))];
        modulesReady = (await Promise.all(paths.map(path => library.match(path)))).every(Boolean);
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
