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

  _listInventoryItem(itemId) {
    const s = this.store.get();
    const items = (s.inventory?.items || []).map((x) => ({ ...x }));
    const idx = items.findIndex((x) => x.id === itemId);
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

    const qtyRaw = window.prompt("Kaç adet satmak istiyorsun?", "1");
    if (qtyRaw === null) return;
    const qty = clamp(parseInt(qtyRaw, 10) || 0, 1, Number(item.qty || 0));
    if (qty <= 0) {
      this._showToast("Geçersiz adet");
      return;
    }

    const lowest = this._findLowestMarketPriceByName(item.name);
    const priceRaw = window.prompt(
      lowest > 0
        ? `Birim fiyat gir.\nPazardaki en düşük fiyat: ${lowest} yton`
        : "Birim satış fiyatını gir.",
      String(item.marketPrice || item.sellPrice || 10)
    );
    if (priceRaw === null) return;

    const price = Math.max(1, parseInt(priceRaw, 10) || 0);
    const myShop = this._ensurePlayerMarketShop();
    const state2 = this.store.get();
    const shops = (state2.market?.shops || []).map((x) => ({ ...x }));
    const listings = (state2.market?.listings || []).map((x) => ({ ...x }));
    const items2 = (state2.inventory?.items || []).map((x) => ({ ...x }));
    const idx2 = items2.findIndex((x) => x.id === itemId);
    if (idx2 < 0) return;

    const item2 = items2[idx2];
    item2.qty = Math.max(0, Number(item2.qty || 0) - qty);

    listings.unshift({
      id: "listing_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
      shopId: myShop.id,
      icon: item2.icon || "📦",
      itemName: item2.name,
      rarity: item2.rarity || "common",
      stock: qty,
      price,
      energyGain: Number(item2.energyGain || 0),
      usable: !!item2.usable,
      desc: item2.desc || "Oyuncu pazarı ürünü.",
    });

    if (item2.qty <= 0) items2.splice(idx2, 1);
    else items2[idx2] = item2;

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
  }

  _buyMarketItem(shopId, listingId) {
    const s = this.store.get();
    const listings = (s.market?.listings || []).map((x) => ({ ...x }));
    const idx = listings.findIndex((x) => x.id === listingId && x.shopId === shopId);
    if (idx < 0) return;

    const item = listings[idx];
    const price = Number(item.price || 0);
    const coins = Number(s.coins || 0);

    if (coins < price) {
      this._showToast("Yetersiz yton");
      return;
    }

    item.stock = Math.max(0, Number(item.stock || 0) - 1);
    if (item.stock <= 0) listings.splice(idx, 1);
    else listings[idx] = item;

    const invItems = (s.inventory?.items || []).map((x) => ({ ...x }));
    const existing = invItems.find((x) => x.name === item.itemName && x.rarity === item.rarity);

    if (existing) {
      existing.qty = Number(existing.qty || 0) + 1;
    } else {
      invItems.unshift({
        id: "inv_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
        kind: item.usable ? "consumable" : "goods",
        icon: item.icon || "📦",
        name: item.itemName,
        rarity: item.rarity || "common",
        qty: 1,
        usable: !!item.usable,
        sellable: true,
        marketable: true,
        energyGain: Number(item.energyGain || 0),
        sellPrice: Math.max(1, Math.floor(price * 0.65)),
        marketPrice: price,
        desc: item.desc || "Market ürünü",
      });
    }

    const shops = (s.market?.shops || []).map((x) => ({ ...x }));
    for (const shop of shops) {
      shop.totalListings = listings.filter((x) => x.shopId === shop.id).length;
    }

    this.store.set({
      coins: coins - price,
      inventory: {
        ...(s.inventory || {}),
        items: invItems,
      },
      market: {
        ...(s.market || {}),
        shops,
        listings,
      },
    });

    this._showToast("Satın alındı");
  }

  _buyBusiness(type) {
    const s = this.store.get();
    const prices = {
      nightclub: 1000,
      coffeeshop: 850,
      brothel: 1200,
    };

    const templates = {
      nightclub: [
        { icon: "🥃", name: "Black Whiskey", rarity: "common", qty: 20, price: 28, energyGain: 8, desc: "Gece kulübü ürünü." },
        { icon: "🍾", name: "Premium Champagne", rarity: "rare", qty: 8, price: 44, energyGain: 14, desc: "Lüks ürün." },
      ],
      coffeeshop: [
        { icon: "🍁", name: "White Widow", rarity: "rare", qty: 14, price: 36, energyGain: 12, desc: "Enerji için kullanılabilir." },
      ],
      brothel: [
        { icon: "🌹", name: "VIP Companion", rarity: "epic", qty: 5, price: 95, energyGain: 22, desc: "Yüksek enerji itemi." },
      ],
      blackmarket: [
        { icon: "📦", name: "Mystery Crate", rarity: "rare", qty: 10, price: 54, energyGain: 0, desc: "Koleksiyon ürünü." },
      ],
    };

    const cost = Number(prices[type] || 0);
    if (Number(s.coins || 0) < cost) {
      this._showToast("Yetersiz yton");
      return;
    }

    const defaultName = `${String(s.player?.username || "Player")} ${typeLabel(type)}`;
    const name = window.prompt("İşletme ismini gir:", defaultName);
    if (name === null) return;

    const finalName = String(name || "").trim() || defaultName;
    const businessId = "biz_" + type + "_" + Date.now();
    const products = (templates[type] || []).map((p, idx) => ({
      id: businessId + "_prod_" + idx,
      ...p,
    }));

    const stock = products.reduce((sum, p) => sum + Number(p.qty || 0), 0);

    const newBusiness = {
      id: businessId,
      type,
      icon: iconForType(type),
      name: finalName,
      ownerId: String(s.player?.id || "player_main"),
      ownerName: String(s.player?.username || "Player"),
      dailyProduction: 50,
      stock,
      theme: type,
      products,
    };

    const owned = [newBusiness, ...((s.businesses?.owned || []).map((x) => ({ ...x })))];

    this.store.set({
      coins: Number(s.coins || 0) - cost,
      businesses: {
        ...(s.businesses || {}),
        owned,
      },
    });

    this._changeTab("businesses");
    this._showToast("İşletme satın alındı");
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

  _sellBusinessProduct(bizId, productId) {
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
    const shop = this._ensureBusinessShop(biz);

    const state2 = this.store.get();
    const businesses2 = (state2.businesses?.owned || []).map((b) => ({
      ...b,
      products: (b.products || []).map((p) => ({ ...p })),
    }));
    const listings = (state2.market?.listings || []).map((x) => ({ ...x }));
    const shops = (state2.market?.shops || []).map((x) => ({ ...x }));

    const biz2 = businesses2.find((b) => b.id === bizId);
    if (!biz2) return;
    const product2 = (biz2.products || []).find((p) => p.id === productId);
    if (!product2) return;

    product2.qty = Math.max(0, Number(product2.qty || 0) - qty);
    biz2.stock = Math.max(0, Number(biz2.stock || 0) - qty);

    listings.unshift({
      id: "listing_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
      shopId: shop.id,
      icon: product2.icon || "📦",
      itemName: product2.name,
      rarity: product2.rarity || "common",
      stock: qty,
      price,
      energyGain: Number(product2.energyGain || 0),
      usable: Number(product2.energyGain || 0) > 0,
      desc: product2.desc || "İşletme ürünü",
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
  }

  update() {
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
  let fill = "rgba(255,255,255,0.06)";
  let stroke = "rgba(255,255,255,0.10)";
  let txt = "rgba(255,255,255,0.86)";

  if (style === "primary") {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, "rgba(27,67,145,0.96)");
    g.addColorStop(1, "rgba(10,33,92,0.96)");
    fill = g;
    stroke = "rgba(102,160,255,0.55)";
    txt = "#ffffff";
  } else if (style === "gold") {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, "rgba(120,82,22,0.95)");
    g.addColorStop(1, "rgba(82,55,12,0.95)");
    fill = g;
    stroke = "rgba(255,202,98,0.42)";
    txt = "#fff7e6";
  } else if (style === "muted") {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(255,255,255,0.05)");
    fill = g;
    stroke = "rgba(255,255,255,0.10)";
    txt = "rgba(255,255,255,0.82)";
  }

  ctx.fillStyle = fill;
  fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);

  ctx.fillStyle = txt;
  ctx.font = "800 12px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

_drawSearchBar(ctx, x, y, w, text) {
  const rect = { x, y, w, h: 48 };
  this.hitButtons.push({ rect, action: "search" });

  const g = ctx.createLinearGradient(x, y, x, y + rect.h);
  g.addColorStop(0, "rgba(255,255,255,0.07)");
  g.addColorStop(1, "rgba(255,255,255,0.045)");
  ctx.fillStyle = g;
  fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffb24a";
  fillRoundRect(ctx, rect.x + rect.w - 86, rect.y + 8, 58, 32, 16);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.54)";
  ctx.font = "900 15px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("🔎", x + 14, y + 24);

  ctx.fillStyle = text ? "#ffffff" : "rgba(255,255,255,0.42)";
  ctx.font = "13px system-ui";
  ctx.fillText(text || "Mekan veya ürün ara", x + 42, y + 24);
}

_drawHeroCard(ctx, x, y, w, h, title, desc, badge, icon, glow = "#ff9e46") {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, "rgba(4,9,18,0.98)");
  grad.addColorStop(0.45, "rgba(5,11,22,0.97)");
  grad.addColorStop(1, "rgba(5,8,16,0.98)");
  ctx.fillStyle = grad;
  fillRoundRect(ctx, x, y, w, h, 22);

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  strokeRoundRect(ctx, x, y, w, h, 22);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = glow;
  fillRoundRect(ctx, x + w - 112, y + 14, 82, 82, 24);
  ctx.restore();

  ctx.fillStyle = "rgba(255,196,77,0.16)";
  fillRoundRect(ctx, x + 14, y + 14, 110, 26, 13);
  ctx.strokeStyle = "rgba(255,196,77,0.34)";
  strokeRoundRect(ctx, x + 14, y + 14, 110, 26, 13);

  ctx.fillStyle = "#ffd98d";
  ctx.font = "800 11px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badge || "GÜNÜN VİTRİNİ", x + 69, y + 27);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 18px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, x + 16, y + 62);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "13px system-ui";
  ctx.fillText(desc, x + 16, y + 86);

  ctx.font = "900 38px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(icon || "📦", x + w - 71, y + h / 2);
}
  

  _drawMiniCard(ctx, x, y, w, h, title, text, icon, accent = "#458cff") {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, "rgba(12,18,28,0.96)");
    grad.addColorStop(1, "rgba(8,12,18,0.94)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, 20);
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    strokeRoundRect(ctx, x, y, w, h, 20);

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = accent;
    fillRoundRect(ctx, x + w - 58, y + 14, 42, 42, 14);
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
    ctx.font = "900 26px system-ui";
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
      const cardH = 96 + products.length * 64;
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

      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "12px system-ui";
      ctx.fillText(`${typeLabel(biz.type)} • Günlük üretim ${fmtNum(biz.dailyProduction)} • Stok ${fmtNum(biz.stock)}`, x + 48, y + 46);

      let rowY = y + 62;
      for (const p of products) {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        fillRoundRect(ctx, x + 12, rowY, w - 24, 54, 14);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        strokeRoundRect(ctx, x + 12, rowY, w - 24, 54, 14);

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

 const bg = ctx.createLinearGradient(0, 0, 0, h);
bg.addColorStop(0, "#07090d");
bg.addColorStop(0.3, "#0f0b0c");
bg.addColorStop(0.6, "#0b1018");
bg.addColorStop(1, "#03060a");

ctx.fillStyle = bg;
ctx.fillRect(0, 0, w, h);

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
    bg.addColorStop(0, "#09060a");
    bg.addColorStop(0.38, "#140b0d");
    bg.addColorStop(0.72, "#0b1018");
    bg.addColorStop(1, "#04070b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  const overlay = ctx.createLinearGradient(0, 0, 0, h);
  overlay.addColorStop(0, "rgba(0,0,0,0.20)");
  overlay.addColorStop(0.24, "rgba(32,12,4,0.20)");
  overlay.addColorStop(0.56, "rgba(8,12,20,0.46)");
  overlay.addColorStop(1, "rgba(2,5,10,0.84)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#ff8b2d";
  fillRoundRect(ctx, safe.x - 4, safe.y + 20, 210, 150, 54);
  ctx.fillStyle = "#ffba59";
  fillRoundRect(ctx, safe.x + safe.w - 168, safe.y + 70, 116, 116, 52);
  ctx.fillStyle = "#2f66ff";
  fillRoundRect(ctx, safe.x + safe.w - 126, safe.y + 148, 80, 80, 34);
  ctx.restore();

  const panelX = safe.x;
  const panelY = safe.y;
  const panelW = safe.w;
  const panelH = safe.h;

  const shellGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  shellGrad.addColorStop(0, "rgba(8,10,16,0.70)");
  shellGrad.addColorStop(0.35, "rgba(7,11,18,0.80)");
  shellGrad.addColorStop(0.72, "rgba(4,8,14,0.87)");
  shellGrad.addColorStop(1, "rgba(3,6,12,0.93)");
  ctx.fillStyle = shellGrad;
  fillRoundRect(ctx, panelX, panelY, panelW, panelH, 28);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 28);

  ctx.strokeStyle = "rgba(255,180,82,0.10)";
  strokeRoundRect(ctx, panelX + 7, panelY + 7, panelW - 14, panelH - 14, 24);
  ctx.restore();

  let tabRows = 0;
  let headerH = 110;

  if (trade.view === "main") {
    const tabsMeta = [
      { key: "explore", label: "Keşfet" },
      { key: "businesses", label: "İşletmelerim" },
      { key: "inventory", label: "Envanter" },
      { key: "loot", label: "Sandık & Çark" },
      { key: "market", label: "Açık Pazar" },
      { key: "buy", label: "Satın Al" },
    ];

    let row = 1;
    let tx = panelX + 16;
    const availableW = panelW - 32;

    for (const tab of tabsMeta) {
      const tw = clamp(28 + tab.label.length * 7.4, 88, 148);
      if (tx + tw > panelX + 16 + availableW) {
        row += 1;
        tx = panelX + 16;
      }
      tx += tw + 10;
    }

    tabRows = row;
    headerH = 110 + Math.max(0, tabRows - 1) * 48;
  }

  const headerGrad = ctx.createLinearGradient(panelX + 10, panelY + 10, panelX + panelW - 10, panelY + 10 + headerH);
  headerGrad.addColorStop(0, "rgba(20,14,12,0.58)");
  headerGrad.addColorStop(0.42, "rgba(17,16,20,0.54)");
  headerGrad.addColorStop(1, "rgba(11,15,22,0.40)");
  ctx.fillStyle = headerGrad;
  fillRoundRect(ctx, panelX + 10, panelY + 10, panelW - 20, headerH, 22);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  strokeRoundRect(ctx, panelX + 10, panelY + 10, panelW - 20, headerH, 22);

  this.hitBack = { x: panelX + 18, y: panelY + 22, w: 78, h: 38 };
  this._drawButton(ctx, this.hitBack, "← Geri", "muted");

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 24px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(trade.view === "shop" ? "Dükkan" : "Black Market", panelX + 108, panelY + 46);

  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "13px system-ui";
  ctx.fillText(
    trade.view === "shop"
      ? "Ürünler • fiyatlar • stok"
      : "Ekonomi merkezi • pazar • sandık • işletmeler",
    panelX + 108,
    panelY + 68
  );

  const stats = [
    `YTON ${fmtNum(state.coins)}`,
    `ENERJİ ${fmtNum(state.player?.energy)}/${fmtNum(state.player?.energyMax)}`,
    `LV ${fmtNum(state.player?.level)}`
  ];

  let chipX = panelX + panelW - 16;
  const chipY = panelY + 24;

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = "800 10px system-ui";

  for (let i = stats.length - 1; i >= 0; i--) {
    const text = stats[i];
    const tw = Math.ceil(ctx.measureText(text).width) + 22;
    chipX -= tw;

    const chipRect = { x: chipX, y: chipY, w: tw, h: 22 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, chipRect.x, chipRect.y, chipRect.w, chipRect.h, 11);
    ctx.strokeStyle = i === 0 ? "rgba(255,196,77,0.22)" : "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, chipRect.x, chipRect.y, chipRect.w, chipRect.h, 11);

    ctx.fillStyle = "#f4f6fb";
    ctx.fillText(text, chipRect.x + chipRect.w - 11, chipRect.y + chipRect.h / 2);

    chipX -= 8;
  }

  let contentTop = panelY + headerH + 22;

  if (trade.view === "main") {
    const tabs = [
      { key: "explore", label: "Keşfet" },
      { key: "businesses", label: "İşletmelerim" },
      { key: "inventory", label: "Envanter" },
      { key: "loot", label: "Sandık & Çark" },
      { key: "market", label: "Açık Pazar" },
      { key: "buy", label: "Satın Al" },
    ];

    let tx = panelX + 14;
    let ty = panelY + 86;
    const limitX = panelX + panelW - 14;

    for (const tab of tabs) {
      const tw = clamp(28 + tab.label.length * 7.4, 88, 148);
      if (tx + tw > limitX) {
        tx = panelX + 14;
        ty += 48;
      }

      const rect = { x: tx, y: ty, w: tw, h: 38 };
      this.hitTabs.push({ rect, tab: tab.key });

      const active = trade.activeTab === tab.key;
      if (active) {
        const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
        g.addColorStop(0, "rgba(21,54,117,0.95)");
        g.addColorStop(1, "rgba(11,29,77,0.95)");
        ctx.fillStyle = g;
        fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);

        ctx.strokeStyle = "rgba(94,151,255,0.55)";
        strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);

        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "#76a7ff";
        fillRoundRect(ctx, rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, 10);
        ctx.restore();

        ctx.fillStyle = "#ffffff";
        ctx.font = "800 12px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tab.label, rect.x + rect.w / 2, rect.y + rect.h / 2);
      } else {
        const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
        g.addColorStop(0, "rgba(255,255,255,0.08)");
        g.addColorStop(1, "rgba(255,255,255,0.05)");
        ctx.fillStyle = g;
        fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);

        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);

        ctx.fillStyle = "rgba(255,255,255,0.84)";
        ctx.font = "800 12px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tab.label, rect.x + rect.w / 2, rect.y + rect.h / 2);
      }

      tx += tw + 10;
    }

    contentTop = ty + 52;
  }

  const contentX = panelX + 12;
  const contentY = contentTop;
  const contentW = panelW - 24;
  const contentH = panelY + panelH - 12 - contentTop;

  const contentGrad = ctx.createLinearGradient(contentX, contentY, contentX, contentY + contentH);
  contentGrad.addColorStop(0, "rgba(5,9,17,0.50)");
  contentGrad.addColorStop(0.34, "rgba(5,9,18,0.64)");
  contentGrad.addColorStop(1, "rgba(2,6,12,0.80)");
  ctx.fillStyle = contentGrad;
  fillRoundRect(ctx, contentX, contentY, contentW, contentH, 22);

  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  strokeRoundRect(ctx, contentX, contentY, contentW, contentH, 22);

  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#ffb14c";
  fillRoundRect(ctx, contentX + contentW - 132, contentY + 14, 96, 96, 28);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, contentX, contentY, contentW, contentH, 22);
  ctx.clip();

  let cursorY = contentY + 16 - this.scrollY;
  let endY = cursorY;

  if (trade.view === "shop") {
    endY = this._renderShopView(ctx, contentX + 14, cursorY, contentW - 28);
  } else {
    const x = contentX + 14;
    const y = cursorY;
    const w2 = contentW - 28;

    if (trade.activeTab === "explore") endY = this._renderExplore(ctx, x, y, w2);
    else if (trade.activeTab === "businesses") endY = this._renderBusinesses(ctx, x, y, w2);
    else if (trade.activeTab === "inventory") endY = this._renderInventory(ctx, x, y, w2);
    else if (trade.activeTab === "loot") endY = this._renderLoot(ctx, x, y, w2);
    else if (trade.activeTab === "market") endY = this._renderMarket(ctx, x, y, w2);
    else endY = this._renderBuy(ctx, x, y, w2);
  }

  ctx.restore();

  this.maxScroll = Math.max(0, (endY - contentY + 16) - contentH);
  this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

  if (this.maxScroll > 0) {
    const barX = contentX + contentW - 8;
    const barY = contentY + 12;
    const barH = contentH - 24;
    const thumbH = Math.max(42, Math.floor((contentH / (contentH + this.maxScroll)) * barH));
    const thumbY = barY + Math.floor((this.scrollY / Math.max(1, this.maxScroll)) * (barH - thumbH));

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, barX, barY, 4, barH, 4);

    const sg = ctx.createLinearGradient(barX, thumbY, barX, thumbY + thumbH);
    sg.addColorStop(0, "rgba(255,195,78,0.90)");
    sg.addColorStop(1, "rgba(255,129,52,0.84)");
    ctx.fillStyle = sg;
    fillRoundRect(ctx, barX, thumbY, 4, thumbH, 4);
  }

  if (this.toastText && Date.now() < this.toastUntil) {
    const tw = Math.min(panelW - 32, 290);
    const th = 44;
    const tx = panelX + (panelW - tw) / 2;
    const ty = panelY + panelH - th - 10;

    ctx.fillStyle = "rgba(0,0,0,0.84)";
    fillRoundRect(ctx, tx, ty, tw, th, 14);

    ctx.strokeStyle = "rgba(255,196,77,0.20)";
    strokeRoundRect(ctx, tx, ty, tw, th, 14);

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 12px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2);
  }
 }
}



