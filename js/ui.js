// 页面上的「实物」和字：打字、布标、布带、面料小样、冲印照片、笔画的墨（canvas）。
import { Sheet, makeRng, hash } from "./ink.js";
import { drawInBox } from "./garments.js";
import { photoURL } from "./db.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 打字：每个字的墨浓淡、高低都不一样（同样的字永远同样）
export function ty(text, seed = "") {
  const r = makeRng(hash(String(text) + "|" + seed));
  let out = "";
  for (const ch of String(text ?? "")) {
    if (ch === "\n") { out += "<br>"; continue; }
    if (ch === " ") { out += " "; continue; }
    const o = r.uniform(0.7, 1).toFixed(2), y = r.normal(0, 0.22).toFixed(2);
    const bx = Math.round(r() * 300), by = Math.round(r() * 300);
    out += `<i style="--o:${o};--y:${y}px;--bx:${bx}px;--by:${by}px">${esc(ch)}</i>`;
  }
  return out;
}
export const T = (text, cls = "", seed = "") => `<span class="ty ${cls}">${ty(text, seed)}</span>`;

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------------------------------------------------------------- 墨：在一个容器上叠一层 canvas
// draw(sh, box)：box(el) 给出元素相对容器的位置（CSS px）
export function ink(container, seed, draw, bleed = 14) {
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
    const sh = new Sheet(c, R.width + 2 * bleed, R.height + 2 * bleed, seed);
    sh.ctx.translate(bleed, bleed);
    const box = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left - R.left, y: b.top - R.top, w: b.width, h: b.height, r: b.right - R.left, b: b.bottom - R.top, cx: b.left - R.left + b.width / 2, cy: b.top - R.top + b.height / 2 };
    };
    draw(sh, box, R.width, R.height);
    sh.ctx.setTransform(sh.D, 0, 0, sh.D, 0, 0);
    sh.finish();
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
  return run;
}

// 一件衣服的小稿，画进一个固定尺寸的框
export function sketch(el, item, { w = 0.62, pad = 6 } = {}) {
  ink(el, "sk" + item.id, (sh, box, W, H) => {
    drawInBox(sh, item.kind, item.params || {}, [pad, pad, W - 2 * pad, H - 2 * pad], { w });
  }, 4);
}

// ---------------------------------------------------------------- 实物
export const rgb = (c) => `rgb(${(c || [128, 128, 128]).join(",")})`;
const FAB = { knit: "knit", linen: "linen", poplin: "poplin", jersey: "jersey" };

export function swatch(color, fabric = "knit", { w = 30, h = 20, stitches = false, seed = "" } = {}) {
  const r = makeRng(hash("sw" + seed + color));
  const rot = r.normal(0, 2.2).toFixed(2);
  const st = stitches ? [[7, 7, -42], [w - 7, 7, 42], [7, h - 7, 42], [w - 7, h - 7, -42]].map(([x, y, a]) =>
    `<b class="thread" style="left:${x}px;top:${y}px;transform:translate(-50%,-50%) rotate(${a + r.normal(0, 4)}deg)"></b>`).join("") : "";
  return `<span class="sw" style="width:${w}px;height:${h}px;--rot:${rot}deg"><span class="cloth fab-${FAB[fabric] || "knit"} fray-${r.int(0, 3)}" style="background-color:${rgb(color)}"></span>${st}</span>`;
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
  if (item.photo && await printPhoto(el, item.photo, item.id)) return;
  el.innerHTML = "";
  sketch(el, item, opts);
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
export const go = (hash) => { location.hash = hash; };
export const back = (fallback = "#/") => { if (history.state?.n || history.length > 2) history.back(); else go(fallback); };

// 页面骨架：头部（返回 / 标题 / 右边小字），返回箭头用笔画
export function page(inner, { detail = false } = {}) {
  return h(`<div class="page${detail ? " detail" : ""}">${inner}</div>`);
}
export function head({ title = "", sub = "", right = "", backTo = "", backText = "" } = {}) {
  const b = backTo ? `<a class="back" href="${backTo}" data-back><span class="arr" style="display:inline-block;width:8px;height:12px"></span>${T(backText, "l b")}</a>` : "";
  return `<header class="head rel">${b}${title ? T(title, "xl b") : ""}${sub ? T(sub, "m") : ""}<span class="grow"></span>${right ? T(right, "m") : ""}</header>`;
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
