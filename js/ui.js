// 页面上的「实物」和字：打字、布标、布带、面料小样、冲印照片、笔画的墨（canvas）。
import { Sheet, makeRng, hash } from "./ink.js";
import { drawInBox } from "./garments.js";
import { photoURL } from "./db.js";
import * as nav from "./nav.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 打字：每个字的墨浓淡、高低都不一样（同样的字永远同样）
export function ty(text, seed = "") {
  // 墨的浓淡由整行共用的一张墨纹给（background-clip:text），每个字只有一点高低；中文比字母小一点
  const r = makeRng(hash(String(text) + "|" + seed));
  let out = "";
  for (const ch of String(text ?? "")) {
    if (ch === "\n") { out += "<br>"; continue; }
    if (ch === " ") { out += " "; continue; }
    const y = r.normal(0, 0.22).toFixed(2);
    out += ch.codePointAt(0) >= 0x2e80 ? `<i class="c" style="vertical-align:${-y}px">${esc(ch)}</i>` : `<i style="vertical-align:${-y}px">${esc(ch)}</i>`;
  }
  return out;
}
export const T = (text, cls = "", seed = "") => { const r = makeRng(hash("bg" + text + seed)); return `<span class="ty ${cls}" style="background-position:${r.int(0, 128)}px ${r.int(0, 128)}px">${ty(text, seed)}</span>`; };

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------------------------------------------------------------- 墨：在一个容器上叠一层 canvas
// draw(sh, box)：box(el) 给出元素相对容器的位置（CSS px）
const INKCACHE = new Map();
function cachePut(k, v) { INKCACHE.set(k, v); if (INKCACHE.size > 160) INKCACHE.delete(INKCACHE.keys().next().value); }

export function ink(container, seed, draw, bleed = 14, cacheKey = null) {
  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  let c = container.querySelector(":scope > canvas.ink");
  if (!c) {
    c = document.createElement("canvas");
    c.className = "ink";
    c.style.inset = `-${bleed}px`;
    container.prepend(c);
  }
  const run = () => {
    const R = container.getBoundingClientRect();
    if (R.width < 1) return;
    const key = cacheKey && `${cacheKey}|${Math.round(R.width)}x${Math.round(R.height)}`;
    if (key && INKCACHE.has(key)) {
      const bmp = INKCACHE.get(key);
      c.width = bmp.width; c.height = bmp.height;
      c.style.width = R.width + 2 * bleed + "px"; c.style.height = R.height + 2 * bleed + "px";
      const x = c.getContext("2d"); x.clearRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0);
      return;
    }
    const sh = new Sheet(c, R.width + 2 * bleed, R.height + 2 * bleed, seed);
    sh.ctx.translate(bleed, bleed);
    const box = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left - R.left, y: b.top - R.top, w: b.width, h: b.height, r: b.right - R.left, b: b.bottom - R.top, cx: b.left - R.left + b.width / 2, cy: b.top - R.top + b.height / 2 };
    };
    draw(sh, box, R.width, R.height);
    sh.ctx.setTransform(sh.D, 0, 0, sh.D, 0, 0);
    sh.finish();
    if (key) { const cp = document.createElement("canvas"); cp.width = c.width; cp.height = c.height; cp.getContext("2d").drawImage(c, 0, 0); cachePut(key, cp); }
  };
  if (container.isConnected && container.getBoundingClientRect().width > 0) run();
  else requestAnimationFrame(run);
  return run;
}

// 一件衣服的小稿，画进一个固定尺寸的框
// dims = { w: "44", h: "64" }：在稿子上面拉一道量宽度的线、左边一道量长度的线，数字打字
export function sketch(el, item, { w = 0.62, pad = 6, dims = null, params = null, seed = "" } = {}) {
  el.querySelectorAll(".dimnum").forEach((d) => d.remove());
  ink(el, "sk" + item.id + seed, (sh, box, W, H) => {
    const p = params || item.params || {};
    const g = drawInBox(sh, item.kind, p, [pad, pad + (dims ? 18 : 0), W - 2 * pad - (dims ? 18 : 0), H - 2 * pad - (dims ? 18 : 0)], { w });
    if (!dims || !g) return;
    const inset = (g.x1 - g.x0) * 0.12;
    const tick = (a, b) => sh.pen([a, b], 0.5, { over: 0, wob: 0.1 });
    if (dims.w) {
      const y = g.y0 - 10, xa = g.x0 + inset, xb = g.x1 - inset;
      sh.pen([[xa, y], [xb, y]], 0.5, { over: 0, wob: 0.15 }); tick([xa, y - 3], [xa, y + 3]); tick([xb, y - 3], [xb, y + 3]);
      el.append(h(`<span class="dimnum" style="left:${(xa + xb) / 2 - 7}px;top:${y - 15}px">${T(dims.w, "m")}</span>`));
    }
    if (dims.h) {
      const x = Math.max(4, g.x0 - 10), ya = g.y0, yb = g.y1;
      sh.pen([[x, ya], [x, yb]], 0.5, { over: 0, wob: 0.15 }); tick([x - 3, ya], [x + 3, ya]); tick([x - 3, yb], [x + 3, yb]);
      el.append(h(`<span class="dimnum" style="left:${x + 4}px;top:${(ya + yb) / 2 - 6}px">${T(dims.h, "m")}</span>`));
    }
  }, 4, dims ? null : "sk" + item.id + seed + JSON.stringify(params || item.params || {}) + item.kind + w + pad);
}

// ---------------------------------------------------------------- 实物
export const rgb = (c) => `rgb(${(c || [128, 128, 128]).join(",")})`;
const FAB = { knit: "knit", linen: "linen", poplin: "poplin", jersey: "jersey" };

export function swatch(color, fabric = "knit", { w = 30, h = 20, stitches = false, seed = "", hair = null } = {}) {
  const r = makeRng(hash("sw" + seed + color));
  const rot = r.normal(0, 2.2).toFixed(2);
  const P = 4;
  return `<span class="sw" style="width:${w}px;height:${h}px;--rot:${rot}deg"><canvas class="swc" data-c="${(color || [128, 128, 128]).join(",")}" data-fab="${FAB[fabric] || "knit"}" data-w="${w}" data-h="${h}" data-st="${stitches ? 1 : 0}" data-hair="${hair ?? (stitches ? 1 : 0.25)}" data-seed="${esc(seed + "|" + color)}" style="left:-${P}px;top:-${P}px;width:${w + 2 * P}px;height:${h + 2 * P}px"></canvas></span>`;
}

export function tape(text, { dark = false, act = "", seed = 0, rot = 0 } = {}) {
  return `<button class="tape ${dark ? "dark" : "light"}" data-act="${act}" style="--rot:${rot}deg;background-image:url(assets/tape_${dark ? "dark" : "light"}_${seed % 3}.png)">${T(text, dark ? "light" : "", "tp")}</button>`;
}

export function tapes(a, b) {
  return `<div class="tapes">${a}${b}</div>`;
}

export function label(rows, cls = "") {
  return `<div class="label ${cls}">${rows.map((r) => r == null ? '<div class="gap"></div>' : `<div class="row">${typeof r === "string" && !r.startsWith("<") ? T(r) : r}</div>`).join("")}</div>`;
}

export async function printPhoto(el, photoId, seed = "") {
  const u = await photoURL(photoId);
  if (!u) return false;
  const r = makeRng(hash("ph" + seed));
  el.innerHTML = `<span class="print" style="--rot:${r.normal(0, 1.4).toFixed(2)}deg"><img src="${u}" alt=""></span>`;
  return true;
}

// 照片优先，没有照片就画稿
export async function figure(el, item, opts = {}) {
  if (item.photo && await printPhoto(el, item.photo, item.id)) return "photo";
  el.innerHTML = "";
  sketch(el, item, opts);
  return "sketch";
}

export function toast(text) {
  const t = h(`<div class="toast">${T(text)}</div>`);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add("on"));
  setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 500); }, 1800);
}

export function confirmSheet(text, yes = "确定", no = "算了") {
  return new Promise((res) => {
    const m = h(`<div class="modal"><div class="label sheetlabel"><div class="row">${T(text)}</div><div class="choices"><button data-v="0">${T(no)}</button><button data-v="1">${T(yes, "b")}</button></div></div></div>`);
    document.body.append(m);
    m.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b && e.target !== m) return;
      m.remove();
      res(b ? b.dataset.v === "1" : false);
    });
  });
}

// ---------------------------------------------------------------- 时间
export const pad2 = (n) => String(n).padStart(2, "0");
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
export const md = (iso) => iso ? iso.slice(5, 10).replace("-", ".") : "";
export const ymd = (iso) => iso ? iso.slice(0, 10).replaceAll("-", ".") : "";
export function season(iso) {
  const d = iso ? new Date(iso) : new Date();
  const m = d.getMonth() + 1;
  const s = m >= 3 && m <= 5 ? "春" : m >= 6 && m <= 8 ? "夏" : m >= 9 && m <= 11 ? "秋" : "冬";
  const y = m <= 2 && s === "冬" ? d.getFullYear() - 1 : d.getFullYear();
  return `${s} '${String(y).slice(2)}`;
}
export const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);

// ---------------------------------------------------------------- 跳转
// go(hash)：往里走一层；go(hash, "up")：退回去；"replace"：原地换；"refresh"：重画这一页；"reset"：回到根（可带一串路径）
export function go(hash, how = "push") {
  if (how === "up") return nav.up(hash);
  if (how === "replace") return nav.replace(hash);
  if (how === "refresh") return nav.refresh();
  if (how === "reset") return nav.reset(Array.isArray(hash) ? hash : [hash]);
  return nav.push(hash);
}

// 固定在屏幕下方的按钮：一块或两块布标（主按钮是黑布）。点了在页面上发一个 "act" 事件
export function actions(...btns) {
  const list = btns.filter(Boolean);
  const size = list.length === 1 ? "full" : "half";
  return `<div class="actions n${list.length}">${list.map(({ text, act, dark }) =>
    `<button class="btn ${dark ? "dark" : "light"}" data-act="${act}" style="background-image:url(assets/btn_${size}_${dark ? "dark" : "light"}.png)">${T(text, dark ? "light b" : "b", "btn")}</button>`).join("")}</div>`;
}
export const onAct = (el, map) => el.addEventListener("act", (e) => map[e.detail]?.());

// 页面骨架：头部（返回 / 标题 / 右边小字），返回箭头用笔画
export function page(inner, { detail = false } = {}) {
  return h(`<div class="page${detail ? " detail" : ""}">${inner}</div>`);
}
export function head({ title = "", sub = "", right = "", backTo = "", backText = "" } = {}) {
  const b = backTo ? `<a class="back" href="${backTo}" data-back><span class="arr" style="display:inline-block;width:8px;height:12px"></span>${T(backText, "hb b")}</a>` : "";
  return `<header class="head rel">${b}${title ? T(title, "xl b") : ""}${sub ? T(sub, "m") : ""}<span class="grow"></span>${right ? T(right, backTo ? "l" : "m") : ""}</header>`;
}
export function drawHead(el, extra) {
  const hd = el.querySelector(".head");
  if (!hd) return;
  ink(hd, "head" + location.hash, (sh, box) => {
    const a = hd.querySelector(".arr");
    if (a) { const b = box(a); sh.pen([[b.x + 7, b.cy - 5.5], [b.x + 1, b.cy], [b.x + 7, b.cy + 5.5]], 0.8, { over: 0, wob: 0.05 }); }
    extra?.(sh, box);
  });
}

// 按宽度断行不用管，交给浏览器；数字用 Courier，中文用系统黑体
export const num = (n) => pad2(n);
