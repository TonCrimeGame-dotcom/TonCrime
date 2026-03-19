const KEY_MSG = "toncrime_chat_messages_v1";

const BOT_MESSAGES = [
  "selam millet",
  "markette uygun ürün var mı?",
  "bugün trade akıyor",
  "pvp için online olan var mı?",
  "black markette fiyat düştü",
  "gece kulübü stok topladım",
  "coffeeshop ürünleri arttı",
  "birazdan tekrar gelirim",
  "bugün şanslı hissediyorum",
  "uygun listing gördüm aldım",
  "marketi takip edin",
  "yeni ürün koydum",
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

function pushChatMessage(user, text) {
  const msgs = loadChatMessages();
  msgs.push({ user, text, time: nowHHMM() });
  if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
  saveChatMessages(msgs);
  try {
    window.dispatchEvent(new CustomEvent("tc:chat:refresh"));
  } catch (_) {}
}

function botTemplates() {
  const now = Date.now();
  return [
    { id: "bot_shadowwolf", name: "ShadowWolf", online: true, archetype: "trader", coins: 6400, energy: 44, shopId: "bot_shop_shadowwolf", lastSeenAt: now },
    { id: "bot_nightviper", name: "NightViper", online: false, archetype: "flipper", coins: 5200, energy: 39, shopId: "bot_shop_nightviper", lastSeenAt: now },
    { id: "bot_ghostmafia", name: "GhostMafia", online: true, archetype: "seller", coins: 7800, energy: 47, shopId: "bot_shop_ghostmafia", lastSeenAt: now },
    { id: "bot_ricovane", name: "RicoVane", online: false, archetype: "buyer", coins: 5800, energy: 35, shopId: "bot_shop_ricovane", lastSeenAt: now },
    { id: "bot_ironfist", name: "IronFist", online: true, archetype: "buyer", coins: 6100, energy: 41, shopId: "bot_shop_ironfist", lastSeenAt: now },
    { id: "bot_voltkral", name: "VoltKral", online: false, archetype: "seller", coins: 4900, energy: 28, shopId: "bot_shop_voltkral", lastSeenAt: now },
    { id: "bot_slyraven", name: "SlyRaven", online: true, archetype: "trader", coins: 7050, energy: 33, shopId: "bot_shop_slyraven", lastSeenAt: now },
    { id: "bot_blackmamba", name: "BlackMamba", online: false, archetype: "flipper", coins: 6650, energy: 31, shopId: "bot_shop_blackmamba", lastSeenAt: now },
  ];
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
    rating: 4.2 + Math.random() * 0.7,
    totalListings: 0,
  };
}

function ensureMarketSeed(state, bots) {
  const market = state.market || { shops: [], listings: [] };
  const shops = Array.isArray(market.shops) ? market.shops.map((x) => ({ ...x })) : [];
  const listings = Array.isArray(market.listings) ? market.listings.map((x) => ({ ...x })) : [];

  for (const bot of bots.slice(0, 6)) {
    const idx = shops.findIndex((x) => x.id === bot.shopId);
    const ensured = ensureBotShop(idx >= 0 ? shops[idx] : null, bot);
    if (idx >= 0) shops[idx] = ensured;
    else shops.push(ensured);

    const ownListings = listings.filter((x) => x.shopId === bot.shopId);
    if (!ownListings.length) {
      const count = 2 + Math.floor(Math.random() * 3);
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

function mutatePresence(bots) {
  const now = Date.now();
  const next = bots.map((bot) => {
    const toggleChance = bot.online ? 0.22 : 0.34;
    let online = bot.online;
    if (Math.random() < toggleChance) online = !online;
    return {
      ...bot,
      online,
      lastSeenAt: online ? now : Number(bot.lastSeenAt || now),
      energy: clamp(Number(bot.energy || 0) + (online ? 1 : 0), 10, 50),
    };
  });

  let onlineCount = next.filter((x) => x.online).length;
  if (onlineCount < 3) {
    for (const bot of next) {
      if (!bot.online) {
        bot.online = true;
        onlineCount += 1;
        if (onlineCount >= 3) break;
      }
    }
  }
  if (onlineCount > 6) {
    for (const bot of next) {
      if (bot.online && Math.random() < 0.5) {
        bot.online = false;
        onlineCount -= 1;
        if (onlineCount <= 6) break;
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
  if (!onlineBots.length) return { shops, listings, activity: null };

  for (const bot of bots) {
    const shopIdx = shops.findIndex((x) => x.id === bot.shopId);
    if (shopIdx >= 0) shops[shopIdx] = { ...shops[shopIdx], online: !!bot.online, ownerName: bot.name };
  }

  const actor = choice(onlineBots);
  const mode = choice(["price", "buy", "sell", "restock"]);

  if (mode === "price" && listings.length) {
    const target = choice(listings);
    const delta = Math.floor(Math.random() * 7) - 3;
    target.price = Math.max(1, Number(target.price || 1) + delta);
    return { shops, listings, activity: `${actor.name} fiyat güncelledi` };
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
      return { shops, listings, activity: `${actor.name} marketten ${target.itemName} aldı` };
    }
  }

  if (mode === "sell" || mode === "restock") {
    const ownShop = shops.find((x) => x.id === actor.shopId) || ensureBotShop(null, actor);
    if (!shops.find((x) => x.id === ownShop.id)) shops.push(ownShop);
    const ownListings = listings.filter((x) => x.shopId === actor.shopId);
    if (ownListings.length && mode === "restock") {
      const target = choice(ownListings);
      target.stock = clamp(Number(target.stock || 0) + (1 + Math.floor(Math.random() * 4)), 1, 99);
      target.price = Math.max(1, Number(target.price || 1) + Math.floor(Math.random() * 5) - 2);
      return { shops, listings, activity: `${actor.name} stoğunu yeniledi` };
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
    return { shops, listings, activity: `${actor.name} pazara yeni ürün koydu` };
  }

  return { shops, listings, activity: null };
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
  }

  function tickPresence() {
    const state = store.get() || {};
    if (state.botState?.enabled === false) return;
    const bots = mutatePresence(normalizeBots(state.bots));
    const shops = (state.market?.shops || []).map((shop) => {
      const bot = bots.find((b) => b.shopId === shop.id);
      return bot ? { ...shop, online: !!bot.online, ownerName: bot.name } : shop;
    });
    store.set({
      bots,
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
    if (next.activity && Math.random() < 0.55) {
      const onlineBots = bots.filter((b) => b.online);
      if (onlineBots.length) {
        pushChatMessage(choice(onlineBots).name, next.activity.replace(/^.*? /, ""));
      }
    }
  }

  function tickChat() {
    const state = store.get() || {};
    if (state.botState?.enabled === false) return;
    const bots = normalizeBots(state.bots).filter((x) => x.online);
    if (!bots.length) return;
    const bot = choice(bots);
    const text = choice(BOT_MESSAGES);
    pushChatMessage(bot.name, text);
    store.set({
      botState: { ...(state.botState || {}), lastChatAt: Date.now() },
    });
  }

  bootstrap();

  const presenceTimer = setInterval(tickPresence, 9000);
  const marketTimer = setInterval(tickMarket, 12000);
  const chatTimer = setInterval(() => {
    if (Math.random() < 0.72) tickChat();
  }, 15000);

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
