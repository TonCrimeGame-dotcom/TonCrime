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

function textFit(ctx, text, x, y, maxWidth) {
  const value = String(text || "");
  if (!maxWidth || ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }
  let out = value;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  ctx.fillText(`${out}…`, x, y);
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
  const raw = String(reward?.label || reward?.text || reward?.name || "ÖDÜL").replace(/\s+/g, ' ').trim();
  if (!raw) return 'ÖDÜL';
  if (raw.length <= 14) return raw;
  const parts = raw.split(' ');
  return parts.slice(0, 2).join(' ').slice(0, 14);
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
    this.runtimeImages = new Map();
    this.wheelAnim = null;
    this.lastTs = Date.now();
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
    this.lastTs = Date.now();

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

    const imageKey = input.imageKey || input.artKey || input.key || "";
    const imageSrc = input.imageSrc || input.artSrc || input.src || "";
    if (imageKey || imageSrc) return { imageKey, imageSrc };

    const typeArt = this._businessArt(input.type || input.businessType || input.business_type || fallbackType);
    if (typeArt && !input.itemName && !input.name && !input.label && !input.productKey && !input.product_key) return typeArt;

    const raw = `${input.productKey || ""} ${input.product_key || ""} ${input.itemKey || ""} ${input.itemName || ""} ${input.name || ""} ${input.label || ""} ${input.kind || ""}`.toLowerCase();
    if (/(whiskey|champagne|drink|night whiskey|black whiskey|club champagne|premium_champ|whiskey_item)/.test(raw)) {
      return { imageSrc: "./src/assets/drink.png" };
    }
    if (/(white widow|og kush|moon rocks|weed|kush|widow|moon_rocks)/.test(raw)) {
      return { imageSrc: "./src/assets/weed.png" };
    }
    if (/(vip companion|deluxe service|vip girl|companion|service|escort|girl)/.test(raw)) {
      return { imageKey: "xxx", imageSrc: "./src/assets/xxx.jpg" };
    }
    if (/(golden pass|vip pass|pass|bonus)/.test(raw)) {
      return { imageSrc: "./src/assets/bonus.png" };
    }
    if (/(crate|sandık|loot|premium_crate|mystery_crate)/.test(raw)) {
      return { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" };
    }
    return typeArt;
  }

  _resolveArtImage(art, fallbackType = "") {
    const spec = this._itemArt(art, fallbackType);
    if (!spec) return null;
    const assetImg = spec.imageKey ? getImgSafe(this.assets, spec.imageKey) : null;
    if (assetImg) return assetImg;
    return spec.imageSrc ? this._runtimeImage(spec.imageSrc) : null;
  }

  _drawArtThumb(ctx, x, y, w, h, art, fallbackLabel = "", fallbackType = "") {
    const spec = this._itemArt(art, fallbackType) || {};
    const img = this._resolveArtImage(art, fallbackType);
    const r = Math.max(10, Math.min(18, Math.floor(Math.min(w, h) * 0.22)));
    const useContain = /\.png($|\?)/i.test(String(spec.imageSrc || "")) || ["consumable", "goods", "rare"].includes(String(art?.kind || "").toLowerCase());
    const pad = useContain ? Math.max(4, Math.floor(Math.min(w, h) * 0.12)) : 0;

    ctx.save();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.clip();

    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, "rgba(255,190,90,0.16)");
    bg.addColorStop(1, "rgba(22,12,8,0.52)");
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    if (img) {
      if (useContain) drawContainImage(ctx, img, x + pad, y + pad, w - pad * 2, h - pad * 2);
      else drawCoverImage(ctx, img, x, y, w, h);
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

    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, x, y, w, h, r);
  }

  _rewardRotation(index, total) {
    const slice = (Math.PI * 2) / Math.max(1, total);
    return -Math.PI / 2 - ((index + 0.5) * slice);
  }

  _freeSpinRewards() {
    return [
      {
        id: "free_yton_25",
        type: "coins",
        amount: 25,
        text: "+25 yton",
        label: "+25 YTON",
        accent: "#ffca5c",
      },
      {
        id: "free_yton_60",
        type: "coins",
        amount: 60,
        text: "+60 yton",
        label: "+60 YTON",
        accent: "#ffb04b",
      },
      {
        id: "free_energy_15",
        type: "energy",
        amount: 15,
        text: "+15 enerji",
        label: "+15 ENERJİ",
        accent: "#60d0ff",
      },
      {
        id: "free_whiskey",
        type: "item",
        text: "Black Whiskey kazandın",
        label: "BLACK WHISKEY",
        accent: "#f2a657",
        imageSrc: "./src/assets/drink.png",
        item: {
          id: "spin_whiskey_" + Date.now(),
          kind: "consumable",
          icon: "🥃",
          imageSrc: "./src/assets/drink.png",
          name: "Black Whiskey",
          rarity: "common",
          qty: 1,
          usable: true,
          sellable: true,
          marketable: true,
          energyGain: 8,
          sellPrice: 20,
          marketPrice: 28,
          desc: "Gece kulübü içeceği.",
        },
      },
      {
        id: "free_weed",
        type: "item",
        text: "White Widow kazandın",
        label: "WHITE WIDOW",
        accent: "#4ade80",
        imageSrc: "./src/assets/weed.png",
        item: {
          id: "spin_weed_" + Date.now(),
          kind: "goods",
          icon: "🌿",
          imageSrc: "./src/assets/weed.png",
          name: "White Widow",
          rarity: "rare",
          qty: 1,
          usable: true,
          sellable: true,
          marketable: true,
          energyGain: 12,
          sellPrice: 22,
          marketPrice: 36,
          desc: "Coffeeshop ürünü.",
        },
      },
      {
        id: "free_crate",
        type: "item",
        text: "Mystery Crate kazandın",
        label: "MYSTERY CRATE",
        accent: "#c77dff",
        imageKey: "blackmarket",
        item: {
          id: "crate_" + Date.now(),
          kind: "rare",
          icon: "📦",
          imageKey: "blackmarket",
          imageSrc: "./src/assets/BlackMarket.png",
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
  }

  _premiumSpinRewards() {
    return [
      {
        id: "premium_yton_180",
        type: "coins",
        amount: 180,
        text: "+180 yton",
        label: "+180 YTON",
        accent: "#ffca5c",
      },
      {
        id: "premium_energy_30",
        type: "energy",
        amount: 30,
        text: "+30 enerji",
        label: "+30 ENERJİ",
        accent: "#60d0ff",
      },
      {
        id: "premium_gold_pass",
        type: "item",
        text: "Golden Pass kazandın",
        label: "GOLDEN PASS",
        accent: "#ffd45b",
        imageSrc: "./src/assets/bonus.png",
        item: {
          id: "gold_pass_" + Date.now(),
          kind: "rare",
          icon: "👑",
          imageSrc: "./src/assets/bonus.png",
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
      {
        id: "premium_service",
        type: "item",
        text: "Deluxe Service kazandın",
        label: "DELUXE SERVICE",
        accent: "#ff8aa8",
        imageKey: "xxx",
        item: {
          id: "premium_service_" + Date.now(),
          kind: "girls",
          icon: "🌹",
          imageKey: "xxx",
          imageSrc: "./src/assets/xxx.jpg",
          name: "Deluxe Service",
          rarity: "legendary",
          qty: 1,
          usable: true,
          sellable: true,
          marketable: true,
          energyGain: 24,
          sellPrice: 110,
          marketPrice: 160,
          desc: "En üst seviye brothel ürünü.",
        },
      },
      {
        id: "premium_champagne",
        type: "item",
        text: "Premium Champagne kazandın",
        label: "PREMIUM CHAMPAGNE",
        accent: "#f2a657",
        imageSrc: "./src/assets/drink.png",
        item: {
          id: "premium_champ_" + Date.now(),
          kind: "consumable",
          icon: "🍾",
          imageSrc: "./src/assets/drink.png",
          name: "Premium Champagne",
          rarity: "rare",
          qty: 1,
          usable: true,
          sellable: true,
          marketable: true,
          energyGain: 14,
          sellPrice: 34,
          marketPrice: 44,
          desc: "Premium kulüp içkisi.",
        },
      },
      {
        id: "premium_vip",
        type: "item",
        text: "VIP Companion kazandın",
        label: "VIP COMPANION",
        accent: "#ff8aa8",
        imageKey: "xxx",
        item: {
          id: "premium_vip_" + Date.now(),
          kind: "girls",
          icon: "💋",
          imageKey: "xxx",
          imageSrc: "./src/assets/xxx.jpg",
          name: "VIP Companion",
          rarity: "epic",
          qty: 1,
          usable: true,
          sellable: true,
          marketable: true,
          energyGain: 22,
          sellPrice: 70,
          marketPrice: 95,
          desc: "Yüksek enerji itemi.",
        },
      },
    ];
  }

  _crateRewards(kind) {
    if (kind === "legendary") {
      return [
        { id: "crate_l_yton", type: "coins", amount: 120, text: "+120 yton", label: "+120 YTON", accent: "#ffca5c" },
        { id: "crate_l_energy", type: "energy", amount: 26, text: "+26 enerji", label: "+26 ENERJİ", accent: "#60d0ff" },
        { id: "crate_l_goldpass", type: "item", text: "Golden Pass çıktı", label: "GOLDEN PASS", accent: "#ffd45b", imageSrc: "./src/assets/bonus.png", item: { id: "crate_goldpass_" + Date.now(), kind: "rare", icon: "👑", imageSrc: "./src/assets/bonus.png", name: "Golden Pass", rarity: "legendary", qty: 1, usable: false, sellable: true, marketable: false, sellPrice: 250, marketPrice: 0, desc: "Nadir etkinlik ürünü." } },
        { id: "crate_l_service", type: "item", text: "Deluxe Service çıktı", label: "DELUXE SERVICE", accent: "#ff8aa8", imageKey: "xxx", item: { id: "crate_service_" + Date.now(), kind: "girls", icon: "🌹", imageKey: "xxx", imageSrc: "./src/assets/xxx.jpg", name: "Deluxe Service", rarity: "legendary", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 30, sellPrice: 120, marketPrice: 160, desc: "En üst seviye ürün." } },
        { id: "crate_l_champ", type: "item", text: "Premium Champagne çıktı", label: "PREMIUM CHAMPAGNE", accent: "#f2a657", imageSrc: "./src/assets/drink.png", item: { id: "crate_champ_" + Date.now(), kind: "consumable", icon: "🍾", imageSrc: "./src/assets/drink.png", name: "Premium Champagne", rarity: "rare", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 14, sellPrice: 34, marketPrice: 44, desc: "Daha iyi enerji verir." } },
      ];
    }
    return [
      { id: "crate_m_yton", type: "coins", amount: 80, text: "+80 yton", label: "+80 YTON", accent: "#ffca5c" },
      { id: "crate_m_energy", type: "energy", amount: 18, text: "+18 enerji", label: "+18 ENERJİ", accent: "#60d0ff" },
      { id: "crate_m_whiskey", type: "item", text: "Black Whiskey çıktı", label: "BLACK WHISKEY", accent: "#f2a657", imageSrc: "./src/assets/drink.png", item: { id: "crate_whiskey_" + Date.now(), kind: "consumable", icon: "🥃", imageSrc: "./src/assets/drink.png", name: "Black Whiskey", rarity: "common", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 8, sellPrice: 18, marketPrice: 27, desc: "Hızlı enerji ürünü." } },
      { id: "crate_m_weed", type: "item", text: "White Widow çıktı", label: "WHITE WIDOW", accent: "#4ade80", imageSrc: "./src/assets/weed.png", item: { id: "crate_weed_" + Date.now(), kind: "goods", icon: "🍁", imageSrc: "./src/assets/weed.png", name: "White Widow", rarity: "rare", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 12, sellPrice: 22, marketPrice: 36, desc: "Enerji için kullanılabilir." } },
      { id: "crate_m_vip", type: "item", text: "VIP Companion çıktı", label: "VIP COMPANION", accent: "#ff8aa8", imageKey: "xxx", item: { id: "crate_vip_" + Date.now(), kind: "girls", icon: "💋", imageKey: "xxx", imageSrc: "./src/assets/xxx.jpg", name: "VIP Companion", rarity: "epic", qty: 1, usable: true, sellable: true, marketable: true, energyGain: 22, sellPrice: 65, marketPrice: 95, desc: "Yüksek enerji itemi." } },
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

    if (opts.markFreeSpin) {
      nextPatch.trade = {
        ...(s.trade || {}),
        lastFreeSpinDay: todayKey(),
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
    this._setTrade({
      crateReveal: {
        kind,
        pool: pool.map((entry) => ({
          ...entry,
          item: entry.item ? { ...entry.item } : null,
        })),
        selectedIndex,
        reward: reward ? { ...reward, item: reward.item ? { ...reward.item } : null } : null,
        updatedAt: Date.now(),
      },
    });
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

  _drawRewardCard(ctx, x, y, w, h, reward, highlight = false) {
    const accent = reward?.accent || "#f3b35b";
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, highlight ? "rgba(255,201,110,0.24)" : "rgba(10,14,20,0.42)");
    grad.addColorStop(1, highlight ? "rgba(98,52,10,0.30)" : "rgba(6,10,16,0.52)");
    ctx.fillStyle = grad;
    fillRoundRect(ctx, x, y, w, h, 22);
    ctx.strokeStyle = highlight ? "rgba(255,216,134,0.78)" : "rgba(255,255,255,0.10)";
    ctx.lineWidth = highlight ? 1.6 : 1;
    strokeRoundRect(ctx, x, y, w, h, 22);

    this._drawArtThumb(ctx, x + 14, y + 14, 68, h - 28, reward?.item || reward, reward?.label || reward?.text || "ÖDÜL");

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "900 14px system-ui";
    textFit(ctx, reward?.label || reward?.text || "Ödül", x + 94, y + 28, w - 164);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    textFit(ctx, reward?.text || "", x + 94, y + 48, w - 164);

    if (highlight) {
      ctx.fillStyle = accent;
      fillRoundRect(ctx, x + w - 72, y + 14, 56, 24, 12);
      ctx.fillStyle = "#251506";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 10px system-ui";
      ctx.fillText("KAZANILDI", x + w - 44, y + 26);
    }
  }

  _drawWheel(ctx, x, y, w, trade) {
    const wheelState = trade.lootWheel || {};
    const mode = wheelState.mode === "premium" ? "premium" : "free";
    const pool = mode === "premium" ? this._premiumSpinRewards() : this._freeSpinRewards();
    const selectedIndex = Number.isFinite(Number(wheelState.selectedIndex)) ? Number(wheelState.selectedIndex) : 0;
    const rotation = this._getWheelRotation(trade, pool);

    const boxH = 392;
    this.drawCard(ctx, x, y, w, boxH);

    ctx.fillStyle = "#fff";
    ctx.font = "900 16px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(mode === "premium" ? "Premium Çark" : "Günlük Çark", x + 16, y + 28);
    ctx.fillStyle = this.wheelAnim ? "rgba(255,215,120,0.86)" : "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    ctx.fillText(this.wheelAnim ? "Çark dönüyor..." : "Okun gösterdiği dilim birebir ödül verir.", x + 16, y + 48);

    const cx = x + w / 2;
    const cy = y + 160;
    const radius = Math.min(122, Math.floor(Math.min(w * 0.31, 122)));
    const slice = (Math.PI * 2) / pool.length;

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, cy + radius + 12, radius * 0.92, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
    const rim = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius + 8);
    rim.addColorStop(0, "rgba(0,0,0,0)");
    rim.addColorStop(1, "rgba(255,215,120,0.30)");
    ctx.fillStyle = rim;
    ctx.fill();

    for (let i = 0; i < pool.length; i += 1) {
      const start = rotation + i * slice;
      const end = start + slice;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      const seg = ctx.createLinearGradient(-radius, -radius, radius, radius);
      if (i % 2 === 0) {
        seg.addColorStop(0, "rgba(206,152,55,0.96)");
        seg.addColorStop(1, "rgba(126,84,22,0.96)");
      } else {
        seg.addColorStop(0, "rgba(165,116,36,0.96)");
        seg.addColorStop(1, "rgba(95,62,15,0.96)");
      }
      ctx.fillStyle = seg;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,208,0.42)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const mid = start + slice / 2;
      ctx.save();
      ctx.rotate(mid);
      const reward = pool[i];
      this._drawArtThumb(ctx, radius * 0.44, -22, 40, 40, reward.item || reward, shortRewardLabel(reward));
      ctx.fillStyle = "#fff7e6";
      ctx.font = "900 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = shortRewardLabel(reward).replace(/\+/g, '');
      ctx.fillText(label, radius * 0.62, 28);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    const hub = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
    hub.addColorStop(0, "rgba(65,36,9,0.98)");
    hub.addColorStop(1, "rgba(20,11,6,0.98)");
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,235,192,0.18)";
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.moveTo(cx, y + 58);
    ctx.lineTo(cx - 16, y + 92);
    ctx.lineTo(cx + 16, y + 92);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f8df9d";
    ctx.beginPath();
    ctx.moveTo(cx, y + 54);
    ctx.lineTo(cx - 14, y + 84);
    ctx.lineTo(cx + 14, y + 84);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const reward = wheelState.reward || pool[selectedIndex] || pool[0];
    this._drawRewardCard(ctx, x + 14, y + 278, w - 28, 92, reward, true);
    return boxH;
  }

  _drawCrateReveal(ctx, x, y, w, reveal) {
    if (!reveal?.reward) return 0;
    const cards = this._crateDisplayCards(reveal);
    const cardGap = 10;
    const sideW = Math.floor((w - 28 - cardGap * 2) * 0.26);
    const centerW = w - 28 - cardGap * 2 - sideW * 2;

    this.drawCard(ctx, x, y, w, 196);
    ctx.fillStyle = "#fff";
    ctx.font = "900 16px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(reveal.kind === "legendary" ? "Legendary Sandık Açıldı" : "Mystery Sandık Açıldı", x + 16, y + 28);
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    ctx.fillText("Ortadaki kart verilen ödüldür.", x + 16, y + 48);

    const left = { x: x + 14, y: y + 72, w: sideW, h: 96 };
    const center = { x: left.x + sideW + cardGap, y: y + 62, w: centerW, h: 116 };
    const right = { x: center.x + centerW + cardGap, y: y + 72, w: sideW, h: 96 };

    if (cards[0]) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      this._drawRewardCard(ctx, left.x, left.y, left.w, left.h, cards[0], false);
      ctx.restore();
    }
    this._drawRewardCard(ctx, center.x, center.y, center.w, center.h, reveal.reward, true);
    if (cards[2]) {
      ctx.save();
      ctx.globalAlpha = 0.72;
      this._drawRewardCard(ctx, right.x, right.y, right.w, right.h, cards[2], false);
      ctx.restore();
    }
    return 196;
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
    const art = this._businessArt(row.business_type);
    return {
      id: String(row.id),
      type: row.business_type,
      icon: iconForType(row.business_type),
      imageKey: art?.imageKey || "",
      imageSrc: art?.imageSrc || "",
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
      type: "blackmarket",
      icon: "🕶️",
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

  _doFreeSpin() {
    if (this.wheelAnim) {
      this._showToast("Çark dönüyor");
      return;
    }
    if (!this._isFreeSpinReady()) {
      this._showToast("Günlük ücretsiz çark kullanıldı");
      return;
    }

    const pool = this._freeSpinRewards();
    const selectedIndex = Math.floor(Math.random() * pool.length);
    const reward = pool[selectedIndex];

    this._grantReward(reward, { markFreeSpin: true });
    this._setWheelResult("free", pool, selectedIndex, reward);
    this._startWheelAnimation("free", pool, selectedIndex, reward);
  }

  _doPremiumSpin() {
    if (this.wheelAnim) {
      this._showToast("Çark dönüyor");
      return;
    }
    const s = this.store.get();
    const cost = 90;

    if (Number(s.coins || 0) < cost) {
      this._showToast("Premium çark için yetersiz yton");
      return;
    }

    const pool = this._premiumSpinRewards();
    const selectedIndex = Math.floor(Math.random() * pool.length);
    const reward = pool[selectedIndex];

    this._grantReward(reward, { cost });
    this._setWheelResult("premium", pool, selectedIndex, reward);
    this._startWheelAnimation("premium", pool, selectedIndex, reward);
  }

  _buyCrate(kind) {
    const s = this.store.get();
    const cost = kind === "legendary" ? 140 : 65;

    if (Number(s.coins || 0) < cost) {
      this._showToast("Yetersiz yton");
      return;
    }

    const pool = this._crateRewards(kind);
    const selectedIndex = Math.floor(Math.random() * pool.length);
    const reward = pool[selectedIndex];

    this._grantReward(reward, { cost });
    this._setCrateReveal(kind, pool, selectedIndex, reward);
    this._showToast(reward.text, 1600);
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
          imageKey: "blackmarket",
          imageSrc: "./src/assets/BlackMarket.png",
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
        imageKey: item.imageKey || "",
        imageSrc: item.imageSrc || "",
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

  _buyMarketItem(shopId, itemId) {
    const s = this.store.get();
    const listings = (s.market?.listings || []).map((x) => ({ ...x }));
    const items = (s.inventory?.items || []).map((x) => ({ ...x }));
    const idx = listings.findIndex((x) => String(x.id) === String(itemId) && String(x.shopId) === String(shopId));
    if (idx < 0) {
      this._showToast("Ürün bulunamadı");
      return;
    }

    const listing = listings[idx];
    const price = Number(listing.price || 0);
    if (Number(s.coins || 0) < price) {
      this._showToast("Yetersiz yton");
      return;
    }
    if (Number(listing.stock || 0) <= 0) {
      this._showToast("Stok tükendi");
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
        kind: listing.usable ? "consumable" : "goods",
        icon: listing.icon || "📦",
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
        desc: listing.desc || "Pazardan alındı.",
      });
    }

    const shops = (s.market?.shops || []).map((x) => ({ ...x }));
    for (const shop of shops) {
      shop.totalListings = listings.filter((x) => x.shopId === shop.id).length;
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
      },
    });

    this._showToast(`${listing.itemName || "Ürün"} satın alındı`);
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
        icon: product.icon || "📦",
        imageKey: product.imageKey || "",
        imageSrc: product.imageSrc || "",
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
    const now = Date.now();
    if (this.wheelAnim) {
      const t = clamp((now - this.wheelAnim.start) / Math.max(1, this.wheelAnim.duration), 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.wheelAnim.rotation = this.wheelAnim.from + (this.wheelAnim.to - this.wheelAnim.from) * eased;
      if (t >= 1) {
        const trade = this._trade();
        this._setTrade({
          lootWheel: {
            ...(trade.lootWheel || {}),
            rotation: this._rewardRotation(this.wheelAnim.selectedIndex, this.wheelAnim.poolSize),
          },
        });
        this._showToast(this.wheelAnim.reward?.text || "Ödül alındı", 1600);
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
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = glow;
    fillRoundRect(ctx, x + w - 108, y + 14, 78, 78, 24);
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
    textFit(ctx, title, x + 16, y + 58, w - 120);

    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "12px system-ui";
    textFit(ctx, desc, x + 16, y + 81, w - 120);

    this._drawArtThumb(ctx, x + w - 92, y + 18, 62, 62, art, title);
  }

  _drawMiniCard(ctx, x, y, w, h, title, text, art, accent = "#458cff") {
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
    fillRoundRect(ctx, x + w - 64, y + 14, 48, 48, 16);
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = "900 14px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    textFit(ctx, title, x + 14, y + 24, w - 78);

    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "12px system-ui";
    textFit(ctx, text, x + 14, y + 48, w - 78);

    this._drawArtThumb(ctx, x + w - 56, y + 14, 40, 40, art, title);
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
      deal || { type: "blackmarket", imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
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
      cheapestShop?.shop || { type: "blackmarket", imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
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
      popularShop || { type: popularShop?.type || "brothel" },
      "#ffcc66"
    );

    y += 122;

    const rect3 = { x, y, w: colW, h: 110 };
    const rect4 = { x: x + colW + gap, y, w: colW, h: 110 };
    this.hitButtons.push({ rect: rect3, action: "go_tab", value: "loot" });
    this.hitButtons.push({ rect: rect4, action: "free_spin" });

    this._drawMiniCard(ctx, rect3.x, rect3.y, rect3.w, rect3.h, "Sandık Fırsatları", "Mystery Crate • Premium sandıklar", { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" }, "#c77dff");
    this._drawMiniCard(
      ctx,
      rect4.x,
      rect4.y,
      rect4.w,
      rect4.h,
      "Günlük Çark",
      this._isFreeSpinReady() ? "Hazır • şimdi çevir" : "Bugün kullanıldı",
      this._isFreeSpinReady() ? { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" } : { imageSrc: "./src/assets/bonus.png" },
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
      businesses[0] || { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
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

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._drawArtThumb(ctx, x + 14, y + 14, 56, 56, biz, biz.name || "İşletme", biz.type);

      ctx.fillStyle = "#fff";
      ctx.font = "900 15px system-ui";
      textFit(ctx, biz.name || "İşletme", x + 82, y + 24, w - 190);

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
        x + 82,
        y + 46
      );

      ctx.fillStyle = pendingCount > 0 ? "rgba(255,209,120,0.95)" : "rgba(255,255,255,0.48)";
      ctx.font = "11px system-ui";
      ctx.fillText(
        pendingCount > 0
          ? `Hazır üretim ${fmtNum(pendingCount)} • ${remainHours}s ${remainMinutes}d içinde topla`
          : "Bekleyen üretim yok",
        x + 82,
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

  this._drawArtThumb(ctx, x + 18, rowY + 9, 38, 38, p, p.name || "Ürün", biz.type);

  ctx.fillStyle = "#fff";
  ctx.font = "900 13px system-ui";
  textFit(ctx, p.name || "Ürün", x + 66, rowY + 18, w - 250);

  ctx.fillStyle = rarityColor(p.rarity);
  ctx.font = "800 10px system-ui";
  ctx.fillText(String(p.rarity || "common").toUpperCase(), x + 66, rowY + 34);

  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "11px system-ui";
  textFit(ctx, `Stok ${fmtNum(p.qty)} • Taban ${fmtNum(p.price)} yton`, x + 128, rowY + 34, w - 270);

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
      textFit(ctx, `Adet ${fmtNum(item.qty)} • NPC ${fmtNum(item.sellPrice)} yton`, x + 78, y + 56, w - 96);

      if (item.desc) {
        textFit(ctx, item.desc, x + 78, y + 74, w - 96);
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
    const trade = this._trade();

    this._drawHeroCard(
      ctx,
      x,
      y,
      w,
      124,
      "Sandık & Çark",
      this._isFreeSpinReady() ? "Günlük ücretsiz çark hazır" : "Premium loot sistemi aktif",
      "PREMIUM LOOT",
      { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
      "#c77dff"
    );

    const freeRect = { x: x + 14, y: y + 76, w: 116, h: 34 };
    const premiumRect = { x: x + 138, y: y + 76, w: 122, h: 34 };
    this.hitButtons.push({ rect: freeRect, action: "free_spin" });
    this.hitButtons.push({ rect: premiumRect, action: "premium_spin" });
    this._drawButton(ctx, freeRect, this._isFreeSpinReady() ? "Ücretsiz Çevir" : "Yarın Açılır", this._isFreeSpinReady() ? "primary" : "muted");
    this._drawButton(ctx, premiumRect, "Premium Çark", "gold");

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
      "Mystery Crate",
      "65 yton • satın al ve anında aç",
      { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
      "#62b3ff"
    );
    this._drawMiniCard(
      ctx,
      c2.x,
      c2.y,
      c2.w,
      c2.h,
      "Legendary Crate",
      "140 yton • premium ödül havuzu",
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
    ctx.fillText("Ödül Havuzu", x + 14, y + 24);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText("YTON • Enerji • Black Whiskey • White Widow • VIP Companion • Golden Pass", x + 14, y + 52);
    ctx.fillText("Gösterilen kart ve verilen ödül aynı veri kaynağını kullanır.", x + 14, y + 72);

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

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._drawArtThumb(ctx, x + 14, y + 14, 54, 54, shop, shop.name || "Dükkan", shop.type);

      ctx.fillStyle = "#fff";
      ctx.font = "900 14px system-ui";
      textFit(ctx, shop.name || "Dükkan", x + 80, y + 22, w - 188);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      textFit(ctx, `${typeLabel(shop.type)} • Sahip ${shop.ownerName || "?"}`, x + 80, y + 42, w - 188);
      textFit(ctx, `Ürün ${fmtNum(shop.totalListings)} • Puan ${shop.rating || 0} • En düşük ${lowest ? fmtNum(lowest) : "-"}`, x + 80, y + 60, w - 188);

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
      shop,
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

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._drawArtThumb(ctx, x + 14, y + 14, 54, 54, item, item.itemName || "Ürün", shop.type);

      ctx.fillStyle = "#fff";
      ctx.font = "900 14px system-ui";
      textFit(ctx, item.itemName || "Ürün", x + 80, y + 22, w - 180);

      ctx.fillStyle = rarityColor(item.rarity);
      ctx.font = "800 10px system-ui";
      ctx.fillText(String(item.rarity || "common").toUpperCase(), x + 80, y + 40);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      textFit(ctx, `Stok ${fmtNum(item.stock)} • Fiyat ${fmtNum(item.price)} yton`, x + 80, y + 60, w - 180);

      const buyRect = { x: x + w - 94, y: y + 66, w: 80, h: 28 };
      this.hitButtons.push({ rect: buyRect, action: "buy_market_item", itemId: item.id, shopId: shop.id });
      this._drawButton(ctx, buyRect, "Satın Al", "gold");

      y += 114;
    }

    return y;
  }

  _buyBusiness(businessType) {
    const defs = {
      nightclub: {
        price: 1000,
        name: "Nightclub",
        theme: "neon",
        icon: "🌃",
        imageKey: "nightclub",
        imageSrc: "./src/assets/nightclub.jpg",
        products: [
          { id: `biz_${Date.now()}_whiskey`, icon: "🥃", imageSrc: "./src/assets/drink.png", name: "Black Whiskey", rarity: "common", qty: 8, price: 28, energyGain: 8, desc: "Gece kulübü ürünü." },
          { id: `biz_${Date.now()}_champ`, icon: "🍾", imageSrc: "./src/assets/drink.png", name: "Premium Champagne", rarity: "rare", qty: 4, price: 44, energyGain: 14, desc: "Premium içki." },
        ],
      },
      coffeeshop: {
        price: 850,
        name: "Coffeeshop",
        theme: "green",
        icon: "🌿",
        imageKey: "coffeeshop",
        imageSrc: "./src/assets/coffeeshop.jpg",
        products: [
          { id: `biz_${Date.now()}_weed`, icon: "🍁", imageSrc: "./src/assets/weed.png", name: "White Widow", rarity: "rare", qty: 10, price: 36, energyGain: 12, desc: "Coffeeshop ürünü." },
        ],
      },
      brothel: {
        price: 1200,
        name: "Genel Ev",
        theme: "red",
        icon: "💋",
        imageKey: "xxx",
        imageSrc: "./src/assets/xxx.jpg",
        products: [
          { id: `biz_${Date.now()}_vip`, icon: "🌹", imageKey: "xxx", imageSrc: "./src/assets/xxx.jpg", name: "VIP Companion", rarity: "epic", qty: 5, price: 95, energyGain: 22, desc: "Yüksek enerji itemi." },
        ],
      },
    };

    const def = defs[businessType];
    if (!def) return;

    const s = this.store.get();
    if (Number(s.coins || 0) < def.price) {
      this._showToast("Yetersiz yton");
      return;
    }

    const nameRaw = window.prompt(`${def.name} için isim gir:`, def.name);
    if (nameRaw === null) return;
    const name = String(nameRaw || def.name).trim() || def.name;

    const businessId = `biz_${businessType}_${Date.now()}`;
    const products = def.products.map((product, idx) => ({
      ...product,
      id: `${businessId}_p${idx + 1}`,
    }));

    const newBusiness = {
      id: businessId,
      type: businessType,
      icon: def.icon,
      imageKey: def.imageKey,
      imageSrc: def.imageSrc,
      name,
      ownerId: String(s.player?.id || "player_main"),
      ownerName: String(s.player?.username || "Player"),
      dailyProduction: 50,
      stock: products.reduce((sum, item) => sum + Number(item.qty || 0), 0),
      theme: def.theme,
      products,
    };

    this.store.set({
      coins: Math.max(0, Number(s.coins || 0) - def.price),
      businesses: {
        ...(s.businesses || {}),
        owned: [newBusiness, ...((s.businesses?.owned || []).map((x) => ({ ...x })))],
      },
    });

    this._showToast(`${name} satın alındı`);
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
      { imageKey: "blackmarket", imageSrc: "./src/assets/BlackMarket.png" },
      "#ffcc66"
    );
    y += 130;

    const buildings = [
      { type: "nightclub", icon: "🌃", imageKey: "nightclub", imageSrc: "./src/assets/nightclub.jpg", name: "Nightclub", price: 1000, risk: "Orta", level: "Lv 25+" },
      { type: "coffeeshop", icon: "🌿", imageKey: "coffeeshop", imageSrc: "./src/assets/coffeeshop.jpg", name: "Coffeeshop", price: 850, risk: "Düşük", level: "Lv 20+" },
      { type: "brothel", icon: "💋", imageKey: "xxx", imageSrc: "./src/assets/xxx.jpg", name: "Genel Ev", price: 1200, risk: "Yüksek", level: "Lv 35+" },
    ];

    for (const b of buildings) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      fillRoundRect(ctx, x, y, w, 104, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.09)";
      strokeRoundRect(ctx, x, y, w, 104, 18);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._drawArtThumb(ctx, x + 14, y + 14, 54, 54, b, b.name, b.type);

      ctx.fillStyle = "#fff";
      ctx.font = "900 14px system-ui";
      textFit(ctx, b.name, x + 80, y + 22, w - 178);

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "11px system-ui";
      textFit(ctx, `Fiyat ${fmtNum(b.price)} yton • Günlük üretim 50`, x + 80, y + 44, w - 178);
      textFit(ctx, `Risk ${b.risk} • Önerilen ${b.level}`, x + 80, y + 62, w - 178);

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






