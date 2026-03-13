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
    case "blackmarket":
      return "Black Market";
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
    case "blackmarket":
      return "🕶️";
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

    if (typeof assets.getImage === "function") {
      const img = assets.getImage(key);
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
  }

  onEnter() {
    const s = this.store.get();
    const trade = s.trade || {};

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;

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
      x: safe.x + 8,
      y: safe.y + topReserved + 2,
      w: safe.w - 16,
      h: safe.h - topReserved - bottomReserved - 6,
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
    return listings.reduce(
      (min, x) => Math.min(min, Number(x.price || 0)),
      Number.MAX_SAFE_INTEGER
    );
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

  async _rpc(name, params = {}) {
    const { data, error } = await supabase.rpc(name, params);
    if (error) throw error;
    return data;
  }

  _doFreeSpin() {
    if (!this._isFreeSpinReady()) {
      this._showToast("Günlük ücretsiz çark kullanıldı");
      return;
    }

    const rewards = [
      { type: "coins", amount: 25, text: "+25 yton" },
      { type: "coins", amount: 60, text: "+60 yton" },
      { type: "energy", amount: 15, text: "+15 enerji" },
      {
        type: "item",
        text: "Mystery Crate kazandın",
        item: {
          id: "crate_" + Date.now(),
          kind: "rare",
          icon: "📦",
          name: "Mystery Crate",
          rarity: "rare",
          qty: 1,
          usable: false,
          sellable: true,
          marketable: true,
          sellPrice: 45,
          marketPrice: 60,
          desc: "Sandık ödülü.",
        },
      },
    ];

    const reward = rewards[Math.floor(Math.random() * rewards.length)];
    const s = this.store.get();

    if (reward.type === "coins") {
      this.store.set({
        coins: Number(s.coins || 0) + Number(reward.amount || 0),
        trade: {
          ...(s.trade || {}),
          lastFreeSpinDay: todayKey(),
        },
      });
    } else if (reward.type === "energy") {
      const p = { ...(s.player || {}) };
      p.energy = clamp(
        Number(p.energy || 0) + Number(reward.amount || 0),
        0,
        Number(p.energyMax || 100)
      );
      this.store.set({
        player: p,
        trade: {
          ...(s.trade || {}),
          lastFreeSpinDay: todayKey(),
        },
      });
    } else {
      const items = (s.inventory?.items || []).map((x) => ({ ...x }));
      const existing = items.find((x) => x.name === reward.item.name);
      if (existing) existing.qty = Number(existing.qty || 0) + 1;
      else items.unshift({ ...reward.item });

      this.store.set({
        inventory: {
          ...(s.inventory || {}),
          items,
        },
        trade: {
          ...(s.trade || {}),
          lastFreeSpinDay: todayKey(),
        },
      });
    }

    this._showToast(reward.text, 1600);
  }

  _doPremiumSpin() {
    const s = this.store.get();
    const cost = 90;

    if (Number(s.coins || 0) < cost) {
      this._showToast("Premium çark için yetersiz yton");
      return;
    }

    const rewards = [
      { type: "coins", amount: 180, text: "+180 yton" },
      { type: "energy", amount: 30, text: "+30 enerji" },
      {
        type: "item",
        text: "Golden Pass kazandın",
        item: {
          id: "gold_pass_" + Date.now(),
          kind: "rare",
          icon: "👑",
          name: "Golden Pass",
          rarity: "legendary",
          qty: 1,
          usable: false,
          sellable: true,
          marketable: false,
          sellPrice: 250,
          marketPrice: 0,
          desc: "Nadir etkinlik ürünü.",
        },
      },
    ];

    const reward = rewards[Math.floor(Math.random() * rewards.length)];

    if (reward.type === "coins") {
      this.store.set({
        coins: Number(s.coins || 0) - cost + Number(reward.amount || 0),
      });
    } else if (reward.type === "energy") {
      const p = { ...(s.player || {}) };
     
