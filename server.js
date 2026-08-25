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
const UPLOAD_DIR = path.join(ROOT, "data", "uploads");
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
const ROLES = new Set(["tank", "healer", "dps"]);
const WEEKLY_INTENT_LIMIT = 2;
const CLIP_URL_MAX = 500;
const CLIP_CAPTION_MAX = 200;
const CLIP_KEY_MAX = 80;
const CLIP_TOTAL_MAX = 200;
const CLIP_PER_ABILITY = 8;
const TIMELINE_RAW_MAX = 20000;
const TIMELINE_EVENTS_MAX = 200;
const TIMELINE_NOTE_MAX = 80;
const TIMELINE_ROLE_MAX = 24;
const TIMELINE_NAME_MAX = 64;
const CLIP_IMAGE_MAX = 4 * 1024 * 1024;
const BODY_MAX = 256 * 1024;
const CLIP_BODY_MAX = 8 * 1024 * 1024;
const UPLOAD_NAME = /^[a-f0-9]{32}\.(jpg|png|webp|gif)$/;
const IMAGE_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const YT_ID = /^[\w-]{11}$/;
const BV_ID = /^BV[1-9A-HJ-NP-Za-km-z]{10}$/;
const SLOT_KEYS = new Set([
  "HEAD", "NECK", "SHOULDER", "BACK", "CHEST", "WRIST", "HANDS", "WAIST",
  "LEGS", "FEET", "FINGER1", "FINGER2", "TRINKET1", "TRINKET2", "MAINHAND", "OFFHAND",
]);

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

function shortCharKey(name) {
  const raw = String(name || "").trim();
  const short = raw.includes("-") ? raw.split("-")[0] : raw;
  return charKey(short);
}

function awardDedupeKey(itemId, winner) {
  return `${Number(itemId)}|${shortCharKey(winner)}`;
}

const SKIP_BIND = new Set(["boe", "warband", "wue"]);
const WUE_BONUS = new Set([10390, 10878, 11109, 11964, 12053]);

function bonusIdsFromLink(link) {
  const m = String(link || "").match(/item:([^|\]]+)/i);
  if (!m) return [];
  const parts = m[1].split(":");
  const n = Number(parts[12]);
  if (!n || n < 1 || n > 32) return [];
  const ids = [];
  for (let i = 0; i < n; i += 1) {
    const id = Number(parts[13 + i]);
    if (id) ids.push(id);
  }
  return ids;
}

function inferBind(a) {
  const b = String((a && (a.bind || a.bindType)) || "").toLowerCase();
  if (SKIP_BIND.has(b) || b === "bop") return b;
  if (bonusIdsFromLink(a && a.itemLink).some((id) => WUE_BONUS.has(id))) return "wue";
  return "";
}

const BOSS_DIFFS = ["normal", "heroic", "mythic"];
const DEFAULT_WCL = "https://cn.warcraftlogs.com/guild/reports-list/588930";
const EXTRA_BOSS_ALIASES = {
  盘卷祭坛: "altar",
  thecoiledaltar: "altar",
  coiledaltar: "altar",
  乌拉特克: "ulatek",
  ulatek: "ulatek",
  盘魂者内克扎莉: "nekzali",
  内克扎莉: "nekzali",
  奈克扎利: "nekzali",
  nekzalithesoulcoiler: "nekzali",
};
const TIMELINE_HINTS = {
  1288772: { role: "治疗", note: "开减伤，躲井圈，灼烧0层" },
  1287434: { role: "点名", note: "贴边，治疗到位再驱" },
  1284103: { role: "坦克", note: "拉开30码，别人不要挡路" },
  1289919: { role: "输出", note: "远程破盾后转火，坦克拉向亮棺" },
  1289683: { role: "输出", note: "打回响砍线" },
  1292248: { role: "所有人", note: "躲开传递光束" },
  1289855: { role: "近战", note: "分摊烧尸；远程用火苗清散尸" },
  1299673: { role: "所有人", note: "躲移动水圈，治疗铺治疗" },
};

function foldBossName(name) {
  return String(name || "").trim().toLowerCase().replace(/[\s'`·・\-']/g, "");
}

function raidBossCatalog(loot) {
  return ((loot || loadLoot()).bosses || []).filter((b) => b && b.id);
}

function resolveBoss(name, loot) {
  const raw = String(name || "").trim();
  if (!raw || raw === "Boss loot") return null;
  const folded = foldBossName(raw);
  const extra = EXTRA_BOSS_ALIASES[raw] || EXTRA_BOSS_ALIASES[folded];
  const catalog = raidBossCatalog(loot);
  const byId = extra && catalog.find((b) => b.id === extra);
  if (byId) return { id: byId.id, name: byId.nameZh || byId.nameEn || byId.id };
  for (const b of catalog) {
    const aliases = [b.id, b.nameZh, b.nameEn, ...(b.aliases || [])];
    if (aliases.some((x) => String(x) === raw || foldBossName(x) === folded)) {
      return { id: b.id, name: b.nameZh || b.nameEn || b.id };
    }
  }
  return null;
}

function inferBossDiff(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "normal" || s === "n" || s === "14") return "normal";
  if (s === "heroic" || s === "h" || s === "15") return "heroic";
  if (s === "mythic" || s === "m" || s === "16") return "mythic";
  const n = Number(raw);
  if (n === 14) return "normal";
  if (n === 15) return "heroic";
  if (n === 16) return "mythic";
  return "";
}

function sanitizeWclUrl(url) {
  const s = String(url || "").trim().slice(0, 300);
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    const host = u.hostname.toLowerCase();
    if (host !== "warcraftlogs.com" && !host.endsWith(".warcraftlogs.com")) return "";
    return s;
  } catch (_) {
    return "";
  }
}

function emptyBossProgress(cat) {
  return {
    id: cat.id,
    name: cat.nameZh || cat.nameEn || cat.id,
    normal: false,
    heroic: false,
    mythic: false,
    wcl: { normal: "", heroic: "", mythic: "" },
  };
}

function normalizeBossList(list, loot) {
  const catalog = raidBossCatalog(loot);
  const rows = catalog.map((c) => emptyBossProgress(c));
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  for (const raw of list || []) {
    if (!raw) continue;
    const resolved = resolveBoss(raw.id || raw.name, loot);
    if (!resolved || !byId[resolved.id]) continue;
    const row = byId[resolved.id];
    const hasDiff = BOSS_DIFFS.some((d) => raw[d] != null);
    if (hasDiff) {
      for (const d of BOSS_DIFFS) {
        if (raw[d] != null) row[d] = !!raw[d];
      }
    } else if (raw.down) {
      row.normal = true;
    }
    const wcl = raw.wcl && typeof raw.wcl === "object" ? raw.wcl : {};
    for (const d of BOSS_DIFFS) {
      if (wcl[d] != null) row.wcl[d] = sanitizeWclUrl(wcl[d]);
    }
  }
  return rows;
}

function pickBoss(next, prev, loot) {
  const n = String(next || "").trim();
  const p = String((prev && prev.boss) || "").trim();
  const raw = n && n !== "Boss loot" ? n : p;
  const resolved = resolveBoss(raw, loot);
  if (resolved) return resolved.name;
  if (n && n !== "Boss loot") return n.slice(0, 64);
  if (p && p !== "Boss loot") return p.slice(0, 64);
  return "";
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
  if (process.env.LEAD_CODE) store.config.leadCode = String(process.env.LEAD_CODE).trim();
  if (process.env.RAIDER_CODE) store.config.raiderCode = String(process.env.RAIDER_CODE).trim();
  if (process.env.SEASON_START && parseYmd(process.env.SEASON_START)) {
    store.config.seasonStart = process.env.SEASON_START;
  }
  store.config.guildName = store.config.guildName || "ZOO";
  store.config.realm = store.config.realm || "海加尔";
  store.config.region = store.config.region || "CN";
  store.config.wclUrl = store.config.wclUrl || DEFAULT_WCL;
  store.sessions = store.sessions || {};
  store.weeks = store.weeks || {};
  store.guild = store.guild || {};
  store.guild.roster = Array.isArray(store.guild.roster) ? store.guild.roster : [];
  store.guild.rules = typeof store.guild.rules === "string" ? store.guild.rules : "";
  store.guild.tactics = Array.isArray(store.guild.tactics) ? store.guild.tactics : [];
  store.guild.clips = normalizeClips(store.guild.clips);
  store.guild.timelines = normalizeTimelines(store.guild.timelines);
  return store;
}

function clipAbilityKey(raw) {
  const key = String(raw || "").trim().slice(0, CLIP_KEY_MAX);
  if (!key || /[\u0000-\u001f]/.test(key)) return "";
  return key;
}

function journalBossIds() {
  const ids = new Set();
  for (const boss of journalBossList()) ids.add(String(boss.id));
  return ids;
}

function journalBossList() {
  const journal = loadJournal();
  const list = [];
  const seen = new Set();
  const add = (b) => {
    if (!b || !b.id || seen.has(b.id)) return;
    seen.add(String(b.id));
    list.push(b);
  };
  for (const inst of journal.instances || []) {
    for (const b of inst.bosses || []) add(b);
  }
  for (const b of journal.bosses || []) add(b);
  return list;
}

function parseClock(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?:\.(\d+))?$/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec >= 60) return null;
  const frac = m[3] ? Number("0." + m[3]) : 0;
  return { time: s, sec: min * 60 + sec + frac };
}

function normalizePhase(raw) {
  const s = String(raw || "").trim().toLowerCase().split(",")[0];
  if (/^[pi]\d+$/.test(s)) return s;
  return "p1";
}

function looksLikeRole(s) {
  return /^(坦克|治疗|输出|所有人|近战|远程|点名|其余)/.test(String(s || "").trim());
}

function parseTimelineLine(line) {
  const timeM = String(line || "").match(/\{time:([^,}]+)(?:,([^}]+))?\}/);
  if (!timeM) return null;
  const clock = parseClock(timeM[1]);
  if (!clock) return null;
  const spellM = line.match(/\{spell:(\d+)(?:,dur:([\d.]+))?\}/);
  const spellId = spellM ? Number(spellM[1]) : 0;
  const dur = spellM && spellM[2] != null ? Number(spellM[2]) : 0;
  const rest = line.replace(/\{time:[^}]+\}/, "").replace(/\{spell:[^}]+\}/, "");
  const braces = [...rest.matchAll(/\{([^}]+)\}/g)].map((m) => String(m[1] || "").trim()).filter(Boolean);
  let role = "";
  if (braces.length === 1) {
    if (looksLikeRole(braces[0])) role = braces[0];
  } else if (braces.length >= 2) {
    role = braces[braces.length - 1];
  }
  const note = rest.replace(/\{[^}]+\}/g, "").trim().slice(0, TIMELINE_NOTE_MAX);
  role = String(role || "").slice(0, TIMELINE_ROLE_MAX);
  return {
    time: clock.time,
    sec: clock.sec,
    phase: normalizePhase(timeM[2]),
    spellId: Number.isFinite(spellId) ? spellId : 0,
    dur: Number.isFinite(dur) ? dur : 0,
    role,
    note,
    origRole: role,
    origNote: note,
  };
}

function parseTimelineText(text) {
  const src = String(text || "").replace(/^\uFEFF/, "");
  if (!src.trim()) throw new Error("请粘贴时间轴文本");
  let name = "";
  let author = "";
  const events = [];
  let section = "";
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const head = line.match(/^\[(.+)\]$/);
    if (head) {
      section = head[1];
      continue;
    }
    if (section === "方案") {
      const nm = line.match(/^名称\s*=\s*(.+)$/);
      if (nm) name = nm[1].trim().slice(0, TIMELINE_NAME_MAX);
      const au = line.match(/^作者\s*=\s*(.+)$/);
      if (au) author = au[1].trim().slice(0, 32);
      continue;
    }
    if (line.includes("{time:")) {
      const ev = parseTimelineLine(line);
      if (ev) events.push(ev);
    }
  }
  if (!events.length) throw new Error("没有读到 {time:...} 时间轴行");
  if (events.length > TIMELINE_EVENTS_MAX) throw new Error("时间轴行数太多");
  return { name, author, events };
}

function publicTimelineEvent(ev) {
  if (!ev) return null;
  return {
    time: String(ev.time || "").slice(0, 16),
    sec: Number(ev.sec) || 0,
    phase: String(ev.phase || "p1").slice(0, 8),
    spellId: Number(ev.spellId) || 0,
    dur: Number(ev.dur) || 0,
    role: String(ev.role || "").slice(0, TIMELINE_ROLE_MAX),
    note: String(ev.note || "").slice(0, TIMELINE_NOTE_MAX),
    origRole: String(ev.origRole || "").slice(0, TIMELINE_ROLE_MAX),
    origNote: String(ev.origNote || "").slice(0, TIMELINE_NOTE_MAX),
  };
}

function publicTimeline(id, row) {
  if (!row || !journalBossIds().has(id)) return null;
  const events = (row.events || []).map(publicTimelineEvent).filter(Boolean).slice(0, TIMELINE_EVENTS_MAX);
  if (!events.length) return null;
  return {
    bossId: id,
    name: String(row.name || "").slice(0, TIMELINE_NAME_MAX),
    author: String(row.author || "").slice(0, 32),
    events,
    updatedAt: Number(row.updatedAt) || 0,
  };
}

function normalizeTimelines(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, row] of Object.entries(raw)) {
    if (!id || !row) continue;
    const events = (row.events || []).map(publicTimelineEvent).filter(Boolean).slice(0, TIMELINE_EVENTS_MAX);
    if (!events.length) continue;
    out[id] = {
      bossId: String(id).slice(0, 64),
      name: String(row.name || "").slice(0, TIMELINE_NAME_MAX),
      author: String(row.author || "").slice(0, 32),
      events,
      raw: String(row.raw || "").slice(0, TIMELINE_RAW_MAX),
      updatedAt: Number(row.updatedAt) || 0,
    };
  }
  return out;
}

function publicTimelines(store) {
  const out = {};
  for (const [id, row] of Object.entries(store.guild.timelines || {})) {
    const pub = publicTimeline(id, row);
    if (pub) out[id] = pub;
  }
  return out;
}

function resolveTimelineBoss(name, fallbackId, loot) {
  const fromLoot = resolveBoss(name, loot);
  if (fromLoot) return fromLoot.id;
  const raw = String(name || "").trim();
  const folded = foldBossName(raw);
  if (raw) {
    for (const b of journalBossList()) {
      const aliases = [b.id, b.nameZh, b.nameEn, ...(b.aliases || [])];
      if (aliases.some((x) => String(x) === raw || foldBossName(x) === folded)) return b.id;
    }
  }
  const fb = String(fallbackId || "").trim();
  if (fb && journalBossIds().has(fb)) return fb;
  return "";
}

function applyTimelineHints(events) {
  return (events || []).map((ev, i, all) => {
    const hint = TIMELINE_HINTS[ev.spellId];
    if (!hint) return ev;
    let role = hint.role;
    let note = hint.note;
    if (ev.spellId === 1287434) {
      const nearAdd = all.some((o, j) => (
        j !== i && o.phase === ev.phase && o.spellId === 1289919 && Math.abs((o.sec || 0) - (ev.sec || 0)) <= 6
      ));
      if (nearAdd) {
        role = "点名";
        note = "贴边；其余转火";
      }
    }
    return { ...ev, role, note };
  });
}

function parseLocalUpload(raw) {
  const m = String(raw || "").trim().match(/^\/media\/([a-f0-9]{32})\.(jpg|png|webp|gif)$/i);
  if (!m) return null;
  const file = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
  return { kind: "upload", url: `/media/${file}`, file };
}

function sniffImage(buf) {
  if (!buf || buf.length < 12) return "";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return "";
}

function decodeDataImage(raw) {
  const text = String(raw || "").trim();
  const m = text.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) throw new Error("请上传 jpg/png/webp/gif 截图");
  const buf = Buffer.from(m[2].replace(/\s/g, ""), "base64");
  if (!buf.length) throw new Error("图片是空的");
  if (buf.length > CLIP_IMAGE_MAX) throw new Error("截图请压到 4MB 以内");
  const ext = sniffImage(buf);
  if (!ext) throw new Error("文件不是可用的图片");
  return { buf, ext };
}

function writeUpload(buf, ext) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return { kind: "upload", url: `/media/${name}`, file: name };
}

function removeUploadFile(row) {
  const local = parseLocalUpload(row && row.url);
  if (!local) return;
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, local.file));
  } catch (_) {}
}

function serveUpload(pathname, res) {
  const name = decodeURIComponent(pathname.replace(/^\/media\//, "")).toLowerCase();
  if (name.includes("/") || name.includes("\\") || !UPLOAD_NAME.test(name)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const root = path.resolve(UPLOAD_DIR);
  const file = path.resolve(UPLOAD_DIR, name);
  if (file !== path.join(root, name)) {
    res.writeHead(404);
    res.end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": IMAGE_TYPES[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    res.end(data);
  });
}

function parseMediaUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { kind: "empty", url: "", embed: "" };
  if (trimmed.length > CLIP_URL_MAX) throw new Error("链接太长");
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_) {
    throw new Error("链接无效");
  }
  if (parsed.protocol !== "https:") throw new Error("只用 https 链接");
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0];
    if (YT_ID.test(id)) {
      return {
        kind: "youtube",
        url: `https://youtu.be/${id}`,
        embed: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    let id = parsed.searchParams.get("v") || "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (!id && (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") && parts[1]) {
      id = parts[1];
    }
    if (YT_ID.test(id)) {
      return {
        kind: "youtube",
        url: `https://www.youtube.com/watch?v=${id}`,
        embed: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
  }

  if (host === "b23.tv") {
    throw new Error("请用完整 B 站链接（bilibili.com/video/BVxxxx），不要用短链");
  }
  if (host === "bilibili.com" || host === "m.bilibili.com" || host === "player.bilibili.com") {
    let bvid = parsed.searchParams.get("bvid") || "";
    const fromPath = parsed.pathname.match(/BV[1-9A-HJ-NP-Za-km-z]{10}/);
    if (!bvid && fromPath) bvid = fromPath[0];
    if (BV_ID.test(bvid)) {
      let page = Number(parsed.searchParams.get("p") || parsed.searchParams.get("page") || 1);
      if (!Number.isFinite(page) || page < 1 || page > 200) page = 1;
      return {
        kind: "bilibili",
        url: `https://www.bilibili.com/video/${bvid}${page > 1 ? `?p=${page}` : ""}`,
        embed: `https://player.bilibili.com/player.html?isOutside=true&bvid=${bvid}&page=${page}&high_quality=1&danmaku=0&autoplay=0`,
      };
    }
  }

  if (/\.(jpe?g|png|webp|gif)$/i.test(parsed.pathname)) {
    return { kind: "image", url: trimmed, embed: "" };
  }

  throw new Error("只支持 B 站、YouTube，或 jpg/png/webp/gif 图片直链");
}

function clipItemId(raw) {
  const id = String(raw || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  return id.length >= 6 ? id : "";
}

function newClipItemId() {
  return crypto.randomBytes(8).toString("hex");
}

function normalizeClipItem(item) {
  if (!item || typeof item !== "object") return null;
  const caption = String(item.caption || "").trim().slice(0, CLIP_CAPTION_MAX);
  const at = Number(item.at) || 0;
  const id = clipItemId(item.id) || newClipItemId();
  const local = parseLocalUpload(item.url);
  if (local) return { id, url: local.url, kind: "upload", embed: "", caption, at };
  try {
    const media = parseMediaUrl(item.url);
    if (media.kind === "empty") return null;
    return {
      id,
      url: media.url,
      kind: media.kind,
      embed: media.embed || "",
      caption,
      at,
    };
  } catch (_) {
    return null;
  }
}

function clipItemsOf(row) {
  if (!row) return [];
  if (Array.isArray(row)) return row;
  if (Array.isArray(row.items)) return row.items;
  if (row.url || row.kind) return [row];
  return [];
}

function normalizeClipRow(row) {
  const items = [];
  const seen = new Set();
  for (const raw of clipItemsOf(row)) {
    const item = normalizeClipItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= CLIP_PER_ABILITY) break;
  }
  return items.length ? { items } : null;
}

function normalizeClips(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [bossId, map] of Object.entries(raw)) {
    const id = String(bossId || "").trim().slice(0, 40);
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/i.test(id)) continue;
    if (!map || typeof map !== "object" || Array.isArray(map)) continue;
    const rows = {};
    for (const [key, row] of Object.entries(map)) {
      const abilityKey = clipAbilityKey(key);
      if (!abilityKey) continue;
      const normalized = normalizeClipRow(row);
      if (normalized) rows[abilityKey] = normalized;
    }
    if (Object.keys(rows).length) out[id] = rows;
  }
  return out;
}

function clipCount(clips) {
  let n = 0;
  for (const map of Object.values(clips || {})) {
    for (const row of Object.values(map || {})) n += clipItemsOf(row).length;
  }
  return n;
}

function publicClipItem(item) {
  if (!item || !item.kind || !item.url) return null;
  return {
    id: item.id,
    kind: item.kind,
    url: item.url,
    embed: item.embed || "",
    caption: item.caption || "",
  };
}

function publicClips(store) {
  const clips = store.guild.clips || {};
  const out = {};
  for (const [bossId, map] of Object.entries(clips)) {
    const rows = {};
    for (const [key, row] of Object.entries(map || {})) {
      const items = clipItemsOf(row).map(publicClipItem).filter(Boolean);
      if (items.length) rows[key] = { items };
    }
    if (Object.keys(rows).length) out[bossId] = rows;
  }
  return out;
}

function removeClipItems(items) {
  for (const item of items || []) removeUploadFile(item);
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
    wclUrl: store.config.wclUrl || DEFAULT_WCL,
    roster: (store.guild.roster || []).slice(),
    rules: store.guild.rules || "",
    tactics: (store.guild.tactics || []).map((t) => ({
      name: String(t.name || "").slice(0, 64),
      note: String(t.note || "").slice(0, 2000),
    })),
    timelines: publicTimelines(store),
    clips: publicClips(store),
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
    instances: [],
  };
}

function loadJournal() {
  try {
    const raw = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
    raw.instance = raw.instance || emptyJournal().instance;
    raw.bosses = Array.isArray(raw.bosses) ? raw.bosses : [];
    raw.instances = Array.isArray(raw.instances) ? raw.instances : [];
    if (!raw.instances.length && raw.bosses.length) {
      raw.instances = [{ ...raw.instance, kind: "raid", bosses: raw.bosses }];
    }
    const abyss = raw.instances.find((row) => row.id === "venomous-abyss") || raw.instances[0];
    if (abyss) {
      raw.instance = {
        id: abyss.id,
        nameZh: abyss.nameZh,
        nameEn: abyss.nameEn,
        patch: abyss.patch || raw.instance.patch || "12.1",
        lore: abyss.lore || raw.instance.lore || "",
        entrance: abyss.entrance || raw.instance.entrance || "",
      };
      if (!raw.bosses.length) raw.bosses = abyss.bosses || [];
    }
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
  const resolved = resolveBoss(name, loot);
  return resolved ? resolved.id : "";
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
  w.bosses = normalizeBossList(w.bosses || []);
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
  const seen = new Set();
  const slots = [];
  for (const s of Array.isArray(data.slots) ? data.slots : []) {
    if (!s || !s.slotKey || !Number(s.itemId)) continue;
    const slotKey = String(s.slotKey).slice(0, 16);
    if (!SLOT_KEYS.has(slotKey) || seen.has(slotKey)) continue;
    seen.add(slotKey);
    slots.push({
      slotKey,
      itemId: Number(s.itemId),
      priority: s.priority || "bis",
    });
  }
  const filled = new Set(slots.map((s) => s.slotKey));
  const prev = bucket.intents[key];
  const weeklySrc = Array.isArray(data.weekly)
    ? data.weekly
    : ((prev && prev.weekly) || []);
  const weeklySeen = new Set();
  const weekly = [];
  for (const raw of weeklySrc) {
    const slotKey = String(raw || "").slice(0, 16);
    if (!filled.has(slotKey) || weeklySeen.has(slotKey)) continue;
    weeklySeen.add(slotKey);
    weekly.push(slotKey);
  }
  if (weekly.length > WEEKLY_INTENT_LIMIT) {
    throw new Error(`本周意向最多 ${WEEKLY_INTENT_LIMIT} 件`);
  }
  bucket.intents[key] = {
    char: String(data.char).slice(0, 64),
    spec: data.spec || null,
    class: data.class || null,
    slots,
    weekly,
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

function applyLoot(bucket, data, fallbackDiff) {
  const loot = loadLoot();
  let written = 0;
  let merged = 0;
  let skippedBind = 0;
  const byKey = new Map();
  bucket.bosses = normalizeBossList(bucket.bosses, loot);
  const byBoss = Object.fromEntries(bucket.bosses.map((b) => [b.id, b]));
  for (const [uid, a] of Object.entries(bucket.awards || {})) {
    if (!Number(a.itemId) || !a.winner) continue;
    const key = awardDedupeKey(a.itemId, a.winner);
    if (byKey.has(key) && byKey.get(key) !== uid) {
      delete bucket.awards[uid];
    } else {
      byKey.set(key, uid);
    }
  }
  for (const a of data.awards || []) {
    if (!a || !Number(a.itemId)) continue;
    const bind = inferBind(a);
    if (SKIP_BIND.has(bind)) {
      skippedBind += 1;
      continue;
    }
    const itemId = Number(a.itemId);
    const key = awardDedupeKey(itemId, a.winner);
    const existingUid = byKey.get(key);
    const uid = String(existingUid || a.uid || "").slice(0, 64);
    if (!uid) continue;
    const prev = bucket.awards[uid];
    const wasMerge = !!existingUid;
    const nextLink = a.itemLink ? String(a.itemLink).slice(0, 256) : "";
    const prevLink = (prev && prev.itemLink) || "";
    const bossName = pickBoss(a.boss, prev, loot);
    bucket.awards[uid] = {
      uid,
      itemId,
      itemLink: nextLink.length >= prevLink.length ? nextLink : prevLink,
      winner: a.winner ? String(a.winner).slice(0, 48) : ((prev && prev.winner) || ""),
      boss: bossName,
      awardedAt: Number(a.awardedAt) || (prev && prev.awardedAt) || 0,
      traded: a.traded != null ? !!a.traded : !!(prev && prev.traded),
      mark: awardMark(a.mark, prev && prev.mark),
    };
    if (bind === "bop" || (a.bind && !SKIP_BIND.has(bind))) {
      bucket.awards[uid].bind = String(a.bind || bind).slice(0, 16);
    }
    const resolved = resolveBoss(bossName, loot);
    const diff = inferBossDiff(a.diff || a.difficulty || fallbackDiff);
    if (resolved && byBoss[resolved.id] && diff) {
      byBoss[resolved.id][diff] = true;
    }
    byKey.set(key, uid);
    learnItem(loot, itemId, bucket.awards[uid].itemLink, bucket.awards[uid].boss);
    written += 1;
    if (wasMerge) merged += 1;
  }
  saveLoot(loot);
  return { written, merged, skippedBind, imported: written };
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
  const loot = loadLoot();
  const awards = {};
  for (const [uid, a] of Object.entries(bucket.awards)) {
    awards[uid] = { ...a, mark: awardMark(a.mark), boss: pickBoss(a.boss, null, loot) };
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
  const loot = loadLoot();
  for (const w of weekIds) {
    const b = readWeek(store, w);
    for (const a of Object.values(b.awards)) {
      if (!a || !a.uid || seen.has(a.uid)) continue;
      seen.add(a.uid);
      awards.push({ ...a, mark: awardMark(a.mark), week: w, boss: pickBoss(a.boss, null, loot) });
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

function readBody(req, maxBytes = BODY_MAX) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    const fail = (err) => {
      if (rejected) return;
      rejected = true;
      reject(err);
    };
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) {
        fail(new Error("内容太大"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (rejected) return;
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        fail(err);
      }
    });
    req.on("error", fail);
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
  if (urlPath === "/" || /^\/[nr]\/[^/]+\/?$/.test(urlPath)) urlPath = "/index.html";
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
  if (req.method === "GET" && url.pathname.startsWith("/media/")) {
    serveUpload(url.pathname, res);
    return;
  }
  if (!url.pathname.startsWith("/api/")) {
    serveStatic(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    send(res, 200, { ok: true, service: "ic-raid-archive", week: raidWeekStart() });
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

    if (req.method === "GET" && url.pathname === "/api/night") {
      const found = findNight(store, String(url.searchParams.get("id") || "").slice(0, 32));
      if (!found) {
        send(res, 404, { error: "找不到这场开团" });
        return;
      }
      const pub = publicNights(found.bucket).find((n) => n.id === found.night.id);
      send(res, 200, { week: found.week, night: pub || found.night });
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
      const lootResult = applyLoot(bucket, parsed.data, body.diff);
      saveStore(store);
      send(res, 200, { ...snapshot(store, week, sess), ...lootResult });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/awards-clear") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req);
      const week = body.week || raidWeekStart();
      const bucket = weekBucket(store, week);
      const cleared = Object.keys(bucket.awards || {}).length;
      bucket.awards = {};
      saveStore(store);
      send(res, 200, { ...snapshot(store, week, sess), cleared });
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
        weekly: body.weekly,
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
      const incoming = Array.isArray(body.bosses) ? body.bosses : [];
      bucket.bosses = normalizeBossList(incoming.length ? incoming : bucket.bosses);
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
      const role = ROLES.has(String(body.role || "")) ? String(body.role) : "";
      const classId = String(body.classId || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 20);
      const specId = String(body.specId || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 20);
      const row = {
        char,
        status,
        note: String(body.note || "").trim().slice(0, 120),
        role,
        classId,
        specId,
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

    if (req.method === "POST" && url.pathname === "/api/timeline") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req);
      const action = String(body.action || "import").trim();
      store.guild.timelines = store.guild.timelines || {};
      const week = body.week || raidWeekStart();

      if (action === "import") {
        const parsed = parseTimelineText(body.text);
        const bossId = resolveTimelineBoss(parsed.name, body.bossId);
        if (!bossId) {
          send(res, 400, { error: "对不上 Boss，请先选中对应的王再导入" });
          return;
        }
        store.guild.timelines[bossId] = {
          name: parsed.name || bossId,
          author: parsed.author,
          raw: String(body.text || "").slice(0, TIMELINE_RAW_MAX),
          events: parsed.events,
          updatedAt: Date.now(),
        };
        saveStore(store);
        send(res, 200, { ...snapshot(store, week, sess), imported: parsed.events.length, timelineBoss: bossId });
        return;
      }

      const bossId = String(body.bossId || "").trim();
      if (!journalBossIds().has(bossId)) {
        send(res, 400, { error: "找不到这只王" });
        return;
      }

      if (action === "clear") {
        delete store.guild.timelines[bossId];
        saveStore(store);
        send(res, 200, snapshot(store, week, sess));
        return;
      }

      const cur = store.guild.timelines[bossId];
      if (!cur || !Array.isArray(cur.events) || !cur.events.length) {
        send(res, 400, { error: "这只王还没有时间轴" });
        return;
      }

      if (action === "hint") {
        cur.events = applyTimelineHints(cur.events.map(publicTimelineEvent));
        cur.updatedAt = Date.now();
        saveStore(store);
        send(res, 200, snapshot(store, week, sess));
        return;
      }

      if (action === "revert") {
        cur.events = cur.events.map((ev) => {
          const row = publicTimelineEvent(ev);
          return { ...row, role: row.origRole || "", note: row.origNote || "" };
        });
        cur.updatedAt = Date.now();
        saveStore(store);
        send(res, 200, snapshot(store, week, sess));
        return;
      }

      if (action === "save") {
        const incoming = Array.isArray(body.events) ? body.events : [];
        if (incoming.length !== cur.events.length) {
          send(res, 400, { error: "行数对不上，请刷新后再保存" });
          return;
        }
        cur.events = cur.events.map((ev, i) => {
          const locked = publicTimelineEvent(ev);
          const next = incoming[i] || {};
          return {
            ...locked,
            role: String(next.role || "").trim().slice(0, TIMELINE_ROLE_MAX),
            note: String(next.note || "").trim().slice(0, TIMELINE_NOTE_MAX),
          };
        });
        cur.updatedAt = Date.now();
        saveStore(store);
        send(res, 200, snapshot(store, week, sess));
        return;
      }

      send(res, 400, { error: "未知操作" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ability-clip") {
      if (!requireLead(sess, res)) return;
      const body = await readBody(req, CLIP_BODY_MAX);
      const bossId = String(body.bossId || "").trim();
      const abilityKey = clipAbilityKey(body.abilityKey);
      if (!journalBossIds().has(bossId)) {
        send(res, 400, { error: "找不到这只王" });
        return;
      }
      if (!abilityKey) {
        send(res, 400, { error: "请指定技能" });
        return;
      }
      store.guild.clips = store.guild.clips || {};
      const map = store.guild.clips[bossId] || {};
      const existing = normalizeClipRow(map[abilityKey]) || { items: [] };
      const items = existing.items.slice();
      const caption = String(body.caption || "").trim().slice(0, CLIP_CAPTION_MAX);
      const keepMap = () => {
        if (Object.keys(map).length) store.guild.clips[bossId] = map;
        else delete store.guild.clips[bossId];
      };
      const writeItems = (next) => {
        if (next.length) map[abilityKey] = { items: next };
        else delete map[abilityKey];
        keepMap();
        saveStore(store);
        send(res, 200, snapshot(store, body.week || raidWeekStart(), sess));
      };

      if (body.clear) {
        removeClipItems(items);
        writeItems([]);
        return;
      }

      const removeId = clipItemId(body.removeId);
      if (removeId) {
        const idx = items.findIndex((item) => item.id === removeId);
        if (idx < 0) {
          send(res, 400, { error: "找不到这张图" });
          return;
        }
        removeUploadFile(items[idx]);
        items.splice(idx, 1);
        writeItems(items);
        return;
      }

      const appendItem = (item) => {
        if (items.length >= CLIP_PER_ABILITY) {
          send(res, 400, { error: `这个技能最多 ${CLIP_PER_ABILITY} 张` });
          return false;
        }
        if (clipCount(store.guild.clips) >= CLIP_TOTAL_MAX) {
          send(res, 400, { error: "本团资料条数已满" });
          return false;
        }
        items.push(item);
        writeItems(items);
        return true;
      };

      if (body.image) {
        let uploaded;
        try {
          const decoded = decodeDataImage(body.image);
          uploaded = writeUpload(decoded.buf, decoded.ext);
        } catch (err) {
          send(res, 400, { error: err.message || "上传失败" });
          return;
        }
        const ok = appendItem({
          id: newClipItemId(),
          url: uploaded.url,
          kind: "upload",
          embed: "",
          caption,
          at: Date.now(),
        });
        if (!ok) removeUploadFile(uploaded);
        return;
      }

      const link = String(body.url || "").trim();
      if (link) {
        let media;
        try {
          media = parseMediaUrl(link);
        } catch (err) {
          send(res, 400, { error: err.message || "链接无效" });
          return;
        }
        if (media.kind === "empty") {
          send(res, 400, { error: "请填写链接" });
          return;
        }
        appendItem({
          id: newClipItemId(),
          url: media.url,
          kind: media.kind,
          embed: media.embed || "",
          caption,
          at: Date.now(),
        });
        return;
      }

      send(res, 400, { error: "请上传截图或填写视频链接" });
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
  console.log("默认邀请码  团长 ic-lead  队员 ic-raid  （改 data/store.json 里的 config，或环境变量 LEAD_CODE / RAIDER_CODE）");
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
