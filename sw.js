// 离线缓存（tools/make_sw.py 生成，别手改）。先用缓存打开，后台再取新的；版本变了就清掉旧缓存。
const VERSION = "44723563e7";
const CACHE = "atelier-" + VERSION;
const FILES = [
"./",
"assets/fab_jersey.png",
"assets/fab_knit.png",
"assets/fab_linen.png",
"assets/fab_poplin.png",
"assets/fray_0.png",
"assets/fray_1.png",
"assets/fray_2.png",
"assets/grain.png",
"assets/ink.png",
"assets/ink_light.png",
"assets/nav.png",
"assets/paper.jpg",
"assets/poplin.jpg",
"assets/stitch.png",
"assets/tape_dark_0.png",
"assets/tape_dark_1.png",
"assets/tape_dark_2.png",
"assets/tape_light_0.png",
"assets/tape_light_1.png",
"assets/tape_light_2.png",
"assets/thread.png",
"css/app.css",
"fonts/CourierPrime-Bold.ttf",
"fonts/CourierPrime-Regular.ttf",
"help.html",
"icons/icon-180.png",
"icons/icon-192.png",
"icons/icon-512.png",
"index.html",
"js/app.js",
"js/cloth.js",
"js/db.js",
"js/garments.js",
"js/ink.js",
"js/kinds.js",
"js/pages/body.js",
"js/pages/edit.js",
"js/pages/item.js",
"js/pages/notes.js",
"js/pages/outfits.js",
"js/pages/rules.js",
"js/pages/wardrobe.js",
"js/pages/wish.js",
"js/ui.js",
"manifest.webmanifest",
"privacy.html"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("atelier-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
