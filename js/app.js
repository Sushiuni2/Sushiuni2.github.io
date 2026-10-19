// 路由 + 底部布标导航。页面在 pages/ 里，每页是一个 async 函数，返回 { el, after? }。
import { loadGrain } from "./ink.js";
import { ink, T, $, h, go } from "./ui.js";
import * as W from "./pages/wardrobe.js";
import * as I from "./pages/item.js";
import * as E from "./pages/edit.js";
import * as N from "./pages/notes.js";
import * as O from "./pages/outfits.js";
import * as Wi from "./pages/wish.js";
import * as R from "./pages/rules.js";
import * as B from "./pages/body.js";

const NAV = [["0", "记", "#/notes"], ["1", "衣柜", "#/"], ["2", "搭配", "#/outfits"], ["3", "想买", "#/wish"], ["4", "原则", "#/rules"], ["5", "身体", "#/body"]];

const ROUTES = [
  [/^\/?$/, W.wardrobe, 1],
  [/^\/item\/(\w+)$/, I.front],
  [/^\/item\/(\w+)\/back$/, I.back],
  [/^\/new$/, E.edit],
  [/^\/edit\/(\w+)$/, E.edit],
  [/^\/notes$/, N.notes, 0],
  [/^\/notes\/new$/, N.noteEdit],
  [/^\/note\/(\w+)$/, N.noteEdit],
  [/^\/outfits$/, O.outfits, 2],
  [/^\/outfits\/new$/, O.outfitEdit],
  [/^\/outfit\/(\w+)$/, O.outfitView],
  [/^\/outfit\/(\w+)\/edit$/, O.outfitEdit],
  [/^\/wish$/, Wi.wishes, 3],
  [/^\/wish\/new$/, Wi.wishEdit],
  [/^\/wish\/(\w+)$/, Wi.wishEdit],
  [/^\/rules$/, R.rules, 4],
  [/^\/rules\/edit$/, R.rulesEdit],
  [/^\/body$/, B.body, 5],
  [/^\/body\/edit$/, B.bodyEdit],
];

const view = $("#view");
const scrolls = new Map();
let navEl = null, current = "";

function buildNav() {
  navEl = h(`<nav class="nav">${NAV.map(([n, w, href]) => `<a href="${href}"><span class="n">${T(n, "b", "nav")}</span><span class="w">${T(w, "", "nav")}</span></a>`).join("")}</nav>`);
  document.body.append(navEl);
}

function setNav(cur) {
  if (cur == null) { navEl.classList.add("hide"); return; }
  navEl.classList.remove("hide");
  const a = navEl.querySelectorAll("a")[cur];
  ink(navEl, "nav" + cur, (sh, box) => {
    const b = box(a.querySelector(".n"));
    sh.circle(b.cx, b.cy, 9.5, 0.7, 9);
  }, 6);
}

async function route() {
  const raw = location.hash.slice(1) || "/";
  const [path, qs] = raw.split("?");
  const q = Object.fromEntries(new URLSearchParams(qs || ""));
  if (current) scrolls.set(current, window.scrollY);
  current = raw;
  for (const [re, fn, nav] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    try {
      const out = await fn(m.slice(1), q);
      if (current !== raw) return;              // 等的时候又跳走了
      view.replaceChildren(out.el);
      setNav(nav);
      window.scrollTo(0, scrolls.get(raw) || 0);
      out.after?.();
    } catch (e) {
      console.error(e);
      view.replaceChildren(h(`<div class="page">${T("出了点问题：" + e.message)}</div>`));
    }
    return;
  }
  location.hash = "#/";
}


async function start() {
  buildNav();
  await Promise.all([loadGrain("assets/grain.png"), document.fonts?.ready]);
  navigator.storage?.persist?.().catch(() => {});
  addEventListener("hashchange", route);
  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { scrolls.set(current, scrollY); route(); }, 250); });
  route();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
start();
