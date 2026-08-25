--[[
  JicksLoot 1.5.9 — Retail 12.x
  Popup: exactement ce que le boss a drop (link + ilvl).
  Auto: donjon / raid seulement, gear seulement (pas junk / pots / recettes).
  Collection BiS: clic minimap / /jl slots
  Archive: /jl export → ICRC1:loot:{...} (ZOO 团本档案)
]]

local ADDON = ...
local JL = {}
JicksLoot = JL

local db
local rows = {}
local session = { title = "Boss loot", items = {}, shown = false, live = false, untilT = 0, encounterID = nil, diff = nil }
local importFrame
local Refresh -- forward decl (BiS import UI)
local NewSession -- forward decl (EnsureBossSession)
local RefreshSlotBoard
local OpenSlotBoard
local GetViewedSpecId
local ListImportedSpecIds
local ListBoardSpecIds

local MIN_QUALITY = 3 -- rare (bleu) et mieux
local MAX_ROWS = 16
local ROW_H = 28
-- Largeur: plus étroite par défaut, s'élargit selon le contenu
local MIN_WIDTH = 300
local MAX_WIDTH = 540
local PAD_X = 10
local ICON_W = 24
local ICON_GAP = 8
local COL_GAP = 12
local CHAT_W = 18
local CHAT_GAP = 4
local WHO_MIN = 56
local WHO_MAX = 160

-- KeystoneLoot tiers: 1 Nice, 2 Must, 3 BiS, 4 Transmog
local TIER_BIS = 3

local DEFAULTS = {
  point = "CENTER",
  x = 0,
  y = 140,
  -- Legacy flat map [itemId] = tier (migre vers bisBySpec)
  bisItems = {},
  -- Multi-spec: [specId] = { [itemId] = tier }
  bisBySpec = {},
  -- "loot" | "active" | "all" — default all: voir BiS WW meme en Brewmaster
  bisMode = "all",
  -- Items deja vus en loot (id -> true)
  lootedItems = {},
  -- System-assigned winners for /jl export (ICRC1:loot)
  lootLog = {},
  minimapAngle = 210,
  minimapHide = false,
  hiddenSpecs = {},
}

-- Couleurs de fond par specialization ID (r,g,b) — distinctes par role/spec
local SPEC_BG = {
  -- Death Knight
  [250] = { 0.75, 0.15, 0.15 }, -- Blood
  [251] = { 0.45, 0.70, 1.00 }, -- Frost
  [252] = { 0.55, 0.90, 0.35 }, -- Unholy
  -- Demon Hunter
  [577] = { 0.85, 0.25, 0.95 }, -- Havoc
  [581] = { 0.35, 0.55, 0.95 }, -- Vengeance
  -- Druid
  [102] = { 0.95, 0.55, 0.10 }, -- Balance
  [103] = { 1.00, 0.45, 0.15 }, -- Feral
  [104] = { 0.35, 0.55, 0.90 }, -- Guardian
  [105] = { 0.35, 0.90, 0.50 }, -- Restoration
  -- Evoker
  [1467] = { 0.90, 0.40, 0.20 }, -- Devastation
  [1468] = { 0.40, 0.85, 0.70 }, -- Preservation
  [1473] = { 0.70, 0.35, 0.90 }, -- Augmentation
  -- Hunter
  [253] = { 0.55, 0.85, 0.30 }, -- BM
  [254] = { 0.40, 0.75, 0.95 }, -- MM
  [255] = { 0.90, 0.55, 0.20 }, -- Survival
  -- Mage
  [62] = { 0.50, 0.70, 1.00 }, -- Arcane
  [63] = { 1.00, 0.45, 0.15 }, -- Fire
  [64] = { 0.45, 0.85, 0.95 }, -- Frost
  -- Monk (couleurs custom user)
  [268] = { 0.95, 0.50, 0.12 }, -- Brewmaster → orange
  [269] = { 0.72, 0.35, 0.95 }, -- Windwalker → violet
  [270] = { 0.55, 0.80, 0.98 }, -- Mistweaver → bleu pale
  -- Paladin
  [65] = { 0.95, 0.85, 0.30 }, -- Holy
  [66] = { 0.40, 0.55, 0.95 }, -- Protection
  [70] = { 0.95, 0.35, 0.25 }, -- Retribution
  -- Priest
  [256] = { 0.85, 0.85, 0.95 }, -- Discipline
  [257] = { 0.95, 0.90, 0.40 }, -- Holy
  [258] = { 0.55, 0.25, 0.85 }, -- Shadow
  -- Rogue
  [259] = { 0.90, 0.30, 0.30 }, -- Assassination
  [260] = { 0.95, 0.75, 0.20 }, -- Outlaw
  [261] = { 0.65, 0.35, 0.90 }, -- Subtlety
  -- Shaman
  [262] = { 0.40, 0.55, 0.95 }, -- Elemental
  [263] = { 0.95, 0.50, 0.20 }, -- Enhancement
  [264] = { 0.35, 0.90, 0.70 }, -- Restoration
  -- Warlock
  [265] = { 0.70, 0.35, 0.90 }, -- Affliction
  [266] = { 0.90, 0.30, 0.35 }, -- Demonology
  [267] = { 0.95, 0.45, 0.15 }, -- Destruction
  -- Warrior
  [71] = { 0.95, 0.55, 0.20 }, -- Arms
  [72] = { 0.90, 0.25, 0.20 }, -- Fury
  [73] = { 0.40, 0.55, 0.90 }, -- Protection
  -- generic / legacy
  [0] = { 0.95, 0.75, 0.15 },
}

local function CopyDefaults(src)
  local t = {}
  for k, v in pairs(src) do
    t[k] = v
  end
  return t
end

local function MergeDefaults(dest, src)
  for k, v in pairs(src) do
    if dest[k] == nil then
      dest[k] = v
    end
  end
end

-- 12.x: issecretvalue is the real API. IsSecret is not always present.
-- Never compare a value (`==`, `~=`, `<`) until it is known to be non-secret.
local function IsSecretVal(v)
  local fn = issecretvalue or IsSecret
  if type(fn) ~= "function" then
    return false
  end
  local ok, s = pcall(fn, v)
  return ok and s == true
end

local function PlainString(v)
  if type(v) ~= "string" then
    return nil
  end
  if IsSecretVal(v) then
    return nil
  end
  local ok, empty = pcall(function()
    return v == ""
  end)
  if not ok or empty then
    return nil
  end
  return v
end

local function PlainNumber(v)
  if type(v) ~= "number" then
    return nil
  end
  if IsSecretVal(v) then
    return nil
  end
  return v
end

local function Print(msg)
  print("|cffc9a227JicksLoots|r: " .. tostring(msg))
end

-- ─── BiS multi-spec (KeystoneLoot import strings) ───────────

local function EnsureBisTables()
  if not db then
    return {}, {}
  end
  if type(db.bisBySpec) ~= "table" then
    db.bisBySpec = {}
  end
  if type(db.bisItems) ~= "table" then
    db.bisItems = {}
  end
  if type(db.bisTrack) ~= "table" then
    db.bisTrack = {}
  end
  if not db.bisMode or db.bisMode == "" then
    db.bisMode = "all"
  end
  -- Migration: flat bisItems → spec 0 (all-specs bucket)
  if next(db.bisItems) and not next(db.bisBySpec) then
    db.bisBySpec[0] = {}
    for id, tier in pairs(db.bisItems) do
      db.bisBySpec[0][id] = tier
    end
  end
  -- Existing KeystoneLoot lists were M+. Copy into mythic track once.
  if not db.bisTrackMigrated then
    for specId, map in pairs(db.bisBySpec) do
      specId = tonumber(specId) or specId
      if type(map) == "table" then
        db.bisTrack[specId] = db.bisTrack[specId] or { raid = {}, mythic = {} }
        if not db.bisTrack[specId].raid then
          db.bisTrack[specId].raid = {}
        end
        if not db.bisTrack[specId].mythic then
          db.bisTrack[specId].mythic = {}
        end
        if not next(db.bisTrack[specId].mythic) and not next(db.bisTrack[specId].raid) then
          for id, tier in pairs(map) do
            db.bisTrack[specId].mythic[id] = tier
          end
        end
      end
    end
    db.bisTrackMigrated = true
  end
  return db.bisBySpec, db.bisItems
end

local function NormalizeTrack(track)
  if track == "raid" then
    return "raid"
  end
  if track == "overall" then
    return "overall"
  end
  return "mythic"
end

local function TrackLabel(track)
  if track == "raid" then
    return "Raid"
  end
  if track == "overall" then
    return "Overall"
  end
  return "M+"
end

local function EnsureTrackTables(specId)
  EnsureBisTables()
  specId = tonumber(specId) or specId
  if not specId then
    return nil
  end
  db.bisTrack[specId] = db.bisTrack[specId] or { raid = {}, mythic = {}, overall = {} }
  if type(db.bisTrack[specId].raid) ~= "table" then
    db.bisTrack[specId].raid = {}
  end
  if type(db.bisTrack[specId].mythic) ~= "table" then
    db.bisTrack[specId].mythic = {}
  end
  if type(db.bisTrack[specId].overall) ~= "table" then
    db.bisTrack[specId].overall = {}
  end
  return db.bisTrack[specId]
end

local function GetTrackMap(specId, track)
  specId = tonumber(specId) or specId
  track = NormalizeTrack(track)
  local t = EnsureTrackTables(specId)
  if t and type(t[track]) == "table" then
    return t[track]
  end
  return {}
end

-- Compat alias
local function EnsureBisTable()
  EnsureBisTables()
  return db.bisItems
end

local function GetSpecName(specId)
  specId = tonumber(specId)
  if not specId or specId == 0 then
    return "All"
  end
  if GetSpecializationInfoByID then
    local ok, _, name = pcall(GetSpecializationInfoByID, specId)
    if ok and type(name) == "string" and name ~= "" then
      return name
    end
  end
  return "Spec " .. tostring(specId)
end

local function GetSpecIcon(specId)
  specId = tonumber(specId)
  if specId and GetSpecializationInfoByID then
    local ok, _, _, _, icon = pcall(GetSpecializationInfoByID, specId)
    if ok and type(icon) == "number" then
      return icon
    end
  end
  return 134400
end

local function GetSpecShortName(specId)
  local n = GetSpecName(specId)
  -- Premiers mots utiles: "Brewmaster" / "Windwalker" / "Beast Mastery" -> BM
  if n == "Beast Mastery" then
    return "BM"
  end
  if n == "Marksmanship" then
    return "MM"
  end
  return n:match("^(%S+)") or n
end

-- Couleur de fond pour une spé (r,g,b,a)
local function GetSpecBgColor(specId)
  specId = tonumber(specId) or 0
  local c = SPEC_BG[specId]
  if c then
    return c[1], c[2], c[3], 0.32
  end
  -- Fallback deterministe si spec inconnue
  local h = (specId * 47) % 360
  local function hsl(h, s, l)
    h = h / 360
    local function f(p, q, t)
      if t < 0 then t = t + 1 end
      if t > 1 then t = t - 1 end
      if t < 1 / 6 then return p + (q - p) * 6 * t end
      if t < 1 / 2 then return q end
      if t < 2 / 3 then return p + (q - p) * (2 / 3 - t) * 6 end
      return p
    end
    local q = l < 0.5 and l * (1 + s) or l + s - l * s
    local p = 2 * l - q
    return f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)
  end
  local r, g, b = hsl(h, 0.55, 0.45)
  return r, g, b, 0.32
end

local function GetActiveTalentSpecId()
  if not GetSpecialization or not GetSpecializationInfo then
    return nil
  end
  local ok, idx = pcall(GetSpecialization)
  if not ok or not idx then
    return nil
  end
  local ok2, specId = pcall(function()
    return select(1, GetSpecializationInfo(idx))
  end)
  if ok2 and type(specId) == "number" then
    return specId
  end
  return nil
end

local function GetLootSpecId()
  -- 0 = current talent spec
  if GetLootSpecialization then
    local ok, lootSpec = pcall(GetLootSpecialization)
    if ok and type(lootSpec) == "number" and lootSpec > 0 then
      return lootSpec
    end
  end
  return GetActiveTalentSpecId()
end

-- Specs a utiliser pour le highlight selon bisMode
local function GetHighlightSpecIds()
  EnsureBisTables()
  local mode = db.bisMode or "loot"
  local ids = {}

  if mode == "all" then
    for specId in pairs(db.bisBySpec) do
      table.insert(ids, specId)
    end
    if #ids == 0 and next(db.bisItems or {}) then
      table.insert(ids, 0)
    end
    return ids
  end

  local one
  if mode == "active" then
    one = GetActiveTalentSpecId()
  else
    one = GetLootSpecId() -- "loot"
  end
  if one then
    table.insert(ids, one)
  end
  -- Toujours inclure le bucket "0" (listes sans spec / legacy)
  table.insert(ids, 0)
  return ids
end

-- Toutes les specs pour lesquelles cet item est wishlist (apres GetHighlightSpecIds)
local function GetBisMatches(itemID)
  itemID = PlainNumber(itemID) or tonumber(itemID)
  local matches = {}
  if not itemID or not db then
    return matches
  end
  EnsureBisTables()
  local specs = GetHighlightSpecIds() or {}
  for _, specId in ipairs(specs) do
    local map = db.bisBySpec[specId]
    if type(map) == "table" then
      local tier = map[itemID]
      if type(tier) == "number" and tier >= 1 then
        table.insert(matches, { specId = specId, tier = tier })
      end
    end
  end
  if #matches == 0 and type(db.bisItems) == "table" then
    local tier = db.bisItems[itemID]
    if type(tier) == "number" and tier >= 1 then
      table.insert(matches, { specId = 0, tier = tier })
    end
  end
  table.sort(matches, function(a, b)
    if a.tier ~= b.tier then
      return a.tier > b.tier
    end
    return (a.specId or 0) < (b.specId or 0)
  end)
  return matches
end

local function IsBiSItem(itemID)
  itemID = PlainNumber(itemID) or tonumber(itemID)
  if not itemID or not db then
    return false, nil, nil
  end
  EnsureBisTables()
  local bestTier, bestSpec = nil, nil
  for _, specId in ipairs(GetHighlightSpecIds()) do
    local map = db.bisBySpec[specId]
    if type(map) == "table" then
      local tier = map[itemID]
      if type(tier) == "number" and tier >= 1 then
        if not bestTier or tier > bestTier then
          bestTier = tier
          bestSpec = specId
        end
      end
    end
  end
  -- Legacy flat
  if not bestTier and type(db.bisItems) == "table" then
    local tier = db.bisItems[itemID]
    if type(tier) == "number" and tier >= 1 then
      bestTier = tier
      bestSpec = 0
    end
  end
  if bestTier then
    return true, bestTier, bestSpec
  end
  return false, nil, nil
end

local function CountBis(specIdFilter)
  EnsureBisTables()
  local seen = {}
  local n = 0
  local function addMap(map)
    if type(map) ~= "table" then
      return
    end
    for id in pairs(map) do
      if type(id) == "number" and not seen[id] then
        seen[id] = true
        n = n + 1
      end
    end
  end
  if specIdFilter ~= nil then
    addMap(db.bisBySpec[specIdFilter])
  else
    for _, map in pairs(db.bisBySpec) do
      addMap(map)
    end
    if n == 0 then
      addMap(db.bisItems)
    end
  end
  return n
end

local function CountSpecsWithBis()
  EnsureBisTables()
  local n = 0
  for specId, map in pairs(db.bisBySpec) do
    if type(map) == "table" and next(map) and specId ~= 0 then
      n = n + 1
    end
  end
  return n
end

local function RebuildFlatBisCache()
  -- Cache plat pour /jl test et compat
  EnsureBisTables()
  local flat = {}
  for _, map in pairs(db.bisBySpec) do
    if type(map) == "table" then
      for id, tier in pairs(map) do
        if type(id) == "number" then
          if not flat[id] or tier > flat[id] then
            flat[id] = tier
          end
        end
      end
    end
  end
  db.bisItems = flat
end

-- Merge imported items per-spec (garde listes separees)
local function MergeBisFromSpecMap(specMap, overwrite)
  EnsureBisTables()
  if overwrite then
    db.bisBySpec = {}
    db.bisItems = {}
  end
  local added = 0
  local specsTouched = 0
  for specId, list in pairs(specMap) do
    specId = tonumber(specId) or 0
    if type(list) == "table" then
      if not db.bisBySpec[specId] then
        db.bisBySpec[specId] = {}
        specsTouched = specsTouched + 1
      else
        specsTouched = specsTouched + 1
      end
      local map = db.bisBySpec[specId]
      for _, entry in ipairs(list) do
        local id = tonumber(entry.itemId or entry.itemID)
        local tier = tonumber(entry.tier) or 2
        if id then
          local prev = map[id]
          if not prev then
            added = added + 1
          end
          if not prev or tier > prev then
            map[id] = tier
          end
        end
      end
    end
  end
  RebuildFlatBisCache()
  return added, specsTouched
end

-- v1: KeystoneLoot:v1,specId:item1:item2[,specId:item3]
local function ParseKSL_V1(dataStr)
  local out = {}
  for specSection in string.gmatch(dataStr, "([^,]+)") do
    local specId, itemsStr = string.match(specSection, "^(%d+):(.+)$")
    if specId and itemsStr then
      specId = tonumber(specId)
      out[specId] = out[specId] or {}
      for itemId in string.gmatch(itemsStr, "([^:]+)") do
        itemId = tonumber(itemId)
        if itemId then
          table.insert(out[specId], { itemId = itemId, tier = 2 })
        end
      end
    end
  end
  return out
end

local function SplitOutsideParens(str, delimiter)
  local result = {}
  local depth = 0
  local start = 1
  for i = 1, #str do
    local c = string.sub(str, i, i)
    if c == "(" then
      depth = depth + 1
    elseif c == ")" then
      depth = depth - 1
    elseif c == delimiter and depth == 0 then
      table.insert(result, string.sub(str, start, i - 1))
      start = i + 1
    end
  end
  if start <= #str then
    table.insert(result, string.sub(str, start))
  end
  return result
end

-- v2: KeystoneLoot:v2,specId:item1(tier,b1):item2(tier)[,...]
local function ParseKSL_V2(dataStr)
  local out = {}
  for _, specSection in ipairs(SplitOutsideParens(dataStr, ",")) do
    local specId, itemsStr = string.match(specSection, "^(%d+):(.+)$")
    if specId and itemsStr then
      specId = tonumber(specId)
      out[specId] = out[specId] or {}
      for itemChunk in string.gmatch(itemsStr, "([^:]+)") do
        local itemId, rest = string.match(itemChunk, "^(%d+)%((.*)%)$")
        if not itemId then
          itemId = string.match(itemChunk, "^(%d+)$")
        end
        itemId = tonumber(itemId)
        local tier = 2
        if rest then
          local t = string.match(rest, "^(%d+)")
          tier = tonumber(t) or 2
        end
        if itemId then
          table.insert(out[specId], { itemId = itemId, tier = tier })
        end
      end
    end
  end
  return out
end

-- v3: KeystoneLoot:v3,<base64(zlib(json))>
local function ParseKSL_V3(dataStr)
  local out = {}
  if not C_EncodingUtil or not C_EncodingUtil.DecodeBase64 then
    return out, "C_EncodingUtil missing (need retail client)"
  end
  local ok, decoded = pcall(C_EncodingUtil.DecodeBase64, dataStr)
  if not ok or not decoded then
    return out, "base64 decode failed"
  end
  local method = Enum and Enum.CompressionMethod and Enum.CompressionMethod.Zlib
  local okD, json = pcall(C_EncodingUtil.DecompressString, decoded, method)
  if not okD or not json then
    return out, "zlib decompress failed"
  end
  local okJ, data = pcall(C_EncodingUtil.DeserializeJSON, json)
  if not okJ or type(data) ~= "table" then
    return out, "json parse failed"
  end
  for specKey, itemList in pairs(data) do
    local specId = tonumber(specKey)
    if specId and type(itemList) == "table" then
      out[specId] = out[specId] or {}
      for _, itemData in ipairs(itemList) do
        local itemId = tonumber(itemData.itemId)
        if itemId then
          table.insert(out[specId], {
            itemId = itemId,
            tier = tonumber(itemData.tier) or 2,
          })
        end
      end
    end
  end
  return out
end

local function ParseKeystoneLootString(importStr)
  if type(importStr) ~= "string" then
    return nil, "empty"
  end
  local dataStr = string.gsub(importStr, "%s+", "")
  if dataStr == "" then
    return nil, "empty"
  end

  local versions = {
    { prefix = "keystoneloot:v3", parse = ParseKSL_V3 },
    { prefix = "keystoneloot:v2", parse = ParseKSL_V2 },
    { prefix = "keystoneloot:v1", parse = ParseKSL_V1 },
  }
  local lower = string.lower(dataStr)
  for _, v in ipairs(versions) do
    if string.sub(lower, 1, #v.prefix) == v.prefix then
      -- payload: after "prefix," using original casing length (= lower length)
      local payload = string.sub(dataStr, #v.prefix + 2) -- skip "prefix,"
      local map, err = v.parse(payload)
      if err and (not map or not next(map)) then
        return nil, err
      end
      return map
    end
  end

  -- Shift-clic / liens wow: item:ITEMID:...
  local fromLinks = {}
  local seenLink = {}
  for id in string.gmatch(dataStr, "[Ii]tem:(%d+)") do
    id = tonumber(id)
    if id and not seenLink[id] then
      seenLink[id] = true
      fromLinks[#fromLinks + 1] = id
    end
  end
  if #fromLinks > 0 then
    local map = { [0] = {} }
    for i = 1, #fromLinks do
      table.insert(map[0], { itemId = fromLinks[i], tier = TIER_BIS })
    end
    return map
  end

  -- Plain list of item IDs: 12345,67890 or 12345:67890
  if string.match(dataStr, "^[%d,:;|]+$") then
    local map = { [0] = {} }
    local skippedBonus = false
    for id in string.gmatch(dataStr, "%d+") do
      id = tonumber(id)
      if id then
        -- 12825–12854 = bonus pistes Midnight (Myth max = 12854), PAS des items
        if id >= 12825 and id <= 12854 then
          skippedBonus = true
        else
          table.insert(map[0], { itemId = id, tier = TIER_BIS })
        end
      end
    end
    if #map[0] > 0 then
      return map
    end
    if skippedBonus then
      return nil, "12854 is a Myth bonus, not an item. Shift-click the neck in the box, or paste KeystoneLoot:v3"
    end
  end

  return nil, "unknown format (expect KeystoneLoot:v3,... or shift-click an item)"
end

local function ImportBisString(importStr, overwrite)
  local map, err = ParseKeystoneLootString(importStr)
  if not map then
    return false, err or "parse failed"
  end
  local added, specs = MergeBisFromSpecMap(map, overwrite)
  local total = CountBis()
  local nSpecs = CountSpecsWithBis()
  return true, added, total, nSpecs
end

local function RebuildSpecFromTracks(specId)
  specId = tonumber(specId)
  if not specId then
    return
  end
  EnsureTrackTables(specId)
  local union = {}
  local tracks = db.bisTrack[specId]
  for _, key in ipairs({ "raid", "mythic", "overall" }) do
    local t = tracks and tracks[key]
    if type(t) == "table" then
      for id, tier in pairs(t) do
        id = tonumber(id) or id
        if id then
          local n = tonumber(tier) or 2
          if not union[id] or n > union[id] then
            union[id] = n
          end
        end
      end
    end
  end
  db.bisBySpec[specId] = union
  RebuildFlatBisCache()
end

-- Import une colonne spec + Raid ou M+.
-- merge=true  → ajoute (shift-clic journal, 2e trinket, etc.)
-- merge=false → remplace cette colonne seulement (export KeystoneLoot)
local function ImportBisStringForSpec(importStr, specId, merge, track)
  specId = tonumber(specId)
  track = NormalizeTrack(track)
  if not specId or specId == 0 then
    return ImportBisString(importStr, not merge)
  end
  local map, err = ParseKeystoneLootString(importStr)
  if not map then
    return false, err or "parse failed"
  end
  local list = map[specId]
  if type(list) ~= "table" or #list == 0 then
    list = {}
    for _, src in pairs(map) do
      if type(src) == "table" then
        for i = 1, #src do
          list[#list + 1] = src[i]
        end
      end
    end
  end
  if #list == 0 then
    return false, "no items found"
  end
  EnsureBisTables()
  EnsureTrackTables(specId)
  local tmap
  if merge then
    tmap = db.bisTrack[specId][track]
    if type(tmap) ~= "table" then
      tmap = {}
      db.bisTrack[specId][track] = tmap
    end
  else
    tmap = {}
  end
  local added = 0
  for _, entry in ipairs(list) do
    local id = tonumber(entry.itemId or entry.itemID)
    local tier = tonumber(entry.tier) or 2
    if id then
      if tmap[id] == nil and tmap[tostring(id)] == nil then
        added = added + 1
      end
      tmap[id] = tier
      tmap[tostring(id)] = nil
    end
  end
  db.bisTrack[specId][track] = tmap
  RebuildSpecFromTracks(specId)
  return true, added, CountBis(), CountSpecsWithBis()
end

local function RemoveImportedItem(specId, itemID, track)
  specId = tonumber(specId)
  itemID = PlainNumber(itemID) or tonumber(itemID)
  if not specId or not itemID then
    return false
  end
  EnsureBisTables()
  EnsureTrackTables(specId)
  local tracks = db.bisTrack and db.bisTrack[specId]
  if type(tracks) ~= "table" then
    return false
  end
  local function wipeMap(t)
    if type(t) ~= "table" then
      return false
    end
    local had = t[itemID] ~= nil or t[tostring(itemID)] ~= nil
    t[itemID] = nil
    t[tostring(itemID)] = nil
    return had
  end
  local removed = false
  if track then
    removed = wipeMap(tracks[NormalizeTrack(track)])
  else
    removed = wipeMap(tracks.raid) or removed
    removed = wipeMap(tracks.mythic) or removed
    removed = wipeMap(tracks.overall) or removed
  end
  RebuildSpecFromTracks(specId)
  return removed
end

local function AddImportedItem(specId, itemID, track, tier)
  specId = tonumber(specId)
  itemID = tonumber(itemID)
  track = NormalizeTrack(track)
  if not specId or specId == 0 or not itemID then
    return false
  end
  if itemID >= 12825 and itemID <= 12854 then
    return false
  end
  EnsureBisTables()
  EnsureTrackTables(specId)
  local tmap = db.bisTrack[specId][track]
  if type(tmap) ~= "table" then
    tmap = {}
    db.bisTrack[specId][track] = tmap
  end
  local existed = tmap[itemID] ~= nil or tmap[tostring(itemID)] ~= nil
  tmap[itemID] = tonumber(tier) or TIER_BIS
  tmap[tostring(itemID)] = nil
  RebuildSpecFromTracks(specId)
  return true, not existed
end

-- Optional: pull favorites from KeystoneLoot addon API (if installed)
local function SyncFromKeystoneLootAPI()
  if not KeystoneLootAPI then
    return false, "KeystoneLoot addon not loaded"
  end
  local okReady = true
  if KeystoneLootAPI.IsReady then
    okReady = KeystoneLootAPI:IsReady()
  end
  if not okReady then
    return false, "KeystoneLoot not ready yet — try again in world"
  end
  local entries = {}
  if KeystoneLootAPI.GetFavorites then
    entries = KeystoneLootAPI:GetFavorites() or {}
  end
  -- Rebuild as per-spec map
  local specMap = {}
  for _, e in ipairs(entries) do
    local id = tonumber(e.itemId)
    local tier = tonumber(e.tier) or 2
    local specId = tonumber(e.specId) or 0
    if id then
      specMap[specId] = specMap[specId] or {}
      table.insert(specMap[specId], { itemId = id, tier = tier })
    end
  end
  local added = MergeBisFromSpecMap(specMap, false)
  return true, added, CountBis(), CountSpecsWithBis()
end

local function DescribeBisStatus()
  EnsureBisTables()
  local mode = db.bisMode or "loot"
  local modeLabel = mode == "all" and "ALL specs" or (mode == "active" and "active talent" or "loot spec")
  local parts = {}
  for specId, map in pairs(db.bisBySpec) do
    if type(map) == "table" and next(map) then
      local c = 0
      for _ in pairs(map) do
        c = c + 1
      end
      table.insert(parts, GetSpecName(specId) .. "=" .. c)
    end
  end
  table.sort(parts)
  local list = (#parts > 0) and table.concat(parts, ", ") or "empty"
  return string.format("mode=%s | %s | total unique=%d", modeLabel, list, CountBis())
end

local shiftClickHooked = false
local lastImportLink, lastImportLinkAt = nil, 0

local function InsertImportLink(link)
  if type(link) ~= "string" then
    return false
  end
  if not importFrame or not importFrame.IsShown or not importFrame:IsShown() or not importFrame.Edit then
    return false
  end
  local low = link:lower()
  if not low:find("item:", 1, true) then
    return false
  end
  local now = GetTime and GetTime() or 0
  if lastImportLink == link and type(now) == "number" and (now - lastImportLinkAt) < 0.25 then
    return true
  end
  lastImportLink = link
  lastImportLinkAt = now
  local sid = tonumber(importFrame.targetSpec)
  local track = importFrame.targetTrack
  local itemID = tonumber(link:match("[Ii]tem:(%d+)"))
  -- Shift-clic journal: ajoute l'item sans écraser la liste
  if sid and sid ~= 0 and (track == "raid" or track == "mythic" or track == "overall") and itemID then
    local ok, added = AddImportedItem(sid, itemID, track)
    if ok then
      local tl = TrackLabel(track)
      if added then
        Print(string.format("Added to %s %s", GetSpecName(sid), tl))
      else
        Print(string.format("Already in %s %s", GetSpecName(sid), tl))
      end
      if JL.RefreshCollection then
        JL.RefreshCollection(true)
      end
      if RefreshSlotBoard then
        RefreshSlotBoard()
      end
    end
    return true
  end
  local e = importFrame.Edit
  local cur = e:GetText() or ""
  if cur ~= "" and not cur:match("%s$") then
    cur = cur .. " "
  end
  e:SetText(cur .. link .. " ")
  e:SetFocus()
  return true
end

local function WrapInsertLinkFn(fn)
  if type(fn) ~= "function" then
    return fn
  end
  return function(link, ...)
    if InsertImportLink(link) then
      return true
    end
    return fn(link, ...)
  end
end

local function HookShiftClickImport()
  if shiftClickHooked then
    return
  end
  local hooked = false
  if type(ChatEdit_InsertLink) == "function" then
    ChatEdit_InsertLink = WrapInsertLinkFn(ChatEdit_InsertLink)
    hooked = true
  end
  if ChatFrameUtil and type(ChatFrameUtil.InsertLink) == "function" then
    ChatFrameUtil.InsertLink = WrapInsertLinkFn(ChatFrameUtil.InsertLink)
    hooked = true
  end
  if type(HandleModifiedItemClick) == "function" then
    hooksecurefunc("HandleModifiedItemClick", function(link)
      if IsShiftKeyDown and IsShiftKeyDown() then
        InsertImportLink(link)
      end
    end)
    hooked = true
  end
  if hooked then
    shiftClickHooked = true
  end
end

local function PlaceImportNextToGrid(f)
  f = f or importFrame
  if not f then
    return
  end
  pcall(function()
    f:SetParent(UIParent)
    if f.SetToplevel then
      f:SetToplevel(false)
    end
    f:SetFrameStrata("FULLSCREEN_DIALOG")
    f:SetFrameLevel(200)
  end)
  f:ClearAllPoints()
  local grid = _G.JicksLootCollection
  if grid and grid.IsShown and grid:IsShown() then
    f:SetClampedToScreen(false)
    f:SetPoint("TOPLEFT", grid, "TOPRIGHT", 8, 0)
    f:SetPoint("BOTTOMLEFT", grid, "BOTTOMRIGHT", 8, 0)
  elseif slotBoard and slotBoard.IsShown and slotBoard:IsShown() then
    f:SetClampedToScreen(false)
    f:SetPoint("TOPLEFT", slotBoard, "TOPRIGHT", 8, 0)
    f:SetPoint("BOTTOMLEFT", slotBoard, "BOTTOMRIGHT", 8, 0)
  else
    f:SetClampedToScreen(true)
    f:SetPoint("CENTER", UIParent, "CENTER", 0, 0)
  end
end

local function OpenBisImportUI(targetSpec, targetTrack)
  HookShiftClickImport()
  targetSpec = tonumber(targetSpec)
  if targetTrack == "raid" or targetTrack == "mythic" or targetTrack == "overall" then
    -- keep
  else
    targetTrack = nil
  end
  if importFrame then
    importFrame.targetSpec = targetSpec
    importFrame.targetTrack = targetTrack
    if importFrame.RefreshImportHeader then
      importFrame.RefreshImportHeader()
    end
    importFrame:Show()
    PlaceImportNextToGrid(importFrame)
    if importFrame.Edit then
      importFrame.Edit:SetText("")
      importFrame.Edit:SetFocus()
    end
    return
  end

  local f = CreateFrame("Frame", "JicksLootBisImport", UIParent, "BackdropTemplate")
  f:SetSize(480, 220)
  f:SetFrameStrata("FULLSCREEN_DIALOG")
  f:SetFrameLevel(200)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:SetClampedToScreen(false)
  if f.SetToplevel then
    f:SetToplevel(true)
  end
  f:SetBackdrop({
    bgFile = "Interface\\Buttons\\WHITE8x8",
    edgeFile = "Interface\\Buttons\\WHITE8x8",
    edgeSize = 1,
  })
  f:SetBackdropColor(0.08, 0.09, 0.12, 0.97)
  f:SetBackdropBorderColor(0.85, 0.70, 0.25, 0.9)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", function()
    if slotBoard and slotBoard:IsShown() then
      slotBoard:StartMoving()
    else
      f:StartMoving()
    end
  end)
  f:SetScript("OnDragStop", function()
    if slotBoard and slotBoard:IsShown() then
      slotBoard:StopMovingOrSizing()
    else
      f:StopMovingOrSizing()
    end
    PlaceImportNextToGrid(f)
  end)
  tinsert(UISpecialFrames, "JicksLootBisImport")

  f.targetSpec = targetSpec
  f.targetTrack = targetTrack

  local title = f:CreateFontString(nil, "OVERLAY")
  title:SetFont(STANDARD_TEXT_FONT, 14, "OUTLINE")
  title:SetPoint("TOPLEFT", 14, -12)
  title:SetTextColor(0.95, 0.82, 0.35, 1)
  title:SetText("Import BiS — keystoneloot.io")
  f.TitleFS = title

  local sub = f:CreateFontString(nil, "OVERLAY")
  sub:SetFont(STANDARD_TEXT_FONT, 11, "")
  sub:SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -4)
  sub:SetWidth(450)
  sub:SetJustifyH("LEFT")
  sub:SetTextColor(0.65, 0.68, 0.72, 1)
  sub:SetText("Paste KeystoneLoot:v3,... (multi-spec OK: Balance+Feral+Guardian+Resto). Highlight follows loot spec (or /jl bis mode all).")
  f.SubFS = sub

  f.RefreshImportHeader = function()
    local sid = f.targetSpec
    local track = f.targetTrack
    local trackLabel = track and TrackLabel(track) or nil
    if f.BtnMerge then
      f.BtnMerge:Show()
      f.BtnMerge:SetText("Add items")
    end
    if f.BtnOver then
      f.BtnOver:SetText("Replace list")
      f.BtnOver:Show()
    end
    if sid and sid ~= 0 then
      local specName = GetSpecName(sid)
      if trackLabel then
        f.TitleFS:SetText("Import " .. specName .. " — " .. trackLabel)
        f.SubFS:SetText("Shift-click a dungeon-journal item to ADD it (keeps the rest). Paste a KeystoneLoot export and click Replace list to overwrite this column only.")
      else
        f.TitleFS:SetText("Import Gear — " .. specName)
        f.SubFS:SetText("Shift-click items to add. Paste a KeystoneLoot export and Replace list to overwrite.")
      end
    else
      f.TitleFS:SetText("Import BiS — keystoneloot.io")
      f.SubFS:SetText("Paste a KeystoneLoot export (Replace list) or shift-click items (Add items).")
    end
  end

  local scroll = CreateFrame("ScrollFrame", nil, f, "UIPanelScrollFrameTemplate")
  scroll:SetPoint("TOPLEFT", 14, -52)
  scroll:SetPoint("BOTTOMRIGHT", -34, 48)

  local edit = CreateFrame("EditBox", nil, scroll)
  edit:SetMultiLine(true)
  edit:SetFontObject(ChatFontNormal)
  edit:SetWidth(420)
  edit:SetAutoFocus(true)
  edit:SetScript("OnEscapePressed", function()
    f:Hide()
  end)
  scroll:SetScrollChild(edit)
  f.Edit = edit

  local function doImport(merge)
    local text = edit:GetText() or ""
    local sid = f.targetSpec
    local track = f.targetTrack
    local ok, a, b, nSpecs
    if sid and sid ~= 0 then
      ok, a, b, nSpecs = ImportBisStringForSpec(text, sid, merge and true or false, track)
    else
      ok, a, b, nSpecs = ImportBisString(text, not merge)
    end
    if ok then
      if sid and sid ~= 0 then
        local tl = track and (" " .. TrackLabel(track)) or ""
        local how = merge and "Added" or "Replaced"
        Print(string.format("%s %s%s — +%d items", how, GetSpecName(sid), tl, a or 0))
        local ids = ListBoardSpecIds()
        for i = 1, #ids do
          if ids[i] == sid then
            slotBoardSpecIndex = i
            break
          end
        end
      else
        Print(string.format("BiS import OK — +%d items, %d unique, %d spec list(s)", a or 0, b or 0, nSpecs or CountSpecsWithBis()))
      end
      Print(DescribeBisStatus())
      if session.shown then
        Refresh()
      end
      f:Hide()
      if OpenSlotBoard then
        OpenSlotBoard()
      end
    else
      Print("BiS import failed: " .. tostring(a))
    end
  end

  local btnMerge = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
  btnMerge:SetSize(110, 24)
  btnMerge:SetPoint("BOTTOMLEFT", 14, 12)
  btnMerge:SetText("Add items")
  f.BtnMerge = btnMerge
  btnMerge:SetScript("OnClick", function()
    doImport(true)
  end)

  local btnOver = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
  btnOver:SetSize(110, 24)
  btnOver:SetPoint("LEFT", btnMerge, "RIGHT", 8, 0)
  btnOver:SetText("Replace list")
  f.BtnOver = btnOver
  btnOver:SetScript("OnClick", function()
    doImport(false)
  end)

  local btnCancel = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
  btnCancel:SetSize(90, 24)
  btnCancel:SetPoint("BOTTOMRIGHT", -14, 12)
  btnCancel:SetText("Cancel")
  btnCancel:SetScript("OnClick", function()
    f:Hide()
  end)

  importFrame = f
  f.RefreshImportHeader()
  f:Show()
  PlaceImportNextToGrid(f)
end

local function ClassRGB(classFile)
  classFile = PlainString(classFile)
  if classFile and RAID_CLASS_COLORS and RAID_CLASS_COLORS[classFile] then
    local c = RAID_CLASS_COLORS[classFile]
    return c.r or 1, c.g or 1, c.b or 1
  end
  if classFile and GetClassColor then
    local ok, r, g, b = pcall(GetClassColor, classFile)
    if ok and type(r) == "number" then
      return r, g or 1, b or 1
    end
  end
  return 0.85, 0.85, 0.88
end

local function ShortName(full)
  full = PlainString(full)
  if not full then
    return "?"
  end
  local n = full:match("^([^%-]+)") or full
  return n
end

-- Whisper cross-realm = "Name-Realm" (espaces du royaume retirés, ex. Area 52 → Area52)
local function StripRealmSpaces(realm)
  realm = PlainString(realm)
  if not realm then
    return nil
  end
  return realm:gsub("%s+", "")
end

local function MyRealmNormalized()
  local r = (GetNormalizedRealmName and GetNormalizedRealmName()) or (GetRealmName and GetRealmName())
  return StripRealmSpaces(r)
end

local function FormatNameRealm(name, realm)
  name = PlainString(name)
  if not name then
    return nil
  end
  realm = StripRealmSpaces(realm)
  if realm and realm ~= "" then
    return name .. "-" .. realm
  end
  return name
end

-- Cherche Name-Realm dans le groupe / raid (UnitName renvoie souvent le realm à part)
local function LookupUnitFullName(shortOrFull)
  local want = ShortName(shortOrFull)
  if want == "?" then
    return nil
  end
  local function check(unit)
    if not unit or not UnitExists or not UnitExists(unit) then
      return nil
    end
    local ok, n, realm = pcall(UnitName, unit)
    n = ok and PlainString(n) or nil
    if not n then
      return nil
    end
    if ShortName(n) ~= want and n ~= want then
      return nil
    end
    -- UnitName: 2e valeur = realm si autre royaume (parfois nil si même realm)
    realm = PlainString(realm)
    if realm then
      return FormatNameRealm(n, realm)
    end
    -- UnitFullName si dispo
    if UnitFullName then
      local ok2, n2, r2 = pcall(UnitFullName, unit)
      if ok2 and type(n2) == "string" then
        return FormatNameRealm(n2, r2)
      end
    end
    return FormatNameRealm(n, nil)
  end

  local full = check("player")
  -- pas soi : on cherche les autres
  for i = 1, 4 do
    full = check("party" .. i)
    if full then
      return full
    end
  end
  local nRaid = 0
  if GetNumGroupMembers then
    local ok, n = pcall(GetNumGroupMembers)
    if ok and type(n) == "number" then
      nRaid = n
    end
  end
  if nRaid < 1 then
    nRaid = 40
  end
  for i = 1, nRaid do
    full = check("raid" .. i)
    if full then
      return full
    end
  end
  return nil
end

local function NormalizeWhisperTarget(full)
  full = PlainString(full)
  if not full or full == "" then
    return nil
  end
  -- Déjà "Name-Realm" → normalise les espaces du royaume
  local name, realm = full:match("^([^%-]+)%-(.+)$")
  if name and realm then
    return FormatNameRealm(name, realm)
  end
  -- Nom seul : essayer de trouver le realm via party/raid (cross-realm)
  local looked = LookupUnitFullName(full)
  if looked then
    return looked
  end
  -- Même royaume : le nom seul suffit souvent
  return full
end

local function IsSelfPlayer(full)
  full = PlainString(full)
  if not full then
    return false
  end
  local me = UnitName("player")
  if not me then
    return false
  end
  local short = ShortName(full)
  if short ~= me then
    return false
  end
  local myRealm = MyRealmNormalized()
  local realm = full:match("%-(.+)$")
  if not realm then
    return true -- Name seul + même short name = toi (même serveur)
  end
  realm = StripRealmSpaces(realm)
  if myRealm and realm and realm:lower() == myRealm:lower() then
    return true
  end
  return false
end

-- Message EN poli, sans fautes
local function BuildPassWhisper(itemLink, itemName)
  local itemBit = nil
  itemBit = PlainString(itemLink) or PlainString(itemName) or "that item"
  return "Hey! If you don't need " .. itemBit .. ", I'd be happy to take it. Thanks!"
end

local function SendPassWhisper(playerFull, itemLink, itemName)
  local target = NormalizeWhisperTarget(playerFull)
  if not target then
    Print("no player to whisper")
    return
  end
  if IsSelfPlayer(target) then
    Print("that's your loot")
    return
  end
  local msg = BuildPassWhisper(itemLink, itemName)
  -- Cross-realm: target doit être "Name-Realm" (sans espaces dans le realm)
  local ok = pcall(SendChatMessage, msg, "WHISPER", nil, target)
  if ok then
    Print("whisper sent → " .. target)
  else
    Print("whisper failed → " .. target .. " (try Name-Realm if other server)")
  end
end

local function QualityFromLink(itemLink)
  itemLink = PlainString(itemLink)
  if not itemLink then
    return nil
  end
  -- Format moderne DF/TWW: |cnIQ4:|Hitem:...|h[Name]|h|r
  local iq = itemLink:match("|cnIQ(%d+):")
  if iq then
    return tonumber(iq)
  end
  local hex = itemLink:match("|c(%x%x%x%x%x%x%x%x)")
  if not hex then
    return nil
  end
  hex = hex:lower()
  if hex == "ffff8000" then return 5 end -- legendary
  if hex == "ffa335ee" then return 4 end -- epic
  if hex == "ff0070dd" then return 3 end -- rare (bleu)
  if hex == "ff1eff00" then return 2 end -- uncommon
  if hex == "ffffffff" then return 1 end -- common
  if hex == "ff9d9d9d" then return 0 end -- poor
  return nil
end

-- Ancienne promo ilvl>=200 → epic : FAUSSE en Midnight.
-- Adventurer / Veteran / Champion peuvent etre rare (bleu) a 270+.
-- La qualite = couleur du link / GetItemInfo(link), jamais l'ilvl.
local function PromoteSeasonQuality(q, _ilvl)
  return PlainNumber(q)
end

-- Garde le link du drop (bonus IDs / ilvl S2). Ne pas strip les secrets:
-- SetHyperlink et GetDetailedItemLevelInfo les acceptent.
local function KeepItemLink(v)
  -- SetHyperlink / GetDetailedItemLevelInfo accept secret links.
  if IsSecretVal(v) then
    return v
  end
  if type(v) ~= "string" then
    return nil
  end
  local ok, empty = pcall(function()
    return v == ""
  end)
  if not ok or empty then
    return nil
  end
  return v
end

local function ItemLevel(itemLink, itemID)
  if GetDetailedItemLevelInfo then
    if itemLink then
      local ok, ilvl = pcall(GetDetailedItemLevelInfo, itemLink)
      if ok then
        ilvl = PlainNumber(ilvl)
        if ilvl then
          return ilvl
        end
      end
    end
    if itemID then
      local ok, ilvl = pcall(GetDetailedItemLevelInfo, itemID)
      if ok then
        return PlainNumber(ilvl)
      end
    end
  end
  return nil
end

local function LinkHasDropData(itemLink)
  local s = PlainString(itemLink)
  if not s then
    -- secret link = on le traite comme le vrai drop
    return IsSecretVal(itemLink)
  end
  local payload = s:match("|Hitem:([^|]+)|h") or s:match("item:([^|]+)")
  if not payload then
    return false
  end
  local n = 0
  for _ in (payload .. ":"):gmatch("([^:]*):") do
    n = n + 1
  end
  -- link drop = beaucoup de champs (bonus IDs). link de base = presque vide
  return n >= 13
end

local function ItemQuality(itemID, itemLink)
  -- Le link du drop d'abord (qualite S2), pas l'ID de base (souvent bleu BFA)
  local qLink = QualityFromLink(itemLink)
  if qLink then
    return qLink
  end
  if itemLink and GetItemInfo then
    local ok, _, q = pcall(GetItemInfo, itemLink)
    if ok and type(q) == "number" and not IsSecretVal(q) then
      return q
    end
  end
  if C_Item and C_Item.GetItemQualityByID and itemID then
    local ok, q = pcall(C_Item.GetItemQualityByID, itemID)
    if ok and type(q) == "number" and not IsSecretVal(q) then
      return q
    end
  end
  return nil
end

local function ItemNameAndIcon(itemID, itemLink)
  local name, icon, quality
  -- Link du drop en premier → nom / icone / qualite de la version lootee
  if itemLink and GetItemInfo then
    local ok, n, _, q, _, _, _, _, _, tex = pcall(GetItemInfo, itemLink)
    if ok then
      name = PlainString(n)
      quality = PlainNumber(q)
      if type(tex) == "number" and not IsSecretVal(tex) then
        icon = tex
      end
    end
  end
  if not name then
    local s = PlainString(itemLink)
    if s then
      name = s:match("%[(.-)%]")
    end
  end
  if itemID and C_Item then
    if not name and C_Item.GetItemNameByID then
      local ok, n = pcall(C_Item.GetItemNameByID, itemID)
      if ok then name = PlainString(n) end
    end
    if not icon and C_Item.GetItemIconByID then
      local ok, ic = pcall(C_Item.GetItemIconByID, itemID)
      if ok and type(ic) == "number" and not IsSecretVal(ic) then
        icon = ic
      end
    end
  end
  if (not name or not icon) and itemID and GetItemInfo then
    local ok, n, _, q, _, _, _, _, _, tex = pcall(GetItemInfo, itemID)
    if ok then
      name = name or PlainString(n)
      -- Ne PAS prendre la qualite de l'ID de base (souvent rare BFA alors que le drop est epic)
      if not quality and not itemLink then
        quality = PlainNumber(q)
      end
      if type(tex) == "number" and not IsSecretVal(tex) then
        icon = icon or tex
      end
    end
  end
  -- Qualite du link (couleur |c| dans le hyperlink) en priorite absolue
  local qLink = QualityFromLink(itemLink)
  if qLink then
    quality = qLink
  end
  return name or ("Item " .. tostring(itemID or "?")), icon, quality
end

-- true = arme/armure/bijou, false = junk/conso/recette, nil = pas encore chargé
local function IsGearItem(itemID, itemLink)
  local src = itemLink or itemID
  if not src then
    return nil
  end
  local equipLoc, classID
  if GetItemInfo then
    local ok, _, _, _, _, _, _, _, loc, _, _, cid = pcall(GetItemInfo, src)
    if ok then
      equipLoc = PlainString(loc)
      classID = PlainNumber(cid)
    end
  end
  if C_Item and itemID then
    if (not classID) and C_Item.GetItemClassID then
      local ok, cid = pcall(C_Item.GetItemClassID, itemID)
      if ok then
        classID = PlainNumber(cid)
      end
    end
    if (not equipLoc or equipLoc == "") and C_Item.GetItemInventoryTypeByID then
      local ok, inv = pcall(C_Item.GetItemInventoryTypeByID, itemID)
      inv = PlainNumber(inv)
      -- 0 = NonEquip ; si > 0 on a un slot, on confirme via equipLoc si possible
      if ok and inv and inv > 0 and (not equipLoc or equipLoc == "") then
        -- slots à ignorer: 4 shirt, 18 bag, 19 tabard, 24 ammo
        if inv == 4 or inv == 18 or inv == 19 or inv == 24 then
          return false
        end
        return true
      end
    end
  end
  if equipLoc and equipLoc ~= "" then
    if equipLoc == "INVTYPE_NON_EQUIP" or equipLoc == "INVTYPE_NON_EQUIP_IGNORE"
      or equipLoc == "INVTYPE_BAG" or equipLoc == "INVTYPE_AMMO"
      or equipLoc == "INVTYPE_QUIVER" or equipLoc == "INVTYPE_TABARD"
      or equipLoc == "INVTYPE_BODY" then
      return false
    end
    return true
  end
  -- 2 = Weapon, 4 = Armor (neck/finger/trinket/cloak inclus)
  if classID == 2 or classID == 4 then
    return true
  end
  if classID ~= nil then
    return false
  end
  return nil
end

local function IsItemLooted(itemID)
  itemID = PlainNumber(itemID) or tonumber(itemID)
  if not itemID or not db or type(db.lootedItems) ~= "table" then
    return false
  end
  return db.lootedItems[itemID] == true or db.lootedItems[tostring(itemID)] == true
end

local function NormalizeItemName(name)
  name = PlainString(name)
  if not name or name == "" then
    return nil
  end
  local ok, clean = pcall(function()
    local t = name:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|cnIQ%d+:", ""):gsub("|r", "")
    t = t:gsub("%s+", " ")
    t = t:match("^%s*(.-)%s*$") or t
    return t:lower()
  end)
  if ok and type(clean) == "string" and clean ~= "" then
    return clean
  end
  return nil
end

local SLOT_TO_INV = {
  HEAD = { 1 }, NECK = { 2 }, SHOULDER = { 3 }, BACK = { 15 }, CHEST = { 5 },
  WRIST = { 9 }, HANDS = { 10 }, WAIST = { 6 }, LEGS = { 7 }, FEET = { 8 },
  FINGER1 = { 11 }, FINGER2 = { 12 }, TRINKET1 = { 13 }, TRINKET2 = { 14 },
  MAINHAND = { 16 }, OFFHAND = { 17 },
}

local function CountOwnedItem(itemID)
  itemID = PlainNumber(itemID)
  if not itemID then
    return false
  end
  if GetItemCount then
    local ok, n = pcall(GetItemCount, itemID, true)
    if ok and type(n) == "number" and not IsSecretVal(n) then
      local okC, has = pcall(function()
        return n > 0
      end)
      if okC and has then
        return true
      end
    end
  end
  if C_Item and C_Item.GetItemCount then
    local ok, n = pcall(C_Item.GetItemCount, itemID, true)
    if ok and type(n) == "number" and not IsSecretVal(n) then
      local okC, has = pcall(function()
        return n > 0
      end)
      if okC and has then
        return true
      end
    end
  end
  return false
end

local function SnapshotPlayerGear()
  local byId, byName, byKey = {}, {}, {}
  for key, slots in pairs(SLOT_TO_INV) do
    for i = 1, #slots do
      local inv = slots[i]
      local id
      if GetInventoryItemID then
        local ok, v = pcall(GetInventoryItemID, "player", inv)
        if ok then
          id = PlainNumber(v)
        end
      end
      local link
      if GetInventoryItemLink then
        local ok, v = pcall(GetInventoryItemLink, "player", inv)
        if ok then
          link = KeepItemLink(v) or PlainString(v)
        end
      end
      if id or link then
        local name = select(1, ItemNameAndIcon(id, link))
        local ilvl = ItemLevel(link, id)
        local rec = { id = id, link = link, name = name, ilvl = ilvl }
        if id then
          byId[id] = rec
        end
        local nk = NormalizeItemName(name)
        if nk then
          byName[nk] = rec
        end
        byKey[key] = rec
      end
    end
  end
  return { byId = byId, byName = byName, byKey = byKey }
end

-- Midnight S2 upgrade steps (all obtainable ilvl brackets)
local ILVL_STEPS = {
  256, 259, 263, 266, 269, 272, 276, 279, 282, 285, 289,
  292, 295, 298, 302, 305, 308, 311, 315, 318, 321, 324,
  328, 331, 334, 337, 341, 344,
}
local ILVL_MIN, ILVL_MAX = 256, 344

local ownedScanCache = { t = 0, data = nil }

local function ConsiderOwned(pack, id, link, name)
  id = PlainNumber(id) or tonumber(id)
  link = KeepItemLink(link) or PlainString(link)
  if not id and not link then
    return
  end
  if not name then
    name = select(1, ItemNameAndIcon(id, link))
  end
  local ilvl = ItemLevel(link, id)
  local rec = { id = id, link = link, name = name, ilvl = ilvl }
  if id then
    local prev = pack.byId[id]
    if not prev or (ilvl and (not prev.ilvl or ilvl > prev.ilvl)) then
      pack.byId[id] = rec
    end
  end
  local nk = NormalizeItemName(name)
  if nk then
    local prev = pack.byName[nk]
    if not prev or (ilvl and (not prev.ilvl or ilvl > prev.ilvl)) then
      pack.byName[nk] = rec
    end
  end
end

local function ScanOwnedGear(force)
  local now = GetTime and GetTime() or 0
  if not force and ownedScanCache.data and (now - (ownedScanCache.t or 0)) < 0.75 then
    return ownedScanCache.data
  end
  local pack = { byId = {}, byName = {}, byKey = {} }
  local equipped = SnapshotPlayerGear()
  for id, rec in pairs(equipped.byId or {}) do
    ConsiderOwned(pack, rec.id, rec.link, rec.name)
  end
  pack.byKey = equipped.byKey or {}

  local bags = {}
  local seenBag = {}
  local function addBag(i)
    i = tonumber(i)
    if i ~= nil and not seenBag[i] then
      seenBag[i] = true
      bags[#bags + 1] = i
    end
  end
  for i = 0, 12 do
    addBag(i)
  end
  addBag(-1)
  addBag(-2)
  addBag(-3)
  if Enum and Enum.BagIndex then
    for _, v in pairs(Enum.BagIndex) do
      addBag(v)
    end
  end

  local function bagSlots(bag)
    if C_Container and C_Container.GetContainerNumSlots then
      local ok, n = pcall(C_Container.GetContainerNumSlots, bag)
      if ok then
        return tonumber(n) or 0
      end
    end
    if GetContainerNumSlots then
      local ok, n = pcall(GetContainerNumSlots, bag)
      if ok then
        return tonumber(n) or 0
      end
    end
    return 0
  end
  local function bagLink(bag, slot)
    if C_Container and C_Container.GetContainerItemLink then
      local ok, link = pcall(C_Container.GetContainerItemLink, bag, slot)
      if ok then
        return KeepItemLink(link) or PlainString(link)
      end
    end
    if GetContainerItemLink then
      local ok, link = pcall(GetContainerItemLink, bag, slot)
      if ok then
        return KeepItemLink(link) or PlainString(link)
      end
    end
    return nil
  end
  local function bagID(bag, slot)
    if C_Container and C_Container.GetContainerItemID then
      local ok, id = pcall(C_Container.GetContainerItemID, bag, slot)
      if ok then
        return PlainNumber(id)
      end
    end
    if GetContainerItemID then
      local ok, id = pcall(GetContainerItemID, bag, slot)
      if ok then
        return PlainNumber(id)
      end
    end
    return nil
  end

  for bi = 1, #bags do
    local bag = bags[bi]
    local n = bagSlots(bag)
    for slot = 1, n do
      local link = bagLink(bag, slot)
      local id = bagID(bag, slot)
      if not id and type(link) == "string" then
        id = tonumber(link:match("item:(%d+)"))
      end
      if id or link then
        ConsiderOwned(pack, id, link, nil)
      end
    end
  end

  ownedScanCache.t = now
  ownedScanCache.data = pack
  return pack
end

-- loot boss OU équipe / sacs (craft 305 compte, même si la grille vise du 331)
local function FindOwnedCopy(itemID, itemName, gear)
  itemID = PlainNumber(itemID) or tonumber(itemID)
  gear = gear or SnapshotPlayerGear()
  if itemID and gear.byId[itemID] then
    return gear.byId[itemID]
  end
  local nk = NormalizeItemName(itemName)
  if nk and gear.byName[nk] then
    return gear.byName[nk]
  end
  if itemID and CountOwnedItem(itemID) then
    return gear.byId[itemID] or { id = itemID }
  end
  if itemID and IsItemLooted(itemID) then
    return gear.byId[itemID] or { id = itemID }
  end
  return nil
end

local SEASON_MIN_OWNED_ILVL = 280

local function BestWornIlvl(gear, bucket)
  if not gear or not gear.byKey then
    return 0
  end
  local keys
  if bucket == "FINGER" then
    keys = { "FINGER1", "FINGER2" }
  elseif bucket == "TRINKET" then
    keys = { "TRINKET1", "TRINKET2" }
  elseif bucket == "WEAPON" then
    keys = { "MAINHAND", "OFFHAND" }
  else
    keys = { bucket }
  end
  local best = 0
  for i = 1, #keys do
    local rec = gear.byKey[keys[i]]
    local ilvl = rec and PlainNumber(rec.ilvl)
    if ilvl and ilvl > best then
      best = ilvl
    end
  end
  return best
end

-- Cadre "je l'ai" seulement si l'ilvl utile >= ce que tu portes déjà (ignore un 214 si tu as du 305)
local function AcceptOwnedForSlot(owned, gear, bucket)
  if not owned then
    return nil
  end
  if owned.id and gear and gear.byId and gear.byId[owned.id] then
    owned = gear.byId[owned.id]
  end
  local have = PlainNumber(owned.ilvl)
  local worn = BestWornIlvl(gear, bucket)
  if not have then
    return nil
  end
  if have < SEASON_MIN_OWNED_ILVL then
    return nil
  end
  if worn > 0 then
    local ok, worse = pcall(function()
      return have < worn
    end)
    if ok and worse then
      return nil
    end
  end
  return owned
end

-- Marque seulement si C'EST TOI qui as reçu l'item (pas juste un drop du boss)
local function MarkItemLooted(itemID, who)
  itemID = PlainNumber(itemID) or tonumber(itemID)
  if not itemID or not db then
    return
  end
  if who == nil or not IsSelfPlayer(who) then
    return
  end
  if type(db.lootedItems) ~= "table" then
    db.lootedItems = {}
  end
  db.lootedItems[itemID] = true
  if RefreshSlotBoard then
    RefreshSlotBoard()
  end
end

-- ─── Tableau slots (import + déjà loot) ─────────────────────

local EQUIP_TO_BUCKET = {
  INVTYPE_HEAD = "HEAD",
  INVTYPE_NECK = "NECK",
  INVTYPE_SHOULDER = "SHOULDER",
  INVTYPE_CLOAK = "BACK",
  INVTYPE_CHEST = "CHEST",
  INVTYPE_ROBE = "CHEST",
  INVTYPE_WRIST = "WRIST",
  INVTYPE_HAND = "HANDS",
  INVTYPE_WAIST = "WAIST",
  INVTYPE_LEGS = "LEGS",
  INVTYPE_FEET = "FEET",
  INVTYPE_FINGER = "FINGER",
  INVTYPE_TRINKET = "TRINKET",
  INVTYPE_WEAPON = "WEAPON",
  INVTYPE_2HWEAPON = "MAINHAND",
  INVTYPE_WEAPONMAINHAND = "MAINHAND",
  INVTYPE_WEAPONOFFHAND = "OFFHAND",
  INVTYPE_HOLDABLE = "OFFHAND",
  INVTYPE_SHIELD = "OFFHAND",
  INVTYPE_RANGED = "MAINHAND",
  INVTYPE_RANGEDRIGHT = "MAINHAND",
}

local INVTYPE_TO_BUCKET = {
  [1] = "HEAD", [2] = "NECK", [3] = "SHOULDER", [5] = "CHEST",
  [6] = "WAIST", [7] = "LEGS", [8] = "FEET", [9] = "WRIST",
  [10] = "HANDS", [11] = "FINGER", [12] = "TRINKET", [13] = "WEAPON",
  [14] = "OFFHAND", [15] = "MAINHAND", [16] = "BACK", [17] = "MAINHAND",
  [20] = "CHEST", [21] = "MAINHAND", [22] = "OFFHAND", [23] = "OFFHAND",
  [26] = "MAINHAND",
}

-- Layout type feuille de perso Blizzard
local SLOT_LEFT = { "HEAD", "NECK", "SHOULDER", "BACK", "CHEST", "WRIST" }
local SLOT_RIGHT = { "HANDS", "WAIST", "LEGS", "FEET", "FINGER1", "FINGER2", "TRINKET1", "TRINKET2" }
local SLOT_BOTTOM = { "MAINHAND", "OFFHAND" }

local SLOT_LABEL = {
  HEAD = "Head", NECK = "Neck", SHOULDER = "Shoulder", BACK = "Back",
  CHEST = "Chest", WRIST = "Wrist", HANDS = "Hands", WAIST = "Waist",
  LEGS = "Legs", FEET = "Feet", FINGER1 = "Ring 1", FINGER2 = "Ring 2",
  TRINKET1 = "Trinket 1", TRINKET2 = "Trinket 2", MAINHAND = "Main Hand", OFFHAND = "Off Hand",
}

local SLOT_ORDER = {
  "HEAD", "NECK", "SHOULDER", "BACK", "CHEST", "WRIST",
  "HANDS", "WAIST", "LEGS", "FEET",
  "FINGER1", "FINGER2", "TRINKET1", "TRINKET2",
  "MAINHAND", "OFFHAND",
}

local slotBoard
local slotBoardSpecIndex = 1

local function ReadItemEquipLoc(itemID)
  itemID = PlainNumber(itemID) or tonumber(itemID)
  if not itemID then
    return nil, nil, nil
  end
  local loc, inv, classID
  if GetItemInfo then
    local ok, _, _, _, _, _, _, _, el, _, _, cid = pcall(GetItemInfo, itemID)
    if ok then
      loc = PlainString(el)
      classID = PlainNumber(cid)
    end
  end
  if C_Item then
    if (not loc or loc == "") and C_Item.GetItemInventoryTypeByID then
      local ok, v = pcall(C_Item.GetItemInventoryTypeByID, itemID)
      if ok then
        inv = PlainNumber(v)
      end
    end
    if not classID and C_Item.GetItemClassID then
      local ok, v = pcall(C_Item.GetItemClassID, itemID)
      if ok then
        classID = PlainNumber(v)
      end
    end
  end
  return loc, inv, classID
end

local function ItemIsBagOrJunkSlot(itemID)
  local loc, inv, classID = ReadItemEquipLoc(itemID)
  if loc == "INVTYPE_BAG" or loc == "INVTYPE_QUIVER" or loc == "INVTYPE_AMMO"
    or loc == "INVTYPE_NON_EQUIP" or loc == "INVTYPE_NON_EQUIP_IGNORE"
    or loc == "INVTYPE_TABARD" or loc == "INVTYPE_BODY" then
    return true
  end
  if inv == 18 or inv == 24 or inv == 27 or inv == 4 or inv == 19 then
    return true
  end
  -- 1 = Container (sacs)
  if classID == 1 then
    return true
  end
  return false
end

local function ItemIsTwoHand(itemID)
  local loc, inv = ReadItemEquipLoc(itemID)
  if loc == "INVTYPE_2HWEAPON" or loc == "INVTYPE_RANGED" or loc == "INVTYPE_RANGEDRIGHT" then
    return true
  end
  -- 15 ranged, 17 2H, 26 ranged right
  if inv == 15 or inv == 17 or inv == 26 then
    return true
  end
  return false
end

local function IsBlockedImportId(itemID)
  itemID = tonumber(itemID)
  if not itemID then
    return true
  end
  if itemID >= 12825 and itemID <= 12854 then
    return true
  end
  if itemID == 13440 or itemID == 134400 then
    return true
  end
  return false
end

local function SanitizeBisLists()
  if not db then
    return
  end
  EnsureBisTables()
  for _, map in pairs(db.bisBySpec or {}) do
    if type(map) == "table" then
      for id in pairs(map) do
        if IsBlockedImportId(id) then
          map[id] = nil
        end
      end
    end
  end
  if type(db.bisItems) == "table" then
    for id in pairs(db.bisItems) do
      if IsBlockedImportId(id) then
        db.bisItems[id] = nil
      end
    end
  end
end

local function GetItemSlotBucket(itemID)
  itemID = PlainNumber(itemID) or tonumber(itemID)
  if not itemID then
    return nil
  end
  if ItemIsBagOrJunkSlot(itemID) then
    return nil
  end
  local loc, inv = ReadItemEquipLoc(itemID)
  if loc and EQUIP_TO_BUCKET[loc] then
    return EQUIP_TO_BUCKET[loc]
  end
  if inv and INVTYPE_TO_BUCKET[inv] then
    return INVTYPE_TO_BUCKET[inv]
  end
  return nil
end

local function ItemCanDressOnModel(itemID)
  itemID = PlainNumber(itemID) or tonumber(itemID)
  if not itemID then
    return false
  end
  if IsBlockedImportId(itemID) then
    return false
  end
  if ItemIsBagOrJunkSlot(itemID) then
    return false
  end
  if not GetItemSlotBucket(itemID) then
    return false
  end
  local _, _, classID = ReadItemEquipLoc(itemID)
  -- 2 = Weapon, 4 = Armor
  if classID ~= nil and classID ~= 2 and classID ~= 4 then
    return false
  end
  return true
end

ListImportedSpecIds = function()
  EnsureBisTables()
  local ids = {}
  local seen = {}
  for specId, map in pairs(db.bisBySpec or {}) do
    specId = tonumber(specId) or specId
    if type(map) == "table" and next(map) and specId ~= 0 and not seen[specId] then
      seen[specId] = true
      ids[#ids + 1] = specId
    end
  end
  table.sort(ids)
  if #ids == 0 then
    local map0 = db.bisBySpec and (db.bisBySpec[0] or db.bisBySpec["0"])
    if type(map0) == "table" and next(map0) then
      ids[1] = 0
    end
  end
  return ids
end

local function GetPlayerClassSpecIds()
  local ids = {}
  local classId
  if UnitClass then
    local ok, _, _, id = pcall(UnitClass, "player")
    if ok then
      classId = tonumber(id)
    end
  end
  local n = 0
  if classId and GetNumSpecializationsForClassID then
    local ok, num = pcall(GetNumSpecializationsForClassID, classId)
    if ok then
      n = tonumber(num) or 0
    end
  end
  if n <= 0 and GetNumSpecializations then
    local ok, num = pcall(GetNumSpecializations)
    if ok then
      n = tonumber(num) or 0
    end
  end
  for i = 1, n do
    local specId
    if classId and GetSpecializationInfoForClassID then
      local ok, id = pcall(GetSpecializationInfoForClassID, classId, i)
      if ok then
        specId = tonumber(id)
      end
    end
    if not specId and GetSpecializationInfo then
      local ok, id = pcall(GetSpecializationInfo, i)
      if ok then
        specId = tonumber(id)
      end
    end
    if specId and specId > 0 then
      ids[#ids + 1] = specId
    end
  end
  return ids
end

ListBoardSpecIds = function()
  local ids = {}
  local seen = {}
  local classSpecs = GetPlayerClassSpecIds()
  for i = 1, #classSpecs do
    local id = classSpecs[i]
    if id and not seen[id] then
      seen[id] = true
      ids[#ids + 1] = id
    end
  end
  local imported = ListImportedSpecIds()
  for i = 1, #imported do
    local id = imported[i]
    if id and id ~= 0 and not seen[id] then
      seen[id] = true
      ids[#ids + 1] = id
    end
  end
  return ids
end

local function StepSlotSpec(delta)
  local specIds = ListBoardSpecIds()
  if #specIds == 0 then
    return
  end
  local i = tonumber(slotBoardSpecIndex) or 1
  i = i + (tonumber(delta) or 1)
  if i < 1 then
    i = #specIds
  elseif i > #specIds then
    i = 1
  end
  slotBoardSpecIndex = i
  if slotBoard then
    slotBoard:Show()
  end
  RefreshSlotBoard()
end

GetViewedSpecId = function()
  local ids = ListBoardSpecIds()
  if #ids > 0 then
    local i = tonumber(slotBoardSpecIndex) or 1
    if i < 1 then i = 1 end
    if i > #ids then i = #ids end
    return ids[i]
  end
  return GetLootSpecId() or GetActiveTalentSpecId()
end

local function BuildDisplaySlots(specId, gear, track)
  local buckets = {}
  local ownedPack = ScanOwnedGear()
  gear = gear or ownedPack
  local map
  if track then
    map = GetTrackMap(specId, track)
  else
    map = db and db.bisBySpec and (db.bisBySpec[specId] or db.bisBySpec[tostring(specId)])
  end
  if type(map) ~= "table" then
    map = {}
  end
  for id, tier in pairs(map) do
    id = tonumber(id) or id
    if type(id) == "number" and not IsBlockedImportId(id) then
      if C_Item and C_Item.RequestLoadItemDataByID then
        pcall(C_Item.RequestLoadItemDataByID, id)
      end
      local bucket = GetItemSlotBucket(id)
      if bucket then
        buckets[bucket] = buckets[bucket] or {}
        local name, icon, quality = ItemNameAndIcon(id, nil)
        local owned = ownedPack.byId[id]
        if not owned then
          local nk = NormalizeItemName(name)
          owned = nk and ownedPack.byName[nk]
        end
        buckets[bucket][#buckets[bucket] + 1] = {
          id = id,
          tier = tonumber(tier) or 2,
          name = name,
          icon = icon,
          quality = quality,
          looted = owned ~= nil,
          ownedIlvl = owned and owned.ilvl or nil,
          ownedLink = owned and owned.link or nil,
        }
      end
    end
  end
  local srcRank = { both = 3, raid = 2, mythic = 1 }
  for _, list in pairs(buckets) do
    table.sort(list, function(a, b)
      if a.looted ~= b.looted then
        return a.looted
      end
      if (a.ownedIlvl or 0) ~= (b.ownedIlvl or 0) then
        return (a.ownedIlvl or 0) > (b.ownedIlvl or 0)
      end
      if a.tier ~= b.tier then
        return a.tier > b.tier
      end
      local sa, sb = srcRank[a.source] or 0, srcRank[b.source] or 0
      if sa ~= sb then
        return sa > sb
      end
      return a.id < b.id
    end)
  end

  local display = {}
  display.HEAD = buckets.HEAD
  display.NECK = buckets.NECK
  display.SHOULDER = buckets.SHOULDER
  display.BACK = buckets.BACK
  display.CHEST = buckets.CHEST
  display.WRIST = buckets.WRIST
  display.HANDS = buckets.HANDS
  display.WAIST = buckets.WAIST
  display.LEGS = buckets.LEGS
  display.FEET = buckets.FEET

  local rings = buckets.FINGER or {}
  display.FINGER1 = rings[1] and { rings[1] } or nil
  display.FINGER2 = rings[2] and { rings[2] } or nil
  if #rings > 2 and display.FINGER1 then
    for i = 3, #rings do
      display.FINGER1[#display.FINGER1 + 1] = rings[i]
    end
  end

  local trink = buckets.TRINKET or {}
  display.TRINKET1 = trink[1] and { trink[1] } or nil
  display.TRINKET2 = trink[2] and { trink[2] } or nil
  if #trink > 2 and display.TRINKET1 then
    for i = 3, #trink do
      display.TRINKET1[#display.TRINKET1 + 1] = trink[i]
    end
  end

  local mh = buckets.MAINHAND or {}
  local oh = buckets.OFFHAND or {}
  local weap = buckets.WEAPON or {}
  local twoHand = false
  for i = 1, #mh do
    if ItemIsTwoHand(mh[i].id) then
      twoHand = true
      break
    end
  end
  for i = 1, #weap do
    if ItemIsTwoHand(weap[i].id) then
      twoHand = true
      mh[#mh + 1] = weap[i]
    elseif not twoHand and not mh[1] then
      mh[#mh + 1] = weap[i]
    elseif not twoHand then
      oh[#oh + 1] = weap[i]
    end
  end
  if not twoHand and gear and gear.byKey and gear.byKey.MAINHAND and gear.byKey.MAINHAND.id then
    if ItemIsTwoHand(gear.byKey.MAINHAND.id) then
      twoHand = true
    end
  end
  display.MAINHAND = mh[1] and mh or nil
  -- 2H = pas d'off-hand (sinon sac / 1H orphelin)
  if twoHand then
    display.OFFHAND = nil
  else
    display.OFFHAND = oh[1] and oh or nil
  end
  return display
end

local function QualityBorder(q)
  q = tonumber(q) or 4
  if q >= 5 then return 1.00, 0.62, 0.08 end
  if q == 4 then return 0.64, 0.21, 0.93 end
  if q == 3 then return 0.20, 0.58, 1.00 end
  if q == 2 then return 0.25, 1.00, 0.30 end
  if q == 1 then return 0.95, 0.95, 0.95 end
  return 0.62, 0.62, 0.62
end

-- Midnight S2 : piste Myth rang max (KeystoneLoot greatvault / raid mythic last)
local MYTH_MAX_ILVL = 344
local MYTH_MAX_TRACK_BONUS = 12854
local MYTH_EPIC_BONUS = 1674
local MYTH_JEWEL_BONUS = 13534
local mythLinkCache = {}

local function ItemLevelDeltaBonus(delta)
  if type(delta) ~= "number" then
    return nil
  end
  local ok, d = pcall(function()
    return math.floor(delta + 0.5)
  end)
  if not ok or type(d) ~= "number" then
    return nil
  end
  if d >= 1 and d <= 200 then
    return 1472 + d
  end
  if d >= 201 and d <= 400 then
    return 3130 + (d - 201)
  end
  if d >= 601 and d <= 900 then
    return 11341 + (d - 601)
  end
  return nil
end

local function GetBaseItemLevel(itemID)
  if C_Item and C_Item.GetDetailedItemLevelInfo then
    local ok, a, b, c = pcall(C_Item.GetDetailedItemLevelInfo, itemID)
    if ok then
      local n = PlainNumber(c) or PlainNumber(a)
      if n then
        return n
      end
    end
  end
  if GetDetailedItemLevelInfo then
    local ok, ilvl = pcall(GetDetailedItemLevelInfo, itemID)
    if ok then
      return PlainNumber(ilvl)
    end
  end
  return nil
end

-- Lien "Myth max" pour TryOn / tooltip (pas l'ID de base BFA)
local function BuildMythMaxItemLink(itemID)
  itemID = PlainNumber(itemID) or tonumber(itemID)
  if not itemID then
    return nil
  end
  if mythLinkCache[itemID] then
    return mythLinkCache[itemID]
  end
  local bonuses = {}
  local base = GetBaseItemLevel(itemID)
  if type(base) == "number" then
    local ok, diff = pcall(function()
      return MYTH_MAX_ILVL - base
    end)
    if ok then
      local levelBonus = ItemLevelDeltaBonus(diff)
      if levelBonus then
        bonuses[#bonuses + 1] = levelBonus
      end
    end
  end
  bonuses[#bonuses + 1] = MYTH_MAX_TRACK_BONUS
  bonuses[#bonuses + 1] = MYTH_EPIC_BONUS
  local equipLoc
  if C_Item and C_Item.GetItemInfoInstant then
    local ok, _, _, _, loc = pcall(C_Item.GetItemInfoInstant, itemID)
    if ok then
      equipLoc = PlainString(loc)
    end
  end
  if not equipLoc and GetItemInfoInstant then
    local ok, loc = pcall(function()
      local _, _, _, _, _, _, _, _, el = GetItemInfoInstant(itemID)
      return el
    end)
    if ok then
      equipLoc = PlainString(loc)
    end
  end
  if equipLoc == "INVTYPE_FINGER" or equipLoc == "INVTYPE_NECK" then
    bonuses[#bonuses + 1] = MYTH_JEWEL_BONUS
  end
  local specId = GetLootSpecId() or GetActiveTalentSpecId() or 0
  local level = 80
  if UnitLevel then
    local okL, lv = pcall(UnitLevel, "player")
    if okL and type(lv) == "number" and not IsSecretVal(lv) and lv > 0 then
      level = lv
    end
  end
  local link = string.format(
    "item:%d::::::::%d:%d:::%d:%s",
    itemID,
    level,
    specId,
    #bonuses,
    table.concat(bonuses, ":")
  )
  mythLinkCache[itemID] = link
  return link
end

local function StyleSlotCell(cell, thick, r, g, b, a, empty)
  if not cell or not cell.SetBackdrop then
    return
  end
  if empty then
    cell:SetBackdrop({
      bgFile = "Interface\\Buttons\\WHITE8x8",
    })
    cell:SetBackdropColor(0, 0, 0, 1)
    if cell.Label then
      cell.Label:Hide()
    end
    return
  end
  cell:SetBackdrop({
    bgFile = "Interface\\Buttons\\WHITE8x8",
    edgeFile = "Interface\\Buttons\\WHITE8x8",
    edgeSize = thick and 5 or 1,
  })
  cell:SetBackdropColor(0.10, 0.11, 0.14, 0.95)
  cell:SetBackdropBorderColor(r or 0.22, g or 0.24, b or 0.28, a or 0.55)
  if cell.Label then
    cell.Label:Show()
  end
end

RefreshSlotBoard = function()
  if JL.RefreshCollection then
    return JL.RefreshCollection()
  end
  if not slotBoard or not slotBoard:IsShown() then
    return
  end
  EnsureBisTables()
  SanitizeBisLists()
  if type(db.lootedItems) ~= "table" then
    db.lootedItems = {}
  end
  local specIds = ListBoardSpecIds()
  if slotBoard.Prev then
    slotBoard.Prev:Show()
    slotBoard.Next:Show()
  end
  if #specIds == 0 then
    slotBoardSpecIndex = 1
    slotBoard.Title:SetText("No spec imported")
    slotBoard.Sub:SetText("Import Gear for your current spec")
    if slotBoard.ImportBtn then
      local sid = GetLootSpecId() or GetActiveTalentSpecId()
      local label = sid and GetSpecName(sid) or "Gear"
      slotBoard.ImportBtn:SetText("Import Gear — " .. label)
    end
    for _, cell in ipairs(slotBoard.Cells or {}) do
      cell.Icon:Hide()
      cell.Check:Hide()
      if cell.Ilvl then
        cell.Ilvl:Hide()
        cell.Ilvl:SetText("")
      end
      cell.More:SetText("")
      StyleSlotCell(cell, false, nil, nil, nil, nil, true)
      cell.itemID = nil
      cell.mythLink = nil
      cell.items = nil
    end
    if slotBoard.RefreshModel then
      slotBoard.RefreshModel()
    end
    return
  end
  if slotBoardSpecIndex > #specIds then
    slotBoardSpecIndex = 1
  end
  if slotBoardSpecIndex < 1 then
    slotBoardSpecIndex = #specIds
  end
  local specId = specIds[slotBoardSpecIndex]
  slotBoard.Title:SetText(GetSpecName(specId))
  if slotBoard.ImportBtn then
    slotBoard.ImportBtn:SetText("Import Gear — " .. GetSpecName(specId))
  end
  local filled, looted = 0, 0
  local gear = SnapshotPlayerGear()
  local display = BuildDisplaySlots(specId, gear)
  for _, cell in ipairs(slotBoard.Cells or {}) do
    local list = display[cell.slotKey]
    cell.items = list
    if type(list) == "table" and list[1] then
      local it = list[1]
      cell.itemID = it.id
      cell.mythLink = BuildMythMaxItemLink(it.id)
      cell.ownedLink = it.ownedLink
      cell.ownedIlvl = it.ownedIlvl
      local icon = it.icon or 134400
      cell.Icon:SetTexture(icon)
      cell.Icon:Show()
      local anyLoot = false
      local qOwned = it.quality
      for i = 1, #list do
        if list[i].looted then
          anyLoot = true
          qOwned = list[i].quality or qOwned
          break
        end
      end
      if anyLoot then
        cell.Check:Hide()
        local r, g, b = QualityBorder(qOwned)
        StyleSlotCell(cell, true, r, g, b, 1)
        local ilvl = cell.ownedIlvl or it.ownedIlvl
        if cell.Ilvl then
          if ilvl then
            cell.Ilvl:SetText(tostring(ilvl))
            cell.Ilvl:SetTextColor(r, g, b, 1)
            cell.Ilvl:Show()
          else
            cell.Ilvl:SetText("")
            cell.Ilvl:Hide()
            cell.Check:Show()
          end
        else
          cell.Check:Show()
        end
        looted = looted + 1
      else
        cell.Check:Hide()
        if cell.Ilvl then
          cell.Ilvl:SetText("")
          cell.Ilvl:Hide()
        end
        StyleSlotCell(cell, false, 0.32, 0.33, 0.36, 0.95)
      end
      if #list > 1 then
        cell.More:SetText("+" .. tostring(#list - 1))
      else
        cell.More:SetText("")
      end
      filled = filled + 1
    else
      cell.itemID = nil
      cell.mythLink = nil
      cell.ownedLink = nil
      cell.ownedIlvl = nil
      cell.Icon:Hide()
      cell.Check:Hide()
      if cell.Ilvl then
        cell.Ilvl:Hide()
        cell.Ilvl:SetText("")
      end
      cell.More:SetText("")
      StyleSlotCell(cell, false, nil, nil, nil, nil, true)
    end
  end
  local nav = string.format("  %d/%d", slotBoardSpecIndex, #specIds)
  slotBoard.Sub:SetText(string.format("%d slots  ·  %d yours%s", filled, looted, nav))
  if slotBoard.Prev then
    slotBoard.Prev:Show()
    slotBoard.Next:Show()
  end
  if slotBoard.RefreshModel then
    slotBoard.RefreshModel()
  end
end

local function ShowSlotItemTip(owner)
  GameTooltip:SetOwner(owner, "ANCHOR_RIGHT")
  GameTooltip:ClearLines()
  if type(owner.items) ~= "table" or not owner.items[1] or not owner.itemID then
    GameTooltip:AddLine(SLOT_LABEL[owner.slotKey] or owner.slotKey, 0.95, 0.82, 0.35)
    GameTooltip:AddLine("Empty — nothing imported", 0.55, 0.58, 0.62)
    GameTooltip:Show()
    return
  end
  local id = owner.itemID
  local myth = owner.mythLink or BuildMythMaxItemLink(id)
  local showLink = owner.ownedLink or myth
  local ok = false
  if showLink and GameTooltip.SetHyperlink then
    ok = pcall(GameTooltip.SetHyperlink, GameTooltip, showLink)
  end
  if (not ok or not GameTooltip:IsShown()) and GameTooltip.SetItemByID then
    ok = pcall(GameTooltip.SetItemByID, GameTooltip, id)
  end
  if (not ok or not GameTooltip:IsShown()) and GameTooltip.SetHyperlink then
    ok = pcall(GameTooltip.SetHyperlink, GameTooltip, "item:" .. tostring(id))
  end
  if not ok or not GameTooltip:IsShown() then
    GameTooltip:AddLine(owner.items[1].name or ("Item " .. tostring(id)), 1, 1, 1)
  end
  if JL.AddItemSourceToTooltip then
    JL.AddItemSourceToTooltip(id, false)
  end
  GameTooltip:AddLine("Right-click: remove from this spec", 0.50, 0.52, 0.56)
  if owner.items[1].looted then
    local ilvl = owner.ownedIlvl or owner.items[1].ownedIlvl
    if ilvl then
      GameTooltip:AddLine("You have this — ilvl " .. tostring(ilvl), 0.30, 1.00, 0.45)
    else
      GameTooltip:AddLine("You have this item", 0.30, 1.00, 0.45)
    end
  end
  if #owner.items > 1 then
    GameTooltip:AddLine(" ")
    GameTooltip:AddLine("Other imported:", 0.95, 0.82, 0.35)
    for i = 2, #owner.items do
      local it = owner.items[i]
      local tag = it.looted and "  |cff40d866YOURS|r" or ""
      GameTooltip:AddLine((it.name or ("Item " .. tostring(it.id))) .. tag, 0.80, 0.82, 0.86)
    end
  end
  GameTooltip:Show()
end

OpenSlotBoard = function()
  if JL.OpenCollection then
    return JL.OpenCollection()
  end
  if slotBoard then
    slotBoard:Show()
    RefreshSlotBoard()
    return
  end

  local CELL = 38
  local GAP = 6
  local LAB = 11
  local padX, padTop, padBot = 12, 76, 56
  local modelW = 210
  local step = CELL + LAB + 2
  local colH = #SLOT_RIGHT * step
  local w = padX + CELL + GAP + modelW + GAP + CELL + padX
  local h = padTop + colH + GAP + CELL + LAB + padBot

  local f = CreateFrame("Frame", "JicksLootSlotBoard", UIParent, "BackdropTemplate")
  f:SetSize(w, h)
  f:SetPoint("CENTER", 180, 20)
  f:SetFrameStrata("DIALOG")
  f:SetMovable(true)
  f:EnableMouse(true)
  f:SetClampedToScreen(true)
  f:SetBackdrop({
    bgFile = "Interface\\Buttons\\WHITE8x8",
    edgeFile = "Interface\\Buttons\\WHITE8x8",
    edgeSize = 1,
  })
  f:SetBackdropColor(0.07, 0.08, 0.11, 0.96)
  f:SetBackdropBorderColor(0.85, 0.70, 0.25, 0.9)
  tinsert(UISpecialFrames, "JicksLootSlotBoard")

  local bar = CreateFrame("Frame", nil, f, "BackdropTemplate")
  bar:SetPoint("TOPLEFT", 1, -1)
  bar:SetPoint("TOPRIGHT", -1, -1)
  bar:SetHeight(40)
  bar:SetFrameLevel((f:GetFrameLevel() or 1) + 20)
  bar:SetBackdrop({ bgFile = "Interface\\Buttons\\WHITE8x8" })
  bar:SetBackdropColor(0.10, 0.08, 0.04, 1)
  bar:EnableMouse(true)
  bar:RegisterForDrag("LeftButton")
  bar:SetScript("OnDragStart", function()
    f:StartMoving()
  end)
  bar:SetScript("OnDragStop", function()
    f:StopMovingOrSizing()
    if importFrame and importFrame:IsShown() then
      PlaceImportNextToGrid(importFrame)
    end
  end)

  local gold = bar:CreateTexture(nil, "OVERLAY")
  gold:SetPoint("BOTTOMLEFT", 0, 0)
  gold:SetPoint("BOTTOMRIGHT", 0, 0)
  gold:SetHeight(2)
  gold:SetColorTexture(0.85, 0.70, 0.28, 0.95)

  local brand = bar:CreateFontString(nil, "OVERLAY")
  brand:SetFont(STANDARD_TEXT_FONT, 14, "OUTLINE")
  brand:SetPoint("LEFT", 12, 1)
  brand:SetTextColor(0.95, 0.82, 0.35, 1)
  brand:SetText("JicksLoots")

  local title = bar:CreateFontString(nil, "OVERLAY")
  title:SetFont(STANDARD_TEXT_FONT, 13, "OUTLINE")
  title:SetPoint("CENTER", 0, 1)
  title:SetTextColor(0.92, 0.90, 0.86, 1)
  title:SetText("Spec")
  f.Title = title

  local sub = f:CreateFontString(nil, "OVERLAY")
  sub:SetFont(STANDARD_TEXT_FONT, 10, "")
  sub:SetPoint("TOP", bar, "BOTTOM", 0, -4)
  sub:SetTextColor(0.62, 0.65, 0.70, 1)
  sub:SetText("")
  f.Sub = sub

  local function MakeNavBtn(dir)
    local b = CreateFrame("Button", nil, bar)
    b:SetSize(28, 28)
    b:SetFrameLevel((bar:GetFrameLevel() or 1) + 12)
    b:RegisterForClicks("AnyUp")
    b:EnableMouse(true)
    local fs = b:CreateFontString(nil, "OVERLAY")
    fs:SetFont(STANDARD_TEXT_FONT, 18, "OUTLINE")
    fs:SetPoint("CENTER", 0, 1)
    fs:SetTextColor(0.95, 0.82, 0.35, 1)
    fs:SetText(dir < 0 and "<" or ">")
    b.Label = fs
    b:SetScript("OnEnter", function(self)
      if self.Label then
        self.Label:SetTextColor(1, 0.95, 0.70, 1)
      end
      GameTooltip:SetOwner(self, "ANCHOR_BOTTOM")
      GameTooltip:SetText(dir < 0 and "Previous spec" or "Next spec", 1, 0.90, 0.55)
      GameTooltip:Show()
    end)
    b:SetScript("OnLeave", function(self)
      if self.Label then
        self.Label:SetTextColor(0.95, 0.82, 0.35, 1)
      end
      GameTooltip:Hide()
    end)
    b:SetScript("OnClick", function()
      StepSlotSpec(dir)
    end)
    b:Show()
    return b
  end

  local prev = MakeNavBtn(-1)
  prev:SetPoint("RIGHT", title, "LEFT", -8, 0)
  f.Prev = prev

  local nxt = MakeNavBtn(1)
  nxt:SetPoint("LEFT", title, "RIGHT", 8, 0)
  f.Next = nxt

  local close = CreateFrame("Button", nil, f)
  close:SetSize(22, 22)
  close:SetFrameLevel((bar:GetFrameLevel() or 1) + 8)
  close:SetPoint("TOPRIGHT", -6, -9)
  close:SetNormalFontObject("GameFontHighlight")
  close:SetText("x")
  close:EnableMouse(true)
  close:SetScript("OnClick", function()
    f:Hide()
  end)

  -- Modele 3D au centre (glisser pour tourner)
  local model
  local okDress, dress = pcall(CreateFrame, "DressUpModel", "JicksLootDressModel", f)
  if okDress and dress then
    model = dress
  else
    model = CreateFrame("PlayerModel", "JicksLootPlayerModel", f)
  end
  model:SetPoint("TOPLEFT", padX + CELL + GAP, -padTop)
  model:SetPoint("BOTTOMRIGHT", -(padX + CELL + GAP), padBot + CELL + LAB + GAP)
  model:EnableMouse(true)
  f.Model = model

  local lastDressSig = nil
  local function ResetModel(force)
    pcall(function()
      if f._modelReady and not force then
        return
      end
      -- Pas de ClearModel: ca fait flicker
      model:SetUnit("player")
      if model.SetCamDistanceScale then
        model:SetCamDistanceScale(1.08)
      end
      if model.SetPortraitZoom then
        model:SetPortraitZoom(0)
      end
      if model.SetPosition then
        model:SetPosition(0, 0, -0.06)
      end
      if model.SetFacing then
        model:SetFacing(0.35)
      end
      f._modelReady = true
    end)
  end

  f.RefreshModel = function(force)
    local parts = {}
    for _, cell in ipairs(f.Cells or {}) do
      if cell.itemID and ItemCanDressOnModel(cell.itemID) then
        parts[#parts + 1] = tostring(cell.itemID)
      end
    end
    table.sort(parts)
    local sig = table.concat(parts, ",")
    if not force and sig == lastDressSig and f._modelReady then
      return
    end
    lastDressSig = sig
    ResetModel(force)
    if sig == "" or not model.TryOn then
      return
    end
    pcall(function()
      if model.Undress then
        model:Undress()
      end
      for _, cell in ipairs(f.Cells or {}) do
        if cell.itemID and ItemCanDressOnModel(cell.itemID) then
          local link = cell.ownedLink or cell.mythLink
          if link then
            pcall(model.TryOn, model, link)
          end
        end
      end
    end)
  end

  local rot = { on = false, x = 0, facing = 0 }
  model:SetScript("OnMouseDown", function(self, btn)
    if btn == "LeftButton" then
      rot.on = true
      rot.x = GetCursorPosition()
      local okF, facing = pcall(self.GetFacing, self)
      rot.facing = (okF and type(facing) == "number") and facing or 0
    elseif btn == "RightButton" then
      lastDressSig = nil
      f.RefreshModel(true)
    end
  end)
  model:SetScript("OnMouseUp", function()
    rot.on = false
  end)
  model:SetScript("OnHide", function()
    rot.on = false
  end)
  model:SetScript("OnUpdate", function(self)
    if not rot.on then
      return
    end
    local x = GetCursorPosition()
    local scale = self:GetEffectiveScale() or 1
    local dx = (x - rot.x) / scale
    pcall(self.SetFacing, self, rot.facing + dx * 0.025)
  end)

  f.Cells = {}
  local function MakeCell(key, point, rel, relPoint, dx, dy)
    local cell = CreateFrame("Frame", nil, f, "BackdropTemplate")
    cell:SetSize(CELL, CELL)
    cell:SetPoint(point, rel, relPoint, dx, dy)
    cell:SetBackdrop({
      bgFile = "Interface\\Buttons\\WHITE8x8",
      edgeFile = "Interface\\Buttons\\WHITE8x8",
      edgeSize = 1,
    })
    cell:SetBackdropColor(0.10, 0.11, 0.14, 0.95)
    cell:SetBackdropBorderColor(0.22, 0.24, 0.28, 0.55)
    cell:EnableMouse(true)
    cell.slotKey = key

    local icon = cell:CreateTexture(nil, "ARTWORK")
    icon:SetPoint("TOPLEFT", 2, -2)
    icon:SetPoint("BOTTOMRIGHT", -2, 2)
    icon:SetTexCoord(0.08, 0.92, 0.08, 0.92)
    icon:Hide()
    cell.Icon = icon

    local check = cell:CreateFontString(nil, "OVERLAY")
    check:SetFont(STANDARD_TEXT_FONT, 9, "OUTLINE")
    check:SetPoint("BOTTOMRIGHT", -1, 1)
    check:SetTextColor(0.30, 1.00, 0.45, 1)
    check:SetText("OK")
    check:Hide()
    cell.Check = check

    local more = cell:CreateFontString(nil, "OVERLAY")
    more:SetFont(STANDARD_TEXT_FONT, 8, "OUTLINE")
    more:SetPoint("TOPRIGHT", -1, 0)
    more:SetTextColor(0.95, 0.85, 0.40, 1)
    more:SetText("")
    cell.More = more

    local ilvlFS = cell:CreateFontString(nil, "OVERLAY")
    ilvlFS:SetFont(STANDARD_TEXT_FONT, 9, "OUTLINE")
    ilvlFS:SetPoint("BOTTOM", 0, 1)
    ilvlFS:SetTextColor(1, 1, 1, 1)
    ilvlFS:SetText("")
    ilvlFS:Hide()
    cell.Ilvl = ilvlFS

    local lab = f:CreateFontString(nil, "OVERLAY")
    lab:SetFont(STANDARD_TEXT_FONT, 8, "")
    lab:SetPoint("TOP", cell, "BOTTOM", 0, -1)
    lab:SetTextColor(0.55, 0.58, 0.62, 1)
    lab:SetText(SLOT_LABEL[key] or key)
    cell.Label = lab

    cell:SetScript("OnEnter", function(self)
      ShowSlotItemTip(self)
    end)
    cell:SetScript("OnLeave", function()
      GameTooltip:Hide()
    end)
    cell:SetScript("OnMouseUp", function(self, btn)
      if not self.itemID then
        return
      end
      if btn == "RightButton" then
        local sid = GetViewedSpecId and GetViewedSpecId()
        if sid and RemoveImportedItem(sid, self.itemID) then
          Print("removed from " .. GetSpecName(sid))
          RefreshSlotBoard()
        end
        return
      end
      if btn ~= "LeftButton" then
        return
      end
      if IsShiftKeyDown and IsShiftKeyDown() then
        local link
        if C_Item and C_Item.GetItemLinkByID then
          local ok, l = pcall(C_Item.GetItemLinkByID, self.itemID)
          if ok then
            link = PlainString(l)
          end
        end
        if not link and GetItemInfo then
          local ok, _, l = pcall(GetItemInfo, self.itemID)
          if ok then
            link = PlainString(l)
          end
        end
        if link and ChatEdit_InsertLink then
          pcall(ChatEdit_InsertLink, link)
        end
      end
    end)

    f.Cells[#f.Cells + 1] = cell
    return cell
  end

  for i, key in ipairs(SLOT_LEFT) do
    MakeCell(key, "TOPLEFT", f, "TOPLEFT", padX, -(padTop + (i - 1) * step))
  end
  for i, key in ipairs(SLOT_RIGHT) do
    MakeCell(key, "TOPRIGHT", f, "TOPRIGHT", -padX, -(padTop + (i - 1) * step))
  end
  local botY = padBot + LAB
  MakeCell(SLOT_BOTTOM[1], "BOTTOM", f, "BOTTOM", -(CELL / 2 + 4), botY)
  MakeCell(SLOT_BOTTOM[2], "BOTTOM", f, "BOTTOM", (CELL / 2 + 4), botY)

  local importBtn = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
  importBtn:SetSize(168, 22)
  importBtn:SetPoint("BOTTOM", 0, 10)
  importBtn:SetText("Import Gear")
  importBtn:SetScript("OnClick", function()
    local sid = GetViewedSpecId and GetViewedSpecId()
    if not sid or sid == 0 then
      Print("no spec selected — import your current loot spec")
      sid = GetLootSpecId() or GetActiveTalentSpecId()
    end
    if OpenBisImportUI then
      OpenBisImportUI(sid)
    end
  end)
  f.ImportBtn = importBtn

  local hint = f:CreateFontString(nil, "OVERLAY")
  hint:SetFont(STANDARD_TEXT_FONT, 9, "")
  hint:SetPoint("BOTTOM", importBtn, "TOP", 0, 3)
  hint:SetTextColor(0.48, 0.50, 0.54, 1)
  hint:SetText("drag model to rotate   ·   OK = you received it")

  slotBoard = f
  local specIds = ListBoardSpecIds()
  local lootSpec = GetLootSpecId()
  if lootSpec then
    for i = 1, #specIds do
      if specIds[i] == lootSpec then
        slotBoardSpecIndex = i
        break
      end
    end
  end
  f:Show()
  RefreshSlotBoard()
end

local function FormatItemLabel(data)
  local name = data.name or "?"
  -- Strip codes couleur eventuels (link / autre) pour recolorer proprement
  if type(name) == "string" then
    name = name:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|cnIQ%d+:", ""):gsub("|r", "")
  end
  local ilvl = PlainNumber(data.ilvl)
  if ilvl then
    -- ilvl en gris separe, sans casser la couleur du nom
    return name .. "|r  |cff9aa0a6" .. tostring(ilvl)
  end
  return name
end

-- Qualite affichee: couleur du link d'abord, puis qualite stockee. Pas d'ilvl.
local function ResolveDisplayQuality(data)
  if not data then
    return 3
  end
  local q = QualityFromLink(data.link) or PlainNumber(data.quality)
  if not q then
    return 3 -- rare par defaut, jamais epic au pif
  end
  return q
end

local function QualityHex(q)
  q = tonumber(q) or 3
  -- Couleurs Blizzard fixes (fiables, meme si ITEM_QUALITY_COLORS change)
  if q >= 5 then return "|cffff8000" end -- legendary
  if q == 4 then return "|cffa335ee" end -- epic (mauve)
  if q == 3 then return "|cff0070dd" end -- rare (bleu)
  if q == 2 then return "|cff1eff00" end -- uncommon
  if q == 1 then return "|cffffffff" end
  if q == 0 then return "|cff9d9d9d" end
  if type(ITEM_QUALITY_COLORS) == "table" and ITEM_QUALITY_COLORS[q] then
    local c = ITEM_QUALITY_COLORS[q]
    if c.hex then
      local h = c.hex
      if type(h) == "string" then
        if h:sub(1, 2) == "|c" then
          return h
        end
        return "|c" .. h
      end
    end
    if c.color and c.color.GenerateHexColor then
      local ok, h = pcall(function()
        return c.color:GenerateHexColor()
      end)
      if ok and type(h) == "string" then
        if h:sub(1, 2) == "|c" then
          return h
        end
        return "|c" .. h
      end
    end
  end
  return "|cffa335ee" -- default epic
end

local function EncounterTitle(encounterID)
  if session.bossName then
    return session.bossName
  end
  encounterID = PlainNumber(encounterID)
  if encounterID and EJ_GetEncounterInfo then
    local ok, n = pcall(EJ_GetEncounterInfo, encounterID)
    if ok then
      n = PlainString(n)
      if n then
        return n
      end
    end
  end
  return "Boss loot"
end

-- ─── UI ─────────────────────────────────────────────────────

local frame

local function SavePos()
  if not frame or not db then
    return
  end
  local p, _, _, x, y = frame:GetPoint(1)
  if type(p) == "string" then
    db.point = p
    db.x = x or 0
    db.y = y or 0
  end
end

local function PlaceFrame()
  if not frame then
    return
  end
  frame:ClearAllPoints()
  frame:SetPoint(db.point or "CENTER", UIParent, db.point or "CENTER", db.x or 0, db.y or 140)
end

local function ShowItemTip(owner)
  local link = owner.itemLink
  local id = owner.itemID
  if type(id) == "number" and IsSecretVal(id) then
    id = nil
  end
  -- Garder le link secret : SetHyperlink affiche la vraie version (ilvl S2)
  if not link and not id then
    return
  end
  GameTooltip:SetOwner(owner, "ANCHOR_CURSOR")
  local ok = false
  if link then
    ok = pcall(GameTooltip.SetHyperlink, GameTooltip, link)
  end
  if (not ok or not GameTooltip:IsShown()) and id then
    if GameTooltip.SetItemByID then
      ok = pcall(GameTooltip.SetItemByID, GameTooltip, id)
    end
    if not ok then
      pcall(GameTooltip.SetHyperlink, GameTooltip, "item:" .. id)
    end
  end
  GameTooltip:Show()
end

local function EnsureRow(i)
  if rows[i] then
    return rows[i]
  end
  -- Ligne = décor seulement (pas de souris) — le hitbox est sur le nom d'item
  local r = CreateFrame("Frame", nil, frame)
  r:SetHeight(ROW_H)
  r:SetPoint("TOPLEFT", PAD_X, -36 - (i - 1) * (ROW_H + 2))
  r:SetPoint("TOPRIGHT", -PAD_X, -36 - (i - 1) * (ROW_H + 2))
  r:EnableMouse(false)

  local bg = r:CreateTexture(nil, "BACKGROUND")
  bg:SetAllPoints()
  bg:SetColorTexture(1, 1, 1, i % 2 == 0 and 0.03 or 0.06)
  r.Bg = bg

  local icon = r:CreateTexture(nil, "ARTWORK")
  icon:SetSize(ICON_W, ICON_W)
  icon:SetPoint("LEFT", 2, 0)
  r.Icon = icon

  local who = r:CreateFontString(nil, "OVERLAY")
  who:SetFont(STANDARD_TEXT_FONT, 12, "OUTLINE")
  who:SetPoint("RIGHT", -4, 0)
  who:SetWidth(WHO_MIN)
  who:SetJustifyH("RIGHT")
  who:SetWordWrap(false)
  r.Who = who

  -- Bulle de chat à gauche du nom du joueur → whisper
  local chat = CreateFrame("Button", nil, r)
  chat:SetSize(CHAT_W, CHAT_W)
  chat:SetPoint("RIGHT", who, "LEFT", -CHAT_GAP, 0)
  chat:EnableMouse(true)
  chat:RegisterForClicks("LeftButtonUp")
  chat:SetFrameLevel((r:GetFrameLevel() or 1) + 3)
  local chatTex = chat:CreateTexture(nil, "ARTWORK")
  chatTex:SetAllPoints()
  chatTex:SetTexture("Interface\\ChatFrame\\UI-ChatIcon-Chat-Up")
  chatTex:SetVertexColor(0.75, 0.85, 1.0, 1)
  chat.Icon = chatTex
  r.ChatBtn = chat

  chat:SetScript("OnEnter", function(self)
    GameTooltip:SetOwner(self, "ANCHOR_TOP")
    GameTooltip:AddLine("Whisper", 0.95, 0.82, 0.35)
    GameTooltip:AddLine("Ask if they need the item", 0.85, 0.85, 0.88, true)
    if self.playerFull then
      local to = NormalizeWhisperTarget(self.playerFull) or self.playerFull
      GameTooltip:AddLine("To: " .. to, 0.55, 0.75, 1)
      if to:find("%-") then
        GameTooltip:AddLine("Other realm (Name-Realm)", 0.45, 0.55, 0.50)
      end
    end
    GameTooltip:Show()
    if self.Icon then
      self.Icon:SetVertexColor(1, 1, 1, 1)
    end
  end)
  chat:SetScript("OnLeave", function(self)
    GameTooltip:Hide()
    if self.Icon then
      self.Icon:SetVertexColor(0.75, 0.85, 1.0, 1)
    end
  end)
  chat:SetScript("OnClick", function(self)
    SendPassWhisper(self.playerFull, self.itemLink, self.itemName)
  end)

  local item = r:CreateFontString(nil, "OVERLAY")
  item:SetFont(STANDARD_TEXT_FONT, 12, "OUTLINE")
  item:SetPoint("LEFT", icon, "RIGHT", ICON_GAP, 0)
  item:SetPoint("RIGHT", chat, "LEFT", -COL_GAP, 0)
  item:SetJustifyH("LEFT")
  item:SetWordWrap(false)
  r.Item = item

  -- Zone cliquable / survol = largeur du nom d'item uniquement
  -- Frame (pas Button) = aucune texture par defaut, donc pas de rectangle gris
  local hit = CreateFrame("Frame", nil, r)
  hit:SetPoint("LEFT", icon, "RIGHT", ICON_GAP, 0)
  hit:SetHeight(ROW_H - 2)
  hit:SetWidth(40)
  hit:EnableMouse(true)
  hit:SetFrameLevel((r:GetFrameLevel() or 1) + 2)
  r.ItemHit = hit

  hit:SetScript("OnEnter", function(self)
    ShowItemTip(self)
  end)
  hit:SetScript("OnLeave", function()
    GameTooltip:Hide()
  end)
  hit:SetScript("OnMouseUp", function(self, button)
    if button ~= "LeftButton" then
      return
    end
    if IsModifiedClick("CHATLINK") then
      if self.itemLink and not IsSecretVal(self.itemLink) then
        pcall(ChatEdit_InsertLink, self.itemLink)
      elseif self.itemID then
        local ok, link = pcall(function()
          if C_Item and C_Item.GetItemLinkByID then
            return C_Item.GetItemLinkByID(self.itemID)
          end
          local _, l = GetItemInfo(self.itemID)
          return l
        end)
        if ok and type(link) == "string" then
          pcall(ChatEdit_InsertLink, link)
        end
      end
    end
  end)

  rows[i] = r
  return r
end

local function MeasureFS(fs)
  if not fs then
    return 0
  end
  local ok, w = pcall(function()
    return fs:GetStringWidth()
  end)
  if ok and type(w) == "number" then
    return w
  end
  return 0
end

local function Layout()
  if not frame then
    return
  end
  local n = #session.items
  if n < 1 then
    n = 1
  end
  if n > MAX_ROWS then
    n = MAX_ROWS
  end
  frame:SetHeight(44 + n * (ROW_H + 2) + 8)

  -- Largeur = max requis par les lignes (icone + item + joueur + pads)
  local needW = MIN_WIDTH
  local titleW = MeasureFS(frame.Title) + 50 -- titre + bouton close
  if titleW > needW then
    needW = titleW
  end
  local hintW = MeasureFS(frame.Hint) + PAD_X * 2
  if hintW > needW then
    needW = hintW
  end

  for i = 1, n do
    local r = rows[i]
    if r and r:IsShown() then
      local whoW = MeasureFS(r.Who) + 6
      if whoW < WHO_MIN then
        whoW = WHO_MIN
      end
      if whoW > WHO_MAX then
        whoW = WHO_MAX
      end
      r.Who:SetWidth(whoW)

      local itemW = MeasureFS(r.Item)
      local chatExtra = (r.ChatBtn and r.ChatBtn:IsShown()) and (CHAT_W + CHAT_GAP) or 0
      -- icon + gaps + item + chat + who + pads
      local rowNeed = PAD_X * 2 + 2 + ICON_W + ICON_GAP + itemW + COL_GAP + chatExtra + whoW + 8
      if rowNeed > needW then
        needW = rowNeed
      end
    end
  end

  if needW < MIN_WIDTH then
    needW = MIN_WIDTH
  end
  if needW > MAX_WIDTH then
    needW = MAX_WIDTH
  end
  frame:SetWidth(needW)
end

function Refresh()
  if not frame then
    return
  end
  if frame.Title then
    local nBis = CountBis()
    local base = session.title or "Boss loot"
    if nBis > 0 then
      frame.Title:SetText(base .. "  |cff88cc88(" .. nBis .. " BiS)|r")
    else
      frame.Title:SetText(base)
    end
  end
  for i = 1, MAX_ROWS do
    local data = session.items[i]
    local r = EnsureRow(i)
    if data then
      r:Show()
      if data.icon then
        r.Icon:SetTexture(data.icon)
      else
        r.Icon:SetTexture("Interface\\Icons\\INV_Misc_QuestionMark")
      end
      local qShow = ResolveDisplayQuality(data)
      data.quality = qShow -- corrige si l'API ID / link BFA avait mis rare (bleu)
      local hex = QualityHex(qShow)
      -- Base blanche: les |c du texte pilotent la couleur (evite teinte residuelle)
      r.Item:SetTextColor(1, 1, 1, 1)
      local matches = GetBisMatches(data.itemID)
      if #matches > 0 then
        -- Couleur de fond = spé prioritaire (meilleur tier); tag liste les specs
        local primary = matches[1]
        local tier = primary.tier
        local forSpec = primary.specId
        local rC, gC, bC, aC = GetSpecBgColor(forSpec)
        r.Bg:SetColorTexture(rC, gC, bC, aC)
        local tag = (tier == TIER_BIS) and "BiS" or (tier == 2 and "Must" or (tier == 1 and "Nice" or "TM"))
        local names = {}
        for _, m in ipairs(matches) do
          if m.specId and m.specId ~= 0 then
            table.insert(names, GetSpecShortName(m.specId))
          end
        end
        local specBit = (#names > 0) and (":" .. table.concat(names, "/")) or ""
        -- [BiS] dore, puis nom en mauve epic, puis ilvl gris
        r.Item:SetText("|cffffd100[" .. tag .. specBit .. "]|r " .. hex .. FormatItemLabel(data) .. "|r")
      else
        r.Bg:SetColorTexture(1, 1, 1, i % 2 == 0 and 0.03 or 0.06)
        r.Item:SetText(hex .. FormatItemLabel(data) .. "|r")
      end
      local rr, gg, bb = ClassRGB(data.class)
      r.Who:SetText(data.player or "?")
      r.Who:SetTextColor(rr, gg, bb, 1)
      -- largeur joueur selon le texte (clamp)
      local whoW = MeasureFS(r.Who) + 6
      if whoW < WHO_MIN then whoW = WHO_MIN end
      if whoW > WHO_MAX then whoW = WHO_MAX end
      r.Who:SetWidth(whoW)

      -- Bulle whisper (cachée si c'est toi)
      if r.ChatBtn then
        local selfLoot = IsSelfPlayer(data.playerFull or data.player)
        r.ChatBtn.playerFull = data.playerFull or data.player
        r.ChatBtn.itemLink = data.link
        r.ChatBtn.itemName = data.name
        if selfLoot then
          r.ChatBtn:Hide()
        else
          r.ChatBtn:Show()
        end
      end

      -- Hitbox = largeur exacte du nom d'item (pas joueur / pas toute la ligne)
      if r.ItemHit then
        r.ItemHit.itemLink = data.link
        r.ItemHit.itemID = data.itemID
        local nameW = MeasureFS(r.Item)
        if nameW < 20 then
          nameW = 20
        end
        local chatExtra = (r.ChatBtn and r.ChatBtn:IsShown()) and (CHAT_W + CHAT_GAP) or 0
        local maxItem = (r:GetWidth() or 200) - ICON_W - ICON_GAP - whoW - COL_GAP - chatExtra - 8
        if maxItem > 20 and nameW > maxItem then
          nameW = maxItem
        end
        r.ItemHit:SetWidth(nameW)
        r.ItemHit:Show()
      end
    else
      r:Hide()
      if r.ItemHit then
        r.ItemHit:Hide()
        r.ItemHit.itemLink = nil
        r.ItemHit.itemID = nil
      end
      if r.ChatBtn then
        r.ChatBtn:Hide()
        r.ChatBtn.playerFull = nil
      end
    end
  end
  Layout()
end

local function ShowBox()
  if not frame then
    return
  end
  Refresh()
  frame:Show()
  session.shown = true
end

local function HideBox()
  if frame then
    frame:Hide()
  end
  session.shown = false
end

local function EnsureFrame()
  if frame then
    return frame
  end

  frame = CreateFrame("Frame", "JicksLootFrame", UIParent, "BackdropTemplate")
  frame:SetSize(MIN_WIDTH, 80)
  frame:SetFrameStrata("HIGH")
  frame:SetClampedToScreen(true)
  frame:SetMovable(true)
  frame:EnableMouse(true)
  frame:SetBackdrop({
    bgFile = "Interface\\Buttons\\WHITE8x8",
    edgeFile = "Interface\\Buttons\\WHITE8x8",
    edgeSize = 1,
    insets = { left = 1, right = 1, top = 1, bottom = 1 },
  })
  frame:SetBackdropColor(0.07, 0.08, 0.11, 0.94)
  frame:SetBackdropBorderColor(0.55, 0.42, 0.18, 0.85)
  PlaceFrame()

  local bar = CreateFrame("Frame", nil, frame, "BackdropTemplate")
  bar:SetPoint("TOPLEFT", 1, -1)
  bar:SetPoint("TOPRIGHT", -1, -1)
  bar:SetHeight(32)
  bar:SetBackdrop({ bgFile = "Interface\\Buttons\\WHITE8x8" })
  bar:SetBackdropColor(0.10, 0.08, 0.04, 1)
  bar:EnableMouse(true)
  bar:SetScript("OnMouseDown", function(_, btn)
    if btn == "LeftButton" then
      frame:StartMoving()
    end
  end)
  bar:SetScript("OnMouseUp", function()
    frame:StopMovingOrSizing()
    SavePos()
  end)

  local gold = bar:CreateTexture(nil, "OVERLAY")
  gold:SetPoint("BOTTOMLEFT", 0, 0)
  gold:SetPoint("BOTTOMRIGHT", 0, 0)
  gold:SetHeight(2)
  gold:SetColorTexture(0.85, 0.70, 0.28, 0.95)

  local brand = bar:CreateFontString(nil, "OVERLAY")
  brand:SetFont(STANDARD_TEXT_FONT, 13, "OUTLINE")
  brand:SetPoint("LEFT", 10, 1)
  brand:SetTextColor(0.95, 0.82, 0.35, 1)
  brand:SetText("JicksLoots")

  local title = bar:CreateFontString(nil, "OVERLAY")
  title:SetFont(STANDARD_TEXT_FONT, 12, "OUTLINE")
  title:SetPoint("LEFT", brand, "RIGHT", 10, 0)
  title:SetTextColor(0.88, 0.86, 0.80, 1)
  title:SetText("Boss loot")
  frame.Title = title

  local close = CreateFrame("Button", nil, bar)
  close:SetSize(20, 20)
  close:SetPoint("RIGHT", -6, 0)
  close:SetNormalFontObject("GameFontHighlight")
  close:SetText("x")
  close:SetScript("OnClick", HideBox)

  local slotsBtn = CreateFrame("Button", nil, bar)
  slotsBtn:SetSize(44, 18)
  slotsBtn:SetPoint("RIGHT", close, "LEFT", -4, 0)
  slotsBtn:SetNormalFontObject("GameFontHighlightSmall")
  slotsBtn:SetText("Slots")
  slotsBtn:SetScript("OnClick", function()
    if OpenSlotBoard then
      OpenSlotBoard()
    end
  end)

  local hint = frame:CreateFontString(nil, "OVERLAY")
  hint:SetFont(STANDARD_TEXT_FONT, 9, "")
  hint:SetPoint("BOTTOMLEFT", 10, 4)
  hint:SetTextColor(0.50, 0.52, 0.56, 1)
  hint:SetText("nom = tooltip  ·  bulle = whisper  ·  [BiS] = wishlist  ·  /jl bis")
  frame.Hint = hint

  frame:Hide()
  return frame
end

local function InLootWindow()
  if session.live then
    return true
  end
  local untilT = session.untilT
  if type(untilT) == "number" and untilT > 0 and GetTime then
    local ok, now = pcall(GetTime)
    if ok and type(now) == "number" and now < untilT then
      return true
    end
  end
  return false
end

local function EncounterIsLive()
  if session.live then
    return true
  end
  if IsEncounterInProgress then
    local ok, live = pcall(IsEncounterInProgress)
    if ok and live then
      return true
    end
  end
  return false
end

-- Donjon (party) ou raid uniquement — pas world / delve / arena / scenario
local function InDungeonOrRaid()
  if not IsInInstance then
    return false
  end
  local ok, inInst, instType = pcall(IsInInstance)
  if not ok or inInst ~= true then
    return false
  end
  instType = PlainString(instType)
  return instType == "party" or instType == "raid"
end

local function InInstanceContent()
  return InDungeonOrRaid()
end

-- On collecte uniquement autour d'un boss, en donjon/raid
local function ShouldCollectLoot()
  if not InDungeonOrRaid() then
    return false
  end
  if InLootWindow() or EncounterIsLive() then
    return true
  end
  return false
end

local function EnsureBossSession(title, encounterID)
  if session.live or InLootWindow() then
    if title and not session.bossName then
      session.bossName = title
      session.title = title
    end
    if encounterID and not session.encounterID then
      session.encounterID = PlainNumber(encounterID)
    end
    return
  end
  NewSession(title or session.bossName or "Boss loot", encounterID)
  session.live = false
end

local function ExtendLootWindow(seconds)
  seconds = seconds or 90
  if not GetTime then
    session.untilT = 1
    return
  end
  local ok, now = pcall(GetTime)
  now = (ok and type(now) == "number") and now or 0
  local untilT = now + seconds
  if type(session.untilT) ~= "number" or untilT > session.untilT then
    session.untilT = untilT
  end
end

local function ClassFileOf(name)
  local want = ShortName(name)
  if not want or want == "?" or not UnitExists or not UnitClass then
    return nil
  end
  local function check(unit)
    if not unit or not UnitExists(unit) then
      return nil
    end
    local ok, n = pcall(UnitName, unit)
    n = ok and PlainString(n) or nil
    if not n then
      return nil
    end
    if ShortName(n) ~= want and n ~= want then
      return nil
    end
    local ok2, _, classFile = pcall(UnitClass, unit)
    if ok2 then
      return PlainString(classFile)
    end
    return nil
  end
  local found = check("player")
  if found then
    return found
  end
  for i = 1, 4 do
    found = check("party" .. i)
    if found then
      return found
    end
  end
  local nRaid = 40
  if GetNumGroupMembers then
    local ok, n = pcall(GetNumGroupMembers)
    if ok and type(n) == "number" and n > 0 then
      nRaid = n
    end
  end
  for i = 1, nRaid do
    found = check("raid" .. i)
    if found then
      return found
    end
  end
  return nil
end

local function ItemIdFromLink(itemLink)
  itemLink = PlainString(itemLink)
  if not itemLink then
    return nil
  end
  return tonumber(itemLink:match("item:(%d+)"))
end

-- Week id matches the archive: Thursday 05:00 Asia/Shanghai (UTC+8).
local function RaidWeekId(ts)
  ts = tonumber(ts)
  if not ts or ts <= 0 then
    ts = (GetServerTime and GetServerTime()) or time()
  end
  local shifted = ts + 3 * 3600
  local t = date("!*t", shifted)
  if type(t) ~= "table" or not t.wday then
    return date("!%Y-%m-%d", ts)
  end
  local back = (t.wday - 5 + 7) % 7
  return date("!%Y-%m-%d", shifted - back * 86400)
end

local function Hash32(s)
  local h = 5381
  s = tostring(s or "")
  for i = 1, #s do
    h = (h * 33 + s:byte(i)) % 4294967296
  end
  return h
end

local function ShortWinner(name)
  name = PlainString(name) or ""
  return name:match("^([^%-]+)") or name
end

local function RaidDiffFromId(id)
  id = tonumber(id)
  if id == 14 then
    return "normal"
  end
  if id == 15 then
    return "heroic"
  end
  if id == 16 then
    return "mythic"
  end
  return nil
end

local function InstanceDiff()
  if not GetInstanceInfo then
    return nil
  end
  local ok, _, _, difficultyID = pcall(GetInstanceInfo)
  if not ok then
    return nil
  end
  return RaidDiffFromId(difficultyID)
end

local function SetSessionDiff(difficultyID)
  session.diff = RaidDiffFromId(difficultyID) or session.diff or InstanceDiff()
end

local function TooltipBind(itemLink, itemID)
  local src = PlainString(itemLink)
  if not src and itemID then
    src = "item:" .. tostring(itemID)
  end
  if not src or not C_TooltipInfo or not C_TooltipInfo.GetHyperlink then
    return nil
  end
  local ok, tip = pcall(C_TooltipInfo.GetHyperlink, src)
  if not ok or type(tip) ~= "table" then
    return nil
  end
  local lines = tip.lines or tip
  local blob = ""
  if type(lines) == "table" then
    for i = 1, #lines do
      local line = lines[i]
      local t = type(line) == "table" and (line.leftText or line.text) or nil
      if type(t) == "string" then
        blob = blob .. "\n" .. t
      end
    end
  end
  local low = blob:lower()
  if blob:find("使用前战团", 1, true) or low:find("warbound until", 1, true) then
    return "wue"
  end
  if blob:find("战团绑定", 1, true) or low:find("warbound", 1, true)
      or low:find("binds to warband", 1, true) or low:find("account bound", 1, true)
      or blob:find("战网账号", 1, true) then
    return "warband"
  end
  if blob:find("装备后绑定", 1, true) or low:find("binds when equipped", 1, true) then
    return "boe"
  end
  if blob:find("拾取后绑定", 1, true) or low:find("binds when picked up", 1, true) then
    return "bop"
  end
  return nil
end

local function ClassifyBind(itemID, itemLink)
  local fromTip = TooltipBind(itemLink, itemID)
  if fromTip then
    return fromTip
  end
  local src = itemLink or itemID
  if not (GetItemInfo and src) then
    return nil
  end
  local ok, _, _, _, _, _, _, _, _, _, _, _, _, bindType = pcall(GetItemInfo, src)
  bindType = ok and PlainNumber(bindType) or nil
  if not bindType then
    return nil
  end
  local E = Enum and Enum.ItemBind
  if E then
    if bindType == E.OnEquip then
      return "boe"
    end
    if bindType == E.ToAccountUntilEquipped then
      return "wue"
    end
    if bindType == E.ToWoWAccount or bindType == E.ToBnetAccount then
      return "warband"
    end
    if bindType == E.OnPickup then
      return "bop"
    end
  end
  if bindType == 2 then
    return "boe"
  end
  if bindType == 1 then
    return "bop"
  end
  if bindType == 7 or bindType == 8 or bindType == 9 then
    return "warband"
  end
  return nil
end

local function IsSkippedBind(bind)
  return bind == "boe" or bind == "warband" or bind == "wue"
end

local function MakeUid(itemID, winner)
  local h = Hash32(tostring(itemID or 0) .. "\0" .. string.lower(ShortWinner(winner)))
  return string.format("jl%08x%08x", h, tonumber(itemID) or 0)
end

local function RememberAward(it)
  if not db or not it or session.fake then
    return
  end
  local itemID = PlainNumber(it.itemID) or ItemIdFromLink(it.link)
  if not itemID then
    return
  end
  local player = PlainString(it.player)
  if not player or player == "" or player == "Rolling" or player == "?" then
    return
  end
  local winner = PlainString(it.playerFull) or player
  winner = winner:sub(1, 48)
  local boss = PlainString(session.bossName) or PlainString(session.title) or PlainString(it.boss) or ""
  if boss == "Boss loot" then
    boss = ""
  end
  boss = boss:sub(1, 64)
  local diff = session.diff or InstanceDiff()
  local link = PlainString(it.link) or ""
  if #link > 256 then
    link = link:sub(1, 256)
  end
  local bind = ClassifyBind(itemID, link)
  if IsSkippedBind(bind) then
    return
  end
  if type(db.lootLog) ~= "table" then
    db.lootLog = {}
  end
  local short = ShortWinner(winner)
  for i = 1, #db.lootLog do
    local a = db.lootLog[i]
    if a.itemId == itemID and ShortWinner(a.winner) == short then
      if link ~= "" and (not a.itemLink or #link > #(a.itemLink or "")) then
        a.itemLink = link
      end
      if boss ~= "" and boss ~= "Boss loot" then
        a.boss = boss
      end
      if bind then
        a.bind = bind
      end
      if diff then
        a.diff = diff
      end
      return
    end
  end
  local awardedAt = (GetServerTime and GetServerTime()) or time()
  db.lootLog[#db.lootLog + 1] = {
    uid = MakeUid(itemID, winner),
    itemId = itemID,
    itemLink = link,
    winner = winner,
    boss = boss,
    awardedAt = awardedAt,
    week = RaidWeekId(awardedAt),
    mark = "player",
    bind = bind,
    diff = diff,
  }
  while #db.lootLog > 200 do
    table.remove(db.lootLog, 1)
  end
end

local function ApplyDropLink(it, itemLink, itemID, name, icon, quality, ilvl)
  if not it then
    return
  end
  local better = itemLink and (not it.link or (LinkHasDropData(itemLink) and not LinkHasDropData(it.link)))
  if better then
    it.link = itemLink
  elseif itemLink and not it.link then
    it.link = itemLink
  end
  if ilvl and (not it.ilvl or ilvl > (it.ilvl or 0)) then
    it.ilvl = ilvl
  end
  if name and (not it.name or it.name:find("^Item ") or better) then
    it.name = name
  end
  if icon then
    it.icon = icon
  end
  if quality then
    local qLink = QualityFromLink(itemLink)
    if qLink then
      it.quality = qLink
    elseif not it.quality then
      it.quality = quality
    end
  end
  if itemID and not it.itemID then
    it.itemID = itemID
  end
end

local function AddLoot(itemID, itemLink, quantity, playerName, classFile, encounterID)
  if not InDungeonOrRaid() then
    return false
  end
  itemLink = KeepItemLink(itemLink)
  itemID = PlainNumber(itemID) or ItemIdFromLink(PlainString(itemLink))
  local gear = IsGearItem(itemID, itemLink)
  if gear == false then
    return false
  end
  local playerFull = NormalizeWhisperTarget(playerName)
  playerName = ShortName(playerName)
  classFile = PlainString(classFile) or ClassFileOf(playerFull or playerName)
  quantity = PlainNumber(quantity) or 1

  -- Sans le vrai link du drop, l'ID seul = version de base (vieux ilvl BFA)
  local ilvl = ItemLevel(itemLink, nil)
  if not itemLink then
    local baseIlvl = ItemLevel(nil, itemID)
    if baseIlvl and baseIlvl < 180 then
      return false
    end
    ilvl = baseIlvl
  end

  local quality = ItemQuality(itemID, itemLink)
  if type(quality) == "number" then
    local ok, low = pcall(function()
      return quality < MIN_QUALITY
    end)
    if ok and low then
      return false
    end
  end

  local name, icon, q2 = ItemNameAndIcon(itemID, itemLink)
  quality = QualityFromLink(itemLink) or quality or q2
  if quantity > 1 and name then
    name = name .. " x" .. quantity
  end

  -- dedupe same item+player ; upgrade "Rolling" -> vrai joueur ; upgrade link S2
  for i = 1, #session.items do
    local it = session.items[i]
    local sameItem = (itemID and it.itemID == itemID)
      or (itemLink and it.link == itemLink)
    if sameItem then
      if it.player == playerName or it.player == "Rolling" then
        if it.player == "Rolling" and playerName ~= "Rolling" then
          it.player = playerName
          it.playerFull = playerFull or playerName
          it.class = classFile or it.class
        elseif it.player == playerName then
          local sameLink = itemLink and it.link == itemLink
          local upgrading = itemLink and it.link and it.link ~= itemLink
          if not sameLink and not upgrading then
            it.qty = (it.qty or 1) + quantity
            if it.qty > 1 and name then
              name = name:gsub(" x%d+$", "") .. " x" .. it.qty
            end
          end
        end
        ApplyDropLink(it, itemLink, itemID, name, icon, quality, ilvl)
        MarkItemLooted(itemID, playerFull or playerName)
        RememberAward(it)
        EnsureFrame()
        ShowBox()
        return true
      end
    end
  end

  if #session.items >= MAX_ROWS then
    return false
  end

  session.items[#session.items + 1] = {
    itemID = itemID,
    link = itemLink,
    name = name,
    icon = icon,
    quality = quality,
    ilvl = ilvl,
    player = playerName,
    playerFull = playerFull or playerName,
    class = classFile,
    qty = quantity,
  }
  if encounterID or session.bossName then
    session.title = EncounterTitle(encounterID)
  end
  if itemID and C_Item and C_Item.RequestLoadItemDataByID then
    pcall(C_Item.RequestLoadItemDataByID, itemID)
  end
  MarkItemLooted(itemID, playerFull or playerName)
  RememberAward(session.items[#session.items])
  EnsureFrame()
  ShowBox()
  return true
end

function NewSession(title, encounterID, difficultyID)
  session.title = title or "Boss loot"
  session.bossName = title
  session.items = {}
  session.shown = false
  session.live = true
  session.untilT = 0
  session.encounterID = PlainNumber(encounterID)
  session.fake = false
  session.diff = nil
  SetSessionDiff(difficultyID)
end

local function PatternFromFmt(fmt)
  fmt = PlainString(fmt)
  if not fmt then
    return nil
  end
  fmt = fmt:gsub("([%(%)%.%%%+%-%*%?%[%]%^%$])", "%%%1")
  fmt = fmt:gsub("%%%%s", "(.+)")
  fmt = fmt:gsub("%%%%d", "(%%d+)")
  return fmt
end

local function ParseChatLoot(msg)
  msg = PlainString(msg)
  if not msg then
    return nil
  end
  local link = msg:match("(|c%x+|Hitem:[^|]+|h%[[^%]]+%]|h|r)")
  if not link then
    return nil
  end
  local itemID = ItemIdFromLink(link)
  local player
  local selfFmts = { LOOT_ITEM_SELF, LOOT_ITEM_SELF_MULTIPLE, LOOT_ITEM_PUSHED_SELF, LOOT_ITEM_PUSHED_SELF_MULTIPLE }
  for i = 1, #selfFmts do
    local pat = PatternFromFmt(selfFmts[i])
    if pat and msg:find(pat) then
      player = UnitName("player")
      break
    end
  end
  if not player then
    local otherFmts = { LOOT_ITEM, LOOT_ITEM_MULTIPLE, LOOT_ITEM_PUSHED, LOOT_ITEM_PUSHED_MULTIPLE }
    for i = 1, #otherFmts do
      local pat = PatternFromFmt(otherFmts[i])
      if pat then
        local who = msg:match(pat)
        who = PlainString(who)
        if who and not who:find("|Hitem") then
          player = who
          break
        end
      end
    end
  end
  if not player then
    -- fallback: texte avant le link
    local who = msg:match("^(.-)%s+|c%x+|Hitem")
    who = PlainString(who)
    if who then
      who = who:gsub("[%s:%-]+$", "")
      if who ~= "" and not who:find("|H") then
        player = who
      end
    end
  end
  return itemID, link, player
end

local function AddRollLoot(rollID)
  rollID = PlainNumber(rollID)
  if not rollID then
    return
  end
  local link, name, count, quality, texture
  if GetLootRollItemLink then
    local ok, lnk = pcall(GetLootRollItemLink, rollID)
    if ok then
      link = KeepItemLink(lnk)
    end
  end
  if GetLootRollItemInfo then
    local ok, tex, n, cnt, q = pcall(GetLootRollItemInfo, rollID)
    if ok then
      texture = tex
      name = PlainString(n)
      count = PlainNumber(cnt)
      quality = PlainNumber(q)
    end
  end
  local itemID = ItemIdFromLink(link)
  if type(quality) == "number" and quality < MIN_QUALITY then
    return
  end
  if not itemID and not link and not name then
    return
  end
  if IsGearItem(itemID, link) == false then
    return
  end
  AddLoot(itemID, link, count or 1, "Rolling", nil, nil)
  if name and session.items[#session.items] and session.items[#session.items].name:find("^Item ") then
    session.items[#session.items].name = name
    if texture then
      session.items[#session.items].icon = texture
    end
    if session.shown then
      Refresh()
    end
  end
end

local function ScanGroupLootFrames()
  for i = 1, 8 do
    local f = _G["GroupLootFrame" .. i]
    if f then
      local shown = false
      local okS, isShown = pcall(function()
        return f:IsShown()
      end)
      shown = okS and isShown
      local rollID = PlainNumber(f.rollID)
      if shown and rollID then
        AddRollLoot(rollID)
      end
    end
  end
end

local function PullLootHistory()
  if not C_LootHistory then
    return
  end
  local drops
  if C_LootHistory.GetSortedDrops then
    local ok, d = pcall(C_LootHistory.GetSortedDrops)
    if ok and type(d) == "table" then
      drops = d
    end
  end
  if not drops and C_LootHistory.GetAllItems then
    local ok, d = pcall(C_LootHistory.GetAllItems)
    if ok and type(d) == "table" then
      drops = d
    end
  end
  if type(drops) ~= "table" then
    return
  end
  for i = 1, #drops do
    local drop = drops[i]
    if type(drop) == "table" then
      local itemID = PlainNumber(drop.itemID or drop.id or drop.itemId)
      local link = PlainString(drop.itemLink or drop.link or drop.hyperlink)
      local player = PlainString(drop.playerName or drop.winnerName or drop.winner or drop.name)
      local classFile = PlainString(drop.classFilename or drop.classFileName or drop.class)
      local qty = PlainNumber(drop.quantity or drop.count) or 1
      local dropEnc = PlainNumber(drop.encounterID or drop.encounterId)
      -- Pas de gagnant = souvent la table de loot du journal (vieux items BFA)
      if not player or player == "?" or player == "" then
        player = nil
      end
      if session.encounterID and dropEnc and dropEnc ~= session.encounterID then
        player = nil
        itemID = nil
      end
      if player and (itemID or link) then
        AddLoot(itemID, link, qty, player, classFile, dropEnc or session.encounterID)
      end
    end
  end
end

local function ScheduleLootScan()
  -- Seulement les frames de roll = vrais drops. Pas le journal / historique
  -- (sinon King's Rest etc. ressortent les vieux items BFA).
  if not C_Timer or not C_Timer.After then
    ScanGroupLootFrames()
    return
  end
  C_Timer.After(0.25, ScanGroupLootFrames)
  C_Timer.After(1.5, ScanGroupLootFrames)
end

local function FakeTest()
  NewSession("Test loot — 1 item / spé")
  session.fake = true
  EnsureBisTables()
  RebuildFlatBisCache()

  local players = {
    { "Alya", "MAGE" },
    { "Torvak", "WARRIOR" },
    { "Jick", "MONK" },
    { "Sera", "PRIEST" },
    { "Borin", "PALADIN" },
  }
  local fallbackIds = { 19019, 17182, 22632, 34334, 19364 }

  -- Specs a montrer (tonumber: SavedVariables peut parfois livrer des cles string)
  local preferredOrder = { 268, 269, 270, 71, 72, 73, 65, 66, 70 } -- monk puis autres
  local specIds = {}
  local seenSid = {}
  local function addSid(sid)
    sid = tonumber(sid)
    if not sid or sid == 0 or seenSid[sid] then
      return
    end
    local map = db.bisBySpec[sid] or db.bisBySpec[tostring(sid)]
    if type(map) == "table" and next(map) then
      seenSid[sid] = true
      table.insert(specIds, sid)
    end
  end
  for _, sid in ipairs(preferredOrder) do
    addSid(sid)
  end
  for sid, map in pairs(db.bisBySpec or {}) do
    addSid(sid)
  end
  if #specIds == 0 then
    local map0 = db.bisBySpec[0] or db.bisBySpec["0"]
    if type(map0) == "table" and next(map0) then
      table.insert(specIds, 0)
    end
  end

  session.items = {}
  local usedIds = {}

  local function getSpecMap(specId)
    return db.bisBySpec[specId] or db.bisBySpec[tostring(specId)]
  end

  local function pickItemForSpec(specId)
    local map = getSpecMap(specId)
    if type(map) ~= "table" then
      return nil
    end
    -- Prefere un item UNIQUE a cette spe (meilleure demo de couleur)
    local unique, shared = {}, {}
    for id, tier in pairs(map) do
      id = tonumber(id) or id
      if type(id) == "number" and not usedIds[id] then
        local elsewhere = false
        for otherId, otherMap in pairs(db.bisBySpec) do
          local oid = tonumber(otherId) or otherId
          if oid ~= specId and type(otherMap) == "table" and (otherMap[id] or otherMap[tostring(id)]) then
            elsewhere = true
            break
          end
        end
        if elsewhere then
          table.insert(shared, { id = id, tier = tonumber(tier) or TIER_BIS })
        else
          table.insert(unique, { id = id, tier = tonumber(tier) or TIER_BIS })
        end
      end
    end
    local pool = (#unique > 0) and unique or shared
    if #pool == 0 then
      -- dernier recours: n'importe quel item de la spe meme deja use (duplique ligne)
      for id, tier in pairs(map) do
        id = tonumber(id) or id
        if type(id) == "number" then
          table.insert(pool, { id = id, tier = tonumber(tier) or TIER_BIS })
        end
      end
    end
    if #pool == 0 then
      return nil
    end
    table.sort(pool, function(a, b)
      if a.tier ~= b.tier then
        return a.tier > b.tier
      end
      return a.id < b.id
    end)
    return pool[1].id
  end

  if #specIds > 0 then
    for i, sid in ipairs(specIds) do
      local id = pickItemForSpec(sid)
      if id then
        usedIds[id] = true
        local p = players[((i - 1) % #players) + 1]
        table.insert(session.items, {
          itemID = id,
          name = "Item " .. id,
          icon = 134400,
          quality = 4,
          player = p[1],
          playerFull = p[1],
          class = p[2],
          _testSpec = sid,
        })
      end
    end
    -- 1 ligne non-BiS pour comparer
    local filler = nil
    for _, id in ipairs(fallbackIds) do
      if not usedIds[id] and not (db.bisItems and db.bisItems[id]) then
        filler = id
        break
      end
    end
    if filler then
      table.insert(session.items, {
        itemID = filler,
        name = "Item " .. filler,
        icon = 134400,
        quality = 4,
        player = "Sera",
        playerFull = "Sera",
        class = "PRIEST",
      })
    end
    -- 1 rare bleu pour valider le seuil MIN_QUALITY = 3
    table.insert(session.items, {
      itemID = 9449,
      name = "Manual Crowd Pummeler",
      icon = 133476,
      quality = 3,
      player = "Borin",
      playerFull = "Borin",
      class = "PALADIN",
    })
    local names = {}
    for _, sid in ipairs(specIds) do
      table.insert(names, GetSpecShortName(sid))
    end
    Print("test: 1 loot / spé → " .. table.concat(names, " · ") .. " (+ 1 non-BiS)")
  else
    -- Aucune liste: demo
    session.items = {
      { itemID = 19019, name = "Thunderfury", icon = 135349, quality = 5, player = "Alya", playerFull = "Alya", class = "MAGE" },
      { itemID = 17182, name = "Sulfuras", icon = 133066, quality = 5, player = "Torvak", playerFull = "Torvak", class = "WARRIOR" },
      { itemID = 22632, name = "Atiesh", icon = 135226, quality = 5, player = "Jick", playerFull = "Jick", class = "MONK" },
      { itemID = 34334, name = "Thori'dal", icon = 135519, quality = 5, player = "Sera", playerFull = "Sera", class = "PRIEST" },
      { itemID = 9449, name = "Manual Crowd Pummeler", icon = 133476, quality = 3, player = "Borin", playerFull = "Borin", class = "PALADIN" },
    }
    db.bisBySpec[0] = db.bisBySpec[0] or {}
    db.bisBySpec[0][19019] = TIER_BIS
    RebuildFlatBisCache()
    Print("aucune liste BiS — demo. Importe avec /jl bis")
  end

  -- Nom / icône / link depuis le cache client
  for _, it in ipairs(session.items) do
    local name, icon = ItemNameAndIcon(it.itemID, nil)
    if name and not name:find("^Item ") then
      it.name = name
    end
    if icon then
      it.icon = icon
    end
    if GetItemInfo then
      local ok, n, lnk, q = pcall(function()
        local name2, link2, quality2 = GetItemInfo(it.itemID)
        return name2, link2, quality2
      end)
      if ok then
        if type(n) == "string" then it.name = n end
        if type(lnk) == "string" then it.link = lnk end
        if type(q) == "number" then it.quality = q end
      end
    end
    it.ilvl = ItemLevel(it.link, it.itemID) or it.ilvl
    if C_Item and C_Item.RequestLoadItemDataByID then
      pcall(C_Item.RequestLoadItemDataByID, it.itemID)
    end
  end

  EnsureFrame()
  ShowBox()
  if C_Timer and C_Timer.After then
    C_Timer.After(0.4, function()
      for _, it in ipairs(session.items) do
        local name, icon = ItemNameAndIcon(it.itemID, it.link)
        if name and not name:find("^Item ") then
          it.name = name
        end
        if icon then
          it.icon = icon
        end
        it.ilvl = ItemLevel(it.link, it.itemID) or it.ilvl
      end
      if session.shown then
        Refresh()
      end
    end)
  end
end

-- ─── Minimap ────────────────────────────────────────────────

local minimapBtn

local function PlaceMinimapButton()
  if not minimapBtn or not Minimap then
    return
  end
  local angle = tonumber(db and db.minimapAngle) or 210
  local rad = angle * math.pi / 180
  local r = (Minimap:GetWidth() / 2) + 10
  minimapBtn:ClearAllPoints()
  minimapBtn:SetPoint("CENTER", Minimap, "CENTER", math.cos(rad) * r, math.sin(rad) * r)
end

local function EnsureMinimapButton()
  if minimapBtn then
    if db and db.minimapHide then
      minimapBtn:Hide()
    else
      minimapBtn:Show()
      PlaceMinimapButton()
    end
    return minimapBtn
  end
  if not Minimap then
    return nil
  end

  local b = CreateFrame("Button", "JicksLootsMinimapButton", Minimap)
  b:SetSize(24, 24)
  b:SetFrameStrata("MEDIUM")
  b:SetFrameLevel(8)
  b:RegisterForClicks("LeftButtonUp")
  b:RegisterForDrag("LeftButton")

  local function CircleTex(layer, size, r, g, bl, a)
    local tex = b:CreateTexture(nil, layer)
    tex:SetSize(size, size)
    tex:SetPoint("CENTER")
    tex:SetColorTexture(r, g, bl, a or 1)
    local mask = b:CreateMaskTexture()
    mask:SetAllPoints(tex)
    mask:SetTexture("Interface\\CharacterFrame\\TempPortraitAlphaMask")
    tex:AddMaskTexture(mask)
    return tex
  end
  CircleTex("BACKGROUND", 24, 0.72, 0.56, 0.18, 1)
  CircleTex("BORDER", 21, 0.10, 0.08, 0.04, 1)
  CircleTex("ARTWORK", 19, 0.16, 0.12, 0.05, 1)

  local shadow = b:CreateFontString(nil, "OVERLAY")
  shadow:SetFont(STANDARD_TEXT_FONT, 9, "OUTLINE")
  shadow:SetPoint("CENTER", 1, -1)
  shadow:SetTextColor(0, 0, 0, 0.90)
  shadow:SetText("JL")

  local letters = b:CreateFontString(nil, "OVERLAY")
  letters:SetFont(STANDARD_TEXT_FONT, 9, "OUTLINE")
  letters:SetPoint("CENTER", 0, 0)
  letters:SetTextColor(0.98, 0.86, 0.38, 1)
  letters:SetText("JL")
  b.Letters = letters

  b:SetScript("OnClick", function()
    if OpenSlotBoard then
      OpenSlotBoard()
    end
  end)
  b:SetScript("OnDragStart", function(self)
    self:SetScript("OnUpdate", function()
      if not Minimap then
        return
      end
      local mx, my = GetCursorPosition()
      local cx, cy = Minimap:GetCenter()
      local scale = Minimap:GetEffectiveScale() or 1
      if not cx or not scale or scale == 0 then
        return
      end
      local dx = mx / scale - cx
      local dy = my / scale - cy
      if db then
        db.minimapAngle = math.deg(math.atan2(dy, dx))
      end
      PlaceMinimapButton()
    end)
  end)
  b:SetScript("OnDragStop", function(self)
    self:SetScript("OnUpdate", nil)
  end)
  b:SetScript("OnEnter", function(self)
    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    GameTooltip:AddLine("JicksLoots", 0.95, 0.82, 0.35)
    GameTooltip:AddLine("Click: open gear grid", 0.80, 0.82, 0.86)
    GameTooltip:AddLine("Drag: move", 0.80, 0.82, 0.86)
    GameTooltip:Show()
  end)
  b:SetScript("OnLeave", function()
    GameTooltip:Hide()
  end)

  minimapBtn = b
  if db and db.minimapHide then
    b:Hide()
  else
    PlaceMinimapButton()
    b:Show()
  end
  return b
end

-- ─── Archive export (/jl export → ICRC1:loot) ───────────────

local exportFrame

local function JsonStr(s)
  s = tostring(s or "")
  s = s:gsub("\\", "\\\\"):gsub('"', '\\"'):gsub("\n", "\\n"):gsub("\r", "\\r"):gsub("\t", "\\t")
  s = s:gsub("[\1-\31]", function(c)
    return string.format("\\u%04x", string.byte(c))
  end)
  return '"' .. s .. '"'
end

local function FlushSessionToLog()
  for i = 1, #session.items do
    RememberAward(session.items[i])
  end
end

local function CollectExportAwards(all)
  FlushSessionToLog()
  local week = RaidWeekId()
  local out = {}
  local seen = {}
  for i = 1, #(db and db.lootLog or {}) do
    local a = db.lootLog[i]
    if type(a) == "table" and a.uid and tonumber(a.itemId) then
      local w = a.week or RaidWeekId(a.awardedAt)
      local bind = a.bind or ClassifyBind(a.itemId, a.itemLink)
      if (all or w == week) and not IsSkippedBind(bind) then
        local key = tostring(a.itemId) .. "|" .. string.lower(ShortWinner(a.winner))
        if not seen[key] then
          seen[key] = true
          a.bind = bind
          out[#out + 1] = a
        end
      end
    end
  end
  return out, week
end

local function BuildLootExport(all)
  local awards, week = CollectExportAwards(all)
  local parts = {}
  for i = 1, #awards do
    local a = awards[i]
    parts[i] = string.format(
      '{"uid":%s,"itemId":%d,"itemLink":%s,"winner":%s,"boss":%s,"awardedAt":%d,"traded":false,"mark":"player","bind":%s,"diff":%s}',
      JsonStr(a.uid),
      tonumber(a.itemId) or 0,
      JsonStr((tostring(a.itemLink or "")):sub(1, 256)),
      JsonStr((tostring(a.winner or "")):sub(1, 48)),
      JsonStr((tostring(a.boss or "")):sub(1, 64)),
      tonumber(a.awardedAt) or 0,
      JsonStr(a.bind or ""),
      JsonStr(a.diff or "")
    )
  end
  return "ICRC1:loot:{\"kind\":\"loot\",\"v\":1,\"week\":"
    .. JsonStr(week)
    .. ",\"src\":\"jicksloot\",\"awards\":["
    .. table.concat(parts, ",")
    .. "]}", #awards, week
end

local function EnsureExportFrame()
  if exportFrame then
    return exportFrame
  end
  local f = CreateFrame("Frame", "JicksLootExportFrame", UIParent, BackdropTemplateMixin and "BackdropTemplate" or nil)
  f:SetSize(520, 260)
  f:SetPoint("CENTER", 0, 40)
  f:SetFrameStrata("FULLSCREEN_DIALOG")
  f:SetMovable(true)
  f:EnableMouse(true)
  f:SetClampedToScreen(true)
  if f.SetToplevel then
    f:SetToplevel(true)
  end
  f:SetBackdrop({
    bgFile = "Interface\\Buttons\\WHITE8x8",
    edgeFile = "Interface\\Buttons\\WHITE8x8",
    edgeSize = 1,
  })
  f:SetBackdropColor(0.08, 0.09, 0.12, 0.97)
  f:SetBackdropBorderColor(0.85, 0.70, 0.25, 0.9)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", f.StartMoving)
  f:SetScript("OnDragStop", f.StopMovingOrSizing)
  tinsert(UISpecialFrames, "JicksLootExportFrame")

  local title = f:CreateFontString(nil, "OVERLAY")
  title:SetFont(STANDARD_TEXT_FONT, 14, "OUTLINE")
  title:SetPoint("TOPLEFT", 14, -12)
  title:SetTextColor(0.95, 0.82, 0.35, 1)
  title:SetText("导出分配 — /jl export")
  f.TitleFS = title

  local sub = f:CreateFontString(nil, "OVERLAY")
  sub:SetFont(STANDARD_TEXT_FONT, 11, "")
  sub:SetPoint("TOPLEFT", title, "BOTTOMLEFT", 0, -4)
  sub:SetWidth(490)
  sub:SetJustifyH("LEFT")
  sub:SetTextColor(0.65, 0.68, 0.72, 1)
  sub:SetText("Ctrl+A 全选，Ctrl+C 复制，贴到团本档案「本周分配」。")
  f.SubFS = sub

  local scroll = CreateFrame("ScrollFrame", nil, f, "UIPanelScrollFrameTemplate")
  scroll:SetPoint("TOPLEFT", 14, -52)
  scroll:SetPoint("BOTTOMRIGHT", -34, 44)

  local edit = CreateFrame("EditBox", nil, scroll)
  edit:SetMultiLine(true)
  edit:SetFontObject(ChatFontNormal)
  edit:SetWidth(460)
  edit:SetAutoFocus(true)
  edit:SetScript("OnEscapePressed", function()
    f:Hide()
  end)
  edit:SetScript("OnEditFocusGained", function(self)
    self:HighlightText()
  end)
  scroll:SetScrollChild(edit)
  f.Edit = edit

  local close = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
  close:SetSize(80, 22)
  close:SetPoint("BOTTOMRIGHT", -12, 12)
  close:SetText("关闭")
  close:SetScript("OnClick", function()
    f:Hide()
  end)

  exportFrame = f
  return f
end

local function ShowExportUI(all)
  if not db then
    Print("not ready")
    return
  end
  local payload, n, week = BuildLootExport(all)
  if n == 0 then
    Print(all and "还没有可导出的分配（先打本，系统判定后再 /jl export）"
      or "本周还没有分配 — 打完 Boss 后再导出，或 /jl export all")
    return
  end
  local f = EnsureExportFrame()
  f.TitleFS:SetText(all and ("导出全部 — " .. n .. " 条") or ("导出本周 " .. week .. " — " .. n .. " 条"))
  f.Edit:SetText(payload)
  f:Show()
  f.Edit:SetFocus()
  f.Edit:HighlightText()
  Print((all and "全部 " or "本周 ") .. n .. " 条 — Ctrl+C 后贴到网站本周分配")
end

-- ─── Events ─────────────────────────────────────────────────

local ev = CreateFrame("Frame")
ev:RegisterEvent("ADDON_LOADED")
ev:RegisterEvent("ENCOUNTER_LOOT_RECEIVED")
ev:RegisterEvent("ENCOUNTER_END")
ev:RegisterEvent("ENCOUNTER_START")
ev:RegisterEvent("BOSS_KILL")
ev:RegisterEvent("CHAT_MSG_LOOT")
ev:RegisterEvent("START_LOOT_ROLL")
ev:RegisterEvent("SHOW_LOOT_TOAST")
ev:RegisterEvent("GET_ITEM_INFO_RECEIVED")
pcall(function()
  ev:RegisterEvent("ITEM_DATA_LOAD_RESULT")
end)
ev:RegisterEvent("PLAYER_EQUIPMENT_CHANGED")
pcall(function()
  ev:RegisterEvent("INSTANCE_ENCOUNTER_ENGAGE_UNIT")
end)

ev:SetScript("OnEvent", function(_, event, ...)
  if event == "ADDON_LOADED" then
    local name = ...
    if name ~= ADDON then
      return
    end
    JicksLootDB = JicksLootDB or {}
    db = JicksLootDB
    MergeDefaults(db, DEFAULTS)
    ev:UnregisterEvent("ADDON_LOADED")
    EnsureBisTables()
    SanitizeBisLists()
    -- Une seule fois: mode all pour multi-spec (Brew loote WW, etc.)
    if db._bisModeAll120 == nil then
      db.bisMode = "all"
      db._bisModeAll120 = true
    end
    -- Ancienne memoire = "a drop" (n'importe qui). On repart sur "je l'ai eu".
    if db._lootedSelfOnly144 == nil then
      db.lootedItems = {}
      db._lootedSelfOnly144 = true
    end
    if type(db.lootLog) ~= "table" then
      db.lootLog = {}
    end
    EnsureMinimapButton()
    HookShiftClickImport()
    Print("ready — |cffffd100/jl|r  ·  |cffffd100/jl export|r  ·  loot  ·  |cffffd100/jl slots|r")
    if C_Timer and C_Timer.After then
      C_Timer.After(1.5, function()
        if InDungeonOrRaid() then
          pcall(PullLootHistory)
        end
      end)
    end

  elseif event == "ENCOUNTER_START" then
    if not InDungeonOrRaid() then
      return
    end
    local encounterID, encounterName, difficultyID = ...
    local title = PlainString(encounterName) or EncounterTitle(encounterID)
    NewSession(title, encounterID, difficultyID)

  elseif event == "INSTANCE_ENCOUNTER_ENGAGE_UNIT" then
    if not InDungeonOrRaid() then
      return
    end
    if session.live or InLootWindow() then
      return
    end
    local title
    if UnitExists and UnitExists("boss1") then
      local ok, n = pcall(UnitName, "boss1")
      if ok then
        title = PlainString(n)
      end
    end
    NewSession(title or "Boss loot")

  elseif event == "BOSS_KILL" then
    if not InDungeonOrRaid() then
      return
    end
    local encounterID, encounterName = ...
    local title = PlainString(encounterName) or EncounterTitle(encounterID)
    EnsureBossSession(title, encounterID)
    SetSessionDiff()
    session.live = false
    ExtendLootWindow(90)
    ScheduleLootScan()

  elseif event == "ENCOUNTER_END" then
    if not InDungeonOrRaid() then
      return
    end
    local encounterID, encounterName, difficultyID, _, success = ...
    SetSessionDiff(difficultyID)
    local title = PlainString(encounterName)
    session.live = false
    if title then
      session.bossName = title
      session.title = title
      if frame and session.shown then
        frame.Title:SetText(title)
      end
    elseif PlainNumber(encounterID) then
      session.title = EncounterTitle(encounterID)
    end
    local won = true
    if success ~= nil then
      local okWin, isWin = pcall(function()
        return success == true or success == 1
      end)
      if okWin then
        won = isWin
      end
    end
    if won then
      ExtendLootWindow(90)
      ScheduleLootScan()
    end

  elseif event == "ENCOUNTER_LOOT_RECEIVED" then
    if not InDungeonOrRaid() then
      return
    end
    local encounterID, itemID, itemLink, quantity, playerName, classFile = ...
    EnsureBossSession(nil, encounterID)
    ExtendLootWindow(90)
    pcall(AddLoot, itemID, itemLink, quantity, playerName, classFile, encounterID)

  elseif event == "CHAT_MSG_LOOT" then
    if not ShouldCollectLoot() then
      local okB, bossUp = pcall(function()
        return UnitExists and UnitExists("boss1")
      end)
      if not (okB and bossUp) then
        return
      end
      EnsureBossSession()
      ExtendLootWindow(60)
    end
    local msg = ...
    local itemID, itemLink, player = ParseChatLoot(msg)
    if not itemID and not itemLink then
      return
    end
    pcall(AddLoot, itemID, itemLink, 1, player, nil, nil)

  elseif event == "START_LOOT_ROLL" then
    if not InDungeonOrRaid() then
      return
    end
    local rollID = ...
    EnsureBossSession(session.bossName or "Boss loot")
    session.live = false
    ExtendLootWindow(90)
    pcall(AddRollLoot, rollID)

  elseif event == "SHOW_LOOT_TOAST" then
    if not ShouldCollectLoot() then
      local okB, bossUp = pcall(function()
        return UnitExists and UnitExists("boss1")
      end)
      if not ((okB and bossUp) or InInstanceContent()) then
        return
      end
      EnsureBossSession()
      ExtendLootWindow(60)
    end
    local typeId, itemLink, quantity = ...
    typeId = PlainString(typeId)
    if typeId and typeId ~= "item" then
      return
    end
    pcall(AddLoot, nil, itemLink, quantity, UnitName("player"), nil, nil)

  elseif event == "PLAYER_EQUIPMENT_CHANGED" then
    if slotBoard and slotBoard:IsShown() and C_Timer and C_Timer.After then
      if not slotBoard._eqPending then
        slotBoard._eqPending = true
        C_Timer.After(0.25, function()
          if slotBoard then
            slotBoard._eqPending = nil
          end
          if RefreshSlotBoard then
            RefreshSlotBoard()
          end
        end)
      end
    elseif RefreshSlotBoard then
      RefreshSlotBoard()
    end

  elseif event == "GET_ITEM_INFO_RECEIVED" or event == "ITEM_DATA_LOAD_RESULT" then
    if C_Timer and C_Timer.After then
      if not JL._infoPending then
        JL._infoPending = true
        C_Timer.After(0.12, function()
          JL._infoPending = nil
          if JL.RefreshCollection then
            JL.RefreshCollection()
          elseif slotBoard and slotBoard:IsShown() and RefreshSlotBoard then
            RefreshSlotBoard()
          end
        end)
      end
    elseif JL.RefreshCollection then
      JL.RefreshCollection()
    end
    if not session.shown or #session.items == 0 then
      return
    end
    local recID = PlainNumber(...)
    local dirty = false
    local i = 1
    while i <= #session.items do
      local it = session.items[i]
      if not recID or it.itemID == recID then
        local gear = IsGearItem(it.itemID, it.link)
        if gear == false then
          table.remove(session.items, i)
          dirty = true
        else
          local n, icon, q = ItemNameAndIcon(it.itemID, it.link)
          if n and not n:find("^Item ") then
            it.name = n
          end
          if icon then
            it.icon = icon
          end
          local qLink = QualityFromLink(it.link)
          if qLink then
            it.quality = qLink
          elseif q and not it.quality then
            it.quality = q
          end
          local ilvl = ItemLevel(it.link, it.itemID)
          if ilvl then
            it.ilvl = ilvl
          end
          dirty = true
          i = i + 1
        end
      else
        i = i + 1
      end
    end
    if dirty then
      if #session.items == 0 then
        HideBox()
      else
        Refresh()
      end
    end
  end
end)

-- ─── Slash ──────────────────────────────────────────────────

SLASH_JICKSLOOT1 = "/jl"
SLASH_JICKSLOOT2 = "/jicksloot"
SLASH_JICKSLOOT3 = "/jicksloots"
SlashCmdList.JICKSLOOT = function(msg)
  msg = (msg or ""):gsub("^%s+", ""):gsub("%s+$", "")
  local low = msg:lower()
  if low == "hide" or low == "close" then
    HideBox()
    return
  end
  if low == "export" or low == "export week" then
    ShowExportUI(false)
    return
  end
  if low == "export all" then
    ShowExportUI(true)
    return
  end
  if low == "export clear" or low == "export wipe" then
    if db then
      db.lootLog = {}
    end
    Print("export log cleared — 已清空导出账本")
    return
  end
  if low == "reset" then
    db.point = "CENTER"
    db.x = 0
    db.y = 140
    if frame then
      PlaceFrame()
    end
    Print("position reset")
    return
  end
  -- BiS list (multi-spec)
  if low == "bis" or low == "import" or low == "bis import" then
    OpenBisImportUI()
    return
  end
  if low == "bis clear" or low == "bis wipe" then
    db.bisItems = {}
    db.bisBySpec = {}
    SanitizeBisLists()
    Print("BiS lists cleared (all specs)")
    if session.shown then
      Refresh()
    end
    if slotBoard then
      slotBoard:Show()
      RefreshSlotBoard()
    end
    return
  end
  if low == "bis count" or low == "bis list" or low == "bis status" then
    Print(DescribeBisStatus())
    return
  end
  -- /jl bis mode loot|active|all
  local modeArg = low:match("^bis mode%s+(%S+)") or low:match("^mode%s+(%S+)")
  if modeArg then
    if modeArg == "loot" or modeArg == "active" or modeArg == "all" then
      db.bisMode = modeArg
      Print("BiS highlight mode = " .. modeArg .. " (loot=loot spec, active=talents, all=any list)")
      Print(DescribeBisStatus())
      if session.shown then
        Refresh()
      end
    else
      Print("usage: /jl bis mode loot | active | all")
    end
    return
  end
  if low == "bis sync" or low == "sync" then
    local ok, a, b, nSpecs = SyncFromKeystoneLootAPI()
    if ok then
      Print(string.format("Synced from KeystoneLoot — +%d, total %d, specs %d", a or 0, b or 0, nSpecs or 0))
      Print(DescribeBisStatus())
      if session.shown then
        Refresh()
      end
    else
      Print("Sync failed: " .. tostring(a))
    end
    return
  end
  -- /jl bis <paste string>  (one-shot without UI)
  local bisArg = msg:match("^[Bb][Ii][Ss]%s+(.+)$")
  if bisArg and not bisArg:lower():match("^(clear|wipe|count|list|status|sync|import|mode)") then
    local ok, a, b, nSpecs = ImportBisString(bisArg, false)
    if ok then
      Print(string.format("BiS import OK — +%d, total %d, specs %d", a or 0, b or 0, nSpecs or 0))
      Print(DescribeBisStatus())
      if session.shown then
        Refresh()
      end
    else
      Print("BiS import failed: " .. tostring(a))
    end
    return
  end
  if low == "test" then
    FakeTest()
    return
  end
  if low == "slots" or low == "board" or low == "gear" then
    OpenSlotBoard()
    return
  end
  if low == "minimap" then
    if not db then
      return
    end
    db.minimapHide = not db.minimapHide
    EnsureMinimapButton()
    Print("minimap icon = " .. (db.minimapHide and "hidden" or "shown"))
    return
  end
  if low == "slots reset" or low == "slots clear" or low == "mine clear" then
    db.lootedItems = {}
    Print("cleared: only items YOU receive will get the OK mark")
    if RefreshSlotBoard then
      RefreshSlotBoard()
    end
    return
  end
  if low == "help" or low == "?" then
    Print("/jl  ·  /jl test  ·  /jl hide  ·  /jl reset")
    Print("/jl export  ·  /jl export all  ·  /jl export clear")
    Print("/jl slots  ·  /jl bis  ·  /jl bis clear  ·  /jl bis list")
    Print("/jl bis mode loot | active | all   (multi-spec highlight)")
    Print("affiche le drop gear du boss (donjon / raid seulement)")
    return
  end
  EnsureFrame()
  if #session.items == 0 then
    Print("pas encore de loot — /jl test pour voir la boite")
    return
  end
  ShowBox()
end

-- API used by JicksLootCollection.lua
JL.GetDB = function()
  return db
end
JL.Print = Print
JL.EnsureBisTables = EnsureBisTables
JL.EnsureTrackTables = EnsureTrackTables
JL.GetTrackMap = GetTrackMap
JL.SanitizeBisLists = SanitizeBisLists
JL.GetSpecName = GetSpecName
JL.GetSpecShortName = GetSpecShortName
JL.GetSpecIcon = GetSpecIcon
JL.GetSpecBgColor = GetSpecBgColor
JL.GetPlayerClassSpecIds = GetPlayerClassSpecIds
JL.GetActiveTalentSpecId = GetActiveTalentSpecId
JL.ListBoardSpecIds = ListBoardSpecIds
JL.BuildDisplaySlots = BuildDisplaySlots
JL.ScanOwnedGear = ScanOwnedGear
JL.OpenBisImportUI = OpenBisImportUI
JL.RemoveImportedItem = RemoveImportedItem
JL.AddImportedItem = AddImportedItem
JL.BuildMythMaxItemLink = BuildMythMaxItemLink
JL.QualityFromLink = QualityFromLink
JL.SLOT_ORDER = SLOT_ORDER
JL.SLOT_LABEL = SLOT_LABEL
JL.ILVL_STEPS = ILVL_STEPS
JL.ILVL_MIN = ILVL_MIN
JL.ILVL_MAX = ILVL_MAX
JL.RefreshSlotBoard = function()
  RefreshSlotBoard()
end
