import { supabase } from "../supabase.js";

import { fetchBackendJson } from "../supabase.js?v=20260402-2";
import { describeRichAdFailure, playRichRewardedAd } from "../ads/richAds.js?v=20260403-1";

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

function fmtTokenAmount(n) {
  const value = Number(n || 0);
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 6,
  });
}

function roundTokenAmount(value, fractionDigits = 6) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** fractionDigits;
  return Math.round((numeric + Number.EPSILON) * factor) / factor;
}

function rarityColor(r) {
  switch (String(r || "").toLowerCase()) {
    case "common":
      return "#b9a98a";
    case "rare":
      return "#d2b06a";
    case "epic":
      return "#e4bf74";
    case "legendary":
      return "#ffcc66";
    default:
      return "#b9a98a";
  }
}

function typeLabel(type) {
  switch (type) {
    case "nightclub":
      return "Nightclub";
    case "coffeeshop":
      return "CoffeeShop";
    case "brothel":
      return "Brothel";
    default:
      return "Business";
  }
}

function iconForType(type) {
  switch (type) {
    case "nightclub":
      return "NB";
    case "coffeeshop":
      return "CF";
    case "brothel":
      return "BR";
    default:
      return "MK";
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
const PREMIUM_COST_TON = 100;
const FREE_SPIN_LIMIT = 3;
const PREMIUM_WHEEL_COST = 1000;
const PRODUCTION_CLAIM_MS = 60 * 60 * 1000;

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

function textFit(ctx, text, x, y, maxWidth) {
  const value = String(text || "");
  if (!maxWidth || ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }
  let out = value;
  while (out.length > 1 && ctx.measureText(`${out}...`).width > maxWidth) out = out.slice(0, -1);
  ctx.fillText(`${out}...`, x, y);
}

function drawCoverImage(ctx, img, x, y, w, h) {
  if (!img || !img.complete || !(img.naturalWidth || img.width) || !(img.naturalHeight || img.height)) return false;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) * 0.5;
  const dy = y + (h - dh) * 0.5;
  ctx.drawImage(img, dx, dy, dw, dh);
  return true;
}

function drawContainImage(ctx, img, x, y, w, h) {
  if (!img || !img.complete || !(img.naturalWidth || img.width) || !(img.naturalHeight || img.height)) return false;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) * 0.5;
  const dy = y + (h - dh) * 0.5;
  ctx.drawImage(img, dx, dy, dw, dh);
  return true;
}

function shortRewardLabel(reward) {
  const raw = String(reward?.label || reward?.text || reward?.name || "ODUL").replace(/\s+/g, " ").trim();
  if (!raw) return "ODUL";
  if (raw.length <= 14) return raw;
  const parts = raw.split(" ");
  return parts.slice(0, 2).join(" ").slice(0, 14);
}

class TradeScene {
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
    this.runtimeImages = new Map();
    this.wheelAnim = null;
    this.rewardOverlay = null;
    this.lastTs = Date.now();
    this.adBusy = false;
  }

  onEnter() {
    const s = this.store.get();
    const trade = s.trade || {};

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.clickCandidate = false;
    this.wheelAnim = null;
    this.rewardOverlay = null;
    this.lastTs = Date.now();
    this.adBusy = false;

    this._ensureTradeState();
    this._refreshBusinessProduction();

    this.store.set({
      trade: {
        ...trade,
        activeTab: trade.activeTab || "buy",
        selectedBusinessId: trade.selectedBusinessId || null,
        selectedInventoryCategory: trade.selectedInventoryCategory || "all",
        selectedMarketFilter: trade.selectedMarketFilter || "all",
        selectedShopId: trade.selectedShopId || null,
        selectedShopItemId: trade.selectedShopItemId || null,
        view: trade.view || "main",
        searchQuery: trade.searchQuery || "",
        freeSpinDay: trade.freeSpinDay || "",
        freeSpinUsed: Number(trade.freeSpinUsed || 0),
        premiumPreviewType: trade.premiumPreviewType || "nightclub",
        lootWheel: trade.lootWheel || {
          mode: "free",
          selectedIndex: 0,
          rotation: 0,
          reward: null,
          updatedAt: 0,
        },
        crateReveal: trade.crateReveal || null,
      },
    });
  }

  _lang() {
    return this.i18n?.getLang?.() === "en" ? "en" : "tr";
  }

  _ui(tr, en) {
    return this._lang() === "en" ? en : tr;
  }

  _num(n) {
    return Number(n || 0).toLocaleString(this._lang() === "en" ? "en-US" : "tr-TR");
  }

  _player() {
    return this.store.get()?.player || {};
  }

  _wallet() {
    return this.store.get()?.wallet || {};
  }

  _isPremium() {
    const s = this.store.get();
    const p = s?.player || {};
    return !!(s?.premium || s?.isPremium || p?.premium || p?.isPremium || p?.membership === "premium");
  }

  _canOwnBusiness() {
    return this._isPremium() || Number(this._player().level || 1) >= 50;
  }

  _ensureTradeState() {
    const s = this.store.get();
    const trade = s.trade || {};
    const wallet = s.wallet || {};
    const market = s.market || {};
    const player = s.player || {};
    const unlocked = this._isPremium() || Number(player.level || 1) >= 50;

    this.store.set({
      player: {
        ...player,
        membership: this._isPremium() ? "premium" : player.membership || "standard",
        canOwnBusiness: unlocked,
        canWithdraw: unlocked,
      },
      trade: {
        ...trade,
        activeTab: trade.activeTab || "buy",
        freeSpinDay: trade.freeSpinDay || "",
        freeSpinUsed: Number(trade.freeSpinUsed || 0),
        premiumPreviewType: trade.premiumPreviewType || "nightclub",
      },
      wallet: {
        connectedAddress: "",
        walletAddressInput: "",
        tonBalance: 0,
        depositAddress: "",
        convertYtonInput: "",
        convertTonInput: "",
        conversionMode: "",
        withdrawTonInput: "",
        ...wallet,
      },
      market: {
        ...market,
        shops: Array.isArray(market.shops) ? market.shops : [],
        listings: Array.isArray(market.listings) ? market.listings : [],
        salesHistory: Array.isArray(market.salesHistory) ? market.salesHistory : [],
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


  _runtimeImage(src) {
    const key = String(src || "").trim();
    if (!key) return null;
    if (!this.runtimeImages.has(key)) {
      const img = new Image();
      img.decoding = "async";
      img.src = key;
      this.runtimeImages.set(key, img);
    }
    const img = this.runtimeImages.get(key);
    if (!img || img._failed) return null;
    return img;
  }

  _pushSystemChat(text) {
    const s = this.store.get();
    const chat = Array.isArray(s.chatLog) ? s.chatLog.slice(-79) : [];
    chat.push({
      id: "trade_" + Date.now(),
      type: "system",
      username: "SYSTEM",
      text: String(text || ""),
      createdAt: Date.now(),
    });
    this.store.set({ chatLog: chat });
  }

  _businessDefs() {
    return {
      nightclub: {
        price: 1000,
        nameTr: "Nightclub",
        nameEn: "Nightclub",
        theme: "neon",
        icon: "NB",
        imageKey: "nightclub",
        imageSrc: "./src/assets/nightclub.jpg",
        products: [
          { key: "street_whiskey", icon: "SW", imageSrc: "./src/assets/street.png", name: "Street Whiskey", rarity: "common", qty: 0, price: 27, energyGain: 8, desc: "Nightclub urunu." },
          { key: "club_prosecco", icon: "CP", imageSrc: "./src/assets/club.png", name: "Club Prosecco", rarity: "rare", qty: 0, price: 33, energyGain: 11, desc: "Kulup ici icecek." },
          { key: "blue_venom", icon: "BV", imageSrc: "./src/assets/mafia.png", name: "Blue Venom", rarity: "epic", qty: 0, price: 40, energyGain: 13, desc: "VIP kokteyl." },
        ],
      },
      coffeeshop: {
        price: 850,
        nameTr: "Coffeeshop",
        nameEn: "Coffeeshop",
        theme: "green",
        icon: "CF",
        imageKey: "coffeeshop",
        imageSrc: "./src/assets/coffeeshop.jpg",
        products: [
          { key: "white_widow", icon: "WW", imageSrc: "./src/assets/white.png", name: "White Widow", rarity: "rare", qty: 0, price: 36, energyGain: 12, desc: "Coffeeshop urunu." },
          { key: "og_kush", icon: "OG", imageSrc: "./src/assets/og.png", name: "OG Kush", rarity: "epic", qty: 0, price: 48, energyGain: 16, desc: "Klasik kush." },
          { key: "moon_rocks", icon: "MR", imageSrc: "./src/assets/diamond.png", name: "Moon Rocks", rarity: "legendary", qty: 0, price: 62, energyGain: 18, desc: "Nadir urun." },
        ],
      },
      brothel: {
        price: 1200,
        nameTr: "Genelev",
        nameEn: "Brothel",
        theme: "red",
        icon: "BR",
        imageKey: "xxx",
        imageSrc: "./src/assets/xxx.jpg",
        products: [
          { key: "scarlett_blaze", icon: "SB", imageSrc: "./src/assets/g_star1.png", name: "Scarlett Blaze", rarity: "epic", qty: 0, price: 95, energyGain: 22, desc: "Vip servis." },
          { key: "ruby_vane", icon: "RV", imageSrc: "./src/assets/g_star2.png", name: "Ruby Vane", rarity: "legendary", qty: 0, price: 120, energyGain: 26, desc: "Deluxe servis." },
          { key: "luna_hart", icon: "LH", imageSrc: "./src/assets/g_star3.png", name: "Luna Hart", rarity: "legendary", qty: 0, price: 145, energyGain: 30, desc: "Elite servis." },
        ],
      },
    };
  }

  _businessDefByType(type) {
    return this._businessDefs()[String(type || "").toLowerCase()] || null;
  }

  _createBusinessRecord(type, name, source = "shop") {
    const def = this._businessDefByType(type);
    if (!def) return null;

    const businessId = `biz_${type}_${Date.now()}`;
    const player = this._player();
    const products = (def.products || []).map((product, idx) => ({
      ...product,
      id: `${businessId}_p${idx + 1}`,
    }));

    return {
      id: businessId,
      type,
      icon: def.icon,
      imageKey: def.imageKey,
      imageSrc: def.imageSrc,
      name,
      ownerId: String(player.id || "player_main"),
      ownerName: String(player.username || "Player"),
      dailyProduction: 50,
      stock: 0,
      theme: def.theme,
      products,
      acquiredFrom: source,
      productionDayKey: "",
      productionReadyAt: 0,
      productionClaimUntil: 0,
      productionCollectedAt: 0,
      productionMissedAt: 0,
      pendingProduction: [],
    };
  }

  _consumeTon(amountTon) {
    const amount = Math.max(0, Number(amountTon || 0));
    const s = this.store.get();
    const wallet = { ...(s.wallet || {}) };
    const tonBalance = Number(wallet.tonBalance || 0);
    if (tonBalance < amount) return false;
    wallet.tonBalance = roundTokenAmount(Math.max(0, tonBalance - amount));
    this.store.set({ wallet });
    return true;
  }

  _marketSalesHistory() {
    return this.store.get()?.market?.salesHistory || [];
  }

  _marketShopStats(shopId) {
    const rows = this._marketSalesHistory().filter((row) => String(row.shopId) === String(shopId));
    return rows.reduce(
      (acc, row) => {
        const qty = Number(row.qty || 0);
        const price = Number(row.price || 0);
        acc.sales += 1;
        acc.units += qty;
        acc.revenue += qty * price;
        acc.lastSaleAt = Math.max(acc.lastSaleAt, Number(row.soldAt || 0));
        return acc;
      },
      { sales: 0, units: 0, revenue: 0, lastSaleAt: 0 }
    );
  }

  _marketLeaders() {
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
      .filter((row) => row.lowest > 0)
      .sort((a, b) => a.lowest - b.lowest)[0] || null;

    const bestSellingShop = shops
      .map((shop) => ({ shop, stats: this._marketShopStats(shop.id) }))
      .sort(
        (a, b) =>
          Number(b.stats.units || 0) - Number(a.stats.units || 0) ||
          Number(b.stats.revenue || 0) - Number(a.stats.revenue || 0)
      )[0] || null;

    return { cheapestShop, bestSellingShop };
  }

  _rewardText(reward) {
    if (!reward) return this._ui("Odul alindi", "Reward claimed");
    if (String(reward?.type || "").toLowerCase() === "empty") {
      return this._ui("Bu dilim bos gecti", "This slice was empty");
    }
    if (this._lang() === "en") return reward.textEn || reward.text || reward.label || "Reward claimed";
    return reward.textTr || reward.text || reward.label || "Odul alindi";
  }

  _typeLabel(type) {
    switch (String(type || "").toLowerCase()) {
      case "nightclub":
        return this._ui("Nightclub", "Nightclub");
      case "coffeeshop":
        return this._ui("Coffeeshop", "CoffeeShop");
      case "brothel":
        return this._ui("Genelev", "Brothel");
      case "blackmarket":
        return this._ui("Kara Pazar", "Black Market");
      default:
        return this._ui("Isletme", "Business");
    }
  }

  _itemDesc(item) {
    if (!item) return "";
    const raw = String(item.desc || "");
    if (this._lang() !== "en") return raw;

    const name = String(item.itemName || item.name || "").toLowerCase();
    if (/(imported whiskey|street whiskey|night whiskey|black whiskey|whiskey)/.test(name)) return "Quick energy item.";
    if (/(club prosecco|club champagne|premium champagne|champagne)/.test(name)) return "Nightclub drink.";
    if (/(blue venom|venom)/.test(name)) return "VIP cocktail.";
    if (/(white widow|og kush)/.test(name)) return "Coffeehouse product.";
    if (/(moon rocks)/.test(name)) return "Rare market product.";
    if (/(scarlett blaze)/.test(name)) return "VIP service.";
    if (/(ruby vane)/.test(name)) return "Deluxe service.";
    if (/(luna hart)/.test(name)) return "Elite service.";
    if (/(event item|bonus)/.test(name)) return "Rare event item.";
    if (/(mystery crate|legendary crate|crate)/.test(name)) return "Open it for a random reward.";
    return raw;
  }

  _inventoryKindFor(item = {}, fallbackType = "") {
    const explicit = String(item.kind || "").toLowerCase().trim();
    if (["consumable", "girls", "goods", "rare"].includes(explicit)) return explicit;

    const type = String(
      item.type ||
      item.businessType ||
      item.business_type ||
      item.sourceBusinessType ||
      fallbackType ||
      ""
    ).toLowerCase().trim();

    if (type === "brothel") return "girls";
    if (type === "nightclub") return "consumable";
    if (type === "coffeeshop") return "goods";

    const raw = `${item.name || ""} ${item.itemName || ""} ${item.key || ""} ${item.productKey || ""} ${item.product_key || ""} ${item.desc || ""}`.toLowerCase();

    if (/(scarlett blaze|ruby vane|luna hart|vip service|deluxe service|elite service|escort|girl|companion)/.test(raw)) {
      return "girls";
    }
    if (/(event item|bonus)/.test(raw)) {
      return "rare";
    }
    if (/(white widow|og kush|moon rocks|kush|widow|rocks|weed|goods?)/.test(raw)) {
      return "goods";
    }
    if (/(street whiskey|black whiskey|club prosecco|premium champagne|champagne|venom|drink|cocktail|energy)/.test(raw)) {
      return "consumable";
    }

    return "goods";
  }

  _inventoryViewItems() {
    const s = this.store.get();
    const rawInventory = (s.inventory?.items || []).map((item) => ({
      ...item,
      kind: this._inventoryKindFor(item),
      _sourceType: "inventory",
    }));

    const businessProducts = (s.businesses?.owned || []).flatMap((biz) =>
      (biz.products || [])
        .filter((product) => Number(product.qty || 0) > 0)
        .map((product) => ({
          ...product,
          id: `bizinv_${biz.id}_${product.id}`,
          kind: this._inventoryKindFor(product, biz.type),
          usable: Number(product.energyGain || 0) > 0,
          sellable: false,
          marketable: true,
          _sourceType: "business_product",
          _bizId: biz.id,
          _productId: product.id,
          _businessType: biz.type,
          _businessName: biz.name,
        }))
    );

    return [...businessProducts, ...rawInventory];
  }

  _businessArt(type) {
    switch (String(type || "").toLowerCase()) {
      case "nightclub":
        return { imageKey: "nightclub", imageSrc: "./src/assets/nightclub.jpg" };
      case "coffeeshop":
        return { imageKey: "coffeeshop", imageSrc: "./src/assets/coffeeshop.jpg" };
      case "brothel":
        return { imageKey: "xxx", imageSrc: "./src/assets/xxx.jpg" };
      case "blackmarket":
        return { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" };
      default:
        return null;
    }
  }

  _itemArt(input = {}, fallbackType = "") {
    if (!input) return this._businessArt(fallbackType);

    const imageKey = input.imageKey || input.artKey || "";
    const imageSrc = input.imageSrc || input.image || input.artSrc || input.src || "";
    const genericImage = /\/(drink|weed|xxx|girl)\.(png|jpg)$/i.test(String(imageSrc || ""));
    if ((imageKey || imageSrc) && !genericImage) return { imageKey, imageSrc };

    const typeArt = this._businessArt(input.type || input.businessType || input.business_type || fallbackType);
    const looksLikeVenue =
      !!typeArt &&
      !input.itemName &&
      !input.productKey &&
      !input.product_key &&
      !input.itemKey &&
      !input.kind &&
      (
        input.ownerName ||
        input.businessId ||
        input.dailyProduction != null ||
        input.totalListings != null ||
        input.totalSold != null ||
        input.totalRevenue != null ||
        input.rating != null ||
        input.online != null ||
        input.pendingProduction
      );
    if (looksLikeVenue) return typeArt;
    if (typeArt && !input.itemName && !input.name && !input.label && !input.productKey && !input.product_key) return typeArt;

    const raw = `${input.productKey || ""} ${input.product_key || ""} ${input.itemKey || ""} ${input.itemName || ""} ${input.name || ""} ${input.label || ""} ${input.kind || ""}`.toLowerCase();
    if (/(street whiskey|night whiskey|black whiskey|whiskey_item)/.test(raw)) {
      return { imageSrc: "./src/assets/street.png" };
    }
    if (/(club prosecco|club champagne|premium champagne|premium_champ|champagne|drink)/.test(raw)) {
      return { imageSrc: "./src/assets/club.png" };
    }
    if (/(blue venom|venom)/.test(raw)) {
      return { imageSrc: "./src/assets/mafia.png" };
    }
    if (/(white widow|widow)/.test(raw)) {
      return { imageSrc: "./src/assets/white.png" };
    }
    if (/(og kush|kush)/.test(raw)) {
      return { imageSrc: "./src/assets/og.png" };
    }
    if (/(moon rocks|moon_rocks|weed)/.test(raw)) {
      return { imageSrc: "./src/assets/diamond.png" };
    }
    if (/(scarlett blaze|scarlett)/.test(raw)) {
      return { imageSrc: "./src/assets/g_star1.png" };
    }
    if (/(ruby vane|ruby)/.test(raw)) {
      return { imageSrc: "./src/assets/g_star2.png" };
    }
    if (/(luna hart|luna)/.test(raw)) {
      return { imageSrc: "./src/assets/g_star3.png" };
    }
    if (/(vip companion|vip girl|companion)/.test(raw)) {
      return { imageSrc: "./src/assets/g_star1.png" };
    }
    if (/(deluxe service|deluxe)/.test(raw)) {
      return { imageSrc: "./src/assets/g_star2.png" };
    }
    if (/(elite service|elite escort|elite)/.test(raw)) {
      return { imageSrc: "./src/assets/g_star3.png" };
    }
    if (/(vip companion|deluxe service|vip girl|companion|service|escort|girl)/.test(raw)) {
      return { imageSrc: "./src/assets/girl.png" };
    }
    if (/(event item|bonus)/.test(raw)) {
      return { imageSrc: "./src/assets/bonus.png" };
    }
    if (/(crate|sandik|loot|premium_crate|mystery_crate)/.test(raw)) {
      return { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" };
    }
    return imageKey || imageSrc ? { imageKey, imageSrc } : typeArt;
  }

  _resolveArtImage(art, fallbackType = "") {
    const spec = this._itemArt(art, fallbackType);
    if (!spec) return null;
    const assetImg = spec.imageKey ? getImgSafe(this.assets, spec.imageKey) : null;
    if (assetImg) return assetImg;
    return spec.imageSrc ? this._runtimeImage(spec.imageSrc) : null;
  }

  _rewardArt(reward) {
    if (!reward) return null;
    const type = String(reward.type || "").toLowerCase();
    if (type === "item" && reward.item) {
      return {
        ...reward.item,
        imageKey: reward.item.imageKey || reward.imageKey || "",
        imageSrc: reward.item.imageSrc || reward.imageSrc || "",
        label: reward.item.name || reward.label || reward.item.label || "",
      };
    }
    if (type === "weapon") {
      return {
        kind: "weapon",
        imageKey: reward.imageKey || "",
        imageSrc: reward.imageSrc || "",
        name: reward.weaponName || reward.label || "Weapon",
        label: reward.weaponName || reward.label || "Weapon",
      };
    }
    if (type === "coins") {
      return {
        kind: "currency",
        imageSrc: "./src/assets/yton.png",
        label: "YTON",
      };
    }
    if (type === "empty" || type === "combo") return null;
    if (reward.imageKey || reward.imageSrc) return reward;
    return null;
  }

  _drawRewardThumb(ctx, x, y, size, reward, highlight = false) {
    const art = this._rewardArt(reward);
    const img = art ? this._resolveArtImage(art, art?.kind || reward?.type || "") : null;
    const accent = String(reward?.accent || "#f1b965");
    const radius = Math.min(16, Math.max(10, Math.floor(size * 0.24)));
    const innerPad = Math.max(4, Math.floor(size * 0.10));

    ctx.save();
    const shell = ctx.createLinearGradient(x, y, x, y + size);
    shell.addColorStop(0, highlight ? "rgba(255,229,163,0.26)" : "rgba(255,215,141,0.12)");
    shell.addColorStop(1, highlight ? "rgba(84,45,11,0.46)" : "rgba(26,16,8,0.42)");
    ctx.fillStyle = shell;
    fillRoundRect(ctx, x, y, size, size, radius);
    ctx.strokeStyle = highlight ? "rgba(255,231,172,0.62)" : "rgba(255,229,184,0.24)";
    ctx.lineWidth = highlight ? 1.5 : 1;
    strokeRoundRect(ctx, x, y, size, size, radius);

    ctx.beginPath();
    roundRectPath(ctx, x + innerPad, y + innerPad, size - innerPad * 2, size - innerPad * 2, Math.max(8, radius - 3));
    ctx.clip();

    const glow = ctx.createRadialGradient(
      x + size / 2,
      y + size / 2,
      size * 0.10,
      x + size / 2,
      y + size / 2,
      size * 0.60
    );
    glow.addColorStop(0, highlight ? `${accent}55` : `${accent}33`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, size, size);

    let drewArt = false;
    if (img) {
      const spec = this._itemArt(art, art?.kind || reward?.type || "") || {};
      const shouldContain =
        /\.png($|\?)/i.test(String(spec.imageSrc || "")) ||
        ["weapon", "goods", "consumable", "rare", "currency"].includes(String(art?.kind || "").toLowerCase());
      drewArt = shouldContain
        ? drawContainImage(ctx, img, x + innerPad, y + innerPad, size - innerPad * 2, size - innerPad * 2)
        : drawCoverImage(ctx, img, x + innerPad, y + innerPad, size - innerPad * 2, size - innerPad * 2);
    }
    if (!drewArt) {
      this._drawWheelGlyph(ctx, this._wheelRewardVisual(reward).glyph || "yton", x + size / 2, y + size / 2, Math.floor(size * 0.78), "#fff6de");
    }

    const gloss = ctx.createLinearGradient(0, y, 0, y + size * 0.56);
    gloss.addColorStop(0, "rgba(255,255,255,0.22)");
    gloss.addColorStop(0.55, "rgba(255,255,255,0.04)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(x, y, size, size);
    ctx.restore();
  }

  _drawArtThumb(ctx, x, y, w, h, art, fallbackLabel = "", fallbackType = "", opts = null) {
    const spec = this._itemArt(art, fallbackType) || {};
    const img = this._resolveArtImage(art, fallbackType);
    const plain = !!opts?.plain;
    const r = Math.max(10, Math.min(18, Math.floor(Math.min(w, h) * 0.22)));
    const useContain = /\.png($|\?)/i.test(String(spec.imageSrc || "")) || ["consumable", "goods", "rare"].includes(String(art?.kind || "").toLowerCase());
    const pad = plain
      ? 0
      : useContain
      ? Math.max(4, Math.floor(Math.min(w, h) * 0.12))
      : Math.max(2, Math.floor(Math.min(w, h) * 0.06));

    if (!plain) {
      ctx.save();
      roundRectPath(ctx, x, y, w, h, r);
      ctx.clip();

      const bg = ctx.createLinearGradient(x, y, x, y + h);
      bg.addColorStop(0, "rgba(255,214,120,0.08)");
      bg.addColorStop(1, "rgba(18,12,8,0.34)");
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);
    }

    if (img) {
      if (useContain) drawContainImage(ctx, img, x + pad, y + pad, w - pad * 2, h - pad * 2);
      else drawCoverImage(ctx, img, x + pad, y + pad, w - pad * 2, h - pad * 2);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#fff4d6";
      ctx.font = `800 ${Math.max(12, Math.floor(h * 0.24))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = String(fallbackLabel || art?.itemName || art?.name || art?.label || "TC").trim();
      const short = label.length <= 9 ? label : label.slice(0, 8);
      ctx.fillText(short, x + w / 2, y + h / 2);
    }

    if (!plain) {
      ctx.restore();
      ctx.strokeStyle = "rgba(255,214,120,0.16)";
      ctx.lineWidth = 1;
      strokeRoundRect(ctx, x, y, w, h, r);
    }
  }

  _rewardRotation(index, total) {
    const slice = (Math.PI * 2) / Math.max(1, total);
    return -Math.PI / 2 - ((index + 0.5) * slice);
  }

  _freeSpinRewards() {
    return [
      {
        id: "free_energy_1",
        type: "energy",
        amount: 1,
        textTr: "+1 enerji",
        textEn: "+1 energy",
        label: "1 ENERGY",
        accent: "#dba54b",
      },
      {
        id: "free_energy_2",
        type: "energy",
        amount: 2,
        textTr: "+2 enerji",
        textEn: "+2 energy",
        label: "2 ENERGY",
        accent: "#e2b764",
      },
      {
        id: "free_yton_3",
        type: "coins",
        amount: 3,
        textTr: "+3 yton",
        textEn: "+3 yton",
        label: "+3 YTON",
        accent: "#ffb04b",
      },
      {
        id: "free_yton_5",
        type: "coins",
        amount: 5,
        textTr: "+5 yton",
        textEn: "+5 yton",
        label: "+5 YTON",
        accent: "#ffbf63",
      },
      {
        id: "free_yton_7",
        type: "coins",
        amount: 7,
        textTr: "+7 yton",
        textEn: "+7 yton",
        label: "+7 YTON",
        accent: "#ffc968",
      },
      {
        id: "free_yton_10",
        type: "coins",
        amount: 10,
        textTr: "+10 yton",
        textEn: "+10 yton",
        label: "+10 YTON",
        accent: "#ffd166",
      },
    ];
  }

  _premiumSpinRewards() {
    return [
      {
        id: "premium_empty",
        type: "empty",
        textTr: "Bu dilim bos gecti",
        textEn: "This slice was empty",
        label: "BOS",
        accent: "#6a4a23",
      },
      {
        id: "premium_yton_350",
        type: "coins",
        amount: 350,
        textTr: "+350 yton",
        textEn: "+350 yton",
        label: "+350 YTON",
        accent: "#ffd45b",
      },
      {
        id: "premium_energy_25",
        type: "energy",
        amount: 25,
        textTr: "+25 enerji",
        textEn: "+25 energy",
        label: "25 ENERGY",
        accent: "#f0c26f",
      },
      {
        id: "premium_drink",
        type: "item",
        textTr: "Club Prosecco kazandin",
        textEn: "You won Club Prosecco",
        label: "CLUB PROSECCO",
        accent: "#f0b66b",
        imageSrc: "./src/assets/drink.png",
        item: {
          id: "premium_drink_" + Date.now(),
          kind: "consumable",
          icon: "CP",
          imageSrc: "./src/assets/club.png",
          name: "Club Prosecco",
          rarity: "rare",
          qty: 1,
          usable: true,
          sellable: true,
          marketable: true,
          energyGain: 11,
          sellPrice: 34,
          marketPrice: 44,
          desc: "Kulup ici icecek.",
        },
      },
      {
        id: "premium_weed",
        type: "item",
        textTr: "White Widow kazandin",
        textEn: "You won White Widow",
        label: "WHITE WIDOW",
        accent: "#d4c061",
        imageSrc: "./src/assets/weed.png",
        item: {
          id: "premium_weed_" + Date.now(),
          kind: "goods",
          icon: "WW",
          imageSrc: "./src/assets/white.png",
          name: "White Widow",
          rarity: "rare",
          qty: 1,
          usable: true,
          sellable: true,
          marketable: true,
          energyGain: 12,
          sellPrice: 22,
          marketPrice: 36,
          desc: "Enerji icin kullanilabilir.",
        },
      },
      {
        id: "premium_girl",
        type: "item",
        textTr: "Scarlett Blaze kazandin",
        textEn: "You won Scarlett Blaze",
        label: "SCARLETT BLAZE",
        accent: "#f0bf72",
        imageSrc: "./src/assets/g_star1.png",
        item: {
          id: "premium_girl_" + Date.now(),
          kind: "girls",
          icon: "SB",
          imageSrc: "./src/assets/g_star1.png",
          name: "Scarlett Blaze",
          rarity: "epic",
          qty: 1,
          usable: true,
          sellable: true,
          marketable: true,
          energyGain: 22,
          sellPrice: 65,
          marketPrice: 95,
          desc: "Vip servis.",
        },
      },
      {
        id: "premium_barrett",
        type: "weapon",
        weaponId: "barrett_m82",
        weaponName: "Barrett M82",
        bonusPct: 60,
        textTr: "Barrett M82 kazandin",
        textEn: "You won Barrett M82",
        label: "BARRETT M82",
        accent: "#ffb37a",
        imageSrc: "./src/assets/barrett.png",
      },
      {
        id: "premium_m134",
        type: "weapon",
        weaponId: "m134",
        weaponName: "M134 Minigun",
        bonusPct: 70,
        textTr: "M134 Minigun kazandin",
        textEn: "You won M134 Minigun",
        label: "M134 MINIGUN",
        accent: "#ff9b5a",
        imageSrc: "./src/assets/m134.png",
      },
    ];
  }

  _crateRewards(kind) {
    if (kind === "legendary") {
      return [
        { id: "crate_l_yton", type: "coins", amount: 120, text: "+120 yton", label: "+120 YTON", accent: "#ffca5c" },
        { id: "crate_l_energy", type: "energy", amount: 26, textTr: "+26 enerji", textEn: "+26 energy", label: "+26 ENERJI", accent: "#e0b45d" },
        { id: "crate_l_barrett", type: "weapon", weaponId: "barrett_m82", weaponName: "Barrett M82", bonusPct: 60, textTr: "Barrett M82 cikti", textEn: "Barrett M82 dropped", label: "BARRETT M82", accent: "#ffb37a", imageSrc: "./src/assets/barrett.png" },
        { id: "crate_l_service", type: "item", textTr: "Ruby Vane cikti", textEn: "Ruby Vane dropped", label: "RUBY VANE", accent: "#f0c06d", imageSrc: "./src/assets/g_star2.png", item: { id: "crate_service_" + Date.now(), kind: "girls", icon: "RV", imageSrc: "./src/assets/g_star2.png", name: "Ruby Vane", rarity: "legendary", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 26, sellPrice: 120, marketPrice: 160, desc: "Deluxe servis." } },
        { id: "crate_l_champ", type: "item", textTr: "Club Prosecco cikti", textEn: "Club Prosecco dropped", label: "CLUB PROSECCO", accent: "#f2a657", imageSrc: "./src/assets/club.png", item: { id: "crate_champ_" + Date.now(), kind: "consumable", icon: "CP", imageSrc: "./src/assets/club.png", name: "Club Prosecco", rarity: "rare", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 11, sellPrice: 34, marketPrice: 44, desc: "Kulup ici icecek." } },
      ];
    }
    return [
      { id: "crate_m_yton", type: "coins", amount: 80, text: "+80 yton", label: "+80 YTON", accent: "#ffca5c" },
      { id: "crate_m_energy", type: "energy", amount: 18, textTr: "+18 enerji", textEn: "+18 energy", label: "+18 ENERJI", accent: "#dfb25b" },
      { id: "crate_m_whiskey", type: "item", textTr: "Street Whiskey cikti", textEn: "Street Whiskey dropped", label: "STREET WHISKEY", accent: "#f2a657", imageSrc: "./src/assets/street.png", item: { id: "crate_whiskey_" + Date.now(), kind: "consumable", icon: "SW", imageSrc: "./src/assets/street.png", name: "Street Whiskey", rarity: "common", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 8, sellPrice: 18, marketPrice: 27, desc: "Hizli enerji urunu." } },
      { id: "crate_m_weed", type: "item", textTr: "White Widow cikti", textEn: "White Widow dropped", label: "WHITE WIDOW", accent: "#d9ab4f", imageSrc: "./src/assets/white.png", item: { id: "crate_weed_" + Date.now(), kind: "goods", icon: "WW", imageSrc: "./src/assets/white.png", name: "White Widow", rarity: "rare", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 12, sellPrice: 22, marketPrice: 36, desc: "Enerji icin kullanilabilir." } },
      { id: "crate_m_vip", type: "item", textTr: "Scarlett Blaze cikti", textEn: "Scarlett Blaze dropped", label: "SCARLETT BLAZE", accent: "#efc06d", imageSrc: "./src/assets/g_star1.png", item: { id: "crate_vip_" + Date.now(), kind: "girls", icon: "SB", imageSrc: "./src/assets/g_star1.png", name: "Scarlett Blaze", rarity: "epic", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 22, sellPrice: 65, marketPrice: 95, desc: "Vip servis." } },
    ];
  }

  _grantReward(reward, opts = {}) {
    const s = this.store.get();
    const cost = Math.max(0, Number(opts.cost || 0));
    const nextPatch = { coins: Math.max(0, Number(s.coins || 0) - cost) };

    if (reward.type === "coins") {
      nextPatch.coins = Math.max(0, nextPatch.coins + Number(reward.amount || 0));
    } else if (reward.type === "energy") {
      const p = { ...(s.player || {}) };
      p.energy = clamp(Number(p.energy || 0) + Number(reward.amount || 0), 0, Number(p.energyMax || 100));
      nextPatch.player = p;
    } else if (reward.type === "combo") {
      const p = { ...(s.player || {}) };
      const maxEnergy = Math.max(1, Number(p.energyMax || 100));
      p.energy = reward.fullEnergy
        ? maxEnergy
        : clamp(Number(p.energy || 0) + Number(reward.amount || 0), 0, maxEnergy);
      nextPatch.player = p;
      nextPatch.coins = Math.max(0, nextPatch.coins + Number(reward.coins || 0));
    } else if (reward.type === "weapon") {
      const p = { ...(s.player || {}) };
      const weapons = {
        owned: { ...((s.weapons || {}).owned || {}), [reward.weaponId]: true },
        equippedId: reward.weaponId,
      };
      const pct = Number(reward.bonusPct || 0);
      const visibleMs = Math.round(500 * (1 + pct / 100));
      const slowFactor = Number((1 + pct / 100).toFixed(2));
      nextPatch.player = {
        ...p,
        weaponName: reward.weaponName || p.weaponName || "Silah Yok",
        weaponBonus: `+%${pct}`,
        weaponIconBonusPct: pct,
        weaponIconVisibleMs: visibleMs,
        weaponTickSlowFactor: slowFactor,
        weaponTimeScale: slowFactor,
      };
      nextPatch.weapons = weapons;
    } else if (reward.type === "item" && reward.item) {
      const items = (s.inventory?.items || []).map((x) => ({ ...x }));
      const itemDef = { ...reward.item };
      const existing = items.find((x) => String(x.name || "").toLowerCase() === String(itemDef.name || "").toLowerCase());
      if (existing) existing.qty = Number(existing.qty || 0) + Number(itemDef.qty || 1);
      else items.unshift(itemDef);
      nextPatch.inventory = {
        ...(s.inventory || {}),
        items,
      };
    }

    if (typeof opts.freeSpinUsed === "number") {
      nextPatch.trade = {
        ...(s.trade || {}),
        freeSpinDay: todayKey(),
        freeSpinUsed: Math.max(0, Number(opts.freeSpinUsed || 0)),
      };
    }

    this.store.set(nextPatch);
  }

  _setWheelResult(mode, pool, selectedIndex, reward) {
    const rotation = this._rewardRotation(selectedIndex, pool.length);
    this._setTrade({
      lootWheel: {
        mode,
        selectedIndex,
        rotation,
        reward: {
          ...reward,
          item: reward.item ? { ...reward.item } : null,
        },
        updatedAt: Date.now(),
      },
    });
  }

  _setCrateReveal(kind, pool, selectedIndex, reward) {
    const lane = this._buildCrateRevealTrack(pool, selectedIndex, reward);
    this._setTrade({
      crateReveal: {
        kind,
        pool: pool.map((entry) => ({
          ...entry,
          item: entry.item ? { ...entry.item } : null,
        })),
        track: lane.track,
        stopIndex: lane.stopIndex,
        selectedIndex,
        reward: reward ? { ...reward, item: reward.item ? { ...reward.item } : null } : null,
        updatedAt: Date.now(),
      },
    });
  }

  _buildCrateRevealTrack(pool, selectedIndex, reward) {
    const source = Array.isArray(pool) ? pool : [];
    const total = Math.max(12, source.length * 4);
    const stopIndex = Math.max(5, total - 3);
    const track = [];

    for (let i = 0; i < total; i += 1) {
      const entry = source[(selectedIndex + i + 1) % Math.max(1, source.length)] || reward || source[0] || null;
      track.push(
        entry
          ? {
              ...entry,
              item: entry.item ? { ...entry.item } : null,
            }
          : null
      );
    }

    if (reward && track[stopIndex]) {
      track[stopIndex] = {
        ...reward,
        item: reward.item ? { ...reward.item } : null,
      };
    }

    return { track: track.filter(Boolean), stopIndex };
  }

  _showRewardOverlay(reward, heading, detail = "", delayMs = 0, durationMs = 2400) {
    if (!reward) return;
    this.rewardOverlay = {
      reward: {
        ...reward,
        item: reward.item ? { ...reward.item } : null,
      },
      heading: String(heading || this._ui("Odul Kazanildi", "Reward Won")),
      detail: String(detail || this._rewardText(reward) || ""),
      startAt: Date.now() + Math.max(0, Number(delayMs || 0)),
      until: Date.now() + Math.max(0, Number(delayMs || 0)) + Math.max(800, Number(durationMs || 0)),
    };
  }

  _startWheelAnimation(mode, pool, selectedIndex, reward) {
    const trade = this._trade();
    const total = Math.max(1, pool.length);
    const current = this.wheelAnim?.rotation ?? Number(trade.lootWheel?.rotation || this._rewardRotation(0, total));
    const desired = this._rewardRotation(selectedIndex, total);
    const TAU = Math.PI * 2;
    let delta = desired - current;
    while (delta < 0) delta += TAU;
    while (delta >= TAU) delta -= TAU;
    const loops = mode === "premium" ? 5 : 4;
    const target = current + delta + loops * TAU;
    this.wheelAnim = {
      mode,
      reward: reward ? { ...reward, item: reward.item ? { ...reward.item } : null } : null,
      start: Date.now(),
      duration: mode === "premium" ? 2400 : 1900,
      from: current,
      to: target,
      rotation: current,
      selectedIndex,
      poolSize: total,
    };
  }

  _getWheelRotation(trade, pool) {
    if (this.wheelAnim && this.wheelAnim.poolSize === Math.max(1, pool.length)) return this.wheelAnim.rotation;
    const wheelState = trade.lootWheel || {};
    return Number.isFinite(Number(wheelState.rotation)) ? Number(wheelState.rotation) : this._rewardRotation(Number(wheelState.selectedIndex || 0), pool.length);
  }

  _crateDisplayCards(reveal) {
    const reward = reveal?.reward || null;
    const pool = Array.isArray(reveal?.pool) ? reveal.pool : [];
    if (!reward) return pool.slice(0, 3);
    const idx = pool.findIndex((entry) => String(entry.id || '') === String(reward.id || ''));
    if (idx < 0 || pool.length < 2) return [reward];
    const prev = pool[(idx - 1 + pool.length) % pool.length];
    const next = pool[(idx + 1) % pool.length];
    return [prev, reward, next];
  }

  _wheelRewardVisual(reward) {
    const type = String(reward?.type || "").toLowerCase();
    const amount = Math.max(0, Number(reward?.amount || reward?.coins || 0));
    const rewardArt = this._rewardArt(reward);
    const weaponShort = /m134/i.test(String(reward?.weaponName || reward?.label || "")) ? "M134" : "M82";

    if (type === "coins") {
      return {
        title: `${amount}`,
        subtitle: "YTON",
        category: "YTON",
        accent: reward?.accent || "#f4c45d",
        art: rewardArt,
        glyph: "yton",
      };
    }

    if (type === "energy") {
      return {
        title: `${amount}`,
        subtitle: "ENERJI",
        category: "ENERJI",
        accent: reward?.accent || "#e0b96c",
        art: rewardArt,
        glyph: "energy",
      };
    }

    if (type === "weapon") {
      return {
        title: weaponShort,
        subtitle: "SILAH",
        category: "SILAH",
        accent: reward?.accent || "#f0a96c",
        art: rewardArt,
        glyph: "weapon",
      };
    }

    if (type === "item") {
      const kind = String(reward?.item?.kind || "").toLowerCase();
      if (kind === "girls") {
        return {
          title: String(reward?.item?.icon || "SB").slice(0, 3),
          subtitle: "KADIN",
          category: "KADIN",
          accent: reward?.accent || "#efbb78",
          art: rewardArt,
          glyph: "girls",
        };
      }
      if (kind === "goods") {
        return {
          title: String(reward?.item?.icon || "WW").slice(0, 3),
          subtitle: "OT",
          category: "OT",
          accent: reward?.accent || "#afc86e",
          art: rewardArt,
          glyph: "weed",
        };
      }
      return {
        title: String(reward?.item?.icon || "CP").slice(0, 3),
        subtitle: "ICKI",
        category: "ICKI",
        accent: reward?.accent || "#efb76b",
        art: rewardArt,
        glyph: "drink",
      };
    }

    if (type === "empty") {
      return {
        title: "BOS",
        subtitle: "SANS",
        category: "BOS",
        accent: reward?.accent || "#7b5630",
        art: rewardArt,
        glyph: "empty",
      };
    }

    if (type === "combo") {
      return {
        title: "FULL",
        subtitle: `${amount || 0}`,
        category: "FULL",
        accent: reward?.accent || "#96d7ff",
        art: rewardArt,
        glyph: "energy",
      };
    }

    return {
      title: shortLabel || "ODUL",
      subtitle: "ODUL",
      category: "ODUL",
      accent: reward?.accent || "#f1b965",
      art: rewardArt,
      glyph: "yton",
    };
  }

  _drawWheelGlyph(ctx, glyph, x, y, size, color = "#fff4d2") {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (glyph === "energy") {
      ctx.beginPath();
      ctx.moveTo(-size * 0.14, -size * 0.52);
      ctx.lineTo(size * 0.02, -size * 0.08);
      ctx.lineTo(-size * 0.16, -size * 0.08);
      ctx.lineTo(size * 0.16, size * 0.52);
      ctx.lineTo(size * 0.04, size * 0.12);
      ctx.lineTo(size * 0.20, size * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    if (glyph === "yton") {
      ctx.lineWidth = Math.max(2, size * 0.06);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `900 ${Math.max(18, Math.floor(size * 0.38))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Y", 0, 1);
      ctx.restore();
      return;
    }

    if (glyph === "weapon") {
      ctx.fillRect(-size * 0.34, -size * 0.08, size * 0.48, size * 0.16);
      ctx.fillRect(size * 0.08, -size * 0.14, size * 0.22, size * 0.10);
      ctx.fillRect(size * 0.26, -size * 0.04, size * 0.18, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(-size * 0.08, size * 0.02);
      ctx.lineTo(-size * 0.18, size * 0.34);
      ctx.lineTo(-size * 0.04, size * 0.34);
      ctx.lineTo(size * 0.02, size * 0.10);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-size * 0.34, -size * 0.08);
      ctx.lineTo(-size * 0.48, -size * 0.18);
      ctx.lineTo(-size * 0.44, -size * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    if (glyph === "drink") {
      ctx.lineWidth = Math.max(2.4, size * 0.06);
      ctx.beginPath();
      ctx.moveTo(-size * 0.18, -size * 0.34);
      ctx.lineTo(size * 0.18, -size * 0.34);
      ctx.lineTo(size * 0.08, -size * 0.02);
      ctx.lineTo(-size * 0.08, -size * 0.02);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.02);
      ctx.lineTo(0, size * 0.22);
      ctx.moveTo(-size * 0.16, size * 0.22);
      ctx.lineTo(size * 0.16, size * 0.22);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (glyph === "girls") {
      ctx.lineWidth = Math.max(2.4, size * 0.06);
      ctx.beginPath();
      ctx.arc(0, -size * 0.10, size * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, size * 0.12);
      ctx.lineTo(0, size * 0.42);
      ctx.moveTo(-size * 0.16, size * 0.28);
      ctx.lineTo(size * 0.16, size * 0.28);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (glyph === "weed") {
      ctx.lineWidth = Math.max(2, size * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, size * 0.38);
      ctx.lineTo(0, -size * 0.34);
      ctx.stroke();
      const leaves = [
        [-0.26, 0.08, -0.04, -0.22],
        [0.26, 0.08, 0.04, -0.22],
        [-0.18, -0.04, -0.02, -0.34],
        [0.18, -0.04, 0.02, -0.34],
        [0, -0.10, 0, -0.44],
      ];
      for (const [dx, dy, tx, ty] of leaves) {
        ctx.beginPath();
        ctx.moveTo(0, size * 0.10);
        ctx.quadraticCurveTo(size * dx, size * dy, size * tx, size * ty);
        ctx.quadraticCurveTo(size * dx * 0.28, size * (dy - 0.04), 0, size * 0.10);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (glyph === "empty") {
      ctx.lineWidth = Math.max(4, size * 0.1);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.28, size * 0.28);
      ctx.lineTo(size * 0.28, -size * 0.28);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.font = `900 ${Math.max(16, Math.floor(size * 0.42))}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(glyph || "T").slice(0, 3), 0, 0);
    ctx.restore();
  }

  _drawWheelBadge(ctx, reward, x, y, size, highlight = false) {
    const meta = this._wheelRewardVisual(reward);
    const glow = String(meta.accent || "#f1b965");
    const rewardArt = meta.art || this._rewardArt(reward);
    const rewardImg = rewardArt ? this._resolveArtImage(rewardArt, rewardArt?.kind || reward?.type || "") : null;

    ctx.save();
    ctx.translate(x, y);

    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, size * 0.54, size * 0.56, size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    if (highlight) {
      const aura = ctx.createRadialGradient(0, 0, size * 0.18, 0, 0, size * 1.05);
      aura.addColorStop(0, "rgba(255,244,210,0.38)");
      aura.addColorStop(0.45, `${glow}55`);
      aura.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
    }

    const outer = ctx.createLinearGradient(-size, -size, size, size);
    outer.addColorStop(0, "rgba(255,232,178,0.96)");
    outer.addColorStop(0.2, glow);
    outer.addColorStop(0.75, "rgba(92,51,15,0.98)");
    outer.addColorStop(1, "rgba(255,213,120,0.86)");
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.72, 0, Math.PI * 2);
    ctx.fill();

    const inner = ctx.createRadialGradient(-size * 0.14, -size * 0.22, size * 0.12, 0, 0, size * 0.72);
    inner.addColorStop(0, "rgba(38,24,12,0.96)");
    inner.addColorStop(0.58, "rgba(18,12,8,0.98)");
    inner.addColorStop(1, "rgba(8,6,4,0.98)");
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.60, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.54, 0, Math.PI * 2);
    ctx.clip();
    const fill = ctx.createRadialGradient(0, -size * 0.12, size * 0.08, 0, 0, size * 0.54);
    fill.addColorStop(0, "rgba(255,236,181,0.16)");
    fill.addColorStop(1, "rgba(255,214,120,0.05)");
    ctx.fillStyle = fill;
    ctx.fillRect(-size, -size, size * 2, size * 2);
    for (let i = -2; i <= 2; i += 1) {
      ctx.strokeStyle = `rgba(255,230,184,${i === 0 ? 0.12 : 0.05})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, size * (0.18 + Math.abs(i) * 0.08), -Math.PI * 0.72, Math.PI * 0.26);
      ctx.stroke();
    }
    let drewRewardImage = false;
    if (rewardImg) {
      const drawSize = size * 0.90;
      const spec = this._itemArt(rewardArt, rewardArt?.kind || reward?.type || "") || {};
      const useContain =
        /\.png($|\?)/i.test(String(spec.imageSrc || "")) ||
        ["weapon", "goods", "consumable", "rare", "currency"].includes(String(rewardArt?.kind || "").toLowerCase());
      drewRewardImage = useContain
        ? drawContainImage(ctx, rewardImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize)
        : drawCoverImage(ctx, rewardImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    }
    if (!drewRewardImage) {
      this._drawWheelGlyph(ctx, meta.glyph || meta.category, 0, 0, size, "#fff6de");
    }
    const glass = ctx.createLinearGradient(0, -size * 0.58, 0, size * 0.20);
    glass.addColorStop(0, "rgba(255,255,255,0.30)");
    glass.addColorStop(0.45, "rgba(255,255,255,0.08)");
    glass.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glass;
    ctx.fillRect(-size, -size, size * 2, size * 1.2);
    ctx.restore();

    ctx.strokeStyle = "rgba(255,244,215,0.52)";
    ctx.lineWidth = Math.max(1.4, size * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    return meta;
  }

  _drawWheelBadgePlaque(ctx, x, y, w, h, reward, highlight = false) {
    const meta = this._wheelRewardVisual(reward);
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, highlight ? "rgba(255,224,155,0.22)" : "rgba(255,232,190,0.10)");
    grad.addColorStop(1, highlight ? "rgba(102,58,18,0.34)" : "rgba(44,26,11,0.36)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, Math.min(16, h / 2));
    ctx.strokeStyle = highlight ? "rgba(255,226,162,0.44)" : "rgba(255,228,186,0.14)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, x, y, w, h, Math.min(16, h / 2));

    ctx.fillStyle = highlight ? "#fff8ea" : "rgba(255,245,219,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(10, Math.floor(h * 0.38))}px system-ui`;
    textFit(ctx, meta.title, x + w / 2, y + h / 2 + 4, w - 14);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  _drawRewardCard(ctx, x, y, w, h, reward, highlight = false) {
    const accent = reward?.accent || "#f3b35b";
    const typeMeta = this._wheelRewardVisual(reward);
    const rewardArt = this._rewardArt(reward);
    const hasRewardArt = !!(rewardArt && this._resolveArtImage(rewardArt, rewardArt?.kind || reward?.type || ""));
    const rewardTitle = String(
      reward?.weaponName ||
      reward?.item?.name ||
      reward?.label ||
      typeMeta.title ||
      this._rewardText(reward) ||
      "Odul"
    ).trim();
    const rewardDetail = String(this._rewardText(reward) || "").trim();
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, highlight ? "rgba(255,201,110,0.22)" : "rgba(16,11,7,0.56)");
    grad.addColorStop(1, highlight ? "rgba(98,52,10,0.34)" : "rgba(8,7,6,0.72)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, 22);
    ctx.strokeStyle = highlight ? "rgba(255,216,134,0.78)" : "rgba(255,255,255,0.10)";
    ctx.lineWidth = highlight ? 1.6 : 1;
    strokeRoundRect(ctx, x, y, w, h, 22);
    const compact = w < 150 || h < 108;
    if (compact) {
      const thumbSize = hasRewardArt
        ? Math.max(34, Math.min(46, Math.floor(Math.min(w, h) * 0.40)))
        : Math.max(28, Math.min(38, Math.floor(Math.min(w, h) * 0.34)));
      this._drawRewardThumb(ctx, x + Math.round((w - thumbSize) / 2), y + 18, thumbSize, reward, highlight);

      ctx.fillStyle = "#ffe2a3";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 9px system-ui";
      textFit(ctx, typeMeta.category, x + w / 2, y + 64, w - 18);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 12px system-ui";
      textFit(ctx, shortRewardLabel({ ...reward, label: rewardTitle }), x + w / 2, y + h - 26, w - 16);

      ctx.fillStyle = "rgba(255,255,255,0.68)";
      ctx.font = "10px system-ui";
      const compactDetail = wrapText(ctx, rewardDetail, w - 20, 1);
      if (compactDetail[0]) {
        textFit(ctx, compactDetail[0], x + w / 2, y + h - 12, w - 18);
      }

      if (highlight) {
        const chipW = Math.min(Math.max(56, Math.floor(w * 0.42)), w - 18);
        ctx.fillStyle = accent;
        fillRoundRect(ctx, x + w - chipW - 9, y + 9, chipW, 22, 11);
        ctx.fillStyle = "#251506";
        ctx.font = "900 9px system-ui";
        ctx.fillText("KAZANILDI", x + w - chipW * 0.5 - 9, y + 20);
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      return;
    }

    const chipW = highlight ? Math.min(110, Math.max(84, Math.floor(w * 0.28))) : 0;
    const chipReserve = highlight ? chipW + 26 : 0;
    const thumbSize = hasRewardArt ? Math.max(42, Math.min(50, Math.floor(h * 0.42))) : Math.max(30, Math.min(38, Math.floor(h * 0.24)));
    const thumbX = x + 16;
    const thumbY = y + Math.round((h - thumbSize) / 2);
    this._drawRewardThumb(ctx, thumbX, thumbY, thumbSize, reward, highlight);

    ctx.fillStyle = "#ffe2a3";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "800 10px system-ui";
    const textX = thumbX + thumbSize + 16;
    const textW = Math.max(56, w - (textX - x) - chipReserve);
    textFit(ctx, typeMeta.category, textX, y + 24, textW);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 14px system-ui";
    textFit(ctx, rewardTitle, textX, y + 48, textW);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "11px system-ui";
    const detailLines = wrapText(ctx, rewardDetail, textW, highlight ? 2 : 1);
    detailLines.forEach((line, index) => {
      ctx.fillText(line, textX, y + 70 + index * 14);
    });

    if (highlight) {
      ctx.fillStyle = accent;
      fillRoundRect(ctx, x + w - chipW - 14, y + 12, chipW, 24, 12);
      ctx.fillStyle = "#251506";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 10px system-ui";
      ctx.fillText("KAZANILDI", x + w - chipW * 0.5 - 14, y + 24);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  _drawWheel(ctx, x, y, w, trade) {
    const wheelState = trade.lootWheel || {};
    const mode = wheelState.mode === "premium" ? "premium" : "free";
    const pool = mode === "premium" ? this._premiumSpinRewards() : this._freeSpinRewards();
    const selectedIndex = Number.isFinite(Number(wheelState.selectedIndex)) ? Number(wheelState.selectedIndex) : 0;
    const rotation = this._getWheelRotation(trade, pool);

    const cy = y + 180;
    const radius = Math.min(mode === "premium" ? 138 : 130, Math.floor(Math.min(w * (mode === "premium" ? 0.34 : 0.32), mode === "premium" ? 138 : 130)));
    const rewardCardY = Math.round(cy + radius + 24);
    const rewardCardH = 118;
    const boxH = Math.max(430, rewardCardY + rewardCardH + 14 - y);
    this.drawCard(ctx, x, y, w, boxH);

    ctx.fillStyle = "#fff";
    ctx.font = "900 16px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(
      mode === "premium"
        ? this._ui("Premium Cark", "Premium Wheel")
        : this._ui("Gunluk Reklam Carki", "Daily Ad Wheel"),
      x + 16,
      y + 28
    );
    ctx.fillStyle = this.wheelAnim ? "rgba(255,215,120,0.86)" : "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    ctx.fillText(
      this.wheelAnim
        ? this._ui("Cark donuyor...", "Wheel is spinning...")
        : this._ui("Okun gosterdigi dilim odulu verir.", "The pointed slice is the exact reward."),
      x + 16,
      y + 48
    );

    const cx = x + w / 2;
    const slice = (Math.PI * 2) / pool.length;
    const selectedAccent = pool[selectedIndex]?.accent || "#f3bb65";

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius + 16, radius * 0.94, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    const halo = ctx.createRadialGradient(0, 0, radius * 0.22, 0, 0, radius + 26);
    halo.addColorStop(0, "rgba(0,0,0,0)");
    halo.addColorStop(0.65, "rgba(255,198,98,0.05)");
    halo.addColorStop(1, "rgba(255,198,98,0.22)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 26, 0, Math.PI * 2);
    ctx.fill();

    const rimOuter = ctx.createLinearGradient(-radius, -radius, radius, radius);
    rimOuter.addColorStop(0, "rgba(255,232,178,0.98)");
    rimOuter.addColorStop(0.2, "rgba(245,195,96,0.98)");
    rimOuter.addColorStop(0.65, "rgba(102,63,19,0.98)");
    rimOuter.addColorStop(1, "rgba(255,214,121,0.96)");
    ctx.fillStyle = rimOuter;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(12,8,6,0.98)";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
    ctx.fill();

    const rimInner = ctx.createLinearGradient(-radius, -radius, radius, radius);
    rimInner.addColorStop(0, "rgba(255,236,197,0.42)");
    rimInner.addColorStop(1, "rgba(86,55,19,0.24)");
    ctx.strokeStyle = rimInner;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 4, 0, Math.PI * 2);
    ctx.stroke();

    const TAU = Math.PI * 2;
    for (let i = 0; i < pool.length; i += 1) {
      const start = rotation + i * slice;
      const end = start + slice;
      const highlightSlice = !this.wheelAnim && i === selectedIndex;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      const seg = ctx.createRadialGradient(
        Math.cos(start + slice / 2) * radius * 0.12,
        Math.sin(start + slice / 2) * radius * 0.12,
        radius * 0.08,
        0,
        0,
        radius
      );
      if (highlightSlice) {
        seg.addColorStop(0, "rgba(255,228,164,0.98)");
        seg.addColorStop(0.45, "rgba(203,144,45,0.98)");
        seg.addColorStop(1, "rgba(99,61,19,0.98)");
      } else if (i % 2 === 0) {
        seg.addColorStop(0, "rgba(194,139,44,0.98)");
        seg.addColorStop(0.55, "rgba(154,107,32,0.96)");
        seg.addColorStop(1, "rgba(96,61,16,0.98)");
      } else {
        seg.addColorStop(0, "rgba(166,116,34,0.98)");
        seg.addColorStop(0.55, "rgba(131,88,24,0.96)");
        seg.addColorStop(1, "rgba(78,50,14,0.98)");
      }
      ctx.fillStyle = seg;
      ctx.fill();
      ctx.strokeStyle = highlightSlice ? "rgba(255,246,214,0.74)" : "rgba(255,240,208,0.20)";
      ctx.lineWidth = highlightSlice ? 2.2 : 1.2;
      ctx.stroke();

      const mid = start + slice / 2;
      const reward = pool[i];
      const badgeSize = mode === "premium" ? 34 : 28;
      const badgeRadius = radius * (mode === "premium" ? 0.54 : 0.52);
      const badgeX = Math.cos(mid) * badgeRadius;
      const badgeY = Math.sin(mid) * badgeRadius;
      const meta = this._drawWheelBadge(ctx, reward, badgeX, badgeY, badgeSize, highlightSlice);
      const title = String(meta.title || "").trim();
      const subtitle = String(meta.subtitle || "").trim();
      const labelRadius = radius * (mode === "premium" ? 0.74 : 0.72);
      const labelX = Math.cos(mid) * labelRadius;
      const labelY = Math.sin(mid) * labelRadius;
      const labelMaxWidth = Math.max(22, (slice * radius) * 0.58);
      let safeTitle = title;
      let safeSubtitle = subtitle;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
        ctx.font = `900 ${mode === "premium" ? 8 : 7}px system-ui`;
      while (safeTitle.length > 1 && ctx.measureText(safeTitle).width > labelMaxWidth) {
        safeTitle = `${safeTitle.slice(0, -2)}…`;
      }

      ctx.fillStyle = highlightSlice ? "#fff8eb" : "rgba(255,242,214,0.96)";
      ctx.fillText(safeTitle, labelX, labelY - (subtitle ? 6 : 0));

      if (subtitle) {
          ctx.font = `800 ${mode === "premium" ? 6 : 5}px system-ui`;
        while (safeSubtitle.length > 1 && ctx.measureText(safeSubtitle).width > labelMaxWidth) {
          safeSubtitle = `${safeSubtitle.slice(0, -2)}…`;
        }
        ctx.fillStyle = highlightSlice ? "rgba(255,242,214,0.88)" : "rgba(255,233,192,0.72)";
        ctx.fillText(safeSubtitle, labelX, labelY + 8);
      }
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius - 10, 0, Math.PI * 2);
    ctx.clip();
    const gloss = ctx.createLinearGradient(0, -radius, 0, radius * 0.22);
    gloss.addColorStop(0, "rgba(255,255,255,0.26)");
    gloss.addColorStop(0.35, "rgba(255,255,255,0.10)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 1.2);
    ctx.restore();

    for (let i = 0; i < 6; i += 1) {
      const ang = (-Math.PI / 2) + (TAU / 6) * i;
      const px = Math.cos(ang) * (radius + 7);
      const py = Math.sin(ang) * (radius + 7);
      const stud = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, 10);
      stud.addColorStop(0, "rgba(255,250,227,0.98)");
      stud.addColorStop(0.35, "rgba(247,202,110,0.95)");
      stud.addColorStop(1, "rgba(113,70,21,0.98)");
      ctx.fillStyle = stud;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    const hub = ctx.createRadialGradient(-4, -6, 3, 0, 0, 34);
    hub.addColorStop(0, "rgba(84,52,18,0.98)");
    hub.addColorStop(0.45, "rgba(38,22,10,0.98)");
    hub.addColorStop(1, "rgba(15,9,6,0.98)");
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,235,192,0.24)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(28,14,7,0.98)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,214,120,0.36)";
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.beginPath();
    ctx.moveTo(cx, y + 98);
    ctx.lineTo(cx - 20, y + 50);
    ctx.lineTo(cx + 20, y + 50);
    ctx.closePath();
    ctx.fill();

    const beam = ctx.createRadialGradient(cx, y + 68, 6, cx, y + 68, 34);
    beam.addColorStop(0, "rgba(255,245,207,0.46)");
    beam.addColorStop(1, "rgba(255,212,118,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.arc(cx, y + 68, 34, 0, Math.PI * 2);
    ctx.fill();

    const pointer = ctx.createLinearGradient(cx, y + 48, cx, y + 100);
    pointer.addColorStop(0, "#fff0c9");
    pointer.addColorStop(0.5, selectedAccent);
    pointer.addColorStop(1, "#7e4a16");
    ctx.fillStyle = pointer;
    ctx.beginPath();
    ctx.moveTo(cx, y + 94);
    ctx.lineTo(cx - 18, y + 52);
    ctx.lineTo(cx + 18, y + 52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,248,228,0.52)";
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();

    const reward = wheelState.reward || pool[selectedIndex] || pool[0];
    this._drawRewardCard(ctx, x + 14, rewardCardY, w - 28, rewardCardH, reward, true);
    return boxH;
  }

  _drawCrateReveal(ctx, x, y, w, reveal) {
    if (!reveal?.reward) return 0;
    const track = Array.isArray(reveal.track) && reveal.track.length ? reveal.track : this._crateDisplayCards(reveal);
    const stopIndex = clamp(Number(reveal.stopIndex || 0), 0, Math.max(0, track.length - 1));
    const animAge = Math.max(0, Date.now() - Number(reveal.updatedAt || 0));
    const animT = clamp(animAge / 1450, 0, 1);
    const eased = 1 - Math.pow(1 - animT, 4);
    const boxH = 228;
    const laneX = x + 14;
    const laneY = y + 68;
    const laneW = w - 28;
    const laneH = 110;
    const step = clamp(Math.floor(laneW * 0.25), 92, 124);
    const cardW = step - 12;
    const cardH = laneH - 14;
    const centerCardX = laneX + Math.round((laneW - cardW) / 2);
    const finalOffset = centerCardX - stopIndex * step;
    const travelSteps = Math.max(6, Math.min(12, track.length - 1));
    const startOffset = finalOffset - step * travelSteps;
    const laneOffset = startOffset + (finalOffset - startOffset) * eased;

    this.drawCard(ctx, x, y, w, boxH);
    ctx.fillStyle = "#fff";
    ctx.font = "900 16px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(reveal.kind === "legendary" ? this._ui("Legendary Sandik Acildi", "Legendary Crate Opened") : this._ui("Mystery Sandik Acildi", "Mystery Crate Opened"), x + 16, y + 28);
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    ctx.fillText(this._ui("Kartlar akarak gelir ve verilen odulde durur.", "Cards slide through and stop on the granted reward."), x + 16, y + 48);

    ctx.fillStyle = "rgba(7,7,10,0.34)";
    fillRoundRect(ctx, laneX, laneY, laneW, laneH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, laneX, laneY, laneW, laneH, 18);

    ctx.save();
    roundRectPath(ctx, laneX, laneY, laneW, laneH, 18);
    ctx.clip();
    for (let i = 0; i < track.length; i += 1) {
      const reward = track[i];
      if (!reward) continue;
      const cardX = laneOffset + i * step;
      const cardY = laneY + 7;
      if (cardX > laneX + laneW + 16 || cardX + cardW < laneX - 16) continue;

      const distance = Math.abs(cardX + cardW / 2 - (laneX + laneW / 2));
      const normalized = clamp(1 - distance / Math.max(1, laneW * 0.5), 0, 1);
      const scale = 0.9 + normalized * 0.1;
      ctx.save();
      ctx.globalAlpha = 0.34 + normalized * 0.66;
      ctx.translate(cardX + cardW / 2, cardY + cardH / 2);
      ctx.scale(scale, scale);
      this._drawRewardCard(ctx, -cardW / 2, -cardH / 2, cardW, cardH, reward, i === stopIndex && animT > 0.82);
      ctx.restore();
    }
    ctx.restore();

    const fadeLeft = ctx.createLinearGradient(laneX, laneY, laneX + 38, laneY);
    fadeLeft.addColorStop(0, "rgba(8,8,10,0.92)");
    fadeLeft.addColorStop(1, "rgba(8,8,10,0)");
    ctx.fillStyle = fadeLeft;
    ctx.fillRect(laneX, laneY, 38, laneH);

    const fadeRight = ctx.createLinearGradient(laneX + laneW - 38, laneY, laneX + laneW, laneY);
    fadeRight.addColorStop(0, "rgba(8,8,10,0)");
    fadeRight.addColorStop(1, "rgba(8,8,10,0.92)");
    ctx.fillStyle = fadeRight;
    ctx.fillRect(laneX + laneW - 38, laneY, 38, laneH);

    ctx.strokeStyle = "rgba(255,215,138,0.70)";
    ctx.lineWidth = 1.5;
    strokeRoundRect(ctx, centerCardX - 5, laneY + 4, cardW + 10, laneH - 8, 18);
    ctx.fillStyle = "rgba(255,224,166,0.14)";
    fillRoundRect(ctx, centerCardX - 5, laneY + 4, cardW + 10, laneH - 8, 18);

    ctx.fillStyle = "rgba(255,228,182,0.76)";
    ctx.font = "11px system-ui";
    ctx.fillText(this._ui("Ortadaki kart verilen oduldur.", "The centered card is the granted reward."), x + 16, y + boxH - 18);
    return boxH;
  }

  _drawRewardOverlay(ctx, w, h) {
    const overlay = this.rewardOverlay;
    if (!overlay) return;

    const now = Date.now();
    if (now < Number(overlay.startAt || 0)) return;
    if (now >= Number(overlay.until || 0)) {
      this.rewardOverlay = null;
      return;
    }

    const fadeIn = clamp((now - Number(overlay.startAt || 0)) / 180, 0, 1);
    const fadeOut = clamp((Number(overlay.until || 0) - now) / 220, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);
    const scale = 0.92 + alpha * 0.08;
    const cardW = Math.min(330, w - 42);
    const cardH = 170;
    const cardX = Math.round((w - cardW) / 2);
    const cardY = Math.round(h * 0.5 - cardH * 0.56);

    ctx.save();
    ctx.globalAlpha = 0.18 * alpha;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cardX + cardW / 2, cardY + cardH / 2);
    ctx.scale(scale, scale);

    const bg = ctx.createLinearGradient(-cardW / 2, -cardH / 2, -cardW / 2, cardH / 2);
    bg.addColorStop(0, "rgba(23,16,10,0.96)");
    bg.addColorStop(1, "rgba(9,8,7,0.98)");
    ctx.fillStyle = bg;
    fillRoundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 24);
    ctx.strokeStyle = "rgba(255,214,132,0.72)";
    ctx.lineWidth = 1.4;
    strokeRoundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 24);

    ctx.fillStyle = "#ffdfa0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 13px system-ui";
    ctx.fillText(String(overlay.heading || this._ui("Odul Kazanildi", "Reward Won")), 0, -58);

    this._drawRewardThumb(ctx, -32, -22, 64, overlay.reward, true);

    const title = String(
      overlay.reward?.weaponName ||
      overlay.reward?.item?.name ||
      overlay.reward?.label ||
      this._rewardText(overlay.reward) ||
      this._ui("Odul", "Reward")
    ).trim();

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px system-ui";
    textFit(ctx, title, 0, 34, cardW - 40);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    const detailLines = wrapText(ctx, String(overlay.detail || this._rewardText(overlay.reward) || ""), cardW - 44, 2);
    detailLines.forEach((line, index) => {
      ctx.fillText(line, 0, 60 + index * 16);
    });

    ctx.fillStyle = overlay.reward?.accent || "#f3b35b";
    fillRoundRect(ctx, -56, -77, 112, 24, 12);
    ctx.fillStyle = "#251506";
    ctx.font = "900 10px system-ui";
    ctx.fillText("KAZANILDI", 0, -64);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
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
    const trade = this._trade();
    const used = String(trade.freeSpinDay || "") === todayKey() ? Number(trade.freeSpinUsed || 0) : 0;
    return used < FREE_SPIN_LIMIT;
  }

  _freeSpinRemaining() {
    const trade = this._trade();
    const used = String(trade.freeSpinDay || "") === todayKey() ? Number(trade.freeSpinUsed || 0) : 0;
    return Math.max(0, FREE_SPIN_LIMIT - used);
  }

  _promptSearch() {
    const trade = this._trade();
    const v = window.prompt(this._ui("Mekan veya urun ara:", "Search venue or product:"), trade.searchQuery || "");
    if (v === null) return;
    this._setTrade({ searchQuery: String(v || "").trim() });
    this._showToast(v ? this._ui(`Arama: ${v}`, `Search: ${v}`) : this._ui("Arama temizlendi", "Search cleared"));
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

  _isBackendManagedMarketListing(listing) {
    return !!(
      listing?.serverManaged ||
      listing?.inventoryItemId ||
      listing?.businessProductId
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
    const profileKey = String(
      this._getTelegramId() ||
      window.tcGetProfileKey?.() ||
      ""
    ).trim();
    if (!profileKey) {
      throw new Error("profile key bulunamadi");
    }

    const json = await fetchBackendJson(
      `/public/profile?identity_key=${encodeURIComponent(profileKey)}`
    );
    const data = json?.item || null;
    if (!data?.id) {
      throw new Error("Profil bulunamadi");
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
    const art = this._businessArt(row.business_type);
    return {
      id: String(row.id),
      type: row.business_type,
      icon: iconForType(row.business_type),
      imageKey: art?.imageKey || "",
      imageSrc: art?.imageSrc || "",
      name: row.name || this._typeLabel(row.business_type),
      ownerId: String(row.owner_id || ""),
      ownerName: String(playerName || "Player"),
      dailyProduction: Number(row.daily_production || 50),
      stock: Number(row.stock_qty || 0),
      theme: row.business_type,
      products: [],
    };
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
      icon: "BM",
      imageKey: "blackmarket",
      imageSrc: "./src/assets/BlackMarket.png",
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

  async _doFreeSpin() {
    if (this.wheelAnim || this.adBusy) {
      this._showToast(this._ui("Cark donuyor", "Wheel is spinning"));
      return;
    }
    if (!this._isFreeSpinReady()) {
      this._showToast(this._ui("Bugunluk 3 reklamli spin bitti", "All 3 daily ad spins are used"));
      return;
    }

    this.adBusy = true;
    this._showToast(this._ui("Reklam yukleniyor...", "Loading ad..."), 1400);

    try {
      const played = await playRichRewardedAd();
      if (!played.ok) {
        const detail = describeRichAdFailure(played, "unknown");
        if (played.reason === "controller_missing" || played.reason === "method_missing") {
          this._showToast(this._ui(`RichAds hazir degil: ${detail}`, `RichAds is not ready: ${detail}`), 2600);
          return;
        }
        if (played.reason === "not_completed") {
          this._showToast(this._ui(`Reklam tamamlanmadi: ${detail}`, `Ad was not completed: ${detail}`), 2400);
          return;
        }
        console.warn("[TonCrime] TradeScene ad error:", detail, played.error || played.result || played);
        this._showToast(this._ui(`Reklam acilamadi: ${detail}`, `Ad failed: ${detail}`), 2800);
        return;
      }

      const used = FREE_SPIN_LIMIT - this._freeSpinRemaining() + 1;
      const pool = this._freeSpinRewards();
      const selectedIndex = Math.floor(Math.random() * pool.length);
      const reward = pool[selectedIndex];

      this._grantReward(reward, { freeSpinUsed: used });
      this._setWheelResult("free", pool, selectedIndex, reward);
      this._startWheelAnimation("free", pool, selectedIndex, reward);
    } catch (error) {
      console.warn("[TonCrime] TradeScene rewarded ad fatal:", error);
      this._showToast(this._ui(`Reklam acilamadi: ${String(error?.message || error || "unknown")}`, `Ad failed: ${String(error?.message || error || "unknown")}`), 2800);
    } finally {
      this.adBusy = false;
    }
  }

  _doPremiumSpin() {
    if (this.wheelAnim) {
      this._showToast(this._ui("Cark donuyor", "Wheel is spinning"));
      return;
    }
    const s = this.store.get();

    if (Number(s.coins || 0) < PREMIUM_WHEEL_COST) {
      this._showToast(this._ui("Premium cark icin 1000 yton gerek", "1000 yton is required for the premium wheel"));
      return;
    }

    const pool = this._premiumSpinRewards();
    const selectedIndex = Math.floor(Math.random() * pool.length);
    const reward = pool[selectedIndex];

    this._grantReward(reward, { cost: PREMIUM_WHEEL_COST });
    this._setWheelResult("premium", pool, selectedIndex, reward);
    this._startWheelAnimation("premium", pool, selectedIndex, reward);
  }

  _buyCrate(kind) {
    const s = this.store.get();
    const cost = kind === "legendary" ? 140 : 65;

    if (Number(s.coins || 0) < cost) {
      this._showToast(this._ui("Yetersiz yton", "Not enough yton"));
      return;
    }

    const pool = this._crateRewards(kind);
    const selectedIndex = Math.floor(Math.random() * pool.length);
    const reward = pool[selectedIndex];

    this._grantReward(reward, { cost });
    this._setCrateReveal(kind, pool, selectedIndex, reward);
    this._showRewardOverlay(
      reward,
      kind === "legendary" ? this._ui("Legendary Sandik", "Legendary Crate") : this._ui("Mystery Sandik", "Mystery Crate"),
      this._rewardText(reward),
      980,
      2600
    );
    this._showToast(this._rewardText(reward), 1600);
  }

  _useInventoryItem(itemId) {
    const s = this.store.get();
    const items = (s.inventory?.items || []).map((x) => ({ ...x }));
    const idx = items.findIndex((x) => x.id === itemId);
    if (idx < 0) return;

    const item = items[idx];
    if (!item.usable) {
      this._showToast(this._ui("Bu item kullanilamaz", "This item cannot be used"));
      return;
    }
    if (Number(item.qty || 0) <= 0) {
      this._showToast(this._ui("Stok yok", "Out of stock"));
      return;
    }

    const p = { ...(s.player || {}) };
    const currentEnergy = Number(p.energy || 0);
    const maxEnergy = Number(p.energyMax || 100);

    if (currentEnergy >= maxEnergy) {
      this._showToast(this._ui("Enerji full", "Energy is full"));
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

    this._showToast(this._ui(`+${gain} enerji`, `+${gain} energy`));
  }

  async _listInventoryItem(itemId) {
    const s = this.store.get();
    const items = (s.inventory?.items || []).map((x) => ({ ...x }));
    const idx = items.findIndex((x) => String(x.id) === String(itemId));
    if (idx < 0) return;

    const item = items[idx];
    if (!item.marketable) {
      this._showToast(this._ui("Bu item pazara konamaz", "This item cannot be listed"));
      return;
    }
    if (Number(item.qty || 0) <= 0) {
      this._showToast(this._ui("Stok yok", "Out of stock"));
      return;
    }

      const qtyRaw = window.prompt(this._ui(`Kac adet satmak istiyorsun? (Max ${Number(item.qty || 0)})`, `How many do you want to list? (Max ${Number(item.qty || 0)})`), "1");
    if (qtyRaw === null) return;

    const qty = clamp(parseInt(qtyRaw, 10) || 0, 1, Number(item.qty || 0));
    if (qty <= 0) {
      this._showToast(this._ui("Gecersiz adet", "Invalid quantity"));
      return;
    }

    const defaultPrice = Number(item.marketPrice || item.sellPrice || 10);

    const priceRaw = window.prompt(
      this._ui(
        "Birim satis fiyatini gir.\nSerbest piyasa: istedigin fiyatla listeleyebilirsin.",
        "Enter the unit sale price.\nOpen market: you can list it for any price."
      ),
      String(defaultPrice)
    );
    if (priceRaw === null) return;

    const price = Math.max(1, parseInt(priceRaw, 10) || 0);

    try {
      const json = await fetchBackendJson("/public/market/list-inventory", {
        method: "POST",
        body: JSON.stringify({
          item_key: String(item.id),
          quantity: qty,
          price_yton: price,
        }),
      });
      const row = json?.item || null;
      const marketBusiness = json?.business || null;
      const inventoryItemId = String(json?.inventory_item_id || "");
      if (!row || !marketBusiness?.id) {
        throw new Error(this._ui("Ilan olusturulamadi", "Listing could not be created"));
      }

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
          type: String(marketBusiness.business_type || "blackmarket"),
          icon: "BM",
          imageKey: "blackmarket",
          imageSrc: "./src/assets/BlackMarket.png",
          name: marketBusiness.name || "Black Market",
          ownerId: String(this._getTelegramId() || window.tcGetProfileKey?.() || ""),
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
        icon: item.icon || "IT",
        imageKey: item.imageKey || "",
        imageSrc: item.imageSrc || item.image || "",
        itemName: item.name,
        kind: this._inventoryKindFor(item),
        rarity: item.rarity || "common",
        stock: qty,
        price,
        energyGain: Number(item.energyGain || 0),
        usable: !!item.usable,
        desc: item.desc || this._ui("Envanter urunu", "Inventory item"),
        inventoryItemId: inventoryItemId,
        businessId: String(marketBusiness.id),
        serverManaged: true,
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

      this._showToast(this._ui(`${qty} adet pazara kondu`, `${qty} items listed`));
    } catch (err) {
      console.error("list_inventory_item error:", err);
      this._showToast(err?.message || this._ui("Item pazara konamadi", "Item could not be listed"));
    }
  }

  async _buyMarketItem(shopId, itemId) {
    const s = this.store.get();
    const listings = (s.market?.listings || []).map((x) => ({ ...x }));
    const items = (s.inventory?.items || []).map((x) => ({ ...x }));
    const idx = listings.findIndex((x) => String(x.id) === String(itemId) && String(x.shopId) === String(shopId));
    if (idx < 0) {
      this._showToast(this._ui("Urun bulunamadi", "Item was not found"));
      return;
    }

    const listing = listings[idx];
    const price = Number(listing.price || 0);
    if (Number(listing.stock || 0) <= 0) {
      this._showToast(this._ui("Stok tukendi", "Out of stock"));
      return;
    }

    if (this._isBackendManagedMarketListing(listing)) {
      try {
        const json = await fetchBackendJson("/public/market/buy", {
          method: "POST",
          body: JSON.stringify({
            listing_id: String(listing.id),
            quantity: 1,
          }),
        });

        const purchased = json?.item || null;
        const unitPrice = Math.max(1, Number(json?.unit_price || price || 1));
        const buyerCoins = Math.max(0, Number(json?.buyer_coins ?? (Number(s.coins || 0) - unitPrice)));
        const remainingStock = Math.max(0, Number(json?.remaining_stock ?? (Number(listing.stock || 0) - 1)));
        const state2 = this.store.get();
        const listings2 = (state2.market?.listings || []).map((x) => ({ ...x }));
        const items2 = (state2.inventory?.items || []).map((x) => ({ ...x }));
        const shops = (state2.market?.shops || []).map((x) => ({ ...x }));
        const salesHistory = (state2.market?.salesHistory || []).map((x) => ({ ...x }));
        const idx2 = listings2.findIndex((x) => String(x.id) === String(itemId) && String(x.shopId) === String(shopId));
        const targetListing = idx2 >= 0 ? listings2[idx2] : { ...listing };

        if (!purchased?.name) {
          throw new Error(this._ui("Pazar verisi eksik", "Market response is incomplete"));
        }

        if (remainingStock <= 0 && idx2 >= 0) listings2.splice(idx2, 1);
        else {
          targetListing.stock = remainingStock;
          if (idx2 >= 0) listings2[idx2] = targetListing;
        }

        const existing = items2.find(
          (x) =>
            String(x.id || "") === String(purchased.itemKey || "") ||
            String(x.name || "").toLowerCase() === String(purchased.name || "").toLowerCase()
        );

        if (existing) {
          existing.qty = Number(existing.qty || 0) + 1;
        } else {
          items2.unshift({
            id: String(purchased.itemKey || "market_buy_" + Date.now()),
            kind: purchased.kind || this._inventoryKindFor(targetListing),
            icon: purchased.icon || targetListing.icon || "IT",
            imageKey: purchased.imageKey || targetListing.imageKey || "",
            imageSrc: purchased.imageSrc || targetListing.imageSrc || "",
            name: purchased.name || targetListing.itemName,
            rarity: purchased.rarity || targetListing.rarity || "common",
            qty: 1,
            usable: !!purchased.usable,
            sellable: purchased.sellable !== false,
            marketable: purchased.marketable !== false,
            energyGain: Number(purchased.energyGain || targetListing.energyGain || 0),
            sellPrice: Math.max(1, Number(purchased.sellPrice || Math.floor(unitPrice * 0.7))),
            marketPrice: unitPrice,
            desc: purchased.desc || targetListing.desc || this._ui("Pazardan alindi.", "Bought from the market."),
          });
        }

        salesHistory.unshift({
          id: "sale_" + Date.now(),
          shopId,
          itemName: purchased.name || targetListing.itemName,
          qty: 1,
          price: unitPrice,
          soldAt: Date.now(),
        });
        if (salesHistory.length > 240) salesHistory.length = 240;

        for (const shop of shops) {
          shop.totalListings = listings2.filter((x) => x.shopId === shop.id).length;
          const stats = salesHistory
            .filter((x) => x.shopId === shop.id)
            .reduce(
              (acc, row) => {
                acc.units += Number(row.qty || 0);
                acc.revenue += Number(row.qty || 0) * Number(row.price || 0);
                acc.lastSaleAt = Math.max(acc.lastSaleAt, Number(row.soldAt || 0));
                return acc;
              },
              { units: 0, revenue: 0, lastSaleAt: 0 }
            );
          shop.totalSold = stats.units;
          shop.totalRevenue = stats.revenue;
          shop.lastSaleAt = stats.lastSaleAt;
        }

        this.store.set({
          coins: buyerCoins,
          inventory: {
            ...(state2.inventory || {}),
            items: items2,
          },
          market: {
            ...(state2.market || {}),
            shops,
            listings: listings2,
            salesHistory,
          },
        });

        this._showToast(this._ui(`${purchased.name || targetListing.itemName || "Urun"} satin alindi`, `${purchased.name || targetListing.itemName || "Item"} purchased`));
      } catch (err) {
        console.error("market_buy error:", err);
        this._showToast(err?.message || this._ui("Satin alma basarisiz", "Purchase failed"));
      }
      return;
    }

    if (Number(s.coins || 0) < price) {
      this._showToast(this._ui("Yetersiz yton", "Not enough yton"));
      return;
    }

    listing.stock = Math.max(0, Number(listing.stock || 0) - 1);
    if (listing.stock <= 0) listings.splice(idx, 1);
    else listings[idx] = listing;

    const existing = items.find((x) => String(x.name || "").toLowerCase() === String(listing.itemName || "").toLowerCase());
    if (existing) existing.qty = Number(existing.qty || 0) + 1;
    else {
      items.unshift({
        id: "market_buy_" + Date.now(),
        kind: this._inventoryKindFor(listing),
        icon: listing.icon || "IT",
        imageKey: listing.imageKey || "",
        imageSrc: listing.imageSrc || "",
        name: listing.itemName,
        rarity: listing.rarity || "common",
        qty: 1,
        usable: !!listing.usable,
        sellable: true,
        marketable: true,
        energyGain: Number(listing.energyGain || 0),
        sellPrice: Math.max(1, Math.floor(price * 0.7)),
        marketPrice: price,
        desc: listing.desc || this._ui("Pazardan alindi.", "Bought from the market."),
      });
    }

    const shops = (s.market?.shops || []).map((x) => ({ ...x }));
    const salesHistory = (s.market?.salesHistory || []).map((x) => ({ ...x }));
    salesHistory.unshift({
      id: "sale_" + Date.now(),
      shopId,
      itemName: listing.itemName,
      qty: 1,
      price,
      soldAt: Date.now(),
    });
    if (salesHistory.length > 240) salesHistory.length = 240;

    for (const shop of shops) {
      shop.totalListings = listings.filter((x) => x.shopId === shop.id).length;
      const stats = salesHistory
        .filter((x) => x.shopId === shop.id)
        .reduce(
          (acc, row) => {
            acc.units += Number(row.qty || 0);
            acc.revenue += Number(row.qty || 0) * Number(row.price || 0);
            acc.lastSaleAt = Math.max(acc.lastSaleAt, Number(row.soldAt || 0));
            return acc;
          },
          { units: 0, revenue: 0, lastSaleAt: 0 }
        );
      shop.totalSold = stats.units;
      shop.totalRevenue = stats.revenue;
      shop.lastSaleAt = stats.lastSaleAt;
    }

    this.store.set({
      coins: Math.max(0, Number(s.coins || 0) - price),
      inventory: {
        ...(s.inventory || {}),
        items,
      },
      market: {
        ...(s.market || {}),
        shops,
        listings,
        salesHistory,
      },
    });

    this._showToast(this._ui(`${listing.itemName || "Urun"} satin alindi`, `${listing.itemName || "Item"} purchased`));
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
      imageKey: biz.imageKey || this._businessArt(biz.type)?.imageKey || "",
      imageSrc: biz.imageSrc || this._businessArt(biz.type)?.imageSrc || "",
      name: biz.name,
      ownerId: String(biz.ownerId || s.player?.id || "player_main"),
      ownerName: String(biz.ownerName || s.player?.username || "Player"),
      online: true,
      theme: biz.theme || biz.type,
      rating: 5,
      totalListings: 0,
      totalSold: 0,
      totalRevenue: 0,
      lastSaleAt: 0,
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
      this._showToast(this._ui("Urun stogu yok", "Product is out of stock"));
      return;
    }

    const p = { ...(s.player || {}) };
    const currentEnergy = Number(p.energy || 0);
    const maxEnergy = Number(p.energyMax || 100);
    const gain = Math.min(Number(product.energyGain || 0), Math.max(0, maxEnergy - currentEnergy));

    if (gain <= 0) {
      this._showToast(this._ui("Enerji full", "Energy is full"));
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
        this._showToast(this._ui(`+${gain} enerji`, `+${gain} energy`));
  }
  
  _createPendingProduction(products = [], totalDaily = 50) {
    const safeProducts = (products || []).map((p) => ({ ...p }));
    if (!safeProducts.length) return [];

    const rows = safeProducts.map((p) => ({ productId: p.id, qty: 0 }));
    const ranked = safeProducts
      .map((p, idx) => ({ ...p, _index: idx, _price: Math.max(1, Number(p.price || 1)) }))
      .sort((a, b) => a._price - b._price);
    const weights = ranked.map((p, idx) => ({
      index: p._index,
      weight: Math.max(1, Math.pow(ranked.length - idx, 2)),
    }));
    const totalWeight = weights.reduce((sum, row) => sum + row.weight, 0);

    for (let i = 0; i < Math.max(0, Number(totalDaily || 0)); i += 1) {
      let roll = Math.random() * totalWeight;
      let picked = weights[weights.length - 1]?.index || 0;
      for (const row of weights) {
        roll -= row.weight;
        if (roll <= 0) {
          picked = row.index;
          break;
        }
      }
      rows[picked].qty += 1;
    }
    return rows.filter((row) => Number(row.qty || 0) > 0);
  }

  _refreshBusinessProduction() {
    const s = this.store.get();
    const now = Date.now();
    const day = todayKey();

    const owned = (s.businesses?.owned || []).map((biz) => ({
      ...biz,
      products: (biz.products || []).map((p) => ({ ...p })),
      pendingProduction: (biz.pendingProduction || []).map((p) => ({ ...p })),
    }));

    let changed = false;

    for (const biz of owned) {
      if (!Array.isArray(biz.products) || !biz.products.length) continue;

      const pendingTotal = (biz.pendingProduction || []).reduce((sum, row) => sum + Number(row.qty || 0), 0);

      if (String(biz.productionDayKey || '') !== day) {
        biz.productionDayKey = day;
        biz.productionReadyAt = now;
        biz.productionClaimUntil = now + PRODUCTION_CLAIM_MS;
        biz.productionCollectedAt = 0;
        biz.productionMissedAt = 0;
        biz.pendingProduction = this._createPendingProduction(biz.products, Number(biz.dailyProduction || 50));
        changed = true;
        continue;
      }

      if (pendingTotal > 0 && Number(biz.productionClaimUntil || 0) > 0 && now > Number(biz.productionClaimUntil || 0)) {
        biz.pendingProduction = [];
        biz.productionMissedAt = now;
        biz.productionClaimUntil = 0;
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

    const biz = owned.find((b) => String(b.id) === String(bizId));
    if (!biz) return;

    const pendingTotal = (biz.pendingProduction || []).reduce((sum, row) => sum + Number(row.qty || 0), 0);
    if (pendingTotal <= 0) {
      this._showToast(this._ui('Toplanacak uretim yok', 'No production to collect'));
      return;
    }

    if (Number(biz.productionClaimUntil || 0) > 0 && now > Number(biz.productionClaimUntil || 0)) {
      biz.pendingProduction = [];
      biz.productionMissedAt = now;
      biz.productionClaimUntil = 0;
      this.store.set({ businesses: { ...(s.businesses || {}), owned } });
      this._showToast(this._ui('1 saatlik toplama hakki kacti', 'The 1-hour collection window was missed'));
      return;
    }

    for (const row of biz.pendingProduction || []) {
      const product = (biz.products || []).find((p) => String(p.id) === String(row.productId));
      if (!product) continue;
      product.qty = Number(product.qty || 0) + Number(row.qty || 0);
    }

    biz.stock = (biz.products || []).reduce((sum, p) => sum + Number(p.qty || 0), 0);
    biz.pendingProduction = [];
    biz.productionCollectedAt = now;
    biz.productionClaimUntil = 0;

    this.store.set({
      businesses: {
        ...(s.businesses || {}),
        owned,
      },
    });

    this._showToast(this._ui(fmtNum(pendingTotal) + ' urun toplandi', this._num(pendingTotal) + ' products collected'));
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
      this._showToast(this._ui("Stok yok", "Out of stock"));
      return;
    }

    const maxQty = Number(product.qty || 0);
    const qtyRaw = window.prompt(this._ui(`Kac adet satmak istiyorsun? (Max ${maxQty})`, `How many do you want to list? (Max ${maxQty})`), "1");
    if (qtyRaw === null) return;

    const qty = clamp(parseInt(qtyRaw, 10) || 0, 1, maxQty);
    if (qty <= 0) {
      this._showToast(this._ui("Gecersiz adet", "Invalid quantity"));
      return;
    }

    const defaultPrice = Number(product.price || 10);

    const priceRaw = window.prompt(
      this._ui(
        "Birim satis fiyatini gir.\nSerbest piyasa: istedigin fiyatla listeleyebilirsin.",
        "Enter the unit sale price.\nOpen market: you can list it for any price."
      ),
      String(defaultPrice)
    );
    if (priceRaw === null) return;

    const price = Math.max(1, parseInt(priceRaw, 10) || 0);

    try {
      const json = await fetchBackendJson("/public/market/list-business-product", {
        method: "POST",
        body: JSON.stringify({
          business_id: String(bizId),
          business_product_id: String(productId),
          quantity: qty,
          price_yton: price,
        }),
      });
      const row = json?.item || null;
      if (!row) {
        throw new Error(this._ui("Ilan olusturulamadi", "Listing could not be created"));
      }

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
          imageKey: biz.imageKey || this._businessArt(biz.type)?.imageKey || "",
          imageSrc: biz.imageSrc || this._businessArt(biz.type)?.imageSrc || "",
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
        icon: product.icon || "IT",
        imageKey: product.imageKey || "",
        imageSrc: product.imageSrc || product.image || "",
        itemName: product.name,
        kind: this._inventoryKindFor(product, biz.type),
        rarity: product.rarity || "common",
        stock: qty,
        price,
        energyGain: Number(product.energyGain || 0),
        usable: Number(product.energyGain || 0) > 0,
        desc: product.desc || this._ui("Isletme urunu", "Business product"),
        businessId: bizId,
        businessProductId: productId,
        serverManaged: true,
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

      this._showToast(this._ui(`${qty} adet satisa cikarildi`, `${qty} items listed`));
    } catch (err) {
      console.error("create_market_listing error:", err);
      this._showToast(err?.message || this._ui("Ilan olusturulamadi", "Listing could not be created"));
    }
  }

  update() {
    const now = Date.now();
    if (this.wheelAnim) {
      const t = clamp((now - this.wheelAnim.start) / Math.max(1, this.wheelAnim.duration), 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.wheelAnim.rotation = this.wheelAnim.from + (this.wheelAnim.to - this.wheelAnim.from) * eased;
      if (t >= 1) {
        const finalReward = this.wheelAnim.reward;
        const trade = this._trade();
        this._setTrade({
          lootWheel: {
            ...(trade.lootWheel || {}),
            rotation: this._rewardRotation(this.wheelAnim.selectedIndex, this.wheelAnim.poolSize),
          },
        });
        this._showRewardOverlay(finalReward, this._ui("Cark Odulu", "Wheel Reward"), this._rewardText(finalReward), 60, 2300);
        this._showToast(this._rewardText(finalReward), 1600);
        this.wheelAnim = null;
      }
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
          case "list_item":
            this._listInventoryItem(h.itemId);
            return;
          case "buy_market_item":
            this._buyMarketItem(h.shopId, h.itemId);
            return;
          case "buy_business":
            this._buyBusiness(h.businessType);
            return;
          case "buy_premium":
            this._buyPremiumMembership(h.businessType);
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
    g.addColorStop(0, "rgba(180,126,36,0.76)");
    g.addColorStop(1, "rgba(108,72,18,0.84)");
    fill = g;
    stroke = "rgba(255,214,120,0.42)";
    txt = "#fff8e8";
  } else if (style === "gold") {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, "rgba(148,104,28,0.72)");
    g.addColorStop(1, "rgba(92,61,14,0.84)");
    fill = g;
    stroke = "rgba(255,214,120,0.38)";
    txt = "#fff5dd";
  } else if (style === "muted") {
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, "rgba(106,82,40,0.32)");
    g.addColorStop(1, "rgba(54,40,18,0.40)");
    fill = g;
    stroke = "rgba(255,214,120,0.18)";
    txt = "rgba(255,244,218,0.86)";
  }

  ctx.fillStyle = fill;
  fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);

  let label = String(text || "");
  ctx.fillStyle = txt;
  ctx.font = "800 11px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxTextWidth = Math.max(18, rect.w - 12);
  while (label.length > 1 && ctx.measureText(label).width > maxTextWidth) {
    label = `${label.slice(0, -2)}…`;
  }
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);

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
    ctx.fillText("S", x + 14, y + 23);

    ctx.fillStyle = text ? "#ffffff" : "rgba(255,255,255,0.40)";
    ctx.font = "13px system-ui";
    ctx.fillText(text || this._ui("Mekan veya urun ara", "Search venue or product"), x + 42, y + 23);
  }

  _drawHeroCard(ctx, x, y, w, h, title, desc, badge, art, glow = "#ff9e46") {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "rgba(8,12,18,0.42)");
    grad.addColorStop(1, "rgba(4,8,14,0.56)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, 24);

    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, x, y, w, h, 24);

    ctx.save();
    roundRectPath(ctx, x, y, w, h, 24);
    ctx.clip();

    ctx.fillStyle = "rgba(255,210,120,0.13)";
    fillRoundRect(ctx, x + 16, y + 14, 104, 24, 12);
    ctx.strokeStyle = "rgba(255,210,120,0.24)";
    strokeRoundRect(ctx, x + 16, y + 14, 104, 24, 12);

    ctx.fillStyle = "#ffe0a0";
    ctx.font = "800 10px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badge || "GUNUN VITRINI", x + 68, y + 26);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 16px system-ui";
    textFit(ctx, title, x + 16, y + 58, w - 102);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    textFit(ctx, desc, x + 16, y + 81, w - 102);

    this._drawArtThumb(ctx, x + w - 84, y + 18, 56, 56, art, title, "", { plain: true });
    ctx.restore();
  }

  _drawMiniCard(ctx, x, y, w, h, title, text, art, accent = "#ffcc66") {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "rgba(10,14,20,0.34)");
    grad.addColorStop(1, "rgba(6,10,16,0.48)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, 20);

    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    strokeRoundRect(ctx, x, y, w, h, 20);

    ctx.save();
    roundRectPath(ctx, x, y, w, h, 20);
    ctx.clip();

    ctx.fillStyle = "#fff";
    ctx.font = "900 14px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    textFit(ctx, title, x + 14, y + 24, w - 66);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    textFit(ctx, text, x + 14, y + 48, w - 66);

    this._drawArtThumb(ctx, x + w - 50, y + 16, 34, 34, art, title, "", { plain: true });
    ctx.restore();
  }

  drawCard(ctx, x, y, w, h) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "rgba(10,14,20,0.36)");
    grad.addColorStop(1, "rgba(6,10,16,0.52)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, 20);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, x, y, w, h, 20);
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
    const leaders = this._marketLeaders();
    const cheapestShop = leaders.cheapestShop;
    const popularShop = leaders.bestSellingShop?.shop || null;
    const popularStats = popularShop ? this._marketShopStats(popularShop.id) : null;

    const deal = [...listings].sort((a, b) => Number(a.price || 0) - Number(b.price || 0))[0];

    this._drawSearchBar(ctx, x, y, w, trade.searchQuery);
    y += 58;

    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      128,
      this._ui("Kara Pazar Merkezi", "Black Market Hub"),
      deal ? this._ui(`${deal.itemName} - ${fmtNum(deal.price)} yton`, `${deal.itemName} - ${fmtNum(deal.price)} yton`) : this._ui("Ekonomi merkezi - vitrin - firsatlar", "Market hub - showcase - deals"),
      this._ui("GUNUN VITRINI", "TODAY'S SHOWCASE"),
      deal || { type: "blackmarket", imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
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
      this._ui("En Ucuz Mekanlar", "Lowest Prices"),
      cheapestShop ? `${cheapestShop.shop.name} - ${fmtNum(cheapestShop.lowest)} yton` : this._ui("Henuz veri yok", "No data yet"),
      cheapestShop?.shop || { type: "blackmarket", imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
      "#dba74d"
    );

    this._drawMiniCard(
      ctx,
      rect2.x,
      rect2.y,
      rect2.w,
      rect2.h,
      this._ui("En Cok Satan Mekan", "Top Selling Venue"),
      popularShop ? `${popularShop.name} • ${this._num(popularStats?.units || 0)} ${this._ui("satis", "sales")}` : this._ui("Henuz veri yok", "No data yet"),
      popularShop || { type: popularShop?.type || "brothel" },
      "#ffcc66"
    );

    y += 122;

    const rect3 = { x, y, w: colW, h: 110 };
    const rect4 = { x: x + colW + gap, y, w: colW, h: 110 };
    this.hitButtons.push({ rect: rect3, action: "go_tab", value: "loot" });
    this.hitButtons.push({ rect: rect4, action: "free_spin" });

    this._drawMiniCard(ctx, rect3.x, rect3.y, rect3.w, rect3.h, this._ui("Sandik Firsatlari", "Crate Deals"), this._ui("Mystery Crate - Premium sandiklar", "Mystery crate - premium drops"), { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" }, "#d49a42");
    this._drawMiniCard(
      ctx,
      rect4.x,
      rect4.y,
      rect4.w,
      rect4.h,
      this._ui("Gunluk Cark", "Daily Wheel"),
      this._isFreeSpinReady() ? this._ui("Hazir - simdi cevir", "Ready - spin now") : this._ui("Bugun kullanildi", "Used today"),
      this._isFreeSpinReady() ? { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" } : { imageSrc: "./src/assets/bonus.png" },
      this._isFreeSpinReady() ? "#ffcc66" : "#b68d4f"
    );

    y += 126;

    this._drawSectionTitle(ctx, x, y, this._ui("Hizli Gecis", "Quick Access"), this._ui("En cok kullanilan bolumler", "Most used sections"));
    y += 26;

    const buttons = [
      { text: this._ui("Isletmelerim", "Businesses"), value: "businesses", style: "gold" },
      { text: "Envanter", value: "inventory", style: "muted" },
      { text: this._ui("Sandik ve Cark", "Crates and Wheels"), value: "loot", style: "gold" },
      { text: this._ui("Satin Al", "Buy"), value: "buy", style: "muted" },
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
    const compact = w <= 420;
    const productRowH = compact ? 62 : 54;
    const productRowStep = compact ? 70 : 62;

    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      120,
      this._ui("Isletmelerim", "Businesses"),
      this._ui(`${fmtNum(businesses.length)} isletme - yonetim paneli`, `${fmtNum(businesses.length)} businesses - owner panel`),
      this._ui("SAHIP MODU", "OWNER MODE"),
      businesses[0] || { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
      "#ffcc66"
    );
    y += 132;

    if (!businesses.length) {
      return this._drawEmptyState(ctx, x, y, w, "MK", this._ui("Henuz isletmen yok.", "You do not own a business yet."));
    }

    for (const biz of businesses) {
      const products = biz.products || [];
      const cardH = 122 + products.length * productRowStep;
      const infoMaxWidth = Math.max(108, w - (compact ? 188 : 198));

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, x, y, w, cardH, 20);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      strokeRoundRect(ctx, x, y, w, cardH, 20);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._drawArtThumb(ctx, x + 14, y + 14, 56, 56, biz, biz.name || this._ui("Isletme", "Business"), biz.type);

      ctx.fillStyle = "#fff";
      ctx.font = "900 15px system-ui";
      textFit(ctx, biz.name || this._ui("Isletme", "Business"), x + 82, y + 24, infoMaxWidth);

      const pendingCount = (biz.pendingProduction || []).reduce((sum, row) => sum + Number(row.qty || 0), 0);
      const remainMs = Math.max(0, Number(biz.productionClaimUntil || 0) - Date.now());
      const remainMinutes = Math.ceil(remainMs / (60 * 1000));
      const collectedToday = String(biz.productionDayKey || "") === todayKey() && Number(biz.productionCollectedAt || 0) > 0;
      const missedToday = String(biz.productionDayKey || "") === todayKey() && Number(biz.productionMissedAt || 0) > 0;
      const productionLine = pendingCount > 0
        ? this._ui(`Hazir uretim ${this._num(pendingCount)} - ${Math.max(0, remainMinutes)} dk kaldi`, `Ready stock ${this._num(pendingCount)} - ${Math.max(0, remainMinutes)} min left`)
        : collectedToday
          ? this._ui("Bugunku batch toplandi", "Today's batch was collected")
          : missedToday
            ? this._ui("1 saatlik toplama hakki kacirildi", "The 1-hour collection window was missed")
            : this._ui("Yarin yeni batch acilacak", "A new batch will open tomorrow");

      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "12px system-ui";
      textFit(
        ctx,
        this._ui(`${this._typeLabel(biz.type)} - Gunluk ${this._num(biz.dailyProduction)} - Stok ${this._num(biz.stock)}`, `${this._typeLabel(biz.type)} - Daily ${this._num(biz.dailyProduction)} - Stock ${this._num(biz.stock)}`),
        x + 82,
        y + 46
        ,
        infoMaxWidth
      );

      ctx.fillStyle = pendingCount > 0 ? "rgba(255,209,120,0.95)" : "rgba(255,255,255,0.48)";
      ctx.font = "11px system-ui";
      textFit(ctx, productionLine, x + 82, y + 64, infoMaxWidth);

      const collectRect = { x: x + w - (compact ? 96 : 102), y: y + 14, w: compact ? 80 : 86, h: 30 };
      this.hitButtons.push({ rect: collectRect, action: "collect_business", bizId: biz.id });
      this._drawButton(ctx, collectRect, this._ui("Topla", "Collect"), pendingCount > 0 ? "gold" : "muted");

      let rowY = y + 82;
      for (const p of products) {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        fillRoundRect(ctx, x + 12, rowY, w - 24, productRowH, 14);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        strokeRoundRect(ctx, x + 12, rowY, w - 24, productRowH, 14);

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        this._drawArtThumb(ctx, x + 18, rowY + 9, 38, 38, p, p.name || this._ui("Urun", "Item"), biz.type);

        const listRect = {
          x: x + w - (compact ? 70 : 76),
          y: rowY + Math.floor((productRowH - 24) / 2),
          w: compact ? 50 : 56,
          h: 24,
        };
        const useRect = {
          x: listRect.x - (compact ? 50 : 54),
          y: listRect.y,
          w: compact ? 44 : 48,
          h: 24,
        };
        const textStartX = x + 66;
        const textMaxWidth = Math.max(86, useRect.x - textStartX - 10);

        ctx.fillStyle = "#fff";
        ctx.font = "900 13px system-ui";
        textFit(ctx, p.name || this._ui("Urun", "Item"), textStartX, rowY + 18, textMaxWidth);

        let rarityLabel = String(p.rarity || "common").toUpperCase();
        ctx.fillStyle = rarityColor(p.rarity);
        ctx.font = "800 9px system-ui";
        while (rarityLabel.length > 1 && ctx.measureText(rarityLabel).width > 60) {
          rarityLabel = rarityLabel.slice(0, -1);
        }
        ctx.textAlign = "right";
        ctx.fillText(rarityLabel, useRect.x - 8, rowY + 18);
        ctx.textAlign = "left";

        ctx.fillStyle = "rgba(255,255,255,0.70)";
        ctx.font = "11px system-ui";
        textFit(
          ctx,
          this._ui(`Stok ${fmtNum(p.qty)} - Serbest piyasa`, `Stock ${fmtNum(p.qty)} - Open market`),
          textStartX,
          rowY + 39,
          textMaxWidth
        );

        this.hitButtons.push({ rect: useRect, action: "use_business_product", bizId: biz.id, productId: p.id });
        this.hitButtons.push({ rect: listRect, action: "sell_business_product", bizId: biz.id, productId: p.id });

        this._drawButton(ctx, useRect, this._ui("Kullan", "Use"), "gold");
        this._drawButton(ctx, listRect, this._ui("Listele", "List"), "muted");

        rowY += productRowStep;
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
      { key: "all", label: this._ui("Tumu", "All") },
      { key: "consumable", label: this._ui("Enerji", "Energy") },
      { key: "girls", label: this._ui("Kadin", "Girls") },
      { key: "goods", label: this._ui("Urun", "Goods") },
      { key: "rare", label: this._ui("Nadir", "Rare") },
    ];

    let fx = x;
    for (const f of filters) {
      const rect = { x: fx, y, w: 70, h: 30 };
      this.hitButtons.push({ rect, action: "inventory_filter", value: f.key });
      this._drawButton(ctx, rect, f.label, trade.selectedInventoryCategory === f.key ? "primary" : "muted");
      fx += 76;
    }
    y += 42;

    let items = this._inventoryViewItems();
    if (trade.selectedInventoryCategory !== "all") {
      items = items.filter((x) => this._inventoryKindFor(x, x._businessType) === trade.selectedInventoryCategory);
    }
    if (trade.searchQuery) {
      const q = trade.searchQuery.toLowerCase();
      items = items.filter((x) => String(x.name || "").toLowerCase().includes(q));
    }

    if (!items.length) {
      return this._drawEmptyState(ctx, x, y, w, "IT", this._ui("Bu filtrede item yok.", "No items match this filter."));
    }

    for (const item of items) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, x, y, w, 108, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      strokeRoundRect(ctx, x, y, w, 108, 18);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._drawArtThumb(ctx, x + 14, y + 14, 52, 52, item, item.name || "Item");

      ctx.fillStyle = "#fff";
      ctx.font = "900 14px system-ui";
      textFit(ctx, item.name || "Item", x + 78, y + 22, w - 92);

      ctx.fillStyle = rarityColor(item.rarity);
      ctx.font = "800 10px system-ui";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), x + 78, y + 38);

      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.font = "11px system-ui";
      const basePrice = Number(item.sellPrice || item.price || 0);
      const stockLine = item._sourceType === "business_product"
        ? this._ui(`Adet ${fmtNum(item.qty)} - Serbest piyasa`, `Qty ${fmtNum(item.qty)} - Open market`)
        : this._ui(`Adet ${fmtNum(item.qty)} - Serbest liste`, `Qty ${fmtNum(item.qty)} - Open listing`);
      textFit(ctx, stockLine, x + 78, y + 56, w - 96);

      const itemDesc = this._itemDesc(item);
      if (itemDesc) {
        textFit(ctx, itemDesc, x + 78, y + 74, w - 96);
      }

      const btnY = y + 78;
      let bx = x + 14;

      if (item.usable) {
        const rect = { x: bx, y: btnY + 2, w: 54, h: 24 };
        this.hitButtons.push(
          item._sourceType === "business_product"
            ? { rect, action: "use_business_product", bizId: item._bizId, productId: item._productId }
            : { rect, action: "use_item", itemId: item.id }
        );
        this._drawButton(ctx, rect, this._ui("Kullan", "Use"), "gold");
        bx += 60;
      }

      if (item.marketable) {
        const rect = { x: bx, y: btnY + 2, w: 58, h: 24 };
        this.hitButtons.push(
          item._sourceType === "business_product"
            ? { rect, action: "sell_business_product", bizId: item._bizId, productId: item._productId }
            : { rect, action: "list_item", itemId: item.id }
        );
        this._drawButton(ctx, rect, this._ui("Listele", "List"), "muted");
      }

      y += 120;
    }

    return y;
  }

  _renderLoot(ctx, x, y, w) {
    const trade = this._trade();

    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      124,
      this._ui("Cark ve Oduller", "Wheels and Rewards"),
      this._isFreeSpinReady()
        ? this._ui(`${this._freeSpinRemaining()}/3 reklamli spin hazir`, `${this._freeSpinRemaining()}/3 ad spins are ready`)
        : this._ui("Bugunluk 3 reklamli spin tamamlandi", "All 3 daily ad spins are used"),
      this._ui("PREMIUM ODULLER", "PREMIUM LOOT"),
      { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
      "#ffcc66"
    );

    const freeRect = { x: x + 14, y: y + 76, w: 116, h: 34 };
    const premiumRect = { x: x + 138, y: y + 76, w: 122, h: 34 };
    this.hitButtons.push({ rect: freeRect, action: "free_spin" });
    this.hitButtons.push({ rect: premiumRect, action: "premium_spin" });
    this._drawButton(ctx, freeRect, this._isFreeSpinReady() ? this._ui("Reklam Izle", "Watch Ad") : this._ui("Hak Bitti", "No Spins"), this._isFreeSpinReady() ? "primary" : "muted");
    this._drawButton(ctx, premiumRect, this._ui("Premium 1000", "Premium 1000"), "gold");

    y += 138;

    y += this._drawWheel(ctx, x, y, w, trade) + 14;

    const gap = 10;
    const colW = Math.floor((w - gap) / 2);
    const c1 = { x, y, w: colW, h: 112 };
    const c2 = { x: x + colW + gap, y, w: colW, h: 112 };
    this.hitButtons.push({ rect: c1, action: "buy_crate", value: "mystery" });
    this.hitButtons.push({ rect: c2, action: "buy_crate", value: "legendary" });

    this._drawMiniCard(
      ctx,
      c1.x,
      c1.y,
      c1.w,
      c1.h,
      this._ui("Mystery Sandik", "Mystery Crate"),
      this._ui("65 yton - satin al ve aninda ac", "65 yton - buy and open instantly"),
      { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
      "#d39a43"
    );
    this._drawMiniCard(
      ctx,
      c2.x,
      c2.y,
      c2.w,
      c2.h,
      this._ui("Legendary Sandik", "Legendary Crate"),
      this._ui("140 yton - premium odul havuzu", "140 yton - premium reward pool"),
      { imageSrc: "./src/assets/bonus.png" },
      "#ffcc66"
    );

    y += 126;

    if (trade.crateReveal) {
      y += this._drawCrateReveal(ctx, x, y, w, trade.crateReveal) + 14;
    }

    this.drawCard(ctx, x, y, w, 94);
    ctx.fillStyle = "#fff";
    ctx.font = "900 14px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(this._ui("Odul Havuzu", "Reward Pool"), x + 14, y + 24);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText("YTON - Enerji - Street Whiskey - White Widow - Scarlett Blaze - Barrett M82", x + 14, y + 52);
    ctx.fillText(this._ui("Gosterilen kart ve verilen odul ayni veri kaynagini kullanir.", "Shown card and granted reward use the same data source."), x + 14, y + 72);

    y += 108;
    return y;
  }

  _renderMarket(ctx, x, y, w) {
    const trade = this._trade();

    this._drawSearchBar(ctx, x, y, w, trade.searchQuery);
    y += 58;

    const filters = [
      { key: "all", label: this._ui("Tumu", "All") },
      { key: "nightclub", label: "Club" },
      { key: "coffeeshop", label: "Coffee" },
      { key: "brothel", label: this._ui("Genelev", "Brothel") },
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
      return this._drawEmptyState(ctx, x, y, w, "MK", this._ui("Bu filtrede dukkan yok.", "No shops match this filter."));
    }

    for (const shop of shops) {
      const shopListings = this._getListingsByShopId(shop.id);
      const lowest = shopListings.length
        ? shopListings.reduce((m, l) => Math.min(m, Number(l.price || 0)), Number.MAX_SAFE_INTEGER)
        : 0;
      const stats = this._marketShopStats(shop.id);

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, x, y, w, 102, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      strokeRoundRect(ctx, x, y, w, 102, 18);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._drawArtThumb(ctx, x + 14, y + 14, 54, 54, shop, shop.name || this._ui("Dukkan", "Shop"), shop.type);

      ctx.fillStyle = "#fff";
      ctx.font = "900 14px system-ui";
      textFit(ctx, shop.name || this._ui("Dukkan", "Shop"), x + 80, y + 22, w - 188);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      textFit(ctx, this._ui(`${this._typeLabel(shop.type)} - Sahip ${shop.ownerName || "?"}`, `${this._typeLabel(shop.type)} - Owner ${shop.ownerName || "?"}`), x + 80, y + 42, w - 198);
      textFit(ctx, this._ui(`Urun ${this._num(shop.totalListings)} - Satis ${this._num(stats.units)} - En dusuk ${lowest ? this._num(lowest) : "-"}`, `Items ${this._num(shop.totalListings)} - Sales ${this._num(stats.units)} - Lowest ${lowest ? this._num(lowest) : "-"}`), x + 80, y + 60, w - 198);

      const enterRect = { x: x + w - 92, y: y + 66, w: 78, h: 24 };
      this.hitButtons.push({ rect: enterRect, action: "open_shop", shopId: shop.id });
      this._drawButton(ctx, enterRect, this._ui("Gir", "Enter"), "gold");

      y += 114;
    }

    return y;
  }

  _renderShopView(ctx, x, y, w) {
    const trade = this._trade();
    const shop = this._getShopById(trade.selectedShopId);

    if (!shop) {
      return this._drawEmptyState(ctx, x, y, w, "X", this._ui("Dukkan bulunamadi.", "Shop was not found."));
    }

    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      108,
      shop.name || this._ui("Dukkan", "Shop"),
      this._ui(`${this._typeLabel(shop.type)} - Sahip ${shop.ownerName || "?"} - Puan ${shop.rating || 0}`, `${this._typeLabel(shop.type)} - Owner ${shop.ownerName || "?"} - Rating ${shop.rating || 0}`),
      shop.online ? this._ui("AKTIF", "ONLINE") : this._ui("PASIF", "OFFLINE"),
      shop,
      "#ffcc66"
    );
    y += 120;

    const listings = this._getListingsByShopId(shop.id);

    if (!listings.length) {
      return this._drawEmptyState(ctx, x, y, w, "IT", this._ui("Bu dukkanda urun yok.", "This shop has no items."));
    }

    for (const item of listings) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, x, y, w, 102, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      strokeRoundRect(ctx, x, y, w, 102, 18);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._drawArtThumb(ctx, x + 14, y + 14, 54, 54, item, item.itemName || this._ui("Urun", "Item"), shop.type);

      ctx.fillStyle = "#fff";
      ctx.font = "900 14px system-ui";
      textFit(ctx, item.itemName || this._ui("Urun", "Item"), x + 80, y + 22, w - 180);

      ctx.fillStyle = rarityColor(item.rarity);
      ctx.font = "800 10px system-ui";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), x + 80, y + 40);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      textFit(ctx, this._ui(`Stok ${fmtNum(item.stock)} - Fiyat ${fmtNum(item.price)} yton`, `Stock ${fmtNum(item.stock)} - Price ${fmtNum(item.price)} yton`), x + 80, y + 60, w - 180);

      const buyRect = { x: x + w - 76, y: y + 67, w: 62, h: 24 };
      this.hitButtons.push({ rect: buyRect, action: "buy_market_item", itemId: item.id, shopId: shop.id });
      this._drawButton(ctx, buyRect, this._ui("Satin Al", "Buy"), "gold");

      y += 114;
    }

    return y;
  }

  _buyPremiumMembership(businessType) {
    const def = this._businessDefByType(businessType);
    if (!def) return;

    if (this._isPremium()) {
      this._showToast(this._ui('Premium zaten aktif', 'Premium is already active'));
      return;
    }

    if (Number(this._wallet().tonBalance || 0) < PREMIUM_COST_TON) {
      this._showToast(this._ui('Premium icin 100 TON gerekli', '100 TON is required for premium'), 2200);
      return;
    }

    const baseName = this._lang() === 'en' ? def.nameEn : def.nameTr;
    const nameRaw = window.prompt(
      this._ui(baseName + ' icin mekan adi gir:', 'Enter a venue name for ' + baseName + ':'),
      baseName
    );
    if (nameRaw === null) return;
    const name = String(nameRaw || baseName).trim() || baseName;

    if (!this._consumeTon(PREMIUM_COST_TON)) {
      this._showToast(this._ui('TON bakiye yetersiz', 'Not enough TON balance'));
      return;
    }

    const s = this.store.get();
    const player = { ...(s.player || {}) };
    player.level = Math.max(50, Number(player.level || 1));
    player.membership = 'premium';
    player.canOwnBusiness = true;
    player.canWithdraw = true;

    const newBusiness = this._createBusinessRecord(businessType, name, 'premium');

    this.store.set({
      premium: true,
      isPremium: true,
      player,
      businesses: {
        ...(s.businesses || {}),
        owned: [newBusiness, ...((s.businesses?.owned || []).map((x) => ({ ...x })))],
      },
    });

    try {
      window.tcActivityFeed?.push?.({
        event: "premium",
        actor: player.username || "Player",
        venueName: name,
        amountTon: PREMIUM_COST_TON,
      });
    } catch (_) {}

    this._pushSystemChat(this._ui((player.username || 'Player') + ' premium aldi ve ' + name + ' mekanini acti.', (player.username || 'Player') + ' purchased premium and unlocked ' + name + '.'));
    this._showToast(this._ui('Premium aktif edildi', 'Premium activated'), 2200);
  }

  _buyBusiness(businessType) {
    const def = this._businessDefByType(businessType);
    if (!def) return;

    if (!this._canOwnBusiness()) {
      this._showToast(this._ui('Bina almak icin premium veya level 50 gerekli', 'Premium or level 50 is required to own a business'), 2200);
      return;
    }

    const s = this.store.get();
    if (Number(s.coins || 0) < Number(def.price || 0)) {
      this._showToast(this._ui('Yetersiz yton', 'Not enough yton'));
      return;
    }

    const baseName = this._lang() === 'en' ? def.nameEn : def.nameTr;
    const nameRaw = window.prompt(
      this._ui(baseName + ' icin isim gir:', 'Enter a name for ' + baseName + ':'),
      baseName
    );
    if (nameRaw === null) return;
    const name = String(nameRaw || baseName).trim() || baseName;

    const newBusiness = this._createBusinessRecord(businessType, name, 'shop');

    this.store.set({
      coins: Math.max(0, Number(s.coins || 0) - Number(def.price || 0)),
      businesses: {
        ...(s.businesses || {}),
        owned: [newBusiness, ...((s.businesses?.owned || []).map((x) => ({ ...x })))],
      },
    });

    this._showToast(this._ui(name + ' satin alindi', name + ' purchased'));
  }

  _renderBuy(ctx, x, y, w) {
    const isPremium = this._isPremium();
    const tonBalance = Number(this._wallet().tonBalance || 0);
    const canOwn = this._canOwnBusiness();
    const defs = Object.entries(this._businessDefs()).map(([type, def]) => ({ type, ...def }));
    const compact = w <= 420;

    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      132,
      this._ui('Satin Al', 'Buy'),
      isPremium
        ? this._ui('Sunucu urunlerin acik. Premium uyelik aktif ve secili bina acildi.', 'Server store is unlocked. Premium membership is active and your selected business is open.')
        : this._ui('Sunucu urunleri icinde 100 TON omurluk premium uyelik bulunur. Bir bina sec ve direkt level 50 ol.', 'Server products include a 100 TON lifetime premium membership. Pick one business and jump straight to level 50.'),
      isPremium ? this._ui('UYELIK AKTIF', 'MEMBERSHIP ON') : this._ui('SERVER URUNLERI', 'SERVER PRODUCTS'),
      { imageKey: 'blackmarket', imageSrc: './src/assets/BlackMarket.png' },
      '#ffcc66'
    );

    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    textFit(ctx, this._ui('TON Bakiye: ', 'TON Balance: ') + fmtTokenAmount(tonBalance), x + 18, y + 104, w - 36);
    textFit(ctx, this._ui('Gunluk uretim: 50 rastgele urun / toplama suresi: 1 saat', 'Daily output: 50 random products / collection window: 1 hour'), x + 18, y + 122, w - 36);
    y += 146;

    this.drawCard(ctx, x, y, w, 104);
    ctx.fillStyle = '#fff';
    ctx.font = '900 15px system-ui';
    ctx.fillText(this._ui('Premium Uyelik', 'Premium Membership'), x + 16, y + 24);
    ctx.fillStyle = 'rgba(255,255,255,0.74)';
    ctx.font = '12px system-ui';
    ctx.fillText(this._ui('• Omurluk uyelik', '• Lifetime membership'), x + 18, y + 48);
    ctx.fillText(this._ui('• Secilen 1 bina hediye', '• 1 chosen business included'), x + 18, y + 66);
    ctx.fillText(this._ui('• Direkt level 50', '• Instant level 50 start'), x + 18, y + 84);
    y += 118;

    for (const def of defs) {
      const cardH = compact ? 138 : 126;
      const detailMaxWidth = Math.max(108, w - (compact ? 176 : 194));
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      fillRoundRect(ctx, x, y, w, cardH, 18);
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      strokeRoundRect(ctx, x, y, w, cardH, 18);

      const title = this._lang() === 'en' ? def.nameEn : def.nameTr;
      this._drawArtThumb(ctx, x + 14, y + 14, 54, 54, def, title, def.type);
      ctx.fillStyle = '#fff';
      ctx.font = '900 14px system-ui';
      textFit(ctx, title, x + 80, y + 22, detailMaxWidth);
      ctx.fillStyle = 'rgba(255,255,255,0.74)';
      ctx.font = '11px system-ui';
      textFit(ctx, this._ui('Normal fiyat ' + this._num(def.price) + ' yton', 'Standard price ' + this._num(def.price) + ' yton'), x + 80, y + 44, detailMaxWidth);
      textFit(ctx, this._ui('Urunler: ', 'Products: ') + def.products.map((p) => p.name).join(' / '), x + 80, y + 62, detailMaxWidth);
      textFit(ctx, this._ui('Gunluk 50 urun, dusuk fiyatlilar daha sik gelir.', 'Daily 50 mixed items, low-price products are more common.'), x + 80, y + 80, detailMaxWidth);

      const premiumRect = { x: x + 14, y: y + (compact ? 102 : 90), w: compact ? 104 : 112, h: 24 };
      this.hitButtons.push({ rect: premiumRect, action: 'buy_premium', businessType: def.type });
      this._drawButton(ctx, premiumRect, isPremium ? this._ui('Uyelik Acik', 'Membership Active') : this._ui('Uyeligi Al', 'Buy Membership'), isPremium ? 'muted' : 'gold');

      const normalRect = { x: premiumRect.x + premiumRect.w + 8, y: premiumRect.y, w: compact ? 86 : 94, h: 24 };
      this.hitButtons.push({ rect: normalRect, action: 'buy_business', businessType: def.type });
      this._drawButton(
        ctx,
        normalRect,
        canOwn ? this._ui('Yton ile Al', 'Buy with Yton') : this._ui('Level 50 Gerek', 'Need Level 50'),
        canOwn ? 'gold' : 'muted'
      );

      y += cardH + 12;
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
    ctx.fillStyle = "#c78c2f";
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
    this._drawButton(ctx, this.hitBack, "X", "muted");

    

    const compactPanel = panelW <= 390;
    let contentTop = panelY + (compactPanel ? 64 : 58);

    if (trade.view === "main") {
      const tabs = [
        { key: "buy", label: this._ui("Satin Al", "Buy") },
        { key: "explore", label: this._ui("Kesfet", "Explore") },
        { key: "businesses", label: this._ui("Isletmelerim", "Businesses") },
        { key: "inventory", label: this._ui("Envanter", "Inventory") },
        { key: "loot", label: this._ui("Carklar", "Wheels") },
        { key: "market", label: this._ui("Pazar", "Market") },
      ];

      const tabHeight = compactPanel ? 32 : 34;
      const tabGapX = compactPanel ? 8 : 10;
      const tabGapY = compactPanel ? 38 : 42;
      let tx = panelX + 16;
      let ty = panelY + (compactPanel ? 60 : 56);
      const limitX = panelX + panelW - 16;

      for (const tab of tabs) {
        const tw = clamp((compactPanel ? 24 : 28) + tab.label.length * (compactPanel ? 6.4 : 7.2), compactPanel ? 72 : 86, compactPanel ? 122 : 138);
        if (tx + tw > limitX) {
          tx = panelX + 16;
          ty += tabGapY;
        }

        const rect = { x: tx, y: ty, w: tw, h: tabHeight };
        this.hitTabs.push({ rect, tab: tab.key });

        const active = trade.activeTab === tab.key;
        this._drawButton(ctx, rect, tab.label, active ? "primary" : "muted");
        tx += tw + tabGapX;
      }

      contentTop = ty + tabHeight + 14;
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

    const renderedHeight = Math.max(0, endY - cursorY);
    this.maxScroll = Math.max(0, renderedHeight + 20 - contentH);
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

    this._drawRewardOverlay(ctx, w, h);
  }
}

export { TradeScene };
export default TradeScene;





