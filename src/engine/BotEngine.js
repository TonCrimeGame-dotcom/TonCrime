const BOT_ROSTER_VERSION = "2026-04-13-rivals-1";
const BOT_COUNT = 96;
const RECENT_OPPONENT_LIMIT = 18;

const FIRST_NAMES = [
  "Vito", "Rico", "Dante", "Nero", "Mako", "Santos", "Kobra", "Raven",
  "Knox", "Milo", "Axel", "Bora", "Razor", "Ghost", "Diesel", "Baron",
  "Mamba", "Sable", "Frost", "Kiro", "Vector", "Lupo", "Moss", "Shade",
];

const TAGS = [
  "Black", "Neon", "Iron", "Night", "Red", "Silent", "Metro", "Chrome",
  "East", "West", "Low", "High", "Dirty", "Royal", "Urban", "Velvet",
];

const CLANS = [
  { tag: "NCR", name: "Neon Cartel" },
  { tag: "BLK", name: "Black Lotus" },
  { tag: "RDX", name: "Red District" },
  { tag: "VPR", name: "Viper Ring" },
  { tag: "KNG", name: "King Row" },
  { tag: "OBD", name: "Obsidian Yard" },
  { tag: "MRK", name: "Market Kings" },
  { tag: "ASH", name: "Ash Syndicate" },
];

const WEAPONS = {
  weak: ["Baslangic Bicagi", "Glock 17", "Baretta", "MP5", "Moss"],
  arena: ["G3", "M4A1", "SCAR", "Dragunov", "Barrett"],
  blackMarket: ["M134", "RPG", "Golden SCAR", "Obsidian M4A1", "Royal Barrett"],
};

const BUSINESS_NAMES = {
  coffeeshop: ["Velvet Brew", "Night Roast", "Back Alley Beans", "Street Cup"],
  nightclub: ["Noir Room", "Pulse 404", "Gold Vibe", "Afterglow"],
  blackmarket: ["Chrome Yard", "Hidden Dock", "Raven Depot", "Ash Market"],
};

const BIO_LINES = {
  weak: [
    "Yeni mahallelerden cikmis, hizli para ve ilk galibiyet pesinde.",
    "Risk alir ama bazen panikler. Arena ritmini yeni yeni cozuyor.",
    "Kucuk islerle basladi, PvP kaydi hala dalgali.",
  ],
  arena: [
    "Arena gecmisinde sert rakiplerle oynadi. Savunmasi kolay kirilmaz.",
    "Kafes dovuslerinde sabirli oynar, hata kollamayi sever.",
    "Yuksek tempolu maclarda kendini belli eden bir rakip.",
  ],
  blackMarket: [
    "Black Market aginda bilinen bir isim. Sermayesi ve baglantilari guclu.",
    "Bina sahipligi ve premium avantajiyla ust seviye rakiplerden.",
    "Pazar gucu yuksek, kaybettiginde bile pahali ders birakir.",
  ],
};

const CHAT_LINES = [
  "Pazar bugun hareketli.",
  "Arena icin dengeli rakip ariyorum.",
  "Black Market fiyatlari yine oynadi.",
  "Kafes bugun sert.",
  "Premium isler hizlandi.",
  "Clan siralamasinda yer aciliyor.",
  "Bu gece rakip bekliyorum.",
];

function hashString(value) {
  let h = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let x = seed >>> 0;
  return function rng() {
    x += 0x6d2b79f5;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)] || arr[0];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function makeUsername(idx, rng) {
  const left = pick(TAGS, rng);
  const right = pick(FIRST_NAMES, rng);
  const suffix = idx % 3 === 0 ? String(10 + Math.floor(rng() * 89)) : "";
  return `${left}${right}${suffix}`;
}

function getBotKind(idx) {
  if (idx < 18) return "blackMarket";
  if (idx < 42) return "arena";
  return "weak";
}

function getKindLabel(kind) {
  if (kind === "blackMarket") return "Black Market Rivals";
  if (kind === "arena") return "Arena Rakipleri";
  return "Sokak Rakipleri";
}

function getDifficulty(kind, idx, rng) {
  if (kind === "blackMarket") return clamp(82 + Math.floor(rng() * 18) + (idx % 4), 80, 99);
  if (kind === "arena") return clamp(58 + Math.floor(rng() * 24) + (idx % 3), 55, 84);
  return clamp(18 + Math.floor(rng() * 34), 14, 54);
}

function makeBusiness(kind, idx, rng) {
  if (kind === "weak" && rng() < 0.72) return [];

  const count = kind === "blackMarket" ? 2 + Math.floor(rng() * 2) : 1;
  const types = kind === "blackMarket"
    ? ["blackmarket", "nightclub", "coffeeshop"]
    : ["coffeeshop", "nightclub"];

  return Array.from({ length: count }, (_, bIdx) => {
    const type = types[(idx + bIdx) % types.length];
    const pool = BUSINESS_NAMES[type] || BUSINESS_NAMES.blackmarket;
    const level = kind === "blackMarket" ? 4 + Math.floor(rng() * 5) : 1 + Math.floor(rng() * 4);
    return {
      id: `bot_biz_${idx}_${bIdx}`,
      type,
      name: pick(pool, rng),
      level,
      incomePerHour: Math.round((kind === "blackMarket" ? 70 : 24) * level + rng() * 80),
      reputation: clamp(58 + level * 7 + Math.floor(rng() * 18), 40, 99),
    };
  });
}

function makeRecentMatches(kind, username, rng) {
  const count = kind === "weak" ? 5 + Math.floor(rng() * 7) : 8 + Math.floor(rng() * 10);
  const winBias = kind === "blackMarket" ? 0.74 : kind === "arena" ? 0.62 : 0.42;
  return Array.from({ length: count }, (_, i) => {
    const won = rng() < winBias;
    return {
      id: `${username}_hist_${i}`,
      opponent: makeUsername(200 + i + Math.floor(rng() * 500), rng),
      result: won ? "win" : "loss",
      mode: pick(["iq_arena", "cage_fight", "slot_arena"], rng),
      at: Date.now() - Math.floor((i + 1) * (35 + rng() * 220) * 60 * 1000),
    };
  });
}

function makeBot(idx, existing = {}) {
  const kind = existing.kind || getBotKind(idx);
  const rng = makeRng(hashString(`${BOT_ROSTER_VERSION}:${idx}:${kind}`));
  const username = String(existing.username || existing.name || makeUsername(idx, rng)).trim();
  const difficulty = Number(existing.difficulty || getDifficulty(kind, idx, rng));
  const clanMeta = existing.clanMeta || pick(CLANS, rng);
  const premium = typeof existing.premium === "boolean"
    ? existing.premium
    : kind === "blackMarket" || (kind === "arena" && rng() < 0.38) || rng() < 0.08;
  const levelBase = kind === "blackMarket" ? 34 : kind === "arena" ? 16 : 1;
  const levelSpread = kind === "blackMarket" ? 38 : kind === "arena" ? 28 : 18;
  const level = Math.max(0, Number(existing.level ?? (levelBase + Math.floor(rng() * levelSpread))));
  const wins = Math.max(0, Number(existing.wins ?? Math.floor(difficulty * (1.2 + rng() * 3.6))));
  const losses = Math.max(0, Number(existing.losses ?? Math.floor((100 - difficulty) * (0.8 + rng() * 2.2))));
  const rating = Math.max(100, Number(existing.rating ?? Math.round(760 + difficulty * 13 + wins * 1.7 - losses * 0.9)));
  const weaponPool = kind === "blackMarket" ? WEAPONS.blackMarket : kind === "arena" ? WEAPONS.arena : WEAPONS.weak;
  const businesses = Array.isArray(existing.businesses) && existing.businesses.length
    ? existing.businesses
    : makeBusiness(kind, idx, rng);

  return {
    id: existing.id || `bot_${kind}_${idx}_${username.toLowerCase()}`,
    rosterVersion: BOT_ROSTER_VERSION,
    name: username,
    username,
    kind,
    group: getKindLabel(kind),
    difficulty,
    isBot: true,
    economyLocked: true,
    leaderboardEligible: false,
    canWithdraw: false,
    canTradeRealMarket: false,
    online: typeof existing.online === "boolean" ? existing.online : rng() < (kind === "weak" ? 0.56 : 0.78),
    premium,
    level,
    rating,
    rank: rating,
    wins,
    losses,
    clan: existing.clan || clanMeta.tag,
    clanName: existing.clanName || clanMeta.name,
    weaponName: existing.weaponName || pick(weaponPool, rng),
    weaponBonus: existing.weaponBonus || `+${Math.max(2, Math.floor(difficulty / 6))}%`,
    ytonDisplay: Number(existing.ytonDisplay ?? Math.round((kind === "blackMarket" ? 8400 : kind === "arena" ? 2600 : 240) + rng() * (kind === "weak" ? 900 : 7400))),
    lastSeenMinutes: Number(existing.lastSeenMinutes ?? Math.max(2, Math.floor(rng() * (kind === "weak" ? 420 : 80)))),
    profileNote: existing.profileNote || pick(BIO_LINES[kind] || BIO_LINES.weak, rng),
    businesses,
    performance: {
      aggression: Number(existing.performance?.aggression ?? clamp(30 + difficulty + Math.floor(rng() * 20) - 10, 20, 98)),
      defense: Number(existing.performance?.defense ?? clamp(20 + difficulty + Math.floor(rng() * 18) - 9, 18, 96)),
      risk: Number(existing.performance?.risk ?? clamp(26 + Math.floor(rng() * 60), 20, 92)),
      reactionMs: Number(existing.performance?.reactionMs ?? clamp(1450 - difficulty * 9 + Math.floor(rng() * 360), 420, 1700)),
      mistakeRate: Number(existing.performance?.mistakeRate ?? clamp((100 - difficulty) / 120, 0.04, 0.58)),
      playerWinChance: Number(
        existing.performance?.playerWinChance ??
        (kind === "blackMarket" ? 0.32 : kind === "arena" ? 0.45 : 0.68)
      ),
    },
    recentMatches: Array.isArray(existing.recentMatches) && existing.recentMatches.length
      ? existing.recentMatches.slice(0, 12)
      : makeRecentMatches(kind, username, rng),
    createdAt: Number(existing.createdAt || Date.now() - Math.floor((idx + 10) * 86400000 * (1 + rng() * 2))),
  };
}

function normalizeBots(existing = []) {
  const list = Array.isArray(existing) ? existing : [];
  const byId = new Map(list.map((bot) => [String(bot?.id || ""), bot]).filter(([id]) => id));
  const bots = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    const seed = makeBot(i, {});
    const current = byId.get(seed.id);
    bots.push(makeBot(i, current?.rosterVersion === BOT_ROSTER_VERSION ? current : seed));
  }
  return bots;
}

function getRecentResults(state) {
  return (Array.isArray(state?.pvp?.recentMatches) ? state.pvp.recentMatches : [])
    .slice(0, 8)
    .map((match) => String(match?.result || "").toLowerCase());
}

function countLeading(results, target) {
  let n = 0;
  for (const result of results) {
    if (result !== target) break;
    n += 1;
  }
  return n;
}

function getPlayerSkill(state) {
  const player = state?.player || {};
  const pvp = state?.pvp || {};
  const level = Math.max(0, Number(player.level ?? 0));
  const rating = Math.max(100, Number(pvp.rating || 1000));
  const wins = Math.max(0, Number(pvp.wins || 0));
  const losses = Math.max(0, Number(pvp.losses || 0));
  const total = wins + losses;
  const winRate = total ? wins / total : 0.5;
  return clamp(level * 3.2 + (rating - 800) / 18 + winRate * 30, 0, 100);
}

function desiredBotKind(state, mode = "grid", source = "general") {
  const results = getRecentResults(state);
  const lossStreak = countLeading(results, "loss");
  const winStreak = countLeading(results, "win");
  const playerLevel = Math.max(0, Number(state?.player?.level ?? 0));
  const stake = Number(state?.pvp?.betStake || state?.pvp?.entryStake || 0);

  if (lossStreak >= 2 || playerLevel < 4) return "weak";
  if (mode === "arena" && (playerLevel >= 16 || winStreak >= 3)) return "arena";
  if ((source === "trade" || source === "blackmarket" || stake >= 30 || playerLevel >= 34) && winStreak >= 2) {
    return "blackMarket";
  }
  if (winStreak >= 4) return "blackMarket";
  if (winStreak >= 2 || playerLevel >= 12) return "arena";
  return "weak";
}

function scoreBotCandidate(bot, state, mode, source, recentIds) {
  const skill = getPlayerSkill(state);
  const targetKind = desiredBotKind(state, mode, source);
  const kindPenalty = bot.kind === targetKind ? 0 : bot.kind === "weak" ? 16 : 9;
  const recentPenalty = recentIds.includes(bot.id) ? 999 : 0;
  const difficultyGap = Math.abs(Number(bot.difficulty || 0) - (targetKind === "weak" ? Math.max(16, skill + 8) : targetKind === "arena" ? skill + 18 : skill + 30));
  const levelGap = Math.abs(Number(bot.level || 0) - Math.max(0, Number(state?.player?.level ?? 0)));
  return recentPenalty + kindPenalty + difficultyGap * 1.4 + levelGap * 0.35 + Math.random() * 12;
}

function buildOpponentPayload(bot, mode) {
  return {
    ...bot,
    username: bot.username,
    level: Number(bot.level || 0),
    rank: Number(bot.rating || bot.rank || 1000),
    isBot: true,
    isRival: true,
    mode,
    botTuning: {
      kind: bot.kind,
      difficulty: Number(bot.difficulty || 40),
      reactionMs: Number(bot.performance?.reactionMs || 1000),
      mistakeRate: Number(bot.performance?.mistakeRate || 0.25),
      playerWinChance: Number(bot.performance?.playerWinChance || 0.58),
    },
  };
}

function emitProfiles(bots) {
  try {
    window.dispatchEvent(new CustomEvent("tc:bot:profiles", { detail: { bots } }));
  } catch (_) {}
}

function emitLocalChat(bot, text, type = "chat") {
  try {
    window.dispatchEvent(
      new CustomEvent("tc:chat:local-message", {
        detail: {
          username: bot?.name || "SYSTEM",
          text,
          msg_type: type,
          player_meta: {
            username: bot?.name || "SYSTEM",
            isBot: true,
            online: bot?.online !== false,
            premium: !!bot?.premium,
            clan: bot?.clan || "SYS",
            clanName: bot?.clanName || "",
            level: Number(bot?.level || 0),
            rating: Number(bot?.rating || 1000),
            wins: Number(bot?.wins || 0),
            losses: Number(bot?.losses || 0),
          },
        },
      })
    );
  } catch (_) {}
}

function updateBotResult(store, event) {
  const detail = event?.detail || {};
  const opponentName = String(detail.opponent || detail.username || "").trim();
  if (!opponentName || !store?.get || !store?.set) return;

  const playerWon = event.type === "tc:pvp:win";
  const state = store.get() || {};
  const bots = normalizeBots(state.bots || []);
  const idx = bots.findIndex((bot) => String(bot.username || "").toLowerCase() === opponentName.toLowerCase());
  if (idx < 0) return;

  const bot = { ...bots[idx] };
  bot.wins = Number(bot.wins || 0) + (playerWon ? 0 : 1);
  bot.losses = Number(bot.losses || 0) + (playerWon ? 1 : 0);
  bot.rating = clamp(Number(bot.rating || 1000) + (playerWon ? -10 : 16), 100, 99999);
  bot.rank = bot.rating;
  bot.recentMatches = [
    {
      id: `bot_live_${Date.now()}`,
      opponent: String(state?.player?.username || "Player"),
      result: playerWon ? "loss" : "win",
      mode: detail.mode || "pvp",
      at: Date.now(),
    },
    ...(Array.isArray(bot.recentMatches) ? bot.recentMatches : []),
  ].slice(0, 12);
  bots[idx] = bot;
  store.set({ bots });
  emitProfiles(bots);
}

export function startBotEngine(store) {
  if (!store || window.__tcBotEngineStarted) return window.__tcBotEngine;
  window.__tcBotEngineStarted = true;

  const currentState = store.get?.() || {};
  const bots = normalizeBots(currentState.bots || []);
  const botState = {
    ...(currentState.botState || {}),
    enabled: true,
    bootstrapped: true,
    rosterVersion: BOT_ROSTER_VERSION,
    lastPresenceAt: Date.now(),
    recentOpponentIds: Array.isArray(currentState.botState?.recentOpponentIds)
      ? currentState.botState.recentOpponentIds.slice(0, RECENT_OPPONENT_LIMIT)
      : [],
  };

  const runtime = {
    presenceTimer: null,
    chatTimer: null,
    resultHandlers: [],
  };

  store.set({ bots, botState });
  emitProfiles(bots);

  runtime.presenceTimer = setInterval(() => {
    const latest = store.get?.() || {};
    const current = normalizeBots(latest.bots || bots).map((bot) => ({ ...bot }));
    const idx = Math.floor(Math.random() * current.length);
    if (current[idx]) {
      const strong = current[idx].kind === "arena" || current[idx].kind === "blackMarket";
      current[idx].online = Math.random() < (strong ? 0.82 : 0.58);
      current[idx].lastSeenMinutes = current[idx].online ? Math.floor(Math.random() * 9) + 1 : Math.floor(Math.random() * 360) + 12;
    }
    store.set({
      bots: current,
      botState: {
        ...(latest.botState || {}),
        enabled: true,
        bootstrapped: true,
        rosterVersion: BOT_ROSTER_VERSION,
        lastPresenceAt: Date.now(),
      },
    });
    emitProfiles(current);
  }, 14000);

  runtime.chatTimer = setInterval(() => {
    const current = store.get?.()?.bots || bots;
    const onlineBots = current.filter((b) => b?.online !== false);
    if (!onlineBots.length) return;
    const bot = onlineBots[Math.floor(Math.random() * onlineBots.length)];
    emitLocalChat(bot, CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)], Math.random() < 0.14 ? "system" : "chat");
    store.set({
      botState: {
        ...(store.get?.()?.botState || {}),
        enabled: true,
        bootstrapped: true,
        rosterVersion: BOT_ROSTER_VERSION,
        lastChatAt: Date.now(),
      },
    });
  }, 22000);

  const handleWin = (event) => updateBotResult(store, event);
  const handleLoss = (event) => updateBotResult(store, event);
  window.addEventListener("tc:pvp:win", handleWin);
  window.addEventListener("tc:pvp:lose", handleLoss);
  runtime.resultHandlers.push(["tc:pvp:win", handleWin], ["tc:pvp:lose", handleLoss]);

  const api = {
    rosterVersion: BOT_ROSTER_VERSION,
    stop() {
      clearInterval(runtime.presenceTimer);
      clearInterval(runtime.chatTimer);
      for (const [eventName, handler] of runtime.resultHandlers) {
        window.removeEventListener(eventName, handler);
      }
    },
    listProfiles() {
      return normalizeBots(store.get?.()?.bots || bots);
    },
    getProfile(idOrUsername) {
      const key = String(idOrUsername || "").trim().toLowerCase();
      if (!key) return null;
      return this.listProfiles().find((bot) => {
        return String(bot.id || "").toLowerCase() === key || String(bot.username || "").toLowerCase() === key;
      }) || null;
    },
    pickOpponent(options = {}) {
      const latest = store.get?.() || {};
      const current = normalizeBots(latest.bots || bots);
      const recentIds = Array.isArray(latest.botState?.recentOpponentIds)
        ? latest.botState.recentOpponentIds.slice(0, RECENT_OPPONENT_LIMIT)
        : [];
      const mode = String(options.mode || latest?.pvp?.selectedMode || "grid");
      const source = String(options.source || latest?.pvp?.source || "general");
      const candidates = current
        .map((bot) => ({ bot, score: scoreBotCandidate(bot, latest, mode, source, recentIds) }))
        .sort((a, b) => a.score - b.score);
      const picked = candidates[0]?.bot || current[Math.floor(Math.random() * current.length)] || makeBot(0);
      const nextRecent = [picked.id, ...recentIds.filter((id) => id !== picked.id)].slice(0, RECENT_OPPONENT_LIMIT);
      store.set({
        bots: current,
        botState: {
          ...(latest.botState || {}),
          enabled: true,
          bootstrapped: true,
          rosterVersion: BOT_ROSTER_VERSION,
          lastPickedAt: Date.now(),
          lastPickedBotId: picked.id,
          recentOpponentIds: nextRecent,
        },
      });
      return buildOpponentPayload(picked, mode);
    },
    emitProfiles() {
      emitProfiles(this.listProfiles());
    },
  };

  window.__tcBotEngine = api;
  window.tcBotEngine = api;
  return api;
}

export default startBotEngine;
