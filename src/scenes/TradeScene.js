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

    this._prevPointerDown = false;
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
        activeTab: trade.activeTab || "businesses",
        selectedBusinessId: trade.selectedBusinessId || null,
        selectedInventoryCategory: trade.selectedInventoryCategory || "all",
        selectedMarketFilter: trade.selectedMarketFilter || "all",
        selectedShopId: trade.selectedShopId || null,
        selectedShopItemId: trade.selectedShopItemId || null,
        view: trade.view || "main",
        toast: null,
      },
    });
  }

  onExit() {}

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

  _getBusinessById(bizId) {
    return this._allBusinesses().find((x) => x.id === bizId) || null;
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

  _inputSnapshot() {
    const input = this.input || {};
    const p =
      input.pointer ||
      input.p ||
      input.state?.pointer ||
      (typeof input.getPointer === "function" ? input.getPointer() : null) ||
      { x: 0, y: 0 };

    let down = false;

    if (typeof input.isDown === "function") down = !!input.isDown();
    else if (typeof input.down === "function") down = !!input.down();
    else if (typeof input.pointerDown === "boolean") down = input.pointerDown;
    else if (typeof input.down === "boolean") down = input.down;
    else if (typeof input.state?.down === "boolean") down = input.state.down;
    else if (typeof p?.down === "boolean") down = p.down;

    const justPressed = !this._prevPointerDown && down;
    const justReleased = this._prevPointerDown && !down;

    this._prevPointerDown = down;

    return {
      x: Number(p?.x || 0),
      y: Number(p?.y || 0),
      down,
      justPressed,
      justReleased,
    };
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
    const priceRaw = window.prompt(`Birim satış fiyatını gir.${info}`, String(item.marketPrice || item.sellPrice || 10));
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

  _findLowestMarketPriceByName(itemName) {
    const listings = this._marketListings().filter(
      (x) => String(x.itemName || "").toLowerCase() === String(itemName || "").toLowerCase()
    );
    if (!listings.length) return 0;
    return listings.reduce((min, x) => Math.min(min, Number(x.price || 0)), Number.MAX_SAFE_INTEGER);
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

    const newBusiness = {
      id: businessId,
      type,
      icon: iconForType(type),
      name: finalName,
      ownerId: String(s.player?.id || "player_main"),
      ownerName: String(s.player?.username || "Player"),
      dailyProduction: 50,
      stock: 0,
      theme: type,
      products: (productTemplates[type] || []).map((p, idx) => ({
        id: businessId + "_prod_" + idx,
        ...p,
      })),
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

  _drawChipRowWrap(ctx, x, y, maxW, items, activeKey, actionName, chipW = 66, chipH = 30, gap = 6) {
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
        10,
        active ? "rgba(84,157,255,0.20)" : "rgba(255,255,255,0.06)"
      );
      this._strokeRound(
        ctx,
        r.x,
        r.y,
        r.w,
        r.h,
        10,
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
      fill = "rgba(255,196,77,0.20)";
      stroke = "rgba(255,196,77,0.42)";
      txt = "#ffe59f";
    } else if (style === "danger") {
      fill = "rgba(255,90,90,0.18)";
      stroke = "rgba(255,90,90,0.38)";
      txt = "#ffd0d0";
    }

    this._fillRound(ctx, r.x, r.y, r.w, r.h, 11, fill);
    this._strokeRound(ctx, r.x, r.y, r.w, r.h, 11, stroke);

    ctx.fillStyle = txt;
    ctx.font = "800 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2);
  }

  _drawEmptyState(ctx, x, y, w, icon, text) {
    const boxH = 120;
    this._fillRound(ctx, x + 10, y, w - 20, boxH, 18, "rgba(255,255,255,0.05)");
    this._strokeRound(ctx, x + 10, y, w - 20, boxH, 18, "rgba(255,255,255,0.10)");

    ctx.fillStyle = "#fff";
    ctx.font = "900 30px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon || "📦", x + w / 2, y + 38);

    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "700 14px system-ui";
    ctx.fillText(text || "Boş", x + w / 2, y + 82);

    return y + boxH + 12;
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
    const inp = this._inputSnapshot();
    const px = inp.x;
    const py = inp.y;

    if (inp.justPressed) {
      this.dragging = true;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && inp.down) {
      const dy = py - this.downY;
      this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && inp.justReleased) {
      this.dragging = false;

      if (!this.clickCandidate) return;

      if (isPointInRect(px, py, this.backHit)) {
        const t = this._tradeState();
        if (t.view === "shop") {
          this._goBackFromShop();
        } else {
          this.scenes.go("home");
        }
        return;
      }

      for (const h of this.hit) {
        if (!isPointInRect(px, py, h)) continue;

        switch (h.action) {
          case "tab":
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
          default:
            return;
        }
      }
    }
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
    bgGrad.addColorStop(0, "#081018");
    bgGrad.addColorStop(0.45, "#0b1118");
    bgGrad.addColorStop(1, "#06080c");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fillRect(0, 0, W, H);

    const panelX = safe.x;
    const panelY = safe.y;
    const panelW = safe.w;
    const panelH = safe.h;

    this.hit = [];
    this.backHit = null;

    this._fillRound(ctx, panelX, panelY, panelW, panelH, 22, "rgba(8,12,18,0.86)");
    this._strokeRound(ctx, panelX, panelY, panelW, panelH, 22, "rgba(255,255,255,0.12)");

    const headerH = 92;
    this._fillRound(ctx, panelX + 10, panelY + 10, panelW - 20, headerH, 18, "rgba(255,255,255,0.05)");
    this._strokeRound(ctx, panelX + 10, panelY + 10, panelW - 20, headerH, 18, "rgba(255,255,255,0.10)");

    const backW = 78;
    const backH = 34;
    const backX = panelX + 20;
    const backY = panelY + 24;
    this.backHit = { x: backX, y: backY, w: backW, h: backH };

    this._fillRound(ctx, backX, backY, backW, backH, 12, "rgba(255,255,255,0.08)");
    this._strokeRound(ctx, backX, backY, backW, backH, 12, "rgba(255,255,255,0.12)");
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 13px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Geri", backX + backW / 2, backY + backH / 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 22px system-ui";
    ctx.fillText(trade.view === "shop" ? "Dükkan" : "Trade Center", panelX + 112, panelY + 46);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    ctx.fillText("İşletmeler • Envanter • Açık Pazar • Bina Satın Al", panelX + 112, panelY + 67);

    this._drawTopBadges(ctx, panelX, panelY, panelW, state);

    const tabsY = panelY + headerH + 20;
    const tabs = [
      { key: "businesses", label: "İşletmeler" },
      { key: "inventory", label: "Envanter" },
      { key: "market", label: "Pazar" },
      { key: "buy", label: "Satın Al" },
    ];

    let tx = panelX + 14;
    const tabGap = 6;
    const totalTabW = panelW - 28;
    const tabW = Math.floor((totalTabW - tabGap * 3) / 4);
    const tabH = 40;

    if (trade.view === "main") {
      for (const tab of tabs) {
        const active = trade.activeTab === tab.key;
        const r = { x: tx, y: tabsY, w: tabW, h: tabH, action: "tab", value: tab.key };
        this.hit.push(r);

        this._fillRound(
          ctx,
          r.x,
          r.y,
          r.w,
          r.h,
          14,
          active ? "rgba(84,157,255,0.22)" : "rgba(255,255,255,0.06)"
        );
        this._strokeRound(
          ctx,
          r.x,
          r.y,
          r.w,
          r.h,
          14,
          active ? "rgba(84,157,255,0.45)" : "rgba(255,255,255,0.12)"
        );

        ctx.fillStyle = active ? "#ffffff" : "rgba(255,255,255,0.78)";
        ctx.font = "800 12px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tab.label, r.x + r.w / 2, r.y + r.h / 2);

        tx += tabW + tabGap;
      }
    }

    const contentX = panelX + 12;
    const contentY = trade.view === "main" ? tabsY + tabH + 12 : panelY + 116;
    const contentW = panelW - 24;
    const contentH = panelH - (contentY - panelY) - 12;

    this._fillRound(ctx, contentX, contentY, contentW, contentH, 18, "rgba(255,255,255,0.04)");
    this._strokeRound(ctx, contentX, contentY, contentW, contentH, 18, "rgba(255,255,255,0.10)");

    ctx.save();
    ctx.beginPath();
    ctx.rect(contentX, contentY, contentW, contentH);
    ctx.clip();

    let cursorY = contentY + 12 - this.scrollY;
    let contentBottom = cursorY;

    if (trade.view === "shop") {
      contentBottom = this._renderShopView(ctx, contentX, cursorY, contentW);
    } else if (trade.activeTab === "businesses") {
      contentBottom = this._renderBusinessesTab(ctx, contentX, cursorY, contentW);
    } else if (trade.activeTab === "inventory") {
      contentBottom = this._renderInventoryTab(ctx, contentX, cursorY, contentW);
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
      const tw = Math.min(panelW - 28, 260);
      const th = 40;
      const txx = panelX + (panelW - tw) / 2;
      const tyy = panelY + panelH - th - 10;
      this._fillRound(ctx, txx, tyy, tw, th, 14, "rgba(0,0,0,0.78)");
      this._strokeRound(ctx, txx, tyy, tw, th, 14, "rgba(255,255,255,0.12)");
      ctx.fillStyle = "#fff";
      ctx.font = "800 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.toastText, txx + tw / 2, tyy + th / 2);
    }
  }

  _renderBusinessesTab(ctx, x, y, w) {
    const businesses = this._allBusinesses();

    if (!businesses.length) {
      return this._drawEmptyState(ctx, x, y, w, "🏪", "Henüz işletmen yok. Satın Al sekmesinden bina al.");
    }

    for (const biz of businesses) {
      const cardX = x + 10;
      const cardW = w - 20;
      const products = biz.products || [];
      const cardH = 86 + Math.max(1, products.length) * 72 + 12;

      this._fillRound(ctx, cardX, y, cardW, cardH, 18, "rgba(255,255,255,0.06)");
      this._strokeRound(ctx, cardX, y, cardW, cardH, 18, "rgba(255,255,255,0.10)");

      ctx.fillStyle = "#fff";
      ctx.font = "900 24px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(biz.icon || iconForType(biz.type), cardX + 14, y + 34);

      ctx.font = "900 16px system-ui";
      ctx.fillText(biz.name || "İşletme", cardX + 50, y + 24);

      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "12px system-ui";
      ctx.fillText(`${typeLabel(biz.type)} • Günlük üretim ${fmtNum(biz.dailyProduction)}`, cardX + 50, y + 45);
      ctx.fillText(`Toplam stok ${fmtNum(biz.stock)} • Sahip ${biz.ownerName || "Player"}`, cardX + 50, y + 63);

      let py = y + 82;

      for (const p of products) {
        const rowX = cardX + 12;
        const rowW = cardW - 24;
        const rowH = 62;

        this._fillRound(ctx, rowX, py, rowW, rowH, 14, "rgba(255,255,255,0.05)");
        this._strokeRound(ctx, rowX, py, rowW, rowH, 14, "rgba(255,255,255,0.10)");

        ctx.fillStyle = "#fff";
        ctx.font = "900 20px system-ui";
        ctx.fillText(p.icon || "📦", rowX + 10, py + 22);

        ctx.font = "900 14px system-ui";
        ctx.fillText(p.name || "Ürün", rowX + 38, py + 20);

        ctx.fillStyle = rarityColor(p.rarity);
        ctx.font = "800 10px system-ui";
        ctx.fillText(String(p.rarity || "common").toUpperCase(), rowX + 38, py + 35);

        ctx.fillStyle = "rgba(255,255,255,0.76)";
        ctx.font = "11px system-ui";
        ctx.fillText(`Stok ${fmtNum(p.qty)} • Taban fiyat ${fmtNum(p.price)} yton`, rowX + 38, py + 51);

        const useRect = {
          x: rowX + rowW - 174,
          y: py + 17,
          w: 74,
          h: 28,
          action: "use_business_product",
          bizId: biz.id,
          productId: p.id,
        };
        const sellRect = {
          x: rowX + rowW - 92,
          y: py + 17,
          w: 78,
          h: 28,
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

    const lastChipBottom = this._drawChipRowWrap(
      ctx,
      x + 10,
      y,
      w - 20,
      filters,
      trade.selectedInventoryCategory,
      "inventory_filter",
      66,
      30,
      6
    );

    y = lastChipBottom + 12;

    let items = this._inventoryItems();
    if (trade.selectedInventoryCategory !== "all") {
      items = items.filter((x) => x.kind === trade.selectedInventoryCategory);
    }

    if (!items.length) {
      return this._drawEmptyState(ctx, x, y + 10, w, "🎒", "Bu kategoride envanter yok.");
    }

    for (const item of items) {
      const cardX = x + 10;
      const cardW = w - 20;
      const cardH = 122;

      this._fillRound(ctx, cardX, y, cardW, cardH, 18, "rgba(255,255,255,0.06)");
      this._strokeRound(ctx, cardX, y, cardW, cardH, 18, "rgba(255,255,255,0.10)");

      ctx.fillStyle = "#fff";
      ctx.font = "900 24px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(item.icon || "📦", cardX + 14, y + 34);

      ctx.font = "900 15px system-ui";
      ctx.fillText(item.name || "Item", cardX + 48, y + 24);

      this._fillRound(ctx, cardX + cardW - 78, y + 12, 62, 24, 9, "rgba(255,255,255,0.07)");
      this._strokeRound(ctx, cardX + cardW - 78, y + 12, 62, 24, 9, rarityColor(item.rarity), 1.2);
      ctx.fillStyle = rarityColor(item.rarity);
      ctx.font = "800 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), cardX + cardW - 47, y + 24);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "12px system-ui";
      ctx.fillText(item.desc || "", cardX + 48, y + 44);

      let sub = `Adet ${fmtNum(item.qty)}`;
      if (item.usable) sub += ` • +${fmtNum(item.energyGain)} enerji`;
      sub += ` • NPC satış ${fmtNum(item.sellPrice)} yton`;
      ctx.fillText(sub, cardX + 14, y + 64);

      const btnGap = 8;
      const btnY = y + 82;
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
          h: 28,
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

  _renderMarketTab(ctx, x, y, w) {
    const trade = this._tradeState();

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
      66,
      30,
      6
    );

    y = lastChipBottom + 12;

    let shops = this._marketShops();
    if (trade.selectedMarketFilter !== "all") {
      shops = shops.filter((x) => x.type === trade.selectedMarketFilter);
    }

    if (!shops.length) {
      return this._drawEmptyState(ctx, x, y + 10, w, "🏬", "Bu filtrede dükkan bulunamadı.");
    }

    for (const shop of shops) {
      const cardX = x + 10;
      const cardW = w - 20;
      const cardH = 122;

      this._fillRound(ctx, cardX, y, cardW, cardH, 18, "rgba(255,255,255,0.06)");
      this._strokeRound(ctx, cardX, y, cardW, cardH, 18, "rgba(255,255,255,0.10)");

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
      ctx.fillText(`Ürün ${fmtNum(shop.totalListings)} • Puan ${String(shop.rating || 0)}`, cardX + 48, y + 62);

      const onlineText = shop.online ? "Açık" : "Kapalı";
      const onlineColor = shop.online ? "rgba(76,217,100,0.22)" : "rgba(255,255,255,0.10)";
      const onlineBorder = shop.online ? "rgba(76,217,100,0.44)" : "rgba(255,255,255,0.12)";
      const onlineTextColor = shop.online ? "#b8ffca" : "rgba(255,255,255,0.80)";

      this._fillRound(ctx, cardX + 14, y + 82, 62, 26, 10, onlineColor);
      this._strokeRound(ctx, cardX + 14, y + 82, 62, 26, 10, onlineBorder);
      ctx.fillStyle = onlineTextColor;
      ctx.font = "800 11px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(onlineText, cardX + 45, y + 95);

      const enterRect = {
        x: cardX + cardW - 110,
        y: y + 80,
        w: 96,
        h: 30,
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
    const headerH = 90;

    this._fillRound(ctx, headX, y, headW, headerH, 18, "rgba(255,255,255,0.06)");
    this._strokeRound(ctx, headX, y, headW, headerH, 18, "rgba(255,255,255,0.10)");

    ctx.fillStyle = "#fff";
    ctx.font = "900 26px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(shop.icon || iconForType(shop.type), headX + 14, y + 36);

    ctx.font = "900 17px system-ui";
    ctx.fillText(shop.name || "Dükkan", headX + 52, y + 26);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    ctx.fillText(`Sahip ${shop.ownerName || "?"} • ${typeLabel(shop.type)} • Puan ${shop.rating || 0}`, headX + 52, y + 46);
    ctx.fillText("Market ürünleri aşağıda listelenmiştir.", headX + 52, y + 65);

    y += headerH + 12;

    const listings = this._getListingsByShopId(shop.id);
    if (!listings.length) {
      return this._drawEmptyState(ctx, x, y + 20, w, "📭", "Bu dükkanda aktif ürün yok.");
    }

    for (const item of listings) {
      const cardX = x + 10;
      const cardW = w - 20;
      const cardH = 114;

      this._fillRound(ctx, cardX, y, cardW, cardH, 18, "rgba(255,255,255,0.06)");
      this._strokeRound(ctx, cardX, y, cardW, cardH, 18, "rgba(255,255,255,0.10)");

      ctx.fillStyle = "#fff";
      ctx.font = "900 24px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(item.icon || "📦", cardX + 14, y + 34);

      ctx.font = "900 15px system-ui";
      ctx.fillText(item.itemName || "Ürün", cardX + 48, y + 24);

      this._fillRound(ctx, cardX + cardW - 78, y + 12, 62, 24, 9, "rgba(255,255,255,0.07)");
      this._strokeRound(ctx, cardX + cardW - 78, y + 12, 62, 24, 9, rarityColor(item.rarity), 1.2);
      ctx.fillStyle = rarityColor(item.rarity);
      ctx.font = "800 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), cardX + cardW - 47, y + 24);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(255,255,255,0.74)";
      ctx.font = "12px system-ui";
      ctx.fillText(item.desc || "", cardX + 48, y + 44);

      let line2 = `Stok ${fmtNum(item.stock)} • Fiyat ${fmtNum(item.price)} yton`;
      if (item.usable && Number(item.energyGain || 0) > 0) {
        line2 += ` • +${fmtNum(item.energyGain)} enerji`;
      }
      ctx.fillText(line2, cardX + 14, y + 64);

      const buyRect = {
        x: cardX + cardW - 96,
        y: y + 80,
        w: 82,
        h: 28,
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
      },
      {
        type: "coffeeshop",
        icon: "🌿",
        name: "Coffeeshop",
        price: 850,
        desc: "Ot ve enerji ürünü üretir.",
      },
      {
        type: "brothel",
        icon: "💋",
        name: "Genel Ev",
        price: 1200,
        desc: "Yüksek enerji ürünleri üretir.",
      },
      {
        type: "blackmarket",
        icon: "🕶️",
        name: "Black Market",
        price: 1500,
        desc: "Nadir ürün ve kasa satar.",
      },
    ];

    for (const b of buildings) {
      const cardX = x + 10;
      const cardW = w - 20;
      const cardH = 118;

      this._fillRound(ctx, cardX, y, cardW, cardH, 18, "rgba(255,255,255,0.06)");
      this._strokeRound(ctx, cardX, y, cardW, cardH, 18, "rgba(255,255,255,0.10)");

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
      ctx.fillText(`Satın alma fiyatı: ${fmtNum(b.price)} yton`, cardX + 48, y + 64);
      ctx.fillText("Satın alırken işletme ismi sorulur.", cardX + 48, y + 82);

      const buyRect = {
        x: cardX + cardW - 102,
        y: y + 78,
        w: 88,
        h: 28,
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
