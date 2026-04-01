
function chance(prob) {
  return Math.random() < Number(prob || 0);
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

const NIGHTCLUB_SECURITY_WINDOW_MS = 10 * 60 * 1000;
const NIGHTCLUB_SECURITY_THRESHOLD = 4;
const NIGHTCLUB_SECURITY_RISK = 0.05;
const NIGHTCLUB_SECURITY_COIN_LOSS = 10;
const NIGHTCLUB_SECURITY_XP_LOSS = 10;
const NIGHTCLUB_ADDICTION_STEP = 10;
const NIGHTCLUB_ADDICTION_FIRST_DROP = 0.30;
const NIGHTCLUB_ADDICTION_NEXT_DROP = 0.10;
const NIGHTCLUB_ADDICTION_MIN_RATE = 0.10;
const NIGHTCLUB_RESET_TIMEZONE = "Europe/Istanbul";
const NIGHTCLUB_DIZZY_DURATION_MS = 3000;
const NIGHTCLUB_DIZZY_SWAY_PX = 10;
const NIGHTCLUB_DIZZY_TILT_RAD = 0.014;
const STARTING_LEVEL = 0;
const DEFAULT_XP_TO_NEXT = 100;

export class NightclubScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

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
    this._dizzyUntil = 0;
    this._dizzyStartedAt = 0;
    this._dizzyItemName = "";
    this._dizzyBoost = 1;

    this._music = null;
    this._musicUnlocked = false;
    this._pvpStartedFromNightclub = false;

    this._onFirstUserGesture = this._onFirstUserGesture.bind(this);
    this._onPvpWin = this._onPvpWin.bind(this);
    this._onPvpLose = this._onPvpLose.bind(this);

    this._bgFallback = new Image();
    this._bgFallback.src = "./src/assets/nightclub_bg.png";
    this._bgFallback.onerror = () => {
      try {
        if (this._bgFallback.src.includes("/src/assets/nightclub_bg.png")) {
          this._bgFallback.src = "./src/assets/nightclub-bg.png";
        } else if (this._bgFallback.src.includes("/src/assets/nightclub-bg.png")) {
          this._bgFallback.src = "./src/assets/nightclub.jpg";
        }
      } catch (_) {}
    };

    this._drinkImageCache = Object.create(null);

    this.items = [
      { id: "nc_alc_01", icon: "ğŸ¥ƒ", image: "./src/assets/street.png", name: "Street Whiskey", energy: 4, price: 12, rarity: "Sokak", marketValue: 18, desc: "Sert viski. HÄ±zlÄ± enerji." },
      { id: "nc_alc_02", icon: "ğŸº", image: "./src/assets/dark.png", name: "Dark Lager", energy: 5, price: 14, rarity: "Sokak", marketValue: 20, desc: "Ucuz ama iÅŸ gÃ¶rÃ¼r." },
      { id: "nc_alc_03", icon: "ğŸ·", image: "./src/assets/house.png", name: "House Red Wine", energy: 6, price: 17, rarity: "Sokak", marketValue: 24, desc: "Klasik kÄ±rmÄ±zÄ± ÅŸarap." },
      { id: "nc_alc_04", icon: "ğŸ¸", image: "./src/assets/neon.png", name: "Neon Martini", energy: 7, price: 20, rarity: "Sokak", marketValue: 28, desc: "Geceye uygun kokteyl." },
      { id: "nc_alc_05", icon: "ğŸ¥‚", image: "./src/assets/club.png", name: "Club Prosecco", energy: 8, price: 23, rarity: "KulÃ¼p", marketValue: 33, desc: "Hafif lÃ¼ks enerji iÃ§kisi." },
      { id: "nc_alc_06", icon: "ğŸ¹", image: "./src/assets/tropical.png", name: "Tropical Mix", energy: 9, price: 26, rarity: "KulÃ¼p", marketValue: 38, desc: "TatlÄ± ama etkili." },
      { id: "nc_alc_07", icon: "ğŸ¥ƒ", image: "./src/assets/oak.png", name: "Oak Reserve", energy: 10, price: 29, rarity: "KulÃ¼p", marketValue: 43, desc: "MeÅŸe fÄ±Ã§Ä± aromalÄ± viski." },
      { id: "nc_alc_08", icon: "ğŸ¾", image: "./src/assets/velvet.png", name: "Velvet Champagne", energy: 11, price: 33, rarity: "KulÃ¼p", marketValue: 48, desc: "KulÃ¼bÃ¼n imza ÅŸampanyasÄ±." },
      { id: "nc_alc_09", icon: "ğŸ·", image: "./src/assets/midnight.png", name: "Midnight Merlot", energy: 12, price: 36, rarity: "KulÃ¼p", marketValue: 53, desc: "Koyu ve yumuÅŸak iÃ§im." },
      { id: "nc_alc_10", icon: "ğŸ¸", image: "./src/assets/mafia.png", name: "Blue Venom", energy: 13, price: 40, rarity: "VIP", marketValue: 59, desc: "VIP katÄ±n Ã¼nlÃ¼ kokteyli." },
      { id: "nc_alc_11", icon: "ğŸ¥‚", image: "./src/assets/gold.png", name: "Gold Spark", energy: 14, price: 44, rarity: "VIP", marketValue: 65, desc: "AltÄ±n pullu premium kÃ¶pÃ¼k." },
      { id: "nc_alc_12", icon: "ğŸº", image: "./src/assets/dark.png", name: "Imperial Stout", energy: 15, price: 48, rarity: "VIP", marketValue: 71, desc: "YoÄŸun ve aÄŸÄ±r bira." },
      { id: "nc_alc_13", icon: "ğŸ¥ƒ", image: "./src/assets/blackbarrel.png", name: "Black Barrel", energy: 16, price: 52, rarity: "VIP", marketValue: 77, desc: "YÃ¼ksek dereceli viski." },
      { id: "nc_alc_14", icon: "ğŸ¾", image: "./src/assets/club.png", name: "Diamond Brut", energy: 17, price: 56, rarity: "VIP", marketValue: 84, desc: "Daha sert premium kÃ¶pÃ¼k." },
      { id: "nc_alc_15", icon: "ğŸ¸", image: "./src/assets/kiss.png", name: "Crimson Kiss", energy: 18, price: 61, rarity: "Elite", marketValue: 91, desc: "Elite kokteyl serisi." },
      { id: "nc_alc_16", icon: "ğŸ·", image: "./src/assets/house.png", name: "Royal Cabernet", energy: 19, price: 66, rarity: "Elite", marketValue: 98, desc: "Uzun yÄ±llanmÄ±ÅŸ ÅŸarap." },
      { id: "nc_alc_17", icon: "ğŸ¥‚", image: "./src/assets/rose.png", name: "Imperial RosÃ©", energy: 20, price: 71, rarity: "Elite", marketValue: 106, desc: "Pazar deÄŸeri yÃ¼ksek." },
      { id: "nc_alc_18", icon: "ğŸ¹", image: "./src/assets/sunset.png", name: "Electric Sunset", energy: 21, price: 76, rarity: "Elite", marketValue: 114, desc: "Nadir gece kokteyli." },
      { id: "nc_alc_19", icon: "ğŸ¥ƒ", image: "./src/assets/smoked.png", name: "Smoked Bourbon", energy: 22, price: 82, rarity: "Elite", marketValue: 123, desc: "Duman aromalÄ± bourbon." },
      { id: "nc_alc_20", icon: "ğŸ¾", image: "./src/assets/prestige.png", name: "Velour Prestige", energy: 23, price: 88, rarity: "Legend", marketValue: 132, desc: "Legend sÄ±nÄ±fÄ± ÅŸampanya." },
      { id: "nc_alc_21", icon: "ğŸ¸", image: "./src/assets/phantom.png", name: "Phantom Dry", energy: 24, price: 94, rarity: "Legend", marketValue: 141, desc: "Nadir dry martini." },
      { id: "nc_alc_22", icon: "ğŸ¥‚", image: "./src/assets/saint.png", name: "Crystal Reserve", energy: 25, price: 101, rarity: "Legend", marketValue: 151, desc: "Saf premium seri." },
      { id: "nc_alc_23", icon: "ğŸ¥ƒ", image: "./src/assets/king.png", name: "King's Cask", energy: 26, price: 108, rarity: "Legend", marketValue: 162, desc: "Koleksiyonluk fÄ±Ã§Ä± seÃ§kisi." },
      { id: "nc_alc_24", icon: "ğŸ·", image: "./src/assets/velvet.png", name: "Velvet Noir", energy: 27, price: 115, rarity: "Legend", marketValue: 173, desc: "En pahalÄ± kÄ±rmÄ±zÄ±." },
      { id: "nc_alc_25", icon: "ğŸ¾", image: "./src/assets/obsidian.png", name: "Obsidian Gold", energy: 28, price: 123, rarity: "Mythic", marketValue: 185, desc: "Ã‡ok nadir kulÃ¼p ÅŸiÅŸesi." },
      { id: "nc_alc_26", icon: "ğŸ¸", image: "./src/assets/night.png", name: "Night Crown", energy: 29, price: 131, rarity: "Mythic", marketValue: 197, desc: "Ã–zel menÃ¼ kokteyli." },
      { id: "nc_alc_27", icon: "ğŸ¥‚", image: "./src/assets/saint.png", name: "Saint Royale", energy: 30, price: 140, rarity: "Mythic", marketValue: 210, desc: "Ã–zel etkinlik serisi." },
      { id: "nc_alc_28", icon: "ğŸ¥ƒ", image: "./src/assets/mafia.png", name: "Mafia Reserve", energy: 31, price: 149, rarity: "Mythic", marketValue: 224, desc: "AÄŸÄ±r premium viski." },
      { id: "nc_alc_29", icon: "ğŸ¾", image: "./src/assets/luxe.png", name: "TonCrime Luxe", energy: 33, price: 159, rarity: "Mythic", marketValue: 239, desc: "TonCrime Ã¶zel seri." },
      { id: "nc_alc_30", icon: "ğŸ¥‚", image: "./src/assets/obsidian.png", name: "Black Diamond Brut", energy: 35, price: 170, rarity: "Mythic", marketValue: 255, desc: "En Ã¼st seviye ÅŸiÅŸe." },
    ];
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
    this._syncDailyToleranceState();
    this._setupMusic();
    this._playMusic();
    this._bindEvents();
    this._registerEntrySecurityRisk();

    this._pushSystemChat(
      this._ui(
        `ğŸª© ${this._playerName()} Nightclub'a girdi.`,
        `ğŸª© ${this._playerName()} entered the Nightclub.`
      )
    );
  }

  onExit() {
    this.dragging = false;
    this._pauseMusic();
    this._unbindEvents();
    this._pushSystemChat(
      this._ui(
        `ğŸšª ${this._playerName()} Nightclub'dan cikti.`,
        `ğŸšª ${this._playerName()} left the Nightclub.`
      )
    );
  }

  _ensureState() {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = this._syncDailyToleranceState();
    const inventory = s.inventory || {};
    const pvp = s.pvp || {};
    const dayKey = this._todayKey();
    const itemUseCounts = this._normalizeItemUseCounts(nightclub.itemUseCounts);

    this.store.set({
      player: {
        ...p,
        energy: Number(p.energy ?? 10),
        energyMax: Number(p.energyMax ?? 100),
      },
      inventory: {
        ...inventory,
        items: Array.isArray(inventory.items) ? inventory.items : [],
      },
      pvp: {
        wins: Number(pvp.wins || 0),
        losses: Number(pvp.losses || 0),
        rating: Number(pvp.rating || 1000),
        currentOpponent: pvp.currentOpponent || null,
        leaderboard: Array.isArray(pvp.leaderboard) ? pvp.leaderboard : [],
        history: Array.isArray(pvp.history) ? pvp.history : [],
      },
      nightclub: {
        totalSpent: Number(nightclub.totalSpent || 0),
        totalBought: Number(nightclub.totalBought || 0),
        lastRaidAt: Number(nightclub.lastRaidAt || 0),
        raidCount: Number(nightclub.raidCount || 0),
        inventoryBought: Number(nightclub.inventoryBought || 0),
        pvpWins: Number(nightclub.pvpWins || 0),
        pvpLosses: Number(nightclub.pvpLosses || 0),
        lastPvpAt: Number(nightclub.lastPvpAt || 0),
        usageDayKey: String(nightclub.usageDayKey || dayKey),
        itemUseCounts,
        lastToleranceTier: Number(nightclub.lastToleranceTier || 0),
        securityHits: Number(nightclub.securityHits || 0),
        lastSecurityAt: Number(nightclub.lastSecurityAt || 0),
        recentEntryTs: ensureArray(nightclub.recentEntryTs)
          .map((x) => Number(x || 0))
          .filter((x) => Number.isFinite(x) && x > 0),
      },
    });
  }

  _bindEvents() {
    window.addEventListener("pointerdown", this._onFirstUserGesture, { passive: true });
    window.addEventListener("touchstart", this._onFirstUserGesture, { passive: true });
    window.addEventListener("tc:pvp:win", this._onPvpWin);
    window.addEventListener("tc:pvp:lose", this._onPvpLose);
  }

  _unbindEvents() {
    window.removeEventListener("pointerdown", this._onFirstUserGesture);
    window.removeEventListener("touchstart", this._onFirstUserGesture);
    window.removeEventListener("tc:pvp:win", this._onPvpWin);
    window.removeEventListener("tc:pvp:lose", this._onPvpLose);
  }

  _onFirstUserGesture() {
    this._musicUnlocked = true;
    this._playMusic();
  }

  _setupMusic() {
    if (this._music) return;

    try {
      this._music = new Audio("./src/assets/club.mp3");
      this._music.loop = true;
      this._music.volume = 0.38;
      this._music.preload = "auto";
    } catch (_) {
      this._music = null;
    }
  }

  _playMusic() {
    if (!this._music) return;
    if (!this._musicUnlocked) return;

    const state = this.store.get() || {};
    const musicEnabled = state?.settings?.music !== false;

    if (!musicEnabled) return;

    this._music.play().catch(() => {});
  }

  _pauseMusic() {
    try {
      this._music?.pause();
    } catch (_) {}
  }

  _onPvpWin(ev) {
    if (!this._pvpStartedFromNightclub) return;
    this._pvpStartedFromNightclub = false;
    this._applyPvpResult("win", ev?.detail || {});
  }

  _onPvpLose(ev) {
    if (!this._pvpStartedFromNightclub) return;
    this._pvpStartedFromNightclub = false;
    this._applyPvpResult("lose", ev?.detail || {});
  }

  _applyPvpResult(result, detail = {}) {
    const s = this.store.get() || {};
    const pvp = s.pvp || {};
    const nightclub = this._syncDailyToleranceState();
    const playerName = this._playerName();
    const opponentName = String(detail?.opponent?.username || "Rakip");
    const now = Date.now();

    const wins = Number(pvp.wins || 0) + (result === "win" ? 1 : 0);
    const losses = Number(pvp.losses || 0) + (result === "lose" ? 1 : 0);
    const ratingChange = result === "win" ? 14 : -10;
    const rating = Math.max(0, Number(pvp.rating || 1000) + ratingChange);

    const prevBoard = Array.isArray(pvp.leaderboard) ? pvp.leaderboard.map((x) => ({ ...x })) : [];
    const prevHistory = Array.isArray(pvp.history) ? pvp.history.map((x) => ({ ...x })) : [];

    let meEntry = prevBoard.find((x) => x.id === "player_main");
    if (!meEntry) {
      meEntry = {
        id: "player_main",
        username: playerName,
        wins: 0,
        losses: 0,
        rating: Number(pvp.rating || 1000),
        source: "nightclub",
      };
      prevBoard.push(meEntry);
    }

    meEntry.username = playerName;
    meEntry.wins = wins;
    meEntry.losses = losses;
    meEntry.rating = rating;
    meEntry.source = "nightclub";

    prevBoard.sort((a, b) => {
      const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return Number(b.wins || 0) - Number(a.wins || 0);
    });

    const rankedBoard = prevBoard.slice(0, 50).map((row, idx) => ({
      ...row,
      rank: idx + 1,
    }));

    prevHistory.unshift({
      id: `nightclub_pvp_${now}`,
      result,
      opponent: opponentName,
      ts: now,
      source: "nightclub",
      ratingAfter: rating,
    });

    this.store.set({
      pvp: {
        ...pvp,
        wins,
        losses,
        rating,
        currentOpponent: detail?.opponent || null,
        leaderboard: rankedBoard,
        history: prevHistory.slice(0, 30),
      },
      nightclub: {
        ...nightclub,
        pvpWins: Number(nightclub.pvpWins || 0) + (result === "win" ? 1 : 0),
        pvpLosses: Number(nightclub.pvpLosses || 0) + (result === "lose" ? 1 : 0),
        lastPvpAt: now,
      },
    });

    if (result === "win") {
      this._showToast(`ğŸ† PvP kazandÄ±n â€¢ ${opponentName}`, 1800);
      this._pushSystemChat(`ğŸ† ${playerName}, ${opponentName} karÅŸÄ±sÄ±nda PvP kazandÄ±.`);
    } else {
      this._showToast(`ğŸ’¥ PvP kaybettin â€¢ ${opponentName}`, 1800);
      this._pushSystemChat(`ğŸ’¥ ${playerName}, ${opponentName} karÅŸÄ±sÄ±nda PvP kaybetti.`);
    }
  }

  _playerName() {
    const s = this.store.get() || {};
    return String(s?.player?.username || "Player");
  }

  _safe() {
    const s = this.store.get() || {};
    return s?.ui?.safe || {
      x: 0,
      y: 0,
      w: window.innerWidth || 390,
      h: window.innerHeight || 844,
    };
  }

  _showToast(text, ms = 1400) {
    this.toast = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _fitText(ctx, text, maxWidth) {
    const src = String(text || "");
    if (!src || maxWidth <= 10) return "";
    if (ctx.measureText(src).width <= maxWidth) return src;
    let out = src;
    while (out.length > 1 && ctx.measureText(out + "â€¦").width > maxWidth) {
      out = out.slice(0, -1);
    }
    return out ? out + "â€¦" : "";
  }

  _getDrinkVisual(src) {
    const key = String(src || "").trim();
    if (!key) return null;
    if (this._drinkImageCache[key]) return this._drinkImageCache[key];
    try {
      const img = new Image();
      img.src = key;
      img.onerror = () => {
        try {
          if (img.src.includes("/src/assets/")) {
            const candidate = key.replace("/src/assets/", "/src/assets/nightclub_drinks/");
            if (candidate !== key && !img.__tcTriedAlt) {
              img.__tcTriedAlt = true;
              img.src = candidate;
            }
          } else if (img.src.includes("/src/assets/nightclub_drinks/")) {
            const candidate = key.replace("/src/assets/nightclub_drinks/", "/src/assets/");
            if (candidate !== key && !img.__tcTriedAlt) {
              img.__tcTriedAlt = true;
              img.src = candidate;
            }
          }
        } catch (_) {}
      };
      this._drinkImageCache[key] = img;
      return img;
    } catch (_) {
      return null;
    }
  }

  _drawDrinkVisual(ctx, item, x, y, w, h) {
    const img = this._getDrinkVisual(item?.image);
    if (img?.complete && (img.naturalWidth || img.width)) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      this._fillRoundRect(ctx, x, y, w, h, 12);
      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;
      const scale = Math.min((w - 8) / iw, (h - 8) / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = x + (w - dw) / 2;
      const dy = y + (h - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
      return;
    }

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    this._fillRoundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 24px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item?.icon || "ğŸ¾", x + w / 2, y + h / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  _getBg() {
    const directBg = this._bgFallback;
    if (directBg?.complete && (directBg.naturalWidth || directBg.width)) return directBg;
    if (typeof this.assets?.getImage === "function") {
      return this.assets.getImage("nightclub_bg") || this.assets.getImage("nightclub-bg");
    }
    if (typeof this.assets?.get === "function") {
      return this.assets.get("nightclub_bg") || this.assets.get("nightclub-bg");
    }
    if (this.assets?.images instanceof Map) {
      const entry = this.assets.images.get("nightclub_bg") || this.assets.images.get("nightclub-bg");
      return entry?.img || null;
    }
    return this.assets?.images?.nightclub_bg || this.assets?.images?.nightclub-bg || null;
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

  _fillRoundRect(ctx, x, y, w, h, r) {
    this._roundRect(ctx, x, y, w, h, r);
    ctx.fill();
  }

  _strokeRoundRect(ctx, x, y, w, h, r) {
    this._roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  }

  _pointInRect(px, py, r) {
    return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  _fmt(n) {
    return Number(n || 0).toLocaleString(this._lang() === "en" ? "en-US" : "tr-TR");
  }

  _todayKey() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: NIGHTCLUB_RESET_TIMEZONE,
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

  _syncDailyToleranceState() {
    const s = this.store.get() || {};
    const nightclub = s.nightclub || {};
    const dayKey = this._todayKey();
    const currentDayKey = String(nightclub.usageDayKey || "");
    const normalized = this._normalizeItemUseCounts(nightclub.itemUseCounts);

    if (currentDayKey !== dayKey) {
      const nextNightclub = {
        ...nightclub,
        usageDayKey: dayKey,
        itemUseCounts: {},
        lastToleranceTier: 0,
      };
      this.store.set({ nightclub: nextNightclub });
      return nextNightclub;
    }

    return {
      ...nightclub,
      usageDayKey: dayKey,
      itemUseCounts: normalized,
      lastToleranceTier: Number(nightclub.lastToleranceTier || 0),
    };
  }

  _getUseCount(itemId) {
    const nightclub = this._syncDailyToleranceState();
    return Math.max(0, Number(nightclub.itemUseCounts?.[String(itemId || "")] || 0));
  }

  _getToleranceRate(nextUseCount) {
    const step = Math.floor(Math.max(0, Number(nextUseCount || 0)) / NIGHTCLUB_ADDICTION_STEP);
    if (step <= 0) return 1;
    const baseRate = 1 - NIGHTCLUB_ADDICTION_FIRST_DROP - Math.max(0, step - 1) * NIGHTCLUB_ADDICTION_NEXT_DROP;
    return Math.max(NIGHTCLUB_ADDICTION_MIN_RATE, Math.min(1, baseRate));
  }

  _getToleranceSnapshot(item, useCounts = null) {
    const uses = useCounts && typeof useCounts === "object"
      ? Math.max(0, Number(useCounts[String(item?.id || "")] || 0))
      : this._getUseCount(item?.id);
    const nextUseCount = uses + 1;
    const tierBefore = Math.floor(uses / NIGHTCLUB_ADDICTION_STEP);
    const tierAfter = Math.floor(nextUseCount / NIGHTCLUB_ADDICTION_STEP);
    const rate = this._getToleranceRate(nextUseCount);
    const baseGain = Math.max(0, Number(item?.energy || 0));
    const effectiveGain = baseGain <= 0 ? 0 : Math.max(1, Math.floor(baseGain * rate));
    const penaltyPct = Math.max(0, Math.round((1 - rate) * 100));

    return {
      uses,
      nextUseCount,
      tierBefore,
      tierAfter,
      tierIncreased: tierAfter > tierBefore,
      rate,
      effectiveGain,
      penaltyPct,
    };
  }

  _trackItemUse(itemId, nextUseCount, nextTier = 0) {
    const nightclub = this._syncDailyToleranceState();
    const nextCounts = {
      ...this._normalizeItemUseCounts(nightclub.itemUseCounts),
      [String(itemId || "")]: Math.max(0, Math.floor(Number(nextUseCount || 0))),
    };

    const nextNightclub = {
      ...nightclub,
      usageDayKey: this._todayKey(),
      itemUseCounts: nextCounts,
      lastToleranceTier: Math.max(Number(nightclub.lastToleranceTier || 0), Number(nextTier || 0)),
    };

    this.store.set({ nightclub: nextNightclub });
    return nextNightclub;
  }

  _triggerDizzyEffect(item, meta = {}) {
    const tier = Number(meta?.tierAfter ?? meta?.tier ?? meta ?? 0);
    const penaltyPct = Math.max(0, Number(meta?.penaltyPct || 0));
    const tierIncreased = !!meta?.tierIncreased;
    this._dizzyStartedAt = Date.now();
    this._dizzyUntil = this._dizzyStartedAt + NIGHTCLUB_DIZZY_DURATION_MS;
    this._dizzyItemName = String(item?.name || "");
    this._dizzyBoost = Math.min(1.8, 1 + penaltyPct / 55 + (tierIncreased ? 0.18 : 0));

    this._showToast(
      this._ui(
        `${this._dizzyItemName || "Icecek"} toleransi yukseldi, basin donuyor`,
        `${this._dizzyItemName || "Drink"} tolerance climbed, your head is spinning`
      ),
      2000
    );
    this._pushSystemChat(
      this._ui(
        `${this._playerName()} icin ${this._dizzyItemName || "icecek"} toleransi yukseldi (seviye ${tier}, -%${penaltyPct}). Bas donmesi etkisi tetiklendi.`,
        `${this._playerName()}'s ${this._dizzyItemName || "drink"} tolerance increased (tier ${tier}, -${penaltyPct}%). Dizzy effect triggered.`
      )
    );
  }

  _getDizzyStrength(now = Date.now()) {
    if (!this._dizzyUntil || now >= this._dizzyUntil) return 0;
    const duration = Math.max(1, NIGHTCLUB_DIZZY_DURATION_MS);
    const remaining = Math.max(0, (this._dizzyUntil - now) / duration);
    return Math.max(0, Math.min(1.8, Math.pow(remaining, 0.78) * Number(this._dizzyBoost || 1)));
  }

  _rarityLabel(rarity) {
    const raw = String(rarity || "").toLowerCase();
    if (this._lang() !== "en") return String(rarity || "");

    if (raw.includes("sok")) return "Street";
    if (raw.includes("kul")) return "Club";
    if (raw.includes("keskin")) return "Sniper";
    if (raw.includes("a")) {
      if (raw.includes("elit")) return "Elite";
      if (raw.includes("vip")) return "VIP";
    }
    if (raw.includes("legend")) return "Legend";
    if (raw.includes("mythic")) return "Mythic";
    return String(rarity || "");
  }

  _applyXpLoss(amount = 0) {
    const s = this.store.get() || {};
    const p = s.player || {};
    let loss = Math.max(0, Number(amount || 0));
    let level = Math.max(STARTING_LEVEL, Number(p.level ?? STARTING_LEVEL));
    let xp = Math.max(0, Number(p.xp || 0));
    let xpToNext = Math.max(1, Number(p.xpToNext || DEFAULT_XP_TO_NEXT));

    while (loss > 0) {
      if (xp >= loss) {
        xp -= loss;
        loss = 0;
        break;
      }

      loss -= xp;
      if (level > STARTING_LEVEL) {
        level -= 1;
        xpToNext = DEFAULT_XP_TO_NEXT;
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
      level,
      xp,
      xpLost: Math.max(0, Number(amount || 0)),
      levelDropped: level < Math.max(STARTING_LEVEL, Number(p.level ?? STARTING_LEVEL)),
    };
  }

  _registerEntrySecurityRisk() {
    const s = this.store.get() || {};
    const nightclub = s.nightclub || {};
    const isPremium = !!s.premium;
    const now = Date.now();
    const recentEntryTs = ensureArray(nightclub.recentEntryTs)
      .map((x) => Number(x || 0))
      .filter((x) => Number.isFinite(x) && now - x <= NIGHTCLUB_SECURITY_WINDOW_MS);
    recentEntryTs.push(now);

    this.store.set({
      nightclub: {
        ...nightclub,
        recentEntryTs,
      },
    });

    if (isPremium || recentEntryTs.length < NIGHTCLUB_SECURITY_THRESHOLD) return;
    if (!chance(NIGHTCLUB_SECURITY_RISK)) return;

    const coinLoss = Math.min(NIGHTCLUB_SECURITY_COIN_LOSS, Math.max(0, Number(s.coins || 0)));
    const xpLoss = NIGHTCLUB_SECURITY_XP_LOSS;
    const xpResult = this._applyXpLoss(xpLoss);

    this.store.set({
      coins: Math.max(0, Number(this.store.get()?.coins || 0) - coinLoss),
      nightclub: {
        ...(this.store.get()?.nightclub || {}),
        securityHits: Number(this.store.get()?.nightclub?.securityHits || 0) + 1,
        lastSecurityAt: now,
        recentEntryTs,
      },
    });

    this._showToast(
      this._ui(
        "GÃœVENLÄ°KLER SENÄ° FENA BENZETTÄ°",
        "SECURITY MESSED YOU UP BAD"
      ),
      2400
    );
    this._pushSystemChat(
      this._ui(
        `ğŸ›¡ï¸ GÃœVENLÄ°KLER SENÄ° FENA BENZETTÄ°. ${this._playerName()} -${coinLoss} yton ve -${xpLoss} XP kaybetti${xpResult.levelDropped ? " (seviye dustu)" : ""}.`,
        `ğŸ›¡ï¸ SECURITY MESSED YOU UP BAD. ${this._playerName()} lost ${coinLoss} yton and ${xpLoss} XP${xpResult.levelDropped ? " (level dropped)" : ""}.`
      )
    );
  }

  _rarityColor(rarity) {
    switch (String(rarity || "").toLowerCase()) {
      case "sokak":
        return "#b0b6c2";
      case "kulÃ¼p":
        return "#7fd0ff";
      case "vip":
        return "#ff9ecb";
      case "elite":
        return "#c77dff";
      case "legend":
        return "#ffc86b";
      case "mythic":
        return "#ff6b6b";
      default:
        return "#ffffff";
    }
  }

  _drawCover(ctx, img, x, y, w, h) {
    if (!img) {
      ctx.fillStyle = "#130b11";
      ctx.fillRect(x, y, w, h);
      return;
    }

    const iw = img.width || img.naturalWidth || 1;
    const ih = img.height || img.naturalHeight || 1;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  _clampScroll(viewH, contentH) {
    this.maxScroll = Math.max(0, contentH - viewH);
    if (this.scrollY < 0) this.scrollY = 0;
    if (this.scrollY > this.maxScroll) this.scrollY = this.maxScroll;
  }

  _escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  _pushSystemChat(text) {
    const s = this.store.get() || {};
    const chat = Array.isArray(s.chatLog) ? s.chatLog.slice(-79) : [];
    const ts = Date.now();

    chat.push({
      id: `sys_${ts}_${Math.random().toString(36).slice(2, 7)}`,
      type: "system",
      username: "SYSTEM",
      text: String(text || ""),
      ts,
    });

    this.store.set({ chatLog: chat });

    try {
      window.dispatchEvent(
        new CustomEvent("tc:chat:push", {
          detail: {
            id: `sys_${ts}`,
            type: "system",
            username: "SYSTEM",
            text: String(text || ""),
            ts,
          },
        })
      );
    } catch (_) {}

    try {
      const el = document.getElementById("chatMessages");
      if (el) {
        const row = document.createElement("div");
        row.className = "msg";

        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");

        row.innerHTML = `
          <span class="meta">${hh}:${mm}</span>
          <span><b>SYSTEM</b> ${this._escapeHtml(String(text || ""))}</span>
        `;
        el.appendChild(row);
        el.scrollTop = el.scrollHeight;
      }
    } catch (_) {}
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

async _loadScriptOnce(srcList = []) {
    const list = Array.isArray(srcList) ? srcList : [srcList];
    for (const src of list) {
      if (!src) continue;
      const existing = document.querySelector(`script[data-nightclub-pvp="${src}"]`);
      if (existing?.dataset.loaded === "1") return src;
      try {
        await new Promise((resolve, reject) => {
          const el = existing || document.createElement("script");
          if (!existing) {
            el.src = src;
            el.defer = true;
            el.dataset.nightclubPvp = src;
            document.body.appendChild(el);
          }
          const ok = () => {
            el.dataset.loaded = "1";
            resolve(src);
          };
          const fail = () => reject(new Error(`yÃ¼klenemedi: ${src}`));
          el.addEventListener("load", ok, { once: true });
          el.addEventListener("error", fail, { once: true });
        });
        return src;
      } catch (_) {}
    }
    throw new Error("pvpcage.js yÃ¼klenemedi");
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
    wrap.style.zIndex = "7000";
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
          <div id="pvpStatus" style="font-weight:900;font-size:13px;color:rgba(255,255,255,0.92);">PvP â€¢ Kafes DÃ¶vÃ¼ÅŸÃ¼ yÃ¼kleniyor...</div>
          <div id="pvpOpponentRow" style="font-size:12px;color:rgba(255,255,255,0.80);">
            <span id="pvpSpinner" style="display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,0.25);border-top-color:rgba(255,255,255,0.85);vertical-align:-2px;margin-right:8px;"></span>
            Rakip: <b id="pvpOpponent" style="color:rgba(255,255,255,0.95);">ShadowWolf</b>
          </div>
        </div>
        <div class="pvpBtns" style="display:flex;gap:8px;">
          <button class="pvpBtn" id="pvpStart" type="button" style="display:none;">BaÅŸlat</button>
          <button class="pvpBtn" id="pvpStop" type="button" style="display:none;">Durdur</button>
          <button class="pvpBtn" id="pvpReset" type="button" style="display:none;">SÄ±fÄ±rla</button>
        </div>
      </div>
      <div id="pvpBars" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;flex:0 0 auto;">
        <div>
          <div class="pvpBar" style="height:14px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);overflow:hidden;"><div class="pvpFill" id="enemyFill" style="height:100%;width:100%;transform-origin:left center;background:rgba(255,255,255,0.65);"></div></div>
          <div class="pvpBarLabel" style="display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,0.95);margin-top:6px;"><span>DÃ¼ÅŸman</span><span id="enemyHpText">100</span></div>
        </div>
        <div>
          <div class="pvpBar" style="height:14px;border-radius:10px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);overflow:hidden;"><div class="pvpFill" id="meFill" style="height:100%;width:100%;transform-origin:left center;background:rgba(255,255,255,0.65);"></div></div>
          <div class="pvpBarLabel" style="display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,0.95);margin-top:6px;"><span>Sen</span><span id="meHpText">100</span></div>
        </div>
      </div>
      <div id="arena" style="position:relative;flex:1 1 auto;min-height:280px;width:calc(100% - 20px);margin:0 10px 10px;border-radius:14px;background:rgba(0,0,0,0.92);overflow:hidden;box-sizing:border-box;"></div>
    `;

    const arena = document.getElementById("arena");
    const status = document.getElementById("pvpStatus");
    const spinner = document.getElementById("pvpSpinner");
    const enemyFill = document.getElementById("enemyFill");
    const meFill = document.getElementById("meFill");
    const enemyHpText = document.getElementById("enemyHpText");
    const meHpText = document.getElementById("meHpText");

    return { arena, status, spinner, enemyFill, meFill, enemyHpText, meHpText };
  }

  async _openPvp() {
    try {
      const s = this.store.get() || {};
      this.store.set({
        pvp: {
          ...(s.pvp || {}),
          source: "nightclub",
          selectedMode: "arena",
        },
      });

      const shell = this._ensurePvpShell();
      await this._loadScriptOnce(["./src/pvpcage.js", "./pvpcage.js"]);

      if (!window.TonCrimePVP_CAGE) throw new Error("TonCrimePVP_CAGE bulunamadÄ±");

      window.TonCrimePVP = window.TonCrimePVP_CAGE;
      window.TonCrimePVP.init?.({
        arenaId: "arena",
        statusId: "pvpStatus",
        enemyFillId: "enemyFill",
        meFillId: "meFill",
        enemyHpTextId: "enemyHpText",
        meHpTextId: "meHpText",
      });
      window.TonCrimePVP.setOpponent?.({ username: "ShadowWolf", isBot: true });
      await new Promise((r) => setTimeout(r, 120));
      window.TonCrimePVP.start?.();

      if (shell.status) shell.status.textContent = "PvP â€¢ Kafes DÃ¶vÃ¼ÅŸÃ¼ baÅŸladÄ±";
      if (shell.spinner) shell.spinner.style.display = "none";
      this._showToast("Kafes DÃ¶vÃ¼ÅŸÃ¼ aÃ§Ä±ldÄ±");
      this._pushSystemChat(`âš”ï¸ ${this._playerName()} Nightclub iÃ§inden Kafes DÃ¶vÃ¼ÅŸÃ¼ baÅŸlattÄ±.`);
    } catch (err) {
      console.error("[Nightclub] PvP aÃ§Ä±lamadÄ±:", err);
      this._showToast("PvP aÃ§Ä±lamadÄ±", 1800);
    }
  }

  _applyPoliceRaid(item) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = s.nightclub || {};

    const energy = Number(p.energy || 0);
    const lossEnergy = Math.max(4, Math.min(22, Math.ceil(Number(item.energy || 0) * 0.8)));
    const lossCoins = Math.max(3, Math.floor(Number(item.price || 0) * 0.18));

    this.store.set({
      coins: Math.max(0, Number(s.coins || 0) - lossCoins),
      player: {
        ...p,
        energy: Math.max(0, energy - lossEnergy),
      },
      nightclub: {
        ...nightclub,
        lastRaidAt: Date.now(),
        raidCount: Number(nightclub.raidCount || 0) + 1,
      },
    });

    this._showToast(
      this._ui(
        `ğŸš“ Polis baskini! -${lossEnergy} enerji / -${lossCoins} yton`,
        `ğŸš“ Police raid! -${lossEnergy} energy / -${lossCoins} yton`
      ),
      1800
    );
    this._pushSystemChat(
      this._ui(
        `ğŸš“ Polis baskini Nightclub'da patladi. ${this._playerName()} ${lossEnergy} enerji ve ${lossCoins} yton kaybetti.`,
        `ğŸš“ A police raid hit the Nightclub. ${this._playerName()} lost ${lossEnergy} energy and ${lossCoins} yton.`
      )
    );
  }

  _buy(item) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const nightclub = this._syncDailyToleranceState();
    const coins = Number(s.coins || 0);
    const price = Number(item.price || 0);
    const gain = Number(item.energy || 0);
    const energy = Number(p.energy || 0);
    const energyMax = Math.max(1, Number(p.energyMax || 100));

    if (coins < price) {
      this._showToast(this._ui("Yetersiz yton", "Not enough yton"));
      return;
    }

    const nextClub = {
      ...nightclub,
      totalSpent: Number(nightclub.totalSpent || 0) + price,
      totalBought: Number(nightclub.totalBought || 0) + 1,
      inventoryBought: Number(nightclub.inventoryBought || 0),
    };

    if (energy < energyMax) {
      const tolerance = this._getToleranceSnapshot(item, nightclub.itemUseCounts || {});
      const gainedEnergy = Math.max(0, Math.min(energyMax - energy, tolerance.effectiveGain));
      const nextEnergy = Math.min(energyMax, energy + gainedEnergy);
      this.store.set({
        coins: coins - price,
        player: {
          ...p,
          energy: nextEnergy,
        },
        nightclub: nextClub,
      });

      this._showToast(
        this._ui(
          `${item.name} kullanildi - +${nextEnergy - energy} enerji${tolerance.penaltyPct ? ` (bagisiklik -%${tolerance.penaltyPct})` : ""}`,
          `${item.name} used - +${nextEnergy - energy} energy${tolerance.penaltyPct ? ` (tolerance -${tolerance.penaltyPct}%)` : ""}`
        ),
        1500
      );
      this._pushSystemChat(
        this._ui(
          `ğŸ¾ ${this._playerName()} ${item.name} satin aldi. (-${price} yton / +${nextEnergy - energy} enerji${tolerance.penaltyPct ? ` / bagisiklik -%${tolerance.penaltyPct}` : ""})`,
          `ğŸ¾ ${this._playerName()} bought ${item.name}. (-${price} yton / +${nextEnergy - energy} energy${tolerance.penaltyPct ? ` / tolerance -${tolerance.penaltyPct}%` : ""})`
        )
      );
      this._trackItemUse(item.id, tolerance.nextUseCount, tolerance.tierAfter);
      if (tolerance.penaltyPct > 0) {
        this._triggerDizzyEffect(item, tolerance);
      }
    } else {
      const inventoryItem = {
        id: `inv_nightclub_${item.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: "consumable",
        icon: item.icon || "ğŸ¾",
        name: item.name,
        rarity: item.rarity || "KulÃ¼p",
        qty: 1,
        usable: true,
        sellable: true,
        marketable: true,
        energyGain: gain,
        sellPrice: Math.max(1, Math.floor(price * 0.68)),
        marketPrice: Number(item.marketValue || price || 0),
        desc: item.desc || "Nightclub Ã¼rÃ¼nÃ¼.",
        source: "nightclub",
        image: item.image || "",
        category: "alcohol",
        createdAt: Date.now(),
      };

      nextClub.inventoryBought += 1;
      this.store.set({
        coins: coins - price,
        nightclub: nextClub,
      });
      this._mergeInventoryItem(inventoryItem);
      this._showToast(
        this._ui(
          `${item.name} envantere eklendi`,
          `${item.name} added to inventory`
        ),
        1500
      );
      this._pushSystemChat(
        this._ui(
          `ğŸ¾ ${this._playerName()} ${item.name} satin aldi. (-${price} yton / envantere eklendi)`,
          `ğŸ¾ ${this._playerName()} bought ${item.name}. (-${price} yton / added to inventory)`
        )
      );
    }

    if (chance(0.20)) {
      this._applyPoliceRaid(item);
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

    const listX = panelX + 10;
    const listY = panelY + 66;
    const listW = panelW - 20;
    const listH = panelH - 78;

    const rowH = 84;
    const contentH = this.items.length * (rowH + 10);

    this._clampScroll(listH, contentH);

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
      this.scrollY = this.startScrollY - dy;
      this._clampScroll(listH, contentH);
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

    const state = this.store.get() || {};
    const nightclub = this._syncDailyToleranceState();
    const useCounts = nightclub.itemUseCounts || {};
    const dizzyStrength = this._getDizzyStrength();
    const topReserved = Number(state?.ui?.hudReservedTop || 82);
    const bottomReserved = Number(state?.ui?.chatReservedBottom || 82);

    ctx.save();
    if (dizzyStrength > 0) {
      const now = Date.now();
      const sway = Math.sin(now / 170) * NIGHTCLUB_DIZZY_SWAY_PX * dizzyStrength;
      const tilt = Math.sin(now / 230) * NIGHTCLUB_DIZZY_TILT_RAD * dizzyStrength;
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(tilt);
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
    ctx.fillText(this._ui("Nightclub", "Nightclub"), titleX, titleY);
    ctx.fillStyle = "rgba(255,214,160,0.78)";
    ctx.font = "600 12px system-ui";
    ctx.fillText(
      this._ui("Icecek al, enerji topla, bagisikligi arttirma.", "Buy drinks, stack energy, avoid tolerance."),
      titleX,
      panelY + 48
    );

    this.hitClose = { x: panelX + panelW - 48, y: panelY + 14, w: 32, h: 32 };
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    this._fillRoundRect(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    this._strokeRoundRect(ctx, this.hitClose.x, this.hitClose.y, this.hitClose.w, this.hitClose.h, 10);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "900 18px system-ui";
    ctx.fillText("X", this.hitClose.x + this.hitClose.w / 2, this.hitClose.y + 21);
    const listX = panelX + 10;
    const listY = panelY + 66;
    const listW = panelW - 20;
    const listH = panelH - 78;

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

      ctx.fillStyle = "rgba(0,0,0,0.32)";
      this._fillRoundRect(ctx, listX + 2, rowY, listW - 4, rowH, 16);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      this._strokeRoundRect(ctx, listX + 2, rowY, listW - 4, rowH, 16);

      const rarity = String(item.rarity || "");
      const rColor = this._rarityColor(rarity);
      const tolerance = this._getToleranceSnapshot(item, useCounts);

      const visualRect = { x: listX + 10, y: rowY + 12, w: 54, h: 60 };
      this._drawDrinkVisual(ctx, item, visualRect.x, visualRect.y, visualRect.w, visualRect.h);

      const buyRect = { x: listX + listW - 112, y: rowY + 18, w: 96, h: 40 };
      const textX = visualRect.x + visualRect.w + 10;
      const textMax = Math.max(84, buyRect.x - textX - 10);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 15px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(this._fitText(ctx, item.name, textMax), textX, rowY + 22);

      ctx.fillStyle = rColor;
      ctx.font = "800 11px system-ui";
      ctx.fillText(this._fitText(ctx, `${this._ui("Sinif", "Class")}: ${this._rarityLabel(rarity)}`, textMax), textX, rowY + 40);

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "12px system-ui";
      ctx.fillText(
        this._fitText(
          ctx,
          `+${tolerance.effectiveGain} ${this._ui("enerji", "energy")}${tolerance.penaltyPct ? ` (-${tolerance.penaltyPct}%)` : ""}`,
          textMax
        ),
        textX,
        rowY + 58
      );

      ctx.fillStyle = "#ffd36c";
      ctx.font = "12px system-ui";
      ctx.fillText(this._fitText(ctx, `${item.price} yton`, textMax), textX, rowY + 74);
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

    if (this.maxScroll > 0) {
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
      const tw = Math.min(panelW - 24, Math.max(180, ctx.measureText(this.toast).width + 36));
      const th = 42;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 14;

      ctx.fillStyle = "rgba(0,0,0,0.78)";
      this._fillRoundRect(ctx, tx, ty, tw, th, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      this._strokeRoundRect(ctx, tx, ty, tw, th, 14);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(this.toast, tx + tw / 2, ty + 25);
    }

    ctx.restore();

    if (dizzyStrength > 0) {
      const now = Date.now();
      const pulse = (Math.sin(now / 220) + 1) * 0.5;
      ctx.save();
      ctx.globalAlpha = Math.min(0.34, 0.18 + 0.12 * dizzyStrength);
      ctx.globalCompositeOperation = "screen";
      const glare = ctx.createLinearGradient(0, 0, w, h);
      glare.addColorStop(0, "rgba(255,255,255,0.34)");
      glare.addColorStop(0.28, "rgba(255,248,230,0.18)");
      glare.addColorStop(0.58, "rgba(255,255,255,0.10)");
      glare.addColorStop(1, "rgba(255,255,255,0.28)");
      ctx.fillStyle = glare;
      ctx.fillRect(0, 0, w, h);

      if ("filter" in ctx) ctx.filter = `blur(${18 + 10 * dizzyStrength}px)`;
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      ctx.arc(w * (0.22 + 0.05 * pulse), h * 0.20, 100 + 36 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w * (0.80 - 0.04 * pulse), h * 0.72, 88 + 28 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,248,230,0.22)";
      ctx.beginPath();
      ctx.arc(w * 0.54, h * (0.38 + 0.03 * pulse), 122 + 44 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.55, 190 + 40 * pulse, 90 + 24 * pulse, 0.2, 0, Math.PI * 2);
      ctx.fill();
      if ("filter" in ctx) ctx.filter = "none";
      ctx.globalAlpha = 0.12 * Math.min(1.4, dizzyStrength);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}


export default NightclubScene;
