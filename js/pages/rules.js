// 4 原则：六条打在一枚大内标上；下面每条一句怎么用，右边是「记」里对上了几条。改过的旧写法划掉留着。
// 页尾是备份：记录只在这台手机上，导出一个文件存到「文件」或 iCloud。
import { db, rules as getRules, exportAll, importAll } from "../db.js";
import { T, page, head, drawHead, ink, label, actions, onAct, ymd, go, esc, toast, confirmSheet, today } from "../ui.js";

const CN = ["", "第一版", "第二版", "第三版", "第四版", "第五版", "第六版", "第七版", "第八版", "第九版"];

export async function rules() {
  const rl = await getRules();
  const notes = await db.all("notes");
  const cnt = (k) => notes.filter((n) => n.rule === k).length;
  const lastBackup = await db.meta("lastBackup");
  const rows = [`${T("原则 :", "b")}`, null, ...rl.list.map((r, i) => `${T(String(i + 1), "b")}&nbsp;&nbsp;${T(r.text)}`), null, `. ${CN[rl.version] || "第 " + rl.version + " 版"} .`];
  const el = page(`
    ${head({ title: "原则", right: `定于 ${rl.set} · 可以改` })}
    ${label(rows, "rules-label")}
    <section class="rel hows" style="margin-top:34px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="h2">${T("* 怎么用", "l b")}</span>${T("记里对上的", "s")}</div>
      ${rl.list.map((r, i) => `<div class="how"><span class="n">${T(String(i + 1), "m b")}</span><div><div style="line-height:1.7">${T(r.how, "m")}</div>
        ${(r.history || []).map((hh) => `<div class="old"><span class="strk">${T(hh.text, "s")}</span> ${T(ymd(hh.date).slice(5) + " 改", "s soft")}</div>`).join("")}</div>
        ${T(cnt(i + 1) + " 条", "m b")}</div>`).join("")}
    </section>
    <section class="rel backup" style="margin-top:30px">
      <span class="h2">${T("* 备份", "l b")}</span>
      <p style="line-height:1.8;margin:12px 0">${T("所有记录只存在这台手机上，不上传。换手机、删 app 之前，先导出一份。", "m")}<br>${T(lastBackup ? "上次导出：" + ymd(lastBackup) : "还没导出过。", "s")}</p>
      <div class="linkrow"><button class="exp">${T("导出备份", "l b")}</button><label>${T("从备份恢复", "l b")}<input type="file" accept="application/json,.json" class="imp"></label></div>
      <div class="linkrow" style="margin-top:8px"><a href="help.html" style="padding:8px 0">${T("怎么用", "m")}</a><a href="privacy.html" style="padding:8px 0">${T("隐私说明", "m")}</a></div>
    </section>
    ${actions({ text: "改原则", act: "edit", dark: true })}
  `);
  return {
    el,
    after() {
      drawHead(el);
      for (const s of el.querySelectorAll("section.rel")) ink(s, "rs" + s.className, (sh, box) => {
        const hd = box(s.querySelector(".h2 .ty"));
        sh.underline(hd.x - 2, hd.r + 4, hd.b + 4, 0.6);
        for (const n of s.querySelectorAll(".how .n .ty")) { const b = box(n); sh.circle(b.cx, b.cy, 8.4, 0.6, 8); }
        for (const st of s.querySelectorAll(".strk .ty")) { const b = box(st); sh.strike(b.x - 2, b.r + 2, b.cy, 0.55); }
      });
      onAct(el, { edit: () => go("#/rules/edit") });
      el.querySelector(".exp").onclick = async () => {
        const blob = await exportAll();
        const name = `衣柜备份-${today()}.json`;
        const file = new File([blob], name, { type: "application/json" });
        try {
          if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
          else { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
          await db.setMeta("lastBackup", new Date().toISOString());
          toast("导出了");
        } catch (e) { if (e.name !== "AbortError") toast("没导出成功：" + e.message); }
      };
      el.querySelector(".imp").onchange = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!(await confirmSheet("用这份备份替换现在手机上的全部记录？", "替换"))) return;
        try { await importAll(await f.text()); toast("恢复好了"); go("#/", "reset"); } catch (err) { toast("恢复失败：" + err.message); }
      };
    },
  };
}

export async function rulesEdit() {
  const rl = await getRules();
  const el = page(`
    ${head({ backTo: "#/rules", backText: "原则", right: "改原则" })}
    <p style="margin:10px 0 6px;line-height:1.8">${T("改过的旧写法会划掉留着，看得出是怎么想过来的。", "m")}</p>
    <div class="form">${rl.list.map((r, i) => `<div style="margin-top:18px"><div style="display:flex;gap:10px;align-items:baseline">${T(String(i + 1), "l b")}
      <input class="field" data-i="${i}" data-k="text" value="${esc(r.text)}" style="font-size:14px"></div>
      <input class="field" data-i="${i}" data-k="how" value="${esc(r.how)}" placeholder="怎么用" style="margin-left:18px;width:calc(100% - 18px);font-size:12px"></div>`).join("")}
    </div>
    ${actions({ text: "存好", act: "save", dark: true })}
  `, { detail: true });
  return {
    el,
    after() {
      drawHead(el);
      onAct(el, { save: async () => {
        let changed = false;
        for (const f of el.querySelectorAll(".field")) {
          const r = rl.list[+f.dataset.i], v = f.value.trim();
          if (!v || r[f.dataset.k] === v) continue;
          if (f.dataset.k === "text") { r.history = [...(r.history || []), { text: r.text, date: new Date().toISOString() }]; changed = true; }
          r[f.dataset.k] = v;
        }
        if (changed) { rl.version = (rl.version || 1) + 1; const d = new Date(); rl.set = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`; }
        await db.setMeta("rules", rl);
        toast(changed ? "改好了，旧的留着" : "存好了");
        go("#/rules", "up");
      } });
    },
  };
}
