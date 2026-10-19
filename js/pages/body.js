// 5 身体：一只人台，身上为难的地方用箭头拉出来写怎么穿；下面是「基准面」（最合身那件量来的尺寸，单品背面拿它来对），
// 适合的颜色，和体重。
import { db, body as getBody } from "../db.js";
import { T, page, head, drawHead, ink, swatch, tape, tapes, md, today, go, esc, toast } from "../ui.js";
import { stockman } from "../garments.js";
import { TOP_SIZES, BOTTOM_SIZES, PALETTE } from "../kinds.js";

const PARTS = [["head", "头围"], ["shoulder", "肩宽"], ["waist", "腰围"], ["calf", "小腿围"]];

export async function body() {
  const b = await getBody();
  const w = b.weights?.length ? b.weights[b.weights.length - 1].kg : b.weight;
  const note = (k, label) => {
    const n = b.notes?.[k];
    if (!n?.title && !n?.how) return "";
    const t = `${label}${b[k] ? " " + b[k] : ""}${n.title ? " · " + n.title : ""}`;
    return `<div class="note" data-k="${k}">${T((k === "calf" ? "* " : "") + t, "m b")}<div>${T(n.how || "", "s")}</div></div>`;
  };
  const tbl = (S) => `<span></span>${S.map(([, n]) => `<span class="c">${T(n, "s")}</span>`).join("")}`;
  const val = (S) => S.map(([k]) => `<span class="c">${T(b.base?.[k] || "—", "m")}</span>`).join("");
  const el = page(`
    ${head({ title: "身体", right: b.height ? `${b.height} cm${w ? ` · ${w} kg` : ""}` : "还没填" })}
    <section class="stock">${PARTS.some(([k]) => b.notes?.[k]?.title || b.notes?.[k]?.how) ? PARTS.map(([k, n]) => note(k, n)).join("")
      : `<div class="note" data-k="calf">${T("这里写你的身体。", "m b")}<div style="line-height:1.8">${T("点下面的「改数据」：填身高、肩宽、腰围，", "s")}<br>${T("再写哪里偏宽、偏窄、怎么穿。", "s")}</div></div>`}</section>
    <section class="rel base" style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="h2">${T("* 基准面  cm", "l b")}</span>${T("从最合身的那件量来", "s")}</div>
      <div class="table">${tbl(TOP_SIZES)}<span>${T("上衣", "s b")}</span>${val(TOP_SIZES)}</div>
      <div class="table">${tbl(BOTTOM_SIZES)}<span>${T("裤子", "s b")}</span>${val(BOTTOM_SIZES)}</div>
    </section>
    <section class="rel" style="margin-top:18px;display:grid;grid-template-columns:64px 1fr;align-items:start">
      <span style="padding-top:4px">${T(b.skin || "颜色", "s b")}</span>
      <div class="colors">${(b.colors || []).map((c) => `<span class="chip">${swatch(c.rgb, c.fabric, { w: 26, h: 17, seed: c.name })}${T(c.name, "s")}</span>`).join("")}</div>
    </section>
    ${b.weights?.length ? `<section style="margin-top:22px">${T("* 体重", "m b")}<div class="dates" style="grid-template-columns:repeat(4,1fr)">${b.weights.slice(-8).reverse().map((x) => `<span>${T(md(x.date), "s")} ${T(x.kg + "", "m b")}</span>`).join("")}</div></section>` : ""}
    ${tapes(tape("改数据", { act: "edit", seed: 2, rot: -0.5 }), tape("记体重", { dark: true, act: "weigh", seed: 0, rot: 0.5 }))}
  `);
  return {
    el,
    after() {
      drawHead(el);
      const st = el.querySelector(".stock");
      // 右边几条从上往下排，人台在左边
      const notes = [...st.querySelectorAll(".note")];
      let y = 8;
      for (const n of notes) { n.style.top = y + "px"; y += n.offsetHeight + 22; }
      ink(st, "stock", (sh, box) => {
        const S = 0.92, pts = stockman(sh, 72, 14, S);
        const tgt = { head: pts.head, shoulder: pts.shoulder, waist: pts.waist };
        for (const n of notes) {
          const k = n.dataset.k;
          if (!tgt[k]) continue;
          const b = box(n.firstElementChild);
          sh.arrow([b.x - 6, b.cy], [tgt[k][0] + 6, tgt[k][1]], 0.45);
        }
      });
      const bs = el.querySelector(".base");
      ink(bs, "base", (sh, box, W) => {
        const hd = box(bs.querySelector(".h2 .ty"));
        sh.underline(hd.x - 2, hd.r + 4, hd.b + 4, 0.6);
        sh.rule(0, W, box(bs).h + 2, 0.32);
      });
      el.querySelector('[data-act="edit"]').onclick = () => go("#/body/edit");
      el.querySelector('[data-act="weigh"]').onclick = () => go("#/body/edit?w=1");
    },
  };
}

export async function bodyEdit(_, q = {}) {
  const b = await getBody();
  const f = (path, name, ph = "", wide = false) => {
    const v = path.split(".").reduce((o, k) => o?.[k], b) ?? "";
    return `<label style="${wide ? "grid-column:1/-1" : ""}">${T(name, "s b")}<input class="field" data-p="${path}" ${wide ? "" : 'inputmode="decimal"'} placeholder="${esc(ph)}" value="${esc(v)}"></label>`;
  };
  const el = page(`
    ${head({ backTo: "#/body", backText: "身体", right: q.w ? "记体重" : "改数据" })}
    <div class="form" style="margin-top:12px">
      <div class="row">${T("今天", "m b")}<input class="field wtoday" inputmode="decimal" placeholder="今天的体重 kg（可以不填）"></div>
      <p style="margin:20px 0 6px">${T("* 身体  cm", "l b")}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px 10px">${f("height", "身高")}${f("weight", "体重")}${PARTS.map(([k, n]) => f(k, n)).join("")}${f("chest", "胸围")}${f("hip", "臀围")}</div>
      <p style="margin:24px 0 6px">${T("* 怎么穿（人台旁边的话）", "l b")}</p>
      ${PARTS.map(([k, n]) => `<div style="margin-top:10px">${f(`notes.${k}.title`, n, "比如：偏窄", true)}${f(`notes.${k}.how`, "怎么穿", "", true)}</div>`).join("")}
      <p style="margin:24px 0 6px">${T("* 基准面（最合身那件的尺寸）", "l b")}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px 10px">${[...TOP_SIZES, ...BOTTOM_SIZES].map(([k, n]) => f("base." + k, n, "cm")).join("")}</div>
      <p style="margin:24px 0 6px">${T("* 适合的颜色（点一下加上 / 去掉）", "l b")}</p>
      <div class="chips cpick">${PALETTE.map(([n, c]) => `<button class="chip ${b.colors.some((x) => x.name === n) ? "on" : ""}" data-n="${n}" data-c="${c}">${swatch(c, "knit", { w: 26, h: 17, seed: n })}${T(n, "s")}</button>`).join("")}</div>
    </div>
    ${tapes(tape("不改了", { act: "cancel", seed: 1, rot: 0.5 }), tape("存好", { dark: true, act: "save", seed: 2, rot: -0.6 }))}
  `, { detail: true });
  const drawPick = () => {
    const cp = el.querySelector(".cpick");
    ink(cp, "cp" + [...cp.querySelectorAll(".on")].map((x) => x.dataset.n).join(""), (sh, box) => {
      for (const c of cp.querySelectorAll(".chip.on .sw")) { const r = box(c); sh.tick(r.x + 2, r.b + 18, 0.6); }
    }, 10);
  };
  return {
    el,
    after() {
      drawHead(el); drawPick();
      if (q.w) setTimeout(() => el.querySelector(".wtoday").focus(), 300);
      el.querySelector(".cpick").onclick = (e) => { const c = e.target.closest(".chip"); if (c) { c.classList.toggle("on"); drawPick(); } };
      el.querySelector('[data-act="cancel"]').onclick = () => go("#/body");
      el.querySelector('[data-act="save"]').onclick = async () => {
        for (const inp of el.querySelectorAll("[data-p]")) {
          const ks = inp.dataset.p.split("."), last = ks.pop();
          let o = b;
          for (const k of ks) o = o[k] = o[k] || {};
          const v = inp.value.trim();
          o[last] = v !== "" && !isNaN(+v) && !inp.dataset.p.startsWith("notes") ? +v : v;
        }
        b.colors = [...el.querySelectorAll(".cpick .chip.on")].map((c) => {
          const old = b.colors.find((x) => x.name === c.dataset.n);
          return old || { name: c.dataset.n, rgb: c.dataset.c.split(",").map(Number), fabric: "knit" };
        });
        const wt = +el.querySelector(".wtoday").value;
        if (wt) {
          b.weights = (b.weights || []).filter((x) => x.date !== today());
          b.weights.push({ date: today(), kg: wt });
          b.weight = wt;
        }
        await db.setMeta("body", b);
        toast("存好了");
        go("#/body");
      };
    },
  };
}
