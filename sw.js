
const CACHE_NAME = "finance-app-v3";

const APP_FILES = [
    "./",
    "./index.html",
    "./manifest.json"
];

// Install
self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);

        for (const file of APP_FILES) {
            try {
                await cache.add(file);
            } catch (error) {
                console.warn("Cache செய்ய முடியவில்லை:", file, error);
            }
        }

        await self.skipWaiting();
    })());
});

// Activate
self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();

        await Promise.all(
            keys
                .filter(key =>
                    key.startsWith("finance-app-") &&
                    key !== CACHE_NAME
                )
                .map(key => caches.delete(key))
        );

        await self.clients.claim();
    })());
});

// Fetch
self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== "GET") return;

    // Firebase மற்றும் வெளிப்புற இணைய முகவரிகளை மாற்ற வேண்டாம்.
    if (url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);

                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                }

                return response;
            } catch {
                return (
                    await caches.match(request) ||
                    await caches.match("./index.html") ||
                    await caches.match("./")
                ) || new Response(
                    "Offline: முதலில் இணையத்துடன் App-ஐத் திறக்கவும்.",
                    { status: 503 }
                );
            }
        })());

        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
            const response = await fetch(request);

            if (response.ok) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response.clone());
            }

            return response;
        } catch {
            return new Response("Offline-ல் இந்தக் கோப்பு கிடைக்கவில்லை.", {
                status: 503
            });
        }
    })());
});
