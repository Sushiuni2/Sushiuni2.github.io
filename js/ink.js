// 签字笔：在 canvas 上画手稿的线。坐标一律是 CSS px（= iPhone 的 pt）。
// 一笔 = 一条宽度沿路变化的墨迹：两头慢、笔画粗，中间快、细；有的下笔重，有的收笔重，有的收笔一挑。
// 几笔叠在一起墨更深（每笔不是全黑）；最后用纸纤维的纹理把墨吃掉一点。同一个 seed 永远画出同一张。

export const INK = "rgb(40,39,44)";

export function hash(s) {
  let h = 2166136261 >>> 0;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

export function makeRng(seed) {
  let a = typeof seed === "number" ? seed >>> 0 : hash(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = () => next();
  r.uniform = (a0, a1) => a0 + (a1 - a0) * next();
  r.normal = (mu = 0, sd = 1) => {
    const u = Math.max(next(), 1e-9), v = next();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  r.int = (a0, a1) => Math.floor(r.uniform(a0, a1));
  r.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return r;
}

// 穿过控制点的 Catmull-Rom
export function curve(ctrl, n = 36) {
  const C = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const out = [];
  for (let i = 1; i < C.length - 2; i++) {
    const [p0, p1, p2, p3] = [C[i - 1], C[i], C[i + 1], C[i + 2]];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  out.push(C[C.length - 2]);
  return out;
}

const smoothstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

function gauss1d(arr, sigma) {
  const n = arr.length, out = new Float32Array(n);
  const r = Math.ceil(sigma * 3), k = [];
  let s = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); s += v; }
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let j = -r; j <= r; j++) acc += arr[Math.min(n - 1, Math.max(0, i + j))] * k[j + r];
    out[i] = acc / s;
  }
  return out;
}

// 平滑的随机起伏：σ 大的时候不做长卷积，先在稀疏的点上取随机数再插值（结果差不多，快几十倍）
function smoothNoise(rng, n, sigma) {
  if (sigma <= 4) return gauss1d(Float32Array.from({ length: n }, () => rng.normal()), sigma);
  const step = sigma / 2, k = Math.ceil(n / step) + 3;
  const g = gauss1d(Float32Array.from({ length: k }, () => rng.normal()), 1.2);
  const amp = Math.sqrt(1.2 / sigma);                  // 和直接卷积的起伏一样大
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const f = i / step, j = Math.floor(f), t = f - j; out[i] = (g[j] * (1 - t) + g[j + 1] * t) * amp; }
  return out;
}

function resample(P, step) {
  const out = [P[0]];
  let carry = 0;
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1], [x1, y1] = P[i];
    const L = Math.hypot(x1 - x0, y1 - y0);
    let d = step - carry;
    while (d <= L) { out.push([x0 + (x1 - x0) * d / L, y0 + (y1 - y0) * d / L]); d += step; }
    carry = L - (d - step);
  }
  const last = P[P.length - 1], prev = out[out.length - 1];
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > step * 0.3) out.push(last);
  return out;
}

let GRAIN = null;
export function loadGrain(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => { GRAIN = im; res(); };
    im.onerror = () => res();
    im.src = src;
  });
}

export class Sheet {
  // canvas: 要画的 <canvas>；w,h: CSS px；seed: 同一个 seed 同一张画
  constructor(canvas, w, h, seed, opts = {}) {
    const D = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * D); canvas.height = Math.round(h * D);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    this.c = canvas; this.D = D; this.w = w; this.h = h;
    this.ctx = canvas.getContext("2d");
    this.ctx.setTransform(D, 0, 0, D, 0, 0);
    this.rng = makeRng(seed);
    this.color = opts.color || INK;
    this.shade = {};
  }

  // ---------------------------------------------------------------- 一笔
  _organic(pts) {
    let P = pts.map((p) => [p[0], p[1]]);
    if (P.length === 2) {
      const [a, b] = P, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = -(b[1] - a[1]) / (L || 1), ny = (b[0] - a[0]) / (L || 1);
      const bow = this.rng.normal(0, Math.min(0.02 * L, 1.1));
      const m = Math.max(8, Math.round(L / 3));
      P = [];
      for (let i = 0; i < m; i++) {
        const t = i / (m - 1), k = bow * 4 * t * (1 - t);
        P.push([a[0] + (b[0] - a[0]) * t + nx * k, a[1] + (b[1] - a[1]) * t + ny * k]);
      }
    }
    return P;
  }

  pen(pts, w = 0.62, { wob = 0.25, over = 1.2, alpha = 1 } = {}) {
    const rng = this.rng;
    if (!pts || pts.length < 2) return;
    let P = this._organic(pts);
    // 有时收笔早一点，接头处留一道缝
    if (over && P.length > 6 && rng() < 0.35) {
      const cut = rng.uniform(0.27, 0.87);
      let L = 0; const cum = [0];
      for (let i = 1; i < P.length; i++) { L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); cum.push(L); }
      const keep = cum.filter((c) => c < L - cut).length;
      if (keep > 3) P = P.slice(0, keep + 1);
    }
    const n = P.length;
    const dx = smoothNoise(rng, n, Math.max(2, n / 6));
    const dy = smoothNoise(rng, n, Math.max(2, n / 6));
    const amp = wob * 3 * Math.min(1, 140 / Math.max(n * 3, 1));
    P = P.map((p, i) => [p[0] + dx[i] * amp, p[1] + dy[i] * amp]);
    if (over) {
      const ext = (a, b, k) => { const L = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; return [a[0] + (a[0] - b[0]) / L * k, a[1] + (a[1] - b[1]) / L * k]; };
      P = [ext(P[0], P[1], over * rng.uniform(0, 0.3)), ...P, ext(P[n - 1], P[n - 2], over * rng.uniform(0.03, 0.37))];
    }
    this._stroke(P, w * rng.uniform(0.85, 1.1), rng.uniform(0.8, 1.0) * alpha, rng() < 0.35);
  }

  _stroke(P0, w, dens, flick) {
    const rng = this.rng, ctx = this.ctx;
    const P = resample(P0, 0.4);
    const m = P.length;
    if (m < 2) return;
    const tr = 0.06;
    const tx = gauss1d(Float32Array.from({ length: m }, () => rng.normal()), 2), ty = gauss1d(Float32Array.from({ length: m }, () => rng.normal()), 2);
    let press = smoothNoise(rng, m, Math.max(4, m / 5));
    const pm = Math.max(1e-6, ...Array.from(press, Math.abs));
    const heavy = rng() < 0.5;
    const R = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      const t = i / (m - 1), v = Math.pow(Math.sin(Math.PI * t), 0.6);
      const bias = 0.18 * (heavy ? 1 - t : t);
      let r = (w / 2) * (1.15 - 0.3 * v + 0.28 * press[i] / pm + bias);
      if (flick) r *= 1 - 0.75 * smoothstep(0.9, 1.0, t);
      R[i] = Math.max(0.12, r);
      P[i] = [P[i][0] + tx[i] * tr * 3, P[i][1] + ty[i] * tr * 3];
    }
    // 宽度变化的墨迹：左边一路过去，圆头，右边一路回来
    const L = [], Rt = [];
    for (let i = 0; i < m; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(m - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l;
      L.push([P[i][0] + nx * R[i], P[i][1] + ny * R[i]]);
      Rt.push([P[i][0] - nx * R[i], P[i][1] - ny * R[i]]);
    }
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < m; i++) ctx.lineTo(L[i][0], L[i][1]);
    const e = P[m - 1], s = P[0];
    const ae = Math.atan2(L[m - 1][1] - e[1], L[m - 1][0] - e[0]);
    ctx.arc(e[0], e[1], R[m - 1], ae, ae + Math.PI, true);
    for (let i = m - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]);
    const as = Math.atan2(Rt[0][1] - s[1], Rt[0][0] - s[0]);
    ctx.arc(s[0], s[1], R[0], as, as + Math.PI, true);
    ctx.closePath();
    ctx.globalAlpha = 1 - Math.exp(-1.7 * dens);
    ctx.fillStyle = this.color;
    ctx.fill("nonzero");
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- 常用的笔画
  line(a, b, w = 0.5, o = {}) { this.pen([a, b], w, { over: 0, wob: 0.15, ...o }); }

  rect(x0, y0, x1, y1, w = 0.5, cross = 1.2) {
    for (const [p, q] of [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]])
      this.pen([p, q], w, { over: cross, wob: 0.15 });
  }

  circle(cx, cy, r, w = 0.6, ry = null, turns = 1.08) {
    const a0 = this.rng.uniform(0, 6.28);
    ry = ry == null ? r * 0.96 : ry;
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const a = a0 + 2 * Math.PI * turns * i / 47;
      pts.push([cx + r * (1 + 0.04 * Math.sin(3 * a)) * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    this.pen(pts, w, { over: 0, wob: 0.06 });
  }

  // 照他的稿子：四笔长线冲出角、像裁切线一样交叉；上边描两遍慢慢分开；右边有第二道；下边没画到头，补一小竖
  frame(x0, y0, x1, y1, w = 0.75) {
    const rng = this.rng;
    const p = (a, b, ww = w) => this.pen([a, b], ww, { over: 0, wob: 0.35 });
    const ox = () => rng.uniform(4, 12);
    p([x0 - ox(), y0 + rng.normal(0, 0.6)], [x1 + ox(), y0 + rng.normal(0, 0.8)]);
    p([x0 + rng.uniform(2, 30), y0 + 2.2 + rng.normal(0, 0.5)], [x1 - rng.uniform(20, 80), y0 + rng.uniform(0.6, 3.2)], w * 0.85);
    p([x1 + rng.normal(0, 0.6), y0 - ox()], [x1 + rng.normal(0, 1), y1 + ox()]);
    if (y1 - y0 > 200) p([x1 - 2, y0 + rng.uniform(40, 120)], [x1 - 2.6 + rng.normal(0, 0.6), y1 - rng.uniform(80, Math.min(200, y1 - y0 - 130))], w * 0.7);
    p([x0 + rng.normal(0, 0.6), y0 - ox()], [x0 + rng.normal(0, 1), y1 + ox()]);
    const xe = x0 + rng.uniform(16, 40);
    p([x1 + ox(), y1 + rng.normal(0, 0.6)], [xe, y1 + rng.normal(0, 0.8)]);
    p([xe, y1 - 4], [xe + rng.normal(0, 0.6), y1 + 5], w * 0.8);
    for (const [cx, cy] of [[x0, y0], [x1, y0], [x1, y1]])
      if (rng() < 0.7) p([cx + rng.normal(0, 1), cy - rng.uniform(3, 8)], [cx + rng.normal(0, 1), cy + rng.uniform(3, 8)], w * 0.8);
  }

  underline(x0, x1, y, w = 0.7, double = false) {
    const r = this.rng;
    this.pen([[x0 - r.uniform(1, 4), y + r.normal(0, 0.5)], [x1 + r.uniform(2, 10), y + r.normal(0, 1)]], w, { over: 0, wob: 0.3 });
    if (double) this.pen([[x0 + r.uniform(4, 12), y + 3 + r.normal(0, 0.4)], [x1 - r.uniform(0, 8), y + 2.2 + r.normal(0, 0.8)]], w * 0.75, { over: 0, wob: 0.3 });
  }

  rule(x0, x1, y, w = 0.32) { this.pen([[x0, y], [x1, y + this.rng.normal(0, 0.3)]], w, { over: 0.6, wob: 0.15 }); }

  brace(x, y0, y1, w = 0.65) {
    const m = (y0 + y1) / 2;
    this.pen(curve([[x + 3, y0], [x, y0 + 2], [x, m - 3], [x - 3, m], [x, m + 3], [x, y1 - 2], [x + 3, y1]], 10), w, { over: 0, wob: 0.1 });
  }

  arrow(p, q, w = 0.55, head = 4.5) {
    const r = this.rng;
    const mid = [(p[0] + q[0]) / 2 - (q[1] - p[1]) * r.normal(0, 0.06), (p[1] + q[1]) / 2 + (q[0] - p[0]) * r.normal(0, 0.06)];
    this.pen(curve([p, mid, q], 16), w, { over: 0, wob: 0.2 });
    const a0 = Math.atan2(q[1] - p[1], q[0] - p[0]);
    for (const s of [1, -1]) {
      const a = a0 + Math.PI + s * (28 + r.normal(0, 4)) * Math.PI / 180;
      this.pen([q, [q[0] + head * Math.cos(a), q[1] + head * Math.sin(a)]], w, { over: 0, wob: 0.05 });
    }
  }

  tick(x, y, w = 0.7) { this.pen([[x, y], [x + 6, y + 5], [x + 19, y - 2]], w, { over: 0, wob: 0.1 }); }

  strike(x0, x1, y, w = 0.55) { this.pen([[x0, y], [x1, y - 0.6]], w, { over: 0.5, wob: 0.1 }); }

  // 排线：只在暗处，方向大致一致、长短不一、偶有留白
  hatch(poly, { angle = 74, gap = 1.35, w = 0.42, dens = 1, seg = [60, 120], skip = [0.5, 1.5] } = {}) {
    const r = this.rng, a = angle * Math.PI / 180;
    const u = [Math.cos(a), Math.sin(a)], nn = [-u[1], u[0]];
    const pu = poly.map((p) => p[0] * u[0] + p[1] * u[1]), pn = poly.map((p) => p[0] * nn[0] + p[1] * nn[1]);
    const at = (s, t) => [u[0] * s + nn[0] * t, u[1] * s + nn[1] * t];
    const N = poly.length;
    for (let t = Math.min(...pn) + r.uniform(0, gap); t < Math.max(...pn); t += gap * r.uniform(0.75, 1.3)) {
      // 这条线和多边形各边的交点，两两一段
      const xs = [];
      for (let i = 0, j = N - 1; i < N; j = i++) {
        if ((pn[i] > t) !== (pn[j] > t)) xs.push(pu[i] + (t - pn[i]) / (pn[j] - pn[i]) * (pu[j] - pu[i]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const s0 = xs[k], s1 = xs[k + 1];
        if (s1 - s0 < 2) continue;
        let cur = s0 + r.uniform(0, 3);
        while (cur < s1 - 2) {
          const e = Math.min(s1 - r.uniform(0, 2), cur + r.uniform(...seg));
          if (r() < dens) {
            const p0 = at(cur, t + r.normal(0, 0.4)), p1 = at(e, t + r.normal(0, 0.6));
            this.pen([p0, [p1[0] + r.normal(0, 0.5), p1[1] + r.normal(0, 0.5)]], w * r.uniform(0.8, 1.2), { over: 0, wob: 0.05 });
          }
          cur = e + r.uniform(...skip);
        }
      }
    }
  }

  // 纸纤维把墨吃掉一点
  finish() {
    if (!GRAIN) return this;
    const ctx = this.ctx;
    const pat = ctx.createPattern(GRAIN, "repeat");
    const m = new DOMMatrix();
    pat.setTransform(m.scale(1 / 3, 1 / 3));
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
    return this;
  }
}

// 给一个已经在页面上的 <canvas>，按它的 CSS 尺寸起一张纸
export function sheetFor(canvas, seed) {
  const r = canvas.getBoundingClientRect();
  return new Sheet(canvas, Math.max(1, r.width), Math.max(1, r.height), seed);
}
