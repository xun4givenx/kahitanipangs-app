self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // An old worker cached app routes and API responses, allowing a phone to
  // continue rendering a previous deployment. Clear those caches once, then
  // let Vercel and Next manage fresh assets with their versioned URLs.
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
  self.clients.claim();
});
