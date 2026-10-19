// 2 搭配：衣柜是歌单。每一套是一首歌：A1、A2…（按穿过的次数排），还没穿出去过的放在 B 面。
import { db, uid } from "../db.js";
import { T, page, head, drawHead, ink, figure, actions, onAct, season, today, md, go, esc, toast, confirmSheet } from "../ui.js";
import { KINDS, noStr } from "../kinds.js";

async function loadAll() {
  const items = (await db.all("items")).filter((i) => !i.archived);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const outfits = await db.all("outfits");
  const worn = outfits.filter((o) => o.wears?.length).sort((a, b) => b.wears.length - a.wears.length || a.created.localeCompare(b.created));
  const unworn = outfits.filter((o) => !o.wears?.length).sort((a, b) => a.created.localeCompare(b.created));
  const code = new Map();
  worn.forEach((o, i) => code.set(o.id, "A" + (i + 1)));
  unworn.forEach((o, i) => code.set(o.id, "B" + (i + 1)));
  return { items, byId, outfits, worn, unworn, code };
}

const order = (it) => ({ 外套: 0, 上衣: 1, 下装: 2, 鞋履: 3, 配饰: 4 }[KINDS[it.kind]?.cat] ?? 5);

function thumbs(o, byId) {
  return `<div class="thumbs">${(o.items || []).map((id) => byId[id]).filter(Boolean).sort((a, b) => order(a) - order(b)).map((it) =>
    `<span class="thumb"><span class="fig" data-id="${it.id}"></span>${T(String(it.no).padStart(2, "0"), "s")}</span>`).join("")}</div>`;
}
function drawThumbs(el, byId) {
  for (const f of el.querySelectorAll(".thumb .fig")) figure(f, byId[f.dataset.id], { w: 0.55, pad: 2 });
}

export async function outfits() {
  const { items, byId, outfits, worn, unworn, code } = await loadAll();
  const track = (o) => `<a class="track" href="#/outfit/${o.id}"><div class="top">${T(code.get(o.id), "l b")}${T(o.name || "没起名字", "l b")}${T(o.wears?.length ? o.wears.length + " 次" : "还没穿过", "m")}</div>${thumbs(o, byId)}</a>`;
  const el = page(`
    ${head({ title: "搭配", sub: "衣柜是歌单", right: `${outfits.length} 套 · ${season()}` })}
    <div class="list">${outfits.length ? [...worn, ...unworn].map(track).join("") :
      `<div class="empty">${T("还没有配过一套。", "l b")}<br>${T(items.length >= 2 ? "从衣柜里挑几件放在一起，起个名字。" : "先在衣柜里录几件衣服。", "m")}</div>`}</div>
    ${unworn.length ? `<p style="margin:12px 0 0">${T("* B 面是还没穿出去过的。", "s")}</p>` : ""}
    ${items.length >= 2 ? `<p style="margin:14px 0 0;text-align:right"><button class="rand" style="padding:8px 0">${T("随机配一套 →", "m b")}</button></p>` : ""}
    ${actions({ text: "配一套", act: "new", dark: true })}
  `);
  return {
    el,
    after() {
      drawHead(el);
      const L = el.querySelector(".list");
      ink(L, "ol" + outfits.length, (sh, box, W) => { for (const t of L.querySelectorAll(".track")) sh.rule(0, W, box(t).b, 0.32); });
      drawThumbs(el, byId);
      onAct(el, { new: () => go("#/outfits/new") });
      const rb = el.querySelector(".rand");
      if (rb) rb.onclick = () => {
        const pick = (cats) => { const l = items.filter((i) => cats.includes(KINDS[i.kind]?.cat)); return l.length ? l[Math.floor(Math.random() * l.length)].id : null; };
        const ids = [pick(["上衣"]), Math.random() < 0.4 ? pick(["外套"]) : null, pick(["下装"]), pick(["鞋履"])].filter(Boolean);
        if (ids.length < 2) { toast("衣柜里的衣服还不够配一套"); return; }
        go(`#/outfits/new?items=${ids.join(",")}&rand=1`);
      };
    },
  };
}

export async function outfitView([id]) {
  const { byId, code } = await loadAll();
  const o = await db.get("outfits", id);
  if (!o) throw new Error("找不到这一套");
  const its = (o.items || []).map((i) => byId[i]).filter(Boolean).sort((a, b) => order(a) - order(b));
  const wears = [...(o.wears || [])].sort().reverse();
  const el = page(`
    ${head({ backTo: "#/outfits", backText: "搭配", right: code.get(o.id) })}
    <section class="rel ov" style="margin-top:12px">
      <div class="title" style="display:inline-block">${T(o.name || "没起名字", "xl b")}</div>
      <div class="grid" style="margin-top:22px">${its.map((it) => `<a class="card" href="#/item/${it.id}"><div class="fig" data-id="${it.id}"></div>
        <div class="cap"><span>${T(noStr(it.no), "s b")} ${T(it.name || KINDS[it.kind].name, "m b")}</span></div></a>`).join("")}</div>
    </section>
    <section class="rel" style="margin-top:22px"><span class="h2">${T(`* 穿过 ${wears.length} 次`, "l b")}</span>
      <div class="dates">${wears.map((d) => `<span>${T(md(d), "m")}</span>`).join("") || T("还没穿过。", "m soft")}</div></section>
    <p style="margin:18px 0 0"><a href="#/outfit/${o.id}/edit" style="padding:8px 0;display:inline-block">${T("改这一套", "m b")}</a></p>
    ${actions({ text: o.wears?.includes(today()) ? "今天穿这套 ✓" : "今天穿这套", act: "wear", dark: true })}
  `, { detail: true });
  return {
    el,
    after() {
      drawHead(el);
      const s = el.querySelector(".ov");
      ink(s, "ovt" + o.id, (sh, box) => { const t = box(s.querySelector(".title .ty")); sh.underline(t.x - 2, t.r, t.b + 2, 0.8, true); });
      for (const f of el.querySelectorAll(".fig")) figure(f, byId[f.dataset.id], { w: 0.62, pad: 8 });
      onAct(el, { wear: async () => {
        const d = today();
        o.wears = o.wears || [];
        if (o.wears.includes(d)) { toast("今天已经记过了"); return; }
        o.wears.push(d);
        await db.put("outfits", o);
        for (const it of its) { it.wears = it.wears || []; if (!it.wears.includes(d)) { it.wears.push(d); await db.put("items", it); } }
        toast("记下了，几件衣服也各记了一次");
        go("", "refresh");
      } });
    },
  };
}

export async function outfitEdit([id], q = {}) {
  const { items } = await loadAll();
  const old = id ? await db.get("outfits", id) : null;
  const o = old ? { ...old } : { id: uid(), name: "", items: q.items ? q.items.split(",") : [], wears: [], created: new Date().toISOString() };
  const sel = new Set(o.items);
  const sorted = [...items].sort((a, b) => order(a) - order(b) || b.no - a.no);
  const el = page(`
    ${head({ backTo: old ? `#/outfit/${o.id}` : "#/outfits", backText: "搭配", right: old ? "改一套" : (q.rand ? "随机出来的一套" : "新的一套") })}
    <div class="form" style="margin-top:12px">
      <div class="row">${T("名字", "m b")}<input class="field" data-f="name" placeholder="比如：平常的一天 / 去看展 / 下雨" value="${esc(o.name)}"></div>
      <p style="margin:16px 0 4px">${T("挑几件（点一下圈上，再点一下去掉）", "m b")}</p>
      <div class="picker">${sorted.map((it) => `<button data-id="${it.id}" class="${sel.has(it.id) ? "on" : ""}"><span class="fig" data-id="${it.id}"></span>${T(noStr(it.no), "s")}</button>`).join("")}</div>
      ${old ? `<p style="margin:16px 0 0"><button class="del">${T("删掉这一套", "m soft")}</button></p>` : ""}
    </div>
    ${actions({ text: "存这一套", act: "save", dark: true })}
  `, { detail: true });
  const pk = () => el.querySelector(".picker");
  const circ = () => ink(pk(), "pk" + [...sel].join(""), (sh, box) => {
    for (const b of pk().querySelectorAll("button.on")) { const r = box(b); sh.circle(r.cx, r.cy - 4, r.w / 2 + 2, 0.6, r.h / 2 + 2); }
  }, 10);
  return {
    el,
    after() {
      drawHead(el);
      for (const f of el.querySelectorAll(".picker .fig")) figure(f, items.find((i) => i.id === f.dataset.id), { w: 0.5, pad: 2 });
      circ();
      el.addEventListener("click", async (e) => {
        const b = e.target.closest(".picker button");
        if (b) { const id_ = b.dataset.id; sel.has(id_) ? sel.delete(id_) : sel.add(id_); b.classList.toggle("on"); circ(); return; }
        if (e.target.closest(".del")) {
          if (await confirmSheet("删掉这一套？衣服不会删。", "删掉")) { await db.del("outfits", o.id); go("#/outfits", "reset"); }
          return;
        }
      });
      onAct(el, {
        save: async () => {
          if (sel.size < 2) { toast("至少挑两件"); return; }
          o.name = el.querySelector('[data-f="name"]').value.trim();
          o.items = [...sel];
          await db.put("outfits", o);
          if (old) go(`#/outfit/${o.id}`, "up"); else go(`#/outfit/${o.id}`, "replace");
        },
      });
    },
  };
}
