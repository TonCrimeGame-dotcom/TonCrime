
// src/scenes/CoffeeShopScene.js

const ITEMS = [
  { id: "amnesia_haze", name: "Amnesia Haze", price: 10, energy: 3, rarity: "common", icon: "🌿" },
  { id: "white_widow", name: "White Widow", price: 12, energy: 4, rarity: "common", icon: "🌿" },
  { id: "northern_lights", name: "Northern Lights", price: 14, energy: 5, rarity: "common", icon: "🌿" },
  { id: "super_skunk", name: "Super Skunk", price: 16, energy: 6, rarity: "common", icon: "🌿" },
  { id: "purple_haze", name: "Purple Haze", price: 18, energy: 7, rarity: "common", icon: "🌿" },
  { id: "orange_bud", name: "Orange Bud", price: 20, energy: 8, rarity: "common", icon: "🌿" },
  { id: "blue_dream", name: "Blue Dream", price: 22, energy: 9, rarity: "rare", icon: "🌿" },
  { id: "gelato", name: "Gelato", price: 24, energy: 10, rarity: "rare", icon: "🌿" },
  { id: "gorilla_glue", name: "Gorilla Glue", price: 26, energy: 11, rarity: "rare", icon: "🌿" },
  { id: "green_crack", name: "Green Crack", price: 28, energy: 12, rarity: "rare", icon: "🌿" },
  { id: "ak47", name: "AK-47", price: 30, energy: 13, rarity: "rare", icon: "🌿" },
  { id: "super_silver", name: "Super Silver Haze", price: 32, energy: 14, rarity: "rare", icon: "🌿" },
  { id: "jack_herer", name: "Jack Herer", price: 34, energy: 15, rarity: "rare", icon: "🌿" },
  { id: "og_kush", name: "OG Kush", price: 36, energy: 16, rarity: "epic", icon: "🌿" },
  { id: "girl_scout", name: "Girl Scout Cookies", price: 38, energy: 17, rarity: "epic", icon: "🌿" },
  { id: "sour_diesel", name: "Sour Diesel", price: 40, energy: 18, rarity: "epic", icon: "🌿" },
  { id: "zkittlez", name: "Zkittlez", price: 42, energy: 19, rarity: "epic", icon: "🌿" },
  { id: "wedding_cake", name: "Wedding Cake", price: 44, energy: 20, rarity: "epic", icon: "🌿" },
  { id: "banana_kush", name: "Banana Kush", price: 46, energy: 21, rarity: "epic", icon: "🌿" },
  { id: "mimosa", name: "Mimosa", price: 48, energy: 22, rarity: "epic", icon: "🌿" },
  { id: "choco_haze", name: "Choco Haze", price: 50, energy: 23, rarity: "epic", icon: "🌿" },
  { id: "rainbow_belts", name: "Rainbow Belts", price: 53, energy: 24, rarity: "epic", icon: "🌿" },
  { id: "moon_rocks", name: "Moon Rocks", price: 56, energy: 25, rarity: "legendary", icon: "🌿" },
  { id: "ice_hash", name: "Ice Hash", price: 59, energy: 26, rarity: "legendary", icon: "🌿" },
  { id: "amsterdam_gold", name: "Amsterdam Gold", price: 62, energy: 27, rarity: "legendary", icon: "🌿" },
  { id: "black_tuna", name: "Black Tuna", price: 65, energy: 28, rarity: "legendary", icon: "🌿" },
  { id: "platinum_kush", name: "Platinum Kush", price: 68, energy: 29, rarity: "legendary", icon: "🌿" },
  { id: "ghost_train", name: "Ghost Train Haze", price: 71, energy: 30, rarity: "legendary", icon: "🌿" },
  { id: "diamond_resin", name: "Diamond Resin", price: 75, energy: 32, rarity: "legendary", icon: "🌿" },
  { id: "dam_crown", name: "Dam Crown", price: 80, energy: 35, rarity: "legendary", icon: "🌿" },
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
  }

  onEnter() {
    this.scrollY = 0;
    this.dragging = false;
    this.justDragged = false;
    this.hitBuy = [];
    this.hitPvp = null;
    this.hitClose = null;
    this._ensureState();
    this._bindPvpSettlement();
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
    const shop = s.coffeeshop || {};
    const inventory = s.inventory || {};
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
        raidCount: Number(shop.raidCount || 0),
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
    const shop = s.coffeeshop || {};
    const coins = Number(s.coins || 0);
    const price = Number(item.price || 0);
    const gain = Number(item.energy || 0);
    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 100));

    if (coins < price) {
      this._showToast("Yetersiz yton");
      return;
    }

    const nextShop = {
      ...shop,
      totalSpent: Number(shop.totalSpent || 0) + price,
      totalBought: Number(shop.totalBought || 0) + 1,
      inventoryBought: Number(shop.inventoryBought || 0),
    };

    if (energy < energyMax) {
      const nextEnergy = Math.min(energyMax, energy + gain);
      this.store.set({
        coins: coins - price,
        player: {
          ...p,
          energy: nextEnergy,
        },
        coffeeshop: nextShop,
      });
      this._showToast(`${item.name} kullanıldı • +${nextEnergy - energy} enerji`, 1500);
    } else {
      const inventoryItem = {
        id: `inv_coffee_${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: "consumable",
        icon: item.icon || "🌿",
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
        desc: "CoffeeShop ürünü.",
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
      this._showToast(`${item.name} envantere eklendi`, 1500);
    }

    if (chance(0.18)) this._applyRaid(item);
  }

  _applyRaid(item) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const shop = s.coffeeshop || {};
    const energy = Number(p.energy || 0);
    const lossEnergy = Math.max(3, Math.min(18, Math.ceil(Number(item.energy || 0) * 0.75)));
    const lossCoins = Math.max(2, Math.floor(Number(item.price || 0) * 0.18));

    this.store.set({
      coins: Math.max(0, Number(s.coins || 0) - lossCoins),
      player: {
        ...p,
        energy: Math.max(0, energy - lossEnergy),
      },
      coffeeshop: {
        ...shop,
        raidCount: Number(shop.raidCount || 0) + 1,
      },
    });

    this._showToast(`🥷 Soygun! -${lossEnergy} enerji / -${lossCoins} yton`, 1800);
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
          <div id="pvpStatus" style="font-weight:900;font-size:13px;color:rgba(255,255,255,0.92);">PvP • Yükleniyor...</div>
          <div id="pvpOpponentRow" style="font-size:12px;color:rgba(255,255,255,0.80);">
            <span id="pvpSpinner"></span> Rakip: <b id="pvpOpponent">ShadowWolf</b>
          </div>
        </div>
      </div>
      <div id="pvpBars" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;flex:0 0 auto;">
        <div>
          <div class="pvpBar" style="height:14px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);overflow:hidden;"><div id="enemyFill" style="height:100%;width:100%;transform-origin:left center;background:rgba(255,255,255,0.65);"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,0.95);margin-top:6px;"><span>Düşman</span><span id="enemyHpText">100</span></div>
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
        msg = `⚔ Kazandın • +${stealCoins} yton / +${stealEnergy} enerji`;
      } else {
        const loseCoins = Math.max(1, Math.floor(baseCoins * 0.10));
        const loseEnergy = Math.max(1, Math.floor(baseEnergy * 0.10));
        nextCoins = Math.max(0, nextCoins - loseCoins);
        nextEnergy = Math.max(0, nextEnergy - loseEnergy);
        msg = `💥 Kaybettin • -${loseCoins} yton / -${loseEnergy} enerji`;
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
          script.onerror = () => reject(new Error("pvpcage.js yüklenemedi"));
        });
      }

      if (!window.TonCrimePVP_CAGE) {
        throw new Error("TonCrimePVP_CAGE bulunamadı");
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
      this._showToast("PvP açıldı", 1000);
    } catch (err) {
      console.error("[CoffeeShop] PvP açılamadı:", err);
      this._showToast("PvP açılamadı", 1500);
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
    const listY = panelY + 104;
    const listH = panelH - 116;
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

        if (this._pointInRect(px, py, this.hitPvp)) {
          this._openPvp();
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

    const state = this.store.get() || {};
    const coins = Number(state.coins || 0);
    const topReserved = Number(state?.ui?.hudReservedTop || 82);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);

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
    ctx.fillText("CoffeeShop", titleX, titleY);

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffd36c";
    ctx.font = "900 12px system-ui";
    ctx.fillText(`YTON: ${fmtNum(coins)}`, panelX + panelW - 110, panelY + 24);

    this.hitClose = { x: panelX + panelW - 44, y: panelY + 10, w: 30, h: 30 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    this._fillRoundRect(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    this._strokeRoundRect(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, 10);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "900 18px system-ui";
    ctx.fillText("X", this.hitClose.x + this.hitClose.w / 2, this.hitClose.y + 21);

    this.hitPvp = { x: panelX + panelW - 126, y: panelY + 48, w: 104, h: 34 };
    const pvpGrad = ctx.createLinearGradient(this.hitPvp.x, this.hitPvp.y, this.hitPvp.x, this.hitPvp.y + this.hitPvp.h);
    pvpGrad.addColorStop(0, "rgba(170,34,46,0.72)");
    pvpGrad.addColorStop(1, "rgba(104,16,24,0.82)");
    ctx.fillStyle = pvpGrad;
    this._fillRoundRect(ctx, this.hitPvp.x, this.hitPvp.y, this.hitPvp.w, this.hitPvp.h, 12);
    ctx.strokeStyle = "rgba(255,180,180,0.22)";
    this._strokeRoundRect(ctx, this.hitPvp.x, this.hitPvp.y, this.hitPvp.w, this.hitPvp.h, 12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("⚔ PvP Saldır", this.hitPvp.x + this.hitPvp.w / 2, this.hitPvp.y + 22);

    const listX = panelX + 10;
    const listY = panelY + 104;
    const listW = panelW - 20;
    const listH = panelH - 116;

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
      this._drawItemThumb(ctx, itemImg, listX + 12, rowY + 12, 56);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 15px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(item.name, listX + 78, rowY + 22);

      ctx.fillStyle = rColor;
      ctx.font = "800 11px system-ui";
      ctx.fillText(`Sınıf: ${rarity}`, listX + 78, rowY + 40);

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "12px system-ui";
      ctx.fillText(`+${item.energy} enerji`, listX + 78, rowY + 58);

      ctx.fillStyle = "#ffd36c";
      ctx.font = "12px system-ui";
      ctx.fillText(`${item.price} yton`, listX + 182, rowY + 58);

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
      ctx.fillText("Satın Al", buyRect.x + buyRect.w / 2, buyRect.y + 24);

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
  }
}
