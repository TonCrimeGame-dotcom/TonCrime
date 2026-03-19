const KEY_MSG = "toncrime_chat_messages_v2";

const PUBLIC_CHAT_LINES = [
  "selam millet",
  "markette uygun ürün var mı?",
  "bugün trade akıyor",
  "black markette fiyat düştü",
  "stok topladım birazdan satış açarım",
  "coffeeshop ürünleri iyi gidiyor",
  "bu gece pvp dönecek gibi",
  "listinglere bakın yeni şeyler var",
  "birazdan tekrar gelirim",
  "bugün şanslı hissediyorum",
  "marketi takip edin",
];

const PVP_REPLY_LINES = [
  "var ben onlineyim",
  "var 1v1 çıkar",
  "hazırsan gelirim",
  "şu an aktifim gel",
];

const BOT_CATALOG = [
  { itemName: "Night Whiskey", icon: "🥃", rarity: "common", price: 27, energyGain: 7, usable: true, desc: "Hızlı enerji ürünü." },
  { itemName: "Club Champagne", icon: "🍾", rarity: "rare", price: 45, energyGain: 13, usable: true, desc: "Lüks içki." },
  { itemName: "VIP Pass", icon: "🎟️", rarity: "epic", price: 88, energyGain: 0, usable: false, desc: "Özel koleksiyon ürünü." },
  { itemName: "OG Kush", icon: "🍁", rarity: "rare", price: 35, energyGain: 11, usable: true, desc: "Coffeeshop ürünü." },
  { itemName: "Moon Rocks", icon: "🌿", rarity: "epic", price: 62, energyGain: 18, usable: true, desc: "Nadir ürün." },
  { itemName: "VIP Companion", icon: "💋", rarity: "epic", price: 95, energyGain: 22, usable: true, desc: "Yüksek enerji itemi." },
  { itemName: "Deluxe Service", icon: "🌹", rarity: "legendary", price: 160, energyGain: 30, usable: true, desc: "En üst seviye ürün." },
];

const BOT_POOL = [
  ["ShadowWolf","trader","WOLF","🐺"],["NightViper","flipper","NV","🐍"],["GhostMafia","seller","GM","👻"],
  ["RicoVane","buyer","RV","🕶️"],["IronFist","buyer","IF","🥊"],["VoltKral","seller","VK","⚡"],
  ["SlyRaven","trader","SR","🦅"],["BlackMamba","flipper","BM","🐍"],["CrimsonJack","seller","CJ","🃏"],
  ["DarkVenom","buyer","DV","☠️"],["MafiaKing","seller","MK","👑"],["BlueViper","trader","BV","🧿"],
  ["SteelFang","buyer","SF","🦊"],["RedSkull","flipper","RS","💀"],["SilentWolf","seller","SW","🌙"],
  ["NeonGhost","trader","NG","🕯️"],["FrostBite","buyer","FB","❄️"],["WildRaven","seller","WR","🦅"],
  ["TurboKhan","flipper","TK","🔥"],["NovaStrike","buyer","NS","☄️"],["KobraHan","trader","KH","🐉"],
  ["ScarFace","seller","SC","😈"],["NightCobra","buyer","NC","🐍"],["ZeroMercy","flipper","ZM","🩸"],
  ["VenomBoy","seller","VB","🦂"],["LuckyDice","trader","LD","🎲"],["BalkanBoss","buyer","BB","🕴️"],
  ["StormRider","seller","ST","🌩️"],["NitroWolf","flipper","NW","🚀"],["HellCrow","trader","HC","🐦"],
  ["UrbanKing","seller","UK","🏙️"],["MertKing","buyer","ME","🦁"],["DeltaFox","flipper","DF","🦊"],
  ["ChromeAce","trader","CA","♠️"],["RapidKral","seller","RK","⚙️"],["IstanbulWolf","buyer","IW","🌉"]
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function loadChatMessages() {
  try {
    const raw = localStorage.getItem(KEY_MSG);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveChatMessages(arr) {
  try {
    localStorage.setItem(KEY_MSG, JSON.stringify(arr));
  } catch {}
}
function dispatchChatMessage(message) {
  const detail = {
    id: String(message.id || `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    user: String(message.user || "?"),
    text: String(message.text || ""),
    time: String(message.time || nowHHMM()),
    kind: String(message.kind || "chat"),
    systemType: String(message.systemType || "info"),
    premium: !!message.premium,
    clan: String(message.clan || ""),
    online: message.online !== false,
    profileId: String(message.profileId || ""),
    isBot: !!message.isBot,
  };
  const msgs = loadChatMessages();
  msgs.push(detail);
  if (msgs.length > 250) msgs.splice(0, msgs.length - 250);
  saveChatMessages(msgs);
  try {
    window.dispatchEvent(new CustomEvent("tc:chat:add", { detail }));
  } catch (_) {}
}
function botTemplates() {
  const now = Date.now();
  return BOT_POOL.map((row, index) => ({
    id: `bot_${row[0].toLowerCase()}`,
    name: row[0],
    online: index % 2 === 0,
    archetype: row[1],
    clan: row[2],
    avatar: row[3],
    coins: 4000 + Math.floor(Math.random() * 5000),
    energy: 22 + Math.floor(Math.random() * 28),
    shopId: `bot_shop_${row[0].toLowerCase()}`,
    premium: Math.random() < 0.22,
    level: 10 + Math.floor(Math.random() * 55),
    rating: 900 + Math.floor(Math.random() * 700),
    bio: choice([
      "Marketi sürekli takip ediyor.",
      "PvP ve ticaret arasında geziyor.",
      "Offline takılır ama fırsat görünce gelir.",
      "Şehirde uzun süredir aktif.",
      "Daha çok listing kovalar.",
    ]),
    lastSeenAt: now,
  }));
}
function normalizeBots(existing) {
  const defaults = botTemplates();
  const map = new Map((existing || []).map((b) => [b.id, b]));
  return defaults.map((b) => ({ ...b, ...(map.get(b.id) || {}) }));
}
function ensureBotShop(shop, bot) {
  if (shop) {
    return {
      ...shop,
      ownerId: bot.id,
      ownerName: bot.name,
      online: !!bot.online,
      totalListings: Number(shop.totalListings || 0),
    };
  }
  return {
    id: bot.shopId,
    businessId: bot.shopId.replace("bot_shop_", "bot_business_"),
    type: choice(["nightclub", "coffeeshop", "brothel", "blackmarket"]),
    icon: choice(["🌃", "🌿", "💋", "🕶️"]),
    name: `${bot.name} Market`,
    ownerId: bot.id,
    ownerName: bot.name,
    online: !!bot.online,
    theme: "dark",
    rating: 4.0 + Math.random() * 0.9,
    totalListings: 0,
  };
}
function ensureMarketSeed(state, bots) {
  const market = state.market || { shops: [], listings: [] };
  const shops = Array.isArray(market.shops) ? market.shops.map((x) => ({ ...x })) : [];
  const listings = Array.isArray(market.listings) ? market.listings.map((x) => ({ ...x })) : [];

  for (const bot of bots.slice(0, 20)) {
    const idx = shops.findIndex((x) => x.id === bot.shopId);
    const ensured = ensureBotShop(idx >= 0 ? shops[idx] : null, bot);
    if (idx >= 0) shops[idx] = ensured;
    else shops.push(ensured);

    const ownListings = listings.filter((x) => x.shopId === bot.shopId);
    if (!ownListings.length) {
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
          price: Math.max(1, item.price + Math.floor(Math.random() * 10 - 4)),
          energyGain: item.energyGain,
          usable: item.usable,
          desc: item.desc,
          botOwned: true,
        });
      }
    }
  }

  for (const shop of shops) {
    shop.totalListings = listings.filter((x) => x.shopId === shop.id).length;
  }

  return { shops, listings };
}
function marketAction(state, bots) {
  const market = state.market || { shops: [], listings: [] };
  const shops = (market.shops || []).map((x) => ({ ...x }));
  const listings = (market.listings || []).map((x) => ({ ...x }));
  const onlineBots = bots.filter((x) => x.online);
  if (!onlineBots.length) return { shops, listings, activity: null, systemType: "market" };

  for (const bot of bots) {
    const shopIdx = shops.findIndex((x) => x.id === bot.shopId);
    if (shopIdx >= 0) shops[shopIdx] = { ...shops[shopIdx], online: !!bot.online, ownerName: bot.name };
  }

  const actor = choice(onlineBots);
  const mode = choice(["price", "buy", "sell", "restock", "pvpcall"]);

  if (mode === "price" && listings.length) {
    const target = choice(listings);
    const delta = Math.floor(Math.random() * 7) - 3;
    target.price = Math.max(1, Number(target.price || 1) + delta);
    return { shops, listings, activity: `${actor.name} fiyat güncelledi`, systemType: "market" };
  }

  if (mode === "buy") {
    const available = listings.filter((x) => x.shopId !== actor.shopId && Number(x.stock || 0) > 0);
    if (available.length) {
      const target = choice(available);
      const qty = Math.min(Number(target.stock || 0), 1 + Math.floor(Math.random() * 2));
      target.stock = Math.max(0, Number(target.stock || 0) - qty);
      if (target.stock <= 0) {
        const idx = listings.findIndex((x) => x.id === target.id);
        if (idx >= 0) listings.splice(idx, 1);
      }
      return { shops, listings, activity: `${actor.name} marketten ${target.itemName} aldı`, systemType: "market" };
    }
  }

  if (mode === "pvpcall") {
    return { shops, listings, activity: `${actor.name} PvP için online`, systemType: "pvp" };
  }

  if (mode === "sell" || mode === "restock") {
    const ownShop = shops.find((x) => x.id === actor.shopId) || ensureBotShop(null, actor);
    if (!shops.find((x) => x.id === ownShop.id)) shops.push(ownShop);
    const ownListings = listings.filter((x) => x.shopId === actor.shopId);
    if (ownListings.length && mode === "restock") {
      const target = choice(ownListings);
      target.stock = clamp(Number(target.stock || 0) + (1 + Math.floor(Math.random() * 4)), 1, 99);
      target.price = Math.max(1, Number(target.price || 1) + Math.floor(Math.random() * 5) - 2);
      return { shops, listings, activity: `${actor.name} stoğunu yeniledi`, systemType: "market" };
    }
    const item = choice(BOT_CATALOG);
    listings.unshift({
      id: `bot_listing_${actor.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      shopId: actor.shopId,
      icon: item.icon,
      itemName: item.itemName,
      rarity: item.rarity,
      stock: 2 + Math.floor(Math.random() * 10),
      price: Math.max(1, item.price + Math.floor(Math.random() * 9) - 4),
      energyGain: item.energyGain,
      usable: item.usable,
      desc: item.desc,
      botOwned: true,
    });
    return { shops, listings, activity: `${actor.name} pazara yeni ürün koydu`, systemType: "market" };
  }

  return { shops, listings, activity: null, systemType: "market" };
}
function pushSystem(text, systemType = "info") {
  dispatchChatMessage({
    kind: "system",
    systemType,
    user: "SYSTEM",
    text,
    time: nowHHMM(),
  });
}
function pushBotLine(bot, text) {
  dispatchChatMessage({
    kind: "chat",
    user: bot.name,
    text,
    time: nowHHMM(),
    premium: !!bot.premium,
    clan: String(bot.clan || ""),
    online: !!bot.online,
    profileId: bot.id,
    isBot: true,
  });
}

export function startBotEngine(store) {
  if (!store || window.__tcBotEngineStarted) return window.__tcBotEngine;
  window.__tcBotEngineStarted = true;

  function bootstrap() {
    const state = store.get() || {};
    const bots = normalizeBots(state.bots);
    const botState = {
      enabled: true,
      bootstrapped: true,
      lastPresenceAt: Date.now(),
      lastMarketAt: Date.now(),
      lastChatAt: Date.now(),
      ...(state.botState || {}),
    };
    const marketSeed = ensureMarketSeed(state, bots);
    store.set({
      bots,
      botState,
      market: {
        ...(state.market || {}),
        shops: marketSeed.shops,
        listings: marketSeed.listings,
      },
    });
    pushSystem(`Şehir aktif: ${bots.filter((b) => b.online).length} bot online`, "presence");
  }

  function tickPresence() {
    const state = store.get() || {};
    if (state.botState?.enabled === false) return;
    const prevBots = normalizeBots(state.bots);
    const nextBots = prevBots.map((bot) => {
      const toggleChance = bot.online ? 0.16 : 0.26;
      let online = bot.online;
      if (Math.random() < toggleChance) online = !online;
      return {
        ...bot,
        online,
        lastSeenAt: online ? Date.now() : Number(bot.lastSeenAt || Date.now()),
        energy: clamp(Number(bot.energy || 0) + (online ? 1 : 0), 10, 50),
      };
    });

    let onlineCount = nextBots.filter((x) => x.online).length;
    if (onlineCount < 6) {
      for (const bot of nextBots) {
        if (!bot.online && Math.random() < 0.7) {
          bot.online = true;
          onlineCount += 1;
          if (onlineCount >= 6) break;
        }
      }
    }

    const shops = (state.market?.shops || []).map((shop) => {
      const bot = nextBots.find((b) => b.shopId === shop.id);
      return bot ? { ...shop, online: !!bot.online, ownerName: bot.name } : shop;
    });

    for (const bot of nextBots) {
      const prev = prevBots.find((x) => x.id === bot.id);
      if (!prev) continue;
      if (prev.online !== bot.online && Math.random() < 0.9) {
        pushSystem(`${bot.name} ${bot.online ? "oyuna girdi" : "oyundan çıktı"}`, "presence");
      }
    }

    store.set({
      bots: nextBots,
      botState: { ...(state.botState || {}), lastPresenceAt: Date.now() },
      market: { ...(state.market || {}), shops },
    });
  }

  function tickMarket() {
    const state = store.get() || {};
    if (state.botState?.enabled === false) return;
    const bots = normalizeBots(state.bots);
    const next = marketAction(state, bots);
    for (const shop of next.shops) {
      shop.totalListings = next.listings.filter((x) => x.shopId === shop.id).length;
    }
    store.set({
      market: {
        ...(state.market || {}),
        shops: next.shops,
        listings: next.listings,
      },
      botState: { ...(state.botState || {}), lastMarketAt: Date.now() },
    });
    if (next.activity) pushSystem(next.activity, next.systemType || "market");
  }

  function tickChat() {
    const state = store.get() || {};
    if (state.botState?.enabled === false) return;
    const bots = normalizeBots(state.bots).filter((x) => x.online);
    if (!bots.length) return;
    const bot = choice(bots);
    const msgs = loadChatMessages();
    const last = msgs[msgs.length - 1] || {};
    const lower = String(last.text || "").toLowerCase();

    if (lower.includes("pvp") && lower.includes("online")) {
      pushBotLine(bot, choice(PVP_REPLY_LINES));
    } else {
      pushBotLine(bot, choice(PUBLIC_CHAT_LINES));
    }

    store.set({
      botState: { ...(state.botState || {}), lastChatAt: Date.now() },
    });
  }

  bootstrap();

  const presenceTimer = setInterval(tickPresence, 8000);
  const marketTimer = setInterval(tickMarket, 11000);
  const chatTimer = setInterval(() => {
    if (Math.random() < 0.78) tickChat();
  }, 13000);

  window.__tcBotEngine = {
    stop() {
      clearInterval(presenceTimer);
      clearInterval(marketTimer);
      clearInterval(chatTimer);
      window.__tcBotEngineStarted = false;
    },
    tickPresence,
    tickMarket,
    tickChat,
    bootstrap,
  };

  window.tcBots = window.__tcBotEngine;
  return window.__tcBotEngine;
}
