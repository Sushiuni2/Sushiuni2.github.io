// 衣服的类型、参数、面料、常用颜色
export const KINDS = {
  cardigan: { name: "开衫", cat: "上衣", top: true },
  tee: { name: "T恤", cat: "上衣", top: true },
  shirt: { name: "衬衫", cat: "上衣", top: true },
  jacket: { name: "夹克", cat: "外套", top: true },
  trousers: { name: "裤子", cat: "下装" },
  derby: { name: "鞋", cat: "鞋履" },
  chain: { name: "饰品", cat: "配饰" },
};
export const CATS = ["全部", "上衣", "外套", "下装", "鞋履", "配饰"];

// 开衫的参数（其余类型暂时只有一种画法）
export const PARAMS = {
  cardigan: [
    ["fit", "版型", [["slim", "修身"], ["regular", "常规"], ["boxy", "宽松"]], "regular"],
    ["length", "长度", [["cropped", "短"], ["regular", "常规"], ["long", "长"]], "regular"],
    ["neck", "领口", [["v", "V"], ["crew", "圆"]], "v"],
    ["sleeve", "袖长", [["long", "长"], ["three_quarter", "七分"]], "long"],
    ["buttons", "扣子", [[0, "无"], [4, "4"], [5, "5"], [6, "6"], [7, "7"]], 5],
    ["pockets", "口袋", [[false, "无"], [true, "有"]], false],
  ],
};
export function defaults(kind) {
  const o = {};
  for (const [k, , , d] of PARAMS[kind] || []) o[k] = d;
  return o;
}

export const FABRICS = [["knit", "针织"], ["linen", "麻 / 帆布"], ["poplin", "梭织 / 皮"], ["jersey", "平纹"]];
export const fabricName = (f) => (FABRICS.find((x) => x[0] === f) || [, ""])[1];

export const PALETTE = [
  ["白", [238, 236, 230]], ["米白", [226, 218, 200]], ["燕麦", [206, 196, 176]], ["浅蓝", [188, 202, 218]],
  ["雾蓝", [112, 128, 146]], ["藏青", [36, 44, 70]], ["炭灰", [72, 72, 76]], ["黑", [30, 30, 32]],
  ["深棕", [74, 54, 42]], ["橄榄", [92, 96, 62]], ["酒红", [96, 34, 40]], ["银", [196, 198, 202]],
];

const CN = ["无", "一", "两", "三", "四", "五", "六", "七", "八", "九"];
export function summary(it) {
  const p = it.params || {};
  if (it.kind === "cardigan") {
    const a = [];
    a.push((p.neck === "crew" ? "圆领" : "V 领") + (p.buttons ? `，${CN[p.buttons] || p.buttons}扣` : "，无扣"));
    const b = [];
    if (p.fit === "slim") b.push("修身"); if (p.fit === "boxy") b.push("宽松");
    if (p.length === "cropped") b.push("短款"); if (p.length === "long") b.push("长款");
    if (p.sleeve === "three_quarter") b.push("七分袖"); if (p.pockets) b.push("贴袋");
    if (b.length) a.push(b.join("，"));
    return a;
  }
  return [];
}

export const noStr = (n) => "No." + String(n ?? 0).padStart(2, "0");
export const TOP_SIZES = [["shoulder", "肩宽"], ["chest", "胸围"], ["length", "衣长"], ["sleeve", "袖长"]];
export const BOTTOM_SIZES = [["waist", "腰围"], ["hip", "臀围"], ["inseam", "裤长"], ["hem", "脚口"]];
export const sizesFor = (kind) => (KINDS[kind]?.top ? TOP_SIZES : kind === "trousers" ? BOTTOM_SIZES : []);
