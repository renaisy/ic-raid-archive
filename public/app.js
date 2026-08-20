const SLOTS = [
  ["HEAD", "头部"], ["NECK", "颈部"], ["SHOULDER", "肩部"], ["BACK", "背部"],
  ["CHEST", "胸部"], ["WRIST", "手腕"], ["HANDS", "手部"], ["WAIST", "腰部"],
  ["LEGS", "腿部"], ["FEET", "脚部"], ["FINGER1", "戒指 1"], ["FINGER2", "戒指 2"],
  ["TRINKET1", "饰品 1"], ["TRINKET2", "饰品 2"], ["MAINHAND", "主手"], ["OFFHAND", "副手"],
];

const SLOT_LABEL = Object.fromEntries(SLOTS);
const WEEKLY_INTENT_LIMIT = 2;
const RSVP_LABEL = { in: "能来", out: "请假", maybe: "待定" };
const ROLE_LABEL = { tank: "坦克", healer: "治疗", dps: "输出" };
const ROLE_TAG = { tank: "tank", healer: "heal", dps: "" };
const CLASSES = [
  { id: "deathknight", name: "死亡骑士", color: "#C41E3A", specs: [
    { id: "blood", name: "鲜血", role: "tank" },
    { id: "frost", name: "冰霜", role: "dps" },
    { id: "unholy", name: "邪恶", role: "dps" },
  ]},
  { id: "demonhunter", name: "恶魔猎手", color: "#A330C9", specs: [
    { id: "havoc", name: "浩劫", role: "dps" },
    { id: "vengeance", name: "复仇", role: "tank" },
    { id: "devourer", name: "噬灭", role: "dps" },
  ]},
  { id: "druid", name: "德鲁伊", color: "#FF7D0A", specs: [
    { id: "balance", name: "平衡", role: "dps" },
    { id: "feral", name: "野性", role: "dps" },
    { id: "guardian", name: "守护", role: "tank" },
    { id: "restoration", name: "恢复", role: "healer" },
  ]},
  { id: "evoker", name: "唤魔师", color: "#33937F", specs: [
    { id: "devastation", name: "湮灭", role: "dps" },
    { id: "preservation", name: "恩护", role: "healer" },
    { id: "augmentation", name: "增辉", role: "dps" },
  ]},
  { id: "hunter", name: "猎人", color: "#AAD372", specs: [
    { id: "beastmastery", name: "野兽控制", role: "dps" },
    { id: "marksmanship", name: "射击", role: "dps" },
    { id: "survival", name: "生存", role: "dps" },
  ]},
  { id: "mage", name: "法师", color: "#3FC7EB", specs: [
    { id: "arcane", name: "奥术", role: "dps" },
    { id: "fire", name: "火焰", role: "dps" },
    { id: "frost", name: "冰霜", role: "dps" },
  ]},
  { id: "monk", name: "武僧", color: "#00FF98", specs: [
    { id: "brewmaster", name: "酒仙", role: "tank" },
    { id: "mistweaver", name: "织雾", role: "healer" },
    { id: "windwalker", name: "踏风", role: "dps" },
  ]},
  { id: "paladin", name: "圣骑士", color: "#F48CBA", specs: [
    { id: "holy", name: "神圣", role: "healer" },
    { id: "protection", name: "防护", role: "tank" },
    { id: "retribution", name: "惩戒", role: "dps" },
  ]},
  { id: "priest", name: "牧师", color: "#E8E8E8", specs: [
    { id: "discipline", name: "戒律", role: "healer" },
    { id: "holy", name: "神圣", role: "healer" },
    { id: "shadow", name: "暗影", role: "dps" },
  ]},
  { id: "rogue", name: "潜行者", color: "#FFF468", specs: [
    { id: "assassination", name: "奇袭", role: "dps" },
    { id: "outlaw", name: "狂徒", role: "dps" },
    { id: "subtlety", name: "敏锐", role: "dps" },
  ]},
  { id: "shaman", name: "萨满祭司", color: "#0070DD", specs: [
    { id: "elemental", name: "元素", role: "dps" },
    { id: "enhancement", name: "增强", role: "dps" },
    { id: "restoration", name: "恢复", role: "healer" },
  ]},
  { id: "warlock", name: "术士", color: "#8788EE", specs: [
    { id: "affliction", name: "痛苦", role: "dps" },
    { id: "demonology", name: "恶魔学识", role: "dps" },
    { id: "destruction", name: "毁灭", role: "dps" },
  ]},
  { id: "warrior", name: "战士", color: "#C69B6D", specs: [
    { id: "arms", name: "武器", role: "dps" },
    { id: "fury", name: "狂怒", role: "dps" },
    { id: "protection", name: "防护", role: "tank" },
  ]},
];
const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
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
const MORE_TABS = new Set(["history", "fair", "cover", "notes", "rules", "tactics"]);
const DOCK_TABS = [
  ["home", "首页"],
  ["week", "本周"],
  ["calendar", "周历"],
];
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
  journalInstance: "",
  journalDiff: "heroic",
  nightId: "",
};

function nightFromRoute() {
  const path = decodeURIComponent((location.pathname || "").split("?")[0]);
  const m = path.match(/^\/[nr]\/([^/]+)\/?$/);
  if (m) return m[1];
  const q = new URLSearchParams(location.search).get("n");
  if (q) return q;
  return "";
}

function nightShareUrl(id) {
  return `${location.origin}/n/${encodeURIComponent(id)}`;
}

function findNightLocal(id) {
  return allNights().find((n) => n && n.id === id) || null;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (__) {
      return false;
    }
  }
}

function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escAttr(s) {
  return esc(s).replace(/"/g, "&quot;");
}

function ckey(name) {
  return String(name || "").toLowerCase().replace(/[\s'-]/g, "");
}

function findClass(id) {
  return CLASS_MAP[id] || null;
}

function findSpec(classId, specId) {
  const cls = findClass(classId);
  return (cls && cls.specs.find((s) => s.id === specId)) || null;
}

function specRole(classId, specId) {
  const spec = findSpec(classId, specId);
  return (spec && spec.role) || "";
}

function specLabel(classId, specId) {
  const cls = findClass(classId);
  const spec = findSpec(classId, specId);
  if (cls && spec) return spec.name + cls.name;
  if (cls) return cls.name;
  return "";
}

function rememberedComp() {
  try {
    return JSON.parse(localStorage.getItem("icra_comp") || "{}") || {};
  } catch (_) {
    return {};
  }
}

function rememberComp(comp) {
  try {
    localStorage.setItem("icra_comp", JSON.stringify({
      role: comp.role || "",
      classId: comp.classId || "",
      specId: comp.specId || "",
    }));
  } catch (_) {}
}

function fillCompFrom(row, self) {
  if (row && (row.role || row.classId || row.specId)) {
    return {
      role: row.role || specRole(row.classId, row.specId) || "",
      classId: row.classId || "",
      specId: row.specId || "",
    };
  }
  if (self === false) return { role: "", classId: "", specId: "" };
  const mem = rememberedComp();
  return {
    role: mem.role || "",
    classId: mem.classId || "",
    specId: mem.specId || "",
  };
}

function incomingRoleCounts(signups) {
  const c = { tank: 0, healer: 0, dps: 0, none: 0 };
  for (const r of Object.values(signups || {})) {
    if (r.status !== "in") continue;
    if (c[r.role] != null) c[r.role] += 1;
    else c.none += 1;
  }
  return c;
}

function roleCountText(signups) {
  const c = incomingRoleCounts(signups);
  const parts = [];
  if (c.tank) parts.push("坦 " + c.tank);
  if (c.healer) parts.push("疗 " + c.healer);
  if (c.dps) parts.push("输出 " + c.dps);
  if (c.none) parts.push("未填 " + c.none);
  return parts.join(" · ");
}

function specOptions(classId, selected) {
  const cls = findClass(classId);
  const opts = [`<option value="">专精</option>`];
  (cls ? cls.specs : []).forEach((s) => {
    opts.push(`<option value="${esc(s.id)}"${s.id === selected ? " selected" : ""}>${esc(s.name)}</option>`);
  });
  return opts.join("");
}

function classOptions(selected) {
  return [`<option value="">职业</option>`].concat(CLASSES.map((c) =>
    `<option value="${esc(c.id)}"${c.id === selected ? " selected" : ""}>${esc(c.name)}</option>`
  )).join("");
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
  if (!res.ok) throw new Error(body.error || (res.status === 413 ? "截图太大，请压到 4MB 以内" : `${res.status} ${path}`));
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
  return (state.data && state.data.journal) || { instance: {}, bosses: [], instances: [] };
}

function journalInstances() {
  const cat = journalCatalog();
  if (Array.isArray(cat.instances) && cat.instances.length) return cat.instances;
  const inst = cat.instance || {};
  return [{
    id: inst.id || "venomous-abyss",
    nameZh: inst.nameZh || "剧毒深渊",
    nameEn: inst.nameEn || "",
    kind: "raid",
    patch: inst.patch || "12.1",
    lore: inst.lore || "",
    entrance: inst.entrance || "",
    bosses: cat.bosses || [],
  }];
}

function currentJournalInstance() {
  const list = journalInstances();
  return list.find((row) => row.id === state.journalInstance) || list[0] || { bosses: [] };
}

function journalBosses() {
  return currentJournalInstance().bosses || [];
}

function journalEntry(id) {
  return journalBosses().find((b) => b.id === id)
    || journalInstances().flatMap((row) => row.bosses || []).find((b) => b.id === id)
    || null;
}

function currentJournalId() {
  const ids = journalBosses().map((b) => b.id);
  if (state.journalBoss && ids.includes(state.journalBoss)) return state.journalBoss;
  return ids[0] || "";
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

const JOURNAL_DIFFS = [
  { id: "normal", name: "普通" },
  { id: "heroic", name: "英雄" },
  { id: "mythic", name: "史诗" },
];
const SCENE_FILL = {
  boss: "#ff7a18",
  tank: "#6cb4ff",
  melee: "#ffa04d",
  ranged: "#8fd4ff",
  healer: "#45c463",
  hazard: "#5b3488",
  add: "#c45cff",
  soak: "none",
  drop: "#2f6b3c",
  proj: "#ffe08a",
  mark: "#ff6a3d",
};
const SCENE_STROKE = {
  boss: "#ffb06a",
  tank: "#9cc9ff",
  melee: "#ffc27a",
  ranged: "#c6ecff",
  healer: "#7ee09a",
  hazard: "#d4b0ff",
  add: "#e4a6ff",
  soak: "#ff7a18",
  drop: "#45c463",
  proj: "#fff3c4",
  mark: "#ff9a70",
};
const SCENE_R = {
  boss: 5.4, tank: 3.4, melee: 3.2, ranged: 3.2, healer: 3.2,
  hazard: 9, add: 3.3, soak: 8, drop: 5, proj: 1.8, mark: 2.8,
};
let sceneSeq = 0;

function currentJournalDiff() {
  const d = state.journalDiff;
  return d === "normal" || d === "mythic" ? d : "heroic";
}

function shownOnDiff(item, diff) {
  const list = item && item.diffs;
  if (!Array.isArray(list) || !list.length) return true;
  return list.includes(diff);
}

function abilityBody(a, diff) {
  if (diff === "mythic" && a.mythicText) return a.mythicText;
  if (diff === "normal" && a.normalText) return a.normalText;
  return a.text || "";
}

function spellChip(a) {
  const name = `<strong>${esc(a.nameZh)}</strong>`;
  const icon = a.icon
    ? `<img src="https://wow.zamimg.com/images/wow/icons/small/${esc(a.icon)}.jpg" alt="" />`
    : "";
  if (!a.spellId) return `${icon}${name}`;
  return `<a class="spell-chip" href="https://www.wowhead.com/cn/spell=${Number(a.spellId)}" target="_blank" rel="noreferrer" data-wowhead="spell=${Number(a.spellId)}&domain=cn">${icon}${name}</a>`;
}

function wipefestHref(slug, diff) {
  if (!slug) return "";
  return `https://www.wipefest.gg/encounter/${encodeURIComponent(slug)}/${diff}?gameVersion=warcraft-live`;
}

function textFragment(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  return "#:~:text=" + encodeURIComponent(t);
}

function guideHref(base, anchor, quote) {
  if (!base) return "";
  if (anchor) {
    const hash = String(anchor).replace(/^#/, "");
    const frag = quote ? ":~:text=" + encodeURIComponent(quote) : "";
    return base + "#" + hash + frag;
  }
  return quote ? base + textFragment(quote) : base;
}

function abilityGuideLinks(a, entry) {
  if (!entry || a.guide === false) return "";
  const quote = a.methodText || a.nameEn;
  const icyQuote = a.icyText || a.nameEn;
  const links = [];
  const methodBase = entry.methodGuide === false ? "" : entry.methodUrl;
  const method = guideHref(methodBase, a.methodAnchor, quote);
  if (method && quote) links.push(`<a href="${esc(method)}" target="_blank" rel="noreferrer">Method · ${esc(a.nameZh)}</a>`);
  const icy = guideHref(entry.icyUrl, a.icyHash, icyQuote);
  if (icy && icyQuote) links.push(`<a href="${esc(icy)}" target="_blank" rel="noreferrer">Icy Veins</a>`);
  if (!links.length) return "";
  return `<p class="ability-guides">应对详解 ${links.join(" · ")}</p>`;
}

function sceneActorMap(actors) {
  const m = {};
  for (const a of actors) if (a && a.id) m[a.id] = a;
  return m;
}

function scenePoint(actor, end) {
  const path = actor && Array.isArray(actor.path) ? actor.path.filter((p) => p && p.length >= 2) : [];
  if (path.length) {
    const p = end ? path[path.length - 1] : path[0];
    return { x: Number(p[0]) || 50, y: Number(p[1]) || 36 };
  }
  return { x: Number(actor && actor.x) || 50, y: Number(actor && actor.y) || 36 };
}

function scenePathD(pts) {
  return pts.map((p, i) => `${i ? "L" : "M"}${Number(p[0])},${Number(p[1])}`).join(" ");
}

function loopedPath(pts) {
  if (!pts || pts.length < 2) return pts || [];
  return pts.concat(pts.slice(0, -1).reverse());
}

function sceneSvg(scene) {
  if (!scene || !Array.isArray(scene.actors) || !scene.actors.length) return "";
  const uid = "sc" + (++sceneSeq);
  const loop = Math.max(1200, Number(scene.loopMs) || 3600);
  const dur = (loop / 1000).toFixed(2) + "s";
  const actors = scene.actors.filter(Boolean);
  const byId = sceneActorMap(actors);
  const arena = scene.arena === "rect"
    ? `<rect class="scene-arena" x="5" y="5" width="90" height="62" rx="4"/>`
    : `<circle class="scene-arena" cx="50" cy="36" r="32"/>`;
  const defs = [];
  const nodes = actors.map((a, i) => {
    const type = SCENE_FILL[a.type] ? a.type : "mark";
    const r = Number(a.r) || SCENE_R[type] || 3;
    const fill = SCENE_FILL[type];
    const stroke = SCENE_STROKE[type];
    let x = Number(a.x);
    let y = Number(a.y);
    let motion = "";
    let pathPts = Array.isArray(a.path) ? a.path.filter((p) => p && p.length >= 2) : [];
    if (!pathPts.length && a.from && a.to && byId[a.from] && byId[a.to]) {
      const s = scenePoint(byId[a.from], false);
      const e = scenePoint(byId[a.to], true);
      pathPts = [[s.x, s.y], [e.x, e.y]];
    }
    let moving = false;
    if (pathPts.length >= 2) {
      const pid = `${uid}-p${i}`;
      defs.push(`<path id="${pid}" d="${scenePathD(loopedPath(pathPts))}"/>`);
      const start = pathPts[0];
      x = Number(start[0]);
      y = Number(start[1]);
      moving = true;
      motion = `<animateMotion dur="${dur}" repeatCount="indefinite"><mpath href="#${pid}"/></animateMotion>`;
    }
    if (!Number.isFinite(x)) x = 50;
    if (!Number.isFinite(y)) y = 36;
    const cx = moving ? 0 : x;
    const cy = moving ? 0 : y;
    const pulse = a.pulse
      ? `<animate attributeName="r" values="${r};${(r * 1.28).toFixed(1)};${r}" dur="1.2s" repeatCount="indefinite"/>`
      : "";
    const shape = type === "soak"
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="1.2" opacity="0.9">${motion}${pulse}<animate attributeName="opacity" values="0.35;0.95;0.35" dur="1.2s" repeatCount="indefinite"/></circle>`
      : type === "drop"
        ? `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${(r * 0.7).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="0.6" opacity="0.85">${motion}</ellipse>`
        : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="0.6">${motion}${pulse}</circle>`;
    const label = a.label
      ? `<text x="${x}" y="${y + r + 4.2}" text-anchor="middle">${esc(a.label)}</text>`
      : "";
    return `<g>${shape}${label}</g>`;
  }).join("");
  return `<div class="scene-frame">
    <svg viewBox="0 0 100 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${defs.join("")}</defs>
      ${arena}
      ${nodes}
    </svg>
  </div>`;
}

const CLIP_PER_ABILITY = 8;
const CLIP_COMPRESS_EDGE = 1600;
const CLIP_SOURCE_MAX = 12 * 1024 * 1024;

function abilityClipKey(a) {
  return String((a && (a.nameEn || a.nameZh)) || "").trim();
}

function clipRowFor(bossId, a) {
  const clips = (state.data && state.data.guild && state.data.guild.clips) || {};
  const map = clips[bossId] || {};
  return map[abilityClipKey(a)] || (a && (map[a.nameEn] || map[a.nameZh])) || null;
}

function clipItemsFor(bossId, a) {
  const row = clipRowFor(bossId, a);
  if (!row) return [];
  if (Array.isArray(row.items)) return row.items.filter(Boolean);
  if (row.url || row.kind) return [row];
  return [];
}

function safeEmbedSrc(clip) {
  if (!clip || !clip.embed) return "";
  try {
    const u = new URL(clip.embed);
    if (u.protocol !== "https:") return "";
    const host = u.hostname.replace(/^www\./, "");
    if (clip.kind === "youtube" && (host === "youtube-nocookie.com" || host === "youtube.com")) return clip.embed;
    if (clip.kind === "bilibili" && host === "player.bilibili.com") return clip.embed;
  } catch (_) {}
  return "";
}

function safeImageSrc(clip) {
  if (!clip) return "";
  if (clip.kind === "upload") {
    return /^\/media\/[a-f0-9]{32}\.(jpg|png|webp|gif)$/i.test(clip.url || "") ? clip.url : "";
  }
  if (clip.kind !== "image") return "";
  try {
    const u = new URL(clip.url);
    if (u.protocol !== "https:") return "";
    if (!/\.(jpe?g|png|webp|gif)$/i.test(u.pathname)) return "";
    return clip.url;
  } catch (_) {}
  return "";
}

function clipMedia(a, clip) {
  if (!clip) return "";
  const title = a.nameZh || a.nameEn || "本团资料";
  const embed = safeEmbedSrc(clip);
  if (embed) {
    return `<div class="clip-frame"><iframe src="${escAttr(embed)}" title="${escAttr(title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  }
  return "";
}

function readFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读文件失败"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读不出来"));
    };
    img.src = url;
  });
}

async function compressImageFile(file) {
  if (!file) throw new Error("请选择图片");
  if (file.size > CLIP_SOURCE_MAX) throw new Error("原图太大，请先缩小再传");
  if (file.type === "image/gif") {
    if (file.size > 4 * 1024 * 1024) throw new Error("GIF 请压到 4MB 以内");
    return readFileDataUrl(file);
  }
  const img = await loadImageFromFile(file);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  if (!srcW || !srcH) throw new Error("图片读不出来");
  const scale = Math.min(1, CLIP_COMPRESS_EDGE / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const quality = file.size > 2 * 1024 * 1024 ? 0.76 : 0.84;
  let data = canvas.toDataURL("image/jpeg", quality);
  if (data.length > 5.5 * 1024 * 1024) data = canvas.toDataURL("image/jpeg", 0.68);
  if (data.length > 5.5 * 1024 * 1024) throw new Error("压缩后仍太大，请换一张");
  return data;
}

let clipZoomBound = false;

function closeClipZoom() {
  const box = document.getElementById("clipZoom");
  if (!box) return;
  box.hidden = true;
  const img = box.querySelector("img");
  if (img) img.removeAttribute("src");
  document.body.classList.remove("clip-zoom-on");
}

function openClipZoom(src, caption) {
  const box = document.getElementById("clipZoom") || ensureClipZoom();
  const img = box.querySelector("img");
  const cap = box.querySelector("figcaption");
  img.src = src;
  img.alt = caption || "本团截图";
  cap.textContent = caption || "";
  cap.hidden = !caption;
  box.hidden = false;
  document.body.classList.add("clip-zoom-on");
}

function ensureClipZoom() {
  let box = document.getElementById("clipZoom");
  if (!box) {
    box = el(`<div id="clipZoom" class="clip-zoom" hidden>
      <button type="button" class="ghost clip-zoom-close" aria-label="关闭">关闭</button>
      <figure>
        <img alt="">
        <figcaption></figcaption>
      </figure>
    </div>`);
    document.body.appendChild(box);
  }
  if (!clipZoomBound) {
    clipZoomBound = true;
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.classList.contains("clip-zoom-close")) closeClipZoom();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeClipZoom();
    });
  }
  return box;
}

function clipImageCard(a, item, index, lead) {
  const image = safeImageSrc(item);
  if (!image) return "";
  const cap = item.caption || "";
  const title = cap || a.nameZh || "本团截图";
  return `<figure class="clip-card">
    <button type="button" class="clip-zoom-hit" data-zoom-src="${escAttr(image)}" data-zoom-cap="${escAttr(cap)}" title="点击放大">
      <img src="${escAttr(image)}" alt="${escAttr(title)}" loading="lazy" referrerpolicy="no-referrer" />
      <span class="clip-zoom-hint">点击放大</span>
    </button>
    ${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}
    ${lead && item.id ? `<button type="button" class="ghost clip-del" data-remove-clip="${index}" data-clip-id="${escAttr(item.id)}">删除</button>` : ""}
  </figure>`;
}

function clipVideoCard(a, item, index, lead) {
  const media = clipMedia(a, item);
  if (!media) return "";
  return `<div class="clip-card clip-video">
    ${media}
    ${item.caption ? `<p class="clip-caption">${esc(item.caption)}</p>` : ""}
    <div class="clip-item-bar">
      ${item.url ? `<a href="${escAttr(item.url)}" target="_blank" rel="noreferrer">打开原链接</a>` : "<span></span>"}
      ${lead && item.id ? `<button type="button" class="ghost" data-remove-clip="${index}" data-clip-id="${escAttr(item.id)}">删除</button>` : ""}
    </div>
  </div>`;
}

function clipGallery(a, items, index) {
  if (!items.length) return "";
  const lead = state.role === "lead";
  return `<div class="clip-list">${items.map((item) => (
    safeImageSrc(item) ? clipImageCard(a, item, index, lead) : clipVideoCard(a, item, index, lead)
  )).join("")}</div>`;
}

function clipEditor(items, index) {
  if (state.role !== "lead") return "";
  const full = items.length >= CLIP_PER_ABILITY;
  const fields = full ? `<p class="muted">这个技能已有 ${CLIP_PER_ABILITY} 张，先删一张再传。</p>` : `
    <div class="clip-toolbar">
      <label class="clip-file-btn">上传截图<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" data-clip-file="${index}" /></label>
      <input data-clip-cap="${index}" placeholder="说明，加在新图上" />
    </div>
    <div class="clip-toolbar">
      <input data-clip-url="${index}" placeholder="或贴 B 站 / YouTube / 图片直链" />
      <button type="button" class="ghost" data-save-clip="${index}">添加外链</button>
    </div>`;
  const clear = items.length
    ? `<div class="row clip-actions"><button type="button" class="ghost" data-clear-clip="${index}">全部清除</button></div>`
    : "";
  if (!items.length) {
    return `<div class="clip-edit"><p class="clip-kicker">本团资料</p>${fields}</div>`;
  }
  return `<details class="clip-edit"><summary>添加本团资料</summary>${fields}${clear}</details>`;
}

function abilityClipBlock(a, entry, index) {
  const bossId = entry && entry.id;
  const items = clipItemsFor(bossId, a);
  const gallery = clipGallery(a, items, index);
  const editor = clipEditor(items, index);
  if (!gallery && !editor) return "";
  return `<div class="ability-clip">${gallery ? `<p class="clip-kicker">本团图示 · 点击放大</p>${gallery}` : ""}${editor}</div>`;
}

function abilityCard(a, diff, entry, index) {
  const body = abilityBody(a, diff);
  const visual = a.scene ? sceneSvg(a.scene) : "";
  return `<div class="ability${visual ? " visual" : ""}">
    <div>
      <div class="ability-head">
        ${spellChip(a)}
        ${a.nameEn ? `<span class="muted">${esc(a.nameEn)}</span>` : ""}
        ${a.tag ? tag(a.tag, abilityTagKind(a.tag)) : ""}
      </div>
      ${body ? `<p>${esc(body)}</p>` : ""}
      ${abilityGuideLinks(a, entry)}
    </div>
    ${visual}
    ${abilityClipBlock(a, entry, index)}
  </div>`;
}

function positionCard(p) {
  return `<div class="pos-card">
    <h4>${esc(p.title || "站位")}</h4>
    ${p.caption ? `<p class="muted">${esc(p.caption)}</p>` : ""}
    ${sceneSvg(p.scene)}
  </div>`;
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
      <p class="muted lead">${state.nightId
        ? "登录后将打开这场开团的报名页，可查看名单并报名。"
        : "国服海加尔公会专属档案。角色可只填名字，默认补「-海加尔」。游戏内 <code>/icrc export</code> 或 <code>/icrl export</code> 复制后贴到本周页。"}</p>
      <label for="name">角色名</label>
      <input id="name" name="username" autocomplete="username" placeholder="只填名字即可" value="${esc(shortName(state.name) === "?" ? "" : shortName(state.name))}" />
      <label for="code">邀请码</label>
      <input id="code" name="code" type="password" autocomplete="current-password" placeholder="团长或队员邀请码" />
      <p class="err" id="err"></p>
      <div class="row" style="margin-top:14px"><button id="go" class="btn-wide">进入公会</button></div>
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

function weeklyKeys(intent) {
  const filled = new Set(((intent && intent.slots) || []).map((s) => s.slotKey));
  return ((intent && intent.weekly) || []).filter((k) => filled.has(k)).slice(0, WEEKLY_INTENT_LIMIT);
}

function weeklyChips(intent) {
  const m = slotMap(intent);
  const keys = weeklyKeys(intent);
  if (!keys.length) return `<span class="muted">未提交本周意向</span>`;
  return keys.map((k) => {
    const s = m[k];
    if (!s) return "";
    return `<span class="weekly-chip">${esc(SLOT_LABEL[k] || k)} ${itemChip(s.itemId, null, true)}</span>`;
  }).join(" ");
}

function slotDots(intent) {
  const m = slotMap(intent);
  const week = new Set(weeklyKeys(intent));
  return `<span class="dots">${SLOTS.map(([key, label]) => {
    const s = m[key];
    if (s && s.itemId) {
      const tip = week.has(key) ? `${label} · 本周意向` : label;
      return `<a class="dot on${week.has(key) ? " week" : ""}" title="${esc(tip)}" href="${wowheadHref(s.itemId)}" target="_blank" rel="noreferrer" data-wowhead="item=${s.itemId}&domain=cn"></a>`;
    }
    return `<span class="dot" title="${esc(label)}"></span>`;
  }).join("")}</span>`;
}

function slotDetail(intent) {
  const m = slotMap(intent);
  const week = new Set(weeklyKeys(intent));
  return `<div class="board-detail">${SLOTS.map(([key, label]) => {
    const s = m[key];
    const mark = week.has(key) ? ` ${tag("本周")}` : "";
    return `<div><span class="slot-lab">${esc(label)}${mark}</span>${s ? itemChip(s.itemId, null, true) : `<span class="muted">空</span>`}</div>`;
  }).join("")}</div>`;
}

function logout() {
  localStorage.removeItem("icra_token");
  localStorage.removeItem("icra_role");
  localStorage.removeItem("icra_name");
  state.token = state.role = "";
  state.data = null;
  state.season = null;
  renderLogin();
}

function closeMore(wrap) {
  const sheet = wrap.querySelector("#moreSheet");
  if (sheet) sheet.hidden = true;
}

function bindShell(wrap) {
  wrap.querySelectorAll("select[data-week]").forEach((sel) => {
    sel.onchange = (e) => load(e.target.value);
  });
  wrap.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.onclick = logout;
  });
  wrap.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.onclick = () => {
      closeMore(wrap);
      gotoTab(btn.getAttribute("data-tab"));
    };
  });
  wrap.querySelectorAll("[data-share]").forEach((btn) => {
    btn.onclick = () => shareNight(btn.getAttribute("data-share"), btn);
  });
  wrap.querySelectorAll("[data-open-night]").forEach((btn) => {
    btn.onclick = () => openNight(btn.getAttribute("data-open-night"));
  });
  const moreBtn = wrap.querySelector("#moreOpen");
  const sheet = wrap.querySelector("#moreSheet");
  const backdrop = wrap.querySelector("#moreClose");
  if (moreBtn && sheet) {
    moreBtn.onclick = () => { sheet.hidden = false; };
  }
  if (backdrop) backdrop.onclick = () => closeMore(wrap);
}

function bindPaste(page) {
  page.querySelectorAll("[data-paste]").forEach((btn) => {
    btn.onclick = async () => {
      const target = page.querySelector("#" + btn.getAttribute("data-paste"));
      try {
        const text = await navigator.clipboard.readText();
        if (target && text) target.value = text;
        else if (target) target.focus();
      } catch (_) {
        if (target) target.focus();
      }
    };
  });
}

function shellHtml(d) {
  const lead = state.role === "lead";
  const weekOpts = (d.weeks || [d.week]).map((w) =>
    `<option value="${esc(w)}"${w === d.week ? " selected" : ""}>${esc(w)}</option>`).join("");
  const tabs = TABS.map(([id, label]) =>
    `<button type="button"${state.tab === id ? " class=\"on\"" : ""} data-tab="${id}">${label}</button>`
  ).join("");
  const dock = DOCK_TABS.map(([id, label]) =>
    `<button type="button"${state.tab === id || (id === "calendar" && state.tab === "signup") ? " class=\"on\"" : ""} data-tab="${id}">${label}</button>`
  ).join("");
  const moreItems = TABS.filter(([id]) => MORE_TABS.has(id)).map(([id, label]) =>
    `<button type="button" class="ghost${state.tab === id ? " on" : ""}" data-tab="${id}">${label}</button>`
  ).join("");
  return `<div class="wrap">
    <header class="bar">
      <div class="brand">
        <span class="brand-mark">ZOO</span>
        <h1>${esc((d.guild && d.guild.name) || "ZOO")}</h1>
        <span class="who">国服${esc((d.guild && d.guild.realm) || "海加尔")} · ${esc(state.name)} · ${lead ? "团长" : "队员"}</span>
      </div>
      <div class="bar-right desk-only">
        <select data-week>${weekOpts}</select>
        <button class="ghost" type="button" data-logout>退出</button>
      </div>
    </header>
    <div class="bar-tools phone-only">
      <select data-week aria-label="选择周">${weekOpts}</select>
    </div>
    <nav class="tabs desk-only">${tabs}</nav>
    <p class="err" id="err">${esc(state.error)}</p>
    <p class="ok" id="ok">${esc(state.notice)}</p>
    <div id="page"></div>
    <nav class="dock phone-only" aria-label="手机导航">
      ${dock}
      <button type="button" id="moreOpen"${MORE_TABS.has(state.tab) ? " class=\"on\"" : ""}>更多</button>
    </nav>
    <div class="sheet" id="moreSheet" hidden>
      <div class="sheet-backdrop" id="moreClose"></div>
      <div class="sheet-panel">
        <h2>更多</h2>
        <div class="sheet-grid">${moreItems}</div>
        <div class="row" style="margin-top:14px"><button type="button" class="ghost btn-wide" data-logout>退出</button></div>
      </div>
    </div>
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
    signup: renderSignup,
    history: renderHistory,
    fair: renderFair,
    cover: renderCover,
    notes: renderNotes,
    rules: renderRules,
    tactics: renderTactics,
  }[state.tab] || renderHome;
  view(page, d);
  bindNightLinks(wrap);
  refreshWowhead();
}

function bindNightLinks(root) {
  root.querySelectorAll("[data-share]").forEach((btn) => {
    btn.onclick = () => shareNight(btn.getAttribute("data-share"), btn);
  });
  root.querySelectorAll("[data-open-night]").forEach((btn) => {
    btn.onclick = () => openNight(btn.getAttribute("data-open-night"));
  });
}

function weekdayLabel(ymd) {
  const p = ymdParts(ymd);
  if (!p.y || !p.m || !p.d) return "";
  const w = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return "星期" + "日一二三四五六"[w];
}

function dateWithWeekday(ymd) {
  const w = weekdayLabel(ymd);
  return w ? `${ymd} ${w}` : String(ymd || "");
}

function nightLine(n, withDate) {
  const parts = [];
  if (withDate && n.date) parts.push(dateWithWeekday(n.date));
  if (n.time) parts.push(n.time);
  if (n.title) parts.push(n.title);
  if (n.instance) parts.push(n.instance);
  return parts.join(" · ") || "时间未定";
}

function nightFormDefaults() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem("icra_night_form") || "{}") || {}; } catch (_) {}
  const last = allNights().slice().sort((a, b) => String(b.date).localeCompare(a.date) || String(b.time).localeCompare(a.time))[0];
  return {
    title: stored.title || (last && last.title) || "新团本普通难度1-7",
    time: stored.time || (last && last.time) || "21:00",
    instance: stored.instance || (last && last.instance) || raidInstanceName(),
    note: stored.note || (last && last.note) || "集合石 / 语音",
  };
}

function rememberNightForm(night) {
  try {
    localStorage.setItem("icra_night_form", JSON.stringify({
      title: night.title || "",
      time: night.time || "",
      instance: night.instance || "",
      note: night.note || "",
    }));
  } catch (_) {}
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
      ${nights.length ? `<ul class="plain night-home">${nights.map((n) => {
        const sc = n.signupCounts || { in: 0, out: 0, maybe: 0 };
        return `<li>
          <div>${esc(nightLine(n, true))}
            <span class="muted"> · 能来 ${sc.in}${roleCountText(n.signups) ? " · " + roleCountText(n.signups) : ""} · 请假 ${sc.out} · 待定 ${sc.maybe}</span></div>
          <div class="row" style="margin-top:6px">
            <button type="button" data-open-night="${esc(n.id)}">打开报名</button>
            <button type="button" class="ghost" data-share="${esc(n.id)}">分享</button>
          </div>
        </li>`;
      }).join("")}</ul>` : `<p class="muted">还没有开团夜。团长到「周历」标具体日期和时间。</p>`}
    </div>
    <div class="card">
      <h2>进度</h2>
      ${bosses.length ? `<table class="stack-phone"><tbody>${bosses.map((b) => `<tr>
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
      <td>${weeklyChips(i)}</td>
      <td><span class="muted">${(i.slots || []).length}/16</span> ${slotDots(i)}</td>
      <td class="muted">${i.at ? new Date(i.at * 1000).toLocaleString() : ""}</td>
    </tr>${open ? `<tr><td colspan="4">${slotDetail(i)}</td></tr>` : ""}`;
  }).join("") : `<tr><td colspan="4" class="muted">还没有意向。16 栏可填预设，本周意向最多 ${WEEKLY_INTENT_LIMIT} 件。用 /icrc export 或下面手填。</td></tr>`;
  const boardCards = intentList.length ? intentList.map((i) => {
    const key = ckey(i.char);
    const open = state.boardChar === key;
    const weekN = weeklyKeys(i).length;
    return `<button type="button" class="m-card board-row" data-board="${esc(key)}">
      <div class="m-card-top"><strong>${esc(shortName(i.char))}</strong><span class="muted">本周 ${weekN}/${WEEKLY_INTENT_LIMIT} · 预设 ${(i.slots || []).length}/16</span></div>
      <div>${weeklyChips(i)}</div>
      <div style="margin-top:6px">${slotDots(i)}</div>
      <div class="muted" style="margin-top:6px">${i.at ? new Date(i.at * 1000).toLocaleString() : ""}</div>
      ${open ? slotDetail(i) : ""}
    </button>`;
  }).join("") : `<p class="muted">还没有意向。16 栏可填预设，本周意向最多 ${WEEKLY_INTENT_LIMIT} 件。用 /icrc export 或下面手填。</p>`;

  page.appendChild(el(`<div class="card">
    <h2>本周看板</h2>
    ${missing.length ? `<p class="err">未登记：${missing.map(esc).join("、")}</p>` : ""}
    <div class="desk-only table-scroll"><table>
      <thead><tr><th>角色</th><th>本周意向</th><th>预设</th><th>时间</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="phone-only">${boardCards}</div>
  </div>`));

  const mine = d.intents[ckey(state.name)]
    || Object.values(d.intents).find((i) => i.char === state.name);
  const mineSlots = slotMap(mine);
  const mineWeekly = new Set(weeklyKeys(mine));
  const formRows = SLOTS.map(([key, label]) => {
    const cur = mineSlots[key];
    const isWeek = mineWeekly.has(key);
    return `<div class="slot-cell${cur ? " filled" : ""}${isWeek ? " week" : ""}">
      <span class="slot-lab">${label}</span>
      ${cur ? itemChip(cur.itemId, null, true) : `<span class="muted">空</span>`}
      <input data-slot="${key}" placeholder="物品 ID" value="${cur ? esc(cur.itemId) : ""}" />
      <label class="weekly-pick">
        <input type="checkbox" data-weekly="${key}"${isWeek ? " checked" : ""}${cur ? "" : " disabled"} />
        本周意向
      </label>
    </div>`;
  }).join("");

  page.appendChild(el(`<div class="grid two">
    <div class="card">
      <h2>我的意向${lead ? "（或代登记）" : ""}</h2>
      <details class="import">
        <summary>粘贴队员端 /icrc export</summary>
        <textarea id="intentPaste" placeholder="ICRC1:intent:{...}"></textarea>
        <div class="row" style="margin-top:8px">
          <button type="button" class="ghost" data-paste="intentPaste">粘贴剪贴板</button>
          <button id="importIntent">导入意向</button>
        </div>
      </details>
      <p class="muted">16 栏是预设装备，可全部填写。本周团本意向拾取最多勾 ${WEEKLY_INTENT_LIMIT} 件。插件 /icrc export 会导入全部预设；本周意向请在网站勾选后保存。</p>
      <p id="intentCount" class="muted">本周意向 0 / ${WEEKLY_INTENT_LIMIT}</p>
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
    bossBox.innerHTML = `<table class="stack-phone"><tbody>${d.bosses.map((b, i) => `<tr>
      <td>${esc(b.name)}</td>
      <td>${b.down ? tag("已击杀", "ok") : tag("未击杀", "warn")}</td>
      ${lead ? `<td><button class="ghost" data-toggle="${i}">切换</button></td>` : ""}
    </tr>`).join("")}</tbody></table>`;
  }

  const awardRows = awards.length ? awards.map((a) => `<tr>
        <td>${itemChip(a.itemId, a.itemLink)}</td>
        <td>${esc(shortName(a.winner))}</td>
        <td class="muted">${esc(a.boss || "—")}</td>
        <td>${a.traded ? tag("已交付", "ok") : tag("未交付", "warn")}</td>
        <td>${lead ? awardMarkSelect(a) : markTag(a.mark)}</td>
      </tr>`).join("") : `<tr><td colspan="5" class="muted">本周还没有分配记录。</td></tr>`;
  const awardCards = awards.length ? awards.map((a) => `<div class="m-card">
      <div class="m-card-top">${itemChip(a.itemId, a.itemLink)} ${esc(shortName(a.winner))}</div>
      <div class="muted">${esc(a.boss || "—")} · ${a.traded ? "已交付" : "未交付"}</div>
      <div style="margin-top:8px">${lead ? awardMarkSelect(a) : markTag(a.mark)}</div>
    </div>`).join("") : `<p class="muted">本周还没有分配记录。</p>`;

  page.appendChild(el(`<div class="card">
    <h2>本周分配</h2>
    ${lead ? `<details class="import">
      <summary>粘贴团长端 /icrl export</summary>
      <textarea id="lootPaste" placeholder="ICRC1:loot:{...}"></textarea>
      <div class="row" style="margin-top:8px">
        <button type="button" class="ghost" data-paste="lootPaste">粘贴剪贴板</button>
        <button id="importLoot">导入分配</button>
      </div>
    </details>` : `<p class="muted">由团长导入。同一 uid 再导入会更新，不会重复记账。</p>`}
    <div class="desk-only table-scroll"><table>
      <thead><tr><th>物品</th><th>获奖</th><th>Boss</th><th>交付</th><th>去向</th></tr></thead>
      <tbody>${awardRows}</tbody>
    </table></div>
    <div class="phone-only">${awardCards}</div>
  </div>`));

  bindWeekActions(page, d);
}

function bindWeekActions(page, d) {
  const lead = state.role === "lead";
  bindPaste(page);
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

  const slotForm = page.querySelector("#slotForm");
  const syncWeeklyPicks = () => {
    slotForm.querySelectorAll("[data-slot]").forEach((inp) => {
      const has = !!Number(inp.value);
      const key = inp.getAttribute("data-slot");
      const box = slotForm.querySelector(`[data-weekly="${key}"]`);
      if (box && !has) box.checked = false;
      const cell = inp.closest(".slot-cell");
      if (cell) cell.classList.toggle("filled", has);
    });
    const boxes = [...slotForm.querySelectorAll("[data-weekly]")];
    const n = boxes.filter((b) => b.checked).length;
    boxes.forEach((box) => {
      const key = box.getAttribute("data-weekly");
      const inp = slotForm.querySelector(`[data-slot="${key}"]`);
      const has = !!(inp && Number(inp.value));
      box.disabled = !has || (!box.checked && n >= WEEKLY_INTENT_LIMIT);
      const cell = box.closest(".slot-cell");
      if (cell) cell.classList.toggle("week", box.checked);
    });
    const count = page.querySelector("#intentCount");
    if (count) {
      count.textContent = `本周意向 ${n} / ${WEEKLY_INTENT_LIMIT}`;
      count.className = "muted";
    }
  };
  slotForm.querySelectorAll("[data-slot]").forEach((inp) => {
    inp.addEventListener("input", syncWeeklyPicks);
  });
  slotForm.querySelectorAll("[data-weekly]").forEach((box) => {
    box.addEventListener("change", syncWeeklyPicks);
  });
  syncWeeklyPicks();

  page.querySelector("#saveIntent").onclick = async () => {
    const slots = [];
    page.querySelectorAll("#slotForm [data-slot]").forEach((inp) => {
      const id = Number(inp.value);
      if (id) slots.push({ slotKey: inp.getAttribute("data-slot"), itemId: id, priority: "bis" });
    });
    const filled = new Set(slots.map((s) => s.slotKey));
    const weekly = [];
    page.querySelectorAll("#slotForm [data-weekly]").forEach((box) => {
      const key = box.getAttribute("data-weekly");
      if (box.checked && filled.has(key) && !weekly.includes(key)) weekly.push(key);
    });
    if (weekly.length > WEEKLY_INTENT_LIMIT) {
      fail(new Error(`本周意向最多 ${WEEKLY_INTENT_LIMIT} 件`));
      return;
    }
    try {
      const asChar = page.querySelector("#asChar");
      await afterWrite(await api("/api/intent", {
        method: "POST",
        body: JSON.stringify({ week: d.week, slots, weekly, char: asChar && asChar.value }),
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

function signupPlayerCard(r) {
  const cls = findClass(r.classId);
  const label = specLabel(r.classId, r.specId);
  const role = ROLE_LABEL[r.role] || "";
  return `<div class="signup-player">
    <div class="signup-player-name" style="${cls ? `color:${cls.color}` : ""}">${esc(shortName(r.char))}</div>
    <div class="signup-player-meta">
      ${role ? tag(role, ROLE_TAG[r.role] || "") : tag("未填职责")}
      ${label ? `<span class="muted">${esc(label)}</span>` : ""}
    </div>
    ${r.note ? `<div class="muted signup-player-note">${esc(r.note)}</div>` : ""}
  </div>`;
}

function incomingByRole(list) {
  const buckets = { tank: [], healer: [], dps: [], none: [] };
  for (const r of list) {
    if (buckets[r.role]) buckets[r.role].push(r);
    else buckets.none.push(r);
  }
  const order = [["tank", "坦克"], ["healer", "治疗"], ["dps", "输出"], ["none", "未填职责"]];
  return order.filter(([key]) => buckets[key].length).map(([key, label]) => {
    const rows = buckets[key].slice().sort((a, b) => shortName(a.char).localeCompare(shortName(b.char), "zh"));
    return `<div class="signup-role-group">
      <h5>${esc(label)} · ${rows.length}</h5>
      <div class="signup-players">${rows.map(signupPlayerCard).join("")}</div>
    </div>`;
  }).join("");
}

function sidePeople(list) {
  if (!list.length) return `<p class="signup-empty">—</p>`;
  const rows = list.slice().sort((a, b) => shortName(a.char).localeCompare(shortName(b.char), "zh"));
  return `<div class="signup-players">${rows.map(signupPlayerCard).join("")}</div>`;
}

function nightSignupBlock(n, myName) {
  const rows = Object.values(n.signups || {});
  const groups = { in: [], out: [], maybe: [] };
  for (const r of rows) {
    if (groups[r.status]) groups[r.status].push(r);
  }
  const mine = rows.find((r) => ckey(r.char) === ckey(myName));
  const sc = n.signupCounts || { in: groups.in.length, out: groups.out.length, maybe: groups.maybe.length };
  const mix = roleCountText(n.signups);
  const comp = fillCompFrom(mine);
  return `<div class="night-signup" data-night="${esc(n.id)}">
    <h3>${esc(nightLine(n))}</h3>
    <p class="muted">能来 ${sc.in}${mix ? " · " + mix : ""} · 请假 ${sc.out} · 待定 ${sc.maybe}。你现在：${
      mine ? tag(RSVP_LABEL[mine.status], mine.status === "in" ? "ok" : mine.status === "out" ? "warn" : "") : tag("未报名")
    }</p>
    <div class="row rsvp-seg" style="margin:8px 0 12px">
      <button type="button"${mine && mine.status === "in" ? "" : " class=\"ghost\""} data-rsvp="in" data-night="${esc(n.id)}" data-week="${esc(n.week || "")}">能来</button>
      <button type="button"${mine && mine.status === "out" ? "" : " class=\"ghost\""} data-rsvp="out" data-night="${esc(n.id)}" data-week="${esc(n.week || "")}">请假</button>
      <button type="button"${mine && mine.status === "maybe" ? "" : " class=\"ghost\""} data-rsvp="maybe" data-night="${esc(n.id)}" data-week="${esc(n.week || "")}">待定</button>
    </div>
    <div class="comp-fields">
      <div>
        <label>职责</label>
        <input type="hidden" data-rsvp-role="${esc(n.id)}" value="${esc(comp.role)}" />
        <div class="row rsvp-seg">
          <button type="button" class="${comp.role === "tank" ? "" : "ghost"}" data-set-role="tank" data-night="${esc(n.id)}">坦克</button>
          <button type="button" class="${comp.role === "healer" ? "" : "ghost"}" data-set-role="healer" data-night="${esc(n.id)}">治疗</button>
          <button type="button" class="${comp.role === "dps" ? "" : "ghost"}" data-set-role="dps" data-night="${esc(n.id)}">输出</button>
        </div>
      </div>
      <div>
        <label>职业</label>
        <select data-rsvp-class="${esc(n.id)}">${classOptions(comp.classId)}</select>
      </div>
      <div>
        <label>专精</label>
        <select data-rsvp-spec="${esc(n.id)}">${specOptions(comp.classId, comp.specId)}</select>
      </div>
    </div>
    <label>附言（可选）</label>
    <input data-rsvp-note="${esc(n.id)}" value="${esc(mine && mine.note || "")}" placeholder="比如迟到、只打前两个" />
    <div class="signup-board">
      <div class="signup-col in signup-col-main">
        <h4>能来 · ${sc.in}${mix ? `<span class="muted"> · ${esc(mix)}</span>` : ""}</h4>
        ${groups.in.length ? incomingByRole(groups.in) : `<p class="signup-empty">—</p>`}
      </div>
      <div class="signup-side">
        <div class="signup-col out"><h4>请假 · ${sc.out}</h4>${sidePeople(groups.out)}</div>
        <div class="signup-col maybe"><h4>待定 · ${sc.maybe}</h4>${sidePeople(groups.maybe)}</div>
      </div>
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
  const form = nightFormDefaults();

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
        <div class="row" style="margin-top:8px">
          <button type="button" data-open-night="${esc(n.id)}">打开报名</button>
          <button type="button" class="ghost" data-share="${esc(n.id)}">分享</button>
          ${lead ? `<button class="ghost" data-del-night="${esc(n.id)}">删除这场</button>` : ""}
        </div>
      </div>`).join("") : `<p class="muted">这天还没有开团。团长在下面加上时间和副本。</p>`}
      ${lead ? `<div class="night-form">
        <label>标题</label>
        <input id="nightTitle" value="${esc(form.title)}" placeholder="例如 M1-3" />
        <label>集合时间</label>
        <input id="nightTime" value="${esc(form.time)}" placeholder="例如 21:00" />
        <label>副本</label>
        <input id="nightInst" value="${esc(form.instance)}" placeholder="例如 ${esc(raidInstanceName())}" />
        <label>备注</label>
        <input id="nightNote" value="${esc(form.note)}" placeholder="例如 集合石 / 语音" />
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
  bindSignupForm(page, week);
  const addNight = page.querySelector("#addNight");
  if (addNight) {
    addNight.onclick = () => {
      const night = {
        date,
        week,
        title: page.querySelector("#nightTitle").value,
        time: page.querySelector("#nightTime").value,
        instance: page.querySelector("#nightInst").value,
        note: page.querySelector("#nightNote").value,
      };
      rememberNightForm(night);
      saveNight(night);
    };
  }
  page.querySelectorAll("[data-del-night]").forEach((btn) => {
    btn.onclick = () => deleteNight(btn.getAttribute("data-del-night"), week);
  });
}

function applyCompToBlock(block, comp) {
  const nightId = block.getAttribute("data-night");
  const roleEl = block.querySelector(`[data-rsvp-role="${nightId}"]`);
  const classEl = block.querySelector(`[data-rsvp-class="${nightId}"]`);
  const specEl = block.querySelector(`[data-rsvp-spec="${nightId}"]`);
  if (roleEl) roleEl.value = comp.role || "";
  block.querySelectorAll("[data-set-role]").forEach((btn) => {
    btn.className = btn.getAttribute("data-set-role") === (comp.role || "") ? "" : "ghost";
  });
  if (classEl) classEl.value = comp.classId || "";
  if (specEl) {
    specEl.innerHTML = specOptions(comp.classId || "", comp.specId || "");
    specEl.value = findSpec(comp.classId, comp.specId) ? comp.specId : "";
  }
}

function collectSignup(page, btn) {
  const nightId = btn.getAttribute("data-night");
  const as = page.querySelector("#rsvpAs");
  const who = as && as.value ? as.value : undefined;
  const roleEl = page.querySelector(`[data-rsvp-role="${nightId}"]`);
  const classEl = page.querySelector(`[data-rsvp-class="${nightId}"]`);
  const specEl = page.querySelector(`[data-rsvp-spec="${nightId}"]`);
  const noteEl = page.querySelector(`[data-rsvp-note="${nightId}"]`);
  const comp = {
    role: roleEl ? roleEl.value : "",
    classId: classEl ? classEl.value : "",
    specId: specEl ? specEl.value : "",
  };
  if (!who || ckey(who) === ckey(state.name)) rememberComp(comp);
  return {
    week: btn.getAttribute("data-week") || "",
    status: btn.getAttribute("data-rsvp"),
    note: noteEl ? noteEl.value : "",
    char: who,
    nightId,
    ...comp,
  };
}

function bindSignupForm(page, week) {
  page.querySelectorAll("[data-set-role]").forEach((btn) => {
    btn.onclick = () => {
      const nightId = btn.getAttribute("data-night");
      const roleEl = page.querySelector(`[data-rsvp-role="${nightId}"]`);
      if (roleEl) roleEl.value = btn.getAttribute("data-set-role") || "";
      page.querySelectorAll(`[data-set-role][data-night="${nightId}"]`).forEach((b) => {
        b.className = b === btn ? "" : "ghost";
      });
    };
  });
  page.querySelectorAll("[data-rsvp-class]").forEach((sel) => {
    sel.onchange = () => {
      const nightId = sel.getAttribute("data-rsvp-class");
      const specEl = page.querySelector(`[data-rsvp-spec="${nightId}"]`);
      const prev = specEl ? specEl.value : "";
      const next = findSpec(sel.value, prev) ? prev : "";
      if (specEl) specEl.innerHTML = specOptions(sel.value, next);
      const role = specRole(sel.value, next);
      if (role) {
        const roleEl = page.querySelector(`[data-rsvp-role="${nightId}"]`);
        if (roleEl) roleEl.value = role;
        page.querySelectorAll(`[data-set-role][data-night="${nightId}"]`).forEach((b) => {
          b.className = b.getAttribute("data-set-role") === role ? "" : "ghost";
        });
      }
    };
  });
  page.querySelectorAll("[data-rsvp-spec]").forEach((sel) => {
    sel.onchange = () => {
      const nightId = sel.getAttribute("data-rsvp-spec");
      const classEl = page.querySelector(`[data-rsvp-class="${nightId}"]`);
      const role = specRole(classEl ? classEl.value : "", sel.value);
      if (!role) return;
      const roleEl = page.querySelector(`[data-rsvp-role="${nightId}"]`);
      if (roleEl) roleEl.value = role;
      page.querySelectorAll(`[data-set-role][data-night="${nightId}"]`).forEach((b) => {
        b.className = b.getAttribute("data-set-role") === role ? "" : "ghost";
      });
    };
  });
  const as = page.querySelector("#rsvpAs");
  if (as) {
    as.onchange = () => {
      const who = as.value || state.name;
      page.querySelectorAll(".night-signup").forEach((block) => {
        const night = findNightLocal(block.getAttribute("data-night"));
        const row = night && Object.values(night.signups || {}).find((r) => ckey(r.char) === ckey(who));
        applyCompToBlock(block, fillCompFrom(row, ckey(who) === ckey(state.name)));
      });
    };
  }
  page.querySelectorAll("[data-rsvp]").forEach((btn) => {
    btn.onclick = () => {
      const payload = collectSignup(page, btn);
      if (!payload.week) payload.week = week;
      saveRsvp(payload);
    };
  });
}

function bindSignupActions(page, week) {
  bindSignupForm(page, week);
}

function renderSignup(page, d) {
  const lead = state.role === "lead";
  const night = findNightLocal(state.nightId);
  if (!night) {
    page.appendChild(el(`<div class="card">
      <h2>找不到这场开团</h2>
      <p class="muted">链接可能过期，或团长已经删了这场。</p>
      <div class="row" style="margin-top:12px">
        <button type="button" id="toCal">去周历</button>
      </div>
    </div>`));
    page.querySelector("#toCal").onclick = () => gotoTab("calendar");
    return;
  }

  const proxyNames = new Set();
  (d.roster || []).forEach((n) => proxyNames.add(n));
  Object.values(d.intents || {}).forEach((i) => i.char && proxyNames.add(i.char));
  Object.values(night.signups || {}).forEach((r) => r.char && proxyNames.add(r.char));
  const rosterOpts = [...proxyNames].map((n) =>
    `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  const sc = night.signupCounts || { in: 0, out: 0, maybe: 0 };

  page.appendChild(el(`<div class="card signup-hero">
    <p class="muted">报名页 · 只看这一场</p>
    <h2>${esc(night.title || night.instance || "开团")}</h2>
    <dl class="signup-meta">
      <div><dt>日期</dt><dd>${esc(night.date ? dateWithWeekday(night.date) : "未标")}</dd></div>
      <div><dt>开始时间</dt><dd>${esc(night.time || "时间未定")}</dd></div>
      <div><dt>副本</dt><dd>${esc(night.instance || "未写")}</dd></div>
      ${night.note ? `<div><dt>备注</dt><dd>${esc(night.note)}</dd></div>` : ""}
    </dl>
    <p class="muted">能来 ${sc.in}${roleCountText(night.signups) ? " · " + roleCountText(night.signups) : ""} · 请假 ${sc.out} · 待定 ${sc.maybe}</p>
    <div class="row" style="margin-top:12px">
      <button type="button" data-share="${esc(night.id)}">复制报名链接</button>
      <button type="button" class="ghost" id="toCal">周历</button>
    </div>
  </div>`));

  page.appendChild(el(`<div class="card">
    <h2>报名</h2>
    ${lead ? `<label>代标队员</label>
      <select id="rsvpAs"><option value="">自己</option>${rosterOpts}</select>` : ""}
    ${nightSignupBlock(night, state.name)}
  </div>`));

  page.querySelector("#toCal").onclick = () => {
    state.calDate = night.date || state.calDate;
    gotoTab("calendar");
  };
  bindSignupActions(page, night.week || d.week);
}

async function shareNight(id, btn) {
  if (!id) return;
  const url = nightShareUrl(id);
  const ok = await copyText(url);
  if (btn) {
    const old = btn.textContent;
    btn.textContent = ok ? "已复制" : "复制失败";
    setTimeout(() => { btn.textContent = old; }, 1600);
  }
  state.notice = ok ? "报名链接已复制，发给团员即可打开这一场" : `请手动复制：${url}`;
  state.error = "";
  const okEl = document.getElementById("ok");
  const errEl = document.getElementById("err");
  if (okEl) okEl.textContent = state.notice;
  if (errEl) errEl.textContent = "";
}

async function openNight(id) {
  if (!id) return;
  state.nightId = id;
  const next = `/n/${encodeURIComponent(id)}`;
  if (location.pathname !== next) history.pushState({ night: id }, "", next);
  await focusSharedNight();
}

async function focusSharedNight() {
  const id = state.nightId || nightFromRoute();
  if (!id) return false;
  state.nightId = id;
  state.tab = "signup";
  sessionStorage.setItem("icra_tab", "signup");
  try { await ensureSeason(); } catch (_) {}
  let night = findNightLocal(id);
  if (!night) {
    try {
      const out = await api("/api/night?id=" + encodeURIComponent(id));
      night = out.night;
      if (out.week && state.data && state.data.week !== out.week) {
        await load(out.week, true);
      }
    } catch (e) {
      state.error = e.message;
      state.tab = "signup";
      render();
      return true;
    }
  }
  if (night) {
    if (night.date) {
      state.calDate = night.date;
      const p = ymdParts(night.date);
      if (p.y && p.m) {
        state.calYear = p.y;
        state.calMonth = p.m;
      }
    }
    const week = night.week || weekOfDate(night.date);
    if (week && state.data && state.data.week !== week) {
      await load(week, true);
      return true;
    }
  }
  render();
  return true;
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
    <div class="table-scroll"><table class="stack-phone">
      <thead><tr><th>物品</th><th>获奖</th><th>Boss</th><th>去向</th><th>周</th></tr></thead>
      ${body}
    </table></div>
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
    <td data-th="物品">${itemChip(a.itemId, a.itemLink)}</td>
    <td data-th="获奖"><button type="button" class="link" data-hist-char="${esc(ckey(a.winner))}">${esc(shortName(a.winner))}</button></td>
    <td class="muted" data-th="Boss">${esc(a.boss || "—")}</td>
    <td data-th="去向">${markTag(a.mark)}</td>
    <td class="muted" data-th="周">${esc(a.week || "")}</td>
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
    <table class="stack-phone">
      <thead><tr><th>角色</th><th>件数</th><th>已交付</th></tr></thead>
      <tbody>${rows.length ? rows.map((r) => `<tr>
        <td>${esc(r.char)}</td><td>${r.n} 件</td><td>已交付 ${r.traded}</td>
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
  const intentVals = Object.values(d.intents || {});
  const noWeekly = intentVals.filter((i) => weeklyKeys(i).length === 0);
  const shortSlots = intentVals
    .map((i) => {
      const filled = (i.slots || []).map((s) => SLOT_LABEL[s.slotKey] || s.slotKey);
      return { char: i.char, n: (i.slots || []).length, filled, intent: i };
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
    <h2>已登记预设但未提交本周意向</h2>
    <p class="muted">预设可以慢慢填。本周团本拾取请勾最多 ${WEEKLY_INTENT_LIMIT} 件。</p>
    ${noWeekly.length ? `<table class="stack-phone">
      <thead><tr><th>角色</th><th>预设</th><th>已填</th></tr></thead>
      <tbody>${noWeekly.map((i) => `<tr>
        <td>${esc(i.char)}</td>
        <td>${slotDots(i)}</td>
        <td>${(i.slots || []).length}/16</td>
      </tr>`).join("")}</tbody>
    </table>` : `<p class="muted">有登记的人都勾了本周意向，或还没有意向。</p>`}
  </div>`));

  page.appendChild(el(`<div class="card">
    <h2>预设未满 16 栏</h2>
    ${shortSlots.length ? `<table class="stack-phone">
      <thead><tr><th>角色</th><th>部位</th><th>已填</th><th>说明</th></tr></thead>
      <tbody>${shortSlots.map((x) => `<tr>
        <td>${esc(x.char)}</td>
        <td>${slotDots(x.intent)}</td>
        <td>${x.n}/16</td>
        <td class="muted">还差 ${16 - x.n} 栏${x.filled.length ? " · 已填 " + x.filled.join("、") : ""}</td>
      </tr>`).join("")}</tbody>
    </table>` : `<p class="muted">预设都满 16 栏，或还没有意向。</p>`}
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
    ${prios.length ? `<table class="stack-phone">
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
    <table class="stack-phone">
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
  const insts = journalInstances();
  const inst = currentJournalInstance();
  const picks = journalBosses();
  const bossId = currentJournalId();
  const entry = journalEntry(bossId);
  const pick = picks.find((b) => b.id === bossId) || entry || {};
  const title = pick.nameZh || (entry && entry.nameZh) || inst.nameZh || raidInstanceName();
  const subtitle = pick.nameEn || (entry && entry.nameEn) || "";
  const note = tacticNoteFor({
    id: bossId,
    nameZh: title,
    nameEn: subtitle,
  });
  const methodHref = (entry && entry.methodUrl) || "";
  const diff = currentJournalDiff();
  const wipefest = wipefestHref(entry && entry.wipefestSlug, diff);
  const facts = [
    entry && entry.setup ? tag(entry.setup, "") : "",
    entry && entry.lust ? tag("嗜血 " + entry.lust, "heal") : "",
    ...((entry && entry.need) || []).map((n) => tag(n, "warn")),
  ].filter(Boolean).join("");

  page.appendChild(el(`<div class="card">
    <h2>${esc(inst.nameZh || raidInstanceName())} · 12.1 手册</h2>
    ${insts.length > 1 ? `<div class="boss-picks inst-picks">${insts.map((row) =>
      `<button type="button" class="ghost${row.id === inst.id ? " on" : ""}" data-journal-inst="${esc(row.id)}">${esc(row.nameZh || row.nameEn)}${row.kind === "lair" ? " · 巢穴" : ""}</button>`
    ).join("")}</div>` : ""}
    ${inst.lore ? `<p>${esc(inst.lore)}</p>` : ""}
    ${inst.entrance ? `<p class="muted">入口：${esc(inst.entrance)}</p>` : ""}
    <p class="muted">短动图是本站示意，不是排轴。完整图文看
      <a href="https://dreamforgewow.com/dungeon-journal" target="_blank" rel="noreferrer">梦工坊地下城手册</a>。${
        methodHref
          ? ` <a href="${esc(methodHref)}" target="_blank" rel="noreferrer">Method 英雄攻略</a>。`
          : " Method 英雄页未上的王只写已知要点。"
      }${
        wipefest
          ? ` <a href="${esc(wipefest)}" target="_blank" rel="noreferrer">Wipefest ${JOURNAL_DIFFS.find((x) => x.id === diff).name}</a>。`
          : ""
      }
    </p>
    <div class="boss-picks">${picks.map((b) =>
      `<button type="button" class="ghost${b.id === bossId ? " on" : ""}" data-journal="${esc(b.id)}">${esc(b.nameZh || b.nameEn)}</button>`
    ).join("")}</div>
  </div>`));

  let abilities = [];
  if (entry) {
    const roles = entry.roles || {};
    const plan = entry.plan || [];
    abilities = (entry.abilities || []).filter((a) => shownOnDiff(a, diff));
    const positions = (entry.positions || []).filter((p) => shownOnDiff(p, diff));
    page.appendChild(el(`<div class="card journal-card">
      <h2>${esc(entry.nameZh)} <span class="muted" style="font-weight:500">${esc(entry.nameEn || "")}</span></h2>
      <div class="boss-picks diff-picks">${JOURNAL_DIFFS.map((row) =>
        `<button type="button" class="ghost${row.id === diff ? " on" : ""}" data-journal-diff="${row.id}">${row.name}</button>`
      ).join("")}</div>
      ${facts ? `<div class="journal-facts">${facts}</div>` : ""}
      <p>${esc(entry.overview || "")}</p>
      ${plan.length ? `<h3>打法要点</h3>${plan.map((p) =>
        `<div class="plan-block"><h4>${esc(p.title || "")}</h4><ul>${(p.items || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`
      ).join("")}` : ""}
      ${positions.length ? `<h3>团队站位 / 走位</h3><div class="pos-grid">${positions.map(positionCard).join("")}</div>` : ""}
      ${(entry.wipe || []).length ? `<h3>常见灭团</h3><ul class="wipe">${entry.wipe.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
      <div class="role-grid">
        <div><h3>坦克</h3><ul>${(roles.tank || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h3>治疗</h3><ul>${(roles.healer || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h3>输出</h3><ul>${(roles.dps || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      </div>
      <h3>关键技能</h3>
      ${lead ? `<p class="muted">每个技能最多 ${CLIP_PER_ABILITY} 张。截图会自动压缩，点缩略图放大。视频贴 B 站 / YouTube 完整页。不改上面手册原文。</p>` : ""}
      <div class="abilities">${abilities.length ? abilities.map((a, i) => abilityCard(a, diff, entry, i)).join("") : `<p class="muted">这个难度没有单独条目。</p>`}</div>
      ${diff === "mythic" && (entry.mythic || []).length ? `<h3>史诗</h3><ul>${entry.mythic.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
    </div>`));
  } else {
    page.appendChild(el(`<div class="card"><p class="muted">还没有这只王的手册。</p></div>`));
  }

  page.appendChild(el(`<div class="card">
    <h2>ZOO 备注 · ${esc(title)}</h2>
    <p class="muted">团长写本团要点，和上面手册分开存。分技能的截图或视频贴在对应技能卡下面。</p>
    ${lead ? `<textarea id="zooNote">${esc(note.note || "")}</textarea>
      <div class="row" style="margin-top:8px"><button id="saveTac">保存备注</button></div>`
      : (note.note ? `<p class="prose">${esc(note.note)}</p>` : `<p class="muted">团长还没写这只王的备注。</p>`)}
  </div>`));

  page.querySelectorAll("[data-journal-inst]").forEach((btn) => {
    btn.onclick = () => {
      state.journalInstance = btn.getAttribute("data-journal-inst");
      const ids = journalBosses().map((b) => b.id);
      if (!ids.includes(state.journalBoss)) state.journalBoss = ids[0] || "";
      render();
    };
  });
  page.querySelectorAll("[data-journal]").forEach((btn) => {
    btn.onclick = () => {
      state.journalBoss = btn.getAttribute("data-journal");
      render();
    };
  });
  page.querySelectorAll("[data-journal-diff]").forEach((btn) => {
    btn.onclick = () => {
      state.journalDiff = btn.getAttribute("data-journal-diff");
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

  const postClip = (a, extra) => api("/api/ability-clip", {
    method: "POST",
    body: JSON.stringify({
      week: d.week,
      bossId,
      abilityKey: abilityClipKey(a),
      caption: extra.caption || "",
      ...extra,
    }),
  });

  const saveClip = async (index) => {
    const a = abilities[index];
    if (!a) return;
    const urlInput = page.querySelector(`[data-clip-url="${index}"]`);
    const capInput = page.querySelector(`[data-clip-cap="${index}"]`);
    try {
      await afterWrite(await postClip(a, {
        url: urlInput && urlInput.value || "",
        caption: capInput && capInput.value || "",
      }), "资料已添加");
    } catch (e) { fail(e); }
  };

  const uploadClipFiles = async (index, files) => {
    const a = abilities[index];
    if (!a) return;
    const capInput = page.querySelector(`[data-clip-cap="${index}"]`);
    const caption = capInput && capInput.value || "";
    try {
      let last = state.data;
      let n = 0;
      for (const file of files) {
        if (file.size > 4 * 1024 * 1024) throw new Error("截图请压到 4MB 以内");
        last = await postClip(a, { image: await compressImageFile(file), caption });
        n += 1;
        if (last && last.guild) state.data = last;
      }
      await afterWrite(last, n > 1 ? `已上传 ${n} 张` : "截图已上传");
    } catch (e) { fail(e); }
  };

  page.querySelectorAll("[data-save-clip]").forEach((btn) => {
    btn.onclick = () => saveClip(Number(btn.getAttribute("data-save-clip")));
  });
  page.querySelectorAll("[data-clear-clip]").forEach((btn) => {
    btn.onclick = async () => {
      const index = Number(btn.getAttribute("data-clear-clip"));
      const a = abilities[index];
      if (!a) return;
      try {
        await afterWrite(await postClip(a, { clear: true }), "资料已全部清除");
      } catch (e) { fail(e); }
    };
  });
  page.querySelectorAll("[data-remove-clip]").forEach((btn) => {
    btn.onclick = async () => {
      const index = Number(btn.getAttribute("data-remove-clip"));
      const a = abilities[index];
      const removeId = btn.getAttribute("data-clip-id");
      if (!a || !removeId) return;
      try {
        await afterWrite(await postClip(a, { removeId }), "已删除");
      } catch (e) { fail(e); }
    };
  });
  page.querySelectorAll("[data-clip-file]").forEach((input) => {
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      if (files.length) uploadClipFiles(Number(input.getAttribute("data-clip-file")), files);
    };
  });
  page.querySelectorAll("[data-zoom-src]").forEach((btn) => {
    btn.onclick = () => openClipZoom(btn.getAttribute("data-zoom-src"), btn.getAttribute("data-zoom-cap") || "");
  });
  ensureClipZoom();
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
  if (tab !== "signup" && state.tab === "signup") {
    state.nightId = "";
    if (/^\/n\//.test(location.pathname)) history.pushState({}, "", "/");
  }
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

async function saveRsvp(payload) {
  try {
    await afterWrite(await api("/api/rsvp", {
      method: "POST",
      body: JSON.stringify(payload),
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

async function load(week, skipFocus) {
  try {
    state.data = await api("/api/state" + (week ? "?week=" + encodeURIComponent(week) : ""));
    state.week = state.data.week;
    state.error = "";
    if (SEASON_TABS.has(state.tab) || state.tab === "signup" || state.season) {
      try {
        const from = state.data.seasonStart || "2026-08-13";
        state.season = await api("/api/season?from=" + encodeURIComponent(from));
      } catch (_) {}
    }
    if (!skipFocus && (state.nightId || nightFromRoute())) {
      state.nightId = state.nightId || nightFromRoute();
      await focusSharedNight();
      return;
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

function bootRoute() {
  const id = nightFromRoute();
  if (id) {
    state.nightId = id;
    state.tab = "signup";
    sessionStorage.setItem("icra_tab", "signup");
  }
}

window.addEventListener("popstate", () => {
  const id = nightFromRoute();
  if (id) {
    state.nightId = id;
    if (state.token) focusSharedNight();
    else renderLogin();
    return;
  }
  if (state.tab === "signup") {
    state.nightId = "";
    state.tab = "calendar";
    sessionStorage.setItem("icra_tab", "calendar");
  }
  if (state.data) render();
  else if (state.token) load();
  else renderLogin();
});

bootRoute();
if (state.token) load();
else renderLogin();
