import { supabase } from "../supabase.js";

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

function rarityColor(r) {
  switch (String(r || "").toLowerCase()) {
    case "common":
      return "#9ca3af";
    case "rare":
      return "#58a6ff";
    case "epic":
      return "#c77dff";
    case "legendary":
      return "#ffcc66";
    default:
      return "#9ca3af";
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

const DAY_MS = 24 * 60 * 60 * 1000;

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
    this.hitLootButtons = [];
    this.hitPremiumButton = null;
    this.hitLootButtons = [];
    this.hitPremiumButton = null;

    this.toastText = "";
    this.toastUntil = 0;

    this.lootAnim = null;
    this.lootAnimUntil = 0;
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
    this.lootAnimUntil = 0;

    this.store.set({
      premium: !!s.premium,
      premiumExpire: Number(s.premiumExpire || 0),
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
  }

  _isPremiumActive() {
    const s = this.store.get() || {};
    const expire = Number(s.premiumExpire || 0);
    const manualFlag = !!(s.premium || s.player?.premium || s.player?.isPremium);
    return manualFlag && (!expire || Date.now() < expire);
  }

  _ensurePremiumState() {
    const s = this.store.get() || {};
    const expire = Number(s.premiumExpire || 0);
    if ((s.premium || s.player?.premium || s.player?.isPremium) && expire && Date.now() >= expire) {
      this.store.set({
        premium: false,
        premiumExpire: 0,
        player: { ...(s.player || {}), premium: false, isPremium: false },
      });
      return false;
    }
    return this._isPremiumActive();
  }

  _buyPremium() {
    const s = this.store.get() || {};
    const cost = 500;
    const now = Date.now();
    const durationMs = 24 * 60 * 60 * 1000;
    if (Number(s.coins || 0) < cost) {
      this._showToast("Premium için 500 yton gerekli");
      return;
    }
    const currentExpire = Number(s.premiumExpire || 0);
    const nextExpire = currentExpire > now ? currentExpire + durationMs : now + durationMs;
    this.store.set({
      coins: Number(s.coins || 0) - cost,
      premium: true,
      premiumExpire: nextExpire,
      player: { ...(s.player || {}), premium: true, isPremium: true },
    });
    this._showToast("Premium üyelik aktif edildi");
  }

  _premiumRemainingText() {
    const s = this.store.get() || {};
    if (!this._isPremiumActive()) return "Kapalı";
    const expire = Number(s.premiumExpire || 0);
    if (!expire) return "Aktif";
    const remain = Math.max(0, expire - Date.now());
    const hours = Math.floor(remain / (60 * 60 * 1000));
    const mins = Math.floor((remain % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}s ${mins}d`;
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
      y: safe.y + topReserved - 18,
      w: safe.w - 20,
      h: safe.h - topReserved - bottomReserved + 8,
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
    const s = this.store.get();
    return String(
      s?.player?.telegramId ||
      window.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
      ""
    ).trim();
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


  _startLootAnimation(type, label, rewardText) {
    this.lootAnim = {
      type: type || "crate",
      label: String(label || ""),
      rewardText: String(rewardText || ""),
      startedAt: Date.now(),
      duration: type === "wheel" ? 2200 : 1800,
    };
    this.lootAnimUntil = this.lootAnim.startedAt + this.lootAnim.duration;
  }

  _randomProductionAllocation(products = [], totalDaily = 50) {
    const list = (products || []).map((p) => ({ ...p })).filter(Boolean);
    if (!list.length) return [];
    const out = list.map((p) => ({ productId: p.id, qty: 0 }));
    let remaining = Math.max(0, Math.floor(Number(totalDaily || 0)));

    while (remaining > 0) {
      const index = Math.floor(Math.random() * out.length);
      const step = Math.min(remaining, 1 + Math.floor(Math.random() * 3));
      out[index].qty += step;
      remaining -= step;
    }

    return out.filter((x) => Number(x.qty || 0) > 0);
  }



  _buildWheelRewards() {
    return [
      { kind: "coins", amount: 40, label: "+40 YTON" },
      { kind: "coins", amount: 80, label: "+80 YTON" },
      { kind: "energy", amount: 20, label: "+20 ENERJİ" },
      { kind: "energy", amount: 35, label: "+35 ENERJİ" },
      { kind: "item", label: "GOLDEN PASS", item: { id: "gold_pass_" + Date.now(), kind: "rare", icon: "👑", name: "Golden Pass", rarity: "legendary", qty: 1, usable: false, sellable: true, marketable: false, sellPrice: 250, marketPrice: 0, desc: "Nadir etkinlik ürünü." } },
      { kind: "item", label: "MYSTERY CRATE", item: { id: "crate_" + Date.now(), kind: "rare", icon: "📦", name: "Mystery Crate", rarity: "rare", qty: 1, usable: false, sellable: true, marketable: true, sellPrice: 45, marketPrice: 60, desc: "Sandık ödülü." } },
      { kind: "coins", amount: 140, label: "+140 YTON" },
      { kind: "item", label: "LEGENDARY CRATE", item: { id: "legendary_" + Date.now(), kind: "rare", icon: "👑", name: "Legendary Crate", rarity: "legendary", qty: 1, usable: false, sellable: true, marketable: true, sellPrice: 90, marketPrice: 140, desc: "Premium sandık ödülü." } },
    ];
  }

  _buildCrateRewards() {
    return [
      { kind: "coins", amount: 10, label: "+10 YTON", tier: "small" },
      { kind: "coins", amount: 15, label: "+15 YTON", tier: "small" },
      { kind: "coins", amount: 20, label: "+20 YTON", tier: "small" },
      { kind: "energy", amount: 8, label: "+8 ENERJİ", tier: "small" },
      { kind: "energy", amount: 10, label: "+10 ENERJİ", tier: "small" },
      { kind: "coins", amount: 30, label: "+30 YTON", tier: "small" },
      { kind: "item", label: "MYSTERY CRATE", tier: "big", item: { id: "crate_" + Date.now(), kind: "rare", icon: "📦", name: "Mystery Crate", rarity: "rare", qty: 1, usable: false, sellable: true, marketable: true, sellPrice: 45, marketPrice: 60, desc: "Sandık ödülü." } },
      { kind: "item", label: "GOLDEN PASS", tier: "big", item: { id: "gold_pass_" + Date.now(), kind: "rare", icon: "👑", name: "Golden Pass", rarity: "legendary", qty: 1, usable: false, sellable: true, marketable: false, sellPrice: 250, marketPrice: 0, desc: "Nadir etkinlik ürünü." } },
    ];
  }

  _applyLootReward(reward) {
    const s = this.store.get();
    if (!reward) return "";
    if (reward.kind === "coins") {
      const bonusAmount = this._isPremiumActive() ? Math.floor(Number(reward.amount || 0) * 1.2) : Number(reward.amount || 0);
      this.store.set({ coins: Number(s.coins || 0) + bonusAmount });
      return `+${bonusAmount} YTON`;
    }
    if (reward.kind === "energy") {
      const p = { ...(s.player || {}) };
      const bonusAmount = this._isPremiumActive() ? Math.floor(Number(reward.amount || 0) * 1.2) : Number(reward.amount || 0);
      p.energy = clamp(Number(p.energy || 0) + bonusAmount, 0, Number(p.energyMax || 100));
      this.store.set({ player: p });
      return `+${bonusAmount} ENERJİ`;
    }
    if (reward.kind === "item" && reward.item) {
      const items = (s.inventory?.items || []).map((x) => ({ ...x }));
      const existing = items.find((x) => x.name === reward.item.name);
      if (existing) existing.qty = Number(existing.qty || 0) + 1;
      else items.unshift({ ...reward.item });
      this.store.set({ inventory: { ...(s.inventory || {}), items } });
      return reward.label;
    }
    return reward.label || "Ödül";
  }

  _openFreeCrate() {
    if (!this._isFreeSpinReady()) {
      this._showToast("Günlük sandık bugün açıldı");
      return;
    }
    const rewards = this._buildCrateRewards();
    const weights = rewards.map((r) => r.tier === "big" ? 1 : 8);
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    let resultIndex = 0;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { resultIndex = i; break; }
    }
    this._setTrade({ ...this._trade(), lastFreeSpinDay: todayKey() });
    this.lootAnim = {
      kind: "crate",
      phase: "spinning",
      rewards,
      resultIndex,
      selectedReward: rewards[resultIndex],
      startedAt: Date.now(),
      duration: 1800,
      resultApplied: false,
      travel: 1700 + Math.random() * 500,
    };
    this.lootAnimUntil = this.lootAnim.startedAt + this.lootAnim.duration;
  }

  _openPremiumWheel() {
    const s = this.store.get();
    if (Number(s.coins || 0) < 100) {
      this._showToast("Premium çark için yetersiz yton");
      return;
    }
    this.lootAnim = {
      kind: "wheel",
      phase: "idle",
      rewards: this._buildWheelRewards(),
      startedAt: Date.now(),
      duration: 0,
      resultApplied: false,
      selectedReward: null,
      resultIndex: -1,
      cost: 100,
    };
    this.lootAnimUntil = Number.MAX_SAFE_INTEGER;
  }

  _spinPremiumWheel() {
    if (!this.lootAnim || this.lootAnim.kind !== "wheel" || this.lootAnim.phase !== "idle") return;
    const s = this.store.get();
    const cost = Number(this.lootAnim.cost || 100);
    if (Number(s.coins || 0) < cost) {
      this._showToast("Premium çark için yetersiz yton");
      this._closeLootOverlay();
      return;
    }
    this.store.set({ coins: Number(s.coins || 0) - cost });
    const rewards = this.lootAnim.rewards || this._buildWheelRewards();
    const weights = rewards.map((r) => (r.kind === "item" ? 1 : (Number(r.amount || 0) >= 100 ? 2 : 5)));
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    let resultIndex = 0;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { resultIndex = i; break; }
    }
    const wedge = (Math.PI * 2) / rewards.length;
    const turns = 5 + Math.floor(Math.random() * 3);
    const targetAngle = turns * Math.PI * 2 + (Math.PI * 1.5) - (resultIndex * wedge + wedge / 2);
    this.lootAnim.phase = "spinning";
    this.lootAnim.startedAt = Date.now();
    this.lootAnim.duration = 3000;
    this.lootAnim.resultIndex = resultIndex;
    this.lootAnim.selectedReward = rewards[resultIndex];
    this.lootAnim.startAngle = 0;
    this.lootAnim.targetAngle = targetAngle;
    this.lootAnim.resultApplied = false;
    this.lootAnimUntil = this.lootAnim.startedAt + this.lootAnim.duration;
  }

  _finalizeLootIfNeeded() {
    if (!this.lootAnim || this.lootAnim.phase !== "spinning") return;
    if (Date.now() < this.lootAnimUntil) return;
    if (!this.lootAnim.resultApplied) {
      const rewardText = this._applyLootReward(this.lootAnim.selectedReward);
      this.lootAnim.rewardText = rewardText;
      this.lootAnim.resultApplied = true;
      this._showToast(`Şu ödülü kazandın: ${rewardText}`, 2400);
    }
    this.lootAnim.phase = "result";
    this.lootAnimUntil = Date.now() + 2400;
  }

  _closeLootOverlay() {
    this.lootAnim = null;
    this.lootAnimUntil = 0;
  }

  _doFreeSpin() {
    this._openFreeCrate();
  }


  _doPremiumSpin() {
    this._openPremiumWheel();
  }

  _buyCrate(kind) {
    const s = this.store.get();
    const cost = kind === "legendary" ? 140 : 65;
    const rarity = kind === "legendary" ? "legendary" : "rare";
    const name = kind === "legendary" ? "Legendary Crate" : "Mystery Crate";

    if (Number(s.coins || 0) < cost) {
      this._showToast("Yetersiz yton");
      return;
    }

    const items = (s.inventory?.items || []).map((x) => ({ ...x }));
    const existing = items.find((x) => x.name === name);

    if (existing) existing.qty = Number(existing.qty || 0) + 1;
    else {
      items.unshift({
        id: "crate_buy_" + Date.now(),
        kind: "rare",
        icon: "📦",
        name,
        rarity,
        qty: 1,
        usable: false,
        sellable: true,
        marketable: true,
        sellPrice: Math.floor(cost * 0.65),
        marketPrice: cost + 15,
        desc: "Sandık ürünü.",
      });
    }

    this.store.set({
      coins: Number(s.coins || 0) - cost,
      inventory: {
        ...(s.inventory || {}),
        items,
      },
    });

    this._showToast(`${name} satın alındı`);
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

    this.store.set({
      coins: Number(s.coins || 0) + gain,
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
    const rawGain = this._isPremiumActive() ? Math.floor(Number(product.energyGain || 0) * 1.2) : Number(product.energyGain || 0);
    const gain = Math.min(rawGain, Math.max(0, maxEnergy - currentEnergy));

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
  
  _createPendingProduction(products = [], totalDaily = 50) {
    return this._randomProductionAllocation(products, totalDaily);
  }


_refreshBusinessProduction() {
  const s = this.store.get();
  const now = Date.now();

  const owned = (s.businesses?.owned || []).map((biz) => ({
    ...biz,
    products: (biz.products || []).map((p) => ({ ...p })),
    pendingProduction: Array.isArray(biz.pendingProduction)
      ? biz.pendingProduction.map((p) => ({ ...p }))
      : [],
  }));

  let changed = false;

  for (const biz of owned) {
    const hasProducts = Array.isArray(biz.products) && biz.products.length > 0;
    if (!hasProducts) continue;

    if (!Array.isArray(biz.pendingProduction) || !biz.pendingProduction.length) {
      biz.pendingProduction = (biz.products || []).map((p) => ({ productId: p.id, qty: 0 }));
      changed = true;
    }

    if (!biz.productionReadyAt) {
      biz.productionReadyAt = now + DAY_MS;
      changed = true;
    }

    if (!biz.productionExpireAt) {
      biz.productionExpireAt = Number(biz.productionReadyAt) + DAY_MS;
      changed = true;
    }

    const pendingTotal = (biz.pendingProduction || []).reduce(
      (sum, row) => sum + Number(row.qty || 0),
      0
    );

    if (pendingTotal <= 0 && now >= Number(biz.productionReadyAt || 0)) {
      biz.pendingProduction = this._createPendingProduction(
        biz.products,
        Number(biz.dailyProduction || 50)
      );
      biz.productionExpireAt = now + DAY_MS;
      changed = true;
    } else if (pendingTotal > 0 && now >= Number(biz.productionExpireAt || 0)) {
      biz.pendingProduction = (biz.products || []).map((p) => ({ productId: p.id, qty: 0 }));
      biz.productionReadyAt = now + DAY_MS;
      biz.productionExpireAt = Number(biz.productionReadyAt) + DAY_MS;
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

    const pendingTotal = (biz.pendingProduction || []).reduce(
      (sum, row) => sum + Number(row.qty || 0),
      0
    );

    if (pendingTotal <= 0) {
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

    biz.pendingProduction = (biz.products || []).map((p) => ({ productId: p.id, qty: 0 }));
    biz.productionReadyAt = now + DAY_MS;
    biz.productionExpireAt = biz.productionReadyAt + DAY_MS;

    this.store.set({
      businesses: {
        ...(s.businesses || {}),
        owned,
      },
    });

    this._showToast(`${fmtNum(pendingTotal)} ürün toplandı`);
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
    this._ensurePremiumState();
    this._refreshBusinessProduction();
    this._finalizeLootIfNeeded();

    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;

    if (this.input?.justPressed?.()) {
      this.dragging = true;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && this.input?.isDown?.()) {
      const dy = py - this.downY;
      this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.input?.justReleased?.()) {
      this.dragging = false;

      if (!this.clickCandidate) return;

      if (this.lootAnim) {
        for (const h of this.hitLootButtons || []) {
          if (!pointInRect(px, py, h.rect)) continue;
          if (h.action === "loot_spin") {
            this._spinPremiumWheel();
            return;
          }
          if (h.action === "loot_close") {
            this._closeLootOverlay();
            return;
          }
        }
        return;
      }

      if (this.hitBack && pointInRect(px, py, this.hitBack)) {
        this._goBack();
        return;
      }

      if (this.hitPremiumButton && pointInRect(px, py, this.hitPremiumButton)) {
        this._buyPremium();
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
    g.addColorStop(0, "rgba(40,95,210,0.72)");
    g.addColorStop(1, "rgba(18,54,140,0.78)");
    fill = g;
    stroke = "rgba(130,175,255,0.45)";
    txt = "#ffffff";
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
  ctx.font = "800 12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);

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


    ctx.fillStyle = "rgba(255,210,120,0.13)";
    fillRoundRect(ctx, x + 16, y + 14, 104, 24, 12);
    ctx.strokeStyle = "rgba(255,210,120,0.24)";
    strokeRoundRect(ctx, x + 16, y + 14, 104, 24, 12);

    ctx.fillStyle = "#ffe0a0";
    ctx.font = "800 10px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badge || "GÜNÜN VİTRİNİ", x + 68, y + 26);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 16px system-ui";
    ctx.fillText(title, x + 16, y + 58);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    ctx.fillText(desc, x + 16, y + 81);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 30px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon || "📦", x + w - 63, y + h / 2);
  }

  _drawMiniCard(ctx, x, y, w, h, title, text, icon, accent = "#458cff") {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "rgba(10,14,20,0.34)");
    grad.addColorStop(1, "rgba(6,10,16,0.48)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, 20);

    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    strokeRoundRect(ctx, x, y, w, h, 20);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = accent;
    fillRoundRect(ctx, x + w - 56, y + 14, 40, 40, 14);
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = "900 14px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(title, x + 14, y + 24);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    ctx.fillText(text, x + 14, y + 48);

    ctx.fillStyle = "#fff";
    ctx.font = "900 24px system-ui";
    ctx.fillText(icon, x + w - 42, y + 38);
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
      "#4b8fff"
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
      "#62b3ff"
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

    this._drawMiniCard(ctx, rect3.x, rect3.y, rect3.w, rect3.h, "Sandık Fırsatları", "Mystery Crate • Premium sandıklar", "📦", "#c77dff");
    this._drawMiniCard(
      ctx,
      rect4.x,
      rect4.y,
      rect4.w,
      rect4.h,
      "Günlük Çark",
      this._isFreeSpinReady() ? "Hazır • şimdi çevir" : "Bugün kullanıldı",
      this._isFreeSpinReady() ? "🎰" : "⏳",
      this._isFreeSpinReady() ? "#46d799" : "#94a3b8"
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
      `${fmtNum(businesses.length)} işletme • yönetim paneli`,
      "OWNER MODE",
      "🏢",
      "#4b8fff"
    );
    y += 132;

    if (!businesses.length) {
      return this._drawEmptyState(ctx, x, y, w, "🏪", "Henüz işletmen yok.");
    }

    for (const biz of businesses) {
      const products = biz.products || [];
      const cardH = 122 + products.length * 64;

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

      const pendingCount = (biz.pendingProduction || []).reduce(
        (sum, row) => sum + Number(row.qty || 0),
        0
      );
      const targetTs = pendingCount > 0 ? Number(biz.productionExpireAt || 0) : Number(biz.productionReadyAt || 0);
      const remainMs = Math.max(0, targetTs - Date.now());
      const remainHours = Math.floor(remainMs / (60 * 60 * 1000));
      const remainMinutes = Math.floor((remainMs % (60 * 60 * 1000)) / (60 * 1000));

      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "12px system-ui";
      ctx.fillText(
        `${typeLabel(biz.type)} • Günlük üretim ${fmtNum(biz.dailyProduction)} • Stok ${fmtNum(biz.stock)}`,
        x + 48,
        y + 46
      );

      ctx.fillStyle = pendingCount > 0 ? "rgba(255,209,120,0.95)" : "rgba(255,255,255,0.48)";
      ctx.font = "11px system-ui";
      ctx.fillText(
        pendingCount > 0
          ? `Hazır üretim ${fmtNum(pendingCount)} • ${remainHours}s ${remainMinutes}d içinde silinir`
          : `Sonraki üretim ${remainHours}s ${remainMinutes}d sonra hazır`,
        x + 48,
        y + 64
      );

      const collectRect = { x: x + w - 102, y: y + 14, w: 86, h: 30 };
      if (pendingCount > 0) this.hitButtons.push({ rect: collectRect, action: "collect_business", bizId: biz.id });
      this._drawButton(ctx, collectRect, "Topla", pendingCount > 0 ? "gold" : "muted");

      let rowY = y + 82;
for (const p of products) {
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  fillRoundRect(ctx, x + 12, rowY, w - 24, 54, 14);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  strokeRoundRect(ctx, x + 12, rowY, w - 24, 54, 14);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#fff";
  ctx.font = "900 18px system-ui";
  ctx.fillText(p.icon || "📦", x + 22, rowY + 22);

  ctx.font = "900 13px system-ui";
  ctx.fillText(p.name || "Ürün", x + 48, rowY + 18);

  ctx.fillStyle = rarityColor(p.rarity);
  ctx.font = "800 10px system-ui";
  ctx.fillText(String(p.rarity || "common").toUpperCase(), x + 48, rowY + 34);

  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "11px system-ui";
  ctx.fillText(`Stok ${fmtNum(p.qty)} • Taban ${fmtNum(p.price)} yton`, x + 110, rowY + 34);

  const useRect = { x: x + w - 170, y: rowY + 12, w: 66, h: 28 };
  const sellRect = { x: x + w - 96, y: rowY + 12, w: 78, h: 28 };

  this.hitButtons.push({ rect: useRect, action: "use_business_product", bizId: biz.id, productId: p.id });
  this.hitButtons.push({ rect: sellRect, action: "sell_business_product", bizId: biz.id, productId: p.id });

  this._drawButton(ctx, useRect, "Kullan", "primary");
  this._drawButton(ctx, sellRect, "Satışa Koy", "gold");

  rowY += 62;
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
      ctx.fillText(item.name || "Item", x + 48, y + 22);

      ctx.fillStyle = rarityColor(item.rarity);
      ctx.font = "800 10px system-ui";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), x + 48, y + 38);

      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "11px system-ui";
      ctx.fillText(`Adet ${fmtNum(item.qty)} • NPC ${fmtNum(item.sellPrice)} yton`, x + 14, y + 56);

      if (item.desc) {
        ctx.fillText(item.desc, x + 14, y + 74);
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
      124,
      "Sandık & Çark",
      "Günlük sandık ücretsiz • premium çark 100 yton",
      "PREMIUM LOOT",
      "🎰",
      "#c77dff"
    );

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(
      this._isFreeSpinReady()
        ? "Günlük sandık hazır • alt kutudan aç"
        : "Günlük sandık bugün açıldı • yarın tekrar aktif",
      x + 16,
      y + 94
    );
    ctx.fillText("Premium çark her zaman aktif • ödüller çark üstünde görünür", x + 16, y + 112);

    y += 136;

    const gap = 10;
    const colW = Math.floor((w - gap) / 2);

    const c1 = { x, y, w: colW, h: 132 };
    const c2 = { x: x + colW + gap, y, w: colW, h: 132 };

    this._drawMiniCard(ctx, c1.x, c1.y, c1.w, c1.h, "Günlük Sandık", "Her gün 1 kez ücretsiz aç", "📦", "#62b3ff");
    this._drawMiniCard(ctx, c2.x, c2.y, c2.w, c2.h, "Premium Çark", "100 yton • animasyonlu ödül", "👑", "#ffcc66");

    const freeBtn = { x: c1.x + 14, y: c1.y + 86, w: c1.w - 28, h: 34 };
    const premiumBtn = { x: c2.x + 14, y: c2.y + 86, w: c2.w - 28, h: 34 };

    this.hitButtons.push({ rect: freeBtn, action: "free_spin" });
    this.hitButtons.push({ rect: premiumBtn, action: "premium_spin" });

    this._drawButton(
      ctx,
      freeBtn,
      this._isFreeSpinReady() ? "Günlük Sandık Aç" : "Yarın Açılır",
      this._isFreeSpinReady() ? "primary" : "muted"
    );
    this._drawButton(ctx, premiumBtn, "Premium Çark 100", "gold");

    y += 144;

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    fillRoundRect(ctx, x, y, w, 82, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    strokeRoundRect(ctx, x, y, w, 82, 18);

    ctx.fillStyle = "#fff";
    ctx.font = "900 14px system-ui";
    ctx.fillText("Ödül Havuzu", x + 14, y + 24);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText("💰 YTON   ⚡ Enerji   📦 Sandık   👑 Golden Pass", x + 14, y + 54);

    y += 94;
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

      ctx.font = "900 14px system-ui";
      ctx.fillText(shop.name || "Dükkan", x + 48, y + 22);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      ctx.fillText(`${typeLabel(shop.type)} • Sahip ${shop.ownerName || "?"}`, x + 48, y + 42);
      ctx.fillText(`Ürün ${fmtNum(shop.totalListings)} • Puan ${shop.rating || 0} • En düşük ${lowest ? fmtNum(lowest) : "-"}`, x + 48, y + 60);

      const enterRect = { x: x + w - 108, y: y + 64, w: 94, h: 28 };
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
      "#4b8fff"
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

      ctx.font = "900 14px system-ui";
      ctx.fillText(item.itemName || "Ürün", x + 48, y + 22);

      ctx.fillStyle = rarityColor(item.rarity);
      ctx.font = "800 10px system-ui";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), x + 48, y + 40);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      ctx.fillText(`Stok ${fmtNum(item.stock)} • Fiyat ${fmtNum(item.price)} yton`, x + 14, y + 64);

      const buyRect = { x: x + w - 94, y: y + 66, w: 80, h: 28 };
      this.hitButtons.push({ rect: buyRect, action: "buy_market_item", itemId: item.id, shopId: shop.id });
      this._drawButton(ctx, buyRect, "Satın Al", "gold");

      y += 114;
    }

    return y;
  }


_buyBusiness(businessType) {
  const s = this.store.get();
  const p = s.player || {};
  const level = Number(p.level || 1);
  const isPremium = !!(p.isPremium || p.premium || s.isPremium || s.premium || p.membership === "premium") && (!s.premiumExpire || Date.now() < Number(s.premiumExpire || 0));

  if (level < 50 && !isPremium) {
    this._showToast("Bu bölüm Lv 50+ veya Premium üyelerde açılır");
    return;
  }

  const catalog = {
    nightclub: {
      price: 1000,
      icon: "🌃",
      name: "Velvet Night",
      theme: "neon",
      products: [
        { id: "biz_night_whiskey_" + Date.now(), icon: "🥃", name: "Black Whiskey", rarity: "common", qty: 0, price: 28, energyGain: 8, desc: "Gece kulübü ürünü." },
        { id: "biz_night_champ_" + Date.now(), icon: "🍾", name: "Premium Champagne", rarity: "rare", qty: 0, price: 44, energyGain: 14, desc: "Daha iyi enerji verir." },
      ],
    },
    coffeeshop: {
      price: 850,
      icon: "🌿",
      name: "Amsterdam Dreams",
      theme: "green",
      products: [
        { id: "biz_coffee_weed_" + Date.now(), icon: "🍁", name: "White Widow", rarity: "rare", qty: 0, price: 36, energyGain: 12, desc: "Enerji için kullanılabilir." },
      ],
    },
    brothel: {
      price: 1200,
      icon: "💋",
      name: "Ruby House",
      theme: "red",
      products: [
        { id: "biz_brothel_vip_" + Date.now(), icon: "🌹", name: "VIP Companion", rarity: "epic", qty: 0, price: 95, energyGain: 22, desc: "Yüksek enerji itemi." },
      ],
    },
  };

  const cfg = catalog[businessType];
  if (!cfg) {
    this._showToast("İşletme tipi bulunamadı");
    return;
  }

  if (Number(s.coins || 0) < Number(cfg.price || 0)) {
    this._showToast("Yetersiz yton");
    return;
  }

  const owned = (s.businesses?.owned || []).map((b) => ({ ...b, products: (b.products || []).map((p) => ({ ...p })) }));
  const sameTypeCount = owned.filter((b) => String(b.type) === String(businessType)).length + 1;
  const bizId = `biz_${businessType}_${Date.now()}`;
  const biz = {
    id: bizId,
    type: businessType,
    icon: cfg.icon,
    name: cfg.name + (sameTypeCount > 1 ? ` ${sameTypeCount}` : ""),
    ownerId: String(s.player?.id || "player_main"),
    ownerName: String(s.player?.username || "Player"),
    dailyProduction: 50,
    stock: 0,
    theme: cfg.theme,
    products: cfg.products,
    pendingProduction: cfg.products.map((p) => ({ productId: p.id, qty: 0 })),
    productionReadyAt: Date.now() + DAY_MS,
    productionExpireAt: Date.now() + DAY_MS * 2,
  };

  owned.unshift(biz);

  this.store.set({
    coins: Number(s.coins || 0) - Number(cfg.price || 0),
    businesses: {
      ...(s.businesses || {}),
      owned,
    },
  });

  this._showToast(`${biz.name} satın alındı`);
}

  _drawPremiumCard(ctx, x, y, w) {
    const active = this._isPremiumActive();
    const h = 124;
    const price = 500;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "rgba(44,30,8,0.58)");
    grad.addColorStop(1, "rgba(16,10,4,0.72)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, 20);
    ctx.strokeStyle = "rgba(255,214,120,0.22)";
    strokeRoundRect(ctx, x, y, w, h, 20);
    ctx.fillStyle = "#fff5dd";
    ctx.font = "900 22px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("👑", x + 14, y + 28);
    ctx.font = "900 15px system-ui";
    ctx.fillText("Premium Üyelik", x + 48, y + 22);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "11px system-ui";
    ctx.fillText(`Fiyat ${fmtNum(price)} yton • Süre 24 saat`, x + 48, y + 42);
    ctx.fillText("Bonus: +%20 yton ödülü • +%20 enerji kazanımı", x + 48, y + 60);
    ctx.fillText(`Durum: ${active ? "Aktif" : "Kapalı"} • Kalan: ${this._premiumRemainingText()}`, x + 48, y + 78);
    const badgeRect = { x: x + w - 108, y: y + 16, w: 92, h: 28 };
    this._drawButton(ctx, badgeRect, active ? "PREMIUM" : "VIP PASS", active ? "primary" : "muted");
    this.hitPremiumButton = { x: x + w - 108, y: y + 78, w: 92, h: 30 };
    this._drawButton(ctx, this.hitPremiumButton, active ? "Uzat" : "Satın Al", "gold");
    return y + h + 12;
  }

  _renderBuy(ctx, x, y, w) {
    y = this._drawPremiumCard(ctx, x, y, w);
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
      { type: "nightclub", icon: "🌃", name: "Nightclub", price: 1000, risk: "Orta", level: "Lv 50+ / Premium" },
      { type: "coffeeshop", icon: "🌿", name: "Coffeeshop", price: 850, risk: "Düşük", level: "Lv 50+ / Premium" },
      { type: "brothel", icon: "💋", name: "Genel Ev", price: 1200, risk: "Yüksek", level: "Lv 50+ / Premium" },
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
    this.hitLootButtons = [];

    const bgImg =
      getImgSafe(this.assets, "trade") ||
      getImgSafe(this.assets, "blackmarket_bg") ||
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
    ctx.fillStyle = "#2d68ff";
    fillRoundRect(ctx, safe.x + safe.w - 112, safe.y + 128, 78, 78, 28);
    ctx.restore();

    const panelX = safe.x;
    const panelY = safe.y;
    const panelW = safe.w;
    const panelH = safe.h;

   const shellGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
shellGrad.addColorStop(0, "rgba(8,12,18,0.08)");
shellGrad.addColorStop(1, "rgba(4,8,14,0.12)");
ctx.fillStyle = shellGrad;
fillRoundRect(ctx, panelX, panelY, panelW, panelH, 28);

ctx.strokeStyle = "rgba(255,255,255,0.04)";
ctx.lineWidth = 1;
strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 28);


this.hitBack = { x: panelX + 8, y: panelY + 6, w: 34, h: 34 };
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
contentGrad.addColorStop(0, "rgba(8,12,18,0.10)");
contentGrad.addColorStop(1, "rgba(4,8,14,0.14)");
ctx.fillStyle = contentGrad;
fillRoundRect(ctx, contentX, contentY, contentW, contentH, 24);

ctx.strokeStyle = "rgba(255,255,255,0.03)";
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
      const anim = this.lootAnim;
      const now = Date.now();
      const ox = panelX + 18;
      const oy = panelY + 18;
      const ow = panelW - 36;
      const oh = panelH - 36;
      const cx = ox + ow / 2;
      const cy = oy + oh / 2 - 20;

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.70)";
      fillRoundRect(ctx, ox, oy, ow, oh, 28);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx, ox, oy, ow, oh, 28);

      if (anim.kind === "wheel") {
        const rewards = anim.rewards || [];
        const wedge = (Math.PI * 2) / Math.max(1, rewards.length);
        let angle = 0;
        if (anim.phase === "spinning") {
          const t = clamp((now - anim.startedAt) / Math.max(1, anim.duration), 0, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          angle = (anim.startAngle || 0) + ((anim.targetAngle || 0) - (anim.startAngle || 0)) * ease;
        } else if (anim.phase === "result") {
          angle = anim.targetAngle || 0;
        }

        const radius = Math.min(ow, oh) * 0.28;
        const colors = ["#ffb347","#ff6b6b","#5ec7ff","#7ee081","#c77dff","#ffd166","#ff925a","#8cc8ff"];

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        for (let i = 0; i < rewards.length; i++) {
          const start = i * wedge;
          const end = start + wedge;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, radius, start, end);
          ctx.closePath();
          ctx.fillStyle = colors[i % colors.length];
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.save();
          ctx.rotate(start + wedge / 2);
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#fff";
          ctx.font = "900 10px system-ui";
          const label = String(rewards[i].label || "").slice(0, 12);
          ctx.fillText(label, radius - 10, 0);
          ctx.restore();
        }
        ctx.restore();

        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.stroke();

        ctx.fillStyle = "#ffd36c";
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius - 20);
        ctx.lineTo(cx - 12, cy - radius + 10);
        ctx.lineTo(cx + 12, cy - radius + 10);
        ctx.closePath();
        ctx.fill();

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.font = "900 22px system-ui";
        ctx.fillText("Premium Çark", cx, oy + 34);

        if (anim.phase === "idle") {
          const spinRect = { x: cx - 74, y: oy + oh - 64, w: 148, h: 40 };
          this.hitLootButtons.push({ rect: spinRect, action: "loot_spin" });
          this._drawButton(ctx, spinRect, "Döndür", "gold");
        } else if (anim.phase === "result") {
          ctx.fillStyle = "rgba(255,224,160,0.98)";
          ctx.font = "900 18px system-ui";
          ctx.fillText(`Şu ödülü kazandın: ${anim.rewardText || ""}`, cx, oy + oh - 82);

          const closeRect = { x: cx - 74, y: oy + oh - 56, w: 148, h: 36 };
          this.hitLootButtons.push({ rect: closeRect, action: "loot_close" });
          this._drawButton(ctx, closeRect, "Kapat", "primary");
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.86)";
          ctx.font = "800 14px system-ui";
          ctx.fillText("Çark dönüyor...", cx, oy + oh - 42);
        }
      } else if (anim.kind === "crate") {
        const rewards = anim.rewards || [];
        const slotW = Math.min(ow - 80, 320);
        const slotH = 78;
        const slotX = cx - slotW / 2;
        const slotY = cy - slotH / 2 + 16;
        const boxW = 112;
        const gap = 16;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.font = "900 22px system-ui";
        ctx.fillText("Günlük Sandık", cx, oy + 34);

        fillRoundRect(ctx, slotX, slotY, slotW, slotH, 18);
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fillRect(slotX, slotY, slotW, slotH);
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        strokeRoundRect(ctx, slotX, slotY, slotW, slotH, 18);

        ctx.strokeStyle = "#ffd36c";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, slotY - 8);
        ctx.lineTo(cx, slotY + slotH + 8);
        ctx.stroke();

        let offset = 0;
        if (anim.phase === "spinning") {
          const t = clamp((now - anim.startedAt) / Math.max(1, anim.duration), 0, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          offset = (anim.travel || 1800) * (1 - ease);
        }
        const centerBase = cx - boxW / 2 - (anim.resultIndex || 0) * (boxW + gap);

        for (let i = 0; i < rewards.length; i++) {
          const rx = centerBase + i * (boxW + gap) + offset;
          if (rx + boxW < slotX - 120 || rx > slotX + slotW + 120) continue;

          const reward = rewards[i];
          fillRoundRect(ctx, rx, slotY + 8, boxW, slotH - 16, 16);
          ctx.fillStyle = reward.tier === "big" ? "rgba(255,196,100,0.18)" : "rgba(255,255,255,0.08)";
          ctx.fillRect(rx, slotY + 8, boxW, slotH - 16);
          ctx.strokeStyle = reward.tier === "big" ? "rgba(255,196,100,0.55)" : "rgba(255,255,255,0.16)";
          strokeRoundRect(ctx, rx, slotY + 8, boxW, slotH - 16, 16);

          ctx.fillStyle = "#fff";
          ctx.font = "900 14px system-ui";
          ctx.fillText(reward.kind === "item" ? (reward.item?.icon || "🎁") : (reward.kind === "energy" ? "⚡" : "💰"), rx + boxW / 2, slotY + 28);
          ctx.font = "900 12px system-ui";
          ctx.fillText(String(reward.label || "").slice(0, 14), rx + boxW / 2, slotY + 54);
        }

        if (anim.phase === "result") {
          ctx.fillStyle = "rgba(255,224,160,0.98)";
          ctx.font = "900 18px system-ui";
          ctx.fillText(`Şu ödülü kazandın: ${anim.rewardText || ""}`, cx, oy + oh - 82);

          const closeRect = { x: cx - 74, y: oy + oh - 56, w: 148, h: 36 };
          this.hitLootButtons.push({ rect: closeRect, action: "loot_close" });
          this._drawButton(ctx, closeRect, "Kapat", "primary");
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.86)";
          ctx.font = "800 14px system-ui";
          ctx.fillText("Kasa dönüyor...", cx, oy + oh - 42);
        }
      }

      ctx.restore();
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







