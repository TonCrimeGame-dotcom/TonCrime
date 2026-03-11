function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function rarityColor(r) {
  switch (String(r || "").toLowerCase()) {
    case "common":
      return "#9aa4b2";
    case "rare":
      return "#4ea7ff";
    case "epic":
      return "#c16bff";
    case "legendary":
      return "#ffcc4d";
    default:
      return "#9aa4b2";
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

function isPointInRect(px, py, r) {
  return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export class TradeScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input || null;
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

    this.hit = [];
    this.backHit = null;

    this.toastText = "";
    this.toastUntil = 0;

    this.pointer = {
      x: 0,
      y: 0,
      down: false,
      justPressed: false,
      justReleased: false,
    };

    this._bound = false;
    this._canvas = null;

    this._onPointerDown = null;
    this._onPointerMove = null;
    this._onPointerUp = null;
  }

  onEnter() {
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
    this.hit = [];
    this.backHit = null;

    const s = this.store.get();
    const trade = s.trade || {};

    this.store.set({
      trade: {
        ...(trade || {}),
        activeTab: trade.activeTab || "explore",
        selectedBusinessId: trade.selectedBusinessId || null,
        selectedInventoryCategory: trade.selectedInventoryCategory || "all",
        selectedMarketFilter: trade.selectedMarketFilter || "all",
        selectedShopId: trade.selectedShopId || null,
        selectedShopItemId: trade.selectedShopItemId || null,
        selectedLootFilter: trade.selectedLootFilter || "all",
        searchQuery: trade.searchQuery || "",
        view: trade.view || "main",
        lastFreeSpinDay: trade.lastFreeSpinDay || "",
        toast: null,
      },
    });

    this._bindPointerEvents();
  }

  onExit() {
    this._unbindPointerEvents();
  }

  _bindPointerEvents() {
    if (this._bound) return;

    const canvas = document.getElementById("game");
    if (!canvas) return;

    this._canvas = canvas;

    const getCanvasPos = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
      const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const setDown = (x, y) => {
      const p = getCanvasPos(x, y);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      if (!this.pointer.down) this.pointer.justPressed = true;
      this.pointer.down = true;
    };

    const setMove = (x, y) => {
      const p = getCanvasPos(x, y);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
    };

    const setUp = (x, y) => {
      const p = getCanvasPos(x, y);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      if (this.pointer.down) this.pointer.justReleased = true;
      this.pointer.down = false;
    };

    this._onPointerDown = (e) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches && e.touches[0]) {
        setDown(e.touches[0].clientX, e.touches[0].clientY);
      } else {
        setDown(e.clientX, e.clientY);
      }
    };

    this._onPointerMove = (e) => {
      if (e.touches && e.touches[0]) {
        setMove(e.touches[0].clientX, e.touches[0].clientY);
      } else {
        setMove(e.clientX, e.clientY);
      }
    };

    this._onPointerUp = (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        setUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      } else {
        setUp(
          typeof e.clientX === "number" ? e.clientX : 0,
          typeof e.clientY === "number" ? e.clientY : 0
        );
      }
    };

    canvas.addEventListener("mousedown", this._onPointerDown, { passive: false });
    window.addEventListener("mousemove", this._onPointerMove, { passive: true });
    window.addEventListener("mouseup", this._onPointerUp, { passive: true });

    canvas.addEventListener("touchstart", this._onPointerDown, { passive: false });
    window.addEventListener("touchmove", this._onPointerMove, { passive: false });
    window.addEventListener("touchend", this._onPointerUp, { passive: true });
    window.addEventListener("touchcancel", this._onPointerUp, { passive: true });

    this._bound = true;
  }

  _unbindPointerEvents() {
    if (!this._bound || !this._canvas) return;

    const canvas = this._canvas;

    canvas.removeEventListener("mousedown", this._onPointerDown);
    window.removeEventListener("mousemove", this._onPointerMove);
    window.removeEventListener("mouseup", this._onPointerUp);

    canvas.removeEventListener("touchstart", this._onPointerDown);
    window.removeEventListener("touchmove", this._onPointerMove);
    window.removeEventListener("touchend", this._onPointerUp);
    window.removeEventListener("touchcancel", this._onPointerUp);

    this._bound = false;
    this._canvas = null;
  }

  _consumePointerFrameFlags() {
    this.pointer.justPressed = false;
    this.pointer.justReleased = false;
  }

  _safeRect() {
    const s = this.store.get();
    const safe = s.ui?.safe || {
      x: 0,
      y: 0,
      w: window.innerWidth,
      h: window.innerHeight,
    };
    const topReserved = Number(s.ui?.hudReservedTop || 110);
    const bottomReserved = Number(s.ui?.chatReservedBottom || 82);

    return {
      x: safe.x + 8,
      y: safe.y + topReserved,
      w: safe.w - 16,
      h: safe.h - topReserved - bottomReserved - 10,
    };
  }

  _rr(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  _fillRound(ctx, x, y, w, h, r, color) {
    this._rr(ctx, x, y, w, h, r);
    ctx.fillStyle = color;
    ctx.fill();
  }

  _strokeRound(ctx, x, y, w, h, r, color = "rgba(255,255,255,0.12)", lineWidth = 1) {
    this._rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  _showToast(text, ms = 1500) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _tradeState() {
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

  _goBackFromShop() {
    this.scrollY = 0;
    this.maxScroll = 0;
    this._setTrade({
      view: "main",
      selectedShopId: null,
    });
  }

  _isFreeSpinReady() {
    return String(this._tradeState().lastFreeSpinDay || "") !== todayKey();
  }

  _promptSearch() {
    const trade = this._tradeState();
    const v = window.prompt("Mekan veya ürün ara:", trade.searchQuery || "");
    if (v === null) return;
    this._setTrade({ searchQuery: String(v || "").trim() });
    this._showToast(v ? `Arama hazır: ${v}` : "Arama temizlendi");
  }

  _doFreeSpin() {
    if (!this._isFreeSpinReady()) {
      this._showToast("Günlük ücretsiz çark zaten kullanıldı");
      return;
    }

    const rewards = [
      { type: "coins", amount: 25, text: "+25 yton" },
      { type: "coins", amount: 50, text: "+50 yton" },
      { type: "coins", amount: 120, text: "+120 yton" },
      { type: "energy", amount: 12, text: "+12 enerji" },
      { type: "energy", amount: 20, text: "+20 enerji" },
      {
        type: "item",
        item: {
          id: "loot_crate_" + Date.now(),
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
          desc: "Sandık & Çark ödülü.",
        },
        text: "Mystery Crate kazandın",
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
      const existing = items.find((x) => x.name === reward.item.name && x.rarity === reward.item.rarity);
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

    this._showToast(reward.text, 1800);
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
      { type: "coins", amount: 260, text: "+260 yton" },
      { type: "energy", amount: 32, text: "+32 enerji" },
      {
        type: "item",
        item: {
          id: "loot_pass_" + Date.now(),
          kind: "rare",
          icon: "🎟️",
          name: "VIP Pass",
          rarity: "epic",
          qty: 1,
          usable: false,
          sellable: true,
          marketable: false,
          sellPrice: 120,
          marketPrice: 0,
          desc: "Premium çark ödülü.",
        },
        text: "VIP Pass kazandın",
      },
      {
        type: "item",
        item: {
          id: "loot_legend_" + Date.now(),
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
          desc: "Nadir premium ödül.",
        },
        text: "Golden Pass kazandın",
      },
    ];

    const reward = rewards[Math.floor(Math.random() * rewards.length)];
    const patch = { coins: Number(s.coins || 0) - cost };

    if (reward.type === "coins") {
      patch.coins = patch.coins + Number(reward.amount || 0);
      this.store.set(patch);
    } else if (reward.type === "energy") {
      const p = { ...(s.player || {}) };
      p.energy = clamp(
        Number(p.energy || 0) + Number(reward.amount || 0),
        0,
        Number(p.energyMax || 100)
      );
      this.store.set({
        ...patch,
        player: p,
      });
    } else {
      const items = (s.inventory?.items || []).map((x) => ({ ...x }));
      const existing = items.find((x) => x.name === reward.item.name && x.rarity === reward.item.rarity);
      if (existing) existing.qty = Number(existing.qty || 0) + 1;
      else items.unshift({ ...reward.item });
      this.store.set({
        ...patch,
        inventory: {
          ...(s.inventory || {}),
          items,
        },
      });
    }

    this._showToast(reward.text, 1800);
  }

  _buyCrate(crateType) {
    const s = this.store.get();
    const cost = crateType === "legendary" ? 140 : 65;
    if (Number(s.coins || 0) < cost) {
      this._showToast("Yetersiz yton");
      return;
    }

    const rarity = crateType === "legendary" ? "legendary" : "rare";
    const name = crateType === "legendary" ? "Legendary Crate" : "Mystery Crate";

    const items = (s.inventory?.items || []).map((x) => ({ ...x }));
    const existing = items.find((x) => x.name === name);
    if (existing) existing.qty = Number(existing.qty || 0) + 1;
    else {
      items.unshift({
        id: "crate_" + Date.now(),
        kind: "rare",
        icon: "📦",
        name,
        rarity,
        qty: 1,
        usable: false,
        sellable: true,
        marketable: true,
        sellPrice: Math.floor(cost * 0.68),
        marketPrice: cost + 18,
        desc: "Sandık & Çark sekmesi sandığı.",
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
    const maxEnergy = Math.max(1, Number(p.energyMax || 100));

    if (currentEnergy >= maxEnergy) {
      this._showToast("Enerji zaten full");
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
      type: "blackmarket",
      icon: "🕶️",
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
    const info = lowest > 0 ? `\nPazardaki en düşük fiyat: ${lowest} yton` : "\nPazarda henüz fiyat yok";
    const priceRaw = window.prompt(
      `Birim satış fiyatını gir.${info}`,
      String(item.marketPrice || item.sellPrice || 10)
    );
    if (priceRaw === null) return;

    const price = Math.max(1, parseInt(priceRaw, 10) || 0);
    if (price <= 0) {
      this._showToast("Geçersiz fiyat");
      return;
    }

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
    const buildingPrices = {
      nightclub: 1000,
      coffeeshop: 850,
      brothel: 1200,
      blackmarket: 1500,
    };

    const productTemplates = {
      nightclub: [
        { icon: "🥃", name: "Black Whiskey", rarity: "common", qty: 20, price: 28, energyGain: 8, desc: "Gece kulübü ürünü." },
        { icon: "🍾", name: "Premium Champagne", rarity: "rare", qty: 8, price: 44, energyGain: 14, desc: "Lüks ürün." },
      ],
      coffeeshop: [
        { icon: "🍁", name: "White Widow", rarity: "rare", qty: 14, price: 36, energyGain: 12, desc: "Enerji için kullanılabilir." },
        { icon: "🌿", name: "Moon Rocks", rarity: "epic", qty: 6, price: 62, energyGain: 18, desc: "Nadir ürün." },
      ],
      brothel: [
        { icon: "💋", name: "VIP Companion", rarity: "epic", qty: 5, price: 95, energyGain: 22, desc: "Yüksek enerji itemi." },
        { icon: "🌹", name: "Deluxe Service", rarity: "legendary", qty: 2, price: 160, energyGain: 30, desc: "En üst seviye ürün." },
      ],
      blackmarket: [
        { icon: "🎟️", name: "VIP Pass", rarity: "epic", qty: 4, price: 88, energyGain: 0, desc: "Özel koleksiyon ürünü." },
        { icon: "📦", name: "Mystery Crate", rarity: "rare", qty: 10, price: 54, energyGain: 0, desc: "Koleksiyon ürünü." },
      ],
    };

    const cost = Number(buildingPrices[type] || 0);
    if (Number(s.coins || 0) < cost) {
      this._showToast("Yetersiz yton");
      return;
    }

    const defaultName = `${String(s.player?.username || "Player")} ${typeLabel(type)}`;
    const name = window.prompt("İşletme ismini gir:", defaultName);
    if (name === null) return;

    const finalName = String(name || "").trim() || defaultName;
    const businessId = "biz_" + type + "_" + Date.now();

    const products = (productTemplates[type] || []).map((p, idx) => ({
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
      trade: {
        ...(s.trade || {}),
        activeTab: "businesses",
      },
    });

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
    const maxEnergy = Math.max(1, Number(p.energyMax || 100));
    const gain = Math.min(Number(product.energyGain || 0), Math.max(0, maxEnergy - currentEnergy));

    if (gain <= 0) {
      this._showToast("Enerji zaten full");
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

    this._showToast(`İşletmeden +${gain} enerji`);
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
    const priceText =
      lowest > 0
        ? `Bu ürün için pazardaki en düşük fiyat: ${lowest} yton\nBirim satış fiyatını gir:`
        : "Bu ürün için pazarda fiyat yok.\nBirim satış fiyatını gir:";

    const priceRaw = window.prompt(priceText, String(defaultPrice));
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

  _drawChipRowWrap(ctx, x, y, maxW, items, activeKey, actionName, chipW = 76, chipH = 32, gap = 8) {
    let cx = x;
    let cy = y;

    for (const item of items) {
      if (cx + chipW > x + maxW) {
        cx = x;
        cy += chipH + gap;
      }

      const active = activeKey === item.key;
      const r = { x: cx, y: cy, w: chipW, h: chipH, action: actionName, value: item.key };
      this.hit.push(r);

      this._fillRound(
        ctx,
        r.x,
        r.y,
        r.w,
        r.h,
        16,
        active ? "rgba(84,157,255,0.20)" : "rgba(255,255,255,0.06)"
      );
      this._strokeRound(
        ctx,
        r.x,
        r.y,
        r.w,
        r.h,
        16,
        active ? "rgba(84,157,255,0.42)" : "rgba(255,255,255,0.10)"
      );

      ctx.fillStyle = active ? "#fff" : "rgba(255,255,255,0.82)";
      ctx.font = "800 11px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.label, r.x + r.w / 2, r.y + r.h / 2);

      cx += chipW + gap;
    }

    return cy + chipH;
  }

  _drawActionBtn(ctx, r, text, style = "ghost") {
    let fill = "rgba(255,255,255,0.10)";
    let stroke = "rgba(255,255,255,0.14)";
    let txt = "#fff";

    if (style === "primary") {
      fill = "rgba(84,157,255,0.22)";
      stroke = "rgba(84,157,255,0.42)";
    } else if (style === "gold") {
      fill = "rgba(255,196,77,0.18)";
      stroke = "rgba(255,196,77,0.42)";
      txt = "#ffe59f";
    } else if (style === "danger") {
      fill = "rgba(255,90,90,0.18)";
      stroke = "rgba(255,90,90,0.38)";
      txt = "#ffd0d0";
    }

    this._fillRound(ctx, r.x, r.y, r.w, r.h, 14, fill);
    this._strokeRound(ctx, r.x, r.y, r.w, r.h, 14, stroke);

    ctx.fillStyle = txt;
    ctx.font = "800 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2);
  }

  _drawEmptyState(ctx, x, y, w, icon, text) {
    const boxH = 132;
    this._fillRound(ctx, x + 10, y, w - 20, boxH, 20, "rgba(255,255,255,0.05)");
    this._strokeRound(ctx, x + 10, y, w - 20, boxH, 20, "rgba(255,255,255,0.10)");

    ctx.fillStyle = "#fff";
    ctx.font = "900 30px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon || "📦", x + w / 2, y + 40);

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "700 14px system-ui";
    ctx.fillText(text || "Boş", x + w / 2, y + 88);

    return y + boxH + 12;
  }

  _drawGlassPanel(ctx, x, y, w, h, r = 18) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(255,255,255,0.04)");
    this._fillRound(ctx, x, y, w, h, r, g);
    this._strokeRound(ctx, x, y, w, h, r, "rgba(255,255,255,0.12)");
  }

  _drawHeroCard(ctx, x, y, w, h, title, subtitle, badgeText, icon, glow = "#4ea7ff") {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, "rgba(10,18,30,0.96)");
    grad.addColorStop(0.6, "rgba(8,15,24,0.94)");
    grad.addColorStop(1, "rgba(6,11,18,0.96)");
    this._fillRound(ctx, x, y, w, h, 22, grad);
    this._strokeRound(ctx, x, y, w, h, 22, "rgba(255,255,255,0.12)");

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = glow;
    this._fillRound(ctx, x + w - 112, y + 18, 78, 78, 24, glow);
    ctx.restore();

    this._fillRound(ctx, x + 14, y + 14, 96, 28, 14, "rgba(255,196,77,0.16)");
    this._strokeRound(ctx, x + 14, y + 14, 96, 28, 14, "rgba(255,196,77,0.34)");
    ctx.fillStyle = "#ffe59f";
    ctx.font = "800 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, x + 62, y + 28);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 19px system-ui";
    ctx.fillText(title, x + 16, y + 68);

    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "12px system-ui";
    ctx.fillText(subtitle, x + 16, y + 90);

    ctx.fillStyle = "#fff";
    ctx.font = "900 44px system-ui";
    ctx.fillText(icon, x + w - 76, y + 72);
  }

  _drawSearchBar(ctx, x, y, w, text, action = "prompt_search") {
    const r = { x, y, w, h: 46, action };
    this.hit.push(r);

    this._fillRound(ctx, x, y, w, 46, 18, "rgba(255,255,255,0.06)");
    this._strokeRound(ctx, x, y, w, 46, 18, "rgba(255,255,255,0.10)");

    ctx.fillStyle = "rgba(255,255,255,0.64)";
    ctx.font = "800 16px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🔎", x + 14, y + 23);

    ctx.fillStyle = text ? "#fff" : "rgba(255,255,255,0.48)";
    ctx.font = "13px system-ui";
    ctx.fillText(text || "Mekan ya da ürün ara", x + 42, y + 23);
  }

  _drawStatPill(ctx, x, y, w, h, label, value, accent = "#ffffff") {
    this._fillRound(ctx, x, y, w, h, 16, "rgba(255,255,255,0.05)");
    this._strokeRound(ctx, x, y, w, h, 16, "rgba(255,255,255,0.10)");
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.font = "11px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label, x + 12, y + 18);
    ctx.fillStyle = accent;
    ctx.font = "900 15px system-ui";
    ctx.fillText(value, x + 12, y + 38);
  }

  _drawTabScroller(ctx, panelX, y, panelW, trade) {
    const tabs = [
      { key: "explore", label: "Keşfet" },
      { key: "businesses", label: "İşletmelerim" },
      { key: "inventory", label: "Envanter" },
      { key: "loot", label: "Sandık & Çark" },
      { key: "market", label: "Açık Pazar" },
      { key: "buy", label: "Satın Al" },
    ];

    const gap = 8;
    let tx = panelX + 14;
    for (const tab of tabs) {
      const active = trade.activeTab === tab.key;
      const tabW = Math.max(92, 28 + tab.label.length * 7);
      const r = { x: tx, y, w: tabW, h: 46, action: "tab", value: tab.key };
      this.hit.push(r);

      this._fillRound(
        ctx,
        r.x,
        r.y,
        r.w,
        r.h,
        23,
        active ? "rgba(84,157,255,0.22)" : "rgba(255,255,255,0.06)"
      );
      this._strokeRound(
        ctx,
        r.x,
        r.y,
        r.w,
        r.h,
        23,
        active ? "rgba(84,157,255,0.45)" : "rgba(255,255,255,0.12)"
      );

      ctx.fillStyle = active ? "#ffffff" : "rgba(255,255,255,0.80)";
      ctx.font = "800 12px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tab.label, r.x + r.w / 2, r.y + r.h / 2);

      tx += tabW + gap;
    }

    return tx;
  }

  _drawTopBadges(ctx, panelX, panelY, panelW, state) {
    const rowY = panelY + 58;
    const gap = 6;
    const items = [
      { text: `YTON ${fmtNum(state.coins)}`, minW: 92, color: "#ffd36a" },
      {
        text: `Enerji ${fmtNum(state.player?.energy)}/${fmtNum(state.player?.energyMax)}`,
        minW: 118,
        color: "rgba(255,255,255,0.92)",
      },
      { text: `Lv ${fmtNum(state.player?.level)}`, minW: 56, color: "rgba(255,255,255,0.92)" },
    ];

    let totalMinW = gap * (items.length - 1);
    for (const b of items) totalMinW += b.minW;

    let badgeW = null;
    if (totalMinW <= panelW - 150) {
      badgeW = items.map((b) => b.minW);
    } else {
      const avail = panelW - 150 - gap * (items.length - 1);
      badgeW = [
        Math.max(76, Math.floor(avail * 0.29)),
        Math.max(106, Math.floor(avail * 0.49)),
        Math.max(50, Math.floor(avail * 0.18)),
      ];
    }

    let bx = panelX + panelW - 16;
    for (let i = items.length - 1; i >= 0; i--) {
      const b = items[i];
      const w = badgeW[i];
      bx -= w;

      this._fillRound(ctx, bx, rowY, w, 26, 10, "rgba(255,255,255,0.07)");
      this._strokeRound(ctx, bx, rowY, w, 26, 10, "rgba(255,255,255,0.12)");

      ctx.fillStyle = b.color;
      ctx.font = "800 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.text, bx + w / 2, rowY + 13);

      bx -= gap;
    }
  }

  update() {
    const px = Number(this.pointer.x || 0);
    const py = Number(this.pointer.y || 0);

    if (this.pointer.justPressed) {
      this.dragging = true;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && this.pointer.down) {
      const dy = py - this.downY;
      this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.pointer.justReleased) {
      this.dragging = false;

      if (!this.clickCandidate) {
        this._consumePointerFrameFlags();
        return;
      }

      if (isPointInRect(px, py, this.backHit)) {
        const t = this._tradeState();
        if (t.view === "shop") this._goBackFromShop();
        else this.scenes.go("home");
        this._consumePointerFrameFlags();
        return;
      }

      for (const h of this.hit) {
        if (!isPointInRect(px, py, h)) continue;

        switch (h.action) {
          case "tab":
            this._changeTab(h.value);
            this._consumePointerFrameFlags();
            return;
          case "inventory_filter":
            this._setTrade({ selectedInventoryCategory: h.value });
            this.scrollY = 0;
            this._consumePointerFrameFlags();
            return;
          case "market_filter":
            this._setTrade({ selectedMarketFilter: h.value });
            this.scrollY = 0;
            this._consumePointerFrameFlags();
            return;
          case "open_shop":
            this._goShop(h.shopId);
            this._consumePointerFrameFlags();
            return;
          case "use_item":
            this._useInventoryItem(h.itemId);
            this._consumePointerFrameFlags();
            return;
          case "sell_item":
            this._sellInventoryItem(h.itemId);
            this._consumePointerFrameFlags();
            return;
          case "list_item":
            this._listInventoryItem(h.itemId);
            this._consumePointerFrameFlags();
            return;
          case "buy_market_item":
            this._buyMarketItem(h.shopId, h.itemId);
            this._consumePointerFrameFlags();
            return;
          case "buy_business":
            this._buyBusiness(h.businessType);
            this._consumePointerFrameFlags();
            return;
          case "use_business_product":
            this._useBusinessProduct(h.bizId, h.productId);
            this._consumePointerFrameFlags();
            return;
          case "sell_business_product":
            this._sellBusinessProduct(h.bizId, h.productId);
            this._consumePointerFrameFlags();
            return;
          case "prompt_search":
            this._promptSearch();
            this._consumePointerFrameFlags();
            return;
          case "hero_jump_tab":
            this._changeTab(h.value);
            this._consumePointerFrameFlags();
            return;
          case "free_spin":
            this._doFreeSpin();
            this._consumePointerFrameFlags();
            return;
          case "premium_spin":
            this._doPremiumSpin();
            this._consumePointerFrameFlags();
            return;
          case "buy_crate":
            this._buyCrate(h.value);
            this._consumePointerFrameFlags();
            return;
          default:
            break;
        }
      }
    }

    this._consumePointerFrameFlags();
  }

  render(ctx) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.floor(ctx.canvas.width / dpr);
    const H = Math.floor(ctx.canvas.height / dpr);
    const safe = this._safeRect();
    const state = this.store.get();
    const trade = this._tradeState();

    ctx.clearRect(0, 0, W, H);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#050a12");
    bgGrad.addColorStop(0.4, "#08111a");
    bgGrad.addColorStop(1, "#04070b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#2d74ff";
    this._fillRound(ctx, 24, 86, 180, 180, 90, "#2d74ff");
    ctx.fillStyle = "#ffcc4d";
    this._fillRound(ctx, W - 180, 120, 140, 140, 70, "#ffcc4d");
    ctx.restore();

    const panelX = safe.x;
    const panelY = safe.y;
    const panelW = safe.w;
    const panelH = safe.h;

    this.hit = [];
    this.backHit = null;

    this._fillRound(ctx, panelX, panelY, panelW, panelH, 24, "rgba(6,11,18,0.88)");
    this._strokeRound(ctx, panelX, panelY, panelW, panelH, 24, "rgba(255,255,255,0.12)");

    const headerH = 94;
    this._fillRound(ctx, panelX + 10, panelY + 10, panelW - 20, headerH, 20, "rgba(255,255,255,0.05)");
    this._strokeRound(ctx, panelX + 10, panelY + 10, panelW - 20, headerH, 20, "rgba(255,255,255,0.10)");

    const backW = 78;
    const backH = 36;
    const backX = panelX + 20;
    const backY = panelY + 24;
    this.backHit = { x: backX, y: backY, w: backW, h: backH };

    this._fillRound(ctx, backX, backY, backW, backH, 14, "rgba(255,255,255,0.08)");
    this._strokeRound(ctx, backX, backY, backW, backH, 14, "rgba(255,255,255,0.12)");
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 13px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Geri", backX + backW / 2, backY + backH / 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 22px system-ui";
    ctx.fillText(trade.view === "shop" ? "Dükkan" : "Black Market Hub", panelX + 112, panelY + 46);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    ctx.fillText(
      trade.view === "shop"
        ? "Ürünler • fiyatlar • stok • hızlı satın al"
        : "Keşfet • İşletmelerim • Envanter • Sandık & Çark • Açık Pazar • Satın Al",
      panelX + 112,
      panelY + 67
    );

    this._drawTopBadges(ctx, panelX, panelY, panelW, state);

    const tabsY = panelY + headerH + 20;
    if (trade.view === "main") {
      this._drawTabScroller(ctx, panelX, tabsY, panelW, trade);
    }

    const contentX = panelX + 12;
    const contentY = trade.view === "main" ? tabsY + 58 : panelY + 116;
    const contentW = panelW - 24;
    const contentH = panelH - (contentY - panelY) - 12;

    this._fillRound(ctx, contentX, contentY, contentW, contentH, 20, "rgba(255,255,255,0.04)");
    this._strokeRound(ctx, contentX, contentY, contentW, contentH, 20, "rgba(255,255,255,0.10)");

    ctx.save();
    ctx.beginPath();
    ctx.rect(contentX, contentY, contentW, contentH);
    ctx.clip();

    let cursorY = contentY + 12 - this.scrollY;
    let contentBottom = cursorY;

    if (trade.view === "shop") {
      contentBottom = this._renderShopView(ctx, contentX, cursorY, contentW);
    } else if (trade.activeTab === "explore") {
      contentBottom = this._renderExploreTab(ctx, contentX, cursorY, contentW);
    } else if (trade.activeTab === "businesses") {
      contentBottom = this._renderBusinessesTab(ctx, contentX, cursorY, contentW);
    } else if (trade.activeTab === "inventory") {
      contentBottom = this._renderInventoryTab(ctx, contentX, cursorY, contentW);
    } else if (trade.activeTab === "loot") {
      contentBottom = this._renderLootTab(ctx, contentX, cursorY, contentW);
    } else if (trade.activeTab === "market") {
      contentBottom = this._renderMarketTab(ctx, contentX, cursorY, contentW);
    } else {
      contentBottom = this._renderBuyTab(ctx, contentX, cursorY, contentW);
    }

    ctx.restore();

    this.maxScroll = Math.max(0, (contentBottom - contentY + 12) - contentH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    if (this.maxScroll > 0) {
      const barX = contentX + contentW - 6;
      const barY = contentY + 8;
      const barH = contentH - 16;
      const thumbH = Math.max(36, Math.floor((contentH / (contentH + this.maxScroll)) * barH));
      const thumbY = barY + Math.floor((this.scrollY / Math.max(1, this.maxScroll)) * (barH - thumbH));

      this._fillRound(ctx, barX, barY, 4, barH, 4, "rgba(255,255,255,0.08)");
      this._fillRound(ctx, barX, thumbY, 4, thumbH, 4, "rgba(255,255,255,0.26)");
    }

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(panelW - 28, 280);
      const th = 42;
      const txx = panelX + (panelW - tw) / 2;
      const tyy = panelY + panelH - th - 10;
      this._fillRound(ctx, txx, tyy, tw, th, 16, "rgba(0,0,0,0.80)");
      this._strokeRound(ctx, txx, tyy, tw, th, 16, "rgba(255,255,255,0.12)");
      ctx.fillStyle = "#fff";
      ctx.font = "800 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.toastText, txx + tw / 2, tyy + th / 2);
    }
  }

  _renderExploreTab(ctx, x, y, w) {
    const trade = this._tradeState();
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
    const crateItem = this._inventoryItems().find((x) => /crate/i.test(String(x.name || "")));

    this._drawSearchBar(ctx, x + 12, y, w - 24, trade.searchQuery);
    y += 58;

    const heroRect = { x: x + 10, y, w: w - 20, h: 128, action: "hero_jump_tab", value: "market" };
    this.hit.push(heroRect);
    this._drawHeroCard(
      ctx,
      heroRect.x,
      heroRect.y,
      heroRect.w,
      heroRect.h,
      "Bugünün Vitrini",
      deal
        ? `${deal.itemName} • ${fmtNum(deal.price)} yton • pazara hızlı giriş`
        : "Açık pazarda vitrin ürünleri seni bekliyor",
      "GÜNLÜK FIRSAT",
      deal?.icon || "🕶️",
      "#4ea7ff"
    );
    y += 140;

    const gap = 10;
    const cardW = Math.floor((w - 30) / 2);
    const row1Y = y;

    const cheapRect = { x: x + 10, y: row1Y, w: cardW, h: 118, action: "hero_jump_tab", value: "market" };
    const popRect = { x: x + 20 + cardW, y: row1Y, w: cardW, h: 118, action: "hero_jump_tab", value: "market" };
    this.hit.push(cheapRect, popRect);

    this._drawMiniFeatureCard(
      ctx,
      cheapRect,
      "En Ucuz Mekanlar",
      cheapestShop ? `${cheapestShop.shop.name} • ${fmtNum(cheapestShop.lowest)} yton` : "Henüz vitrin verisi yok",
      cheapestShop?.shop?.icon || "🏪",
      "#7ac6ff"
    );

    this._drawMiniFeatureCard(
      ctx,
      popRect,
      "En Popüler Mekanlar",
      popularShop ? `${popularShop.name} • Puan ${popularShop.rating || 0}` : "Henüz popüler dükkan yok",
      popularShop?.icon || "🔥",
      "#ffcc4d"
    );

    y += 128;

    const row2Y = y;
    const dealRect = { x: x + 10, y: row2Y, w: cardW, h: 118, action: "hero_jump_tab", value: "loot" };
    const spinRect = { x: x + 20 + cardW, y: row2Y, w: cardW, h: 118, action: "free_spin" };
    this.hit.push(dealRect, spinRect);

    this._drawMiniFeatureCard(
      ctx,
      dealRect,
      "Sandık Fırsatları",
      crateItem ? `${crateItem.name} sende mevcut • adet ${fmtNum(crateItem.qty)}` : "Mystery Crate ve premium sandıklar hazır",
      crateItem?.icon || "📦",
      "#c16bff"
    );

    this._drawMiniFeatureCard(
      ctx,
      spinRect,
      "Günlük Ücretsiz Çark",
      this._isFreeSpinReady() ? "Hazır • şimdi çevir" : "Bugün kullanıldı • yarın tekrar açılır",
      this._isFreeSpinReady() ? "🎰" : "⏳",
      this._isFreeSpinReady() ? "#56f0a8" : "#9aa4b2"
    );

    y += 138;

    const quickX = x + 10;
    const quickW = w - 20;
    const quickH = 96;
    this._drawGlassPanel(ctx, quickX, y, quickW, quickH, 20);

    ctx.fillStyle = "#fff";
    ctx.font = "900 15px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Hızlı Geçiş", quickX + 14, y + 24);

    const buttons = [
      { text: "İşletmelerim", value: "businesses" },
      { text: "Envanter", value: "inventory" },
      { text: "Sandık & Çark", value: "loot" },
      { text: "Satın Al", value: "buy" },
    ];

    let bx = quickX + 14;
    let by = y + 40;
    for (const btn of buttons) {
      const r = { x: bx, y: by, w: 88, h: 34, action: "hero_jump_tab", value: btn.value };
      this.hit.push(r);
      this._drawActionBtn(ctx, r, btn.text, btn.value === "loot" ? "gold" : "primary");
      bx += 94;
      if (bx + 88 > quickX + quickW - 14) {
        bx = quickX + 14;
        by += 40;
      }
    }

    y += quickH + 14;
    return y;
  }

  _drawMiniFeatureCard(ctx, rect, title, subtitle, icon, accent) {
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    grad.addColorStop(0, "rgba(12,19,30,0.96)");
    grad.addColorStop(1, "rgba(8,14,24,0.92)");
    this._fillRound(ctx, rect.x, rect.y, rect.w, rect.h, 20, grad);
    this._strokeRound(ctx, rect.x, rect.y, rect.w, rect.h, 20, "rgba(255,255,255,0.10)");

    ctx.save();
    ctx.globalAlpha = 0.16;
    this._fillRound(ctx, rect.x + rect.w - 66, rect.y + 14, 46, 46, 16, accent);
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = "900 15px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(title, rect.x + 14, rect.y + 24);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    this._fitText(ctx, subtitle, rect.x + 14, rect.y + 48, rect.w - 28, 14);

    ctx.fillStyle = "#fff";
    ctx.font = "900 28px system-ui";
    ctx.fillText(icon, rect.x + rect.w - 48, rect.y + 40);
  }

  _fitText(ctx, text, x, y, maxW, lineH = 14, lines = 2) {
    const words = String(text || "").split(" ");
    let line = "";
    let row = 0;

    for (let i = 0; i < words.length; i++) {
      const test = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y + row * lineH);
        line = words[i];
        row += 1;
        if (row >= lines - 1) break;
      } else {
        line = test;
      }
    }

    if (line) ctx.fillText(line, x, y + row * lineH);
  }

  _renderBusinessesTab(ctx, x, y, w) {
    const businesses = this._allBusinesses();
    const state = this.store.get();

    if (!businesses.length) {
      return this._drawEmptyState(ctx, x, y, w, "🏪", "Henüz işletmen yok. Satın Al sekmesinden bina al.");
    }

    const totalStock = businesses.reduce((sum, b) => sum + Number(b.stock || 0), 0);
    const totalProducts = businesses.reduce((sum, b) => sum + Number((b.products || []).length || 0), 0);

    const headX = x + 10;
    const headW = w - 20;
    const headH = 118;
    this._drawHeroCard(
      ctx,
      headX,
      y,
      headW,
      headH,
      "İşletmelerim",
      `${fmtNum(businesses.length)} işletme • ${fmtNum(totalStock)} toplam stok • yönetim paneli`,
      "DASHBOARD",
      "🏢",
      "#56b6ff"
    );

    this._drawStatPill(ctx, headX + 14, y + 74, 86, 46, "Toplam", fmtNum(businesses.length), "#ffffff");
    this._drawStatPill(ctx, headX + 106, y + 74, 86, 46, "Stok", fmtNum(totalStock), "#ffd36a");
    this._drawStatPill(ctx, headX + 198, y + 74, 96, 46, "Ürün", fmtNum(totalProducts), "#7ac6ff");

    y += headH + 12;

    for (const biz of businesses) {
      const products = biz.products || [];
      const cardX = x + 10;
      const cardW = w - 20;
      const topH = 106;
      const rowH = 68;
      const cardH = topH + Math.max(1, products.length) * (rowH + 10) + 12;

      this._drawGlassPanel(ctx, cardX, y, cardW, cardH, 20);

      ctx.fillStyle = "#fff";
      ctx.font = "900 26px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(biz.icon || iconForType(biz.type), cardX + 14, y + 34);

      ctx.font = "900 16px system-ui";
      ctx.fillText(biz.name || "İşletme", cardX + 50, y + 24);

      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "12px system-ui";
      ctx.fillText(`${typeLabel(biz.type)} • Sahip ${biz.ownerName || state.player?.username || "Player"}`, cardX + 50, y + 45);
      ctx.fillText(`Günlük üretim ${fmtNum(biz.dailyProduction)} • Toplam stok ${fmtNum(biz.stock)}`, cardX + 50, y + 63);

      const fakeProfit = Math.floor(Number(biz.stock || 0) * 3.4);
      const bestProduct = products.slice().sort((a, b) => Number(b.qty || 0) - Number(a.qty || 0))[0];

      this._drawStatPill(ctx, cardX + 14, y + 76, 96, 46, "Kâr/Zarar", `+${fmtNum(fakeProfit)}`, "#56f0a8");
      this._drawStatPill(ctx, cardX + 116, y + 76, 96, 46, "Satış", fmtNum(products.reduce((s, p) => s + Number(p.qty || 0), 0)), "#ffd36a");
      this._drawStatPill(ctx, cardX + 218, y + 76, 112, 46, "En Çok", bestProduct ? bestProduct.name : "-", "#7ac6ff");

      let py = y + topH;
      for (const p of products) {
        const rowX = cardX + 12;
        const rowW = cardW - 24;
        this._fillRound(ctx, rowX, py, rowW, rowH, 16, "rgba(255,255,255,0.05)");
        this._strokeRound(ctx, rowX, py, rowW, rowH, 16, "rgba(255,255,255,0.10)");

        ctx.fillStyle = "#fff";
        ctx.font = "900 20px system-ui";
        ctx.fillText(p.icon || "📦", rowX + 10, py + 24);

        ctx.font = "900 14px system-ui";
        ctx.fillText(p.name || "Ürün", rowX + 38, py + 20);

        ctx.fillStyle = rarityColor(p.rarity);
        ctx.font = "800 10px system-ui";
        ctx.fillText(String(p.rarity || "common").toUpperCase(), rowX + 38, py + 35);

        ctx.fillStyle = "rgba(255,255,255,0.76)";
        ctx.font = "11px system-ui";
        ctx.fillText(`Stok ${fmtNum(p.qty)} • Taban ${fmtNum(p.price)} yton`, rowX + 38, py + 50);

        const useRect = {
          x: rowX + rowW - 174,
          y: py + 20,
          w: 74,
          h: 30,
          action: "use_business_product",
          bizId: biz.id,
          productId: p.id,
        };
        const sellRect = {
          x: rowX + rowW - 92,
          y: py + 20,
          w: 78,
          h: 30,
          action: "sell_business_product",
          bizId: biz.id,
          productId: p.id,
        };

        this.hit.push(useRect, sellRect);
        this._drawActionBtn(ctx, useRect, "Kullan", "primary");
        this._drawActionBtn(ctx, sellRect, "Satışa Koy", "gold");

        py += rowH + 10;
      }

      y += cardH + 12;
    }

    return y;
  }

  _renderInventoryTab(ctx, x, y, w) {
    const trade = this._tradeState();
    const filters = [
      { key: "all", label: "Tümü" },
      { key: "consumable", label: "Enerji" },
      { key: "girls", label: "Kadın" },
      { key: "goods", label: "Ürün" },
      { key: "rare", label: "Nadir" },
    ];

    this._drawSearchBar(ctx, x + 10, y, w - 20, trade.searchQuery);
    y += 56;

    const lastChipBottom = this._drawChipRowWrap(
      ctx,
      x + 10,
      y,
      w - 20,
      filters,
      trade.selectedInventoryCategory,
      "inventory_filter",
      76,
      32,
      8
    );

    y = lastChipBottom + 12;

    let items = this._inventoryItems();
    if (trade.selectedInventoryCategory !== "all") {
      items = items.filter((x) => x.kind === trade.selectedInventoryCategory);
    }

    if (trade.searchQuery) {
      const q = trade.searchQuery.toLowerCase();
      items = items.filter((x) => String(x.name || "").toLowerCase().includes(q));
    }

    if (!items.length) {
      return this._drawEmptyState(ctx, x, y + 10, w, "🎒", "Bu filtrede envanter yok.");
    }

    for (const item of items) {
      const cardX = x + 10;
      const cardW = w - 20;
      const cardH = 126;

      this._drawGlassPanel(ctx, cardX, y, cardW, cardH, 20);

      ctx.fillStyle = "#fff";
      ctx.font = "900 24px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(item.icon || "📦", cardX + 14, y + 34);

      ctx.font = "900 15px system-ui";
      ctx.fillText(item.name || "Item", cardX + 48, y + 24);

      this._fillRound(ctx, cardX + cardW - 82, y + 12, 66, 24, 10, "rgba(255,255,255,0.07)");
      this._strokeRound(ctx, cardX + cardW - 82, y + 12, 66, 24, 10, rarityColor(item.rarity), 1.2);
      ctx.fillStyle = rarityColor(item.rarity);
      ctx.font = "800 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), cardX + cardW - 49, y + 24);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "12px system-ui";
      ctx.fillText(item.desc || "", cardX + 48, y + 44);

      let sub = `Adet ${fmtNum(item.qty)}`;
      if (item.usable) sub += ` • +${fmtNum(item.energyGain)} enerji`;
      sub += ` • NPC ${fmtNum(item.sellPrice)} yton`;
      ctx.fillText(sub, cardX + 14, y + 66);

      const btnGap = 8;
      const btnY = y + 88;
      const innerW = cardW - 28;
      const btns = [];

      if (item.usable) btns.push({ text: "Kullan", action: "use_item", style: "primary", itemId: item.id });
      if (item.sellable) btns.push({ text: "Sat", action: "sell_item", style: "gold", itemId: item.id });
      if (item.marketable) btns.push({ text: "Pazara Koy", action: "list_item", style: "ghost", itemId: item.id });

      let widths;
      if (btns.length === 3) {
        widths = [80, 64, Math.max(92, innerW - 80 - 64 - btnGap * 2)];
      } else if (btns.length === 2) {
        const w1 = Math.floor((innerW - btnGap) / 2);
        widths = [w1, innerW - btnGap - w1];
      } else {
        widths = [innerW];
      }

      let btnX = cardX + 14;
      for (let i = 0; i < btns.length; i++) {
        const r = {
          x: btnX,
          y: btnY,
          w: widths[i],
          h: 30,
          action: btns[i].action,
          itemId: btns[i].itemId,
        };
        this.hit.push(r);
        this._drawActionBtn(ctx, r, btns[i].text, btns[i].style);
        btnX += widths[i] + btnGap;
      }

      y += cardH + 12;
    }

    return y;
  }

  _renderLootTab(ctx, x, y, w) {
    const inventory = this._inventoryItems();
    const crates = inventory.filter((x) => /crate/i.test(String(x.name || "")));
    const freeReady = this._isFreeSpinReady();

    const heroX = x + 10;
    const heroW = w - 20;
    this._drawHeroCard(
      ctx,
      heroX,
      y,
      heroW,
      126,
      "Sandık & Çark",
      freeReady ? "Günlük ücretsiz çark hazır • hemen çevir" : "Premium çark ve sandık ekonomisi aktif",
      "PREMIUM LOOT",
      "🎰",
      "#c16bff"
    );

    const freeRect = { x: heroX + 14, y: y + 74, w: 108, h: 34, action: "free_spin" };
    const premiumRect = { x: heroX + 130, y: y + 74, w: 116, h: 34, action: "premium_spin" };
    this.hit.push(freeRect, premiumRect);
    this._drawActionBtn(ctx, freeRect, freeReady ? "Ücretsiz Çevir" : "Yarın Açılır", freeReady ? "primary" : "ghost");
    this._drawActionBtn(ctx, premiumRect, "Premium Çark", "gold");

    y += 138;

    const cardW = Math.floor((w - 30) / 2);
    const mysteryRect = { x: x + 10, y, w: cardW, h: 124, action: "buy_crate", value: "mystery" };
    const legendaryRect = { x: x + 20 + cardW, y, w: cardW, h: 124, action: "buy_crate", value: "legendary" };
    this.hit.push(mysteryRect, legendaryRect);

    this._drawMiniFeatureCard(ctx, mysteryRect, "Mystery Crate", "Satın al • aç • sat • ekonomiye kat", "📦", "#7ac6ff");
    this._drawMiniFeatureCard(ctx, legendaryRect, "Legendary Crate", "Daha pahalı ama üst seviye ödül havuzu", "👑", "#ffcc4d");

    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "12px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("65 yton", mysteryRect.x + 14, mysteryRect.y + 96);
    ctx.fillText("140 yton", legendaryRect.x + 14, legendaryRect.y + 96);

    y += 136;

    const poolX = x + 10;
    const poolW = w - 20;
    const poolH = 108;
    this._drawGlassPanel(ctx, poolX, y, poolW, poolH, 20);

    ctx.fillStyle = "#fff";
    ctx.font = "900 15px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Olası Ödül Havuzu", poolX + 14, y + 24);

    const rewards = [
      { icon: "💰", name: "YTON" },
      { icon: "⚡", name: "Enerji" },
      { icon: "📦", name: "Mystery Crate" },
      { icon: "🎟️", name: "VIP Pass" },
      { icon: "👑", name: "Golden Pass" },
    ];

    let rx = poolX + 14;
    for (const r of rewards) {
      this._fillRound(ctx, rx, y + 40, 64, 50, 16, "rgba(255,255,255,0.05)");
      this._strokeRound(ctx, rx, y + 40, 64, 50, 16, "rgba(255,255,255,0.10)");
      ctx.fillStyle = "#fff";
      ctx.font = "900 18px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(r.icon, rx + 32, y + 56);
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "10px system-ui";
      ctx.fillText(r.name, rx + 32, y + 78);
      rx += 70;
      if (rx + 64 > poolX + poolW - 12) break;
    }

    y += poolH + 12;

    const lastX = x + 10;
    const lastW = w - 20;
    const lastH = 96;
    this._drawGlassPanel(ctx, lastX, y, lastW, lastH, 20);

    ctx.fillStyle = "#fff";
    ctx.font = "900 15px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Son Kazanılanlar", lastX + 14, y + 24);

    const lines = crates.length
      ? crates.slice(0, 3).map((c) => `${c.icon} ${c.name} • adet ${fmtNum(c.qty)}`)
      : ["🎰 Bugün ödül kazan, burada görün", "📦 Mystery Crate sisteme hazır", "👑 Premium ödüller aktif"];

    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "12px system-ui";
    ctx.fillText(lines[0], lastX + 14, y + 50);
    if (lines[1]) ctx.fillText(lines[1], lastX + 14, y + 68);
    if (lines[2]) ctx.fillText(lines[2], lastX + 14, y + 86);

    y += lastH + 14;
    return y;
  }

  _renderMarketTab(ctx, x, y, w) {
    const trade = this._tradeState();

    this._drawSearchBar(ctx, x + 10, y, w - 20, trade.searchQuery);
    y += 56;

    const filters = [
      { key: "all", label: "Tümü" },
      { key: "nightclub", label: "Club" },
      { key: "coffeeshop", label: "Coffee" },
      { key: "brothel", label: "Genel" },
      { key: "blackmarket", label: "Market" },
    ];

    const lastChipBottom = this._drawChipRowWrap(
      ctx,
      x + 10,
      y,
      w - 20,
      filters,
      trade.selectedMarketFilter,
      "market_filter",
      76,
      32,
      8
    );

    y = lastChipBottom + 12;

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
      return this._drawEmptyState(ctx, x, y + 10, w, "🏬", "Bu filtrede dükkan bulunamadı.");
    }

    for (const shop of shops) {
      const cardX = x + 10;
      const cardW = w - 20;
      const cardH = 128;
      const shopListings = this._getListingsByShopId(shop.id);
      const lowest = shopListings.length
        ? shopListings.reduce((m, l) => Math.min(m, Number(l.price || 0)), Number.MAX_SAFE_INTEGER)
        : 0;

      this._drawGlassPanel(ctx, cardX, y, cardW, cardH, 20);

      ctx.fillStyle = "#fff";
      ctx.font = "900 24px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(shop.icon || iconForType(shop.type), cardX + 14, y + 34);

      ctx.font = "900 15px system-ui";
      ctx.fillText(shop.name || "Dükkan", cardX + 48, y + 24);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "12px system-ui";
      ctx.fillText(`${typeLabel(shop.type)} • Sahip ${shop.ownerName || "?"}`, cardX + 48, y + 44);
      ctx.fillText(`Ürün ${fmtNum(shop.totalListings)} • Puan ${String(shop.rating || 0)} • En düşük ${lowest ? fmtNum(lowest) : "-"}`, cardX + 48, y + 62);

      const onlineText = shop.online ? "Online" : "Offline";
      const onlineColor = shop.online ? "rgba(76,217,100,0.22)" : "rgba(255,255,255,0.10)";
      const onlineBorder = shop.online ? "rgba(76,217,100,0.44)" : "rgba(255,255,255,0.12)";
      const onlineTextColor = shop.online ? "#b8ffca" : "rgba(255,255,255,0.80)";

      this._fillRound(ctx, cardX + 14, y + 86, 68, 28, 12, onlineColor);
      this._strokeRound(ctx, cardX + 14, y + 86, 68, 28, 12, onlineBorder);
      ctx.fillStyle = onlineTextColor;
      ctx.font = "800 11px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(onlineText, cardX + 48, y + 100);

      const enterRect = {
        x: cardX + cardW - 110,
        y: y + 84,
        w: 96,
        h: 32,
        action: "open_shop",
        shopId: shop.id,
      };
      this.hit.push(enterRect);
      this._drawActionBtn(ctx, enterRect, "Dükkana Gir", "primary");

      y += cardH + 12;
    }

    return y;
  }

  _renderShopView(ctx, x, y, w) {
    const trade = this._tradeState();
    const shop = this._getShopById(trade.selectedShopId);

    if (!shop) {
      return this._drawEmptyState(ctx, x, y + 40, w, "❌", "Dükkan bulunamadı.");
    }

    const headX = x + 10;
    const headW = w - 20;
    const headerH = 96;

    this._drawHeroCard(
      ctx,
      headX,
      y,
      headW,
      headerH,
      shop.name || "Dükkan",
      `Sahip ${shop.ownerName || "?"} • ${typeLabel(shop.type)} • Puan ${shop.rating || 0}`,
      shop.online ? "ONLINE" : "OFFLINE",
      shop.icon || iconForType(shop.type),
      "#4ea7ff"
    );

    y += headerH + 12;

    const listings = this._getListingsByShopId(shop.id);
    if (!listings.length) {
      return this._drawEmptyState(ctx, x, y + 20, w, "📭", "Bu dükkanda aktif ürün yok.");
    }

    for (const item of listings) {
      const cardX = x + 10;
      const cardW = w - 20;
      const cardH = 118;

      this._drawGlassPanel(ctx, cardX, y, cardW, cardH, 20);

      ctx.fillStyle = "#fff";
      ctx.font = "900 24px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(item.icon || "📦", cardX + 14, y + 34);

      ctx.font = "900 15px system-ui";
      ctx.fillText(item.itemName || "Ürün", cardX + 48, y + 24);

      this._fillRound(ctx, cardX + cardW - 82, y + 12, 66, 24, 10, "rgba(255,255,255,0.07)");
      this._strokeRound(ctx, cardX + cardW - 82, y + 12, 66, 24, 10, rarityColor(item.rarity), 1.2);
      ctx.fillStyle = rarityColor(item.rarity);
      ctx.font = "800 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), cardX + cardW - 49, y + 24);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(255,255,255,0.74)";
      ctx.font = "12px system-ui";
      ctx.fillText(item.desc || "", cardX + 48, y + 44);

      let line2 = `Stok ${fmtNum(item.stock)} • Fiyat ${fmtNum(item.price)} yton`;
      if (item.usable && Number(item.energyGain || 0) > 0) line2 += ` • +${fmtNum(item.energyGain)} enerji`;
      ctx.fillText(line2, cardX + 14, y + 66);

      const buyRect = {
        x: cardX + cardW - 100,
        y: y + 84,
        w: 84,
        h: 30,
        action: "buy_market_item",
        itemId: item.id,
        shopId: shop.id,
      };
      this.hit.push(buyRect);
      this._drawActionBtn(ctx, buyRect, "Satın Al", "gold");

      y += cardH + 12;
    }

    return y;
  }

  _renderBuyTab(ctx, x, y, w) {
    const buildings = [
      {
        type: "nightclub",
        icon: "🌃",
        name: "Nightclub",
        price: 1000,
        desc: "Alkol ve gece ürünü üretir.",
        risk: "Orta",
        level: "Lv 25+",
      },
      {
        type: "coffeeshop",
        icon: "🌿",
        name: "Coffeeshop",
        price: 850,
        desc: "Ot ve enerji ürünü üretir.",
        risk: "Düşük",
        level: "Lv 20+",
      },
      {
        type: "brothel",
        icon: "💋",
        name: "Genel Ev",
        price: 1200,
        desc: "Yüksek enerji ürünleri üretir.",
        risk: "Yüksek",
        level: "Lv 35+",
      },
      {
        type: "blackmarket",
        icon: "🕶️",
        name: "Black Market",
        price: 1500,
        desc: "Nadir ürün ve kasa satar.",
        risk: "Yüksek",
        level: "Lv 50+",
      },
    ];

    this._drawHeroCard(
      ctx,
      x + 10,
      y,
      w - 20,
      122,
      "İşletme Satın Al",
      "Bina kartları • günlük üretim • risk seviyesi • isim vererek satın al",
      "OWNER MODE",
      "🏗️",
      "#ffcc4d"
    );
    y += 134;

    for (const b of buildings) {
      const cardX = x + 10;
      const cardW = w - 20;
      const cardH = 124;

      this._drawGlassPanel(ctx, cardX, y, cardW, cardH, 20);

      ctx.fillStyle = "#fff";
      ctx.font = "900 24px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(b.icon, cardX + 14, y + 34);

      ctx.font = "900 16px system-ui";
      ctx.fillText(b.name, cardX + 48, y + 24);

      ctx.fillStyle = "rgba(255,255,255,0.74)";
      ctx.font = "12px system-ui";
      ctx.fillText(b.desc, cardX + 48, y + 45);
      ctx.fillText(`Fiyat ${fmtNum(b.price)} yton • Günlük üretim 50`, cardX + 48, y + 64);
      ctx.fillText(`Risk ${b.risk} • Önerilen ${b.level} • satın alırken isim sorulur`, cardX + 48, y + 82);

      const buyRect = {
        x: cardX + cardW - 104,
        y: y + 82,
        w: 90,
        h: 30,
        action: "buy_business",
        businessType: b.type,
      };
      this.hit.push(buyRect);
      this._drawActionBtn(ctx, buyRect, "Satın Al", "primary");

      y += cardH + 12;
    }

    return y;
  }
}
