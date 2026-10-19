// 本地存储：IndexedDB。所有记录只在这台手机上，不上传。
// stores: items（衣服）notes（记）outfits（搭配）wishes（想买）photos（照片 Blob）meta（原则、身体、设置）

const NAME = "atelier", VER = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of ["items", "notes", "outfits", "wishes", "photos"]) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: "id" });
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((d) => new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const db = {
  all: (store) => tx(store, "readonly", (s) => req(s.getAll())),
  get: (store, id) => tx(store, "readonly", (s) => req(s.get(id))),
  put: (store, obj) => tx(store, "readwrite", (s) => req(s.put(obj))),
  del: (store, id) => tx(store, "readwrite", (s) => req(s.delete(id))),
  clear: (store) => tx(store, "readwrite", (s) => req(s.clear())),
  meta: (key) => tx("meta", "readonly", (s) => req(s.get(key))),
  setMeta: (key, val) => tx("meta", "readwrite", (s) => req(s.put(val, key))),
};

// ------------------------------------------------------------------ 默认内容
export const DEFAULT_RULES = {
  version: 1,
  set: "2026.09",
  list: [
    { text: "表面安静，细节说话。", how: "一身只留一处会被注意到的地方。", history: [] },
    { text: "有来历，会变旧。", how: "选会越穿越好看的材料：羊毛、皮、厚棉。", history: [] },
    { text: "不能被一个标签概括。", how: "不照着任何一种「风格」整套抄。", history: [] },
    { text: "松弛，但不随便。", how: "合身，但留一点松量；袖子可以卷，领口可以开。", history: [] },
    { text: "衣柜是歌单。", how: "买之前先想好能和哪三件搭。", history: [] },
    { text: "经得起近看。", how: "远看不出来的地方，才是花钱的地方。", history: [] },
  ],
};

export const DEFAULT_BODY = {
  height: "", weight: "",
  head: "", shoulder: "", chest: "", waist: "", hip: "", calf: "",
  notes: {
    head: { title: "", how: "" },
    shoulder: { title: "", how: "" },
    waist: { title: "", how: "" },
    calf: { title: "", how: "" },
  },
  base: { shoulder: "", chest: "", length: "", sleeve: "", waist: "", hip: "", inseam: "", hem: "" },
  skin: "颜色",
  colors: [
    { name: "银", rgb: [196, 198, 202], fabric: "poplin" },
    { name: "藏青", rgb: [36, 44, 70], fabric: "knit" },
    { name: "燕麦", rgb: [206, 196, 176], fabric: "knit" },
    { name: "炭灰", rgb: [72, 72, 76], fabric: "linen" },
    { name: "雾蓝", rgb: [112, 128, 146], fabric: "linen" },
  ],
  weights: [],
};

export async function rules() { return (await db.meta("rules")) || structuredClone(DEFAULT_RULES); }
export async function body() { return { ...structuredClone(DEFAULT_BODY), ...((await db.meta("body")) || {}) }; }

// ------------------------------------------------------------------ 照片：缩到长边 1600，存 JPEG
export async function savePhoto(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  let blob = file;
  if (bmp) {
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
  }
  const id = uid();
  await db.put("photos", { id, blob });
  return id;
}

const urlCache = new Map();
export async function photoURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const p = await db.get("photos", id);
  if (!p) return null;
  const u = URL.createObjectURL(p.blob);
  urlCache.set(id, u);
  return u;
}

// 照片中间那块的颜色（取中位数，避开背景）
export async function photoColor(id) {
  const u = await photoURL(id);
  if (!u) return null;
  const im = new Image();
  im.src = u;
  await im.decode();
  const c = document.createElement("canvas"), N = 48;
  c.width = N; c.height = N;
  const ctx = c.getContext("2d");
  ctx.drawImage(im, im.width * 0.3, im.height * 0.3, im.width * 0.4, im.height * 0.4, 0, 0, N, N);
  const d = ctx.getImageData(0, 0, N, N).data;
  const ch = [[], [], []];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) ch[k].push(d[i + k]);
  return ch.map((a) => a.sort((x, y) => x - y)[a.length >> 1]);
}

// ------------------------------------------------------------------ 备份
const toDataURL = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });

export async function exportAll() {
  const out = { app: "atelier", version: 1, exported: new Date().toISOString() };
  for (const s of ["items", "notes", "outfits", "wishes"]) out[s] = await db.all(s);
  out.meta = { rules: await db.meta("rules"), body: await db.meta("body") };
  out.photos = {};
  for (const p of await db.all("photos")) out.photos[p.id] = await toDataURL(p.blob);
  return new Blob([JSON.stringify(out)], { type: "application/json" });
}

export async function importAll(text) {
  const d = JSON.parse(text);
  if (d.app !== "atelier") throw new Error("这不是这个 app 的备份文件");
  for (const s of ["items", "notes", "outfits", "wishes", "photos"]) await db.clear(s);
  for (const s of ["items", "notes", "outfits", "wishes"]) for (const o of d[s] || []) await db.put(s, o);
  for (const [id, url] of Object.entries(d.photos || {})) {
    const blob = await (await fetch(url)).blob();
    await db.put("photos", { id, blob });
  }
  if (d.meta?.rules) await db.setMeta("rules", d.meta.rules);
  if (d.meta?.body) await db.setMeta("body", d.meta.body);
  urlCache.clear();
}
