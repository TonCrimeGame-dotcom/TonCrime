
// src/scenes/CoffeeShopScene.js

const ITEMS = [
  { id: "amnesia_haze", name: "Amnesia Haze", price: 10, energy: 3, rarity: "common", icon: "ğŸŒ¿" },
  { id: "white_widow", name: "White Widow", price: 12, energy: 4, rarity: "common", icon: "ğŸŒ¿" },
  { id: "northern_lights", name: "Northern Lights", price: 14, energy: 5, rarity: "common", icon: "ğŸŒ¿" },
  { id: "super_skunk", name: "Super Skunk", price: 16, energy: 6, rarity: "common", icon: "ğŸŒ¿" },
  { id: "purple_haze", name: "Purple Haze", price: 18, energy: 7, rarity: "common", icon: "ğŸŒ¿" },
  { id: "orange_bud", name: "Orange Bud", price: 20, energy: 8, rarity: "common", icon: "ğŸŒ¿" },
  { id: "blue_dream", name: "Blue Dream", price: 22, energy: 9, rarity: "rare", icon: "ğŸŒ¿" },
  { id: "gelato", name: "Gelato", price: 24, energy: 10, rarity: "rare", icon: "ğŸŒ¿" },
  { id: "gorilla_glue", name: "Gorilla Glue", price: 26, energy: 11, rarity: "rare", icon: "ğŸŒ¿" },
  { id: "green_crack", name: "Green Crack", price: 28, energy: 12, rarity: "rare", icon: "ğŸŒ¿" },
  { id: "ak47", name: "AK-47", price: 30, energy: 13, rarity: "rare", icon: "ğŸŒ¿" },
  { id: "super_silver", name: "Super Silver Haze", price: 32, energy: 14, rarity: "rare", icon: "ğŸŒ¿" },
  { id: "jack_herer", name: "Jack Herer", price: 34, energy: 15, rarity: "rare", icon: "ğŸŒ¿" },
  { id: "og_kush", name: "OG Kush", price: 36, energy: 16, rarity: "epic", icon: "ğŸŒ¿" },
  { id: "girl_scout", name: "Girl Scout Cookies", price: 38, energy: 17, rarity: "epic", icon: "ğŸŒ¿" },
  { id: "sour_diesel", name: "Sour Diesel", price: 40, energy: 18, rarity: "epic", icon: "ğŸŒ¿" },
  { id: "zkittlez", name: "Zkittlez", price: 42, energy: 19, rarity: "epic", icon: "ğŸŒ¿" },
  { id: "wedding_cake", name: "Wedding Cake", price: 44, energy: 20, rarity: "epic", icon: "ğŸŒ¿" },
  { id: "banana_kush", name: "Banana Kush", price: 46, energy: 21, rarity: "epic", icon: "ğŸŒ¿" },
  { id: "mimosa", name: "Mimosa", price: 48, energy: 22, rarity: "epic", icon: "ğŸŒ¿" },
  { id: "choco_haze", name: "Choco Haze", price: 50, energy: 23, rarity: "epic", icon: "ğŸŒ¿" },
  { id: "rainbow_belts", name: "Rainbow Belts", price: 53, energy: 24, rarity: "epic", icon: "ğŸŒ¿" },
  { id: "moon_rocks", name: "Moon Rocks", price: 56, energy: 25, rarity: "legendary", icon: "ğŸŒ¿" },
  { id: "ice_hash", name: "Ice Hash", price: 59, energy: 26, rarity: "legendary", icon: "ğŸŒ¿" },
  { id: "amsterdam_gold", name: "Amsterdam Gold", price: 62, energy: 27, rarity: "legendary", icon: "ğŸŒ¿" },
  { id: "black_tuna", name: "Black Tuna", price: 65, energy: 28, rarity: "legendary", icon: "ğŸŒ¿" },
  { id: "platinum_kush", name: "Platinum Kush", price: 68, energy: 29, rarity: "legendary", icon: "ğŸŒ¿" },
  { id: "ghost_train", name: "Ghost Train Haze", price: 71, energy: 30, rarity: "legendary", icon: "ğŸŒ¿" },
  { id: "diamond_resin", name: "Diamond Resin", price: 75, energy: 32, rarity: "legendary", icon: "ğŸŒ¿" },
  { id: "dam_crown", name: "Dam Crown", price: 80, energy: 35, rarity: "legendary", icon: "ğŸŒ¿" },
];


const COFFEESHOP_BG_PATHS = [
  "./src/assets/coffeeshop_bg.png",
  "./src/assets/coffeeshop.jpg",
  "./src/assets/coffeeshop-bg.png",
];

const ITEM_IMAGE_PATHS = {
  amnesia_haze: ["./src/assets/amnesia.png"],
  white_widow: ["./src/assets/white.png"],
  northern_lights: ["./src/assets/northern.png"],
  super_skunk: ["./src/assets/skunk.png"],
  purple_haze: ["./src/assets/purple.png"],
  orange_bud: ["./src/assets/mimosa.png", "./src/assets/amsterdam.png", "./src/assets/amnesia.png"],
  blue_dream: ["./src/assets/blue.png"],
  gelato: ["./src/assets/gelato.png"],
  gorilla_glue: ["./src/assets/gorilla.png"],
  green_crack: ["./src/assets/green.png"],
  ak47: ["./src/assets/ak-47.png"],
  super_silver: ["./src/assets/white.png", "./src/assets/diamond.png", "./src/assets/ghost.png"],
  jack_herer: ["./src/assets/jack.png"],
  og_kush: ["./src/assets/og.png"],
  girl_scout: ["./src/assets/girl.png"],
  sour_diesel: ["./src/assets/diesel.png"],
  zkittlez: ["./src/assets/rainbow.png"],
  wedding_cake: ["./src/assets/gelato.png", "./src/assets/girl.png", "./src/assets/choco.png"],
  banana_kush: ["./src/assets/banana.png"],
  mimosa: ["./src/assets/mimosa.png"],
  choco_haze: ["./src/assets/choco.png"],
  rainbow_belts: ["./src/assets/rainbow.png"],
  moon_rocks: ["./src/assets/diamond.png", "./src/assets/platinum.png", "./src/assets/white.png"],
  ice_hash: ["./src/assets/diamond.png", "./src/assets/white.png", "./src/assets/platinum.png"],
  amsterdam_gold: ["./src/assets/amsterdam.png"],
  black_tuna: ["./src/assets/tuna.png"],
  platinum_kush: ["./src/assets/platinum.png"],
  ghost_train: ["./src/assets/ghost.png"],
  diamond_resin: ["./src/assets/diamond.png"],
  dam_crown: ["./src/assets/dam.png", "./src/assets/crown.png"],
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function pointInRect(px, py, r) { return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }
function fmtNum(n) { return Number(n || 0).toLocaleString("tr-TR"); }
function chance(v) { return Math.random() < v; }
function makeId(prefix) { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 999999)}`; }
function ensureArray(v) { return Array.isArray(v) ? v : []; }

const COFFEESHOP_ADDICTION_STEP = 10;
const COFFEESHOP_ADDICTION_FIRST_DROP = 0.30;
const COFFEESHOP_ADDICTION_NEXT_DROP = 0.10;
const COFFEESHOP_ADDICTION_MIN_RATE = 0.10;
const COFFEESHOP_POLICE_RISK = 0.05;
const COFFEESHOP_POLICE_COIN_LOSS = 10;
const COFFEESHOP_POLICE_XP_LOSS = 10;
const COFFEESHOP_RESET_TIMEZONE = "Europe/Istanbul";
const COFFEESHOP_RUSH_DURATION_MS = 3200;
const COFFEESHOP_RUSH_SWAY_PX = 7;
const COFFEESHOP_RUSH_TILT_RAD = 0.012;

export class CoffeeShopScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.items = ITEMS.slice();
    this.scrollY = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScrollY = 0;
    this.justDragged = false;
    this.maxScroll = 0;

    this.hitBuy = [];
    this.hitPvp = null;
    this.hitClose = null;

    this.toast = "";
    this.toastUntil = 0;

    this.music = null;
    this.musicStarted = false;
    this._musicUnlocked = false;

    this._pvpBound = false;
    this._pendingFightId = null;

    this._assetImgCache = new Map();
    this._bgImgCache = null;
    this._fxAudioCtx = null;
    this._noiseBuffer = null;
    this._smokeUntil = 0;
    this._smokeStartedAt = 0;
    this._smokeBoost = 1;
    this._smokeItemName = "";
  }

  _lang() {
    return this.i18n?.getLang?.() === "en" ? "en" : "tr";
  }

  _ui(tr, en) {
    return this._lang() === "en" ? en : tr;
  }

  onEnter() {
    this.scrollY = 0;
    this.dragging = false;
    this.justDragged = false;
    this.hitBuy = [];
    this.hitPvp = null;
    this.hitClose = null;
    this._ensureState();
    this._syncDailyUsageState();
    this._playMusic();
  }

  onExit() {
    this.dragging = false;
    if (this.music) {
      try { this.music.pause(); } catch (_) {}
    }
  }

  _ensureState() {
    const s = this.store.get() || {};
    const p = s.player || {};
    const shop = this._syncDailyUsageState();
    const inventory = s.inventory || {};
    const dayKey = this._todayKey();
    const itemUseCounts = this._normalizeItemUseCounts(shop.itemUseCounts);
    this.store.set({
      player: {
        ...p,
        energy: Number(p.energy || 0),
        energyMax: Math.max(1, Number(p.energyMax || 100)),
      },
      inventory: {
        ...inventory,
        items: Array.isArray(inventory.items) ? inventory.items : [],
      },
      coffeeshop: {
        ...shop,
        totalSpent: Number(shop.totalSpent || 0),
        totalBought: Number(shop.totalBought || 0),
        inventoryBought: Number(shop.inventoryBought || 0),
        lastRaidAt: Number(shop.lastRaidAt || 0),
        raidCount: Number(shop.raidCount || 0),
        usageDayKey: String(shop.usageDayKey || dayKey),
        itemUseCounts,
      },
      pvp: {
        ...(s.pvp || {}),
        pendingVenueFight: s.pvp?.pendingVenueFight || null,
      }
    });
  }

  _safe() {
    const safe = this.store.get()?.ui?.safe;
    if (safe && Number.isFinite(safe.w) && Number.isFinite(safe.h)) return safe;
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  _loadChainedImage(paths = []) {
    const list = Array.isArray(paths) ? paths.filter(Boolean) : [paths].filter(Boolean);
    const key = list.join("|");
    if (!key) return null;
    if (this._assetImgCache.has(key)) return this._assetImgCache.get(key);

    const img = new Image();
    let idx = 0;
    const tryNext = () => {
      if (idx >= list.length) return;
      img.src = list[idx++];
    };
    img.onerror = () => {
      if (idx < list.length) tryNext();
    };
    tryNext();
    this._assetImgCache.set(key, img);
    return img;
  }

  _getItemImage(item) {
    const paths = ITEM_IMAGE_PATHS[String(item?.id || "")] || [];
    return this._loadChainedImage(paths);
  }

  _getBg() {
    if (!this._bgImgCache) this._bgImgCache = this._loadChainedImage(COFFEESHOP_BG_PATHS);

    if (this._bgImgCache && (this._bgImgCache.complete || this._bgImgCache.naturalWidth || this._bgImgCache.width)) {
      return this._bgImgCache;
    }

    if (typeof this.assets?.getImage === "function") {
      const fromAssets = this.assets.getImage("coffeeshop_bg");
      if (fromAssets) return fromAssets;
    }
    if (typeof this.assets?.get === "function") {
      const fromAssets = this.assets.get("coffeeshop_bg");
      if (fromAssets) return fromAssets;
    }
    const fromMap = this.assets?.images?.coffeeshop_bg || null;
    if (fromMap) return fromMap;

    return this._bgImgCache;
  }

  _drawCover(ctx, img, x, y, w, h) {
    if (!img) {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(x, y, w, h);
      return;
    }
    const iw = img.width || 1;
    const ih = img.height || 1;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }


  _drawItemThumb(ctx, img, x, y, size) {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    this._fillRoundRect(ctx, x, y, size, size, 12);

    if (img && (img.complete || img.naturalWidth || img.width)) {
      ctx.save();
      this._roundRect(ctx, x, y, size, size, 12);
      ctx.clip();

      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;
      const scale = Math.min((size - 8) / iw, (size - 8) / ih);
      const dw = Math.max(1, iw * scale);
      const dh = Math.max(1, ih * scale);
      const dx = x + (size - dw) * 0.5;
      const dy = y + (size - dh) * 0.5;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  _fillRoundRect(ctx, x, y, w, h, r) { this._roundRect(ctx, x, y, w, h, r); ctx.fill(); }
  _strokeRoundRect(ctx, x, y, w, h, r) { this._roundRect(ctx, x, y, w, h, r); ctx.stroke(); }
  _pointInRect(px, py, r) { return pointInRect(px, py, r); }

  _showToast(text, ms = 1500) {
    this.toast = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _ensureFxAudio() {
    if (this._fxAudioCtx) return this._fxAudioCtx;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this._fxAudioCtx = new AudioCtx();
      return this._fxAudioCtx;
    } catch (_) {
      return null;
    }
  }

  _unlockFxAudio() {
    const ctx = this._ensureFxAudio();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch (_) {}
  }

  _getNoiseBuffer() {
    const ctx = this._ensureFxAudio();
    if (!ctx) return null;
    if (this._noiseBuffer) return this._noiseBuffer;

    try {
      const duration = 1.25;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (0.55 - 0.25 * (i / data.length));
      }
      this._noiseBuffer = buffer;
      return buffer;
    } catch (_) {
      return null;
    }
  }

  _playInhaleSfx(boost = 1) {
    const ctx = this._ensureFxAudio();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const noiseBuffer = this._getNoiseBuffer();
      if (!noiseBuffer) return;

      const now = ctx.currentTime + 0.01;
      const strength = Math.max(0.9, Math.min(1.85, Number(boost || 1)));

      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 0.85;
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(1300, now + 0.22);
      filter.frequency.exponentialRampToValueAtTime(720, now + 0.9);

      const airGain = ctx.createGain();
      airGain.gain.setValueAtTime(0.0001, now);
      airGain.gain.exponentialRampToValueAtTime(0.09 * strength, now + 0.18);
      airGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

      const bodyOsc = ctx.createOscillator();
      bodyOsc.type = "triangle";
      bodyOsc.frequency.setValueAtTime(92, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(156, now + 0.28);
      bodyOsc.frequency.exponentialRampToValueAtTime(112, now + 0.92);

      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0.0001, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.034 * strength, now + 0.24);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.92);

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.95, now + 0.04);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      master.connect(ctx.destination);

      source.connect(filter);
      filter.connect(airGain);
      airGain.connect(master);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(master);

      source.start(now);
      source.stop(now + 1.02);
      bodyOsc.start(now);
      bodyOsc.stop(now + 1.0);
    } catch (_) {}
  }

  _playMusic() {
    if (this.musicStarted) return;
    this.musicStarted = true;
    try {
      this.music = new Audio("./src/assets/reggae.mp3");
      this.music.loop = true;
      this.music.volume = 0.22;
      const start = () => {
        if (!this.music) return;
        this.music.play().catch(() => {});
        window.removeEventListener("pointerdown", start);
        window.removeEventListener("touchstart", start);
        window.removeEventListener("click", start);
      };
      window.addEventListener("pointerdown", start, { passive: true, once: true });
      window.addEventListener("touchstart", start, { passive: true, once: true });
      window.addEventListener("click", start, { passive: true, once: true });
    } catch (_) {}
  }

  _playerName() {
    const s = this.store.get() || {};
    return String(s.player?.username || "Player");
  }

  _todayKey() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: COFFEESHOP_RESET_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch (_) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  _normalizeItemUseCounts(raw) {
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
      const n = Math.max(0, Math.floor(Number(value || 0)));
      if (key && n > 0) out[key] = n;
    }
    return out;
  }

  _syncDailyUsageState() {
    const s = this.store.get() || {};
    const shop = s.coffeeshop || {};
    const dayKey = this._todayKey();
    const currentDayKey = String(shop.usageDayKey || "");
    const normalized = this._normalizeItemUseCounts(shop.itemUseCounts);

    if (currentDayKey !== dayKey) {
      const nextShop = {
        ...shop,
        usageDayKey: dayKey,
        itemUseCounts: {},
      };
      this.store.set({ coffeeshop: nextShop });
      return nextShop;
    }

    return {
      ...shop,
      usageDayKey: dayKey,
      itemUseCounts: normalized,
    };
  }

  _getUseCount(itemId) {
    const shop = this._syncDailyUsageState();
    return Math.max(0, Number(shop.itemUseCounts?.[String(itemId || "")] || 0));
  }

  _getAddictionRate(nextUseCount) {
    const step = Math.floor(Math.max(0, Number(nextUseCount || 0)) / COFFEESHOP_ADDICTION_STEP);
    if (step <= 0) return 1;
    const baseRate = 1 - COFFEESHOP_ADDICTION_FIRST_DROP - Math.max(0, step - 1) * COFFEESHOP_ADDICTION_NEXT_DROP;
    return clamp(baseRate, COFFEESHOP_ADDICTION_MIN_RATE, 1);
  }

  _getAddictionSnapshot(item, useCounts = null) {
    const uses = useCounts && typeof useCounts === "object"
      ? Math.max(0, Number(useCounts[String(item?.id || "")] || 0))
      : this._getUseCount(item?.id);
    const nextUseCount = uses + 1;
    const rate = this._getAddictionRate(nextUseCount);
    const baseGain = Math.max(0, Number(item?.energy || 0));
    const effectiveGain = baseGain <= 0 ? 0 : Math.max(1, Math.floor(baseGain * rate));
    const penaltyPct = Math.max(0, Math.round((1 - rate) * 100));

    return {
      uses,
      nextUseCount,
      rate,
      effectiveGain,
      penaltyPct,
    };
  }

  _trackItemUse(itemId, nextUseCount) {
    const shop = this._syncDailyUsageState();
    const nextCounts = {
      ...this._normalizeItemUseCounts(shop.itemUseCounts),
      [String(itemId || "")]: Math.max(0, Math.floor(Number(nextUseCount || 0))),
    };

    const nextShop = {
      ...shop,
      usageDayKey: this._todayKey(),
      itemUseCounts: nextCounts,
    };

    this.store.set({ coffeeshop: nextShop });
    return nextShop;
  }

  _triggerSmokeRush(item, meta = {}) {
    const penaltyPct = Math.max(0, Number(meta?.penaltyPct || 0));
    if (penaltyPct <= 0) return;

    this._smokeStartedAt = Date.now();
    this._smokeUntil = this._smokeStartedAt + COFFEESHOP_RUSH_DURATION_MS;
    this._smokeBoost = Math.min(1.9, 1 + penaltyPct / 45);
    this._smokeItemName = String(item?.name || "");
    this._playInhaleSfx(this._smokeBoost);
  }

  _getSmokeRushStrength(now = Date.now()) {
    if (!this._smokeUntil || now >= this._smokeUntil) return 0;
    const duration = Math.max(1, COFFEESHOP_RUSH_DURATION_MS);
    const remaining = Math.max(0, (this._smokeUntil - now) / duration);
    return Math.max(0, Math.min(1.8, Math.pow(remaining, 0.76) * Number(this._smokeBoost || 1)));
  }

  _rarityLabel(rarity) {
    const key = String(rarity || "").toLowerCase();
    if (this._lang() !== "en") {
      if (key === "common") return "Yaygin";
      if (key === "rare") return "Nadir";
      if (key === "epic") return "Epik";
      if (key === "legendary") return "Efsane";
    }

    if (key === "common") return "Common";
    if (key === "rare") return "Rare";
    if (key === "epic") return "Epic";
    if (key === "legendary") return "Legendary";
    return rarity || "";
  }

  _applyXpLoss(amount = 0) {
    const s = this.store.get() || {};
    const p = s.player || {};
    let loss = Math.max(0, Number(amount || 0));
    let level = Math.max(1, Number(p.level || 1));
    let xp = Math.max(0, Number(p.xp || 0));
    let xpToNext = Math.max(1, Number(p.xpToNext || 100));

    while (loss > 0) {
      if (xp >= loss) {
        xp -= loss;
        loss = 0;
        break;
      }

      loss -= xp;
      if (level > 1) {
        level -= 1;
        xpToNext = 100;
        xp = xpToNext;
        continue;
      }

      xp = 0;
      loss = 0;
      break;
    }

    this.store.set({
      player: {
        ...p,
        level,
        xp,
        xpToNext,
      },
    });

    return {
      levelDropped: level < Math.max(1, Number(p.level || 1)),
      xpLost: Math.max(0, Number(amount || 0)),
    };
  }

  _pushSystemChat(text) {
    const s = this.store.get() || {};
    const chat = ensureArray(s.chatLog).slice(-79);
    const ts = Date.now();

    chat.push({
      id: `coffee_${ts}_${Math.floor(Math.random() * 999999)}`,
      channel: "system",
      from: "SYSTEM",
      text: String(text || ""),
      ts,
    });

    this.store.set({ chatLog: chat });
  }

  _rarityColor(rarity) {
    switch (String(rarity || "").toLowerCase()) {
      case "rare": return "#63a8ff";
      case "epic": return "#cd87ff";
      case "legendary": return "#ffce6a";
      default: return "#b8c0cc";
    }
  }

  _mergeInventoryItem(item) {
    const s = this.store.get() || {};
    const inventory = s.inventory || {};
    const items = Array.isArray(inventory.items) ? inventory.items.map((x) => ({ ...x })) : [];
    const existing = items.find(
      (x) =>
        String(x.name || "").toLowerCase() === String(item.name || "").toLowerCase() &&
        String(x.rarity || "").toLowerCase() === String(item.rarity || "").toLowerCase()
    );

    if (existing) {
      existing.qty = Number(existing.qty || 0) + Number(item.qty || 1);
      existing.marketPrice = Math.max(Number(existing.marketPrice || 0), Number(item.marketPrice || 0));
      existing.sellPrice = Math.max(Number(existing.sellPrice || 0), Number(item.sellPrice || 0));
      existing.energyGain = Math.max(Number(existing.energyGain || 0), Number(item.energyGain || 0));
    } else {
      items.unshift({ ...item });
    }

    this.store.set({
      inventory: {
        ...inventory,
        items,
      },
    });
  }

  _buy(item) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const shop = this._syncDailyUsageState();
    const coins = Number(s.coins || 0);
    const price = Number(item.price || 0);
    const gain = Number(item.energy || 0);
    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 100));

    if (coins < price) {
      this._showToast(this._ui("Yetersiz yton", "Not enough yton"));
      return;
    }

    const nextShop = {
      ...shop,
      totalSpent: Number(shop.totalSpent || 0) + price,
      totalBought: Number(shop.totalBought || 0) + 1,
      inventoryBought: Number(shop.inventoryBought || 0),
    };

    if (energy < energyMax) {
      const addiction = this._getAddictionSnapshot(item);
      const gainedEnergy = Math.max(0, Math.min(energyMax - energy, addiction.effectiveGain));
      const nextEnergy = Math.min(energyMax, energy + gainedEnergy);

      this.store.set({
        coins: coins - price,
        player: {
          ...p,
          energy: nextEnergy,
        },
        coffeeshop: nextShop,
      });

      this._trackItemUse(item.id, addiction.nextUseCount);
      this._showToast(
        this._ui(
          `${item.name} kullanildi - +${nextEnergy - energy} enerji${addiction.penaltyPct ? ` (bagimlilik -%${addiction.penaltyPct})` : ""}`,
          `${item.name} used - +${nextEnergy - energy} energy${addiction.penaltyPct ? ` (tolerance -${addiction.penaltyPct}%)` : ""}`
        ),
        1700
      );
      this._pushSystemChat(
        this._ui(
          `Coffeeshop: ${this._playerName()} ${item.name} kullandi. +${nextEnergy - energy} enerji${addiction.penaltyPct ? `, bagimlilik cezasi -%${addiction.penaltyPct}` : ""}.`,
          `CoffeeShop: ${this._playerName()} used ${item.name}. +${nextEnergy - energy} energy${addiction.penaltyPct ? `, tolerance penalty -${addiction.penaltyPct}%` : ""}.`
        )
      );
      if (addiction.penaltyPct > 0) {
        this._triggerSmokeRush(item, addiction);
      }
    } else {
      const inventoryItem = {
        id: `inv_coffee_${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` ,
        kind: "consumable",
        icon: item.icon || "ğŸŒ¿",
        image: (ITEM_IMAGE_PATHS[String(item.id || "")] || [])[0] || "",
        name: item.name,
        rarity: item.rarity || "common",
        qty: 1,
        usable: true,
        sellable: true,
        marketable: true,
        energyGain: gain,
        sellPrice: Math.max(1, Math.floor(price * 0.68)),
        marketPrice: price,
        desc: this._ui("CoffeeShop urunu.", "CoffeeShop product."),
        source: "coffeeshop",
        category: "weed",
        createdAt: Date.now(),
      };

      nextShop.inventoryBought += 1;
      this.store.set({
        coins: coins - price,
        coffeeshop: nextShop,
      });
      this._mergeInventoryItem(inventoryItem);
      this._showToast(
        this._ui(`${item.name} envantere eklendi`, `${item.name} added to inventory`),
        1500
      );
      this._pushSystemChat(
        this._ui(
          `Coffeeshop: ${this._playerName()} ${item.name} satin aldi ve envantere atti.`,
          `CoffeeShop: ${this._playerName()} bought ${item.name} and sent it to inventory.`
        )
      );
    }

    if (chance(COFFEESHOP_POLICE_RISK)) this._applyPoliceRaid(item);
  }

  _applyPoliceRaid(item) {
    const s = this.store.get() || {};
    const shop = s.coffeeshop || {};
    const lossCoins = Math.min(COFFEESHOP_POLICE_COIN_LOSS, Math.max(0, Number(s.coins || 0)));
    const xpResult = this._applyXpLoss(COFFEESHOP_POLICE_XP_LOSS);

    this.store.set({
      coins: Math.max(0, Number(this.store.get()?.coins || 0) - lossCoins),
      coffeeshop: {
        ...shop,
        lastRaidAt: Date.now(),
        raidCount: Number(shop.raidCount || 0) + 1,
      },
    });

    this._showToast(
      this._ui(
        `Polis baskini! -${COFFEESHOP_POLICE_XP_LOSS} XP / -${lossCoins} yton`,
        `Police raid! -${COFFEESHOP_POLICE_XP_LOSS} XP / -${lossCoins} yton`
      ),
      2200
    );
    this._pushSystemChat(
      this._ui(
        `Polis Coffeeshop'a baskin yapti. ${this._playerName()} -${lossCoins} yton ve -${COFFEESHOP_POLICE_XP_LOSS} XP kaybetti${xpResult.levelDropped ? " (seviye dustu)" : ""}.`,
        `Police raided the CoffeeShop. ${this._playerName()} lost ${lossCoins} yton and ${COFFEESHOP_POLICE_XP_LOSS} XP${xpResult.levelDropped ? " (level dropped)" : ""}.`
      )
    );
  }

  _ensurePvpShell() {
    let layer = document.getElementById("pvpLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "pvpLayer";
      layer.style.position = "fixed";
      layer.style.left = "0";
      layer.style.right = "0";
      layer.style.top = "0";
      layer.style.bottom = "0";
      layer.style.zIndex = "7000";
      layer.style.pointerEvents = "none";
      document.body.appendChild(layer);
    }

    let wrap = document.getElementById("pvpWrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "pvpWrap";
      layer.appendChild(wrap);
    }

    wrap.style.position = "fixed";
    wrap.style.left = "12px";
    wrap.style.right = "12px";
    wrap.style.top = "96px";
    wrap.style.bottom = "64px";
    wrap.style.zIndex = "7001";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.borderRadius = "16px";
    wrap.style.border = "1px solid rgba(255,255,255,0.12)";
    wrap.style.background = "rgba(8,10,16,0.88)";
    wrap.style.backdropFilter = "blur(12px)";
    wrap.style.overflow = "hidden";
    wrap.style.pointerEvents = "auto";

    wrap.innerHTML = `
      <div id="pvpHeader" style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px 10px 8px;border-bottom:1px solid rgba(255,255,255,0.10);flex:0 0 auto;">
        <div id="pvpLeftHead" style="display:flex;flex-direction:column;gap:4px;">
          <div id="pvpStatus" style="font-weight:900;font-size:13px;color:rgba(255,255,255,0.92);">PvP â€¢ YÃ¼kleniyor...</div>
          <div id="pvpOpponentRow" style="font-size:12px;color:rgba(255,255,255,0.80);">
            <span id="pvpSpinner"></span> Rakip: <b id="pvpOpponent">ShadowWolf</b>
          </div>
        </div>
      </div>
      <div id="pvpBars" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;flex:0 0 auto;">
        <div>
          <div class="pvpBar" style="height:14px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);overflow:hidden;"><div id="enemyFill" style="height:100%;width:100%;transform-origin:left center;background:rgba(255,255,255,0.65);"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,0.95);margin-top:6px;"><span>DÃ¼ÅŸman</span><span id="enemyHpText">100</span></div>
        </div>
        <div>
          <div class="pvpBar" style="height:14px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);overflow:hidden;"><div id="meFill" style="height:100%;width:100%;transform-origin:left center;background:rgba(255,255,255,0.65);"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,0.95);margin-top:6px;"><span>Sen</span><span id="meHpText">100</span></div>
        </div>
      </div>
      <div id="arena" style="position:relative;flex:1 1 auto;min-height:280px;width:calc(100% - 20px);margin:0 10px 10px;border-radius:14px;background:rgba(0,0,0,0.92);overflow:hidden;box-sizing:border-box;"></div>
    `;
    return wrap;
  }

  _bindPvpSettlement() {
    if (this._pvpBound) return;
    this._pvpBound = true;

    const settle = (didWin) => {
      const store = this.store;
      const state = store.get() || {};
      const pending = state.pvp?.pendingVenueFight;
      if (!pending || pending.source !== "coffeeshop" || pending.settled) return;
      if (this._pendingFightId && pending.fightId !== this._pendingFightId) return;

      const player = state.player || {};
      const baseCoins = Number(pending.playerCoinsAtStart || 0);
      const baseEnergy = Number(pending.playerEnergyAtStart || 0);
      const stealCoins = Math.max(1, Math.floor(Number(pending.opponentCoins || 0) * 0.10));
      const stealEnergy = Math.max(1, Math.floor(Number(pending.opponentEnergy || 0) * 0.10));

      let nextCoins = Number(state.coins || 0);
      let nextEnergy = Number(player.energy || 0);
      let msg = "";

      if (didWin) {
        nextCoins += stealCoins;
        nextEnergy = Math.min(Number(player.energyMax || 100), nextEnergy + stealEnergy);
        msg = `âš” KazandÄ±n â€¢ +${stealCoins} yton / +${stealEnergy} enerji`;
      } else {
        const loseCoins = Math.max(1, Math.floor(baseCoins * 0.10));
        const loseEnergy = Math.max(1, Math.floor(baseEnergy * 0.10));
        nextCoins = Math.max(0, nextCoins - loseCoins);
        nextEnergy = Math.max(0, nextEnergy - loseEnergy);
        msg = `ğŸ’¥ Kaybettin â€¢ -${loseCoins} yton / -${loseEnergy} enerji`;
      }

      store.set({
        coins: nextCoins,
        player: { ...player, energy: nextEnergy },
        pvp: {
          ...(state.pvp || {}),
          pendingVenueFight: {
            ...pending,
            settled: true,
            didWin,
          },
        },
      });

      this._showToast(msg, 2200);
      this._pendingFightId = null;
    };

    window.addEventListener("tc:pvp:win", () => settle(true));
    window.addEventListener("tc:pvp:lose", () => settle(false));
  }

  async _openPvp() {
    try {
      const s = this.store.get() || {};
      const p = s.player || {};
      const fightId = makeId("coffee_fight");
      this._pendingFightId = fightId;

      const pendingVenueFight = {
        fightId,
        source: "coffeeshop",
        selectedMode: "arena",
        playerCoinsAtStart: Number(s.coins || 0),
        playerEnergyAtStart: Number(p.energy || 0),
        opponentCoins: 120,
        opponentEnergy: 30,
        settled: false,
        createdAt: Date.now(),
      };

      this.store.set({
        pvp: {
          ...(s.pvp || {}),
          source: "coffeeshop",
          selectedMode: "arena",
          pendingVenueFight,
        },
      });

      this._ensurePvpShell();

      if (!window.TonCrimePVP_CAGE) {
        await new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-coffee-cage="1"]');
          if (existing && existing.dataset.loaded === "1") return resolve();
          const script = existing || document.createElement("script");
          if (!existing) {
            script.src = "./src/pvpcage.js";
            script.defer = true;
            script.dataset.coffeeCage = "1";
            document.body.appendChild(script);
          }
          script.onload = () => {
            script.dataset.loaded = "1";
            resolve();
          };
          script.onerror = () => reject(new Error("pvpcage.js yÃ¼klenemedi"));
        });
      }

      if (!window.TonCrimePVP_CAGE) {
        throw new Error("TonCrimePVP_CAGE bulunamadÄ±");
      }

      window.TonCrimePVP = window.TonCrimePVP_CAGE;
      window.TonCrimePVP.init?.({
        arenaId: "arena",
        statusId: "pvpStatus",
        enemyFillId: "enemyFill",
        meFillId: "meFill",
        enemyHpTextId: "enemyHpText",
        meHpTextId: "meHpText",
      });
      window.TonCrimePVP.setOpponent?.({
        username: "ShadowWolf",
        isBot: true,
      });

      await new Promise((r) => setTimeout(r, 120));
      window.TonCrimePVP.start?.();
      this._showToast("PvP aÃ§Ä±ldÄ±", 1000);
    } catch (err) {
      console.error("[CoffeeShop] PvP aÃ§Ä±lamadÄ±:", err);
      this._showToast("PvP aÃ§Ä±lamadÄ±", 1500);
    }
  }

  update() {
    const safe = this._safe();
    const px = this.input?.pointer?.x || 0;
    const py = this.input?.pointer?.y || 0;

    const topReserved = Number(this.store.get()?.ui?.hudReservedTop || 82);
    const bottomReserved = Number(this.store.get()?.ui?.chatReservedBottom || 82);

    const panelX = safe.x + 14;
    const panelY = safe.y + topReserved;
    const panelW = safe.w - 28;
    const panelH = safe.h - topReserved - bottomReserved - 10;
    const listY = panelY + 76;
    const listH = panelH - 88;
    const rowH = 84;
    const gap = 10;
    const contentH = this.items.length * (rowH + gap);
    this.maxScroll = Math.max(0, contentH - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    if (this.input?.justPressed?.()) {
      this.dragging = true;
      this.justDragged = false;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this._musicUnlocked = true;
      this._unlockFxAudio();
      this._playMusic();
    }

    if (this.dragging && this.input?.isDown?.()) {
      const dy = py - this.downY;
      if (Math.abs(dy) > 6) this.justDragged = true;
      this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
    }

    if (this.dragging && this.input?.justReleased?.()) {
      if (!this.justDragged) {
        if (this._pointInRect(px, py, this.hitClose)) {
          this.scenes.go("home");
          this.dragging = false;
          this.justDragged = false;
          return;
        }

        for (const hit of this.hitBuy) {
          if (this._pointInRect(px, py, hit.rect)) {
            this._buy(hit.item);
            break;
          }
        }
      }

      this.dragging = false;
      this.justDragged = false;
    }
  }

  render(ctx, w, h) {
    const safe = this._safe();
    const bg = this._getBg();

    this.hitBuy = [];
    this.hitPvp = null;
    this.hitClose = null;

    this._drawCover(ctx, bg, 0, 0, w, h);

    const overlay = ctx.createLinearGradient(0, 0, 0, h);
    overlay.addColorStop(0, "rgba(8,0,14,0.40)");
    overlay.addColorStop(1, "rgba(0,0,0,0.62)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, w, h);

    const shopState = this._syncDailyUsageState();
    const useCounts = shopState.itemUseCounts || {};
    const state = this.store.get() || {};
    const smokeRushStrength = this._getSmokeRushStrength();
    const topReserved = Number(state?.ui?.hudReservedTop || 82);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);

    ctx.save();
    if (smokeRushStrength > 0) {
      const now = Date.now();
      const sway = Math.sin(now / 185) * COFFEESHOP_RUSH_SWAY_PX * smokeRushStrength;
      const tilt = Math.sin(now / 250) * COFFEESHOP_RUSH_TILT_RAD * smokeRushStrength;
      const scale = 1 + 0.008 * smokeRushStrength;
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(tilt);
      ctx.scale(scale, scale);
      ctx.translate(-w * 0.5 + sway, -h * 0.5);
    }

    const panelX = safe.x + 14;
    const panelY = safe.y + topReserved;
    const panelW = safe.w - 28;
    const panelH = safe.h - topReserved - bottomReserved - 10;

    ctx.fillStyle = "rgba(10,8,14,0.62)";
    this._fillRoundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    this._strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 18);

    const titleX = panelX + 16;
    const titleY = panelY + 30;

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(this._ui("CoffeeShop", "Coffee Shop"), titleX, titleY);

    ctx.fillStyle = "rgba(255,214,160,0.78)";
    ctx.font = "600 12px system-ui";
    ctx.fillText(
      this._ui("Enerji topla, bagimliliga dikkat et.", "Stack energy, watch addiction."),
      titleX,
      panelY + 48
    );

    this.hitClose = { x: panelX + panelW - 44, y: panelY + 10, w: 30, h: 30 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    this._fillRoundRect(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    this._strokeRoundRect(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, 10);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "900 18px system-ui";
    ctx.fillText("X", this.hitClose.x + this.hitClose.w / 2, this.hitClose.y + 21);

    const listX = panelX + 10;
    const listY = panelY + 76;
    const listW = panelW - 20;
    const listH = panelH - 88;

    ctx.save();
    this._roundRect(ctx, listX, listY, listW, listH, 16);
    ctx.clip();

    const rowsBg = ctx.createLinearGradient(0, listY, 0, listY + listH);
    rowsBg.addColorStop(0, "rgba(0,0,0,0.14)");
    rowsBg.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = rowsBg;
    ctx.fillRect(listX, listY, listW, listH);

    let rowY = listY + 6 - this.scrollY;
    const rowH = 84;
    const gap = 10;

    for (const item of this.items) {
      if (rowY + rowH < listY - 20) {
        rowY += rowH + gap;
        continue;
      }
      if (rowY > listY + listH + 20) break;

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      this._fillRoundRect(ctx, listX + 2, rowY, listW - 4, rowH, 16);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      this._strokeRoundRect(ctx, listX + 2, rowY, listW - 4, rowH, 16);

      const rarity = String(item.rarity || "");
      const rColor = this._rarityColor(rarity);

      const itemImg = this._getItemImage(item);
      const addiction = this._getAddictionSnapshot(item, useCounts);
      this._drawItemThumb(ctx, itemImg, listX + 12, rowY + 12, 56);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 15px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(item.name, listX + 78, rowY + 22);

      ctx.fillStyle = rColor;
      ctx.font = "800 11px system-ui";
      ctx.fillText(`${this._ui("Sinif", "Class")}: ${this._rarityLabel(rarity)}`, listX + 78, rowY + 40);

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "12px system-ui";
      ctx.fillText(
        `+${addiction.effectiveGain} ${this._ui("enerji", "energy")}${addiction.penaltyPct ? ` (-${addiction.penaltyPct}%)` : ""}`,
        listX + 78,
        rowY + 58
      );

      ctx.fillStyle = "#ffd36c";
      ctx.font = "12px system-ui";
      ctx.fillText(`${item.price} yton`, listX + 78, rowY + 74);

      const buyRect = { x: listX + listW - 112, y: rowY + 18, w: 96, h: 40 };
      this.hitBuy.push({ rect: buyRect, item });

      const buyGrad = ctx.createLinearGradient(buyRect.x, buyRect.y, buyRect.x, buyRect.y + buyRect.h);
      buyGrad.addColorStop(0, "rgba(28,28,36,0.92)");
      buyGrad.addColorStop(1, "rgba(10,10,14,0.96)");
      ctx.fillStyle = buyGrad;
      this._fillRoundRect(ctx, buyRect.x, buyRect.y, buyRect.w, buyRect.h, 16);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      this._strokeRoundRect(ctx, buyRect.x, buyRect.y, buyRect.w, buyRect.h, 16);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "900 14px system-ui";
      ctx.fillText(this._ui("Satin Al", "Buy"), buyRect.x + buyRect.w / 2, buyRect.y + 24);

      rowY += rowH + gap;
    }

    ctx.restore();

    const contentH = this.items.length * (rowH + gap);
    if (contentH > listH) {
      const trackX = listX + listW - 5;
      const trackY = listY + 10;
      const trackH = listH - 20;
      const thumbH = Math.max(40, (listH / (this.maxScroll + listH)) * trackH);
      const ratio = this.scrollY / Math.max(1, this.maxScroll);
      const thumbY = trackY + (trackH - thumbH) * ratio;

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      this._fillRoundRect(ctx, trackX, trackY, 4, trackH, 3);
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      this._fillRoundRect(ctx, trackX, thumbY, 4, thumbH, 3);
    }

    if (this.toast && Date.now() < this.toastUntil) {
      const tw = Math.min(280, panelW - 40);
      const th = 36;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - 48;

      this._roundRect(ctx, tx, ty, tw, th, 12);
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = "700 12px system-ui";
      ctx.fillText(this.toast, tx + tw / 2, ty + 22);
    }

    ctx.restore();

    if (smokeRushStrength > 0) {
      const now = Date.now();
      const pulse = (Math.sin(now / 210) + 1) * 0.5;
      const drift = (Math.sin(now / 330) + 1) * 0.5;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = Math.min(0.40, 0.18 + 0.12 * smokeRushStrength);
      const veil = ctx.createLinearGradient(0, 0, w, h);
      veil.addColorStop(0, "rgba(230,255,210,0.16)");
      veil.addColorStop(0.28, "rgba(255,120,215,0.13)");
      veil.addColorStop(0.62, "rgba(255,232,80,0.12)");
      veil.addColorStop(1, "rgba(255,96,96,0.16)");
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, w, h);

      if ("filter" in ctx) ctx.filter = `blur(${18 + 16 * smokeRushStrength}px)`;

      const bursts = [
        { x: w * (0.18 + 0.06 * pulse), y: h * 0.24, rx: 130 + 40 * drift, ry: 76 + 24 * pulse, color: "rgba(103,255,134,0.30)" },
        { x: w * 0.76, y: h * (0.28 + 0.04 * drift), rx: 112 + 36 * pulse, ry: 70 + 18 * drift, color: "rgba(255,98,210,0.28)" },
        { x: w * (0.56 - 0.05 * drift), y: h * 0.70, rx: 144 + 38 * pulse, ry: 82 + 22 * drift, color: "rgba(255,236,92,0.26)" },
        { x: w * 0.30, y: h * (0.76 - 0.04 * pulse), rx: 118 + 30 * drift, ry: 74 + 20 * pulse, color: "rgba(255,92,92,0.24)" },
      ];

      for (const burst of bursts) {
        ctx.fillStyle = burst.color;
        ctx.beginPath();
        ctx.ellipse(burst.x, burst.y, burst.rx, burst.ry, 0.25, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(0.34, 0.16 + 0.11 * smokeRushStrength);
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      ctx.beginPath();
      ctx.ellipse(w * 0.52, h * (0.44 + 0.03 * pulse), 210 + 48 * pulse, 98 + 30 * drift, 0.15, 0, Math.PI * 2);
      ctx.fill();

      if ("filter" in ctx) ctx.filter = `blur(${26 + 18 * smokeRushStrength}px)`;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = Math.min(0.28, 0.14 + 0.10 * smokeRushStrength);
      ctx.fillStyle = "rgba(230,240,230,0.18)";
      ctx.beginPath();
      ctx.ellipse(w * (0.24 + 0.03 * drift), h * 0.30, 220 + 40 * pulse, 110 + 24 * drift, -0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * (0.70 - 0.04 * pulse), h * 0.62, 250 + 44 * drift, 126 + 28 * pulse, 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.48, h * 0.84, 200 + 36 * pulse, 88 + 20 * drift, 0.08, 0, Math.PI * 2);
      ctx.fill();

      if ("filter" in ctx) ctx.filter = "none";
      ctx.globalAlpha = Math.min(0.18, 0.08 + 0.05 * smokeRushStrength);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}
