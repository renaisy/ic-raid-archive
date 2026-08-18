#!/usr/bin/env node
// IC Raid Archive — weekly intent + loot records.
// Week id matches the addons: Thursday 05:00 UTC+8, YYYY-MM-DD.
// Payloads: ICRC1:intent:{...}  and  ICRC1:loot:{...}

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const STORE_PATH = path.join(ROOT, "data", "store.json");
const LOOT_PATH = path.join(ROOT, "data", "raid-loot.json");
const JOURNAL_PATH = path.join(ROOT, "data", "raid-journal.json");
const QUALITY_BY_COLOR = {
  "9d9d9d": "poor",
  ffffff: "common",
  "1eff00": "uncommon",
  "0070dd": "rare",
  a335ee: "epic",
  ff8000: "legendary",
  e6cc80: "artifact",
};
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT) || 8765;
const DEFAULT_SEASON = "2026-08-13";
const WEEK_RESET_HOUR = 5; // 上海时间周四 5 点换周
const MARKS = new Set(["player", "bank", "de"]);
const RSVP = new Set(["in", "out", "maybe"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function raidWeekStart(ts) {
  const t = ts == null ? Date.now() : Number(ts) * 1000;
  const cst = t + 8 * 3600 * 1000 - WEEK_RESET_HOUR * 3600 * 1000;
  const d = new Date(cst);
  const wday = d.getUTCDay(); // 0 Sun … 4 Thu
  const back = (wday - 4 + 7) % 7;
  const week = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back);
  const w = new Date(week);
  const y = w.getUTCFullYear();
  const m = String(w.getUTCMonth() + 1).padStart(2, "0");
  const day = String(w.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
}

function formatYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekFromDate(ymd) {
  const p = parseYmd(ymd);
  if (!p) return null;
  const t = Date.UTC(p.y, p.mo - 1, p.d);
  const wday = new Date(t).getUTCDay();
  const back = (wday - 4 + 7) % 7;
  return formatYmd(new Date(t - back * 86400000));
}

function dateInWeek(week, date) {
  return weekFromDate(date) === week;
}

function charKey(name) {
  return String(name || "").toLowerCase().replace(/[\s'-]/g, "");
}

function nid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadStore() {
  let store;
  try {
    store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch (_) {
    store = { config: {}, sessions: {}, weeks: {} };
  }
  store.config = store.config || {};
  if (!store.config.leadCode) store.config.leadCode = "ic-lead";
  if (!store.config.raiderCode) store.config.raiderCode = "ic-raid";
  if (!store.config.seasonStart) store.config.seasonStart = DEFAULT_SEASON;
  store.config.guildName = store.config.guildName || "ZOO";
  store.config.realm = store.config.realm || "海加尔";
  store.config.region = store.config.region || "CN";
  store.sessions = store.sessions || {};
  store.weeks = store.weeks || {};
  store.guild = store.guild || {};
  store.guild.roster = Array.isArray(store.guild.roster) ? store.guild.roster : [];
  store.guild.rules = typeof store.guild.rules === "string" ? store.guild.rules : "";
  store.guild.tactics = Array.isArray(store.guild.tactics) ? store.guild.tactics : [];
  return store;
}

function bindChar(store, raw) {
  const name = String(raw || "").trim();
  if (!name) return "";
  if (name.includes("-")) return name.slice(0, 64);
  return `${name}-${store.config.realm || "海加尔"}`.slice(0, 64);
}

function parseRosterText(store, text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((s) => bindChar(store, s))
    .filter(Boolean)
    .slice(0, 40);
}

function guildPublic(store) {
  return {
    name: store.config.guildName || "ZOO",
    realm: store.config.realm || "海加尔",
    region: store.config.region || "CN",
    roster: (store.guild.roster || []).slice(),
    rules: store.guild.rules || "",
    tactics: (store.guild.tactics || []).map((t) => ({
      name: String(t.name || "").slice(0, 64),
      note: String(t.note || "").slice(0, 2000),
    })),
  };
}

function emptyLoot() {
  return {
    instance: { id: "venomous-abyss", nameZh: "剧毒深渊", nameEn: "The Venomous Abyss", patch: "12.1" },
    bosses: [],
    items: {},
  };
}

function loadLoot() {
  try {
    const raw = JSON.parse(fs.readFileSync(LOOT_PATH, "utf8"));
    raw.instance = raw.instance || emptyLoot().instance;
    raw.bosses = Array.isArray(raw.bosses) ? raw.bosses : [];
    raw.items = raw.items && typeof raw.items === "object" ? raw.items : {};
    return raw;
  } catch (_) {
    return emptyLoot();
  }
}

function saveLoot(loot) {
  fs.mkdirSync(path.dirname(LOOT_PATH), { recursive: true });
  fs.writeFileSync(LOOT_PATH, JSON.stringify(loot, null, 2), "utf8");
}

function emptyJournal() {
  return {
    instance: {
      id: "venomous-abyss",
      nameZh: "剧毒深渊",
      nameEn: "The Venomous Abyss",
      patch: "12.1",
      lore: "",
      entrance: "",
    },
    bosses: [],
  };
}

function loadJournal() {
  try {
    const raw = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
    raw.instance = raw.instance || emptyJournal().instance;
    raw.bosses = Array.isArray(raw.bosses) ? raw.bosses : [];
    return raw;
  } catch (_) {
    return emptyJournal();
  }
}

function parseItemLink(link) {
  const raw = String(link || "");
  const color = ((raw.match(/\|cff([0-9a-f]{6})/i) || [])[1] || "").toLowerCase();
  const name = (raw.match(/\|h\[([^\]]+)\]\|h/) || [])[1] || "";
  return { color, name };
}

function matchBossId(loot, name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return "";
  for (const b of loot.bosses || []) {
    if (b.id === name) return b.id;
    if (String(b.nameEn || "").toLowerCase() === n) return b.id;
    if (String(b.nameZh || "") === name) return b.id;
  }
  return "";
}

function learnItem(loot, itemId, link, boss) {
  const id = String(Number(itemId));
  if (!Number(id)) return;
  const parsed = parseItemLink(link);
  const prev = loot.items[id] || {};
  const cjk = parsed.name && /[\u4e00-\u9fff]/.test(parsed.name);
  loot.items[id] = {
    nameZh: prev.nameZh || (cjk ? parsed.name : ""),
    nameEn: prev.nameEn || (!cjk ? parsed.name : "") || prev.nameEn || "",
    quality: prev.quality || QUALITY_BY_COLOR[parsed.color] || "epic",
    icon: prev.icon || "",
    slot: prev.slot || "",
    armor: prev.armor || "",
    boss: prev.boss || matchBossId(loot, boss),
    token: !!prev.token,
    learned: prev.learned || !prev.nameZh,
  };
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function weekBucket(store, week) {
  const created = !store.weeks[week];
  if (created) {
    store.weeks[week] = { intents: {}, awards: {}, bosses: [], roster: [] };
  }
  const w = store.weeks[week];
  w.intents = w.intents || {};
  w.awards = w.awards || {};
  w.bosses = w.bosses || [];
  w.roster = w.roster || [];
  w.nights = w.nights || [];
  w.rsvp = w.rsvp || {};
  w.signups = w.signups && typeof w.signups === "object" ? w.signups : {};
  w.memo = typeof w.memo === "string" ? w.memo : "";
  w.priorities = w.priorities || [];
  if (!w.roster.length && store.guild.roster.length) {
    w.roster = store.guild.roster.slice();
  }
  return w;
}

function readWeek(store, week) {
  const w = store.weeks[week] || {};
  return {
    intents: w.intents || {},
    awards: w.awards || {},
    bosses: w.bosses || [],
    roster: w.roster || [],
    nights: w.nights || [],
    rsvp: w.rsvp || {},
    signups: w.signups || {},
    memo: typeof w.memo === "string" ? w.memo : "",
    priorities: w.priorities || [],
  };
}

function sessionOf(store, token) {
  if (!token) return null;
  const s = store.sessions[token];
  if (!s) return null;
  if (Date.now() - (s.at || 0) > 30 * 24 * 3600 * 1000) {
    delete store.sessions[token];
    return null;
  }
  return s;
}

function parseArchive(text) {
  const raw = String(text || "").trim();
  const intent = raw.match(/^ICRC1:intent:(.+)$/s);
  const loot = raw.match(/^ICRC1:loot:(.+)$/s);
  if (intent) {
    const data = JSON.parse(intent[1]);
    if (data.kind !== "intent" || Number(data.v) !== 1) throw new Error("意向格式不对");
    if (!data.char) throw new Error("缺少角色名");
    return { type: "intent", data };
  }
  if (loot) {
    const data = JSON.parse(loot[1]);
    if (data.kind !== "loot" || Number(data.v) !== 1) throw new Error("分配格式不对");
    if (!Array.isArray(data.awards)) throw new Error("缺少 awards");
    return { type: "loot", data };
  }
  throw new Error("请粘贴 ICRC1:intent: 或 ICRC1:loot: 开头的导出文本");
}

function applyIntent(bucket, data, at) {
  const key = charKey(data.char);
  const slots = Array.isArray(data.slots) ? data.slots : [];
  bucket.intents[key] = {
    char: String(data.char).slice(0, 64),
    spec: data.spec || null,
    class: data.class || null,
    slots: slots
      .filter((s) => s && s.slotKey && Number(s.itemId))
      .map((s) => ({
        slotKey: String(s.slotKey).slice(0, 16),
        itemId: Number(s.itemId),
        priority: s.priority || "bis",
      })),
    at: Number(data.at) || at,
    week: data.week || null,
  };
  return key;
}

function awardMark(value, fallback) {
  const m = String(value || "");
  if (MARKS.has(m)) return m;
  if (MARKS.has(fallback)) return fallback;
  return "player";
}

function applyLoot(bucket, data) {
  const loot = loadLoot();
  let n = 0;
  for (const a of data.awards || []) {
    if (!a || !a.uid || !Number(a.itemId)) continue;
    const uid = String(a.uid).slice(0, 64);
    const prev = bucket.awards[uid];
    bucket.awards[uid] = {
      uid,
      itemId: Number(a.itemId),
      itemLink: a.itemLink ? String(a.itemLink).slice(0, 256) : "",
      winner: a.winner ? String(a.winner).slice(0, 48) : "",
      boss: a.boss ? String(a.boss).slice(0, 64) : "",
      awardedAt: Number(a.awardedAt) || 0,
      traded: !!a.traded,
      mark: awardMark(a.mark, prev && prev.mark),
    };
    learnItem(loot, a.itemId, a.itemLink, a.boss);
    n += 1;
  }
  saveLoot(loot);
  const names = new Set(bucket.bosses.map((b) => b.name));
  for (const a of Object.values(bucket.awards)) {
    if (a.boss && !names.has(a.boss)) {
      names.add(a.boss);
      bucket.bosses.push({ name: a.boss, down: true });
    }
  }
  return n;
}

function rsvpCounts(rsvp) {
  const c = { in: 0, out: 0, maybe: 0 };
  for (const r of Object.values(rsvp || {})) {
    if (c[r.status] != null) c[r.status] += 1;
  }
  return c;
}

function publicNights(bucket) {
  const signups = bucket.signups || {};
  return (bucket.nights || []).map((n) => ({
    ...n,
    signups: signups[n.id] || {},
    signupCounts: rsvpCounts(signups[n.id]),
  }));
}

function snapshot(store, week, sess) {
  const bucket = weekBucket(store, week);
  const roster = bucket.roster.slice();
  const registered = new Set(Object.values(bucket.intents).map((i) => charKey(i.char)));
  const missing = roster.filter((n) => !registered.has(charKey(n)));
  const weeks = Object.keys(store.weeks).sort().reverse();
  if (!weeks.includes(week)) weeks.unshift(week);
  const awards = {};
  for (const [uid, a] of Object.entries(bucket.awards)) {
    awards[uid] = { ...a, mark: awardMark(a.mark) };
  }
  return {
    week,
    weeks,
    role: sess.role,
    name: sess.name,
    seasonStart: store.config.seasonStart || DEFAULT_SEASON,
    intents: bucket.intents,
    awards,
    bosses: bucket.bosses,
    roster: bucket.roster,
    missing,
    nights: publicNights(bucket),
    rsvp: bucket.rsvp,
    rsvpCounts: rsvpCounts(bucket.rsvp),
    signups: bucket.signups || {},
    memo: bucket.memo,
    priorities: bucket.priorities,
    guild: guildPublic(store),
    loot: loadLoot(),
    journal: loadJournal(),
  };
}

function seasonPayload(store, from) {
  const start = parseYmd(from) ? from : store.config.seasonStart || DEFAULT_SEASON;
  const weekIds = Object.keys(store.weeks).filter((w) => w >= start).sort();
  const awards = [];
  const seen = new Set();
  const intents = [];
  const rosters = [];
  const rsvps = [];
  const nights = [];
  for (const w of Object.keys(store.weeks).sort()) {
    const b = readWeek(store, w);
    for (const n of b.nights) {
      nights.push({
        ...n,
        week: w,
        signups: (b.signups && b.signups[n.id]) || {},
        signupCounts: rsvpCounts(b.signups && b.signups[n.id]),
      });
    }
  }
  for (const w of weekIds) {
    const b = readWeek(store, w);
    for (const a of Object.values(b.awards)) {
      if (!a || !a.uid || seen.has(a.uid)) continue;
      seen.add(a.uid);
      awards.push({ ...a, mark: awardMark(a.mark), week: w });
    }
    for (const i of Object.values(b.intents)) {
      intents.push({
        week: w,
        key: charKey(i.char),
        char: i.char,
        spec: i.spec || null,
        class: i.class || null,
        slots: i.slots || [],
        at: i.at || 0,
      });
    }
    rosters.push({ week: w, names: (b.roster || []).slice() });
    rsvps.push({ week: w, rsvp: b.rsvp || {}, signups: b.signups || {} });
  }
  return {
    from: start,
    seasonStart: store.config.seasonStart || DEFAULT_SEASON,
    weeks: weekIds,
    awards,
    intents,
    rosters,
    rsvps,
    nights,
  };
}

function cleanNight(body, id) {
  const date = String(body.date || "").trim();
  if (!parseYmd(date)) throw new Error("开团日格式应为 YYYY-MM-DD");
  return {
    id: id || String(body.id || "").slice(0, 32) || nid(),
    date,
    time: String(body.time || "").trim().slice(0, 16),
    title: String(body.title || "").trim().slice(0, 40),
    instance: String(body.instance || "").trim().slice(0, 64),
    note: String(body.note || "").trim().slice(0, 160),
  };
}

function findNight(store, id) {
  if (!id) return null;
  for (const week of Object.keys(store.weeks)) {
    const b = store.weeks[week];
    const list = (b && b.nights) || [];
    const i = list.findIndex((n) => n && n.id === id);
    if (i >= 0) return { week, bucket: weekBucket(store, week), index: i, night: list[i] };
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const file = path.normalize(path.join(PUBLIC, urlPath));
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

function requireLead(sess, res) {
  if (sess.role !== "lead") {
    send(res, 403, { error: "只有团长能改这项" });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (!url.pathname.startsWith("/api/")) {
    serveStatic(req, res);
    return;
  }

  let store = loadStore();
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const sess = sessionOf(store, token);

  try {
    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readBody(req);
      const name = bindChar(store, body.name);
      const code = String(body.code || "").trim();
      if (!name) {
        send(res, 400, { error: "请填写角色名" });
        return;
      }
      let role = null;
      if (code === store.config.leadCode) role = "lead";
      else if (code === store.config.raiderCode) role = "raider";
      else {
        send(res, 403, { error: "邀请码不对" });
        return;
      }
      const tok = crypto.randomBytes(16).toString("hex");
      store.sessions[tok] = { role, name, at: Date.now() };
      saveStore(store);
      send(res, 200, { token: tok, role, name, week: raidWeekStart() });
      return;
    }

    if (!sess) {
      send(res, 401, { error: "请先用邀请码登录" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      const week = url.searchParams.get("week") || raidWeekStart();
      send(res, 200, snapshot(store, week, sess));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/items") {
      send(res, 200, loadLoot());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/season") {
      const from = url.searchParams.get("from") || store.config.seasonStart || DEFAULT_SEASON;
      send(res, 200, seasonPayload(store, from));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/import") {
      const body = await readBody(req);
      const parsed = parseArchive(body.text);
      const week = body.week || parsed.data.week || raidWeekStart();
      const bucket = weekBucket(store, week);
      if (parsed.type === "intent") {
        if (sess.role !== "lead" && charKey(parsed.data.char) !== charKey(sess.name)) {
          send(res, 403, { error: "只能导入自己的意向" });
          return;
        }
        applyIntent(bucket, parsed.data, Math.floor(Date.now() / 1000));
        saveStore(store);
        send(res, 200, snapshot(store, week, sess));
        return;
      }
      if (sess.role !== "lead") {
        send(res, 403, { error: "只有团长能导入分配" });
        return;
      }
      const n = applyLoot(bucket, parsed.data);
      saveStore(store);
      send(res, 200, { ...snapshot(store, week, sess), imported: n });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/intent") {
      const body = await readBody(req);
      const week = body.week || raidWeekStart();
      const char = bindChar(store, sess.role === "lead" && body.char ? body.char : sess.name);
      const bucket = weekBucket(store, week);
      applyIntent(bucket, {
        char,
        spec: body.spec,
        class: body.class,
        slots: body.slots || [],
        at: Math.floor(Date.now() / 1000),
      });
      saveStore(store);
      send(res, 200, snapshot(store, week, sess));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/roster") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req);
      const week = body.week || raidWeekStart();
      const bucket = weekBucket(store, week);
      const names = parseRosterText(store, body.text);
      bucket.roster = names;
      store.guild.roster = names.slice();
      saveStore(store);
      send(res, 200, snapshot(store, week, sess));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bosses") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req);
      const week = body.week || raidWeekStart();
      const bucket = weekBucket(store, week);
      const bosses = Array.isArray(body.bosses) ? body.bosses : [];
      bucket.bosses = bosses
        .filter((b) => b && b.name)
        .slice(0, 20)
        .map((b) => ({ name: String(b.name).slice(0, 64), down: !!b.down }));
      saveStore(store);
      send(res, 200, snapshot(store, week, sess));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/nights") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req);
      const action = String(body.action || "add");
      if (action === "delete") {
        const found = findNight(store, String(body.id || ""));
        if (!found) {
          send(res, 400, { error: "找不到这场开团夜" });
          return;
        }
        found.bucket.nights.splice(found.index, 1);
        if (found.bucket.signups) delete found.bucket.signups[String(body.id || "")];
        saveStore(store);
        send(res, 200, snapshot(store, body.week || found.week, sess));
        return;
      }
      if (action === "update") {
        const found = findNight(store, String(body.id || ""));
        if (!found) {
          send(res, 400, { error: "找不到这场开团夜" });
          return;
        }
        const next = cleanNight({ ...found.night, ...body, id: found.night.id }, found.night.id);
        if (!dateInWeek(found.week, next.date)) {
          send(res, 400, { error: "开团日必须落在该周四至下周三" });
          return;
        }
        found.bucket.nights[found.index] = next;
        saveStore(store);
        send(res, 200, snapshot(store, found.week, sess));
        return;
      }
      const night = cleanNight(body);
      const week = weekFromDate(night.date);
      if (body.week && body.week !== week) {
        send(res, 400, { error: "开团日必须落在该周四至下周三" });
        return;
      }
      const bucket = weekBucket(store, week);
      if (bucket.nights.length >= 14) {
        send(res, 400, { error: "本周开团夜太多" });
        return;
      }
      bucket.nights.push(night);
      bucket.nights.sort((a, b) => String(a.date).localeCompare(b.date) || String(a.time).localeCompare(b.time));
      saveStore(store);
      send(res, 200, snapshot(store, week, sess));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/rsvp") {
      const body = await readBody(req);
      const status = String(body.status || "");
      if (!RSVP.has(status)) {
        send(res, 400, { error: "状态只能是 能来 / 请假 / 待定" });
        return;
      }
      const requested = bindChar(store, body.char || sess.name);
      if (sess.role !== "lead" && charKey(requested) !== charKey(sess.name)) {
        send(res, 403, { error: "只能改自己的请假" });
        return;
      }
      const char = sess.role === "lead" && requested ? requested : sess.name;
      const row = {
        char,
        status,
        note: String(body.note || "").trim().slice(0, 120),
      };
      const nightId = String(body.nightId || "").slice(0, 32);
      let week = body.week || raidWeekStart();
      if (nightId) {
        const found = findNight(store, nightId);
        if (!found) {
          send(res, 400, { error: "找不到这场开团" });
          return;
        }
        found.bucket.signups[nightId] = found.bucket.signups[nightId] || {};
        found.bucket.signups[nightId][charKey(char)] = row;
        week = found.week;
      } else {
        weekBucket(store, week).rsvp[charKey(char)] = row;
      }
      saveStore(store);
      send(res, 200, snapshot(store, week, sess));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/memo") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req);
      const week = body.week || raidWeekStart();
      const bucket = weekBucket(store, week);
      bucket.memo = String(body.memo || "").slice(0, 4000);
      saveStore(store);
      send(res, 200, snapshot(store, week, sess));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/priorities") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req);
      const week = body.week || raidWeekStart();
      const bucket = weekBucket(store, week);
      const list = Array.isArray(body.priorities) ? body.priorities : [];
      bucket.priorities = list
        .filter((p) => p && p.char && Number(p.itemId))
        .slice(0, 40)
        .map((p) => ({
          char: String(p.char).trim().slice(0, 64),
          itemId: Number(p.itemId),
          reason: String(p.reason || "").trim().slice(0, 120),
        }));
      saveStore(store);
      send(res, 200, snapshot(store, week, sess));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/rules") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req);
      store.guild.rules = String(body.rules || "").slice(0, 8000);
      saveStore(store);
      send(res, 200, snapshot(store, body.week || raidWeekStart(), sess));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/tactics") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req);
      const list = Array.isArray(body.tactics) ? body.tactics : [];
      store.guild.tactics = list
        .filter((t) => t && String(t.name || "").trim())
        .slice(0, 30)
        .map((t) => ({
          name: String(t.name).trim().slice(0, 64),
          note: String(t.note || "").trim().slice(0, 2000),
        }));
      saveStore(store);
      send(res, 200, snapshot(store, body.week || raidWeekStart(), sess));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/award-mark") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req);
      const week = body.week || raidWeekStart();
      const uid = String(body.uid || "").slice(0, 64);
      const mark = String(body.mark || "");
      if (!MARKS.has(mark)) {
        send(res, 400, { error: "标记只能是获奖者 / 公会银行 / 分解" });
        return;
      }
      const bucket = weekBucket(store, week);
      if (!bucket.awards[uid]) {
        send(res, 400, { error: "找不到这条分配" });
        return;
      }
      bucket.awards[uid].mark = mark;
      saveStore(store);
      send(res, 200, snapshot(store, week, sess));
      return;
    }

    send(res, 404, { error: `unknown api ${req.method} ${url.pathname}` });
  } catch (err) {
    send(res, 400, { error: err.message || String(err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ZOO 团本档案  http://${HOST}:${PORT}`);
  console.log("国服海加尔 · ZOO · 周起始：上海时间周四 5 点");
  console.log("默认邀请码  团长 ic-lead  队员 ic-raid  （改 data/store.json 里的 config）");
});
