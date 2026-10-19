// 3 想买：先放 14 天冷静；对着六条原则过一遍（过了圈，过不了划掉），再数衣柜里能和它搭的有几件——少于三件就别买。
// 可以带一张照片；买了就直接收进衣柜（照片、名字、价格、在哪买、颜色都带过去）。
import { db, uid, rules as getRules, savePhoto, photoColor } from "../db.js";
import { T, page, head, drawHead, ink, figure, printPhoto, actions, onAct, daysSince, go, esc, toast, confirmSheet } from "../ui.js";
import { noStr } from "../kinds.js";

const WAIT = 14;
const dayText = (w) => { const d = daysSince(w.created) + 1; return d >= WAIT ? `满 ${WAIT} 天` : `第 ${d} 天`; };

function ruleSet(w) {
  return `<div class="ruleset">${T("原则", "m b")}<span style="width:10px"></span>${[1, 2, 3, 4, 5, 6].map((k) =>
    `<span class="n" data-k="${k}" data-s="${w.checks?.[k] || ""}">${T(String(k), "l")}</span>`).join("")}
    <span style="width:18px"></span>${T("能搭", "m b")}<span style="width:6px"></span><span class="cnt ${(w.matches?.length || 0) < 3 ? "few" : ""}">${T(`${w.matches?.length || 0} 件`, "l b")}</span></div>`;
}
function drawRuleSet(sh, box, root) {
  for (const n of root.querySelectorAll(".ruleset .n")) {
    const b = box(n.querySelector(".ty"));
    if (n.dataset.s === "y") sh.circle(b.cx, b.cy, 9, 0.55, 8.6);
    if (n.dataset.s === "n") sh.pen([[b.cx - 6.5, b.cy + 5.5], [b.cx + 7, b.cy - 5.5]], 0.6, { over: 0.6 });
  }
  for (const c of root.querySelectorAll(".cnt.few .ty")) { const b = box(c); sh.underline(b.x - 1, b.r + 1, b.b + 3, 0.6, true); }
}

// 想买的清单（放在衣柜页「想买」这一栏里）：返回 html 和画墨的函数
export async function wishSection() {
  const all = await db.all("wishes");
  const open = all.filter((w) => !w.status || w.status === "open").sort((a, b) => a.created.localeCompare(b.created));
  const done = all.filter((w) => w.status === "dropped" || w.status === "bought").sort((a, b) => (b.closed || "").localeCompare(a.closed || ""));
  const card = (w) => `<a class="wish ${w.photo ? "withphoto" : ""}" href="#/wish/${w.id}">
    <div class="top">${T(w.name, "l b")}${T(w.status === "bought" ? "买了" : w.status === "dropped" ? "不买" : dayText(w), "m b")}</div>
    ${w.photo ? `<span class="wphoto" data-ph="${w.photo}" data-id="${w.id}"></span>` : ""}
    ${w.price ? `<div style="margin-top:4px">${T(w.price + " 元", "m")}</div>` : ""}
    ${ruleSet(w)}
    ${w.note ? `<div class="wnote">${T(w.note, "m")}</div>` : ""}
    ${w.status === "dropped" ? `<span class="stamp">${T("不买", "l b")}</span>` : ""}</a>`;
  const html = `
    <div class="list">${open.length ? open.map(card).join("") : `<div class="empty">${T("现在没有想买的。", "l b")}<br>${T("看到想要的，先放进来，等 14 天。", "m")}</div>`}</div>
    ${open.length ? `<p style="margin:12px 0 0;line-height:1.9">${T("* 少于三件能搭的，就算再喜欢也先别买。", "s")}<br>${T(`* 满 ${WAIT} 天还想要，再去看一次实物。`, "s")}</p>` : ""}
    ${done.length ? `<p style="margin:26px 0 0">${T("* 放下的和买了的", "m b")}</p><div class="list done" style="opacity:.75">${done.slice(0, 12).map(card).join("")}</div>` : ""}`;
  const draw = (el) => {
    for (const L of el.querySelectorAll(".list")) ink(L, "wl" + all.length + L.className, (sh, box, W) => {
      for (const c of L.querySelectorAll(".wish")) {
        sh.rule(0, W, box(c).b, 0.32);
        const st = c.querySelector(".stamp .ty");
        if (st) { const b = box(st); sh.circle(b.cx, b.cy, b.w / 2 + 10, 0.7, 11); }
      }
      drawRuleSet(sh, box, L);
    });
    for (const p of el.querySelectorAll(".wphoto")) printPhoto(p, p.dataset.ph, p.dataset.id);
  };
  return { html, draw, count: open.length };
}

export const openWishCount = async () => (await db.all("wishes")).filter((w) => !w.status || w.status === "open").length;

export async function wishEdit([id]) {
  const old = id ? await db.get("wishes", id) : null;
  const w = old ? structuredClone(old) : { id: uid(), name: "", price: "", note: "", checks: {}, matches: [], status: "open", created: new Date().toISOString() };
  const items = (await db.all("items")).filter((i) => !i.archived).sort((a, b) => b.no - a.no);
  const rl = await getRules();
  const sel = new Set(w.matches || []);
  const isOpen = !w.status || w.status === "open";
  const el = page(`
    ${head({ backTo: "#/?c=想买", backText: "想买", right: old ? dayText(w) : "放进来" })}
    <div class="form" style="margin-top:12px">
      <div class="wishfig ${w.photo ? "" : "hide"}"></div>
      <div class="row">${T("照片", "m b")}<div class="linkrow">
        <label>${T("拍一张", "l")}<input type="file" accept="image/*" capture="environment" data-photo></label>
        <label>${T("从相册选", "l")}<input type="file" accept="image/*" data-photo></label>
        <button class="rmphoto ${w.photo ? "" : "hide"}">${T("去掉", "l soft")}</button></div></div>
      <div class="row">${T("是什么", "m b")}<input class="field" data-f="name" placeholder="比如：灰色羊毛直筒裤" value="${esc(w.name)}"></div>
      <div class="row">${T("多少钱", "m b")}<input class="field" data-f="price" inputmode="decimal" placeholder="元" value="${esc(w.price)}"></div>
      <div class="row">${T("在哪", "m b")}<input class="field" data-f="link" placeholder="店名或链接" value="${esc(w.link || "")}"></div>
      <p style="margin:20px 0 4px">${T("对着六条原则过一遍", "m b")}</p>
      <p style="margin:0 0 6px">${T("点一下圈上＝过了；再点划掉＝过不了；再点清空。", "s")}</p>
      <div class="rules-check">${rl.list.map((r, i) => `<button class="how rc" data-k="${i + 1}" data-s="${w.checks?.[i + 1] || ""}" style="width:100%;text-align:left"><span class="n">${T(String(i + 1), "l b")}</span><span>${T(r.text, "m")}</span><span></span></button>`).join("")}</div>
      <p style="margin:20px 0 4px">${T("衣柜里能和它搭的", "m b")}<span class="cntx" style="margin-left:10px">${T(`${sel.size} 件`, "m b")}</span></p>
      ${items.length ? `<div class="picker">${items.map((it) => `<button data-id="${it.id}" class="${sel.has(it.id) ? "on" : ""}"><span class="fig" data-id="${it.id}"></span>${T(noStr(it.no), "s")}</button>`).join("")}</div>` : `<p>${T("衣柜还是空的。", "m soft")}</p>`}
      <div class="row" style="align-items:start;margin-top:8px">${T("想法", "m b")}<textarea class="field" data-f="note" placeholder="为什么想要？会不会只是一时喜欢？">${esc(w.note || "")}</textarea></div>
      ${old ? `<p style="margin:18px 0 0">${T(isOpen ? "* 改了会自动存好。" : "", "s")}</p><p style="margin:10px 0 0"><button class="del">${T("删掉这一件", "m soft")}</button></p>` : ""}
    </div>
    ${!old ? actions({ text: "放进来", act: "save", dark: true })
      : isOpen ? actions({ text: "不买了", act: "drop" }, { text: "买了，收进衣柜", act: "bought", dark: true })
      : actions({ text: "放回想买", act: "reopen" })}
  `, { detail: true });

  const collect = () => {
    for (const f of el.querySelectorAll("[data-f]")) w[f.dataset.f] = f.value.trim();
    w.price = w.price === "" ? "" : +w.price || w.price;
    w.matches = [...sel];
  };
  let saveT = 0;
  const autosave = () => { if (!old) return; clearTimeout(saveT); saveT = setTimeout(() => { collect(); db.put("wishes", w); }, 300); };
  const drawChecks = () => {
    const rc = el.querySelector(".rules-check");
    ink(rc, "rc" + JSON.stringify(w.checks), (sh, box) => {
      for (const b of rc.querySelectorAll(".rc")) {
        const n = box(b.querySelector(".n .ty")), t = box(b.querySelector("span:nth-child(2) .ty"));
        if (b.dataset.s === "y") sh.circle(n.cx, n.cy, 9.4, 0.6, 9);
        if (b.dataset.s === "n") { sh.pen([[n.cx - 6.5, n.cy + 5.5], [n.cx + 7, n.cy - 5.5]], 0.6, { over: 0.6 }); sh.strike(t.x - 2, t.r + 3, t.cy, 0.5); }
      }
    }, 10);
  };
  const pk = () => el.querySelector(".picker");
  const circ = () => pk() && ink(pk(), "wp" + [...sel].join(""), (sh, box) => {
    for (const b of pk().querySelectorAll("button.on")) { const r = box(b); sh.circle(r.cx, r.cy - 4, r.w / 2 + 2, 0.6, r.h / 2 + 2); }
  }, 10);
  const showPhoto = async () => {
    const f = el.querySelector(".wishfig");
    f.classList.toggle("hide", !w.photo);
    el.querySelector(".rmphoto").classList.toggle("hide", !w.photo);
    if (w.photo) await printPhoto(f, w.photo, w.id);
  };
  onAct(el, {
    save: async () => {
      collect();
      if (!w.name) { toast("写一下是什么"); return; }
      await db.put("wishes", w);
      toast(`放进来了，${WAIT} 天后再看`);
      go("#/?c=想买", "up");
    },
    drop: async () => { collect(); w.status = "dropped"; w.closed = new Date().toISOString(); await db.put("wishes", w); toast("放下了"); go("#/?c=想买", "up"); },
    reopen: async () => { collect(); w.status = "open"; delete w.closed; await db.put("wishes", w); go("#/?c=想买", "up"); },
    bought: async () => { collect(); await db.put("wishes", w); go(`#/new?wish=${w.id}`); },
  });
  return {
    el,
    after() {
      drawHead(el); drawChecks(); circ(); showPhoto();
      for (const f of el.querySelectorAll(".picker .fig")) figure(f, items.find((i) => i.id === f.dataset.id), { w: 0.5, pad: 2 });
      el.addEventListener("input", autosave);
      el.addEventListener("click", async (e) => {
        const rc = e.target.closest(".rc");
        if (rc) {
          const nx = { "": "y", y: "n", n: "" }[rc.dataset.s || ""];
          rc.dataset.s = nx; w.checks = { ...w.checks, [rc.dataset.k]: nx || undefined };
          drawChecks(); autosave(); return;
        }
        const b = e.target.closest(".picker button");
        if (b) {
          sel.has(b.dataset.id) ? sel.delete(b.dataset.id) : sel.add(b.dataset.id);
          b.classList.toggle("on"); circ();
          el.querySelector(".cntx").innerHTML = T(`${sel.size} 件`, "m b");
          autosave(); return;
        }
        if (e.target.closest(".rmphoto")) { w.photo = null; w.color = null; showPhoto(); autosave(); return; }
        if (e.target.closest(".del")) { if (await confirmSheet("删掉这一件？", "删掉")) { await db.del("wishes", w.id); go("#/?c=想买", "up"); } return; }
      });
      for (const inp of el.querySelectorAll("[data-photo]")) inp.addEventListener("change", async () => {
        const f = inp.files?.[0];
        if (!f) return;
        w.photo = await savePhoto(f);
        w.color = await photoColor(w.photo).catch(() => null);
        await showPhoto(); autosave();
      });
    },
  };
}
