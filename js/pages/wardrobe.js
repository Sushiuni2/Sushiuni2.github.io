// 1 衣柜：分类一行，当前分类笔划一道；两列，每件是一张照片（没有就是一张小稿），下面打编号和名字，旁边一小块面料。
import { db } from "../db.js";
import { T, page, head, drawHead, ink, figure, swatch, season, esc } from "../ui.js";
import { KINDS, CATS, noStr, fabricName } from "../kinds.js";

export async function wardrobe(_, q) {
  const cat = CATS.includes(q.c) ? q.c : "全部";
  const all = (await db.all("items")).filter((i) => !i.archived).sort((a, b) => b.no - a.no);
  const items = cat === "全部" ? all : all.filter((i) => KINDS[i.kind]?.cat === cat);
  const el = page(`
    ${head({ title: "衣柜", sub: `${all.length} 件`, right: season() })}
    <nav class="cats">${CATS.map((c) => `<a href="#/?c=${encodeURIComponent(c)}" class="${c === cat ? "on" : ""}" style="padding:6px 0">${T(c, c === cat ? "m b" : "m")}</a>`).join("")}
      <span class="grow" style="flex:1"></span><a href="#/new" class="add" style="padding:6px 0">${T("＋ 录一件", "m b")}</a></nav>
    ${items.length ? `<div class="grid">${items.map((it) => `
      <a class="card" href="#/item/${it.id}">
        <div class="fig" data-id="${it.id}"></div>
        <div class="cap"><span>${T(noStr(it.no), "s b")} ${T(it.name || KINDS[it.kind]?.name, "m b")}
          <span class="t2">${T([it.colorName, fabricName(it.fabric)].filter(Boolean).join(" · "), "s")}</span></span>
          ${swatch(it.color, it.fabric, { w: 30, h: 20, seed: it.id })}</div>
      </a>`).join("")}</div>`
      : `<div class="empty">${all.length ? T(`「${cat}」里还没有衣服。`, "m") : `${T("衣柜还是空的。", "l b")}<br>${T("拍一张你最常穿的那件，从它开始。", "m")}<br><br><a href="#/new">${T("＊ 录第一件", "l b")}</a>`}</div>`}
  `);
  return {
    el,
    after() {
      drawHead(el);
      const cats = el.querySelector(".cats");
      ink(cats, "cats" + cat, (sh, box, W) => {
        const on = cats.querySelector("a.on .ty");
        if (on) { const b = box(on); sh.pen([[b.x - 2, b.b + 3], [b.r + 3, b.b + 2.2]], 0.75, { over: 1, wob: 0.2 }); }
        const add = box(cats.querySelector(".add .ty"));
        sh.pen([[add.x - 1, add.b + 3], [add.r + 2, add.b + 3.4]], 0.45, { over: 0.5, wob: 0.2 });
        sh.rule(-2, W + 2, box(cats).b + 6, 0.45);
      });
      for (const f of el.querySelectorAll(".fig")) {
        const it = items.find((i) => i.id === f.dataset.id);
        figure(f, it, { w: 0.62, pad: 8 });
      }
    },
  };
}
