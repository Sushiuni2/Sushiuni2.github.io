// 0 记：看到的、听到的、穿过之后想到的一句话。每条圈一个它对上的原则；哪条都对不上，就打个问号。
import { db, uid, rules as getRules } from "../db.js";
import { T, page, head, drawHead, ink, tape, tapes, md, today, season, go, esc, toast, confirmSheet } from "../ui.js";
import { noStr, KINDS } from "../kinds.js";

const SRC = ["看到的", "听到的", "穿过之后"];

export async function notes(_, q) {
  const all = (await db.all("notes")).sort((a, b) => (b.date + b.created).localeCompare(a.date + a.created));
  const items = Object.fromEntries((await db.all("items")).map((i) => [i.id, i]));
  const src = SRC.includes(q.s) ? q.s : "";
  const byRule = q.by === "rule";
  let list = src ? all.filter((n) => n.src === src) : all;
  const groups = byRule ? [1, 2, 3, 4, 5, 6, null].map((r) => [r, list.filter((n) => (n.rule ?? null) === r)]).filter(([, l]) => l.length) : [[undefined, list]];
  const rl = await getRules();
  const entry = (n) => `<a class="entry" href="#/note/${n.id}">
      <div>${T(md(n.date), "m b")}<br>${T(n.src || "", "s")}</div>
      <div><div class="txt">${T(n.text)}</div>${n.itemId && items[n.itemId] ? `<span class="ref">${T("见 " + noStr(items[n.itemId].no) + " " + (items[n.itemId].name || KINDS[items[n.itemId].kind]?.name || ""), "s b")}</span>` : ""}</div>
      <div class="mark">${n.rule ? `<span class="rn">${T(String(n.rule), "m b")}</span>` : T("?", "l b")}</div></a>`;
  const el = page(`
    ${head({ title: "记", right: `${all.length} 条 · ${season()}` })}
    <nav class="cats src">${SRC.map((s) => `<a href="#/notes?s=${s === src ? "" : encodeURIComponent(s)}${byRule ? "&by=rule" : ""}" class="${s === src ? "on" : ""}">${T(s, s === src ? "m b" : "m")}</a>`).join(`<span>${T("/", "m")}</span>`)}</nav>
    <div class="list">${list.length ? groups.map(([r, l]) => (r !== undefined ? `<div class="grp" style="margin-top:16px">${T(r ? `${r}  ${rl.list[r - 1]?.text || ""}` : "?  还没写到的", "m b")}</div>` : "") + l.map(entry).join("")).join("")
      : `<div class="empty">${T(all.length ? "这一类还没有。" : "还没有记过。", "l b")}<br>${T("在路上看到的、别人说的、穿出去之后的感觉，", "m")}<br>${T("一句话就够。", "m")}</div>`}</div>
    ${list.length ? `<p style="margin:12px 0 0">${T("* 圈的是对上的那条原则；打问号的，说明原则还没写到。", "s")}</p>` : ""}
    ${tapes(tape(byRule ? "按时间看" : "按原则看", { act: "group", seed: 1, rot: 0.6 }), tape("记一句", { dark: true, act: "new", seed: 0, rot: -0.5 }))}
  `);
  return {
    el,
    after() {
      drawHead(el);
      const c = el.querySelector(".cats");
      ink(c, "src" + src, (sh, box, W) => {
        const on = c.querySelector("a.on .ty");
        if (on) { const b = box(on); sh.pen([[b.x - 2, b.b + 3], [b.r + 3, b.b + 2.2]], 0.7, { over: 1, wob: 0.2 }); }
      });
      const L = el.querySelector(".list");
      ink(L, "nl" + list.length + src + byRule, (sh, box, W) => {
        for (const e of L.querySelectorAll(".entry")) {
          const b = box(e);
          sh.rule(0, W, b.b, 0.32);
          const rn = e.querySelector(".rn .ty");
          if (rn) { const r = box(rn); sh.circle(r.cx, r.cy, 8.4, 0.6, 7.8); }
        }
        for (const g of L.querySelectorAll(".grp .ty")) { const b = box(g); sh.underline(b.x - 2, b.r + 4, b.b + 3, 0.6); }
      });
      el.querySelector('[data-act="new"]').onclick = () => go("#/notes/new");
      el.querySelector('[data-act="group"]').onclick = () => go(`#/notes?${src ? "s=" + encodeURIComponent(src) + "&" : ""}${byRule ? "" : "by=rule"}`);
    },
  };
}

export async function noteEdit([id], q = {}) {
  const old = id ? await db.get("notes", id) : null;
  const n = old ? { ...old } : { id: uid(), date: today(), src: "看到的", text: "", rule: null, itemId: q.item || "", created: new Date().toISOString() };
  const items = (await db.all("items")).filter((i) => !i.archived).sort((a, b) => b.no - a.no);
  const rl = await getRules();
  const el = page(`
    ${head({ backTo: "#/notes", backText: "记", right: old ? "改一条" : md(n.date) })}
    <div class="form" style="margin-top:14px">
      <div class="row" data-key="src">${T("哪来的", "m b")}<div class="opts">${SRC.map((s) => `<button class="opt ${s === n.src ? "on" : ""}" data-v="${s}">${T(s, "l")}</button>`).join("")}</div></div>
      <div style="margin:10px 0 6px">${T("一句话", "m b")}</div>
      <textarea class="field" data-f="text" placeholder="比如：地铁上一个人，只有袜子是酒红的。好看在于只有一处。">${esc(n.text)}</textarea>
      <div class="row" data-key="rule" style="margin-top:14px">${T("对上", "m b")}<div class="opts">${[1, 2, 3, 4, 5, 6].map((r) => `<button class="opt ${n.rule === r ? "on" : ""}" data-v="${r}">${T(String(r), "l b")}</button>`).join("")}<button class="opt ${!n.rule ? "on" : ""}" data-v="">${T("?", "l b")}</button></div></div>
      <p class="ruletext" style="margin:4px 0 0 52px;min-height:1.6em">${T(n.rule ? rl.list[n.rule - 1]?.text : "哪条都对不上，就留个问号。", "s")}</p>
      <div class="row" style="margin-top:8px"><span>${T("关于", "m b")}</span><select class="field" data-f="itemId"><option value="">${esc("不关于哪一件")}</option>${items.map((i) => `<option value="${i.id}" ${i.id === n.itemId ? "selected" : ""}>${esc(noStr(i.no) + " " + (i.name || KINDS[i.kind].name))}</option>`).join("")}</select></div>
      <div class="row"><span>${T("日期", "m b")}</span><input class="field" type="date" data-f="date" value="${esc(n.date)}"></div>
      ${old ? `<p style="margin:16px 0 0"><button class="del">${T("删掉这条", "m soft")}</button></p>` : ""}
    </div>
    ${tapes(tape("不记了", { act: "cancel", seed: 2, rot: 0.5 }), tape("记下", { dark: true, act: "save", seed: 1, rot: -0.6 }))}
  `, { detail: true });
  const circ = (row) => ink(row, "nr" + row.dataset.key + row.querySelector(".on")?.dataset.v, (sh, box) => {
    const on = row.querySelector(".opt.on .ty");
    if (on) { const b = box(on); sh.circle(b.cx, b.cy, Math.max(b.w / 2 + 7, 11), 0.6, Math.max(9.5, b.h / 2 + 4)); }
  }, 10);
  return {
    el,
    after() {
      drawHead(el);
      el.querySelectorAll(".row[data-key]").forEach(circ);
      el.addEventListener("click", async (e) => {
        const opt = e.target.closest(".opt");
        if (opt) {
          const row = opt.closest(".row");
          row.querySelectorAll(".opt").forEach((o) => o.classList.toggle("on", o === opt));
          if (row.dataset.key === "src") n.src = opt.dataset.v;
          else {
            n.rule = opt.dataset.v ? +opt.dataset.v : null;
            el.querySelector(".ruletext").innerHTML = T(n.rule ? rl.list[n.rule - 1]?.text : "哪条都对不上，就留个问号。", "s");
          }
          circ(row);
          return;
        }
        if (e.target.closest(".del")) {
          if (await confirmSheet("删掉这条？", "删掉")) { await db.del("notes", n.id); go("#/notes"); }
          return;
        }
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act === "cancel") go("#/notes");
        if (act === "save") {
          for (const f of el.querySelectorAll("[data-f]")) n[f.dataset.f] = f.value.trim();
          if (!n.text) { toast("写一句再记"); return; }
          await db.put("notes", n);
          toast("记下了");
          go("#/notes");
        }
      });
    },
  };
}
