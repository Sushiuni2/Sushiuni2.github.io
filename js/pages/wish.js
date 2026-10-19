// 3 想买：先放 14 天冷静；对着六条原则过一遍（过了圈，过不了划掉），再数衣柜里能和它搭的有几件——少于三件就别买。
import { db, uid, rules as getRules } from "../db.js";
import { T, page, head, drawHead, ink, figure, tape, tapes, daysSince, go, esc, toast, confirmSheet } from "../ui.js";
import { KINDS, noStr } from "../kinds.js";

const WAIT = 14;
const dayText = (w) => { const d = daysSince(w.created) + 1; return d >= WAIT ? `满 ${WAIT} 天` : `第 ${d} 天`; };

function ruleSet(w) {
  return `<div class="ruleset">${T("原则", "m b")}<span style="width:12px"></span>${[1, 2, 3, 4, 5, 6].map((k) =>
    `<span class="n" data-k="${k}" data-s="${w.checks?.[k] || ""}">${T(String(k), "l")}</span>`).join("")}
    <span style="width:22px"></span>${T("能搭", "m b")}<span style="width:8px"></span><span class="cnt ${(w.matches?.length || 0) < 3 ? "few" : ""}">${T(`${w.matches?.length || 0} 件`, "l b")}</span></div>`;
}
function drawRuleSet(sh, box, root) {
  for (const n of root.querySelectorAll(".ruleset .n")) {
    const b = box(n.querySelector(".ty"));
    if (n.dataset.s === "y") sh.circle(b.cx, b.cy, 8, 0.55, 7.6);
    if (n.dataset.s === "n") sh.pen([[b.cx - 6, b.cy + 5], [b.cx + 6.5, b.cy - 5]], 0.6, { over: 0.6 });
  }
  for (const c of root.querySelectorAll(".cnt.few .ty")) { const b = box(c); sh.underline(b.x - 1, b.r + 1, b.b + 3, 0.6, true); }
}

export async function wishes() {
  const all = await db.all("wishes");
  const open = all.filter((w) => !w.status || w.status === "open").sort((a, b) => a.created.localeCompare(b.created));
  const done = all.filter((w) => w.status === "dropped" || w.status === "bought").sort((a, b) => (b.closed || "").localeCompare(a.closed || ""));
  const card = (w) => `<a class="wish" href="#/wish/${w.id}">
    <div class="top">${T(w.name, "l b")}${T(w.status === "bought" ? "买了" : w.status === "dropped" ? "不买" : dayText(w), "m b")}</div>
    ${w.price ? `<div style="margin-top:4px">${T(w.price + " 元", "m")}</div>` : ""}
    ${ruleSet(w)}
    ${w.note ? `<div style="line-height:1.7;margin-top:4px;padding-right:64px">${T(w.note, "m")}</div>` : ""}
    ${w.status === "dropped" ? `<span class="stamp">${T("不买", "l b")}</span>` : ""}</a>`;
  const el = page(`
    ${head({ title: "想买", right: `${open.length} 件 · 冷静期 ${WAIT} 天` })}
    <div class="list">${open.length ? open.map(card).join("") : `<div class="empty">${T("现在没有想买的。", "l b")}<br>${T("看到想要的，先放进来，等 14 天。", "m")}</div>`}</div>
    ${open.length ? `<p style="margin:12px 0 0;line-height:1.9">${T("* 少于三件能搭的，就算再喜欢也先别买。", "s")}<br>${T(`* 满 ${WAIT} 天还想要，再去看一次实物。`, "s")}</p>` : ""}
    ${done.length ? `<p style="margin:26px 0 0">${T("* 放下的和买了的", "m b")}</p><div class="list done" style="opacity:.75">${done.slice(0, 12).map(card).join("")}</div>` : ""}
    ${tapes(tape("想想原则", { act: "rules", seed: 0, rot: -0.7 }), tape("放进来", { dark: true, act: "new", seed: 1, rot: 0.4 }))}
  `);
  return {
    el,
    after() {
      drawHead(el);
      for (const L of el.querySelectorAll(".list")) ink(L, "wl" + all.length + L.className, (sh, box, W) => {
        for (const c of L.querySelectorAll(".wish")) {
          sh.rule(0, W, box(c).b, 0.32);
          const st = c.querySelector(".stamp .ty");
          if (st) { const b = box(st); sh.circle(b.cx, b.cy, b.w / 2 + 10, 0.7, 11); }
        }
        drawRuleSet(sh, box, L);
      });
      el.querySelector('[data-act="new"]').onclick = () => go("#/wish/new");
      el.querySelector('[data-act="rules"]').onclick = () => go("#/rules");
    },
  };
}

export async function wishEdit([id]) {
  const old = id ? await db.get("wishes", id) : null;
  const w = old ? structuredClone(old) : { id: uid(), name: "", price: "", note: "", checks: {}, matches: [], status: "open", created: new Date().toISOString() };
  const items = (await db.all("items")).filter((i) => !i.archived).sort((a, b) => b.no - a.no);
  const rl = await getRules();
  const sel = new Set(w.matches || []);
  const el = page(`
    ${head({ backTo: "#/wish", backText: "想买", right: old ? dayText(w) : "放进来" })}
    <div class="form" style="margin-top:12px">
      <div class="row">${T("是什么", "m b")}<input class="field" data-f="name" placeholder="比如：灰色羊毛直筒裤" value="${esc(w.name)}"></div>
      <div class="row">${T("多少钱", "m b")}<input class="field" data-f="price" inputmode="decimal" placeholder="元" value="${esc(w.price)}"></div>
      <div class="row">${T("在哪", "m b")}<input class="field" data-f="link" placeholder="店名或链接" value="${esc(w.link || "")}"></div>
      <p style="margin:18px 0 2px">${T("对着六条原则过一遍（点一下圈上＝过了，再点划掉＝过不了，再点清空）", "m b")}</p>
      <div class="rules-check">${rl.list.map((r, i) => `<button class="how rc" data-k="${i + 1}" data-s="${w.checks?.[i + 1] || ""}" style="width:100%;text-align:left"><span class="n">${T(String(i + 1), "l b")}</span><span>${T(r.text, "m")}</span><span></span></button>`).join("")}</div>
      <p style="margin:18px 0 2px">${T("衣柜里能和它搭的（挑出来）", "m b")}<span class="cntx" style="margin-left:10px">${T(`${sel.size} 件`, "m b")}</span></p>
      ${items.length ? `<div class="picker">${items.map((it) => `<button data-id="${it.id}" class="${sel.has(it.id) ? "on" : ""}"><span class="fig" data-id="${it.id}"></span>${T(noStr(it.no), "s")}</button>`).join("")}</div>` : `<p>${T("衣柜还是空的。", "m soft")}</p>`}
      <div class="row" style="align-items:start;margin-top:8px">${T("想法", "m b")}<textarea class="field" data-f="note" placeholder="为什么想要？会不会只是一时喜欢？">${esc(w.note || "")}</textarea></div>
      ${old ? `<div class="linkrow" style="margin-top:16px;gap:26px">${w.status === "open" ? `<button class="bought">${T("买了，录进衣柜", "m b")}</button><button class="drop">${T("不买了", "m b")}</button>` : `<button class="reopen">${T("放回想买", "m b")}</button>`}<button class="del">${T("删掉", "m soft")}</button></div>` : ""}
    </div>
    ${tapes(tape("算了", { act: "cancel", seed: 2, rot: 0.6 }), tape(old ? "存好" : "放进来", { dark: true, act: "save", seed: 0, rot: -0.5 }))}
  `, { detail: true });
  const collect = () => {
    for (const f of el.querySelectorAll("[data-f]")) w[f.dataset.f] = f.value.trim();
    w.price = w.price === "" ? "" : +w.price || w.price;
    w.matches = [...sel];
  };
  const drawChecks = () => {
    const rc = el.querySelector(".rules-check");
    ink(rc, "rc" + JSON.stringify(w.checks), (sh, box) => {
      for (const b of rc.querySelectorAll(".rc")) {
        const n = box(b.querySelector(".n .ty")), t = box(b.querySelector("span:nth-child(2) .ty"));
        if (b.dataset.s === "y") sh.circle(n.cx, n.cy, 8.4, 0.6, 8);
        if (b.dataset.s === "n") { sh.pen([[n.cx - 6, n.cy + 5], [n.cx + 6.5, n.cy - 5]], 0.6, { over: 0.6 }); sh.strike(t.x - 2, t.r + 3, t.cy, 0.5); }
      }
    }, 10);
  };
  const pk = () => el.querySelector(".picker");
  const circ = () => pk() && ink(pk(), "wp" + [...sel].join(""), (sh, box) => {
    for (const b of pk().querySelectorAll("button.on")) { const r = box(b); sh.circle(r.cx, r.cy - 4, r.w / 2 + 2, 0.6, r.h / 2 + 2); }
  }, 10);
  return {
    el,
    after() {
      drawHead(el); drawChecks(); circ();
      for (const f of el.querySelectorAll(".picker .fig")) figure(f, items.find((i) => i.id === f.dataset.id), { w: 0.5, pad: 2 });
      el.addEventListener("click", async (e) => {
        const rc = e.target.closest(".rc");
        if (rc) {
          const nx = { "": "y", y: "n", n: "" }[rc.dataset.s || ""];
          rc.dataset.s = nx; w.checks = { ...w.checks, [rc.dataset.k]: nx || undefined };
          drawChecks(); return;
        }
        const b = e.target.closest(".picker button");
        if (b) {
          sel.has(b.dataset.id) ? sel.delete(b.dataset.id) : sel.add(b.dataset.id);
          b.classList.toggle("on"); circ();
          el.querySelector(".cntx").innerHTML = T(`${sel.size} 件`, "m b");
          return;
        }
        const close = async (status) => { collect(); w.status = status; w.closed = new Date().toISOString(); await db.put("wishes", w); };
        if (e.target.closest(".drop")) { await close("dropped"); toast("放下了"); go("#/wish"); return; }
        if (e.target.closest(".reopen")) { collect(); w.status = "open"; delete w.closed; await db.put("wishes", w); go("#/wish"); return; }
        if (e.target.closest(".bought")) {
          collect(); await db.put("wishes", w);
          go(`#/new?name=${encodeURIComponent(w.name)}&price=${encodeURIComponent(w.price || "")}&wish=${w.id}`);
          return;
        }
        if (e.target.closest(".del")) { if (await confirmSheet("删掉这一件？", "删掉")) { await db.del("wishes", w.id); go("#/wish"); } return; }
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act === "cancel") go("#/wish");
        if (act === "save") {
          collect();
          if (!w.name) { toast("写一下是什么"); return; }
          await db.put("wishes", w);
          toast(old ? "存好了" : `放进来了，${WAIT} 天后再看`);
          go("#/wish");
        }
      });
    },
  };
}
