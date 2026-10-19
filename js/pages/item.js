// 单品：正面是一张稿（照片或简笔画、标题、列举、内标、面料小样），背面是一枚大内标、尺寸对照和穿过的日子。
import { db, body as getBody } from "../db.js";
import { T, page, head, drawHead, ink, figure, swatch, label, tape, tapes, season, today, md, ymd, toast, confirmSheet, go } from "../ui.js";
import { KINDS, noStr, summary, fabricName, sizesFor } from "../kinds.js";

async function load(id) {
  const it = await db.get("items", id);
  if (!it) throw new Error("找不到这件衣服");
  const all = (await db.all("items")).filter((i) => !i.archived);
  return { it, total: all.length };
}

const perWear = (it) => (it.price && it.wears?.length ? (it.price / it.wears.length).toFixed(1) + " 元" : "");

export async function front([id]) {
  const { it, total } = await load(id);
  const name = it.name || KINDS[it.kind]?.name || "";
  const props = [it.colorName, it.composition, ...summary(it)].filter(Boolean);
  const wears = it.wears?.length || 0;
  const rows = [`${T(name + "  " + noStr(it.no) + " :", "b")}`];
  if (it.story) rows.push("* " + (/[。！？.!?]$/.test(it.story) ? it.story : it.story + "。"));
  if (it.origin || it.year) rows.push("* " + [it.year ? `约 ${it.year} 年` : "", it.origin ? `来自${it.origin}` : ""].filter(Boolean).join("，") + "。");
  rows.push(`* 穿过 ${wears} 次${perWear(it) ? "，每次 " + perWear(it) : ""}。`);
  if (it.bought) { rows.push(null); rows.push(`. 入手 ${ymd(it.bought)} .`); }
  const el = page(`
    ${head({ backTo: "#/", backText: "衣柜", right: `${noStr(it.no)} · 共 ${total} 件` })}
    <section class="sheetframe">
      <div class="top"><div class="tl">
        <div class="title">${T("* " + name, "xl b")}</div>
        <div class="props">${props.map((p) => `<div>${T(p, "m")}</div>`).join("")}</div></div>
        ${label(rows, "item-label")}</div>
      <div class="itemfig"></div>
      <div class="foot">
        ${T(noStr(it.no) + "  '" + String(new Date(it.created || Date.now()).getFullYear()).slice(2), "m")}
        <div style="display:flex;align-items:flex-end;gap:18px">${swatch(it.color, it.fabric, { w: 70, h: 44, stitches: true, seed: it.id + "big" })}
        <span class="seasonbox">${T(season(it.bought || it.created), "l")}</span></div>
      </div>
    </section>
    ${tapes(tape("翻面看内标", { act: "flip", seed: 0, rot: 0.6 }), tape("今天穿了", { dark: true, act: "wear", seed: 1, rot: -0.5 }))}
  `, { detail: true });
  return {
    el,
    after() {
      drawHead(el);
      const fr = el.querySelector(".sheetframe");
      ink(fr, "fr" + it.id, (sh, box, W, H) => {
        sh.frame(2, 4, W - 2, H - 4);
        const t = box(fr.querySelector(".title"));
        sh.underline(t.x - 2, t.r - 4, t.b + 1, 0.8, true);
        const p = fr.querySelector(".props");
        if (props.length > 1) { const b = box(p); sh.brace(b.x - 8, b.y + 3, b.b - 3); }
        const s = box(fr.querySelector(".seasonbox"));
        sh.rect(s.x, s.y, s.r, s.b, 0.65, 2.5);
      });
      figure(el.querySelector(".itemfig"), it, { w: 0.9, pad: 10 });
      el.querySelector('[data-act="flip"]').onclick = () => go(`#/item/${it.id}/back`);
      el.querySelector('[data-act="wear"]').onclick = async () => {
        const d = today();
        it.wears = it.wears || [];
        if (it.wears.includes(d)) { toast("今天已经记过了"); return; }
        it.wears.push(d);
        await db.put("items", it);
        toast(`记下了 · 第 ${it.wears.length} 次`);
        setTimeout(() => go(`#/item/${it.id}?t=${Date.now()}`), 900);
      };
    },
  };
}

export async function back([id]) {
  const { it, total } = await load(id);
  const b = await getBody();
  const name = it.name || KINDS[it.kind]?.name || "";
  const rows = [`${T("内标  " + noStr(it.no) + " :", "b")}`, null];
  const end = (s) => (/[。！？.!?]$/.test(s) ? s : s + "。");
  rows.push("* " + end(`${it.colorName || ""}${name}${it.story ? "，" + it.story : ""}`));
  rows.push(null);
  const kv = [["来处", it.origin], ["年代", it.year && `约 ${it.year} 年`], ["入手", [ymd(it.bought), it.price ? it.price + " 元" : ""].filter(Boolean).join("，")], ["成分", it.composition], ["洗护", it.care]];
  for (const [k, v] of kv) rows.push(`* ${k}：${v || "　—"}`);
  rows.push(null);
  rows.push(`. 衣柜 ${noStr(it.no)} / ${total} .`);
  const S = sizesFor(it.kind);
  const hasSizes = S.length && S.some(([k]) => it.sizes?.[k]);
  const diff = (k) => { const a = +it.sizes?.[k], c = +b.base?.[k]; return a && c ? a - c : null; };
  const wears = [...(it.wears || [])].sort().reverse();
  const el = page(`
    ${head({ backTo: `#/item/${it.id}`, backText: "正面", right: `${noStr(it.no)} · 背面` })}
    ${label(rows, "back-label")}
    ${S.length ? `<section class="rel sizes" style="margin-top:34px">
      <div class="h2" style="display:inline-block">${T("* 尺寸  cm", "l b")}</div>
      ${hasSizes ? `<div class="table">
        <span></span>${S.map(([, n]) => `<span class="c">${T(n, "s")}</span>`).join("")}
        <span>${T("这一件", "s")}</span>${S.map(([k]) => `<span class="c">${T(it.sizes?.[k] || "—", "m")}</span>`).join("")}
        <span>${T("基准面", "s")}</span>${S.map(([k]) => `<span class="c">${T(b.base?.[k] || "—", "m")}</span>`).join("")}
        <span>${T("差", "s b")}</span>${S.map(([k]) => { const d = diff(k); return `<span class="c"><span class="d ${d != null && Math.abs(d) >= 2 ? "big" : ""}">${T(d == null ? "" : (d > 0 ? "+" : "") + d, "m b")}</span></span>`; }).join("")}
      </div>` : `<p>${T("还没量。在「修改内标」里填上，就能和「身体」页的基准面对照。", "m soft")}</p>`}
    </section>` : ""}
    <section class="rel wears" style="margin-top:28px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="h2">${T(`* 穿过 ${wears.length} 次`, "l b")}</span>${perWear(it) ? T("每次 " + perWear(it), "m") : ""}</div>
      <div class="dates">${wears.map((d) => `<button data-d="${d}">${T(md(d), "m", "d")}</button>`).join("") || T("还没穿过。", "m soft")}</div>
    </section>
    ${tapes(tape("翻回正面", { act: "flip", seed: 2, rot: -0.6 }), tape("修改内标", { dark: true, act: "edit", seed: 0, rot: 0.7 }))}
  `, { detail: true });
  return {
    el,
    after() {
      drawHead(el);
      for (const sec of el.querySelectorAll("section.rel")) {
        ink(sec, "bk" + sec.className + it.id, (sh, box, W) => {
          const hd = box(sec.querySelector(".h2 .ty"));
          sh.underline(hd.x - 2, hd.r + 4, hd.b + 4, 0.6);
          const tb = sec.querySelector(".table");
          if (tb) {
            const cells = tb.children, row1 = box(cells[1]), last = box(cells[cells.length - 1]);
            sh.rule(0, W, row1.b + 5, 0.45);
            sh.rule(0, W, last.b + 6, 0.45);
            for (const d of sec.querySelectorAll(".d.big .ty")) { const c = box(d); sh.circle(c.cx, c.cy, Math.max(13, c.w / 2 + 6), 0.6, 9.5); }
          }
        });
      }
      el.querySelector('[data-act="flip"]').onclick = () => go(`#/item/${it.id}`);
      el.querySelector('[data-act="edit"]').onclick = () => go(`#/edit/${it.id}`);
      for (const btn of el.querySelectorAll(".dates button")) btn.onclick = async () => {
        if (!(await confirmSheet(`删掉 ${ymd(btn.dataset.d)} 这一次？`, "删掉"))) return;
        it.wears = it.wears.filter((d) => d !== btn.dataset.d);
        await db.put("items", it);
        go(`#/item/${it.id}/back?t=${Date.now()}`);
      };
    },
  };
}
