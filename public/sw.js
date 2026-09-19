/*
 * Offline cache for the fit checker.
 *
 * The build is a single self-contained index.html, so precaching that one file
 * precaches the whole app - hence no Workbox and no build step here. Bump
 * CACHE when you deploy; the old cache is dropped on activate.
 *
 * Paths are relative so this works unchanged at a domain root or under a
 * GitHub Pages project subpath (/<repo>/) - inside a worker they resolve
 * against the worker's own location, which is the deploy root either way.
 */
const CACHE = "fitcheck-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  // A navigation always lands on the shell - there is only one page.
  //
  // Only an OK response is allowed to win. fetch() rejects on a dead network,
  // but a 404 or a 5xx resolves *successfully* - so if the site is ever
  // unpublished or the host serves an error page, the naive version of this
  // caches that error page over the shell and bricks every installed copy.
  // Anything that isn't a 2xx falls through to the cache instead.
  if (req.mode === "navigate") {
    const cached = () => caches.match("./index.html").then((r) => r || caches.match("./"));
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (!res.ok) return cached().then((r) => r || res);
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(cached),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
