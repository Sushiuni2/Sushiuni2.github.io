// 单品：正面是一张稿（照片或简笔画、标题、列举、内标、面料小样），背面是一枚大内标、尺寸对照和穿过的日子。
import { db, body as getBody } from "../db.js";
import { T, page, head, drawHead, ink, figure, sketch, swatch, label, actions, onAct, season, today, md, ymd, toast, confirmSheet, go, stamp } from "../ui.js";
import { Sheet } from "../ink.js";
import { drawInBox } from "../garments.js";
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
  const props = [it.colorName, it.composition, ...(it.photo ? [] : summary(it))].filter(Boolean);
  const wears = it.wears?.length || 0;
  const rows = [`${T(name + "  " + noStr(it.no) + " :", "b")}`];
  if (it.story) rows.push("* " + (/[。！？.!?]$/.test(it.story) ? it.story : it.story + "。"));
  if (it.origin) rows.push(`* 来自${it.origin}。`);
  rows.push(`* 穿过 ${wears} 次${perWear(it) ? "，每次 " + perWear(it) : ""}。`);
  if (it.bought) { rows.push(null); rows.push(`. 入手 ${ymd(it.bought)} .`); }
  const el = page(`
    ${head({ backTo: "#/", backText: "衣柜", right: `${noStr(it.no)} · 共 ${total} 件` })}
    <section class="sheetframe">
      <div class="top"><div class="tl">
        <div class="title">${T("* " + name, "xl b")}</div>
        <div class="props">${props.map((p) => `<div>${T(p, "m")}</div>`).join("")}</div></div>
        ${label(rows, "item-label")}</div>
      <div class="itemfig"><div class="mainfig ${it.kind === "cardigan" && !it.photo ? "withback" : ""}"></div><span class="selvedge">${T([noStr(it.no), it.colorName, it.composition, it.origin, ymd(it.bought)].filter(Boolean).join(" · "), "s")}</span>${it.kind === "cardigan" && !it.photo ? `<div class="backwrap"><div class="backfig"></div>${T("背面", "s")}</div>` : ""}</div>
      ${it.wears?.includes(today()) ? `<canvas class="stampmark ${sessionStorage.getItem("justWorn") === it.id ? "fresh" : ""}"></canvas>` : ""}
      <div class="foot">
        <span class="nostamp">${T(noStr(it.no) + "  '" + String(new Date(it.created || Date.now()).getFullYear()).slice(2), "m")}</span>
        <div class="side">${swatch(it.color, it.fabric, { w: 70, h: 44, stitches: true, seed: it.id + "big" })}
          <span class="seasonbox">${T(season(it.bought || it.created), "l")}</span></div>
      </div>
    </section>
    ${actions({ text: "翻面看内标", act: "flip" }, { text: it.wears?.includes(today()) ? "今天穿了 ✓" : "今天穿了", act: "wear", dark: true })}
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
      const S = it.sizes || {};
      const dw = S.shoulder || S.waist || "", dh = S.length || S.inseam || "";
      const bw = el.querySelector(".backwrap");
      figure(el.querySelector(".mainfig"), it, { w: 0.9, pad: 10, dims: dw || dh ? { w: dw ? String(dw) : "", h: dh ? String(dh) : "" } : null });
      const bf = bw?.querySelector(".backfig");
      if (bf) sketch(bf, it, { w: 0.6, pad: 2, params: { ...it.params, back: true }, seed: "back" });
      const sm = el.querySelector(".stampmark");
      if (sm) { stamp(sm, "今天穿了", `${ymd(today())} · 第 ${it.wears.length} 次`, it.id); sessionStorage.removeItem("justWorn"); }
      onAct(el, {
        flip: () => go(`#/item/${it.id}/back`),
        wear: async () => {
          const d = today();
          it.wears = it.wears || [];
          if (it.wears.includes(d)) { toast("今天已经记过了，在背面可以删"); return; }
          it.wears.push(d);
          await db.put("items", it);
          sessionStorage.setItem("justWorn", it.id);
          go("", "refresh");
        },
      });
    },
  };
}

export async function back([id]) {
  const { it, total } = await load(id);
  const b = await getBody();
  const name = it.name || KINDS[it.kind]?.name || "";
  // 照 Replica 的标签：粗体标题、一行小字，几项「原本 / 来处与时期 / 材质 / 描述」，回答是灰色打字写在点线上；空着的也留一条点线
  const end = (x) => (/[。！？.!?]$/.test(x) ? x : x + "。");
  const fields = [
    ["Originally", "原本", it.origin],
    ["Provenance and Period", "来处与时期", [it.year ? `约 ${it.year} 年` : "", ymd(it.bought) && `${ymd(it.bought)} 入手`, it.price ? it.price + " 元" : ""].filter(Boolean).join("，")],
    ["Fabric", "材质", [it.composition, it.care].filter(Boolean).join("，")],
    ["Style Description", "描述", it.story ? end(`${it.colorName || ""}${name}，${it.story}`) : end(`${it.colorName || ""}${name}`)],
  ];
  const replica = `<div class="label back-label replica">
    <div class="rh">${T("REPLICA", "rp")}<span class="rno">${T(noStr(it.no), "b")}</span></div>
    <div class="rsub">${T("一件衣服，和它经过的地方与时间。", "s")}</div>
    ${fields.map(([en, zh, v]) => `<div class="rf"><span class="rk">${T(en + " " + zh + "：", "s b")}</span><div class="ra">${v ? T(v, "m") : "&nbsp;"}</div></div>`).join("")}
    <div class="rfoot">${T(`衣柜 ${noStr(it.no)} / ${total}`, "s")}</div>
  </div>`;
  const S = sizesFor(it.kind);
  const hasSizes = S.length && S.some(([k]) => it.sizes?.[k]);
  const diff = (k) => { const a = +it.sizes?.[k], c = +b.base?.[k]; return a && c ? a - c : null; };
  const wears = [...(it.wears || [])].sort().reverse();
  const el = page(`
    ${head({ backTo: `#/item/${it.id}`, backText: "正面", right: `${noStr(it.no)} · 背面` })}
    <div class="ghost"></div>
    ${replica}
    ${S.length ? `<section class="rel sizes" style="margin-top:34px">
      <div class="h2" style="display:inline-block">${T("* 尺寸  cm", "l b")}</div>
      ${hasSizes ? `<div class="table">
        <span></span>${S.map(([, n]) => `<span class="c">${T(n, "s")}</span>`).join("")}
        <span>${T("这一件", "s")}</span>${S.map(([k]) => `<span class="c">${T(it.sizes?.[k] || "—", "m")}</span>`).join("")}
        <span>${T("基准面", "s")}</span>${S.map(([k]) => `<span class="c">${T(b.base?.[k] || "—", "m")}</span>`).join("")}
        <span>${T("差", "s b")}</span>${S.map(([k]) => { const d = diff(k); return `<span class="c"><span class="d ${d != null && Math.abs(d) >= 2 ? "big" : ""}">${T(d == null ? "" : (d > 0 ? "+" : "") + d, "m b")}</span></span>`; }).join("")}
      </div>${(() => { const k = S.find(([k]) => { const d = diff(k); return d != null && Math.abs(d) >= 2; }); if (!k) return "";
        const d = diff(k[0]), word = { shoulder: ["宽", "窄"], chest: ["宽", "窄"], length: ["长", "短"], sleeve: ["长", "短"], waist: ["大", "小"], hip: ["大", "小"], inseam: ["长", "短"], hem: ["宽", "窄"] }[k[0]];
        return `<p class="dnote" style="text-align:right;margin:20px 6px 0 0">${T(`${k[1]}比基准面${d > 0 ? word[0] : word[1]} ${Math.abs(d)} cm。`, "m")}</p>`; })()}` : `<p>${T("还没量。在「修改内标」里填上，就能和「身体」页的基准面对照。", "m soft")}</p>`}
    </section>` : ""}
    <section class="rel wears" style="margin-top:28px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="h2">${T(`* 穿过 ${wears.length} 次`, "l b")}</span>${perWear(it) ? T("每次 " + perWear(it), "m") : ""}</div>
      <div class="dates">${wears.map((d) => `<button data-d="${d}">${T(md(d), "m", "d")}</button>`).join("") || T("还没穿过。", "m soft")}</div>
    </section>
    ${actions({ text: "修改内标", act: "edit", dark: true })}
  `, { detail: true });
  return {
    el,
    after() {
      drawHead(el);
      const gh = el.querySelector(".ghost");
      gh.style.top = el.querySelector(".head").offsetHeight + 30 + "px";
      gh.style.height = "560px";
      ink(gh, "gh" + it.id, (sh, box, W, H) => {
        sh.frame(2, 4, W - 2, H - 4);
        drawInBox(sh, it.kind, it.params || {}, [30, 150, W - 60, 330], { w: 0.9 });
      });
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
            const first = sec.querySelector(".d.big .ty"), note = sec.querySelector(".dnote .ty");
            if (first && note) { const c = box(first), n = box(note); sh.arrow([n.x + 10, n.y - 2], [c.cx + 6, c.b + 6], 0.45); }
          }
        });
      }
      onAct(el, { edit: () => go(`#/edit/${it.id}`) });
      for (const btn of el.querySelectorAll(".dates button")) btn.onclick = async () => {
        if (!(await confirmSheet(`删掉 ${ymd(btn.dataset.d)} 这一次？`, "删掉"))) return;
        it.wears = it.wears.filter((d) => d !== btn.dataset.d);
        await db.put("items", it);
        go("", "refresh");
      };
    },
  };
}
