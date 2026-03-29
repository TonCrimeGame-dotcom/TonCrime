import { supabase } from "../supabase.js";

const PROFILE_KEY_STORAGE = "toncrime_profile_key_v1";
function safeGetLocalStorage(key) {
  try { return localStorage.getItem(key) || ""; } catch { return ""; }
}
function safeSetLocalStorage(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
function randomProfilePart() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replaceAll("-", "");
    }
  } catch {}
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
function getTelegramWebAppUser() {
  try { return window.Telegram?.WebApp?.initDataUnsafe?.user || null; } catch { return null; }
}
function getRuntimeProfileKey(store = null) {
  const fromStore = String(store?.get?.()?.player?.telegramId || "").trim();
  if (fromStore) return fromStore;
  const tgUser = getTelegramWebAppUser();
  const tgId = String(tgUser?.id || "").trim();
  if (tgId) return tgId;
  let guestKey = safeGetLocalStorage(PROFILE_KEY_STORAGE).trim();
  if (!guestKey) {
    guestKey = `guest_${randomProfilePart()}`;
    safeSetLocalStorage(PROFILE_KEY_STORAGE, guestKey);
  }
  return guestKey;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function getWalletYton(state = {}) {
  return Number(state?.wallet?.yton || 0);
}

function patchWalletYton(state = {}, nextYton = 0) {
  return {
    wallet: {
      ...(state.wallet || {}),
      yton: Number(nextYton || 0),
    },
    coins: Number(nextYton || 0),
  };
}

function fitText(ctx, text, maxWidth) {
  const src = String(text || "");
  if (!src || maxWidth <= 8) return "";
  if (ctx.measureText(src).width <= maxWidth) return src;
  let out = src;
  while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out ? out + "…" : "";
}

function wrapTextToLines(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(test).width <= maxWidth) {
      line = test;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.join(" ") !== lines.join(" ") && lines.length) {
    lines[lines.length - 1] = fitText(ctx, lines[lines.length - 1], maxWidth);
  }
  return lines.slice(0, maxLines);
}

function easeOutCubic(t) {
  const x = clamp(Number(t || 0), 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function rarityColor(r) {
  switch (String(r || "").toLowerCase()) {
    case "legendary":
      return "#ffcc66";
    case "epic":
      return "#ffd789";
    default:
      return "rgba(255,255,255,0.68)";
  }
}

function typeLabel(type) {
  switch (type) {
    case "nightclub":
      return "Nightclub";
    case "coffeeshop":
      return "Coffeeshop";
    case "brothel":
      return "Genel Ev";
    default:
      return "İşletme";
  }
}

function iconForType(type) {
  switch (type) {
    case "nightclub":
      return "🌃";
    case "coffeeshop":
      return "🌿";
    case "brothel":
      return "💋";
      default:
      return "🏪";
  }
}


function getPointer(input) {
  return (
    input?.pointer ||
    input?.p ||
    input?.mouse ||
    input?.state?.pointer ||
    { x: 0, y: 0 }
  );
}

function justPressed(input) {
  if (typeof input?.justPressed === "function") return !!input.justPressed();
  if (typeof input?.isJustPressed === "function") {
    return (
      !!input.isJustPressed("pointer") ||
      !!input.isJustPressed("mouseLeft") ||
      !!input.isJustPressed("touch")
    );
  }
  return !!input?._justPressed || !!input?.mousePressed;
}

function justReleased(input) {
  if (typeof input?.justReleased === "function") return !!input.justReleased();
  if (typeof input?.isJustReleased === "function") {
    return (
      !!input.isJustReleased("pointer") ||
      !!input.isJustReleased("mouseLeft") ||
      !!input.isJustReleased("touch")
    );
  }
  return !!input?._justReleased || !!input?.mouseReleased;
}

function isDown(input) {
  if (typeof input?.isDown === "function") return !!input.isDown();
  return !!input?.pointer?.down || !!input?.mouseDown || !!input?.state?.pointer?.down;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const BUSINESS_PRODUCTION_TOTAL = 50;

function pad2(n) {
  return String(Math.max(0, Number(n || 0))).padStart(2, "0");
}

function fmtClock(ts) {
  const d = new Date(Number(ts || 0));
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDuration(ms) {
  const safe = Math.max(0, Number(ms || 0));
  const totalMin = Math.ceil(safe / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}sa ${mins}dk`;
  return `${Math.max(1, mins)}dk`;
}

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const src = String(str || "seed");
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeSeededRandom(seed) {
  let a = hashSeed(seed) || 1;
  return function rand() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function getImgSafe(assets, key) {
  try {
    if (!assets) return null;

    if (typeof assets.get === "function") {
      const img = assets.get(key);
      if (img) return img;
    }

    if (assets.images && assets.images[key]) return assets.images[key];
    if (assets[key]) return assets[key];

    return null;
  } catch (_) {
    return null;
  }
}
export class TradeScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.scrollY = 0;
    this.maxScroll = 0;

    this.dragging = false;
    this.downY = 0;
    this.startScrollY = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.hitBack = null;
    this.hitTabs = [];
    this.hitButtons = [];

    this.toastText = "";
    this.toastUntil = 0;

    this.blackmarketBgImg = new Image();
    this.blackmarketBgImg.src = "./src/assets/blackmarket_bg.png";
    this.blackmarketBgImg.onerror = () => {
      try { this.blackmarketBgImg.src = "./src/assets/BlackMarket.png"; } catch (_) {}
    };

    this.productionNotifyTimers = new Map();
    this.lootAnim = null;
  }

  onEnter() {
    const s = this.store.get();
    const trade = s.trade || {};

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
    this.lootAnim = null;

    this.store.set({
      trade: {
        ...trade,
        activeTab: trade.activeTab || "explore",
        selectedBusinessId: trade.selectedBusinessId || null,
        selectedInventoryCategory: trade.selectedInventoryCategory || "all",
        selectedMarketFilter: trade.selectedMarketFilter || "all",
        selectedShopId: trade.selectedShopId || null,
        selectedShopItemId: trade.selectedShopItemId || null,
        view: trade.view || "main",
        lastFreeSpinDay: trade.lastFreeSpinDay || "",
        searchQuery: trade.searchQuery || "",
      },
    });

    this._refreshBusinessProduction();
    this._syncProductionNotifyTimers();
  }

  _trade() {
    return this.store.get().trade || {};
  }

  _setTrade(patch = {}) {
    const s = this.store.get();
    this.store.set({
      trade: {
        ...(s.trade || {}),
        ...patch,
      },
    });
  }

  _safeRect(w, h) {
    const s = this.store.get();
    const safe = s?.ui?.safe || { x: 0, y: 0, w, h };
    const topReserved = Number(s?.ui?.hudReservedTop || 110);
    const bottomReserved = Number(s?.ui?.chatReservedBottom || 82);

    return {
      x: safe.x + 10,
      y: safe.y + topReserved,
      w: safe.w - 20,
      h: safe.h - topReserved - bottomReserved - 10,
    };
  }

  _showToast(text, ms = 1400) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _changeTab(tab) {
    this.scrollY = 0;
    this.maxScroll = 0;
    this._setTrade({
      activeTab: tab,
      view: "main",
      selectedShopId: null,
      selectedBusinessId: null,
    });
  }

  _goShop(shopId) {
    this.scrollY = 0;
    this.maxScroll = 0;
    this._setTrade({
      view: "shop",
      selectedShopId: shopId,
    });
  }

  _goBack() {
    const t = this._trade();
    if (t.view === "shop") {
      this._setTrade({
        view: "main",
        selectedShopId: null,
      });
      this.scrollY = 0;
      return;
    }
    this.scenes.go("home");
  }

  _isFreeSpinReady() {
    return String(this._trade().lastFreeSpinDay || "") !== todayKey();
  }

  _promptSearch() {
    const trade = this._trade();
    const v = window.prompt("Mekan veya ürün ara:", trade.searchQuery || "");
    if (v === null) return;
    this._setTrade({ searchQuery: String(v || "").trim() });
    this._showToast(v ? `Arama: ${v}` : "Arama temizlendi");
  }

  _allBusinesses() {
    const s = this.store.get();
    return s.businesses?.owned || [];
  }

  _inventoryItems() {
    const s = this.store.get();
    return s.inventory?.items || [];
  }

  _marketShops() {
    const s = this.store.get();
    return s.market?.shops || [];
  }

  _marketListings() {
    const s = this.store.get();
    return s.market?.listings || [];
  }

  _getShopById(shopId) {
    return this._marketShops().find((x) => x.id === shopId) || null;
  }

  _getListingsByShopId(shopId) {
    return this._marketListings().filter((x) => x.shopId === shopId);
  }

  _findLowestMarketPriceByName(itemName) {
    const listings = this._marketListings().filter(
      (x) => String(x.itemName || "").toLowerCase() === String(itemName || "").toLowerCase()
    );
    if (!listings.length) return 0;
    return listings.reduce((min, x) => Math.min(min, Number(x.price || 0)), Number.MAX_SAFE_INTEGER);
  }
  _getTelegramId() {
    return String(getRuntimeProfileKey(this.store) || "").trim();
  }

  async _getProfileId() {
    const telegramId = this._getTelegramId();
    if (!telegramId) {
      throw new Error("telegram_id bulunamadı");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) {
      throw new Error("Profil bulunamadı");
    }

    return data.id;
  }

  _normalizeBusinessType(type) {
    const t = String(type || "").toLowerCase().trim();

    if (t === "nightclub") return "nightclub";
    if (t === "coffeeshop") return "coffeeshop";
    if (t === "brothel") return "brothel";

    return null;
  }

  _mapBusinessRowToUi(row, playerName) {
    return {
      id: String(row.id),
      type: row.business_type,
      icon: iconForType(row.business_type),
      name: row.name || typeLabel(row.business_type),
      ownerId: String(row.owner_id || ""),
      ownerName: String(playerName || "Player"),
      dailyProduction: Number(row.daily_production || 50),
      stock: Number(row.stock_qty || 0),
      theme: row.business_type,
      products: [],
    };
  }

  async _rpc(name, params = {}) {
    const { data, error } = await supabase.rpc(name, params);
    if (error) throw error;
    return data;
  }
  _ensurePlayerMarketShop() {
    const s = this.store.get();
    const playerName = String(s.player?.username || "Player");
    const playerShopId = "shop_player_market";

    let existing = (s.market?.shops || []).find((x) => x.id === playerShopId);
    if (existing) return existing;

    const shop = {
      id: playerShopId,
      businessId: "player_market",
      name: `${playerName} Market`,
      ownerId: "player_main",
      ownerName: playerName,
      online: true,
      theme: "dark",
      rating: 5,
      totalListings: 0,
    };

    const shops = [shop, ...((s.market?.shops || []).map((x) => ({ ...x })))];

    this.store.set({
      market: {
        ...(s.market || {}),
        shops,
      },
    });

    return shop;
  }

  _vibrate(pattern) {
    try {
      if (navigator?.vibrate) navigator.vibrate(pattern);
    } catch (_) {}
  }

  _makeLootItem(kind, name, icon, rarity, extras = {}) {
    return {
      id: `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind,
      icon,
      name,
      rarity,
      qty: 1,
      usable: false,
      sellable: true,
      marketable: true,
      sellPrice: Number(extras.sellPrice || 40),
      marketPrice: Number(extras.marketPrice || 55),
      desc: extras.desc || "Özel loot ödülü.",
      ...extras,
    };
  }

  _grantLootReward(reward, meta = {}) {
    const s = this.store.get();
    const tradePatch = {};
    if (meta.markFreeSpin) tradePatch.lastFreeSpinDay = todayKey();

    if (reward.type === "coins") {
      const nextYton = getWalletYton(s) + Number(reward.amount || 0) - Number(meta.cost || 0);
      this.store.set({
        ...patchWalletYton(s, nextYton),
        ...(Object.keys(tradePatch).length ? { trade: { ...(s.trade || {}), ...tradePatch } } : {}),
      });
    } else if (reward.type === "energy") {
      const p = { ...(s.player || {}) };
      p.energy = clamp(Number(p.energy || 0) + Number(reward.amount || 0), 0, Number(p.energyMax || 100));
      const nextYton = getWalletYton(s) - Number(meta.cost || 0);
      this.store.set({
        ...patchWalletYton(s, nextYton),
        player: p,
        ...(Object.keys(tradePatch).length ? { trade: { ...(s.trade || {}), ...tradePatch } } : {}),
      });
    } else if (reward.type === "item") {
      const items = (s.inventory?.items || []).map((x) => ({ ...x }));
      const existing = items.find((x) => x.name === reward.item.name);
      if (existing) existing.qty = Number(existing.qty || 0) + Number(reward.item.qty || 1);
      else items.unshift({ ...reward.item });
      const nextYton = getWalletYton(s) - Number(meta.cost || 0);
      this.store.set({
        ...patchWalletYton(s, nextYton),
        inventory: { ...(s.inventory || {}), items },
        ...(Object.keys(tradePatch).length ? { trade: { ...(s.trade || {}), ...tradePatch } } : {}),
      });
    }

    this._showToast(reward.text || reward.label || "Ödül kazanıldı", 1900);
    this._vibrate([60, 40, 120]);
  }

  _buildWheelRewards(premium = false) {
    if (premium) {
      return [
        { key: "coins_180", type: "coins", amount: 180, icon: "💰", label: "+180 yton", text: "+180 yton" },
        { key: "energy_30", type: "energy", amount: 30, icon: "⚡", label: "+30 enerji", text: "+30 enerji" },
        { key: "pass", type: "item", icon: "👑", label: "Golden Pass", text: "Golden Pass kazandın", item: this._makeLootItem("rare", "Golden Pass", "👑", "legendary", { marketable: false, sellPrice: 250, desc: "Nadir etkinlik ürünü." }) },
        { key: "coins_120", type: "coins", amount: 120, icon: "💸", label: "+120 yton", text: "+120 yton" },
        { key: "energy_20", type: "energy", amount: 20, icon: "⚡", label: "+20 enerji", text: "+20 enerji" },
        { key: "premium_crate", type: "item", icon: "📦", label: "Premium Sandık", text: "Premium Sandık kazandın", item: this._makeLootItem("rare", "Premium Sandık", "📦", "legendary", { sellPrice: 120, marketPrice: 160, desc: "Premium loot kasası." }) },
      ];
    }
    return [
      { key: "coins_25", type: "coins", amount: 25, icon: "💰", label: "+25 yton", text: "+25 yton" },
      { key: "coins_60", type: "coins", amount: 60, icon: "💸", label: "+60 yton", text: "+60 yton" },
      { key: "energy_15", type: "energy", amount: 15, icon: "⚡", label: "+15 enerji", text: "+15 enerji" },
      { key: "crate", type: "item", icon: "📦", label: "Mystery Crate", text: "Mystery Crate kazandın", item: this._makeLootItem("rare", "Mystery Crate", "📦", "rare", { usable: false, sellPrice: 45, marketPrice: 60, desc: "Sandık ödülü." }) },
      { key: "coins_40", type: "coins", amount: 40, icon: "💵", label: "+40 yton", text: "+40 yton" },
      { key: "energy_10", type: "energy", amount: 10, icon: "⚡", label: "+10 enerji", text: "+10 enerji" },
    ];
  }

  _buildCrateRewards(kind) {
    if (kind === "legendary") {
      return [
        { key: "coins_220", type: "coins", amount: 220, icon: "💰", label: "+220 yton", text: "+220 yton" },
        { key: "energy_35", type: "energy", amount: 35, icon: "⚡", label: "+35 enerji", text: "+35 enerji" },
        { key: "pass", type: "item", icon: "👑", label: "Golden Pass", text: "Golden Pass çıktı", item: this._makeLootItem("rare", "Golden Pass", "👑", "legendary", { marketable: false, sellPrice: 250, desc: "Nadir etkinlik ürünü." }) },
        { key: "champagne", type: "item", icon: "🍾", label: "Premium Champagne", text: "Premium Champagne çıktı", item: this._makeLootItem("goods", "Premium Champagne", "🍾", "legendary", { usable: true, energyGain: 30, sellPrice: 120, marketPrice: 170, desc: "Premium enerji ürünü." }) },
        { key: "coins_160", type: "coins", amount: 160, icon: "💸", label: "+160 yton", text: "+160 yton" },
      ];
    }
    return [
      { key: "coins_80", type: "coins", amount: 80, icon: "💰", label: "+80 yton", text: "+80 yton" },
      { key: "energy_18", type: "energy", amount: 18, icon: "⚡", label: "+18 enerji", text: "+18 enerji" },
      { key: "whiskey", type: "item", icon: "🥃", label: "Black Whiskey", text: "Black Whiskey çıktı", item: this._makeLootItem("consumable", "Black Whiskey", "🥃", "rare", { usable: true, energyGain: 14, sellPrice: 40, marketPrice: 55, desc: "Enerji veren özel içki." }) },
      { key: "crate", type: "item", icon: "📦", label: "Mystery Crate", text: "Mystery Crate çıktı", item: this._makeLootItem("rare", "Mystery Crate", "📦", "rare", { sellPrice: 45, marketPrice: 60, desc: "Sandık ödülü." }) },
      { key: "coins_55", type: "coins", amount: 55, icon: "💵", label: "+55 yton", text: "+55 yton" },
    ];
  }

  _startWheelSpin(premium = false) {
    const s = this.store.get();
    const cost = premium ? 90 : 0;
    if (!premium && !this._isFreeSpinReady()) {
      this._showToast("Günlük ücretsiz çark kullanıldı");
      return;
    }
    if (premium && getWalletYton(s) < cost) {
      this._showToast("Premium çark için yetersiz yton");
      return;
    }

    const rewards = this._buildWheelRewards(premium);
    const winIndex = Math.floor(Math.random() * rewards.length);
    const segmentAngle = (Math.PI * 2) / rewards.length;
    const pointerAngle = -Math.PI / 2;
    const targetCenter = (winIndex + 0.5) * segmentAngle;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetRotation = (Math.PI * 2 * extraSpins) + (pointerAngle - targetCenter);

    this.lootAnim = {
      kind: "wheel",
      premium,
      cost,
      rewards,
      winIndex,
      reward: rewards[winIndex],
      startAt: Date.now(),
      duration: premium ? 4200 : 3600,
      targetRotation,
      lastPulseAt: 0,
      resolved: false,
      finalShownAt: 0,
    };
    this._vibrate([25, 30, 30]);
  }

  _startCrateRoll(kind) {
    const s = this.store.get();
    const cost = kind === "legendary" ? 140 : 65;
    if (getWalletYton(s) < cost) {
      this._showToast("Yetersiz yton");
      return;
    }
    const rewards = this._buildCrateRewards(kind);
    const winIndex = Math.floor(Math.random() * rewards.length);
    const repeated = [];
    for (let r = 0; r < 48; r++) repeated.push(rewards[r % rewards.length]);
    const landingIndex = 24 + winIndex;

    this.lootAnim = {
      kind: "crate",
      crateKind: kind,
      cost,
      rewards: repeated,
      baseRewards: rewards,
      winIndex: landingIndex,
      reward: rewards[winIndex],
      startAt: Date.now(),
      duration: kind === "legendary" ? 3600 : 3000,
      lastPulseAt: 0,
      resolved: false,
      finalShownAt: 0,
    };
    this._vibrate([20, 20, 20, 20]);
  }

  _doFreeSpin() {
    this._startWheelSpin(false);
  }

  _doPremiumSpin() {
    this._startWheelSpin(true);
  }

  _buyCrate(kind) {
    this._startCrateRoll(kind);
  }

  _updateLootAnimation() {
    if (!this.lootAnim) return;
    const anim = this.lootAnim;
    const now = Date.now();
    const elapsed = now - Number(anim.startAt || now);
    const progress = clamp(elapsed / Math.max(1, Number(anim.duration || 1)), 0, 1);

    if (progress < 1) {
      const pulseGap = anim.kind === "wheel" ? 220 : 140;
      if (now - Number(anim.lastPulseAt || 0) >= pulseGap) {
        anim.lastPulseAt = now;
        this._vibrate(anim.kind === "wheel" ? 14 : 10);
      }
      return;
    }

    if (!anim.resolved) {
      anim.resolved = true;
      anim.finalShownAt = now;
      this._grantLootReward(anim.reward, { cost: anim.cost, markFreeSpin: anim.kind === "wheel" && !anim.premium });
      this._vibrate([120, 60, 160]);
      return;
    }

    if (now - Number(anim.finalShownAt || now) > 1350) {
      this.lootAnim = null;
    }
  }

  _drawWheelLootOverlay(ctx, panelX, panelY, panelW, panelH) {
    const anim = this.lootAnim;
    if (!anim) return;
    const now = Date.now();
    const progress = easeOutCubic((now - anim.startAt) / anim.duration);
    const cx = panelX + panelW * 0.5;
    const cy = panelY + panelH * 0.52;
    const radius = Math.min(panelW, panelH) * 0.24;
    const rotation = anim.targetRotation * progress;
    const segments = anim.rewards;
    const seg = (Math.PI * 2) / segments.length;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (let i = 0; i < segments.length; i++) {
      const start = -Math.PI / 2 + i * seg;
      const end = start + seg;
      const fill = i % 2 === 0 ? "rgba(184,132,38,0.94)" : "rgba(112,76,18,0.94)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,231,180,0.38)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const mid = start + seg * 0.5;
      ctx.save();
      ctx.rotate(mid);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff8e8";
      ctx.font = "900 20px system-ui";
      ctx.fillText(segments[i].icon || "🎁", radius * 0.66, 0);
      ctx.font = "800 11px system-ui";
      ctx.fillText(fitText(ctx, segments[i].label || "Ödül", 76), radius * 0.44, 0);
      ctx.restore();
    }

    ctx.fillStyle = "rgba(18,12,6,0.96)";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#ffe8b0";
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy - radius - 18);
    ctx.lineTo(cx + 16, cy - radius - 18);
    ctx.lineTo(cx, cy - radius + 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(anim.premium ? "Premium Çark" : "Günlük Çark", cx, panelY + 42);
    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    ctx.fillText(progress < 1 ? "Çark dönüyor..." : `Kazanılan: ${anim.reward?.label || "Ödül"}`, cx, panelY + 64);
  }

  _drawCrateLootOverlay(ctx, panelX, panelY, panelW, panelH) {
    const anim = this.lootAnim;
    if (!anim) return;
    const now = Date.now();
    const progress = easeOutCubic((now - anim.startAt) / anim.duration);
    const stripW = Math.min(panelW - 48, 420);
    const stripH = 120;
    const viewX = panelX + (panelW - stripW) / 2;
    const viewY = panelY + panelH * 0.46 - stripH / 2;
    const cellW = 108;
    const gap = 12;
    const step = cellW + gap;
    const finalOffset = anim.winIndex * step - (stripW / 2 - cellW / 2);
    const initialOffset = finalOffset + step * 12;
    const offset = initialOffset + (finalOffset - initialOffset) * progress;

    ctx.fillStyle = "rgba(6,10,16,0.94)";
    fillRoundRect(ctx, viewX, viewY, stripW, stripH, 20);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, viewX, viewY, stripW, stripH, 20);

    ctx.save();
    roundRectPath(ctx, viewX, viewY, stripW, stripH, 20);
    ctx.clip();

    for (let i = 0; i < anim.rewards.length; i++) {
      const item = anim.rewards[i];
      const cardX = viewX + i * step - offset;
      const cardY = viewY + 10;
      if (cardX + cellW < viewX - 10 || cardX > viewX + stripW + 10) continue;

      const isWinner = i === anim.winIndex;
      const g = ctx.createLinearGradient(cardX, cardY, cardX, cardY + stripH - 20);
      g.addColorStop(0, isWinner ? "rgba(182,136,42,0.98)" : "rgba(72,50,18,0.94)");
      g.addColorStop(1, isWinner ? "rgba(116,80,20,0.98)" : "rgba(34,24,10,0.96)");
      ctx.fillStyle = g;
      fillRoundRect(ctx, cardX, cardY, cellW, stripH - 20, 16);
      ctx.strokeStyle = isWinner ? "rgba(255,230,170,0.62)" : "rgba(255,255,255,0.14)";
      strokeRoundRect(ctx, cardX, cardY, cellW, stripH - 20, 16);

      if (isWinner) {
        ctx.save();
        ctx.shadowColor = "rgba(255,214,120,0.42)";
        ctx.shadowBlur = 18;
        ctx.strokeStyle = "rgba(255,228,170,0.52)";
        strokeRoundRect(ctx, cardX + 2, cardY + 2, cellW - 4, stripH - 24, 14);
        ctx.restore();
      }

      ctx.fillStyle = "#fff8ea";
      ctx.font = "900 28px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.icon || "🎁", cardX + cellW / 2, cardY + 32);
      ctx.font = "800 11px system-ui";
      ctx.fillText(fitText(ctx, item.label || "Ödül", cellW - 16), cardX + cellW / 2, cardY + 66);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,214,120,0.92)";
    fillRoundRect(ctx, viewX + stripW / 2 - 3, viewY - 10, 6, stripH + 20, 3);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(anim.crateKind === "legendary" ? "Legendary Crate" : "Mystery Crate", panelX + panelW / 2, panelY + 42);
    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    ctx.fillText(progress < 1 ? "Sandık akışı dönüyor..." : `Kazanılan: ${anim.reward?.label || "Ödül"}`, panelX + panelW / 2, panelY + 64);

    if (progress >= 1 && anim.reward) {
      ctx.fillStyle = "#fff5dd";
      ctx.font = "900 28px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(anim.reward.icon || "🎁", panelX + panelW / 2, viewY + stripH + 26);
    }
  }

  _drawLootOverlay(ctx, panelX, panelY, panelW, panelH) {
    if (!this.lootAnim) return;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.56)";
    fillRoundRect(ctx, panelX + 12, panelY + 12, panelW - 24, panelH - 24, 24);
    ctx.restore();
    if (this.lootAnim.kind === "wheel") this._drawWheelLootOverlay(ctx, panelX, panelY, panelW, panelH);
    else this._drawCrateLootOverlay(ctx, panelX, panelY, panelW, panelH);
  }

  _useInventoryItem(itemId) {
    const s = this.store.get();
    const items = (s.inventory?.items || []).map((x) => ({ ...x }));
    const idx = items.findIndex((x) => x.id === itemId);
    if (idx < 0) return;

    const item = items[idx];
    if (!item.usable) {
      this._showToast("Bu item kullanılamaz");
      return;
    }
    if (Number(item.qty || 0) <= 0) {
      this._showToast("Stok yok");
      return;
    }

    const p = { ...(s.player || {}) };
    const currentEnergy = Number(p.energy || 0);
    const maxEnergy = Number(p.energyMax || 100);

    if (currentEnergy >= maxEnergy) {
      this._showToast("Enerji full");
      return;
    }

    const gain = Math.min(Number(item.energyGain || 0), maxEnergy - currentEnergy);
    p.energy = currentEnergy + gain;

    item.qty = Math.max(0, Number(item.qty || 0) - 1);
    if (item.qty <= 0) items.splice(idx, 1);
    else items[idx] = item;

    this.store.set({
      player: p,
      inventory: {
        ...(s.inventory || {}),
        items,
      },
    });

    this._showToast(`+${gain} enerji`);
  }

  _sellInventoryItem(itemId) {
    const s = this.store.get();
    const items = (s.inventory?.items || []).map((x) => ({ ...x }));
    const idx = items.findIndex((x) => x.id === itemId);
    if (idx < 0) return;

    const item = items[idx];
    if (!item.sellable) {
      this._showToast("Bu item satılamaz");
      return;
    }
    if (Number(item.qty || 0) <= 0) {
      this._showToast("Stok yok");
      return;
    }

    const gain = Number(item.sellPrice || 0);
    item.qty = Math.max(0, Number(item.qty || 0) - 1);

    if (item.qty <= 0) items.splice(idx, 1);
    else items[idx] = item;

    const nextYton = getWalletYton(s) + gain;
    this.store.set({
      ...patchWalletYton(s, nextYton),
      inventory: {
        ...(s.inventory || {}),
        items,
      },
    });

    this._showToast(`+${gain} yton`);
  }

  async _listInventoryItem(itemId) {
    const s = this.store.get();
    const items = (s.inventory?.items || []).map((x) => ({ ...x }));
    const idx = items.findIndex((x) => String(x.id) === String(itemId));
    if (idx < 0) return;

    const item = items[idx];
    if (!item.marketable) {
      this._showToast("Bu item pazara konamaz");
      return;
    }
    if (Number(item.qty || 0) <= 0) {
      this._showToast("Stok yok");
      return;
    }

    const qtyRaw = window.prompt(`Kaç adet satmak istiyorsun? (Max ${Number(item.qty || 0)})`, "1");
    if (qtyRaw === null) return;

    const qty = clamp(parseInt(qtyRaw, 10) || 0, 1, Number(item.qty || 0));
    if (qty <= 0) {
      this._showToast("Geçersiz adet");
      return;
    }

    const lowest = this._findLowestMarketPriceByName(item.name);
    const defaultPrice = lowest > 0 ? lowest : Number(item.marketPrice || item.sellPrice || 10);

    const priceRaw = window.prompt(
      lowest > 0
        ? `Birim fiyat gir.\nPazardaki en düşük fiyat: ${lowest} yton`
        : "Birim satış fiyatını gir.",
      String(defaultPrice)
    );
    if (priceRaw === null) return;

    const price = Math.max(1, parseInt(priceRaw, 10) || 0);

    try {
      const profileId = await this._getProfileId();

      const { data: invRow, error: invError } = await supabase
        .from("inventory_items")
        .select("id, profile_id, item_key, item_name, quantity, meta")
        .eq("profile_id", profileId)
        .eq("item_key", String(item.id))
        .maybeSingle();

      if (invError) throw invError;
      if (!invRow?.id) {
        throw new Error("Backend inventory kaydı bulunamadı");
      }

      const { data: marketBusiness, error: bizError } = await supabase
        .from("businesses")
        .select("id, name, business_type, owner_id")
        .eq("owner_id", profileId)
        .eq("business_type", "blackmarket")
        .maybeSingle();

      if (bizError) throw bizError;

      if (!marketBusiness?.id) {
        throw new Error("Inventory item satışı için blackmarket business kaydı gerekli");
      }

      const result = await this._rpc("create_market_listing", {
        p_seller_profile_id: profileId,
        p_business_id: marketBusiness.id,
        p_inventory_item_id: invRow.id,
        p_quantity: qty,
        p_price_yton: price,
      });

      const row = Array.isArray(result) ? result[0] : result;

      const state2 = this.store.get();
      const items2 = (state2.inventory?.items || []).map((x) => ({ ...x }));
      const listings = (state2.market?.listings || []).map((x) => ({ ...x }));
      const shops = (state2.market?.shops || []).map((x) => ({ ...x }));

      const idx2 = items2.findIndex((x) => String(x.id) === String(itemId));
      if (idx2 >= 0) {
        items2[idx2].qty = Math.max(0, Number(items2[idx2].qty || 0) - qty);
        if (items2[idx2].qty <= 0) items2.splice(idx2, 1);
      }

      let shop = shops.find((x) => String(x.businessId) === String(marketBusiness.id));
      if (!shop) {
        shop = {
          id: "shop_" + marketBusiness.id,
          businessId: String(marketBusiness.id),
          type: "blackmarket",
          icon: "🕶️",
          name: marketBusiness.name || "Black Market",
          ownerId: String(profileId),
          ownerName: String(state2.player?.username || "Player"),
          online: true,
          theme: "dark",
          rating: 5,
          totalListings: 0,
        };
        shops.unshift(shop);
      }

      listings.unshift({
        id: String(row?.id || "listing_" + Date.now()),
        shopId: shop.id,
        icon: item.icon || "📦",
        itemName: item.name,
        rarity: item.rarity || "common",
        stock: qty,
        price,
        energyGain: Number(item.energyGain || 0),
        usable: !!item.usable,
        desc: item.desc || "Envanter ürünü",
        inventoryItemId: String(invRow.id),
        businessId: String(marketBusiness.id),
      });

      for (const sh of shops) {
        sh.totalListings = listings.filter((x) => x.shopId === sh.id).length;
      }

      this.store.set({
        inventory: {
          ...(state2.inventory || {}),
          items: items2,
        },
        market: {
          ...(state2.market || {}),
          shops,
          listings,
        },
      });

      this._showToast(`${qty} adet pazara kondu`);
    } catch (err) {
      console.error("list_inventory_item error:", err);
      this._showToast(err?.message || "İtem pazara konamadı");
    }
  }

  _ensureBusinessShop(biz) {
    const s = this.store.get();
    const targetId = "shop_from_" + biz.id;
    let shop = (s.market?.shops || []).find((x) => x.id === targetId);
    if (shop) return shop;

    shop = {
      id: targetId,
      businessId: biz.id,
      type: biz.type,
      icon: biz.icon || iconForType(biz.type),
      name: biz.name,
      ownerId: String(biz.ownerId || s.player?.id || "player_main"),
      ownerName: String(biz.ownerName || s.player?.username || "Player"),
      online: true,
      theme: biz.theme || biz.type,
      rating: 5,
      totalListings: 0,
    };

    this.store.set({
      market: {
        ...(s.market || {}),
        shops: [shop, ...((s.market?.shops || []).map((x) => ({ ...x })))],
      },
    });

    return shop;
  }

  _useBusinessProduct(bizId, productId) {
    const s = this.store.get();
    const businesses = (s.businesses?.owned || []).map((b) => ({
      ...b,
      products: (b.products || []).map((p) => ({ ...p })),
    }));

    const biz = businesses.find((b) => b.id === bizId);
    if (!biz) return;
    const product = (biz.products || []).find((p) => p.id === productId);
    if (!product) return;

    if (Number(product.qty || 0) <= 0) {
      this._showToast("Ürün stoğu yok");
      return;
    }

    const p = { ...(s.player || {}) };
    const currentEnergy = Number(p.energy || 0);
    const maxEnergy = Number(p.energyMax || 100);
    const gain = Math.min(Number(product.energyGain || 0), Math.max(0, maxEnergy - currentEnergy));

    if (gain <= 0) {
      this._showToast("Enerji full");
      return;
    }

    product.qty = Math.max(0, Number(product.qty || 0) - 1);
    biz.stock = Math.max(0, Number(biz.stock || 0) - 1);
    p.energy = currentEnergy + gain;

    this.store.set({
      player: p,
      businesses: {
        ...(s.businesses || {}),
        owned: businesses,
      },
    });
        this._showToast(`+${gain} enerji`);
  }
  
  _productionSeedFor(biz, startedAt) {
    return `${String(biz?.id || "biz")}:${Number(startedAt || 0)}:${String(biz?.type || "type")}:${(biz?.products || []).map((p) => p.id).join("|")}`;
  }

  _sendProductionReadyNotification(biz, pendingTotal) {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      const title = `${biz?.name || typeLabel(biz?.type)} üretimi hazır`;
      const body = `${fmtNum(pendingTotal)} ürün toplamanı bekliyor. Son toplama ${fmtClock(biz?.productionCollectUntilAt)}.`;
      const tag = `trade_prod_${String(biz?.id || "biz")}_${Number(biz?.productionReadyAt || 0)}`;

      try {
        const regPromise = navigator?.serviceWorker?.ready;
        if (regPromise && typeof regPromise.then === "function") {
          regPromise.then((reg) => reg?.showNotification?.(title, { body, tag, silent: false })).catch(() => {
            try { new Notification(title, { body, tag }); } catch (_) {}
          });
          return;
        }
      } catch (_) {}

      try { new Notification(title, { body, tag }); } catch (_) {}
    } catch (_) {}
  }

  _syncProductionNotifyTimers(ownedOverride = null) {
    const owned = Array.isArray(ownedOverride) ? ownedOverride : (this.store.get().businesses?.owned || []);
    const now = Date.now();
    const activeIds = new Set();

    for (const biz of owned) {
      if (!biz?.id || !Array.isArray(biz.products) || !biz.products.length) continue;
      const bizId = String(biz.id);
      activeIds.add(bizId);

      const readyAt = Number(biz.productionReadyAt || 0);
      const collectUntilAt = Number(biz.productionCollectUntilAt || (readyAt ? readyAt + HOUR_MS : 0));
      const timerInfo = this.productionNotifyTimers.get(bizId);

      if (!readyAt || now >= collectUntilAt) {
        if (timerInfo?.id) clearTimeout(timerInfo.id);
        this.productionNotifyTimers.delete(bizId);
        continue;
      }

      if (timerInfo && Number(timerInfo.readyAt || 0) === readyAt) continue;
      if (timerInfo?.id) clearTimeout(timerInfo.id);

      const delay = Math.max(1000, readyAt - now + 250);
      const timeoutId = setTimeout(() => {
        this.productionNotifyTimers.delete(bizId);
        this._refreshBusinessProduction();
      }, delay);

      this.productionNotifyTimers.set(bizId, { id: timeoutId, readyAt });
    }

    for (const [bizId, info] of [...this.productionNotifyTimers.entries()]) {
      if (activeIds.has(bizId)) continue;
      if (info?.id) clearTimeout(info.id);
      this.productionNotifyTimers.delete(bizId);
    }
  }

  _getBusinessProductionStatus(biz, now = Date.now()) {
    const readyAt = Number(biz?.productionReadyAt || 0);
    const collectUntilAt = Number(biz?.productionCollectUntilAt || (readyAt ? readyAt + HOUR_MS : 0));
    const pendingTotal = (biz?.pendingProduction || []).reduce((sum, row) => sum + Number(row.qty || 0), 0);

    const producing = readyAt > now;
    const ready = !producing && now <= collectUntilAt && pendingTotal > 0;
    const missed = collectUntilAt > 0 && now > collectUntilAt;

    return {
      pendingTotal,
      producing,
      ready,
      missed,
      collectable: ready,
      readyAt,
      collectUntilAt,
      timeToReady: Math.max(0, readyAt - now),
      timeToCollectEnd: Math.max(0, collectUntilAt - now),
    };
  }

  _createPendingProduction(products = [], totalDaily = BUSINESS_PRODUCTION_TOTAL, seedKey = "") {
    const safeProducts = (products || []).map((p) => ({ ...p }));
    if (!safeProducts.length) return [];

    const total = Math.max(1, Number(totalDaily || BUSINESS_PRODUCTION_TOTAL));
    const rnd = makeSeededRandom(seedKey || `${Date.now()}`);
    const rows = safeProducts.map((p) => ({ productId: p.id, qty: 0 }));

    for (let i = 0; i < total; i++) {
      const idx = Math.floor(rnd() * rows.length);
      rows[idx].qty += 1;
    }

    return rows;
  }

  _refreshBusinessProduction() {
    const s = this.store.get();
    const now = Date.now();

    const owned = (s.businesses?.owned || []).map((biz) => ({
      ...biz,
      products: (biz.products || []).map((p) => ({ ...p })),
      pendingProduction: (biz.pendingProduction || []).map((p) => ({ ...p })),
    }));

    let changed = false;

    for (const biz of owned) {
      const hasProducts = Array.isArray(biz.products) && biz.products.length > 0;
      if (!hasProducts) continue;

      const dailyTotal = Math.max(1, Number(biz.dailyProduction || BUSINESS_PRODUCTION_TOTAL));

      if (!biz.productionStartedAt) {
        biz.productionStartedAt = now;
        changed = true;
      }

      if (!Array.isArray(biz.pendingProduction) || !biz.pendingProduction.length) {
        biz.pendingProduction = this._createPendingProduction(
          biz.products,
          dailyTotal,
          this._productionSeedFor(biz, biz.productionStartedAt)
        );
        changed = true;
      }

      if (!biz.productionReadyAt) {
        biz.productionReadyAt = Number(biz.productionStartedAt) + DAY_MS;
        changed = true;
      }

      if (!biz.productionCollectUntilAt) {
        biz.productionCollectUntilAt = Number(biz.productionReadyAt) + HOUR_MS;
        changed = true;
      }

      const pendingTotal = (biz.pendingProduction || []).reduce(
        (sum, row) => sum + Number(row.qty || 0),
        0
      );

      if (now > Number(biz.productionCollectUntilAt || 0)) {
        if (pendingTotal > 0) {
          biz.lastMissedQty = pendingTotal;
          biz.lastMissedAt = now;
        }

        biz.productionStartedAt = now;
        biz.productionReadyAt = now + DAY_MS;
        biz.productionCollectUntilAt = biz.productionReadyAt + HOUR_MS;
        biz.productionNotifiedAt = 0;
        biz.pendingProduction = this._createPendingProduction(
          biz.products,
          dailyTotal,
          this._productionSeedFor(biz, biz.productionStartedAt)
        );
        changed = true;
        continue;
      }

      if (
        now >= Number(biz.productionReadyAt || 0) &&
        pendingTotal > 0 &&
        Number(biz.productionNotifiedAt || 0) !== Number(biz.productionReadyAt || 0)
      ) {
        this._sendProductionReadyNotification(biz, pendingTotal);
        biz.productionNotifiedAt = Number(biz.productionReadyAt || 0);
        changed = true;
      }
    }

    if (changed) {
      this.store.set({
        businesses: {
          ...(s.businesses || {}),
          owned,
        },
      });
    }

    this._syncProductionNotifyTimers(changed ? owned : null);
  }

  _collectBusinessProduction(bizId) {
    this._refreshBusinessProduction();

    const s = this.store.get();
    const now = Date.now();

    const owned = (s.businesses?.owned || []).map((biz) => ({
      ...biz,
      products: (biz.products || []).map((p) => ({ ...p })),
      pendingProduction: (biz.pendingProduction || []).map((p) => ({ ...p })),
    }));

    const biz = owned.find((b) => b.id === bizId);
    if (!biz) return;

    const status = this._getBusinessProductionStatus(biz, now);

    if (status.producing) {
      this._showToast(`Üretim sürüyor • ${fmtDuration(status.timeToReady)} kaldı`);
      return;
    }

    if (status.missed) {
      this._showToast("Toplama süresi geçti, ürünler kayboldu");
      return;
    }

    if (status.pendingTotal <= 0) {
      this._showToast("Toplanacak üretim yok");
      return;
    }

    for (const row of biz.pendingProduction || []) {
      const product = (biz.products || []).find((p) => p.id === row.productId);
      if (!product) continue;
      product.qty = Number(product.qty || 0) + Number(row.qty || 0);
    }

    biz.stock = (biz.products || []).reduce(
      (sum, p) => sum + Number(p.qty || 0),
      0
    );

    biz.productionStartedAt = now;
    biz.productionReadyAt = now + DAY_MS;
    biz.productionCollectUntilAt = biz.productionReadyAt + HOUR_MS;
    biz.productionNotifiedAt = 0;
    biz.pendingProduction = this._createPendingProduction(
      biz.products,
      Number(biz.dailyProduction || BUSINESS_PRODUCTION_TOTAL),
      this._productionSeedFor(biz, biz.productionStartedAt)
    );

    this.store.set({
      businesses: {
        ...(s.businesses || {}),
        owned,
      },
    });

    this._syncProductionNotifyTimers(owned);
    this._showToast(`${fmtNum(status.pendingTotal)} ürün toplandı`);
  }

  async _sellBusinessProduct(bizId, productId) {
    const s = this.store.get();
    const businesses = (s.businesses?.owned || []).map((b) => ({
      ...b,
      products: (b.products || []).map((p) => ({ ...p })),
    }));

    const biz = businesses.find((b) => String(b.id) === String(bizId));
    if (!biz) return;

    const product = (biz.products || []).find((p) => String(p.id) === String(productId));
    if (!product) return;

    if (Number(product.qty || 0) <= 0) {
      this._showToast("Stok yok");
      return;
    }

    const maxQty = Number(product.qty || 0);
    const qtyRaw = window.prompt(`Kaç adet satmak istiyorsun? (Max ${maxQty})`, "1");
    if (qtyRaw === null) return;

    const qty = clamp(parseInt(qtyRaw, 10) || 0, 1, maxQty);
    if (qty <= 0) {
      this._showToast("Geçersiz adet");
      return;
    }

    const lowest = this._findLowestMarketPriceByName(product.name);
    const defaultPrice = lowest > 0 ? lowest : Number(product.price || 10);

    const priceRaw = window.prompt(
      lowest > 0
        ? `Birim satış fiyatını gir:\nPazardaki en düşük fiyat: ${lowest} yton`
        : "Birim satış fiyatını gir:",
      String(defaultPrice)
    );
    if (priceRaw === null) return;

    const price = Math.max(1, parseInt(priceRaw, 10) || 0);

    try {
      const profileId = await this._getProfileId();

      const result = await this._rpc("create_market_listing", {
        p_seller_profile_id: profileId,
        p_business_id: bizId,
        p_business_product_id: productId,
        p_quantity: qty,
        p_price_yton: price,
      });

      const row = Array.isArray(result) ? result[0] : result;

      const state2 = this.store.get();
      const businesses2 = (state2.businesses?.owned || []).map((b) => ({
        ...b,
        products: (b.products || []).map((p) => ({ ...p })),
      }));

      const listings = (state2.market?.listings || []).map((x) => ({ ...x }));
      const shops = (state2.market?.shops || []).map((x) => ({ ...x }));

      const biz2 = businesses2.find((b) => String(b.id) === String(bizId));
      if (biz2) {
        const product2 = (biz2.products || []).find((p) => String(p.id) === String(productId));
        if (product2) {
          product2.qty = Math.max(0, Number(product2.qty || 0) - qty);
        }
        biz2.stock = Math.max(0, Number(biz2.stock || 0) - qty);
      }

      const shopId = "shop_from_" + bizId;
      let shop = shops.find((x) => String(x.id) === shopId);

      if (!shop) {
        shop = {
          id: shopId,
          businessId: bizId,
          type: biz.type,
          icon: biz.icon || iconForType(biz.type),
          name: biz.name,
          ownerId: String(biz.ownerId || ""),
          ownerName: String(biz.ownerName || state2.player?.username || "Player"),
          online: true,
          theme: biz.theme || biz.type,
          rating: 5,
          totalListings: 0,
        };
        shops.unshift(shop);
      }

      listings.unshift({
        id: String(row?.id || "listing_" + Date.now()),
        shopId: shop.id,
        icon: product.icon || "📦",
        itemName: product.name,
        rarity: product.rarity || "common",
        stock: qty,
        price,
        energyGain: Number(product.energyGain || 0),
        usable: Number(product.energyGain || 0) > 0,
        desc: product.desc || "İşletme ürünü",
        businessId: bizId,
        businessProductId: productId,
      });

      for (const sh of shops) {
        sh.totalListings = listings.filter((x) => x.shopId === sh.id).length;
      }

      this.store.set({
        businesses: {
          ...(state2.businesses || {}),
          owned: businesses2,
        },
        market: {
          ...(state2.market || {}),
          shops,
          listings,
        },
      });

      this._showToast(`${qty} adet satışa çıkarıldı`);
    } catch (err) {
      console.error("create_market_listing error:", err);
      this._showToast(err?.message || "İlan oluşturulamadı");
    }
  }

  update() {
    this._updateLootAnimation();

    if (this.lootAnim) {
      this.dragging = false;
      this.clickCandidate = false;
      return;
    }

    const pointer = getPointer(this.input);
    const px = Number(pointer?.x || 0);
    const py = Number(pointer?.y || 0);

    if (justPressed(this.input)) {
      this.dragging = true;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && isDown(this.input)) {
      const dy = py - this.downY;
      this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && justReleased(this.input)) {
      this.dragging = false;

      if (!this.clickCandidate) return;

      if (this.hitBack && pointInRect(px, py, this.hitBack)) {
        this._goBack();
        return;
      }

      for (const h of this.hitTabs) {
        if (pointInRect(px, py, h.rect)) {
          this._changeTab(h.tab);
          return;
        }
      }

      for (const h of this.hitButtons) {
        if (!pointInRect(px, py, h.rect)) continue;

        switch (h.action) {
          case "search":
            this._promptSearch();
            return;
          case "open_shop":
            this._goShop(h.shopId);
            return;
          case "use_item":
            this._useInventoryItem(h.itemId);
            return;
          case "sell_item":
            this._sellInventoryItem(h.itemId);
            return;
          case "list_item":
            this._listInventoryItem(h.itemId);
            return;
          case "buy_market_item":
            this._buyMarketItem(h.shopId, h.itemId);
            return;
          case "buy_business":
            this._buyBusiness(h.businessType);
            return;
          case "use_business_product":
            this._useBusinessProduct(h.bizId, h.productId);
            return;
          case "sell_business_product":
            this._sellBusinessProduct(h.bizId, h.productId);
            return;
          case "collect_business":
            this._collectBusinessProduction(h.bizId);
            return; 
          case "free_spin":
            this._doFreeSpin();
            return;
          case "premium_spin":
            this._doPremiumSpin();
            return;
          case "buy_crate":
            this._buyCrate(h.value);
            return;
          case "go_tab":
            this._changeTab(h.value);
            return;
          case "inventory_filter":
            this._setTrade({ selectedInventoryCategory: h.value });
            this.scrollY = 0;
            return;
          case "market_filter":
            this._setTrade({ selectedMarketFilter: h.value });
            this.scrollY = 0;
            return;
          default:
            return;
        }
      }
    }
  }
_drawButton(ctx, rect, text, style = "ghost") {
  let fill = "rgba(255,255,255,0.05)";
  let stroke = "rgba(255,255,255,0.10)";
  let txt = "rgba(255,255,255,0.88)";

  if (style === "primary") {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, "rgba(164,122,38,0.78)");
    g.addColorStop(1, "rgba(104,72,18,0.84)");
    fill = g;
    stroke = "rgba(255,214,120,0.42)";
    txt = "#fff7e6";
  } else if (style === "gold") {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, "rgba(130,94,28,0.68)");
    g.addColorStop(1, "rgba(88,60,15,0.78)");
    fill = g;
    stroke = "rgba(255,214,120,0.34)";
    txt = "#fff5dd";
  } else if (style === "muted") {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(255,255,255,0.04)");
    fill = g;
    stroke = "rgba(255,255,255,0.10)";
    txt = "rgba(255,255,255,0.84)";
  }

  ctx.fillStyle = fill;
  fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);

  ctx.fillStyle = txt;
  ctx.font = rect.w < 84 ? "800 11px system-ui" : "800 12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fitText(ctx, text, rect.w - 12), rect.x + rect.w / 2, rect.y + rect.h / 2);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}


  _drawSearchBar(ctx, x, y, w, text) {
    const rect = { x, y, w, h: 46 };
    this.hitButtons.push({ rect, action: "search" });

    const g = ctx.createLinearGradient(x, y, x, y + rect.h);
    g.addColorStop(0, "rgba(20,24,30,0.42)");
    g.addColorStop(1, "rgba(10,13,18,0.54)");
    ctx.fillStyle = g;
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#ffb24a";
    fillRoundRect(ctx, rect.x + rect.w - 86, rect.y + 7, 56, 32, 16);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.52)";
    ctx.font = "900 15px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🔎", x + 14, y + 23);

    ctx.fillStyle = text ? "#ffffff" : "rgba(255,255,255,0.40)";
    ctx.font = "13px system-ui";
    ctx.fillText(text || "Mekan veya ürün ara", x + 42, y + 23);
  }

  _drawHeroCard(ctx, x, y, w, h, title, desc, badge, icon, glow = "#ff9e46") {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "rgba(8,12,18,0.42)");
    grad.addColorStop(1, "rgba(4,8,14,0.56)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, 24);

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, x, y, w, h, 24);

    const iconBox = { x: x + w - 96, y: y + 16, w: 66, h: 66 };

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = glow;
    fillRoundRect(ctx, iconBox.x, iconBox.y, iconBox.w, iconBox.h, 22);
    ctx.restore();

    ctx.fillStyle = "rgba(255,210,120,0.13)";
    fillRoundRect(ctx, x + 16, y + 14, 104, 24, 12);
    ctx.strokeStyle = "rgba(255,210,120,0.24)";
    strokeRoundRect(ctx, x + 16, y + 14, 104, 24, 12);

    ctx.fillStyle = "#ffe0a0";
    ctx.font = "800 10px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fitText(ctx, badge || "GÜNÜN VİTRİNİ", 90), x + 68, y + 26);

    const textMaxW = Math.max(90, iconBox.x - (x + 16) - 14);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 16px system-ui";
    ctx.fillText(fitText(ctx, title, textMaxW), x + 16, y + 58);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    const lines = wrapTextToLines(ctx, desc, textMaxW, 2);
    const baseY = y + 80;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x + 16, baseY + i * 16);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 30px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon || "📦", iconBox.x + iconBox.w / 2, iconBox.y + iconBox.h / 2 + 1);
  }

  _drawMiniCard(ctx, x, y, w, h, title, text, icon, accent = "#ffcc66") {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "rgba(10,14,20,0.34)");
    grad.addColorStop(1, "rgba(6,10,16,0.48)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, 20);

    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    strokeRoundRect(ctx, x, y, w, h, 20);

    const iconBox = { x: x + w - 54, y: y + 14, w: 38, h: 38 };
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = accent;
    fillRoundRect(ctx, iconBox.x, iconBox.y, iconBox.w, iconBox.h, 14);
    ctx.restore();

    const textMaxW = Math.max(72, iconBox.x - (x + 14) - 10);
    ctx.fillStyle = "#fff";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const titleLines = wrapTextToLines(ctx, title, textMaxW, 2);
    ctx.fillText(titleLines[0] || "", x + 14, y + 22);
    if (titleLines[1]) ctx.fillText(titleLines[1], x + 14, y + 38);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "11px system-ui";
    const descLines = wrapTextToLines(ctx, text, textMaxW, 2);
    const descTop = titleLines[1] ? y + 58 : y + 48;
    if (descLines[0]) ctx.fillText(descLines[0], x + 14, descTop);
    if (descLines[1]) ctx.fillText(descLines[1], x + 14, descTop + 14);

    ctx.fillStyle = "#fff";
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, iconBox.x + iconBox.w / 2, iconBox.y + iconBox.h / 2 + 1);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  _drawSectionTitle(ctx, x, y, title, sub) {
    ctx.fillStyle = "#fff";
    ctx.font = "900 15px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(title, x, y);

    if (sub) {
      ctx.fillStyle = "rgba(255,255,255,0.60)";
      ctx.font = "11px system-ui";
      ctx.fillText(sub, x, y + 16);
    }
  }

  _drawEmptyState(ctx, x, y, w, icon, text) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    fillRoundRect(ctx, x, y, w, 120, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    strokeRoundRect(ctx, x, y, w, 120, 18);

    ctx.fillStyle = "#fff";
    ctx.font = "900 28px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, x + w / 2, y + 38);

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 14px system-ui";
    ctx.fillText(text, x + w / 2, y + 82);

    return y + 132;
  }

  _renderExplore(ctx, x, y, w) {
    const trade = this._trade();
    const shops = this._marketShops();
    const listings = this._marketListings();

    const cheapestShop = shops
      .map((shop) => {
        const shopListings = listings.filter((l) => l.shopId === shop.id);
        const lowest = shopListings.length
          ? shopListings.reduce((m, l) => Math.min(m, Number(l.price || 0)), Number.MAX_SAFE_INTEGER)
          : 0;
        return { shop, lowest };
      })
      .filter((x) => x.lowest > 0)
      .sort((a, b) => a.lowest - b.lowest)[0];

    const popularShop = [...shops].sort(
      (a, b) => Number(b.rating || 0) - Number(a.rating || 0) || Number(b.totalListings || 0) - Number(a.totalListings || 0)
    )[0];

    const deal = [...listings].sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0];

    this._drawSearchBar(ctx, x, y, w, trade.searchQuery);
    y += 58;

    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      128,
      "Black Market Hub",
      deal ? `${deal.itemName} • ${fmtNum(deal.price)} yton` : "Ekonomi merkezi • vitrin • fırsatlar",
      "GÜNÜN VİTRİNİ",
      deal?.icon || "🕶️",
      "#ffcc66"
    );
    y += 140;

    const gap = 10;
    const colW = Math.floor((w - gap) / 2);

    const rect1 = { x, y, w: colW, h: 110 };
    const rect2 = { x: x + colW + gap, y, w: colW, h: 110 };
    this.hitButtons.push({ rect: rect1, action: "go_tab", value: "market" });
    this.hitButtons.push({ rect: rect2, action: "go_tab", value: "market" });

    this._drawMiniCard(
      ctx,
      rect1.x,
      rect1.y,
      rect1.w,
      rect1.h,
      "En Ucuz Mekanlar",
      cheapestShop ? `${cheapestShop.shop.name} • ${fmtNum(cheapestShop.lowest)} yton` : "Henüz veri yok",
      cheapestShop?.shop?.icon || "🏪",
      "#ffcc66"
    );

    this._drawMiniCard(
      ctx,
      rect2.x,
      rect2.y,
      rect2.w,
      rect2.h,
      "En Popüler Mekanlar",
      popularShop ? `${popularShop.name} • ${popularShop.rating || 0} puan` : "Henüz veri yok",
      popularShop?.icon || "🔥",
      "#ffcc66"
    );

    y += 122;

    const rect3 = { x, y, w: colW, h: 110 };
    const rect4 = { x: x + colW + gap, y, w: colW, h: 110 };
    this.hitButtons.push({ rect: rect3, action: "go_tab", value: "loot" });
    this.hitButtons.push({ rect: rect4, action: "free_spin" });

    this._drawMiniCard(ctx, rect3.x, rect3.y, rect3.w, rect3.h, "Sandık Fırsatları", "Mystery Crate • Premium sandıklar", "📦", "#ffcc66");
    this._drawMiniCard(
      ctx,
      rect4.x,
      rect4.y,
      rect4.w,
      rect4.h,
      "Günlük Çark",
      this._isFreeSpinReady() ? "Hazır • şimdi çevir" : "Bugün kullanıldı",
      this._isFreeSpinReady() ? "🎰" : "⏳",
      "#ffcc66"
    );

    y += 126;

    this._drawSectionTitle(ctx, x, y, "Hızlı Geçiş", "En çok kullanılan bölümler");
    y += 26;

    const buttons = [
      { text: "İşletmelerim", value: "businesses", style: "primary" },
      { text: "Envanter", value: "inventory", style: "muted" },
      { text: "Sandık & Çark", value: "loot", style: "gold" },
      { text: "Satın Al", value: "buy", style: "muted" },
    ];

    let bx = x;
    let by = y;
    for (const btn of buttons) {
      const rect = { x: bx, y: by, w: 110, h: 36 };
      this.hitButtons.push({ rect, action: "go_tab", value: btn.value });
      this._drawButton(ctx, rect, btn.text, btn.style);
      bx += 118;
      if (bx + 110 > x + w) {
        bx = x;
        by += 44;
      }
    }

    y = by + 48;
    return y;
  }

  _renderBusinesses(ctx, x, y, w) {
    this._refreshBusinessProduction();
    const businesses = this._allBusinesses();

    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      120,
      "İşletmelerim",
      `${fmtNum(businesses.length)} işletme • üretim / toplama paneli`,
      "OWNER MODE",
      "🏢",
      "#ffcc66"
    );
    y += 132;

    if (!businesses.length) {
      return this._drawEmptyState(ctx, x, y, w, "🏪", "Henüz işletmen yok.");
    }

    const now = Date.now();

    for (const biz of businesses) {
      const products = biz.products || [];
      const prod = this._getBusinessProductionStatus(biz, now);
      const recentMiss = Number(biz.lastMissedQty || 0) > 0 && (now - Number(biz.lastMissedAt || 0)) < DAY_MS;
      const infoLines = recentMiss ? 3 : 2;
      const headerH = recentMiss ? 110 : 92;
      const rowH = 60;
      const cardH = headerH + products.length * (rowH + 8);

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, x, y, w, cardH, 20);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      strokeRoundRect(ctx, x, y, w, cardH, 20);

      ctx.fillStyle = "#fff";
      ctx.font = "900 22px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(biz.icon || iconForType(biz.type), x + 14, y + 28);
      ctx.font = "900 15px system-ui";
      ctx.fillText(biz.name || "İşletme", x + 48, y + 24);

      const infoMaxW = w - 182;
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "12px system-ui";
      ctx.fillText(
        fitText(ctx, `${typeLabel(biz.type)} • 24 saatte rastgele ${fmtNum(biz.dailyProduction || BUSINESS_PRODUCTION_TOTAL)} üretim • Stok ${fmtNum(biz.stock)}`, infoMaxW),
        x + 48,
        y + 46
      );

      ctx.font = "11px system-ui";
      if (prod.producing) {
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.fillText(
          fitText(ctx, `Üretim sürüyor • Hazır olmasına ${fmtDuration(prod.timeToReady)} kaldı • Saat ${fmtClock(prod.readyAt)}`, infoMaxW),
          x + 48,
          y + 64
        );
      } else if (prod.ready) {
        ctx.fillStyle = "rgba(255,209,120,0.95)";
        ctx.fillText(
          fitText(ctx, `Hazır üretim ${fmtNum(prod.pendingTotal)} • ${fmtDuration(prod.timeToCollectEnd)} içinde topla • Son ${fmtClock(prod.collectUntilAt)}`, infoMaxW),
          x + 48,
          y + 64
        );
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.48)";
        ctx.fillText(
          fitText(ctx, `Bekleyen üretim yok • Yeni döngü hazır ${fmtClock(biz.productionReadyAt)}`, infoMaxW),
          x + 48,
          y + 64
        );
      }

      if (recentMiss) {
        ctx.fillStyle = "rgba(255,120,120,0.90)";
        ctx.font = "11px system-ui";
        ctx.fillText(
          fitText(ctx, `Kaçan üretim: ${fmtNum(biz.lastMissedQty)} ürün • Zamanında toplanmadığı için kayboldu`, infoMaxW),
          x + 48,
          y + 82
        );
      }

      const collectRect = { x: x + w - 112, y: y + 14, w: 96, h: 30 };
      if (prod.collectable) {
        this.hitButtons.push({ rect: collectRect, action: "collect_business", bizId: biz.id });
      }
      this._drawButton(ctx, collectRect, prod.collectable ? "Topla" : (prod.producing ? "Sürüyor" : "Kaçtı"), prod.collectable ? "gold" : "muted");

      let rowY = y + headerH;
      for (const p of products) {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        fillRoundRect(ctx, x + 12, rowY, w - 24, rowH, 14);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        strokeRoundRect(ctx, x + 12, rowY, w - 24, rowH, 14);

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        ctx.fillStyle = "#fff";
        ctx.font = "900 18px system-ui";
        ctx.fillText(p.icon || "📦", x + 22, rowY + 24);

        const useRect = { x: x + w - 176, y: rowY + 16, w: 68, h: 28 };
        const sellRect = { x: x + w - 100, y: rowY + 16, w: 84, h: 28 };
        const rowTextMaxW = Math.max(96, useRect.x - (x + 48) - 14);

        ctx.font = "900 13px system-ui";
        ctx.fillText(fitText(ctx, p.name || "Ürün", rowTextMaxW), x + 48, rowY + 20);

        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.font = "11px system-ui";
        ctx.fillText(fitText(ctx, `Stok ${fmtNum(p.qty)} • Taban ${fmtNum(p.price)} yton`, rowTextMaxW), x + 48, rowY + 40);

        this.hitButtons.push({ rect: useRect, action: "use_business_product", bizId: biz.id, productId: p.id });
        this.hitButtons.push({ rect: sellRect, action: "sell_business_product", bizId: biz.id, productId: p.id });

        this._drawButton(ctx, useRect, "Kullan", "primary");
        this._drawButton(ctx, sellRect, "Satışa Koy", "gold");

        rowY += rowH + 8;
      }

      y += cardH + 12;
    }

    return y;
  }

  _renderInventory(ctx, x, y, w) {
    const trade = this._trade();

    this._drawSearchBar(ctx, x, y, w, trade.searchQuery);
    y += 58;

    const filters = [
      { key: "all", label: "Tümü" },
      { key: "consumable", label: "Enerji" },
      { key: "girls", label: "Kadın" },
      { key: "goods", label: "Ürün" },
      { key: "rare", label: "Nadir" },
    ];

    let fx = x;
    for (const f of filters) {
      const rect = { x: fx, y, w: 70, h: 30 };
      this.hitButtons.push({ rect, action: "inventory_filter", value: f.key });
      this._drawButton(ctx, rect, f.label, trade.selectedInventoryCategory === f.key ? "primary" : "muted");
      fx += 76;
    }
    y += 42;

    let items = this._inventoryItems();
    if (trade.selectedInventoryCategory !== "all") {
      items = items.filter((x) => x.kind === trade.selectedInventoryCategory);
    }
    if (trade.searchQuery) {
      const q = trade.searchQuery.toLowerCase();
      items = items.filter((x) => String(x.name || "").toLowerCase().includes(q));
    }

    if (!items.length) {
      return this._drawEmptyState(ctx, x, y, w, "🎒", "Bu filtrede item yok.");
    }

    for (const item of items) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, x, y, w, 108, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      strokeRoundRect(ctx, x, y, w, 108, 18);

      ctx.fillStyle = "#fff";
      ctx.font = "900 22px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(item.icon || "📦", x + 14, y + 28);

      ctx.font = "900 14px system-ui";
      ctx.fillText(fitText(ctx, item.name || "Item", w - 64), x + 48, y + 22);

      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "11px system-ui";
      ctx.fillText(fitText(ctx, `Adet ${fmtNum(item.qty)} • NPC ${fmtNum(item.sellPrice)} yton`, w - 28), x + 14, y + 52);

      if (item.desc) {
        ctx.fillText(fitText(ctx, item.desc, w - 28), x + 14, y + 70);
      }

      const btnY = y + 78;
      let bx = x + 14;

      if (item.usable) {
        const rect = { x: bx, y: btnY, w: 74, h: 28 };
        this.hitButtons.push({ rect, action: "use_item", itemId: item.id });
        this._drawButton(ctx, rect, "Kullan", "primary");
        bx += 82;
      }

      if (item.sellable) {
        const rect = { x: bx, y: btnY, w: 60, h: 28 };
        this.hitButtons.push({ rect, action: "sell_item", itemId: item.id });
        this._drawButton(ctx, rect, "Sat", "gold");
        bx += 68;
      }

      if (item.marketable) {
        const rect = { x: bx, y: btnY, w: 98, h: 28 };
        this.hitButtons.push({ rect, action: "list_item", itemId: item.id });
        this._drawButton(ctx, rect, "Pazara Koy", "muted");
      }

      y += 120;
    }

    return y;
  }

  _renderLoot(ctx, x, y, w) {
    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      132,
      "Sandık & Çark",
      this._isFreeSpinReady() ? "Günlük çark hazır • dokun ve çevir" : "Premium çark ve sandık açılışları aktif",
      "LOOT MODE",
      "🎰",
      "#ffcc66"
    );

    const freeRect = { x: x + 14, y: y + 82, w: 124, h: 34 };
    const premiumRect = { x: x + 146, y: y + 82, w: 124, h: 34 };
    this.hitButtons.push({ rect: freeRect, action: "free_spin" });
    this.hitButtons.push({ rect: premiumRect, action: "premium_spin" });
    this._drawButton(ctx, freeRect, this._isFreeSpinReady() ? "Ücretsiz Çevir" : "Yarın Hazır", this._isFreeSpinReady() ? "primary" : "muted");
    this._drawButton(ctx, premiumRect, "Premium Çark", "gold");

    y += 146;

    const gap = 10;
    const colW = Math.floor((w - gap) / 2);

    const c1 = { x, y, w: colW, h: 112 };
    const c2 = { x: x + colW + gap, y, w: colW, h: 112 };
    this.hitButtons.push({ rect: c1, action: "buy_crate", value: "mystery" });
    this.hitButtons.push({ rect: c2, action: "buy_crate", value: "legendary" });

    this._drawMiniCard(ctx, c1.x, c1.y, c1.w, c1.h, "Mystery Crate", "65 yton • animasyonlu açılış", "📦", "#ffcc66");
    this._drawMiniCard(ctx, c2.x, c2.y, c2.w, c2.h, "Legendary Crate", "140 yton • yüksek ödül havuzu", "👑", "#ffcc66");

    y += 124;

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    fillRoundRect(ctx, x, y, w, 116, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    strokeRoundRect(ctx, x, y, w, 116, 18);

    ctx.fillStyle = "#fff";
    ctx.font = "900 14px system-ui";
    ctx.fillText("Animasyon Bilgisi", x + 14, y + 24);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText("• Çark gerçek teker gibi döner ve ödülde durur", x + 14, y + 52);
    ctx.fillText("• Sandık tek sıra akış ile kayar ve ödülde kilitlenir", x + 14, y + 70);
    ctx.fillText("• Mobil cihazlarda titreşim desteği otomatik denenir", x + 14, y + 88);

    y += 128;
    return y;
  }

  _renderMarket(ctx, x, y, w) {
    const trade = this._trade();

    this._drawSearchBar(ctx, x, y, w, trade.searchQuery);
    y += 58;

    const filters = [
      { key: "all", label: "Tümü" },
      { key: "nightclub", label: "Club" },
      { key: "coffeeshop", label: "Coffee" },
      { key: "brothel", label: "Genel" },
    ];

    let fx = x;
    for (const f of filters) {
      const rect = { x: fx, y, w: 70, h: 30 };
      this.hitButtons.push({ rect, action: "market_filter", value: f.key });
      this._drawButton(ctx, rect, f.label, trade.selectedMarketFilter === f.key ? "primary" : "muted");
      fx += 76;
    }
    y += 42;

    let shops = this._marketShops();
    if (trade.selectedMarketFilter !== "all") {
      shops = shops.filter((x) => x.type === trade.selectedMarketFilter);
    }

    if (trade.searchQuery) {
      const q = trade.searchQuery.toLowerCase();
      shops = shops.filter(
        (x) =>
          String(x.name || "").toLowerCase().includes(q) ||
          this._getListingsByShopId(x.id).some((l) => String(l.itemName || "").toLowerCase().includes(q))
      );
    }

    if (!shops.length) {
      return this._drawEmptyState(ctx, x, y, w, "🏬", "Bu filtrede dükkan yok.");
    }

    for (const shop of shops) {
      const shopListings = this._getListingsByShopId(shop.id);
      const lowest = shopListings.length
        ? shopListings.reduce((m, l) => Math.min(m, Number(l.price || 0)), Number.MAX_SAFE_INTEGER)
        : 0;

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, x, y, w, 102, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      strokeRoundRect(ctx, x, y, w, 102, 18);

      ctx.fillStyle = "#fff";
      ctx.font = "900 22px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(shop.icon || iconForType(shop.type), x + 14, y + 28);

      const enterRect = { x: x + w - 108, y: y + 64, w: 94, h: 28 };
      const shopTextMaxW = Math.max(90, enterRect.x - (x + 48) - 12);
      ctx.font = "900 14px system-ui";
      ctx.fillText(fitText(ctx, shop.name || "Dükkan", shopTextMaxW), x + 48, y + 22);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      ctx.fillText(fitText(ctx, `${typeLabel(shop.type)} • Sahip ${shop.ownerName || "?"}`, shopTextMaxW), x + 48, y + 42);
      ctx.fillText(fitText(ctx, `Ürün ${fmtNum(shop.totalListings)} • Puan ${shop.rating || 0} • En düşük ${lowest ? fmtNum(lowest) : "-"}`, shopTextMaxW), x + 48, y + 60);

      this.hitButtons.push({ rect: enterRect, action: "open_shop", shopId: shop.id });
      this._drawButton(ctx, enterRect, "Dükkana Gir", "primary");

      y += 114;
    }

    return y;
  }

  _renderShopView(ctx, x, y, w) {
    const trade = this._trade();
    const shop = this._getShopById(trade.selectedShopId);

    if (!shop) {
      return this._drawEmptyState(ctx, x, y, w, "❌", "Dükkan bulunamadı.");
    }

    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      108,
      shop.name || "Dükkan",
      `${typeLabel(shop.type)} • Sahip ${shop.ownerName || "?"} • Puan ${shop.rating || 0}`,
      shop.online ? "ONLINE" : "OFFLINE",
      shop.icon || iconForType(shop.type),
      "#ffcc66"
    );
    y += 120;

    const listings = this._getListingsByShopId(shop.id);

    if (!listings.length) {
      return this._drawEmptyState(ctx, x, y, w, "📭", "Bu dükkanda ürün yok.");
    }

    for (const item of listings) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, x, y, w, 102, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      strokeRoundRect(ctx, x, y, w, 102, 18);

      ctx.fillStyle = "#fff";
      ctx.font = "900 22px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(item.icon || "📦", x + 14, y + 28);

      const buyRect = { x: x + w - 94, y: y + 66, w: 80, h: 28 };
      const itemTextMaxW = Math.max(90, buyRect.x - (x + 48) - 12);
      ctx.font = "900 14px system-ui";
      ctx.fillText(fitText(ctx, item.itemName || "Ürün", itemTextMaxW), x + 48, y + 22);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      ctx.fillText(fitText(ctx, `Stok ${fmtNum(item.stock)} • Fiyat ${fmtNum(item.price)} yton`, w - 28), x + 14, y + 60);

      this.hitButtons.push({ rect: buyRect, action: "buy_market_item", itemId: item.id, shopId: shop.id });
      this._drawButton(ctx, buyRect, "Satın Al", "gold");

      y += 114;
    }

    return y;
  }

  _renderBuy(ctx, x, y, w) {
    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      118,
      "İşletme Satın Al",
      "Bina kartları • günlük üretim • isim vererek satın al",
      "OWNER SETUP",
      "🏗️",
      "#ffcc66"
    );
    y += 130;

    const buildings = [
      { type: "nightclub", icon: "🌃", name: "Nightclub", price: 1000, risk: "Orta", level: "Lv 25+" },
      { type: "coffeeshop", icon: "🌿", name: "Coffeeshop", price: 850, risk: "Düşük", level: "Lv 20+" },
      { type: "brothel", icon: "💋", name: "Genel Ev", price: 1200, risk: "Yüksek", level: "Lv 35+" },
    ];

    for (const b of buildings) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, x, y, w, 104, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      strokeRoundRect(ctx, x, y, w, 104, 18);

      ctx.fillStyle = "#fff";
      ctx.font = "900 22px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(b.icon, x + 14, y + 28);

      ctx.font = "900 14px system-ui";
      ctx.fillText(b.name, x + 48, y + 22);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      ctx.fillText(`Fiyat ${fmtNum(b.price)} yton • Günlük üretim 50`, x + 48, y + 44);
      ctx.fillText(`Risk ${b.risk} • Önerilen ${b.level}`, x + 48, y + 62);

      const rect = { x: x + w - 94, y: y + 66, w: 80, h: 28 };
      this.hitButtons.push({ rect, action: "buy_business", businessType: b.type });
      this._drawButton(ctx, rect, "Satın Al", "primary");

      y += 116;
    }

    return y;
  }

  render(ctx, w, h) {
    const state = this.store.get();
    const trade = this._trade();
    const safe = this._safeRect(w, h);

    this.hitBack = null;
    this.hitTabs = [];
    this.hitButtons = [];

    const bgImg =
      (this.blackmarketBgImg?.complete && this.blackmarketBgImg?.naturalWidth ? this.blackmarketBgImg : null) ||
      getImgSafe(this.assets, "blackmarket_bg") ||
      getImgSafe(this.assets, "trade") ||
      getImgSafe(this.assets, "blackmarket") ||
      getImgSafe(this.assets, "background");

    if (bgImg) {
      const iw = bgImg.width || 1;
      const ih = bgImg.height || 1;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(bgImg, dx, dy, dw, dh);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#08090d");
      bg.addColorStop(0.35, "#12090b");
      bg.addColorStop(0.7, "#0a0f16");
      bg.addColorStop(1, "#04070a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    const overlay = ctx.createLinearGradient(0, 0, 0, h);
    overlay.addColorStop(0, "rgba(0,0,0,0.48)");
    overlay.addColorStop(0.28, "rgba(16,8,8,0.58)");
    overlay.addColorStop(0.62, "rgba(8,10,18,0.72)");
    overlay.addColorStop(1, "rgba(2,5,10,0.86)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#ff9e46";
    fillRoundRect(ctx, safe.x - 8, safe.y + 8, safe.w * 0.42, 120, 42);
    ctx.fillStyle = "#ffcc66";
    fillRoundRect(ctx, safe.x + safe.w - 112, safe.y + 128, 78, 78, 28);
    ctx.restore();

    const panelX = safe.x;
    const panelY = safe.y;
    const panelW = safe.w;
    const panelH = safe.h;

    const shellGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    shellGrad.addColorStop(0, "rgba(8,12,18,0.26)");
    shellGrad.addColorStop(1, "rgba(4,8,14,0.34)");
    ctx.fillStyle = shellGrad;
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 28);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 28);


  this.hitBack = { x: panelX + panelW - 52, y: panelY + 10, w: 40, h: 40 };
this._drawButton(ctx, this.hitBack, "✕", "muted");

    

    let contentTop = panelY + 58;

    if (trade.view === "main") {
      const tabs = [
        { key: "explore", label: "Keşfet" },
        { key: "businesses", label: "İşletmelerim" },
        { key: "inventory", label: "Envanter" },
        { key: "loot", label: "Sandık & Çark" },
        { key: "market", label: "Açık Pazar" },
        { key: "buy", label: "Satın Al" },
      ];

      let tx = panelX + 16;
      let ty = panelY + 56;
      const limitX = panelX + panelW - 16;

      for (const tab of tabs) {
        const tw = clamp(28 + tab.label.length * 7.2, 86, 138);
        if (tx + tw > limitX) {
          tx = panelX + 16;
          ty += 42;
        }

        const rect = { x: tx, y: ty, w: tw, h: 34 };
        this.hitTabs.push({ rect, tab: tab.key });

        const active = trade.activeTab === tab.key;
        this._drawButton(ctx, rect, tab.label, active ? "primary" : "muted");
        tx += tw + 10;
      }

      contentTop = ty + 46;
    }

    const contentX = panelX + 8;
    const contentY = contentTop;
    const contentW = panelW - 16;
    const contentH = panelY + panelH - 8 - contentTop;

    const contentGrad = ctx.createLinearGradient(contentX, contentY, contentX, contentY + contentH);
    contentGrad.addColorStop(0, "rgba(8,12,18,0.22)");
    contentGrad.addColorStop(1, "rgba(4,8,14,0.30)");
    ctx.fillStyle = contentGrad;
    fillRoundRect(ctx, contentX, contentY, contentW, contentH, 24);

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    strokeRoundRect(ctx, contentX, contentY, contentW, contentH, 24);

    ctx.save();
    roundRectPath(ctx, contentX, contentY, contentW, contentH, 24);
    ctx.clip();

    let cursorY = contentY + 14 - this.scrollY;
    let endY = cursorY;

    if (trade.view === "shop") {
      endY = this._renderShopView(ctx, contentX + 12, cursorY, contentW - 24);
    } else {
      const x = contentX + 12;
      const y = cursorY;
      const w2 = contentW - 24;

      if (trade.activeTab === "explore") endY = this._renderExplore(ctx, x, y, w2);
      else if (trade.activeTab === "businesses") endY = this._renderBusinesses(ctx, x, y, w2);
      else if (trade.activeTab === "inventory") endY = this._renderInventory(ctx, x, y, w2);
      else if (trade.activeTab === "loot") endY = this._renderLoot(ctx, x, y, w2);
      else if (trade.activeTab === "market") endY = this._renderMarket(ctx, x, y, w2);
      else endY = this._renderBuy(ctx, x, y, w2);
    }

    ctx.restore();

    this.maxScroll = Math.max(0, (endY - contentY + 14) - contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    if (this.maxScroll > 0) {
      const barX = contentX + contentW - 6;
      const barY = contentY + 12;
      const barH = contentH - 24;
      const thumbH = Math.max(42, Math.floor((contentH / (contentH + this.maxScroll)) * barH));
      const thumbY = barY + Math.floor((this.scrollY / Math.max(1, this.maxScroll)) * (barH - thumbH));

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      fillRoundRect(ctx, barX, barY, 3, barH, 3);

      const sg = ctx.createLinearGradient(barX, thumbY, barX, thumbY + thumbH);
      sg.addColorStop(0, "rgba(255,196,100,0.82)");
      sg.addColorStop(1, "rgba(255,132,58,0.78)");
      ctx.fillStyle = sg;
      fillRoundRect(ctx, barX, thumbY, 3, thumbH, 3);
    }

    if (this.lootAnim) {
      this._drawLootOverlay(ctx, panelX, panelY, panelW, panelH);
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(panelW - 28, 290);
      const th = 40;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 10;

      ctx.fillStyle = "rgba(0,0,0,0.58)";
      fillRoundRect(ctx, tx, ty, tw, th, 14);

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      strokeRoundRect(ctx, tx, ty, tw, th, 14);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2);
    }
  }
}






