// 历史记录。底部的六页（记、衣柜、搭配、想买、原则、身体）是「根」：在它们之间切换不留历史；
// 点进一件衣服、一条记录是往里走一层；返回是往外退一层。退回到根以后，再右滑就没有可退的了。
// 自己维护一份和浏览器历史一一对应的栈（history.state.i 是层数）。

let stack = [], idx = 0, handler = () => {}, busy = false, want = null;
const path = (h) => (h || "#/").split("?")[0];

export const current = () => stack[idx] || location.hash || "#/";
export const depth = () => idx;

export function init(onRoute) {
  handler = onRoute;
  const start = location.hash || "#/";
  // 在浏览器里打开时，最底下垫一层：退到它就自动回来，这样从根再右滑也不会离开 app。
  // 装到主屏幕的 app 里，最底下本来就没有东西，不用垫。
  const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  if (!standalone && !history.state?.root) { history.replaceState({ i: -1 }, "", start); history.pushState({ i: 0, root: 1 }, "", start); }
  else history.replaceState({ i: 0, root: 1 }, "", start);
  stack = [start]; idx = 0;
  addEventListener("popstate", (e) => {
    if (busy) return;
    if (e.state?.i === -1) { history.go(1); return; }
    const ni = e.state?.i ?? 0, dir = ni < idx ? "back" : "push";
    if (ni === idx && stack[idx] === (location.hash || "#/")) return;   // 从垫底那层弹回来，不用重画
    idx = ni;
    stack[idx] = location.hash || "#/";
    if (want && want !== stack[idx]) { stack[idx] = want; history.replaceState({ ...history.state, i: idx }, "", want); }   // 退回去以后要的是同一页的另一个筛选
    want = null;
    handler(dir);
  });
  handler("tab");
}

// 往里走一层
export function push(hash) {
  stack = stack.slice(0, idx + 1);
  stack.push(hash); idx = stack.length - 1;
  history.pushState({ i: idx }, "", hash);
  handler("push");
}

// 原地换掉（筛选、刷新）
export function replace(hash, dir = "none") {
  stack[idx] = hash;
  history.replaceState({ i: idx }, "", hash);
  handler(dir);
}

export const refresh = () => handler("none");

const waitPop = () => new Promise((r) => addEventListener("popstate", r, { once: true }));

// 退到最底，再按 paths 一层层排好（切换底部六页时 paths 只有一项）
export async function reset(paths, dir = "tab") {
  busy = true;
  if (idx > 0) { const p = waitPop(); history.go(-idx); await p; }
  idx = 0;
  history.replaceState({ i: 0, root: 1 }, "", paths[0]);
  stack = [paths[0]];
  for (const h of paths.slice(1)) { stack.push(h); idx = stack.length - 1; history.pushState({ i: idx }, "", h); }
  busy = false;
  handler(dir);
}

// 往外退到 target：历史里有它就退回去（中间的几层一起丢掉）；没有，就把这一层换成它
export function up(target) {
  for (let k = idx - 1; k >= 0; k--) if (path(stack[k]) === path(target)) { want = target.includes("?") ? target : null; history.go(k - idx); return; }
  replace(target, "back");
}
