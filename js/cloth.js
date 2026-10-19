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
// 布标一圈明线：一针一针画——线比布略深略黄，每针长 2.5pt、间距 2.3pt，有一点歪，下面压出一点影子
export function stitchLabel(el) {
  if (el.querySelector(":scope > canvas.stitch")) return;
  const W = el.offsetWidth, H = el.offsetHeight;
  if (!W || !H) return;
  const D = Math.min(window.devicePixelRatio || 1, 3);
  const cv = document.createElement("canvas");
  cv.className = "stitch";
  cv.width = Math.round(W * D); cv.height = Math.round(H * D);
  cv.style.width = W + "px"; cv.style.height = H + "px";
  const x = cv.getContext("2d");
  x.scale(D, D);
  const r = makeRng(hash("st" + el.textContent.length + W + H));
  const ins = 5.5, per = 2 * (W + H - 4 * ins);
  const at = (u) => {
    u = ((u % per) + per) % per;
    if (u < W - 2 * ins) return [ins + u, ins, 0];
    u -= W - 2 * ins; if (u < H - 2 * ins) return [W - ins, ins + u, 1];
    u -= H - 2 * ins; if (u < W - 2 * ins) return [W - ins - u, H - ins, 0];
    u -= W - 2 * ins; return [ins, H - ins - u, 1];
  };
  x.lineCap = "round";
  for (const pass of [0, 1]) {
    for (let s = r.uniform(0, 4.8); s < per; s += 4.8) {
      const [x0, y0] = at(s), [x1, y1] = at(s + 2.5 + r.normal(0, 0.12));
      if (Math.abs(x1 - x0) > 4 || Math.abs(y1 - y0) > 4) continue;     // 拐角处那一针不画
      const j = r.normal(0, 0.25);
      if (pass === 0) {                                                // 线压进布里的影子
        x.strokeStyle = "rgba(120,100,70,0.13)"; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(x0 + 0.3, y0 + 0.45 + j); x.lineTo(x1 + 0.3, y1 + 0.45 + j); x.stroke();
      } else {                                                         // 线本身：中间亮、两头暗一点
        const g = x.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, "rgba(206,196,170,0.85)"); g.addColorStop(0.5, "rgba(228,221,200,0.95)"); g.addColorStop(1, "rgba(206,196,170,0.85)");
        x.strokeStyle = g; x.lineWidth = 0.95;
        x.beginPath(); x.moveTo(x0, y0 + j); x.lineTo(x1, y1 + j); x.stroke();
      }
    }
  }
  el.prepend(cv);
}

export function watchSwatches() {
  const run = (root) => {
    root.querySelectorAll?.("canvas.swc:not([data-done])").forEach(enqueue);
    const labels = root.matches?.(".label") ? [root] : [...(root.querySelectorAll?.(".label") || [])];
    if (labels.length) requestAnimationFrame(() => labels.forEach(stitchLabel));
  };
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches?.("canvas.swc")) enqueue(n); else run(n); } })
    .observe(document.body, { childList: true, subtree: true });
  run(document);
}

// ------------------------------------------------------------------ 布带按钮
// 一条撕下来的亚麻布带：两条长边是织边（直、有一点厚度），两头是撕开的——纬纱被抽出来，长短不齐地垂着。
// 字是用墨印在布上的：墨落在纱线鼓起的地方，纱缝里浅一点。按按钮的实际大小逐像素现画，不拉伸。
let linen = null;
function loadLinen() {
  if (linen) return linen;
  linen = new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = im.width; c.height = im.height;
      const x = c.getContext("2d");
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, im.width, im.height).data;
      const g = new Float32Array(im.width * im.height);
      for (let i = 0; i < g.length; i++) g[i] = (d[i * 4] - 128) / 34;
      res({ g, w: im.width, h: im.height });
    };
    im.onerror = () => res(null);
    im.src = "assets/linen.jpg";
  });
  return linen;
}

const TPAD = 7, TPADY = 3;            // 留给抽出的纱线和影子
const TAPES = new Map();

function typeInto(x, text, w, h, size, dark, r) {
  x.font = `700 ${size}px "Courier Prime", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif`;
  const sp = size * 0.16, chars = [...text];
  const adv = chars.map((c) => x.measureText(c).width + sp);
  let cx = (w - adv.reduce((a, b) => a + b, 0) + sp) / 2;
  const base = h / 2 + size * 0.36;
  x.lineJoin = "round";
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    x.save();
    x.translate(cx + adv[i] / 2 - sp / 2 + r.normal(0, 0.12), base + r.normal(0, 0.28));
    x.rotate(r.normal(0, 0.009));
    x.globalAlpha = r.uniform(0.8, 1);                                // 打字机：每个字落下的力气不一样
    x.textAlign = "center";
    x.fillStyle = x.strokeStyle = "#000";
    x.lineWidth = dark ? 0.25 : 0.1;                                    // 黑布上白字显细，多描一点
    x.fillText(c, 0, 0); x.strokeText(c, 0, 0);
    x.globalAlpha *= 0.18; x.fillText(c, 0.35, 0.3);                  // 墨往布里洇开一点
    x.restore();
    cx += adv[i];
  }
}

async function renderTape(text, w, h, dark, seed, D) {
  const L = await loadLinen();
  const W = Math.round((w + 2 * TPAD) * D), H = Math.round((h + 2 * TPADY) * D);
  const r = makeRng(hash("tape" + seed + w));
  // 字先单独画一层
  const tc = document.createElement("canvas");
  tc.width = W; tc.height = H;
  const tx = tc.getContext("2d");
  tx.scale(D, D); tx.translate(TPAD, TPADY);
  typeInto(tx, text, w, h, 15, dark, makeRng(hash("ty" + text + seed)));
  const td = tx.getImageData(0, 0, W, H).data;

  const top = valueNoise(r, W, 1, 40 * D), topJ = valueNoise(r, W, 1, 4 * D);
  const bot = valueNoise(r, W, 1, 40 * D), botJ = valueNoise(r, W, 1, 4 * D);
  const lft = valueNoise(r, 1, H, 9 * D), rgt = valueNoise(r, 1, H, 9 * D);
  const wave = valueNoise(r, W, H, 26 * D);
  const P = 2.05;                                                      // 一根纬纱占的高度，pt
  const rows = Math.ceil((h + 2 * TPADY) / P) + 1;
  const mkEnd = () => Array.from({ length: rows }, () => ({
    jag: r.normal(0, 0.45),                                            // 撕口一格一格不齐
    len: r() < 0.62 ? r.uniform(0.6, 3.6) * (r() < 0.12 ? 2.4 : 1) : 0,
    droop: r.normal(0, 0.05), ph: r.uniform(0, 6.3), th: r.uniform(0.55, 0.85),
  }));
  const endL = mkEnd(), endR = mkEnd();
  const ox = r.int(0, Math.max(1, L ? L.w - W * 3 / D - 2 : 1)), oy = r.int(0, Math.max(1, L ? L.h - H * 3 / D - 2 : 1));
  const flip = r() < 0.5;
  const tex = (px, py) => {
    if (!L) return 0;
    let u = px * 3 / D, v = py * 3 / D;
    if (flip) u = W * 3 / D - u;
    const iu = Math.min(L.w - 1, (ox + u) | 0), iv = Math.min(L.h - 1, (oy + v) | 0);
    return L.g[iv * L.w + iu];
  };
  const base = dark ? [33, 32, 36] : [243, 239, 228];
  const out = new ImageData(W, H), o = out.data;
  const tilt = r.normal(0, 0.6);
  for (let py = 0; py < H; py++) {
    const Y = (py + 0.5) / D - TPADY;
    const ri = Math.max(0, Math.min(rows - 1, Math.floor((Y + TPADY) / P)));
    const rowY = (ri + 0.5) * P - TPADY;
    const eL = endL[ri], eR = endR[ri];
    const xl = 2.6 + 1.5 * lft[py] + eL.jag + tilt * (Y / h - 0.5);
    const xr = w - 2.6 - 1.5 * rgt[py] - eR.jag - tilt * (Y / h - 0.5);
    for (let px = 0; px < W; px++) {
      const X = (px + 0.5) / D - TPAD;
      const t = tex(px, py);
      const yt = 0.5 + 0.35 * top[px] + 0.12 * topJ[px], yb = h - 0.5 + 0.35 * bot[px] + 0.12 * botJ[px];
      const dEdge = Math.min(Y - yt, yb - Y), dEnd = Math.min(X - xl, xr - X);
      let a = sm(-0.6 / D, 0.6 / D, Math.min(dEdge, dEnd));
      if (dEnd < 1.6 && a > 0) a *= Math.min(1, Math.max(0.15, 0.62 + 0.45 * t + dEnd * 0.25));   // 撕口附近织得松，透出纸
      // 抽出来的纬纱
      let fa = 0, fshade = 0;
      if (dEnd < 0.4 && Y > yt - 0.2 && Y < yb + 0.2) {
        const e = X < w / 2 ? eL : eR, out_ = X < w / 2 ? xl - X : X - xr;
        if (e.len > 0 && out_ > -0.4 && out_ < e.len) {
          const cy = rowY + e.droop * out_ * out_ + 0.18 * Math.sin(out_ * 2.1 + e.ph);
          const dy = Math.abs(Y - cy);
          fa = sm(e.th / 2 + 0.5 / D, e.th / 2 - 0.5 / D, dy) * sm(e.len, e.len - 0.6, out_) * 0.92;
          fshade = (cy - Y) / e.th;                                    // 纱是圆的：上面亮下面暗
        }
      }
      const A = Math.max(a, fa);
      const i = (py * W + px) * 4;
      if (A <= 0.003) { o[i + 3] = 0; continue; }
      let k;
      if (a >= fa) {
        k = 1 + 0.018 * wave[py * W + px] + 0.012 * (0.5 - Y / h);
        if (dEdge < 1.3) k *= Y - yt < yb - Y ? 1 + 0.035 * (1.3 - dEdge) : 1 - 0.07 * (1.3 - dEdge);   // 织边：上缘受光、下缘卷进去一点
      } else k = (dark ? 1 : 0.94) + 0.07 * fshade;                       // 散开的纱比布面暗一点，看得出是一根根的
      let c0, c1, c2;
      if (dark) { const v = 9.5 * t; c0 = (base[0] + v) * k; c1 = (base[1] + v) * k; c2 = (base[2] + v * 1.05) * k; }
      else { const m = 1 + 0.06 * t; c0 = base[0] * m * k; c1 = base[1] * m * k; c2 = base[2] * m * k; }
      const ta = td[i + 3] / 255;
      if (ta > 0 && a > 0) {
        const ia = ta * Math.min(1, Math.max(0.45, 0.86 + 0.2 * t)) * a;
        if (dark) { const m = 0.9 + 0.05 * t; c0 += (226 * m - c0) * ia; c1 += (221 * m - c1) * ia; c2 += (208 * m - c2) * ia; }
        else { c0 *= 1 - ia * (1 - 34 / 255); c1 *= 1 - ia * (1 - 33 / 255); c2 *= 1 - ia * (1 - 38 / 255); }
      }
      o[i] = c0; o[i + 1] = c1; o[i + 2] = c2; o[i + 3] = A * 255;
    }
  }
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  c.getContext("2d").putImageData(out, 0, 0);
  return c;
}

export async function paintTape(btn) {
  if (btn.querySelector(":scope > canvas")) return;
  const w = Math.round(btn.offsetWidth), h = Math.round(btn.offsetHeight);
  if (!w || !h) return;
  const D = Math.min(window.devicePixelRatio || 1, 3), dark = btn.classList.contains("dark");
  const text = btn.dataset.text, seed = btn.dataset.seed || "";
  await document.fonts?.load(`700 15px "Courier Prime"`, text).catch(() => {});
  const key = [text, w, h, dark, seed, D].join("|");
  let src = TAPES.get(key);
  if (!src) {
    src = await renderTape(text, w, h, dark, seed, D);
    TAPES.set(key, src);
    if (TAPES.size > 40) TAPES.delete(TAPES.keys().next().value);
  }
  if (btn.querySelector(":scope > canvas")) return;
  const cv = document.createElement("canvas");
  cv.width = src.width; cv.height = src.height;
  cv.style.cssText = `left:${-TPAD}px;top:${-TPADY}px;width:${w + 2 * TPAD}px;height:${h + 2 * TPADY}px`;
  cv.getContext("2d").drawImage(src, 0, 0);
  btn.prepend(cv);
}
