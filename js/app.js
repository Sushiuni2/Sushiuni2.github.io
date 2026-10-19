// 路由 + 底部布标导航。页面在 pages/ 里，每页是一个 async 函数，返回 { el, after? }。
import { loadGrain } from "./ink.js";
import { watchSwatches } from "./cloth.js";
import { ink, T, $, h, drawButtons } from "./ui.js";
import * as nav from "./nav.js";
import * as W from "./pages/wardrobe.js";
import * as I from "./pages/item.js";
import * as E from "./pages/edit.js";
import * as N from "./pages/notes.js";
import * as O from "./pages/outfits.js";
import * as Wi from "./pages/wish.js";
import * as R from "./pages/rules.js";
import * as B from "./pages/body.js";

const NAV = [["0", "记", "#/notes"], ["1", "衣柜", "#/"], ["2", "搭配", "#/outfits"], ["3", "原则", "#/rules"], ["4", "身体", "#/body"]];

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
  [/^\/wish$/, async () => ({ redirect: "#/?c=想买" })],
  [/^\/wish\/new$/, Wi.wishEdit],
  [/^\/wish\/(\w+)$/, Wi.wishEdit],
  [/^\/rules$/, R.rules, 3],
  [/^\/rules\/edit$/, R.rulesEdit],
  [/^\/body$/, B.body, 4],
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

let actionsEl = null, fadeEl = null, seq = 0;

async function route(dir = "none") {
  const raw = (nav.current() || "#/").slice(1) || "/";
  const [path, qs] = raw.split("?");
  const q = Object.fromEntries(new URLSearchParams(qs || ""));
  if (current) scrolls.set(current, window.scrollY);
  const prevKey = current;
  current = raw;
  const my = ++seq;
  for (const [re, fn, navIdx] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    try {
      const out = await fn(m.slice(1), q);
      if (my !== seq) return;                      // 等的时候又跳走了
      if (out.redirect) { nav.replace(out.redirect); return; }
      out.el.style.opacity = "0";
      // 按钮固定在屏幕下方：从页面里拿出来，放进固定的一层
      const act = out.el.querySelector(":scope > .actions");
      actionsEl.replaceChildren();
      actionsEl.className = "actionbar" + (navIdx != null ? " above-nav" : "");
      out.el.classList.toggle("has-actions", !!act);
      out.el.classList.toggle("has-nav", navIdx != null);
      fadeEl.className = "bottomfade" + (navIdx != null && act ? "" : navIdx != null || act ? " short" : " none");
      view.replaceChildren(out.el);
      setNav(navIdx);
      window.scrollTo(0, dir === "back" || dir === "none" ? (scrolls.get(raw) ?? (prevKey === raw ? scrollY : 0)) : 0);
      out.after?.();
      out.el.style.opacity = "";
      out.el.classList.add("enter-" + dir);
      if (act) { actionsEl.append(act); drawButtons(act); act.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b) out.el.dispatchEvent(new CustomEvent("act", { detail: b.dataset.act })); }); }
    } catch (e) {
      console.error(e);
      view.replaceChildren(h(`<div class="page">${T("出了点问题：" + e.message)}</div>`));
    }
    return;
  }
  nav.replace("#/");
}

// 页面里的链接：底部六页 = 回到根；带 data-back = 往外退一层；带 data-replace = 原地换；其余 = 往里走
function links(e) {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented) return;
  e.preventDefault();
  const href = a.getAttribute("href");
  if (a.closest(".nav")) { if (nav.depth() === 0 && nav.current().split("?")[0] === href) { window.scrollTo({ top: 0, behavior: "smooth" }); return; } nav.reset([href]); }
  else if (a.hasAttribute("data-back")) nav.up(href);
  else if (a.hasAttribute("data-replace")) nav.replace(href);
  else nav.push(href);
}

// 不许缩放：双指缩放、双击放大都拦下
function noZoom() {
  for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let last = 0;
  document.addEventListener("touchend", (e) => { const t = Date.now(); if (t - last < 320 && !e.target.closest("input,textarea,select")) e.preventDefault(); last = t; }, { passive: false });
}

// 更新：新版本整版下载好以后，让它接管，然后重新打开一次（只在原来已经有旧版本时）
function updates() {
  if (!("serviceWorker" in navigator) || !(location.protocol === "https:" || location.hostname === "localhost")) return;
  const had = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!had || reloading) return; reloading = true; sessionStorage.setItem("updated", "1"); location.reload(); });
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const ask = (w) => { if (w && navigator.serviceWorker.controller) w.postMessage("skip"); };
    if (reg.waiting) ask(reg.waiting);
    reg.addEventListener("updatefound", () => { const w = reg.installing; w?.addEventListener("statechange", () => { if (w.state === "installed") ask(w); }); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
  if (sessionStorage.getItem("updated")) { sessionStorage.removeItem("updated"); setTimeout(() => import("./ui.js").then((u) => u.toast("更新到新版本了")), 600); }
}

async function start() {
  buildNav();
  actionsEl = h(`<div class="actionbar"></div>`);
  fadeEl = h(`<div class="bottomfade none"></div>`);
  document.body.append(fadeEl, actionsEl);
  watchSwatches();
  noZoom();
  document.addEventListener("click", links);
  await Promise.all([loadGrain("assets/grain.png"), document.fonts?.ready]);
  navigator.storage?.persist?.().catch(() => {});
  let rt = 0, lastW = innerWidth;
  addEventListener("resize", () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rt); rt = setTimeout(() => route("none"), 250); });
  nav.init(route);
  updates();
}
start();
