// 录一件 / 改一件：像一张印好的规格单，每行的选项打好了字，点一下就是用笔圈一个；上面的稿跟着重画。
// 必填只有类型和颜色；内标和尺寸可以以后再补。
import { db, uid, body as getBody, savePhoto, photoColor } from "../db.js";
import { T, page, head, drawHead, ink, figure, swatch, tape, tapes, toast, confirmSheet, go, esc, rgb } from "../ui.js";
import { KINDS, PARAMS, defaults, FABRICS, PALETTE, noStr, sizesFor } from "../kinds.js";

const KIND_ORDER = ["cardigan", "shirt", "jacket", "tee", "trousers", "derby", "chain"];

export async function edit([id], q = {}) {
  const items = await db.all("items");
  const nextNo = Math.max(0, ...items.map((i) => i.no || 0)) + 1;
  const old = id ? await db.get("items", id) : null;
  if (id && !old) throw new Error("找不到这件衣服");
  const it = old ? structuredClone(old) : {
    id: uid(), no: nextNo, kind: "cardigan", params: defaults("cardigan"), name: q.name || "", color: null, colorName: "",
    fabric: "knit", sizes: {}, wears: [], created: new Date().toISOString(), price: q.price ? +q.price : "", fromWish: q.wish || "",
  };
  const bd = await getBody();
  const palette = [...bd.colors.map((c) => [c.name, c.rgb]), ...PALETTE].filter((c, i, a) => a.findIndex((d) => d[0] === c[0]) === i);
  let photoCol = null;
  const total = items.filter((i) => !i.archived).length + (old ? 0 : 1);

  const optRow = (key, name, opts, val) => `<div class="row" data-key="${key}">${T(name, "m b")}<div class="opts">${opts.map(([v, n]) =>
    `<button class="opt ${String(v) === String(val) ? "on" : ""}" data-v="${esc(JSON.stringify(v))}">${T(n, "l")}</button>`).join("")}</div></div>`;
  const field = (key, name, ph = "", type = "text") => `<div class="row">${T(name, "m b")}<input class="field" data-f="${key}" type="${type}" placeholder="${esc(ph)}" value="${esc(it[key] ?? "")}" ${type === "number" ? 'inputmode="decimal"' : ""}></div>`;

  const el = page(`
    ${head({ backTo: old ? `#/item/${it.id}` : "#/", backText: old ? "正面" : "衣柜", right: `${old ? "修改" : "新的一件"} · ${noStr(it.no)}` })}
    <section class="preview"><div class="ptitle">${T("", "xl b")}</div><div class="fig"></div></section>
    <div class="form">
      <div class="row">${T("照片", "m b")}<div class="linkrow">
        <label>${T("拍一张", "l")}<input type="file" accept="image/*" capture="environment" data-photo></label>
        <label>${T("从相册选", "l")}<input type="file" accept="image/*" data-photo></label>
        <button class="rmphoto ${it.photo ? "" : "hide"}">${T("去掉", "l soft")}</button></div></div>
      <div class="kindrow">${optRow("kind", "类型", KIND_ORDER.map((k) => [k, KINDS[k].name]), it.kind)}</div>
      <div class="params"></div>
      ${field("name", "名字", "比如：藏青开衫")}
      <div class="row" style="align-items:start;padding-top:12px">${T("颜色", "m b")}<div><div class="chips colors"></div>
        <input class="field" data-f="colorName" placeholder="颜色的名字" value="${esc(it.colorName || "")}" style="margin-top:4px"></div></div>
      ${optRow("fabric", "面料", FABRICS, it.fabric)}
      <button class="more">${T("＋ 内标和尺寸（可以以后再补）", "m b")}</button>
      <div class="extra hide">
        ${field("origin", "来处", "闲鱼、某家店、朋友给的…")}
        ${field("year", "年代", "比如 2019", "number")}
        <div class="row">${T("入手", "m b")}<input class="field" data-f="bought" type="date" value="${esc((it.bought || "").slice(0, 10))}"></div>
        ${field("price", "价格", "元", "number")}
        ${field("composition", "成分", "羊毛 70 / 尼龙 30")}
        ${field("care", "洗护", "冷水手洗，平铺阴干")}
        <div class="row" style="align-items:start">${T("故事", "m b")}<textarea class="field" data-f="story" placeholder="它有什么来历？换过纽扣？谁送的？">${esc(it.story || "")}</textarea></div>
        <div class="sizes"></div>
      </div>
      <p style="margin:18px 0 0">${T("* 只有类型和颜色要填，其余可以以后再补。", "s")}</p>
      ${old ? `<p style="margin:16px 0 0"><button class="del">${T("删掉这件", "m soft")}</button></p>` : ""}
    </div>
    ${tapes(tape(old ? "不改了" : "不录了", { act: "cancel", seed: 1, rot: -0.7 }), tape(old ? "存好" : "收进衣柜", { dark: true, act: "save", seed: 2, rot: 0.6 }))}
  `, { detail: true });

  const $ = (s) => el.querySelector(s);
  const circleRow = (row) => ink(row, "o" + row.dataset.key + row.querySelector(".on")?.dataset.v, (sh, box) => {
    const on = row.querySelector(".opt.on .ty");
    if (on) { const b = box(on); sh.circle(b.cx, b.cy, Math.max(b.w / 2 + 7, 11), 0.6, Math.max(9.5, b.h / 2 + 4)); }
    sh.rule(0, box(row).w, box(row).h - 1, 0.3);
  }, 10);

  const preview = () => {
    const nm = it.name || KINDS[it.kind].name;
    $(".ptitle").innerHTML = T("* " + nm, "xl b");
    ink($(".preview"), "pv" + it.id, (sh, box, W, H) => {
      sh.frame(1, 3, W - 1, H - 3);
      const t = box($(".ptitle .ty"));
      sh.underline(t.x - 2, t.r - 2, t.b + 1, 0.75);
    });
    figure($(".preview .fig"), it, { w: 0.85, pad: 8 });
  };

  const renderParams = () => {
    const P = PARAMS[it.kind] || [];
    $(".params").innerHTML = P.map(([k, n, opts]) => optRow(k, n, opts, it.params?.[k])).join("");
    for (const r of el.querySelectorAll(".params .row")) circleRow(r);
    const S = sizesFor(it.kind);
    $(".sizes").innerHTML = S.length ? `<div class="row" style="align-items:start;padding-top:10px">${T("尺寸", "m b")}<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${S.map(([k, n]) =>
      `<label>${T(n, "s")}<input class="field" data-size="${k}" inputmode="decimal" placeholder="cm" value="${esc(it.sizes?.[k] ?? "")}"></label>`).join("")}</div></div>` : "";
  };

  const renderColors = () => {
    const cur = it.color ? it.color.join(",") : "";
    const list = [...(photoCol ? [["照片里的", photoCol]] : []), ...palette];
    $(".colors").innerHTML = list.map(([n, c]) => `<button class="chip ${c.join(",") === cur ? "on" : ""}" data-c="${c.join(",")}" data-n="${esc(n)}">${swatch(c, it.fabric, { w: 30, h: 20, seed: n })}${T(n, "s")}</button>`).join("")
      + `<label class="chip">${T("自己调", "s b")}<input type="color" data-custom style="display:block;width:30px;height:20px;border:0;padding:0;background:none" value="#${(it.color || [128, 128, 128]).map((v) => v.toString(16).padStart(2, "0")).join("")}"></label>`;
    ink($(".colors"), "col" + cur, (sh, box) => {
      const on = $(".colors .chip.on .sw");
      if (on) { const b = box(on); sh.tick(b.x + 4, b.b + 18, 0.7); }
    }, 10);
  };

  return {
    el,
    after() {
      drawHead(el);
      for (const r of el.querySelectorAll(".form > .row[data-key], .kindrow .row")) circleRow(r);
      renderParams(); renderColors(); preview();
      el.addEventListener("click", async (e) => {
        const opt = e.target.closest(".opt");
        if (opt) {
          const row = opt.closest(".row"), key = row.dataset.key, v = JSON.parse(opt.dataset.v);
          row.querySelectorAll(".opt").forEach((o) => o.classList.toggle("on", o === opt));
          if (key === "kind") {
            if (it.kind !== v) { it.kind = v; it.params = defaults(v); if (!old && v === "derby") it.fabric = "poplin"; }
            renderParams();
          } else if (key === "fabric") { it.fabric = v; renderColors(); }
          else { it.params = { ...it.params, [key]: v }; }
          circleRow(row);
          preview();
          return;
        }
        const chip = e.target.closest(".chip[data-c]");
        if (chip) {
          it.color = chip.dataset.c.split(",").map(Number);
          const nameF = $('[data-f="colorName"]');
          if (!nameF.value || palette.some((p) => p[0] === nameF.value) || nameF.value === "照片里的") { nameF.value = chip.dataset.n === "照片里的" ? "" : chip.dataset.n; it.colorName = nameF.value; }
          renderColors();
          return;
        }
        if (e.target.closest(".more")) { $(".extra").classList.toggle("hide"); return; }
        if (e.target.closest(".rmphoto")) { it.photo = null; photoCol = null; $(".rmphoto").classList.add("hide"); renderColors(); preview(); return; }
        if (e.target.closest(".del")) {
          if (!(await confirmSheet(`删掉 ${noStr(it.no)} ${it.name || KINDS[it.kind].name}？删了就找不回来了。`, "删掉"))) return;
          await db.del("items", it.id);
          if (it.photo) await db.del("photos", it.photo);
          go("#/");
          return;
        }
        const act = e.target.closest("[data-act]")?.dataset.act;
        if (act === "cancel") go(old ? `#/item/${it.id}` : "#/");
        if (act === "save") {
          if (!it.color) { toast("选一个颜色"); $(".colors").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
          for (const f of el.querySelectorAll("[data-f]")) it[f.dataset.f] = f.type === "number" ? (f.value === "" ? "" : +f.value) : f.value.trim();
          it.sizes = {};
          for (const f of el.querySelectorAll("[data-size]")) if (f.value.trim()) it.sizes[f.dataset.size] = +f.value;
          it.updated = new Date().toISOString();
          await db.put("items", it);
          if (it.fromWish) { const w = await db.get("wishes", it.fromWish); if (w) { w.status = "bought"; w.itemId = it.id; w.closed = new Date().toISOString(); await db.put("wishes", w); } }
          toast(old ? "存好了" : `收进衣柜 · ${noStr(it.no)}`);
          go(`#/item/${it.id}`);
        }
      });
      el.addEventListener("input", (e) => {
        if (e.target.dataset.f === "name") { it.name = e.target.value.trim(); $(".ptitle").innerHTML = T("* " + (it.name || KINDS[it.kind].name), "xl b"); preview(); }
        if (e.target.dataset.f === "colorName") it.colorName = e.target.value.trim();
        if (e.target.matches("[data-custom]")) {
          const v = e.target.value; it.color = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
          el.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
        }
      });
      for (const inp of el.querySelectorAll("[data-photo]")) inp.addEventListener("change", async () => {
        const f = inp.files?.[0];
        if (!f) return;
        toast("正在放进来…");
        it.photo = await savePhoto(f);
        photoCol = await photoColor(it.photo).catch(() => null);
        if (photoCol && !it.color) { it.color = photoCol; }
        $(".rmphoto").classList.remove("hide");
        renderColors(); preview();
      });
    },
  };
}
