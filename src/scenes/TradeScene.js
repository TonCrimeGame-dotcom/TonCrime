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
      p.energy = clamp(Number(p.energy || 0) + Number(reward.amount || 0), 0, Number(p.energyMax || 100));
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
      p.energy = clamp(Number(p.energy || 0) + Number(reward.amount || 0), 0, Number(p.energyMax || 100));
      this.store.set({
        coins: Number(s.coins || 0) - cost,
        player: p,
      });
    } else {
      const items = (s.inventory?.items || []).map((x) => ({ ...x }));
      const existing = items.find((x) => x.name === reward.item.name);
      if (existing) existing.qty = Number(existing.qty || 0) + 1;
      else items.unshift({ ...reward.item });

      this.store.set({
        coins: Number(s.coins || 0) - cost,
        inventory: {
          ...(s.inventory || {}),
          items,
        },
      });
    }

    this._showToast(reward.text, 1600);
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


  _ensureMarketShopLocal(shopSeed = {}) {
    const s = this.store.get();
    const shops = (s.market?.shops || []).map((x) => ({ ...x }));
    const targetId = String(shopSeed.id || (shopSeed.businessId ? `shop_from_${shopSeed.businessId}` : `shop_${Date.now()}`));
    let shop = shops.find((x) => String(x.id) === targetId);
    if (!shop) {
      shop = {
        id: targetId,
        businessId: String(shopSeed.businessId || targetId),
        type: String(shopSeed.type || "blackmarket"),
        icon: shopSeed.icon || iconForType(shopSeed.type || "blackmarket"),
        name: String(shopSeed.name || "Black Market"),
        ownerId: String(shopSeed.ownerId || s.player?.id || "player_main"),
        ownerName: String(shopSeed.ownerName || s.player?.username || "Player"),
        online: true,
        theme: shopSeed.theme || shopSeed.type || "dark",
        rating: Number(shopSeed.rating || 5),
        totalListings: 0,
      };
      shops.unshift(shop);
      this.store.set({
        market: {
          ...(s.market || {}),
          shops,
          listings: (s.market?.listings || []).map((x) => ({ ...x })),
        },
      });
    }
    return shop;
  }

  _addLocalMarketListing(entry = {}) {
    const s = this.store.get();
    const shops = (s.market?.shops || []).map((x) => ({ ...x }));
    const listings = (s.market?.listings || []).map((x) => ({ ...x }));
    let shop = shops.find((x) => String(x.id) === String(entry.shopId));
    if (!shop) {
      shop = {
        id: String(entry.shopId || `shop_${Date.now()}`),
        businessId: String(entry.businessId || entry.shopId || "market_local"),
        type: String(entry.shopType || "blackmarket"),
        icon: entry.shopIcon || iconForType(entry.shopType || "blackmarket"),
        name: String(entry.shopName || "Black Market"),
        ownerId: String(entry.ownerId || s.player?.id || "player_main"),
        ownerName: String(entry.ownerName || s.player?.username || "Player"),
        online: true,
        theme: entry.shopTheme || entry.shopType || "dark",
        rating: Number(entry.shopRating || 5),
        totalListings: 0,
      };
      shops.unshift(shop);
    }

    const rowId = String(entry.id || `listing_${Date.now()}_${Math.floor(Math.random() * 100000)}`);
    listings.unshift({
      id: rowId,
      shopId: String(shop.id),
      icon: entry.icon || "📦",
      itemName: String(entry.itemName || "Ürün"),
      rarity: String(entry.rarity || "common"),
      stock: Number(entry.stock || 1),
      price: Number(entry.price || 1),
      energyGain: Number(entry.energyGain || 0),
      usable: !!entry.usable,
      desc: String(entry.desc || "Pazar ürünü"),
      inventoryItemId: entry.inventoryItemId != null ? String(entry.inventoryItemId) : undefined,
      businessId: entry.businessId != null ? String(entry.businessId) : undefined,
      businessProductId: entry.businessProductId != null ? String(entry.businessProductId) : undefined,
    });

    for (const sh of shops) {
      sh.totalListings = listings.filter((x) => String(x.shopId) === String(sh.id)).length;
    }

    this.store.set({
      market: {
        ...(s.market || {}),
        shops,
        listings,
      },
    });

    return { id: rowId };
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
        ? `Birim fiyat gir.
Pazardaki en düşük fiyat: ${lowest} yton`
        : "Birim satış fiyatını gir.",
      String(defaultPrice)
    );
    if (priceRaw === null) return;

    const price = Math.max(1, parseInt(priceRaw, 10) || 0);

    let localOnly = false;
    let marketBusiness = null;
    let row = null;

    try {
      const profileId = await this._getProfileId();

      const { data: invRow, error: invError } = await supabase
        .from("inventory_items")
        .select("id, profile_id, item_key, item_name, quantity, meta")
        .eq("profile_id", profileId)
        .eq("item_key", String(item.id))
        .maybeSingle();

      if (invError) throw invError;
      if (!invRow?.id) throw new Error("Backend inventory kaydı bulunamadı");

      const { data: bizRows, error: bizError } = await supabase
        .from("businesses")
        .select("id, name, business_name, business_type, owner_id, owner_profile_id")
        .or(`owner_id.eq.${profileId},owner_profile_id.eq.${profileId}`)
        .eq("business_type", "blackmarket")
        .limit(1);

      if (bizError) throw bizError;
      marketBusiness = Array.isArray(bizRows) ? bizRows[0] : bizRows;
      if (!marketBusiness?.id) throw new Error("Inventory item satışı için blackmarket business kaydı gerekli");

      const result = await this._rpc("create_market_listing", {
        p_seller_profile_id: profileId,
        p_business_id: marketBusiness.id,
        p_inventory_item_id: invRow.id,
        p_qty: qty,
        p_quantity: qty,
        p_price_yton: price,
      });

      row = Array.isArray(result) ? result[0] : result;
    } catch (err) {
      localOnly = true;
      marketBusiness = {
        id: "blackmarket_local",
        business_name: "Black Market",
        name: "Black Market",
        business_type: "blackmarket",
        owner_id: String(s.player?.id || "player_main"),
        owner_profile_id: String(s.player?.id || "player_main"),
      };
      row = { id: `listing_${Date.now()}_${Math.floor(Math.random() * 100000)}` };
    }

    const state2 = this.store.get();
    const items2 = (state2.inventory?.items || []).map((x) => ({ ...x }));

    const idx2 = items2.findIndex((x) => String(x.id) === String(itemId));
    if (idx2 >= 0) {
      items2[idx2].qty = Math.max(0, Number(items2[idx2].qty || 0) - qty);
      if (items2[idx2].qty <= 0) items2.splice(idx2, 1);
    }

    this.store.set({
      inventory: {
        ...(state2.inventory || {}),
        items: items2,
      },
    });

    const shop = this._ensureMarketShopLocal({
      id: "shop_" + String(marketBusiness.id || "blackmarket_local"),
      businessId: String(marketBusiness.id || "blackmarket_local"),
      type: "blackmarket",
      icon: "🕶️",
      name: String(marketBusiness.name || marketBusiness.business_name || "Black Market"),
      ownerId: String(marketBusiness.owner_id || marketBusiness.owner_profile_id || state2.player?.id || "player_main"),
      ownerName: String(state2.player?.username || "Player"),
      theme: "dark",
    });

    this._addLocalMarketListing({
      id: String(row?.id || `listing_${Date.now()}`),
      shopId: shop.id,
      shopName: shop.name,
      shopType: shop.type,
      shopIcon: shop.icon,
      shopTheme: shop.theme,
      ownerId: shop.ownerId,
      ownerName: shop.ownerName,
      icon: item.icon || "📦",
      itemName: item.name,
      rarity: item.rarity || "common",
      stock: qty,
      price,
      energyGain: Number(item.energyGain || 0),
      usable: !!item.usable,
      desc: item.desc || "Envanter ürünü",
      inventoryItemId: itemId,
      businessId: String(marketBusiness.id || "blackmarket_local"),
    });

    this._showToast(localOnly ? `${qty} adet pazara kondu` : `${qty} adet pazara kondu`);
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
  
  _createPendingProduction(products = [], totalDaily = 50) {
    const safeProducts = (products || []).map((p) => ({ ...p }));
    if (!safeProducts.length) return [];

    const per = Math.floor(totalDaily / safeProducts.length);
    let remainder = totalDaily - per * safeProducts.length;

    return safeProducts.map((p) => {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      return {
        productId: p.id,
        qty: per + extra,
      };
    });
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

      if (!Array.isArray(biz.pendingProduction)) {
        biz.pendingProduction = this._createPendingProduction(
          biz.products,
          Number(biz.dailyProduction || 50)
        );
        changed = true;
      }

      if (!biz.productionStartedAt) {
        biz.productionStartedAt = now;
        changed = true;
      }

      if (!biz.productionExpireAt) {
        biz.productionExpireAt = Number(biz.productionStartedAt) + DAY_MS;
        changed = true;
      }

      const pendingTotal = (biz.pendingProduction || []).reduce(
        (sum, row) => sum + Number(row.qty || 0),
        0
      );

      if (now >= Number(biz.productionExpireAt || 0)) {
        if (pendingTotal > 0) {
          biz.pendingProduction = biz.pendingProduction.map((row) => ({
            ...row,
            qty: 0,
          }));
        }

        biz.productionStartedAt = now;
        biz.productionExpireAt = now + DAY_MS;
        biz.pendingProduction = this._createPendingProduction(
          biz.products,
          Number(biz.dailyProduction || 50)
        );
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

    biz.pendingProduction = this._createPendingProduction(
      biz.products,
      Number(biz.dailyProduction || 50)
    );
    biz.productionStartedAt = now;
    biz.productionExpireAt = now + DAY_MS;

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
        ? `Birim satış fiyatını gir:
Pazardaki en düşük fiyat: ${lowest} yton`
        : "Birim satış fiyatını gir:",
      String(defaultPrice)
    );
    if (priceRaw === null) return;

    const price = Math.max(1, parseInt(priceRaw, 10) || 0);

    let localOnly = false;
    let row = null;
    let dbBusinessId = null;

    try {
      const profileId = await this._getProfileId();
      const { data: bizRows, error: bizError } = await supabase
        .from("businesses")
        .select("id, business_type, business_name, name, owner_id, owner_profile_id")
        .or(`owner_id.eq.${profileId},owner_profile_id.eq.${profileId}`)
        .eq("business_type", String(biz.type || ""))
        .limit(20);

      if (bizError) throw bizError;

      const dbBiz = (bizRows || []).find((row) => {
        const dbName = String(row?.business_name || row?.name || "").trim().toLowerCase();
        const localName = String(biz.name || "").trim().toLowerCase();
        return !localName || dbName === localName;
      }) || (bizRows || [])[0];

      if (!dbBiz?.id) throw new Error("İşletmenin veritabanı kaydı bulunamadı");
      dbBusinessId = String(dbBiz.id);

      const result = await this._rpc("create_market_listing", {
        p_seller_profile_id: profileId,
        p_business_id: dbBusinessId,
        p_business_product_id: String(productId),
        p_product_key: String(product.id || productId),
        p_qty: qty,
        p_quantity: qty,
        p_price_yton: price,
      });

      row = Array.isArray(result) ? result[0] : result;
    } catch (err) {
      localOnly = true;
      row = { id: `listing_${Date.now()}_${Math.floor(Math.random() * 100000)}` };
      dbBusinessId = String(bizId);
    }

    const state2 = this.store.get();
    const businesses2 = (state2.businesses?.owned || []).map((b) => ({
      ...b,
      products: (b.products || []).map((p) => ({ ...p })),
    }));

    const biz2 = businesses2.find((b) => String(b.id) === String(bizId));
    if (biz2) {
      const product2 = (biz2.products || []).find((p) => String(p.id) === String(productId));
      if (product2) {
        product2.qty = Math.max(0, Number(product2.qty || 0) - qty);
      }
      biz2.stock = Math.max(0, Number(biz2.stock || 0) - qty);
    }

    this.store.set({
      businesses: {
        ...(state2.businesses || {}),
        owned: businesses2,
      },
    });

    const shop = this._ensureMarketShopLocal({
      id: "shop_from_" + String(bizId),
      businessId: String(dbBusinessId || bizId),
      type: biz.type,
      icon: biz.icon || iconForType(biz.type),
      name: biz.name,
      ownerId: String(biz.ownerId || state2.player?.id || "player_main"),
      ownerName: String(biz.ownerName || state2.player?.username || "Player"),
      theme: biz.theme || biz.type,
    });

    this._addLocalMarketListing({
      id: String(row?.id || `listing_${Date.now()}`),
      shopId: shop.id,
      shopName: shop.name,
      shopType: shop.type,
      shopIcon: shop.icon,
      shopTheme: shop.theme,
      ownerId: shop.ownerId,
      ownerName: shop.ownerName,
      icon: product.icon || "📦",
      itemName: product.name,
      rarity: product.rarity || "common",
      stock: qty,
      price,
      energyGain: Number(product.energyGain || 0),
      usable: Number(product.energyGain || 0) > 0,
      desc: product.desc || "İşletme ürünü",
      businessId: String(dbBusinessId || bizId),
      businessProductId: String(productId),
    });

    this._showToast(localOnly ? `${qty} adet satışa çıkarıldı` : `${qty} adet satışa çıkarıldı`);
  }

  update() {
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

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = glow;
    fillRoundRect(ctx, x + w - 96, y + 16, 66, 66, 22);
    ctx.restore();

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
      const remainMs = Math.max(0, Number(biz.productionExpireAt || 0) - Date.now());
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
          ? `Hazır üretim ${fmtNum(pendingCount)} • ${remainHours}s ${remainMinutes}d içinde topla`
          : "Bekleyen üretim yok",
        x + 48,
        y + 64
      );

      const collectRect = { x: x + w - 102, y: y + 14, w: 86, h: 30 };
      this.hitButtons.push({ rect: collectRect, action: "collect_business", bizId: biz.id });
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
      this._isFreeSpinReady() ? "Günlük ücretsiz çark hazır" : "Premium loot sistemi aktif",
      "PREMIUM LOOT",
      "🎰",
      "#c77dff"
    );

    const freeRect = { x: x + 14, y: y + 76, w: 116, h: 34 };
    const premiumRect = { x: x + 138, y: y + 76, w: 122, h: 34 };
    this.hitButtons.push({ rect: freeRect, action: "free_spin" });
    this.hitButtons.push({ rect: premiumRect, action: "premium_spin" });
    this._drawButton(ctx, freeRect, this._isFreeSpinReady() ? "Ücretsiz Çevir" : "Yarın Açılır", this._isFreeSpinReady() ? "primary" : "muted");
    this._drawButton(ctx, premiumRect, "Premium Çark", "gold");

    y += 136;

    const gap = 10;
    const colW = Math.floor((w - gap) / 2);

    const c1 = { x, y, w: colW, h: 112 };
    const c2 = { x: x + colW + gap, y, w: colW, h: 112 };
    this.hitButtons.push({ rect: c1, action: "buy_crate", value: "mystery" });
    this.hitButtons.push({ rect: c2, action: "buy_crate", value: "legendary" });

    this._drawMiniCard(ctx, c1.x, c1.y, c1.w, c1.h, "Mystery Crate", "65 yton • satın al / sat", "📦", "#62b3ff");
    this._drawMiniCard(ctx, c2.x, c2.y, c2.w, c2.h, "Legendary Crate", "140 yton • premium ödül", "👑", "#ffcc66");

    y += 124;

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    fillRoundRect(ctx, x, y, w, 96, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    strokeRoundRect(ctx, x, y, w, 96, 18);

    ctx.fillStyle = "#fff";
    ctx.font = "900 14px system-ui";
    ctx.fillText("Ödül Havuzu", x + 14, y + 24);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText("💰 YTON   ⚡ Enerji   📦 Mystery Crate   👑 Golden Pass", x + 14, y + 54);
    ctx.fillText("Sonraki aşamada burada animasyonlu loot ekranı olacak.", x + 14, y + 74);

    y += 108;
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
    shellGrad.addColorStop(0, "rgba(8,12,18,0.26)");
    shellGrad.addColorStop(1, "rgba(4,8,14,0.34)");
    ctx.fillStyle = shellGrad;
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 28);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 28);


  this.hitBack = { x: panelX + 12, y: panelY + 10, w: 40, h: 40 };
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






