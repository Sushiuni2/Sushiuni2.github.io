// 离线缓存（tools/make_sw.py 生成，别手改）。
// 一个版本的所有文件放在同一个缓存里，页面只从这一个缓存取，新旧文件不会混在一起。
// 新版本在后台整版下载好之后，页面让它接管并重新打开一次。
const VERSION = "846d9c2d33";
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
"js/nav.js",
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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
});
self.addEventListener("message", (e) => { if (e.data === "skip") self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("atelier-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const key = req.mode === "navigate" ? new URL("./", self.registration.scope).href : req;
    return (await c.match(key, { ignoreSearch: true })) || fetch(req);
  }));
});
