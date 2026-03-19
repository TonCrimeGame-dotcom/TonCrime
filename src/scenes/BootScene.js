
import { supabase } from "../supabase.js";

const PUBLIC_CHAT_LINES = [
  "selam millet",
  "trade tarafı bugün hareketli",
  "listinglere bakın yeni ürün var",
  "marketi takip edin",
  "birazdan tekrar gelirim",
  "pvp atacak var mı?",
  "fiyatlar değişmiş",
  "bugün şanslı hissediyorum",
  "coffeeshop stokları yenilenmiş",
  "black markette iyi ürün düştü",
  "legendary kovalıyorum",
  "uygun ürün bulan yazsın",
];

const PVP_SEARCH_LINES = [
  "pvp için online olan var mı?",
  "arena için rakip lazım",
  "iq arena dönüyor mu?",
  "slot arena isteyen var mı?",
  "kafes dövüşü atacak var mı?",
];

const PVP_REPLY_LINES = [
  "var ben hazırım",
  "ben onlineyım gel",
  "arena açık geliyorsan gir",
  "rakip var, pvp aç",
  "slot arena deneyelim",
  "iq arena için ben varım",
];

const SYSTEM_ACTIVITY_LINES = [
  "markette fiyat düşüşü gördü",
  "rare ürün buldu",
  "pvp kuyruğuna girdi",
  "işletme stoklarını topladı",
  "legendary peşinde geziyor",
  "pazarda fırsat kolluyor",
];

const BOT_CATALOG = [
  { itemName: "Night Whiskey", icon: "🥃", rarity: "common", price: 27, energyGain: 7, usable: true, desc: "Hızlı enerji ürünü." },
  { itemName: "Club Champagne", icon: "🍾", rarity: "rare", price: 45, energyGain: 13, usable: true, desc: "Lüks içki." },
  { itemName: "VIP Pass", icon: "🎟️", rarity: "epic", price: 88, energyGain: 0, usable: false, desc: "Özel koleksiyon ürünü." },
  { itemName: "OG Kush", icon: "🍁", rarity: "rare", price: 35, energyGain: 11, usable: true, desc: "Coffeeshop ürünü." },
  { itemName: "Moon Rocks", icon: "🌿", rarity: "epic", price: 62, energyGain: 18, usable: true, desc: "Nadir ürün." },
  { itemName: "VIP Companion", icon: "💋", rarity: "epic", price: 95, energyGain: 22, usable: true, desc: "Yüksek enerji itemi." },
  { itemName: "Deluxe Service", icon: "🌹", rarity: "legendary", price: 160, energyGain: 30, usable: true, desc: "En üst seviye ürün." }
];

const CLANS = ["CJ", "WOLF", "VOID", "NOVA", "RAVN", "MOB", "KNG", "X"];
const BOT_NAMES = [
  "ShadowWolf","NightViper","GhostMafia","RicoVane","IronFist","VoltKral","SlyRaven","BlackMamba",
  "CrimsonJack","DarkVenom","SteelFang","SilentWolf","BlueViper","NeonGhost","FrostBite","WildRaven",
  "TurboKhan","NightTiger","GhostRider","RavenX","KingMafia","ZeroWolf","RedSkull","NovaAce",
  "SavageFox","Vortex","Cipher","AshCrow","BlazeKhan","StormJack","HexRaven","VoidMafia",
  "PixelWolf","DarkRico","PhantomCJ","GrimFang","ToxicNova","VoltGhost","MambaX","IronCrow",
  "AlphaVoid","Obsidian","TurboGhost","FeralWolf","NightCrow","GhostNova","DriftJack","SableKhan",
  "SilentViper","GrimKral","AshMafia","RogueWolf","FuryRaven","DeltaGhost","BlackKhan","VenomCJ",
  "RedMamba","IceWolf","NovaMafia","StormViper","DarkFang","FrostJack","WildGhost","ZeroCrow"
];

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { const out = arr.slice(); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }

function makeBot(idx, existing = {}) {
  const name = BOT_NAMES[idx % BOT_NAMES.length] + (idx >= BOT_NAMES.length ? `${idx}` : "");
  return {
    id: existing.id || `bot_${idx}_${name.toLowerCase()}`,
    name,
    username: name,
    clan: existing.clan || choice(CLANS),
    online: typeof existing.online === "boolean" ? existing.online : Math.random() < 0.55,
    archetype: existing.archetype || choice(["trader","buyer","seller","flipper","pvp"]),
    premium: typeof existing.premium === "boolean" ? existing.premium : Math.random() < 0.18,
    level: Number(existing.level || (35 + Math.floor(Math.random() * 45))),
    rating: Number(existing.rating || (900 + Math.floor(Math.random() * 900))),
    wins: Number(existing.wins || Math.floor(Math.random() * 80)),
    losses: Number(existing.losses || Math.floor(Math.random() * 80)),
    shopId: existing.shopId || `bot_shop_${idx}_${name.toLowerCase()}`,
    lastSeenAt: Number(existing.lastSeenAt || Date.now()),
    isBot: true,
  };
}

function normalizeBots(existing = []) {
  const existingMap = new Map((existing || []).map((b) => [String(b.username || b.name), b]));
  const bots = [];
  for (let i = 0; i < 64; i++) {
    const seed = makeBot(i, existingMap.get(BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? `${i}` : "")) || {});
    bots.push(seed);
  }
  return bots;
}

function botMeta(bot) {
  return {
    username: bot.name,
    isBot: true,
    online: !!bot.online,
    premium: !!bot.premium,
    clan: bot.clan || "",
    level: Number(bot.level || 1),
    rating: Number(bot.rating || 1000),
    wins: Number(bot.wins || 0),
    losses: Number(bot.losses || 0),
  };
}

async function insertMessage({ username, text, msg_type = "chat", is_bot = true, player_meta = null }) {
  const payload = { username, text, msg_type, is_bot, player_meta: player_meta || null };
  try {
    await supabase.from("chat_messages").insert(payload);
  } catch (err) {
    console.error("[BotEngine] chat insert failed:", err);
  }
}

async function fetchDbBots() {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,username,is_bot,bot_online,clan_tag,premium,level,pvp_rating,pvp_wins,pvp_losses,last_seen_at")
      .eq("is_bot", true)
      .order("username", { ascending: true })
      .limit(128);
    if (error) throw error;
    return (data || []).map((row, idx) => makeBot(idx, {
      id: row.id || undefined,
      username: row.username,
      name: row.username,
      online: row.bot_online !== false,
      clan: row.clan_tag || choice(CLANS),
      premium: !!row.premium,
      level: Number(row.level || 1),
      rating: Number(row.pvp_rating || 1000),
      wins: Number(row.pvp_wins || 0),
      losses: Number(row.pvp_losses || 0),
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).getTime() : Date.now(),
    }));
  } catch (err) {
    console.error("[BotEngine] fetchDbBots failed:", err);
    return [];
  }
}

async function seedDbBots(bots) {
  try {
    const { data: existing, error: existingErr } = await supabase
      .from("profiles")
      .select("username")
      .eq("is_bot", true);
    if (existingErr) throw existingErr;
    const names = new Set((existing || []).map((x) => String(x.username || "").trim()).filter(Boolean));
    const missing = bots.filter((b) => !names.has(b.username)).map((b) => ({
      username: b.username,
      is_bot: true,
      bot_online: !!b.online,
      clan_tag: b.clan,
      premium: !!b.premium,
      level: b.level,
      pvp_rating: b.rating,
      pvp_wins: b.wins,
      pvp_losses: b.losses,
      last_seen_at: new Date(b.lastSeenAt).toISOString(),
    }));
    if (missing.length) {
      const { error: insertErr } = await supabase.from("profiles").insert(missing);
      if (insertErr) throw insertErr;
    }
  } catch (err) {
    console.error("[BotEngine] seedDbBots failed:", err);
  }
}

async function updateDbBot(bot) {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        bot_online: !!bot.online,
        clan_tag: bot.clan || "",
        premium: !!bot.premium,
        level: Number(bot.level || 1),
        pvp_rating: Number(bot.rating || 1000),
        pvp_wins: Number(bot.wins || 0),
        pvp_losses: Number(bot.losses || 0),
        last_seen_at: new Date(bot.lastSeenAt || Date.now()).toISOString(),
      })
      .eq("username", bot.username)
      .eq("is_bot", true);
    if (error) throw error;
  } catch (err) {
    console.error("[BotEngine] updateDbBot failed:", err);
  }
}

function emitProfiles(bots) {
  try {
    window.dispatchEvent(new CustomEvent("tc:bot:profiles", { detail: { bots: bots.map((b) => ({ name: b.name, ...botMeta(b) })) } }));
  } catch (_) {}
}

function ensureBotShop(shop, bot) {
  if (shop) return { ...shop, ownerId: bot.id, ownerName: bot.name, online: !!bot.online, totalListings: Number(shop.totalListings || 0) };
  const type = choice(["nightclub","coffeeshop","brothel","blackmarket"]);
  return {
    id: bot.shopId,
    businessId: bot.shopId.replace("bot_shop_", "bot_business_"),
    type,
    icon: type === "nightclub" ? "🌃" : type === "coffeeshop" ? "🌿" : type === "brothel" ? "💋" : "🕶️",
    name: `${bot.name} Market`,
    ownerId: bot.id,
    ownerName: bot.name,
    online: !!bot.online,
    theme: "dark",
    rating: 4.1 + Math.random() * 0.8,
    totalListings: 0,
  };
}

function ensureMarketSeed(state, bots) {
  const market = state.market || { shops: [], listings: [] };
  const shops = Array.isArray(market.shops) ? market.shops.map((x) => ({ ...x })) : [];
  const listings = Array.isArray(market.listings) ? market.listings.map((x) => ({ ...x })) : [];
  for (const bot of bots) {
    const idx = shops.findIndex((x) => x.id === bot.shopId);
    const ensured = ensureBotShop(idx >= 0 ? shops[idx] : null, bot);
    if (idx >= 0) shops[idx] = ensured; else shops.push(ensured);
    const own = listings.filter((x) => x.shopId === bot.shopId);
    if (!own.length) {
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const item = choice(BOT_CATALOG);
        listings.unshift({
          id: `bot_listing_${bot.id}_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          shopId: bot.shopId,
          icon: item.icon,
          itemName: item.itemName,
          rarity: item.rarity,
          stock: 1 + Math.floor(Math.random() * 12),
          price: Math.max(1, item.price + Math.floor(Math.random() * 11) - 5),
          energyGain: item.energyGain,
          usable: item.usable,
          desc: item.desc,
          botOwned: true,
        });
      }
    }
  }
  for (const shop of shops) shop.totalListings = listings.filter((x) => x.shopId === shop.id).length;
  return { shops, listings };
}

function mutatePresence(bots) {
  const now = Date.now();
  const next = bots.map((bot) => {
    const toggleChance = bot.online ? 0.20 : 0.30;
    let online = bot.online;
    if (Math.random() < toggleChance) online = !online;
    return { ...bot, online, lastSeenAt: online ? now : Number(bot.lastSeenAt || now) };
  });
  let onlineCount = next.filter((x) => x.online).length;
  if (onlineCount < 8) {
    for (const bot of next) {
      if (!bot.online && Math.random() < 0.8) {
        bot.online = true;
        onlineCount += 1;
        if (onlineCount >= 8) break;
      }
    }
  }
  if (onlineCount > 20) {
    for (const bot of next) {
      if (bot.online && Math.random() < 0.5) {
        bot.online = false;
        onlineCount -= 1;
        if (onlineCount <= 20) break;
      }
    }
  }
  return next;
}

function marketAction(state, bots) {
  const market = state.market || { shops: [], listings: [] };
  const shops = (market.shops || []).map((x) => ({ ...x }));
  const listings = (market.listings || []).map((x) => ({ ...x }));
  const onlineBots = bots.filter((x) => x.online);
  if (!onlineBots.length) return { shops, listings, activity: null, actor: null, type: "market" };
  const actor = choice(onlineBots);
  for (const bot of bots) {
    const shopIdx = shops.findIndex((x) => x.id === bot.shopId);
    if (shopIdx >= 0) shops[shopIdx] = { ...shops[shopIdx], online: !!bot.online, ownerName: bot.name };
  }
  const mode = choice(["price","buy","sell","restock","event"]);
  if (mode === "price" && listings.length) {
    const target = choice(listings);
    target.price = Math.max(1, Number(target.price || 1) + Math.floor(Math.random() * 7) - 3);
    return { shops, listings, activity: `${actor.name} market fiyatını güncelledi`, actor, type: "market" };
  }
  if (mode === "buy") {
    const available = listings.filter((x) => x.shopId !== actor.shopId && Number(x.stock || 0) > 0);
    if (available.length) {
      const target = choice(available);
      target.stock = Math.max(0, Number(target.stock || 0) - 1);
      return { shops, listings, activity: `${actor.name} ${target.itemName} satın aldı`, actor, type: "market" };
    }
  }
  if (mode === "restock") {
    const own = listings.filter((x) => x.shopId === actor.shopId);
    if (own.length) {
      const target = choice(own);
      target.stock = clamp(Number(target.stock || 0) + 1 + Math.floor(Math.random() * 4), 1, 99);
      return { shops, listings, activity: `${actor.name} stoğunu yeniledi`, actor, type: "market" };
    }
  }
  if (mode === "event") {
    return { shops, listings, activity: `${actor.name} ${choice(SYSTEM_ACTIVITY_LINES)}`, actor, type: choice(["system","pvp","market"]) };
  }
  const item = choice(BOT_CATALOG);
  listings.unshift({
    id: `bot_listing_${actor.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    shopId: actor.shopId,
    icon: item.icon,
    itemName: item.itemName,
    rarity: item.rarity,
    stock: 1 + Math.floor(Math.random() * 12),
    price: Math.max(1, item.price + Math.floor(Math.random() * 11) - 5),
    energyGain: item.energyGain,
    usable: item.usable,
    desc: item.desc,
    botOwned: true,
  });
  return { shops, listings, activity: `${actor.name} pazara yeni ürün koydu`, actor, type: "market" };
}

export function startBotEngine(store) {
  if (!store || window.__tcBotEngineStarted) return window.__tcBotEngine;
  window.__tcBotEngineStarted = true;

  const runtime = { lastReplyAt: 0, channel: null };

  function setState(patch) {
    store.set(patch);
    emitProfiles(normalizeBots(store.get()?.bots || []));
  }

  async function bootstrap() {
    const state = store.get() || {};
    let bots = await fetchDbBots();
    if (!bots.length) {
      bots = normalizeBots(state.bots);
      await seedDbBots(bots);
      const retry = await fetchDbBots();
      if (retry.length) bots = retry;
    } else {
      const normalized = normalizeBots(bots);
      await seedDbBots(normalized);
      bots = normalized;
    }
    const botState = { enabled: true, bootstrapped: true, lastPresenceAt: Date.now(), lastMarketAt: Date.now(), lastChatAt: Date.now(), ...(state.botState || {}) };
    const marketSeed = ensureMarketSeed(state, bots);
    setState({ bots, botState, market: { ...(state.market || {}), shops: marketSeed.shops, listings: marketSeed.listings } });
  }

  async function pushSystem(text, type = "system") {
    await insertMessage({ username: "SYSTEM", text, msg_type: type, is_bot: true, player_meta: { username: "SYSTEM", isBot: true, online: true, clan: "SYS", premium: false, level: 99, rating: 9999, wins: 0, losses: 0 } });
  }

  async function pushBotLine(bot, text, type = "chat") {
    await insertMessage({ username: bot.name, text, msg_type: type, is_bot: true, player_meta: botMeta(bot) });
  }

  async function tickPresence() {
    const state = store.get() || {};
    if (state.botState?.enabled === false) return;
    const prevBots = normalizeBots(state.bots);
    const bots = mutatePresence(prevBots);
    const shops = (state.market?.shops || []).map((shop) => {
      const bot = bots.find((b) => b.shopId === shop.id);
      return bot ? { ...shop, online: !!bot.online, ownerName: bot.name } : shop;
    });
    setState({ bots, botState: { ...(state.botState || {}), lastPresenceAt: Date.now() }, market: { ...(state.market || {}), shops } });

    const changed = [];
    for (let i = 0; i < bots.length; i++) {
      if (!!bots[i].online !== !!prevBots[i]?.online) changed.push(bots[i]);
    }
    for (const bot of changed.slice(0, 2)) {
      await updateDbBot(bot);
      if (Math.random() < 0.85) await pushSystem(`${bot.name} ${bot.online ? "oyuna girdi" : "oyundan çıktı"}`, "presence");
    }
  }

  async function tickMarket() {
    const state = store.get() || {};
    if (state.botState?.enabled === false) return;
    const bots = normalizeBots(state.bots);
    const next = marketAction(state, bots);
    for (const shop of next.shops) shop.totalListings = next.listings.filter((x) => x.shopId === shop.id).length;
    setState({ market: { ...(state.market || {}), shops: next.shops, listings: next.listings }, botState: { ...(state.botState || {}), lastMarketAt: Date.now() } });
    if (next.activity) await pushSystem(next.activity, next.type || "market");
  }

  async function tickChat() {
    const state = store.get() || {};
    if (state.botState?.enabled === false) return;
    const bots = normalizeBots(state.bots).filter((x) => x.online);
    if (!bots.length) return;
    const bot = choice(bots);
    const linePool = Math.random() < 0.28 ? PVP_SEARCH_LINES : PUBLIC_CHAT_LINES;
    await pushBotLine(bot, choice(linePool));
    setState({ botState: { ...(state.botState || {}), lastChatAt: Date.now() } });
  }

  function subscribeReplies() {
    try { runtime.channel?.unsubscribe?.(); } catch (_) {}
    runtime.channel = supabase
      .channel("toncrime-bot-replies")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload) => {
        const msg = payload?.new;
        if (!msg || msg.is_bot) return;
        const lower = String(msg.text || "").toLowerCase();
        const state = store.get() || {};
        const bots = normalizeBots(state.bots).filter((x) => x.online);
        if (!bots.length) return;
        if (Date.now() - runtime.lastReplyAt < 4000) return;
        let replyChance = 0;
        let lines = PUBLIC_CHAT_LINES;
        if (lower.includes("pvp") && lower.includes("online")) {
          replyChance = 0.85;
          lines = PVP_REPLY_LINES;
        } else if (lower.includes("arena") || lower.includes("rakip")) {
          replyChance = 0.7;
          lines = PVP_REPLY_LINES;
        } else if (lower.includes("trade") || lower.includes("market") || lower.includes("listing")) {
          replyChance = 0.5;
          lines = PUBLIC_CHAT_LINES;
        }
        if (!replyChance || Math.random() > replyChance) return;
        runtime.lastReplyAt = Date.now();
        const bot = choice(bots);
        setTimeout(() => { pushBotLine(bot, choice(lines)); }, 1000 + Math.floor(Math.random() * 2500));
      })
      .subscribe();
  }

  bootstrap();
  subscribeReplies();

  const presenceTimer = setInterval(() => { tickPresence(); }, 9000);
  const marketTimer = setInterval(() => { if (Math.random() < 0.85) tickMarket(); }, 12000);
  const chatTimer = setInterval(() => { if (Math.random() < 0.78) tickChat(); }, 10000);

  window.__tcBotEngine = {
    stop() {
      clearInterval(presenceTimer); clearInterval(marketTimer); clearInterval(chatTimer);
      try { runtime.channel?.unsubscribe?.(); } catch (_) {}
      window.__tcBotEngineStarted = false;
    },
    bootstrap, tickPresence, tickMarket, tickChat,
  };

  window.tcBots = window.__tcBotEngine;
  return window.__tcBotEngine;
}
