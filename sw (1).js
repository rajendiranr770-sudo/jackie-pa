// Finance app service worker — offline-first.
// App opens instantly from the phone's cache (even with weak/no network or a slow server),
// then checks for a newer version in the background.
const CACHE_NAME = "finance-app-v4";

const APP_FILES = ["./", "./index.html", "./manifest.json"];

// Firebase SDK files are loaded from gstatic. They must be cached too, otherwise the app cannot start offline.
const FIREBASE_ENTRY = [
    "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js",
    "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js",
    "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
];

async function precacheModule(cache, url, seen) {
    if (seen.has(url) || seen.size > 80) return;
    seen.add(url);
    try {
        let res = await cache.match(url);
        if (!res) {
            res = await fetch(url, { mode: "cors" });
            if (!res.ok) return;
            await cache.put(url, res.clone());
        }
        const text = await res.clone().text();
        const re = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;
        let m;
        while ((m = re.exec(text))) {
            await precacheModule(cache, new URL(m[1], url).href, seen);
        }
    } catch (e) { /* best effort */ }
}

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        for (const file of APP_FILES) {
            try { await cache.add(file); } catch (error) { console.warn("Cache செய்ய முடியவில்லை:", file, error); }
        }
        const seen = new Set();
        for (const url of FIREBASE_ENTRY) await precacheModule(cache, url, seen);
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith("finance-app-") && k !== CACHE_NAME).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

async function notifyUpdated() {
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(c => c.postMessage({ type: "APP_UPDATED" }));
}

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);

    // Firebase SDK scripts: cache-first so the app starts offline.
    if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
        event.respondWith((async () => {
            const cached = await caches.match(request);
            if (cached) return cached;
            const res = await fetch(request);
            if (res.ok) { const c = await caches.open(CACHE_NAME); await c.put(request, res.clone()); }
            return res;
        })());
        return;
    }

    // Other external addresses (Firestore data, login, fonts…) are untouched.
    if (url.origin !== self.location.origin) return;

    // Page open: show the cached app IMMEDIATELY, refresh it in the background.
    if (request.mode === "navigate") {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = (await cache.match(request, { ignoreSearch: true })) ||
                           (await cache.match("./index.html")) || (await cache.match("./"));

            const update = fetch(request).then(async (res) => {
                if (res && res.ok) {
                    const oldText = cached ? await cached.clone().text() : null;
                    const newText = await res.clone().text();
                    await cache.put("./index.html", res.clone());
                    await cache.put(request, res.clone());
                    if (oldText !== null && oldText !== newText) await notifyUpdated();
                }
                return res;
            }).catch(() => null);

            if (cached) { event.waitUntil(update); return cached; }
            const fresh = await update;
            return fresh || new Response("Offline: முதலில் இணையத்துடன் ஒரு முறை App-ஐத் திறக்கவும்.", { status: 503 });
        })());
        return;
    }

    // Other files of this app: cache first.
    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
            const res = await fetch(request);
            if (res.ok) { const c = await caches.open(CACHE_NAME); await c.put(request, res.clone()); }
            return res;
        } catch {
            return new Response("Offline-ல் இந்தக் கோப்பு கிடைக்கவில்லை.", { status: 503 });
        }
    })());
});
