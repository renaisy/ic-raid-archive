const SLOTS = [
  ["HEAD", "头部"], ["NECK", "颈部"], ["SHOULDER", "肩部"], ["BACK", "背部"],
  ["CHEST", "胸部"], ["WRIST", "手腕"], ["HANDS", "手部"], ["WAIST", "腰部"],
  ["LEGS", "腿部"], ["FEET", "脚部"], ["FINGER1", "戒指 1"], ["FINGER2", "戒指 2"],
  ["TRINKET1", "饰品 1"], ["TRINKET2", "饰品 2"], ["MAINHAND", "主手"], ["OFFHAND", "副手"],
];

const SLOT_LABEL = Object.fromEntries(SLOTS);
const RSVP_LABEL = { in: "能来", out: "请假", maybe: "待定" };
const MARK_LABEL = { player: "获奖者", bank: "公会银行", de: "分解" };
const TABS = [
  ["home", "首页"],
  ["week", "本周"],
  ["calendar", "周历"],
  ["history", "记录"],
  ["fair", "公平"],
  ["cover", "覆盖"],
  ["notes", "备忘"],
  ["rules", "团规"],
  ["tactics", "战术"],
];
const SEASON_TABS = new Set(["calendar", "history", "fair", "cover"]);
const EPIC = "#a335ee";
const QUALITY_HEX = {
  poor: "#9d9d9d",
  common: "#ffffff",
  uncommon: "#1eff00",
  rare: "#0070dd",
  epic: "#a335ee",
  legendary: "#ff8000",
  artifact: "#e6cc80",
};

const state = {
  token: localStorage.getItem("icra_token") || "",
  role: localStorage.getItem("icra_role") || "",
  name: localStorage.getItem("icra_name") || "",
  week: "",
  data: null,
  season: null,
  error: "",
  notice: "",
  tab: sessionStorage.getItem("icra_tab") || "home",
  calYear: 0,
  calMonth: 0,
  calDate: "",
  histMode: "week",
  histGroup: "char",
  histChar: "",
  rangeMode: "week",
  boardChar: "",
  journalBoss: "",
};

function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function ckey(name) {
  return String(name || "").toLowerCase().replace(/[\s'-]/g, "");
}

function ymdParts(ymd) {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  return { y, m, d };
}

function fmtYmd(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function weekOfDate(ymd) {
  const { y, m, d } = ymdParts(ymd);
  if (!y || !m || !d) return "";
  const t = Date.UTC(y, m - 1, d);
  const wday = new Date(t).getUTCDay();
  const back = (wday - 4 + 7) % 7;
  const w = new Date(t - back * 86400000);
  return fmtYmd(w.getUTCFullYear(), w.getUTCMonth() + 1, w.getUTCDate());
}

function addDays(ymd, n) {
  const { y, m, d } = ymdParts(ymd);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return fmtYmd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function todayYmd() {
  const n = new Date();
  const cst = new Date(n.getTime() + 8 * 3600 * 1000);
  return fmtYmd(cst.getUTCFullYear(), cst.getUTCMonth() + 1, cst.getUTCDate());
}

function mondayOfDate(ymd) {
  const { y, m, d } = ymdParts(ymd);
  if (!y || !m || !d) return "";
  const t = Date.UTC(y, m - 1, d);
  const wday = new Date(t).getUTCDay();
  const back = (wday + 6) % 7;
  const w = new Date(t - back * 86400000);
  return fmtYmd(w.getUTCFullYear(), w.getUTCMonth() + 1, w.getUTCDate());
}

function calendarGrid(year, month) {
  const start = mondayOfDate(fmtYmd(year, month, 1));
  const days = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i);
    const p = ymdParts(date);
    days.push({
      date,
      day: p.d,
      inMonth: p.m === month,
      week: weekOfDate(date),
    });
  }
  return days;
}

async function api(path, opts) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers.Authorization = "Bearer " + state.token;
  const res = await fetch(path, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `${res.status} ${path}`);
  return body;
}

function linkQuality(link) {
  const m = String(link || "").match(/\|cff([0-9a-fA-F]{6})/i);
  return m ? "#" + m[1] : EPIC;
}

function linkName(link) {
  const m = String(link || "").match(/\|h\[([^\]]+)\]\|h/);
  return m ? m[1] : "";
}

function lootCatalog() {
  return (state.data && state.data.loot) || { instance: {}, bosses: [], items: {} };
}

function lootItem(id) {
  const items = lootCatalog().items || {};
  return items[String(id)] || null;
}

function raidBosses() {
  return lootCatalog().bosses || [];
}

function raidInstanceName() {
  return lootCatalog().instance && lootCatalog().instance.nameZh
    ? lootCatalog().instance.nameZh
    : "剧毒深渊";
}

function itemLabel(id, link) {
  const meta = lootItem(id);
  return (meta && (meta.nameZh || meta.nameEn)) || linkName(link) || ("#" + id);
}

function itemColor(id, link) {
  const meta = lootItem(id);
  return (meta && QUALITY_HEX[meta.quality]) || linkQuality(link);
}

function itemIcon(id) {
  const icon = lootItem(id) && lootItem(id).icon;
  if (!icon) return "";
  return `<img src="https://wow.zamimg.com/images/wow/icons/small/${esc(icon)}.jpg" alt="" />`;
}

function wowheadHref(id) {
  return `https://www.wowhead.com/cn/item=${id}`;
}

function itemChip(id, link, compact) {
  if (!id) return `<span class="muted">—</span>`;
  return `<a class="item-chip${compact ? " compact" : ""}" href="${wowheadHref(id)}" target="_blank" rel="noreferrer" data-wowhead="item=${id}&domain=cn" style="--q:${itemColor(id, link)}">
    ${itemIcon(id)}<span class="item-name">${esc(itemLabel(id, link))}</span>
  </a>`;
}

function journalCatalog() {
  return (state.data && state.data.journal) || { instance: {}, bosses: [] };
}

function journalEntry(id) {
  return (journalCatalog().bosses || []).find((b) => b.id === id) || null;
}

function currentJournalId() {
  const lootIds = raidBosses().map((b) => b.id);
  const journalIds = (journalCatalog().bosses || []).map((b) => b.id);
  if (state.journalBoss && (lootIds.includes(state.journalBoss) || journalIds.includes(state.journalBoss))) {
    return state.journalBoss;
  }
  return lootIds[0] || journalIds[0] || "";
}

function tacticNoteFor(boss) {
  const list = ((state.data && state.data.guild && state.data.guild.tactics) || []);
  const names = new Set([boss && boss.nameZh, boss && boss.nameEn, boss && boss.id].filter(Boolean));
  return list.find((t) => names.has(t.name)) || { name: (boss && boss.nameZh) || "", note: "" };
}

function abilityTagKind(label) {
  if (label === "灭团") return "wipe";
  if (label === "坦克") return "tank";
  if (label === "治疗") return "heal";
  if (label === "重要") return "warn";
  return "";
}

function mergeCatalogBosses(current) {
  const cur = (current || []).map((b) => ({ name: b.name, down: !!b.down }));
  const names = new Set(cur.map((b) => b.name));
  const seen = new Set();
  for (const b of raidBosses()) {
    if (names.has(b.nameZh) || names.has(b.nameEn) || names.has(b.id)) seen.add(b.id);
  }
  for (const b of raidBosses()) {
    if (seen.has(b.id)) continue;
    const name = b.nameZh || b.nameEn;
    if (!name || names.has(name)) continue;
    cur.push({ name, down: false });
    names.add(name);
  }
  return cur;
}

function refreshWowhead() {
  const wh = window.$WowheadPower;
  if (wh && typeof wh.refreshLinks === "function") {
    try { wh.refreshLinks(); } catch (_) {}
  }
}

function tag(text, kind) {
  return `<span class="tag${kind ? " " + kind : ""}">${esc(text)}</span>`;
}

function markTag(mark) {
  const m = mark || "player";
  const kind = m === "bank" ? "bank" : m === "de" ? "de" : "";
  return tag(MARK_LABEL[m] || MARK_LABEL.player, kind);
}

function shortName(full) {
  return String(full || "?").split("-")[0];
}

function markLabel(mark) {
  return MARK_LABEL[mark] || MARK_LABEL.player;
}

function allNights() {
  const map = {};
  const push = (n, week) => {
    if (!n || !n.date || !n.id) return;
    map[n.id] = { ...n, week: n.week || week };
  };
  // Season first, then the week just written, so a failed /api/season refresh
  // cannot overwrite fresher signups from the current snapshot.
  if (state.season) (state.season.nights || []).forEach((n) => push(n));
  if (state.data) (state.data.nights || []).forEach((n) => push(n, state.data.week));
  return Object.values(map);
}

function nightsOn(date) {
  return allNights().filter((n) => n.date === date).sort((a, b) => String(a.time).localeCompare(b.time));
}

function rsvpOfWeek(week) {
  if (state.data && state.data.week === week) return state.data.rsvp || {};
  const row = (state.season && state.season.rsvps || []).find((r) => r.week === week);
  return (row && row.rsvp) || {};
}

function awardsForRange() {
  const d = state.data;
  if (state.histMode === "week" || !state.season) {
    return Object.values((d && d.awards) || {}).map((a) => ({ ...a, week: d.week }));
  }
  return (state.season.awards || []).slice();
}

function fairAwards() {
  const d = state.data;
  if (state.rangeMode === "week" || !state.season) {
    return Object.values((d && d.awards) || {}).map((a) => ({ ...a, week: d.week }));
  }
  return (state.season.awards || []).slice();
}

function ensureCalCursor() {
  if (state.calYear) return;
  const src = state.calDate || (state.data && state.data.week) || todayYmd();
  const p = ymdParts(src);
  state.calYear = p.y;
  state.calMonth = p.m;
  if (!state.calDate && state.data) state.calDate = state.data.week;
}

function renderLogin() {
  const root = document.getElementById("app");
  root.innerHTML = "";
  const box = el(`<div class="login-page">
    <div class="login card">
      <div class="brand"><span class="brand-mark">ZOO</span><h1>海加尔 · ZOO</h1></div>
      <p class="muted lead">国服海加尔公会专属档案。角色可只填名字，默认补「-海加尔」。游戏内 <code>/icrc export</code> 或 <code>/icrl export</code> 复制后贴到本周页。</p>
      <label>角色名</label>
      <input id="name" placeholder="只填名字即可" value="${esc(shortName(state.name) === "?" ? "" : shortName(state.name))}" />
      <label>邀请码</label>
      <input id="code" type="password" placeholder="团长 ic-lead / 队员 ic-raid" />
      <p class="err" id="err"></p>
      <div class="row" style="margin-top:14px"><button id="go">进入公会</button></div>
    </div>
  </div>`);
  root.appendChild(box);
  box.querySelector("#go").onclick = async () => {
    box.querySelector("#err").textContent = "";
    try {
      const out = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          name: box.querySelector("#name").value,
          code: box.querySelector("#code").value,
        }),
      });
      state.token = out.token;
      state.role = out.role;
      state.name = out.name;
      state.week = out.week;
      localStorage.setItem("icra_token", out.token);
      localStorage.setItem("icra_role", out.role);
      localStorage.setItem("icra_name", out.name);
      await load();
    } catch (e) {
      box.querySelector("#err").textContent = e.message;
    }
  };
}

function slotMap(intent) {
  const m = {};
  for (const s of (intent && intent.slots) || []) m[s.slotKey] = s;
  return m;
}

function slotDots(intent) {
  const m = slotMap(intent);
  return `<span class="dots">${SLOTS.map(([key, label]) => {
    const s = m[key];
    if (s && s.itemId) {
      return `<a class="dot on" title="${esc(label)}" href="${wowheadHref(s.itemId)}" target="_blank" rel="noreferrer" data-wowhead="item=${s.itemId}&domain=cn"></a>`;
    }
    return `<span class="dot" title="${esc(label)}"></span>`;
  }).join("")}</span>`;
}

function slotDetail(intent) {
  const m = slotMap(intent);
  return `<div class="board-detail">${SLOTS.map(([key, label]) => {
    const s = m[key];
    return `<div><span class="slot-lab">${esc(label)}</span>${s ? itemChip(s.itemId, null, true) : `<span class="muted">空</span>`}</div>`;
  }).join("")}</div>`;
}

function bindShell(wrap) {
  wrap.querySelector("#week").onchange = (e) => load(e.target.value);
  wrap.querySelector("#out").onclick = () => {
    localStorage.removeItem("icra_token");
    state.token = state.role = "";
    state.data = null;
    state.season = null;
    renderLogin();
  };
  wrap.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.onclick = () => gotoTab(btn.getAttribute("data-tab"));
  });
}

function shellHtml(d) {
  const lead = state.role === "lead";
  const weekOpts = (d.weeks || [d.week]).map((w) =>
    `<option value="${esc(w)}"${w === d.week ? " selected" : ""}>${esc(w)}</option>`).join("");
  const tabs = TABS.map(([id, label]) =>
    `<button type="button"${state.tab === id ? " class=\"on\"" : ""} data-tab="${id}">${label}</button>`
  ).join("");
  return `<div class="wrap">
    <header class="bar">
      <div class="brand">
        <span class="brand-mark">ZOO</span>
        <h1>${esc((d.guild && d.guild.name) || "ZOO")}</h1>
        <span class="who">国服${esc((d.guild && d.guild.realm) || "海加尔")} · ${esc(state.name)} · ${lead ? "团长" : "队员"}</span>
      </div>
      <div class="bar-right">
        <select id="week">${weekOpts}</select>
        <button class="ghost" id="out">退出</button>
      </div>
    </header>
    <nav class="tabs">${tabs}</nav>
    <p class="err" id="err">${esc(state.error)}</p>
    <p class="ok" id="ok">${esc(state.notice)}</p>
    <div id="page"></div>
  </div>`;
}

function render() {
  const d = state.data;
  if (!d) return renderLogin();
  const root = document.getElementById("app");
  root.innerHTML = "";
  root.appendChild(el(shellHtml(d)));
  const wrap = root.querySelector(".wrap");
  const page = wrap.querySelector("#page");
  bindShell(wrap);
  const view = {
    home: renderHome,
    week: renderWeek,
    calendar: renderCalendar,
    history: renderHistory,
    fair: renderFair,
    cover: renderCover,
    notes: renderNotes,
    rules: renderRules,
    tactics: renderTactics,
  }[state.tab] || renderHome;
  view(page, d);
  refreshWowhead();
}

function nightLine(n, withDate) {
  const parts = [];
  if (withDate && n.date) parts.push(n.date);
  if (n.time) parts.push(n.time);
  if (n.title) parts.push(n.title);
  if (n.instance) parts.push(n.instance);
  return parts.join(" · ") || "时间未定";
}

function nightSummary(d) {
  const nights = d.nights || [];
  if (!nights.length) return "未标";
  return nights.map((n) => nightLine(n, true)).join("；");
}

function memoExcerpt(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const lines = raw.split(/\r?\n/).filter((l) => l.trim()).slice(0, 3).join("\n");
  return lines.length > 180 ? lines.slice(0, 180) + "…" : lines;
}

function renderHome(page, d) {
  const g = d.guild || {};
  const missing = d.missing || [];
  const nights = d.nights || [];
  const bosses = d.bosses || [];
  const excerpt = memoExcerpt(d.memo);

  page.appendChild(el(`<div class="card">
    <h2>国服${esc(g.realm || "海加尔")} · ${esc(g.name || "ZOO")}</h2>
    <p class="muted">本周 ${esc(d.week)}。导入和手填在「本周」页。</p>
    <div class="jumps">
      <button type="button" class="ghost" data-jump="week">本周看板</button>
      <button type="button" class="ghost" data-jump="notes">指挥备忘</button>
      <button type="button" class="ghost" data-jump="rules">团规</button>
      <button type="button" class="ghost" data-jump="tactics">战术</button>
    </div>
  </div>`));

  page.appendChild(el(`<div class="grid two">
    <div class="card">
      <h2>本周开团</h2>
      ${nights.length ? `<ul class="plain">${nights.map((n) => {
        const sc = n.signupCounts || { in: 0, out: 0, maybe: 0 };
        return `<li>${esc(nightLine(n, true))}
          <span class="muted"> · 能来 ${sc.in} · 请假 ${sc.out} · 待定 ${sc.maybe}</span></li>`;
      }).join("")}</ul>` : `<p class="muted">还没有开团夜。团长到「周历」标具体日期和时间。</p>`}
    </div>
    <div class="card">
      <h2>进度</h2>
      ${bosses.length ? `<table><tbody>${bosses.map((b) => `<tr>
        <td>${esc(b.name)}</td>
        <td>${b.down ? tag("已击杀", "ok") : tag("未击杀", "warn")}</td>
      </tr>`).join("")}</tbody></table>` : `<p class="muted">还没有 Boss。团长可在「本周」一键填入${esc(raidInstanceName())} 8 王。</p>`}
    </div>
  </div>`));

  page.appendChild(el(`<div class="grid two">
    <div class="card">
      <h2>未登记</h2>
      <p>${missing.length ? missing.map((n) => tag(n, "warn")).join(" ") : (d.roster.length ? "名单里的人都登记了。" : "还没有名册。团长在「本周」保存名单后会跨周沿用。")}</p>
    </div>
    <div class="card">
      <h2>指挥备忘</h2>
      ${excerpt ? `<p class="memo-preview">${esc(excerpt)}</p>` : `<p class="muted">本周还没有备忘。</p>`}
      <div class="jumps"><button type="button" class="ghost" data-jump="notes">查看全文</button></div>
    </div>
  </div>`));

  page.querySelectorAll("[data-jump]").forEach((btn) => {
    btn.onclick = () => gotoTab(btn.getAttribute("data-jump"));
  });
}

function awardMarkSelect(a) {
  const cur = a.mark || "player";
  return `<select class="mark" data-mark="${esc(a.uid)}">${
    Object.keys(MARK_LABEL).map((k) =>
      `<option value="${k}"${k === cur ? " selected" : ""}>${MARK_LABEL[k]}</option>`
    ).join("")
  }</select>`;
}

function renderWeek(page, d) {
  const lead = state.role === "lead";
  const intentList = Object.values(d.intents || {});
  const awards = Object.values(d.awards || {}).sort((a, b) => (b.awardedAt || 0) - (a.awardedAt || 0));
  const missing = d.missing || [];
  const nightList = d.nights || [];
  const c = nightList.reduce((acc, n) => {
    const sc = n.signupCounts || {};
    acc.in += sc.in || 0;
    acc.out += sc.out || 0;
    acc.maybe += sc.maybe || 0;
    return acc;
  }, { in: 0, out: 0, maybe: 0 });

  page.appendChild(el(`<div class="stats">
    <div class="stat"><span class="k">开团夜</span><span class="v">${esc(nightSummary(d))}</span></div>
    <div class="stat"><span class="k">能来 / 请假 / 待定</span><span class="v">${c.in} / ${c.out} / ${c.maybe}</span></div>
    <div class="stat"><span class="k">已登记</span><span class="v">${intentList.length}${d.roster.length ? " / " + d.roster.length : ""}</span></div>
    <div class="stat"><span class="k">未登记</span><span class="v">${missing.length}</span></div>
    <div class="stat"><span class="k">分配</span><span class="v">${awards.length}</span></div>
  </div>`));

  const rows = intentList.length ? intentList.map((i) => {
    const key = ckey(i.char);
    const open = state.boardChar === key;
    return `<tr class="board-row" data-board="${esc(key)}">
      <td>${esc(shortName(i.char))}</td>
      <td>${slotDots(i)}</td>
      <td>${(i.slots || []).length}/16</td>
      <td class="muted">${i.at ? new Date(i.at * 1000).toLocaleString() : ""}</td>
    </tr>${open ? `<tr><td colspan="4">${slotDetail(i)}</td></tr>` : ""}`;
  }).join("") : `<tr><td colspan="4" class="muted">还没有意向。队员用 /icrc export 或下面手填。</td></tr>`;

  page.appendChild(el(`<div class="card">
    <h2>本周看板</h2>
    ${missing.length ? `<p class="err">未登记：${missing.map(esc).join("、")}</p>` : ""}
    <table>
      <thead><tr><th>角色</th><th>部位</th><th>栏位</th><th>时间</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`));

  const mine = d.intents[ckey(state.name)]
    || Object.values(d.intents).find((i) => i.char === state.name);
  const mineSlots = slotMap(mine);
  const formRows = SLOTS.map(([key, label]) => {
    const cur = mineSlots[key];
    return `<label class="slot-cell${cur ? " filled" : ""}">
      <span class="slot-lab">${label}</span>
      ${cur ? itemChip(cur.itemId, null, true) : `<span class="muted">空</span>`}
      <input data-slot="${key}" placeholder="物品 ID" value="${cur ? esc(cur.itemId) : ""}" />
    </label>`;
  }).join("");

  page.appendChild(el(`<div class="grid two">
    <div class="card">
      <h2>我的意向${lead ? "（或代登记）" : ""}</h2>
      <details class="import">
        <summary>粘贴队员端 /icrc export</summary>
        <textarea id="intentPaste" placeholder="ICRC1:intent:{...}"></textarea>
        <div class="row" style="margin-top:8px"><button id="importIntent">导入意向</button></div>
      </details>
      ${lead ? `<label>代登记角色</label><input id="asChar" placeholder="${esc(state.name)}" />` : ""}
      <div class="slot-grid" id="slotForm">${formRows}</div>
      <div class="row" style="margin-top:12px"><button id="saveIntent">保存手填意向</button></div>
    </div>
    <div class="card">
      <h2>进度</h2>
      <p class="muted">只记团本王。导入分配会回填；团长也可手改或一键填入。</p>
      <div id="bosses"></div>
      ${lead ? `<label>新增 Boss</label><div class="row">
        <input id="newBoss" list="raidBossList" placeholder="Boss 名" />
        <datalist id="raidBossList">${raidBosses().map((b) => `<option value="${esc(b.nameZh || b.nameEn)}"></option>`).join("")}</datalist>
        <button class="ghost" id="addBoss">加上</button>
      </div>
      <div class="row" style="margin-top:8px"><button class="ghost" id="fillRaidBosses">填入${esc(raidInstanceName())} 8 王</button></div>` : ""}
      ${lead ? `<details class="import"><summary>公会名册（跨周沿用，可只写名字）</summary>
        <textarea id="roster">${esc((d.roster || []).join("\n"))}</textarea>
        <div class="row" style="margin-top:8px"><button class="ghost" id="saveRoster">保存名单</button></div>
      </details>` : ""}
    </div>
  </div>`));

  const bossBox = page.querySelector("#bosses");
  if (!(d.bosses || []).length) {
    bossBox.innerHTML = `<p class="muted">还没有 Boss。导入带 boss 字段的分配，或团长手加。</p>`;
  } else {
    bossBox.innerHTML = `<table><tbody>${d.bosses.map((b, i) => `<tr>
      <td>${esc(b.name)}</td>
      <td>${b.down ? tag("已击杀", "ok") : tag("未击杀", "warn")}</td>
      ${lead ? `<td><button class="ghost" data-toggle="${i}">切换</button></td>` : ""}
    </tr>`).join("")}</tbody></table>`;
  }

  page.appendChild(el(`<div class="card">
    <h2>本周分配</h2>
    ${lead ? `<details class="import">
      <summary>粘贴团长端 /icrl export</summary>
      <textarea id="lootPaste" placeholder="ICRC1:loot:{...}"></textarea>
      <div class="row" style="margin-top:8px"><button id="importLoot">导入分配</button></div>
    </details>` : `<p class="muted">由团长导入。同一 uid 再导入会更新，不会重复记账。</p>`}
    <table>
      <thead><tr><th>物品</th><th>获奖</th><th>Boss</th><th>交付</th><th>去向</th></tr></thead>
      <tbody>${awards.length ? awards.map((a) => `<tr>
        <td>${itemChip(a.itemId, a.itemLink)}</td>
        <td>${esc(shortName(a.winner))}</td>
        <td class="muted">${esc(a.boss || "—")}</td>
        <td>${a.traded ? tag("已交付", "ok") : tag("未交付", "warn")}</td>
        <td>${lead ? awardMarkSelect(a) : markTag(a.mark)}</td>
      </tr>`).join("") : `<tr><td colspan="5" class="muted">本周还没有分配记录。</td></tr>`}</tbody>
    </table>
  </div>`));

  bindWeekActions(page, d);
}

function bindWeekActions(page, d) {
  const lead = state.role === "lead";
  const importIntent = page.querySelector("#importIntent");
  if (importIntent) importIntent.onclick = () => importText(page.querySelector("#intentPaste").value);
  const lootBtn = page.querySelector("#importLoot");
  if (lootBtn) lootBtn.onclick = () => importText(page.querySelector("#lootPaste").value);

  page.querySelectorAll("[data-board]").forEach((row) => {
    row.onclick = (e) => {
      if (e.target.closest("a")) return;
      const key = row.getAttribute("data-board");
      state.boardChar = state.boardChar === key ? "" : key;
      render();
    };
  });

  page.querySelector("#saveIntent").onclick = async () => {
    const slots = [];
    page.querySelectorAll("#slotForm [data-slot]").forEach((inp) => {
      const id = Number(inp.value);
      if (id) slots.push({ slotKey: inp.getAttribute("data-slot"), itemId: id, priority: "bis" });
    });
    try {
      const asChar = page.querySelector("#asChar");
      await afterWrite(await api("/api/intent", {
        method: "POST",
        body: JSON.stringify({ week: d.week, slots, char: asChar && asChar.value }),
      }), "意向已保存");
    } catch (e) {
      fail(e);
    }
  };

  const saveRoster = page.querySelector("#saveRoster");
  if (saveRoster) {
    saveRoster.onclick = async () => {
      try {
        await afterWrite(await api("/api/roster", {
          method: "POST",
          body: JSON.stringify({ week: d.week, text: page.querySelector("#roster").value }),
        }), "名单已保存");
      } catch (e) {
        fail(e);
      }
    };
  }

  page.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.onclick = async () => {
      const i = Number(btn.getAttribute("data-toggle"));
      const bosses = d.bosses.map((b, j) => ({ ...b, down: j === i ? !b.down : b.down }));
      await saveBosses(bosses);
    };
  });
  const addBoss = page.querySelector("#addBoss");
  if (addBoss) {
    addBoss.onclick = async () => {
      const name = page.querySelector("#newBoss").value.trim();
      if (!name) return;
      await saveBosses([...(d.bosses || []), { name, down: false }]);
    };
  }
  const fillRaid = page.querySelector("#fillRaidBosses");
  if (fillRaid) {
    fillRaid.onclick = async () => {
      await saveBosses(mergeCatalogBosses(d.bosses));
    };
  }

  if (lead) {
    page.querySelectorAll("select[data-mark]").forEach((sel) => {
      sel.onchange = () => setAwardMark(d.week, sel.getAttribute("data-mark"), sel.value);
    });
  }
}

function nightSignupBlock(n, myName) {
  const rows = Object.values(n.signups || {});
  const groups = { in: [], out: [], maybe: [] };
  for (const r of rows) {
    if (groups[r.status]) groups[r.status].push(r);
  }
  const mine = rows.find((r) => ckey(r.char) === ckey(myName));
  const sc = n.signupCounts || { in: groups.in.length, out: groups.out.length, maybe: groups.maybe.length };
  const people = (list) => list.length
    ? `<ul class="signup-list">${list.map((r) =>
      `<li>${esc(shortName(r.char))}${r.note ? `<span class="muted"> · ${esc(r.note)}</span>` : ""}</li>`
    ).join("")}</ul>`
    : `<p class="muted">还没有人</p>`;
  return `<div class="night-signup">
    <h3>${esc(nightLine(n))}</h3>
    <p class="muted">能来 ${sc.in} · 请假 ${sc.out} · 待定 ${sc.maybe}。你现在：${
      mine ? tag(RSVP_LABEL[mine.status], mine.status === "in" ? "ok" : mine.status === "out" ? "warn" : "") : tag("未报名")
    }</p>
    <div class="row" style="margin:8px 0 12px">
      <button type="button"${mine && mine.status === "in" ? "" : " class=\"ghost\""} data-rsvp="in" data-night="${esc(n.id)}" data-week="${esc(n.week || "")}">能来</button>
      <button type="button"${mine && mine.status === "out" ? "" : " class=\"ghost\""} data-rsvp="out" data-night="${esc(n.id)}" data-week="${esc(n.week || "")}">请假</button>
      <button type="button"${mine && mine.status === "maybe" ? "" : " class=\"ghost\""} data-rsvp="maybe" data-night="${esc(n.id)}" data-week="${esc(n.week || "")}">待定</button>
    </div>
    <label>附言（可选）</label>
    <input data-rsvp-note="${esc(n.id)}" value="${esc(mine && mine.note || "")}" placeholder="比如迟到、只打前两个" />
    <div class="signup-cols">
      <div><h4>能来</h4>${people(groups.in)}</div>
      <div><h4>请假</h4>${people(groups.out)}</div>
      <div><h4>待定</h4>${people(groups.maybe)}</div>
    </div>
  </div>`;
}

function renderCalendar(page, d) {
  const lead = state.role === "lead";
  ensureCalCursor();
  const grid = calendarGrid(state.calYear, state.calMonth);
  const today = todayYmd();
  const heads = ["一", "二", "三", "四", "五", "六", "日"]
    .map((h) => `<div class="cal-hd">${h}</div>`).join("");
  const cells = grid.map((cell) => {
    const marks = nightsOn(cell.date);
    const labels = marks.map((n) => n.title || n.time || "开团").slice(0, 3);
    const cls = [
      "cal-cell",
      cell.inMonth ? "" : "out",
      marks.length ? "has-raid" : "",
      cell.date === state.calDate ? "on" : "",
      cell.date === today ? "today" : "",
    ].filter(Boolean).join(" ");
    return `<button type="button" class="${cls}" data-day="${esc(cell.date)}" title="${esc(marks.map((n) => nightLine(n)).join(" / "))}">
      <span class="cal-num">${cell.day}</span>
      ${labels.length ? `<span class="cal-marks">${labels.map((t) => `<span class="cal-mark">${esc(t)}</span>`).join("")}</span>` : ""}
    </button>`;
  }).join("");

  const date = state.calDate || d.week;
  const week = weekOfDate(date) || d.week;
  const nights = nightsOn(date);
  const proxyNames = new Set();
  if (d.week === week) {
    (d.roster || []).forEach((n) => proxyNames.add(n));
    Object.values(d.intents || {}).forEach((i) => i.char && proxyNames.add(i.char));
  }
  nights.forEach((n) => Object.values(n.signups || {}).forEach((r) => r.char && proxyNames.add(r.char)));
  const rosterOpts = [...proxyNames].map((n) =>
    `<option value="${esc(n)}">${esc(n)}</option>`).join("");

  page.appendChild(el(`<div class="card">
    <div class="cal-nav">
      <button type="button" class="ghost" id="calPrev">上一月</button>
      <h2>${state.calYear} 年 ${state.calMonth} 月</h2>
      <button type="button" class="ghost" id="calNext">下一月</button>
    </div>
    <p class="muted">周四 5 点换新 CD。团长把具体开团日和时间标上（比如周四 21:00、周五 22:00）。点那天报名，名单所有人可见。</p>
    <div class="cal">${heads}${cells}</div>
  </div>`));

  page.appendChild(el(`<div class="grid two">
    <div class="card">
      <h2>${esc(date)} · 开团</h2>
      <p class="muted">所在周 ${esc(week)}</p>
      ${nights.length ? nights.map((n) => `<div class="night">
        <div><strong>${esc(n.title || n.time || "开团")}</strong> ${esc([n.time, n.instance].filter(Boolean).join(" · "))}</div>
        ${n.note ? `<div class="muted">${esc(n.note)}</div>` : ""}
        ${lead ? `<div class="row" style="margin-top:8px"><button class="ghost" data-del-night="${esc(n.id)}">删除这场</button></div>` : ""}
      </div>`).join("") : `<p class="muted">这天还没有开团。团长在下面加上时间和副本。</p>`}
      ${lead ? `<div class="night-form">
        <label>标题</label>
        <input id="nightTitle" placeholder="M1-3" />
        <label>集合时间</label>
        <input id="nightTime" placeholder="21:00" />
        <label>副本</label>
        <input id="nightInst" placeholder="剧毒深渊" />
        <label>备注</label>
        <input id="nightNote" placeholder="集合石 / 语音" />
        <div class="row" style="margin-top:10px"><button id="addNight">把这天标成开团</button></div>
      </div>` : ""}
    </div>
    <div class="card">
      <h2>报名 · ${esc(date)}</h2>
      ${nights.length ? `${lead ? `<label>代标队员</label>
        <select id="rsvpAs"><option value="">自己</option>${rosterOpts}</select>` : ""}
        ${nights.map((n) => nightSignupBlock(n, state.name)).join("")}`
        : `<p class="muted">团长标了这场开团之后，才能按日期报名。</p>`}
    </div>
  </div>`));

  page.querySelector("#calPrev").onclick = () => shiftCal(-1);
  page.querySelector("#calNext").onclick = () => shiftCal(1);
  page.querySelectorAll("[data-day]").forEach((btn) => {
    btn.onclick = () => selectCalDate(btn.getAttribute("data-day"));
  });
  page.querySelectorAll("[data-rsvp]").forEach((btn) => {
    btn.onclick = () => {
      const as = page.querySelector("#rsvpAs");
      const who = as && as.value ? as.value : undefined;
      const nightId = btn.getAttribute("data-night");
      const nightWeek = btn.getAttribute("data-week") || week;
      const noteEl = page.querySelector(`[data-rsvp-note="${nightId}"]`);
      saveRsvp(nightWeek, btn.getAttribute("data-rsvp"), noteEl ? noteEl.value : "", who, nightId);
    };
  });
  const addNight = page.querySelector("#addNight");
  if (addNight) {
    addNight.onclick = () => saveNight({
      date,
      week,
      title: page.querySelector("#nightTitle").value,
      time: page.querySelector("#nightTime").value,
      instance: page.querySelector("#nightInst").value,
      note: page.querySelector("#nightNote").value,
    });
  }
  page.querySelectorAll("[data-del-night]").forEach((btn) => {
    btn.onclick = () => deleteNight(btn.getAttribute("data-del-night"), week);
  });
}

function rangeToggle(modeKey, current) {
  return `<div class="seg">
    <button type="button"${current === "week" ? " class=\"on\"" : ""} data-${modeKey}="week">本周</button>
    <button type="button"${current === "season" ? " class=\"on\"" : ""} data-${modeKey}="season">本赛季</button>
  </div>`;
}

function renderHistory(page, d) {
  const awards = awardsForRange().sort((a, b) => (b.awardedAt || 0) - (a.awardedAt || 0));
  const byChar = {};
  const byBoss = {};
  for (const a of awards) {
    const key = ckey(a.winner) || "unknown";
    if (!byChar[key]) byChar[key] = { char: a.winner || "未写获奖者", items: [] };
    byChar[key].items.push(a);
    const boss = a.boss || "未写 Boss";
    if (!byBoss[boss]) byBoss[boss] = [];
    byBoss[boss].push(a);
  }
  const charKeys = Object.keys(byChar).sort((a, b) => byChar[b].items.length - byChar[a].items.length);
  const pick = state.histChar && byChar[state.histChar] ? state.histChar : "";

  let body = "";
  if (state.histGroup === "boss") {
    const bosses = Object.keys(byBoss).sort();
    body = bosses.length ? bosses.map((boss) => `<tbody>
      <tr class="group"><th colspan="5">${esc(boss)} · ${byBoss[boss].length} 件</th></tr>
      ${byBoss[boss].map((a) => histRow(a)).join("")}
    </tbody>`).join("") : `<tbody><tr><td colspan="5" class="muted">这段时间没有分配。</td></tr></tbody>`;
  } else {
    body = charKeys.length ? charKeys.map((key) => `<tbody>
      <tr class="group"><th colspan="5"><button type="button" class="link" data-hist-char="${esc(key)}">${esc(byChar[key].char)}</button> · ${byChar[key].items.length} 件</th></tr>
      ${pick === key ? byChar[key].items.map((a) => histRow(a)).join("") : ""}
    </tbody>`).join("") : `<tbody><tr><td colspan="5" class="muted">这段时间没有分配。同一 uid 已去重。</td></tr></tbody>`;
  }

  const detail = pick ? `<div class="card">
    <h2>${esc(byChar[pick].char)} 拿到的物品</h2>
    <ul class="plain">${byChar[pick].items.map((a) =>
      `<li>${itemChip(a.itemId, a.itemLink)} · ${esc(a.boss || "—")} · ${markTag(a.mark)} · ${esc(a.week || d.week)}</li>`
    ).join("")}</ul>
  </div>` : "";

  page.appendChild(el(`<div class="card">
    <h2>分配记录</h2>
    <p class="muted">本赛季从 ${esc((state.season && state.season.from) || d.seasonStart || "2026-08-13")} 起。物品链到 Wowhead。同一 uid 只记一次。按人时点角色名展开物品。</p>
    ${rangeToggle("hist-mode", state.histMode)}
    <div class="seg">
      <button type="button"${state.histGroup === "char" ? " class=\"on\"" : ""} data-hist-group="char">按人</button>
      <button type="button"${state.histGroup === "boss" ? " class=\"on\"" : ""} data-hist-group="boss">按 Boss</button>
    </div>
    <table>
      <thead><tr><th>物品</th><th>获奖</th><th>Boss</th><th>去向</th><th>周</th></tr></thead>
      ${body}
    </table>
  </div>`));
  if (detail) page.appendChild(el(detail));

  page.querySelectorAll("[data-hist-mode]").forEach((btn) => {
    btn.onclick = () => { state.histMode = btn.getAttribute("data-hist-mode"); state.histChar = ""; render(); };
  });
  page.querySelectorAll("[data-hist-group]").forEach((btn) => {
    btn.onclick = () => { state.histGroup = btn.getAttribute("data-hist-group"); render(); };
  });
  page.querySelectorAll("[data-hist-char]").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.getAttribute("data-hist-char");
      state.histChar = state.histChar === key ? "" : key;
      render();
    };
  });
}

function histRow(a) {
  return `<tr>
    <td>${itemChip(a.itemId, a.itemLink)}</td>
    <td><button type="button" class="link" data-hist-char="${esc(ckey(a.winner))}">${esc(shortName(a.winner))}</button></td>
    <td class="muted">${esc(a.boss || "—")}</td>
    <td>${markTag(a.mark)}</td>
    <td class="muted">${esc(a.week || "")}</td>
  </tr>`;
}

function renderFair(page, d) {
  const awards = fairAwards();
  const counts = {};
  for (const a of awards) {
    if ((a.mark || "player") !== "player") continue;
    const key = ckey(a.winner);
    if (!key) continue;
    if (!counts[key]) counts[key] = { char: a.winner, n: 0, traded: 0 };
    counts[key].n += 1;
    if (a.traded) counts[key].traded += 1;
  }
  const rows = Object.values(counts).sort((a, b) => b.n - a.n || a.char.localeCompare(b.char));
  const seasonAwards = (state.season && state.season.awards) || [];
  const awardedKeys = new Set(
    seasonAwards
      .filter((a) => (a.mark || "player") === "player" && a.winner)
      .map((a) => ckey(a.winner))
  );
  const none = Object.values(d.intents || {})
    .filter((i) => !awardedKeys.has(ckey(i.char)))
    .map((i) => i.char);
  const top = rows.slice(0, 5);

  page.appendChild(el(`<div class="card">
    <h2>公平计数</h2>
    <p class="muted">只统计标记为「获奖者」的条目。银行和分解不计入件数。这不是自动裁决，只是数字。</p>
    ${rangeToggle("range", state.rangeMode)}
    <table>
      <thead><tr><th>角色</th><th>件数</th><th>已交付</th></tr></thead>
      <tbody>${rows.length ? rows.map((r) => `<tr>
        <td>${esc(r.char)}</td><td>${r.n}</td><td>${r.traded}</td>
      </tr>`).join("") : `<tr><td colspan="3" class="muted">这段时间没有按人可计的分配。</td></tr>`}</tbody>
    </table>
  </div>`));

  page.appendChild(el(`<div class="grid two">
    <div class="card">
      <h2>本周登记了但赛季未分到</h2>
      <p class="muted">本周有意向，赛季分配里还没有这个角色。</p>
      <p>${none.length ? none.map((n) => tag(n)).join(" ") : "没有这样的人。"}</p>
    </div>
    <div class="card">
      <h2>拿得最多</h2>
      <p class="muted">按当前筛选的件数，只展示前几名。</p>
      ${top.length ? `<ol>${top.map((r) => `<li>${esc(shortName(r.char))} · ${r.n} 件</li>`).join("")}</ol>` : `<p class="muted">还没有数据。</p>`}
    </div>
  </div>`));

  page.querySelectorAll("[data-range]").forEach((btn) => {
    btn.onclick = () => { state.rangeMode = btn.getAttribute("data-range"); render(); };
  });
}

function renderCover(page, d) {
  const roster = d.roster || [];
  const missing = d.missing || [];
  const shortSlots = Object.values(d.intents || {})
    .map((i) => {
      const have = new Set((i.slots || []).map((s) => s.slotKey));
      const lack = SLOTS.filter(([k]) => !have.has(k)).map(([k]) => SLOT_LABEL[k] || k);
      return { char: i.char, n: (i.slots || []).length, lack, intent: i };
    })
    .filter((x) => x.n < 16);
  const rsvp = d.rsvp || {};
  const outOnRoster = roster.filter((n) => {
    const r = rsvp[ckey(n)];
    return r && r.status === "out";
  });

  page.appendChild(el(`<div class="card">
    <h2>名单覆盖</h2>
    <p class="muted">对照本周名单和意向。插件合同、在线状态网站拿不到，这里不做。</p>
    ${roster.length
      ? `<div class="stats">
          <div class="stat"><span class="k">名单</span><span class="v">${roster.length}</span></div>
          <div class="stat"><span class="k">已登记</span><span class="v">${Object.keys(d.intents || {}).length}</span></div>
          <div class="stat"><span class="k">未登记</span><span class="v">${missing.length}</span></div>
        </div>`
      : `<p class="err">还没有公会名册。团长在「本周」保存名单后会跨周沿用。</p>`}
  </div>`));

  page.appendChild(el(`<div class="grid two">
    <div class="card">
      <h2>未登记</h2>
      <p>${missing.length ? missing.map((n) => tag(n, "warn")).join(" ") : (roster.length ? "名单里的人都登记了。" : "—")}</p>
    </div>
    <div class="card">
      <h2>请假却仍在名单</h2>
      <p>${outOnRoster.length ? outOnRoster.map((n) => tag(n, "warn")).join(" ") : "没有。"}</p>
    </div>
  </div>`));

  page.appendChild(el(`<div class="card">
    <h2>已登记但不足 16 栏</h2>
    ${shortSlots.length ? `<table>
      <thead><tr><th>角色</th><th>部位</th><th>已填</th><th>缺栏</th></tr></thead>
      <tbody>${shortSlots.map((x) => `<tr>
        <td>${esc(x.char)}</td>
        <td>${slotDots(x.intent)}</td>
        <td>${x.n}/16</td>
        <td class="muted">${esc(x.lack.join("、"))}</td>
      </tr>`).join("")}</tbody>
    </table>` : `<p class="muted">没有缺栏，或还没有意向。</p>`}
  </div>`));
}

function renderNotes(page, d) {
  const lead = state.role === "lead";
  const awards = Object.values(d.awards || {}).sort((a, b) => (b.awardedAt || 0) - (a.awardedAt || 0));
  const prios = d.priorities || [];

  page.appendChild(el(`<div class="card">
    <h2>本周指挥备忘</h2>
    ${lead ? `<textarea id="memo">${esc(d.memo || "")}</textarea>
      <div class="row" style="margin-top:8px"><button id="saveMemo">保存备忘</button></div>`
      : `<p>${d.memo ? esc(d.memo).replace(/\n/g, "<br>") : `<span class="muted">团长还没写备忘。</span>`}</p>`}
  </div>`));

  page.appendChild(el(`<div class="card">
    <h2>下次优先</h2>
    <p class="muted">角色 + 物品 ID + 一句话。不当自动分配规则。</p>
    ${prios.length ? `<table>
      <thead><tr><th>角色</th><th>物品</th><th>原因</th>${lead ? "<th></th>" : ""}</tr></thead>
      <tbody>${prios.map((p, i) => `<tr>
        <td>${esc(p.char)}</td>
        <td>${itemChip(p.itemId)}</td>
        <td>${esc(p.reason || "")}</td>
        ${lead ? `<td><button class="ghost" data-del-prio="${i}">去掉</button></td>` : ""}
      </tr>`).join("")}</tbody>
    </table>` : `<p class="muted">还没有优先名单。</p>`}
    ${lead ? `<div class="grid three">
      <div><label>角色</label><input id="prioChar" placeholder="名字-服务器" /></div>
      <div><label>物品 ID</label><input id="prioItem" placeholder="271874" /></div>
      <div><label>原因</label><input id="prioReason" placeholder="上次没滚到" /></div>
    </div>
    <div class="row" style="margin-top:8px"><button id="addPrio">加上这条</button></div>` : ""}
  </div>`));

  page.appendChild(el(`<div class="card">
    <h2>分配去向</h2>
    <p class="muted">团长可标公会银行 / 分解。导入时默认「获奖者」。记录页跟着显示。</p>
    <table>
      <thead><tr><th>物品</th><th>获奖</th><th>去向</th></tr></thead>
      <tbody>${awards.length ? awards.map((a) => `<tr>
        <td>${itemChip(a.itemId, a.itemLink)}</td>
        <td>${esc(shortName(a.winner))}</td>
        <td>${lead ? awardMarkSelect(a) : markTag(a.mark)}</td>
      </tr>`).join("") : `<tr><td colspan="3" class="muted">本周还没有分配。</td></tr>`}</tbody>
    </table>
  </div>`));

  const saveMemo = page.querySelector("#saveMemo");
  if (saveMemo) {
    saveMemo.onclick = async () => {
      try {
        await afterWrite(await api("/api/memo", {
          method: "POST",
          body: JSON.stringify({ week: d.week, memo: page.querySelector("#memo").value }),
        }), "备忘已保存");
      } catch (e) { fail(e); }
    };
  }
  const addPrio = page.querySelector("#addPrio");
  if (addPrio) {
    addPrio.onclick = async () => {
      const next = prios.concat([{
        char: page.querySelector("#prioChar").value,
        itemId: Number(page.querySelector("#prioItem").value),
        reason: page.querySelector("#prioReason").value,
      }]);
      await savePriorities(d.week, next);
    };
  }
  page.querySelectorAll("[data-del-prio]").forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.getAttribute("data-del-prio"));
      savePriorities(d.week, prios.filter((_, j) => j !== i));
    };
  });
  if (lead) {
    page.querySelectorAll("select[data-mark]").forEach((sel) => {
      sel.onchange = () => setAwardMark(d.week, sel.getAttribute("data-mark"), sel.value);
    });
  }
}

function renderRules(page, d) {
  const lead = state.role === "lead";
  const rules = (d.guild && d.guild.rules) || "";
  page.appendChild(el(`<div class="card">
    <h2>团规与拾取说明</h2>
    <p class="muted">全公会共用，不跟某一周走。</p>
    ${lead ? `<textarea id="rules">${esc(rules)}</textarea>
      <div class="row" style="margin-top:8px"><button id="saveRules">保存团规</button></div>`
      : (rules ? `<p class="prose">${esc(rules)}</p>` : `<p class="muted">团长还没写团规。</p>`)}
  </div>`));
  const btn = page.querySelector("#saveRules");
  if (btn) {
    btn.onclick = async () => {
      try {
        await afterWrite(await api("/api/rules", {
          method: "POST",
          body: JSON.stringify({ week: d.week, rules: page.querySelector("#rules").value }),
        }), "团规已保存");
      } catch (e) { fail(e); }
    };
  }
}

function renderTactics(page, d) {
  const lead = state.role === "lead";
  const inst = journalCatalog().instance || {};
  const picks = raidBosses().length ? raidBosses() : (journalCatalog().bosses || []);
  const bossId = currentJournalId();
  const entry = journalEntry(bossId);
  const pick = picks.find((b) => b.id === bossId) || entry || {};
  const title = pick.nameZh || (entry && entry.nameZh) || raidInstanceName();
  const subtitle = pick.nameEn || (entry && entry.nameEn) || "";
  const note = tacticNoteFor({
    id: bossId,
    nameZh: title,
    nameEn: subtitle,
  });

  page.appendChild(el(`<div class="card">
    <h2>${esc(inst.nameZh || raidInstanceName())} · 12.1 手册</h2>
    ${inst.lore ? `<p>${esc(inst.lore)}</p>` : ""}
    ${inst.entrance ? `<p class="muted">入口：${esc(inst.entrance)}</p>` : ""}
    <p class="muted">英雄为主，史诗另标。不是排轴。完整图文看
      <a href="https://dreamforgewow.com/dungeon-journal" target="_blank" rel="noreferrer">梦工坊地下城手册</a>。
    </p>
    <div class="boss-picks">${picks.map((b) =>
      `<button type="button" class="ghost${b.id === bossId ? " on" : ""}" data-journal="${esc(b.id)}">${esc(b.nameZh || b.nameEn)}</button>`
    ).join("")}</div>
  </div>`));

  if (entry) {
    const roles = entry.roles || {};
    page.appendChild(el(`<div class="card journal-card">
      <h2>${esc(entry.nameZh)} <span class="muted" style="font-weight:500">${esc(entry.nameEn || "")}</span></h2>
      <p>${esc(entry.overview || "")}</p>
      ${(entry.wipe || []).length ? `<h3>常见灭团</h3><ul class="wipe">${entry.wipe.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
      <div class="role-grid">
        <div><h3>坦克</h3><ul>${(roles.tank || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h3>治疗</h3><ul>${(roles.healer || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h3>输出</h3><ul>${(roles.dps || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      </div>
      <h3>关键技能</h3>
      <div class="abilities">${(entry.abilities || []).map((a) => `<div class="ability">
        <div class="ability-head">
          <strong>${esc(a.nameZh)}</strong>
          ${a.nameEn ? `<span class="muted">${esc(a.nameEn)}</span>` : ""}
          ${a.tag ? tag(a.tag, abilityTagKind(a.tag)) : ""}
        </div>
        <p>${esc(a.text || "")}</p>
      </div>`).join("")}</div>
      ${(entry.mythic || []).length ? `<h3>史诗</h3><ul>${entry.mythic.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
    </div>`));
  } else {
    page.appendChild(el(`<div class="card"><p class="muted">还没有这只王的手册。</p></div>`));
  }

  page.appendChild(el(`<div class="card">
    <h2>ZOO 备注 · ${esc(title)}</h2>
    <p class="muted">团长写本团要点，和上面手册分开存。</p>
    ${lead ? `<textarea id="zooNote">${esc(note.note || "")}</textarea>
      <div class="row" style="margin-top:8px"><button id="saveTac">保存备注</button></div>`
      : (note.note ? `<p class="prose">${esc(note.note)}</p>` : `<p class="muted">团长还没写这只王的备注。</p>`)}
  </div>`));

  page.querySelectorAll("[data-journal]").forEach((btn) => {
    btn.onclick = () => {
      state.journalBoss = btn.getAttribute("data-journal");
      render();
    };
  });

  const save = page.querySelector("#saveTac");
  if (save) {
    save.onclick = async () => {
      const text = page.querySelector("#zooNote").value;
      const next = ((d.guild && d.guild.tactics) || []).slice();
      const names = new Set([title, subtitle, bossId].filter(Boolean));
      const i = next.findIndex((t) => names.has(t.name));
      const row = { name: title, note: text };
      if (i >= 0) next[i] = row;
      else next.push(row);
      try {
        await afterWrite(await api("/api/tactics", {
          method: "POST",
          body: JSON.stringify({ week: d.week, tactics: next }),
        }), "备注已保存");
      } catch (e) { fail(e); }
    };
  }
}

function fail(e) {
  state.error = e.message;
  state.notice = "";
  render();
}

async function afterWrite(data, notice) {
  state.data = data;
  state.week = data.week;
  state.notice = notice;
  state.error = "";
  if (state.season) {
    try {
      const from = data.seasonStart || state.season.from || "2026-08-13";
      state.season = await api("/api/season?from=" + encodeURIComponent(from));
    } catch (_) {}
  }
  render();
}

async function gotoTab(tab) {
  state.tab = tab;
  sessionStorage.setItem("icra_tab", tab);
  state.notice = "";
  if (SEASON_TABS.has(tab)) {
    try { await ensureSeason(); } catch (e) { state.error = e.message; }
  }
  render();
}

async function ensureSeason() {
  if (state.season) return;
  const from = (state.data && state.data.seasonStart) || "2026-08-13";
  state.season = await api("/api/season?from=" + encodeURIComponent(from));
}

async function saveBosses(bosses) {
  try {
    await afterWrite(await api("/api/bosses", {
      method: "POST",
      body: JSON.stringify({ week: state.data.week, bosses }),
    }), "进度已更新");
  } catch (e) { fail(e); }
}

async function importText(text) {
  try {
    const out = await api("/api/import", {
      method: "POST",
      body: JSON.stringify({ week: state.data.week, text }),
    });
    await afterWrite(out, out.imported != null ? `已导入 ${out.imported} 条分配（按 uid 去重）` : "意向已导入");
  } catch (e) { fail(e); }
}

async function setAwardMark(week, uid, mark) {
  try {
    await afterWrite(await api("/api/award-mark", {
      method: "POST",
      body: JSON.stringify({ week, uid, mark }),
    }), "去向已更新");
  } catch (e) { fail(e); }
}

async function savePriorities(week, priorities) {
  try {
    await afterWrite(await api("/api/priorities", {
      method: "POST",
      body: JSON.stringify({ week, priorities }),
    }), "优先名单已更新");
  } catch (e) { fail(e); }
}

async function saveRsvp(week, status, note, char, nightId) {
  try {
    await afterWrite(await api("/api/rsvp", {
      method: "POST",
      body: JSON.stringify({ week, status, note, char, nightId }),
    }), "报名已更新");
  } catch (e) { fail(e); }
}

async function saveNight(night) {
  try {
    await afterWrite(await api("/api/nights", {
      method: "POST",
      body: JSON.stringify({ action: "add", ...night }),
    }), "开团夜已加上");
  } catch (e) { fail(e); }
}

async function deleteNight(id, week) {
  try {
    await afterWrite(await api("/api/nights", {
      method: "POST",
      body: JSON.stringify({ action: "delete", id, week }),
    }), "开团夜已删除");
  } catch (e) { fail(e); }
}

function shiftCal(delta) {
  let y = state.calYear;
  let m = state.calMonth + delta;
  if (m < 1) { m = 12; y -= 1; }
  if (m > 12) { m = 1; y += 1; }
  state.calYear = y;
  state.calMonth = m;
  render();
}

async function selectCalDate(date) {
  state.calDate = date;
  const w = weekOfDate(date);
  if (w && state.data && state.data.week !== w) {
    await load(w);
    return;
  }
  render();
}

async function load(week) {
  try {
    state.data = await api("/api/state" + (week ? "?week=" + encodeURIComponent(week) : ""));
    state.week = state.data.week;
    state.error = "";
    if (SEASON_TABS.has(state.tab) || state.season) {
      try {
        const from = state.data.seasonStart || "2026-08-13";
        state.season = await api("/api/season?from=" + encodeURIComponent(from));
      } catch (_) {}
    }
    render();
  } catch (e) {
    if (e.message.includes("登录")) {
      state.token = "";
      renderLogin();
      return;
    }
    state.error = e.message;
    render();
  }
}

if (state.token) load();
else renderLogin();
