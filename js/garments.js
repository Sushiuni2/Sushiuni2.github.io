// 衣服的平面款式图：一遍干净的轮廓，不复描、不加褶；排线只落在暗处（V 领里面、鞋跟）。
// 局部坐标约 240 x 290；每次画都带一点手画的歪斜和左右不对称（seed 定死，所以同一件永远同一张）。
import { curve } from "./ink.js";

function warp(OX, OY, SC, r) {
  const rot = r.normal(0, 1.2) * Math.PI / 180;
  const a1 = r.normal(0, 2.2), a2 = r.normal(0, 1.6), a3 = r.normal(0, 1.8), a4 = r.normal(0, 1.2);
  const f1 = r.uniform(0, 6.28), f2 = r.uniform(0, 6.28);
  const cx = 120, cy = 150;
  const L = (x, y) => {
    const dx = a1 * (y - cy) / 150 + a2 * Math.sin(y / 55 + f1) * (x - cx) / 120;
    const dy = a3 * (x - cx) / 120 * (y / 290) + a4 * Math.sin(x / 45 + f2);
    let X = x + dx - cx, Y = y + dy - cy;
    [X, Y] = [X * Math.cos(rot) - Y * Math.sin(rot), X * Math.sin(rot) + Y * Math.cos(rot)];
    return [OX + (X + cx) * SC, OY + (Y + cy) * SC];
  };
  return [L, (pts) => pts.map((p) => L(p[0], p[1]))];
}

function mk(sh, OX, OY, SC) {
  const [L, Lp] = warp(OX, OY, SC, sh.rng);
  const pen = (pts, w, o = {}) => sh.pen(Lp(pts), w, { wob: Math.min(o.wob ?? 0.25, 0.25), over: o.over ?? 1.2 });
  return { L, Lp, pen };
}

function ribs(sh, Lp, x0, x1, y0, y1, step, w) {
  const r = sh.rng;
  for (let x = x0 + r.uniform(0, 2); x < x1; x += step * r.uniform(0.8, 1.25))
    sh.pen(Lp([[x, y0 + r.uniform(0, 2)], [x + r.normal(0, 0.9), y1 - r.uniform(0, 2.5)]]), w, { over: 0, wob: 0.05 });
}

export function cardigan(sh, OX, OY, SC, p = {}) {
  const { w = 0.62, back = false, detail = true, buttons = 5, fit = "regular", length = "regular", neck = "v", sleeve = "long", pockets = false } = p;
  const { L, Lp, pen } = mk(sh, OX, OY, SC);
  const half = { slim: 54, regular: 58, boxy: 66 }[fit], shw = { slim: 80, regular: 82, boxy: 90 }[fit];
  const xl = 120 - half, xr = 120 + half, sl = 120 - shw, sr = 120 + shw;
  const hem = { cropped: 214, regular: 270, long: 306 }[length];
  const rib = length !== "long" ? 24 : 20;
  const cuff_y = sleeve === "long" ? 232 : 184, cuff_h = sleeve === "long" ? 19 : 15;
  const arm = fit !== "boxy" ? 104 : 112;
  pen(curve([[92, 20], [66, 28], [sl, 38]]), w);
  pen(curve([[sl, 38], [sl - 9, 92], [sl - 17, cuff_y - 70], [sl - 23, cuff_y]]), w);
  const cl0 = sl - 23, cl1 = sl + 6;
  pen(curve([[cl0, cuff_y], [cl0 + 2, cuff_y + cuff_h / 2], [cl0 + 3, cuff_y + cuff_h]]), w);
  pen([[cl0 + 3, cuff_y + cuff_h], [cl1, cuff_y + cuff_h - 0.5]], w);
  pen(curve([[cl1, cuff_y + cuff_h - 0.5], [cl1 + 1, cuff_y + cuff_h / 2], [cl1, cuff_y]]), w);
  pen([[cl0 - 1, cuff_y + 1], [cl1 + 0.5, cuff_y]], w * 0.8);
  pen(curve([[cl1, cuff_y], [cl1 + 6, (cuff_y + arm) / 2 + 10], [xl - 2, arm + 22], [xl, arm]]), w);
  pen(curve([[xl, arm], [xl + 1, (arm + hem) / 2], [xl + 1, hem - rib]]), w);
  pen(curve([[xl + 1, hem - rib], [xl + 3, hem - rib / 2], [xl + 5, hem]]), w);
  pen([[xl + 5, hem], [xr - 5, hem + 0.5]], w);
  pen([[xl, hem - rib + 0.5], [xr, hem - rib]], w * 0.8);
  pen(curve([[xr - 5, hem + 0.5], [xr - 3, hem - rib / 2], [xr - 1, hem - rib]]), w);
  pen(curve([[xr - 1, hem - rib], [xr + 0.5, (arm + hem) / 2], [xr, arm]]), w * 1.15);
  const cr0 = sr - 6, cr1 = sr + 23;
  pen(curve([[xr, arm], [xr + 4, arm + 24], [cr0 - 6, (cuff_y + arm) / 2 + 10], [cr0, cuff_y]]), w);
  pen(curve([[cr0, cuff_y], [cr0 - 1, cuff_y + cuff_h / 2], [cr0, cuff_y + cuff_h - 0.5]]), w);
  pen([[cr0, cuff_y + cuff_h - 0.5], [cr1 - 3, cuff_y + cuff_h]], w);
  pen(curve([[cr1 - 3, cuff_y + cuff_h], [cr1 - 2, cuff_y + cuff_h / 2], [cr1, cuff_y]]), w);
  pen([[cr0 - 0.5, cuff_y], [cr1 + 1, cuff_y + 1]], w * 0.8);
  pen(curve([[cr1, cuff_y], [sr + 17, cuff_y - 70], [sr + 9, 92], [sr, 38]]), w * 1.15);
  pen(curve([[sr, 38], [174, 28], [148, 20]]), w);
  pen(curve([[sl, 38], [sl + 12, 62], [xl - 4, 84], [xl, arm]]), w * 0.7);
  pen(curve([[sr, 38], [sr - 12, 62], [xr + 4, 84], [xr, arm]]), w * 0.7);
  const step = detail && !back ? 4.2 : 7;
  ribs(sh, Lp, xl + 5, xr - 4, hem - rib + 2.5, hem - 1, step, w * 0.5);
  ribs(sh, Lp, cl0 + 4, cl1, cuff_y + 2, cuff_y + cuff_h - 1.5, step, w * 0.5);
  ribs(sh, Lp, cr0 + 3, cr1 - 1, cuff_y + 2, cuff_y + cuff_h - 1.5, step, w * 0.5);
  if (back) {
    pen(curve([[92, 20], [106, 28], [120, 30], [134, 28], [148, 20]]), w);
    pen(curve([[96, 22], [120, 34], [144, 22]]), w * 0.6);
    return;
  }
  pen(curve([[92, 20], [106, 24], [120, 25], [134, 24], [148, 20]]), w * 0.7);
  let vb;
  if (neck === "v") {
    vb = 120;
    if (detail) for (let k = 0; k < 9; k++) { const a = 100 + k * 4.6; sh.pen(Lp([[a, 23 + (k % 2) * 0.4], [a + 3.5, 27]]), w * 0.5, { over: 0, wob: 0.05 }); }
    pen(curve([[92, 20], [104, 62], [116, 104], [120, vb]]), w);
    pen(curve([[148, 20], [136, 62], [124, 104], [120, vb]]), w);
    pen(curve([[99, 21], [110, 60], [120, vb - 20]]), w * 0.55);
    pen(curve([[141, 21], [130, 60], [120, vb - 20]]), w * 0.55);
    sh.shade.neck = Lp([...curve([[93, 21], [106, 25], [120, 26], [134, 25], [147, 21]], 12),
      ...curve([[147, 21], [135, 62], [123.5, 104], [120, 118]], 12).slice(1),
      ...curve([[120, 118], [116.5, 104], [105, 62], [93, 21]], 12).slice(1)]);
  } else {
    vb = 44;
    pen(curve([[92, 20], [104, 38], [120, vb], [136, 38], [148, 20]]), w);
    pen(curve([[98, 22], [108, 33], [120, vb - 7], [132, 33], [142, 22]]), w * 0.55);
  }
  pen([[120, vb], [120, hem + 1]], w, { over: 0 });
  pen([[128, vb - 8], [128, hem]], w * 0.55, { over: 0 });
  if (pockets) {
    for (const [x0, x1] of [[xl + 10, xl + 44], [xr - 46, xr - 12]]) {
      const py0 = hem - rib - 52;
      pen([[x0, py0], [x0 + 0.5, py0 + 40]], w * 0.8);
      pen([[x0 + 0.5, py0 + 40], [x1, py0 + 40.5]], w * 0.8);
      pen([[x1, py0 + 40.5], [x1 - 0.5, py0]], w * 0.8);
      pen([[x0 - 1, py0], [x1 + 1, py0 + 0.5]], w * 0.7);
      ribs(sh, Lp, x0 + 2, x1 - 2, py0 + 1, py0 + 7, 4.4, w * 0.4);
    }
  }
  const n = +buttons || 0;
  for (let i = 0; i < n; i++) {
    const y0 = vb + 14, y1 = hem - rib - 6;
    const [cx, cy] = L(124, y0 + (y1 - y0) * i / Math.max(n - 1, 1));
    sh.circle(cx, cy, 3.1 * SC, w * 0.9);
  }
}
cardigan.box = (p = {}) => {
  const shw = { slim: 80, regular: 82, boxy: 90 }[p.fit || "regular"];
  const hem = { cropped: 214, regular: 270, long: 306 }[p.length || "regular"];
  return [120 - shw - 25, 18, 120 + shw + 25, hem + 2];
};

export function tee(sh, OX, OY, SC, p = {}) {
  const { w = 0.62, detail = true } = p;
  const { Lp, pen } = mk(sh, OX, OY, SC);
  pen(curve([[94, 24], [106, 36], [120, 39], [134, 36], [146, 24]]), w);
  pen(curve([[99, 25], [110, 43], [120, 46], [130, 43], [141, 25]]), w * 0.6);
  pen(curve([[94, 24], [72, 30], [50, 38]]), w);
  pen(curve([[50, 38], [34, 60], [20, 88]]), w);
  pen([[20, 88], [46, 104]], w);
  pen(curve([[46, 104], [54, 92], [62, 86]]), w);
  pen(curve([[62, 86], [63, 160], [64, 236]]), w);
  pen([[64, 236], [176, 237]], w);
  pen(curve([[176, 237], [177, 160], [178, 86]]), w * 1.15);
  pen(curve([[178, 86], [186, 92], [194, 104]]), w);
  pen([[194, 104], [220, 88]], w);
  pen(curve([[220, 88], [206, 60], [190, 38]]), w * 1.15);
  pen(curve([[190, 38], [168, 30], [146, 24]]), w);
  pen(curve([[50, 38], [57, 62], [62, 86]]), w * 0.6);
  pen(curve([[190, 38], [183, 62], [178, 86]]), w * 0.6);
  if (detail) {
    sh.pen(Lp([[66, 229.5], [174, 230]]), w * 0.45, { over: 0 });
    sh.pen(Lp([[25, 82.5], [47, 96]]), w * 0.45, { over: 0 });
    sh.pen(Lp([[215, 82.5], [193, 96]]), w * 0.45, { over: 0 });
  }
}
tee.box = () => [18, 22, 222, 239];

export function trousers(sh, OX, OY, SC, p = {}) {
  const { w = 0.62, detail = true } = p;
  const { Lp, pen } = mk(sh, OX, OY, SC);
  pen([[66, 14], [174, 14.5]], w);
  pen([[66, 26], [174, 26]], w * 0.8);
  pen(curve([[66, 14], [64, 80], [61, 180], [58, 284]]), w);
  pen([[58, 284], [114, 284.5]], w);
  pen(curve([[114, 284.5], [116, 180], [119, 104]]), w);
  pen(curve([[119, 104], [120, 98], [121, 104]]), w * 0.8);
  pen(curve([[121, 104], [124, 180], [126, 284.5]]), w);
  pen([[126, 284.5], [182, 284]], w * 1.1);
  pen(curve([[182, 284], [179, 180], [176, 80], [174, 14.5]]), w * 1.15);
  pen(curve([[120, 26], [121, 60], [126, 84], [120, 92]]), w * 0.6);
  if (detail) {
    pen(curve([[70, 28], [80, 44], [86, 62]]), w * 0.55);
    pen(curve([[170, 28], [160, 44], [154, 62]]), w * 0.55);
    for (const x of [78, 120, 162]) {
      sh.pen(Lp([[x - 2, 13], [x - 2, 27]]), w * 0.5, { over: 0 });
      sh.pen(Lp([[x + 2, 13], [x + 2, 27]]), w * 0.5, { over: 0 });
    }
    sh.pen(Lp([[88, 34], [86, 280]]), w * 0.35, { over: 0, wob: 0.2 });
    sh.pen(Lp([[152, 34], [154, 280]]), w * 0.35, { over: 0, wob: 0.2 });
  }
}
trousers.box = () => [56, 12, 184, 286];

export function shirt(sh, OX, OY, SC, p = {}) {
  const { w = 0.62, detail = true } = p;
  const { L, pen } = mk(sh, OX, OY, SC);
  pen(curve([[96, 22], [108, 18], [120, 17], [132, 18], [144, 22]]), w * 0.8);
  pen([[96, 22], [102, 46]], w); pen([[102, 46], [120, 36]], w);
  pen([[144, 22], [138, 46]], w); pen([[138, 46], [120, 36]], w);
  pen(curve([[96, 22], [70, 30], [44, 38]]), w);
  pen(curve([[44, 38], [32, 100], [24, 170], [20, 226]]), w);
  pen([[20, 226], [22, 246], [44, 246], [44, 226]], w);
  pen(curve([[44, 226], [50, 170], [58, 124], [62, 100]]), w);
  pen(curve([[62, 100], [63, 180], [64, 252]]), w);
  pen(curve([[64, 252], [90, 266], [120, 270], [150, 266], [176, 252]]), w);
  pen(curve([[176, 252], [177, 180], [178, 100]]), w * 1.15);
  pen(curve([[178, 100], [182, 124], [190, 170], [196, 226]]), w);
  pen([[196, 226], [196, 246], [218, 246], [220, 226]], w);
  pen(curve([[220, 226], [216, 170], [208, 100], [196, 38]]), w * 1.15);
  pen(curve([[196, 38], [170, 30], [144, 22]]), w);
  pen(curve([[44, 38], [54, 64], [59, 84], [62, 100]]), w * 0.6);
  pen(curve([[196, 38], [186, 64], [181, 84], [178, 100]]), w * 0.6);
  pen([[120, 40], [120, 268]], w * 0.8, { over: 0 });
  pen([[126, 40], [126, 266]], w * 0.5, { over: 0 });
  if (detail) {
    for (const by of [58, 92, 126, 160, 194, 228]) { const [cx, cy] = L(123, by); sh.circle(cx, cy, 2.0 * SC, w * 0.8); }
    pen([[44, 232], [20.5, 232]], w * 0.45, { over: 0 });
    pen([[196, 232], [219.5, 232]], w * 0.45, { over: 0 });
    pen(curve([[70, 56], [120, 60], [170, 56]]), w * 0.4);
  }
}
shirt.box = () => [18, 15, 222, 272];

export function jacket(sh, OX, OY, SC, p = {}) {
  const { w = 0.62, detail = true } = p;
  const { L, Lp, pen } = mk(sh, OX, OY, SC);
  pen([[92, 20], [100, 50]], w); pen([[100, 50], [120, 40]], w);
  pen([[148, 20], [140, 50]], w); pen([[140, 50], [120, 40]], w);
  pen(curve([[92, 20], [106, 15], [120, 14], [134, 15], [148, 20]]), w * 0.8);
  pen(curve([[92, 20], [66, 28], [34, 40]]), w);
  pen(curve([[34, 40], [24, 110], [16, 180], [12, 236]]), w);
  pen([[12, 236], [14, 252], [46, 252], [46, 236]], w);
  pen(curve([[46, 236], [52, 170], [58, 120], [60, 104]]), w);
  pen(curve([[60, 104], [60, 180], [58, 262]]), w);
  pen([[58, 262], [182, 262.5]], w);
  pen([[58, 250], [182, 250]], w * 0.6);
  pen(curve([[182, 262.5], [180, 180], [180, 104]]), w * 1.15);
  pen(curve([[180, 104], [186, 120], [192, 170], [194, 236]]), w);
  pen([[194, 236], [194, 252], [226, 252], [228, 236]], w);
  pen(curve([[228, 236], [224, 180], [216, 110], [206, 40]]), w * 1.15);
  pen(curve([[206, 40], [174, 28], [148, 20]]), w);
  pen(curve([[34, 40], [48, 70], [56, 88], [60, 104]]), w * 0.6);
  pen(curve([[206, 40], [192, 70], [184, 88], [180, 104]]), w * 0.6);
  pen([[120, 42], [120, 262]], w * 0.85, { over: 0 });
  if (detail) {
    for (const [x0, x1] of [[72, 108], [132, 168]]) {
      sh.rect(...L(x0, 82), ...L(x1, 120), w * 0.7, 0.5);
      sh.pen(Lp([[x0, 90], [x1, 90]]), w * 0.45, { over: 0 });
    }
    for (const [x0, x1] of [[68, 110], [130, 172]]) sh.rect(...L(x0, 168), ...L(x1, 222), w * 0.7, 0.5);
    for (const by of [66, 110, 154, 198, 240]) { const [cx, cy] = L(124, by); sh.circle(cx, cy, 2.4 * SC, w * 0.8); }
  }
}
jacket.box = () => [10, 12, 230, 264];

export function derby(sh, OX, OY, SC, p = {}) {
  const { w = 0.62, detail = true } = p;
  const { L, Lp, pen } = mk(sh, OX, OY, SC);
  pen(curve([[40, 204], [120, 205], [200, 204], [230, 202], [240, 198]]), w * 0.75);
  pen(curve([[92, 211], [160, 212], [218, 210.5], [236, 207], [241, 199]]), w * 1.15);
  pen([[40, 204], [40, 219]], w); pen([[40, 219], [84, 219.5]], w * 1.1);
  pen(curve([[84, 219.5], [86, 214], [92, 211]]), w);
  pen(curve([[40, 204], [35, 178], [36, 152], [46, 134]]), w);
  pen(curve([[46, 134], [74, 140], [100, 147]]), w);
  pen(curve([[100, 147], [112, 154], [124, 164], [128, 172]]), w);
  pen(curve([[128, 172], [124, 188], [120, 204]]), w * 0.8);
  pen(curve([[102, 144], [106, 132], [114, 128], [120, 136], [126, 160]]), w * 0.7);
  pen(curve([[126, 160], [160, 166], [194, 172], [220, 177], [235, 184], [242, 194], [240, 199]]), w);
  if (detail) {
    pen(curve([[45, 140], [43, 172], [48, 202]]), w * 0.45);
    for (const [ex, ey] of [[106, 156], [112, 160], [118, 164], [124, 168]]) { const [cx, cy] = L(ex, ey); sh.circle(cx, cy, 1.3 * SC, w * 0.5); }
    pen(curve([[110, 156], [104, 146], [110, 142], [114, 152]]), w * 0.5);
    pen(curve([[114, 152], [122, 144], [126, 150], [116, 156]]), w * 0.5);
    pen(curve([[114, 154], [108, 166], [104, 174]]), w * 0.4);
    pen(curve([[200, 182], [214, 186], [226, 190]]), w * 0.35);
  }
  sh.shade.heel = Lp([[41, 205], [83, 205.5], [84, 218.5], [41, 218]]);
}
derby.box = () => [33, 126, 244, 222];

// 饰品：一条细链子，扣头在下面
export function chain(sh, OX, OY, SC, p = {}) {
  const { w = 0.62 } = p;
  const { L, pen } = mk(sh, OX, OY, SC);
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * (0.08 + 0.84 * i / 40);
    pts.push([120 + 78 * Math.cos(a), 70 + 120 * Math.sin(a)]);
  }
  pen(pts, w * 0.8, { over: 0 });
  for (let i = 1; i < 40; i += 2) {
    const [x, y] = L(...pts[i]);
    sh.circle(x, y, 1.6 * SC, w * 0.45, 1.0 * SC);
  }
  pen(curve([[48, 92], [46, 60], [70, 34]]), w * 0.6);
  pen(curve([[192, 92], [194, 60], [170, 34]]), w * 0.6);
  const [cx, cy] = L(120, 194);
  sh.circle(cx, cy + 4 * SC, 4 * SC, w * 0.8);
}
chain.box = () => [36, 28, 204, 206];

export const DRAW = { cardigan, tee, shirt, jacket, trousers, derby, chain };

// 画进一个框里：box = [x, y, w, h]，align 底对齐（鞋子）或居中
export function drawInBox(sh, kind, params, [bx, by, bw, bh], { w = 0.62, hatchNeck = true } = {}) {
  const f = DRAW[kind];
  if (!f) return;
  const [x0, y0, x1, y1] = f.box(params);
  const SC = Math.min(bw / (x1 - x0), bh / (y1 - y0));
  const OX = bx + (bw - (x1 - x0) * SC) / 2 - x0 * SC;
  const OY = by + (bh - (y1 - y0) * SC) / 2 - y0 * SC;
  sh.shade = {};
  f(sh, OX, OY, SC, { ...params, w });
  if (hatchNeck && sh.shade.neck) sh.hatch(sh.shade.neck, { angle: 74, gap: Math.max(1.0, 1.35 * Math.sqrt(SC)), w: Math.max(0.26, 0.42 * Math.sqrt(SC)), seg: [40 * SC + 10, 120 * SC], skip: [0.5, 1.5] });
  if (hatchNeck && sh.shade.heel) sh.hatch(sh.shade.heel, { angle: 62, gap: 1.2, w: 0.3, seg: [20, 40], skip: [0.5, 1.2] });
  return SC;
}

// Stockman 人台（身体页）
export function stockman(sh, X, Y, S) {
  const P = (pts) => pts.map(([x, y]) => [X + x * S, Y + y * S]);
  const pen = (pts, w = 0.8, o = {}) => sh.pen(P(pts), w, { wob: 0.2, ...o });
  pen(curve([[-13, 2], [0, -1], [13, 2]]), 0.7); pen(curve([[-13, 2], [0, 5], [13, 2]]), 0.7);
  pen([[-13, 2], [-14, 24]]); pen([[13, 2], [14, 24]]);
  for (const s of [-1, 1]) {
    pen(curve([[s * 14, 24], [s * 34, 32], [s * 52, 42]]));
    pen(curve([[s * 52, 42], [s * 53.5, 57], [s * 50, 72]]), 0.8);
    pen(curve([[s * 50, 72], [s * 53, 104], [s * 44, 150], [s * 41, 168], [s * 49, 210], [s * 52, 236]]));
    pen(curve([[s * 30, 34], [s * 26, 100], [s * 24, 168], [s * 28, 236]]), 0.36, { over: 0 });
  }
  pen(curve([[-52, 236], [0, 243], [52, 236]]));
  pen(curve([[-52, 236], [0, 229], [52, 236]]), 0.5);
  pen([[0, 6], [0.5, 240]], 0.42, { over: 0 });
  pen(curve([[-42, 168], [0, 172], [42, 168]]), 0.42, { over: 0 });
  pen([[-1.5, 243], [-1.5, 320]], 1.1, { over: 0 }); pen([[1.5, 243], [1.5, 320]], 0.6, { over: 0 });
  for (const dx of [-46, 0, 44]) pen(curve([[0, 320], [dx * 0.6, 332 + (dx === 0 ? 8 : 0)], [dx, 340 + (dx === 0 ? 10 : 0)]]), 0.8);
  return { head: [X + 13 * S, Y + 2 * S], shoulder: [X + 52 * S, Y + 42 * S], waist: [X + 44 * S, Y + 150 * S], hip: [X + 50 * S, Y + 215 * S] };
}
