// 面料小样：和样稿同一个做法，逐像素画在 canvas 上——
// 真实面料扫描的明暗（assets/fab_*.png，128 = 原色）乘上颜色；剪刀直剪的边被纤维吃得不齐，带几根毛；
// 四角各一针白线（线是拧过的，有一点影子）；整块在纸上投一点影子。同一个 seed 永远同一块。
import { makeRng, hash } from "./ink.js";

const PAD = 4;                       // 留给毛边和影子的边，CSS px
const TEX = {};
let ready = null;

function loadTex() {
  if (ready) return ready;
  ready = Promise.all(["knit", "linen", "poplin", "jersey"].map((k) => new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = im.width; c.height = im.height;
      const x = c.getContext("2d");
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, im.width, im.height).data;
      const g = new Float32Array(im.width * im.height);
      for (let i = 0; i < g.length; i++) g[i] = d[i * 4] / 128;
      TEX[k] = { g, w: im.width, h: im.height };
      res();
    };
    im.onerror = res;
    im.src = `assets/fab_${k}.png`;
  })));
  return ready;
}

const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// 平滑噪声：低分辨率随机格子，双线性插值
function valueNoise(r, W, H, cell) {
  const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
  const grid = new Float32Array(gw * gh).map(() => r.normal());
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1], c = grid[(iy + 1) * gw + ix], d = grid[(iy + 1) * gw + ix + 1];
    out[y * W + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
  return out;
}

function boxBlur(src, W, H, r) {
  if (r < 1) return src;
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) s += src[y * W + Math.min(W - 1, Math.max(0, x))]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s / (2 * r + 1); s += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)]; } }
  for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]; for (let y = 0; y < H; y++) { out[y * W + x] = s / (2 * r + 1); s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; } }
  return out;
}

const SWCACHE = new Map();

export async function paintSwatch(cv) {
  if (cv.dataset.done) return;
  cv.dataset.done = "1";
  const ds = cv.dataset;
  const ck = [ds.c, ds.fab, ds.w, ds.h, ds.st, ds.hair, ds.seed, window.devicePixelRatio].join("|");
  if (SWCACHE.has(ck)) { const im = SWCACHE.get(ck); cv.width = im.width; cv.height = im.height; cv.getContext("2d").putImageData(im, 0, 0); return; }
  await loadTex();
  const wpt = +ds.w, hpt = +ds.h, col = ds.c.split(",").map(Number), kind = TEX[ds.fab] ? ds.fab : "knit";
  const stitches = ds.st === "1", hair = +ds.hair || 0.2;
  const r = makeRng(hash("swatch" + ds.seed));
  const D = Math.min(window.devicePixelRatio || 1, 3);
  const s = D;                                           // 每 pt 多少像素
  const W = Math.round((wpt + 2 * PAD) * s), H = Math.round((hpt + 2 * PAD) * s);
  cv.width = W; cv.height = H;
  const ox = PAD * s, oy = PAD * s, sw = wpt * s, sh = hpt * s;
  const N = W * H;

  // 1 布面颜色：扫描的明暗 × 颜色 × 一点大的深浅
  const T = TEX[kind], tsc = 3 / s;                      // 材质图是按 3 倍图做的
  const tx0 = r.int(0, T?.w || 1), ty0 = r.int(0, T?.h || 1);
  const big = valueNoise(r, W, H, 22 * s / 3);
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let g = 1;
    if (T) { const u = (Math.floor(x * tsc) + tx0) % T.w, v = (Math.floor(y * tsc) + ty0) % T.h; g = T.g[v * T.w + u]; }
    g *= 1 + 0.04 * big[i];
    R[i] = col[0] * g; G[i] = col[1] * g; B[i] = col[2] * g;
  }

  // 2 剪开的边：离边的距离 + 细碎的噪声，再加几根毛
  const edgeN = valueNoise(r, W, H, Math.max(1.5, 2.5 * s / 3));
  const A = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ed = Math.min(x - ox, ox + sw - x, y - oy, oy + sh - y);
    A[y * W + x] = sm(-0.6, 0.6, ed - 1.2 * s + edgeN[y * W + x] * 0.6 * s);
  }
  const hc = document.createElement("canvas"); hc.width = W; hc.height = H;
  const hx = hc.getContext("2d");
  hx.lineWidth = Math.max(0.8, s / 3 * 1.0); hx.lineCap = "round";
  const nh = Math.round((wpt + hpt) * 0.7 * hair);
  for (let k = 0; k < nh; k++) {
    const side = r.int(0, 4), u = r.uniform(0.02, 0.98);
    let [x, y] = [[ox + u * sw, oy + 1.5 * s], [ox + u * sw, oy + sh - 1.5 * s], [ox + 1.5 * s, oy + u * sh], [ox + sw - 1.5 * s, oy + u * sh]][side];
    let a = [-Math.PI / 2, Math.PI / 2, Math.PI, 0][side] + r.normal(0, 0.7);
    hx.strokeStyle = `rgba(255,255,255,${r.uniform(110, 210) / 255})`;
    hx.beginPath(); hx.moveTo(x, y);
    for (let j = 0; j < 5; j++) { a += r.normal(0, 0.45); const ln = r.uniform(0.5, 1.2) * s * Math.min(1, 0.5 + hair * 0.5); x += Math.cos(a) * ln; y += Math.sin(a) * ln; hx.lineTo(x, y); }
    hx.stroke();
  }
  const hd = hx.getImageData(0, 0, W, H).data;
  for (let i = 0; i < N; i++) A[i] = Math.max(A[i], hd[i * 4 + 3] / 255 * 0.75);

  // 3 四角四针白线
  if (stitches) {
    const ins = Math.min(7.5, wpt * 0.12), half = Math.min(3.4, wpt * 0.05) * s, rad = 0.85 * s, e = 0.4 * s / 3;
    for (const [cxp, cyp, ang] of [[ins, ins, -42], [wpt - ins, ins, 42], [ins, hpt - ins, 42], [wpt - ins, hpt - ins, -42]]) {
      const a = (ang + r.normal(0, 4)) * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
      const cx = ox + cxp * s, cy = oy + cyp * s, ext = half + 2 * s;
      for (let y = Math.max(0, Math.floor(cy - ext)); y < Math.min(H, cy + ext); y++) for (let x = Math.max(0, Math.floor(cx - ext)); x < Math.min(W, cx + ext); x++) {
        const rx = x - cx, ry = y - cy, al = rx * ux + ry * uy, ac = -rx * uy + ry * ux, i = y * W + x;
        const inside = sm(half + 0.6 * s, half - 0.6 * s, Math.abs(al)) * sm(rad + e, rad - e, Math.abs(ac));
        const shade = inside * Math.min(1, Math.max(0, 0.5 + 0.5 * ac / rad));
        const twist = inside * (0.5 + 0.5 * Math.sin((al + ac * 1.6) / (0.55 * s) * Math.PI));
        const shd = sm(half + 1.0 * s, half - 0.5 * s, Math.abs(al)) * sm(rad + 1.6 * s, rad, Math.abs(ac - 0.9 * s));
        const k = 1 - 0.35 * shd * (1 - inside);
        const t = 0.8 + 0.12 * twist - 0.12 * shade;
        R[i] = R[i] * k * (1 - inside) + 238 * t * inside;
        G[i] = G[i] * k * (1 - inside) + 235 * t * inside;
        B[i] = B[i] * k * (1 - inside) + 226 * t * inside;
      }
    }
  }

  // 4 影子：布的轮廓往右下挪一点、糊开，压在纸上
  const dx = Math.round(0.9 * s), dy = Math.round(1.4 * s);
  const S0 = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = x - dx, sy = y - dy; if (sx >= 0 && sy >= 0) S0[y * W + x] = A[sy * W + sx]; }
  let Sb = boxBlur(S0, W, H, Math.round(1.1 * s)); Sb = boxBlur(Sb, W, H, Math.round(0.8 * s));

  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(W, H), o = img.data;
  for (let i = 0; i < N; i++) {
    const a = A[i], sa = Sb[i] * 0.38 * 0.5 * (1 - a);
    const al = a + sa;
    if (al <= 0.001) continue;
    // 布在上，影子（偏暖的深色）在下
    o[i * 4] = Math.min(255, (R[i] * a + 70 * sa) / al);
    o[i * 4 + 1] = Math.min(255, (G[i] * a + 60 * sa) / al);
    o[i * 4 + 2] = Math.min(255, (B[i] * a + 45 * sa) / al);
    o[i * 4 + 3] = Math.min(255, al * 255);
  }
  ctx.putImageData(img, 0, 0);
  SWCACHE.set(ck, img);
  if (SWCACHE.size > 200) SWCACHE.delete(SWCACHE.keys().next().value);
}

export const SWATCH_PAD = PAD;

// 页面上新出现的面料小样，自动画上
const queue = [];
let pumping = false;
const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 16));
function pump() {
  if (pumping) return;
  pumping = true;
  idle(async function step(dl) {
    while (queue.length && dl.timeRemaining() > 2) {
      const cv = queue.shift();
      if (cv.isConnected) await paintSwatch(cv);
    }
    if (queue.length) idle(step); else pumping = false;
  });
}
function enqueue(cv) {
  const ck = cv.dataset;
  // 缓存里有的立刻贴上，其余排队空闲时画
  if (SWCACHE.has([ck.c, ck.fab, ck.w, ck.h, ck.st, ck.hair, ck.seed, window.devicePixelRatio].join("|"))) paintSwatch(cv);
  else { queue.push(cv); pump(); }
}
export function watchSwatches() {
  const run = (root) => root.querySelectorAll?.("canvas.swc:not([data-done])").forEach(enqueue);
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches?.("canvas.swc")) enqueue(n); else run(n); } })
    .observe(document.body, { childList: true, subtree: true });
  run(document);
}
