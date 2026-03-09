import { Engine } from "./engine/Engine.js";
import { Store } from "./engine/Store.js";
import { SceneManager } from "./engine/SceneManager.js";
import { Input } from "./engine/Input.js";
import { Assets } from "./engine/Assets.js";
import { I18n } from "./engine/I18n.js";
import { supabase } from "./supabase.js";

import { StarsScene } from "./scenes/StarsScene.js";
import { WeaponsScene } from "./scenes/WeaponsDealerScene.js";
import { BootScene } from "./scenes/BootScene.js";
import { IntroScene } from "./scenes/IntroScene.js";
import { HomeScene } from "./scenes/HomeScene.js";
import { SimpleScreenScene } from "./scenes/SimpleScreenScene.js";
import { CoffeeShopScene } from "./scenes/CoffeeShopScene.js";
import { NightclubScene } from "./scenes/NightclubScene.js";
import { TradeScene } from "./scenes/TradeScene.js";

import { startStarsOverlay } from "./ui/StarsOverlay.js";
import { startHud } from "./ui/Hud.js";
import { startChat } from "./ui/Chat.js";
import { startMenu } from "./ui/Menu.js";
import { startPvpLobby } from "./ui/PvpLobby.js";
import { startWeaponsDealer } from "./ui/WeaponsDealer.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

function getSafeArea() {
  const safe = document.getElementById("safe");
  if (!safe) {
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }
  const r = safe.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function fitCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = Math.floor(window.innerWidth);
  const cssH = Math.floor(window.innerHeight);

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", fitCanvas);

try {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }
} catch (_) {}

fitCanvas();

/* ===== STORE ===== */
const STORE_KEY = "toncrime_store_v1";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

function saveStore(state) {
  try {
    const copy = JSON.parse(JSON.stringify(state));
    if (copy.ui) delete copy.ui.safe;
    localStorage.setItem(STORE_KEY, JSON.stringify(copy));
  } catch {}
}

const defaultState = {
  lang: "tr",
  coins: 4769,
  premium: false,

  intro: {
    splashSeen: false,
    ageVerified: false,
    profileCompleted: false,
  },

  player: {
    username: "",
    telegramId: "",
    age: null,
    level: 50,
    xp: 25,
    xpToNext: 100,
    weaponName: "Silah Yok",
    weaponBonus: "+0%",
    energy: 100,
    energyMax: 100,
    energyIntervalMs: 5 * 60 * 1000,
    lastEnergyAt: Date.now(),
  },

  stars: {
    owned: {},
    selectedId: null,
    lastClaimTs: {},
    twinBonusClaimed: {},
  },

  ui: { safe: getSafeArea() },
};

const loaded = loadStore();
const initial = loaded
  ? {
      ...defaultState,
      ...loaded,
      intro: { ...defaultState.intro, ...(loaded.intro || {}) },
      player: { ...defaultState.player, ...(loaded.player || {}) },
      stars: { ...defaultState.stars, ...(loaded.stars || {}) },
      ui: { safe: getSafeArea() },
    }
  : defaultState;

const store = new Store(initial);

/* ===== TELEGRAM USER INIT ===== */
function getTelegramUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch {
    return null;
  }
}

function bootstrapTelegramUser() {
  try {
    const tgUser = getTelegramUser();
    if (!tgUser) return;

    const s = store.get();
    const p = s.player || {};
    store.set({
      player: {
        ...p,
        telegramId: String(tgUser.id || p.telegramId || ""),
        username:
          p.username ||
          tgUser.username ||
          [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") ||
          "Player",
      },
    });
  } catch (_) {}
}
bootstrapTelegramUser();

/* ===== SUPABASE PROFILE SYNC ===== */
let _lastProfileSyncAt = 0;
let _profileSyncBusy = false;
let _lastProfilePayload = "";

async function syncProfileToSupabase() {
  if (_profileSyncBusy) return;

  const s = store.get();
  const p = s.player || {};
  const telegramId = String(
    p.telegramId || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || ""
  );

  if (!telegramId) return;
  if (!s?.intro?.profileCompleted) return;

  const payload = {
    telegram_id: telegramId,
    username: String(p.username || "Player"),
    age: p.age ?? null,
    level: Number(p.level || 1),
    coins: Number(s.coins || 0),
    energy: Number(p.energy || 10),
    energy_max: Number(p.energyMax || 10),
    updated_at: new Date().toISOString(),
  };

  const payloadKey = JSON.stringify(payload);
  if (payloadKey === _lastProfilePayload) return;

  _profileSyncBusy = true;

  try {
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "telegram_id" });

    if (error) {
      console.error("Supabase profile sync error:", error);
      return;
    }

    _lastProfilePayload = payloadKey;
    _lastProfileSyncAt = Date.now();
  } catch (err) {
    console.error("Supabase profile sync fatal:", err);
  } finally {
    _profileSyncBusy = false;
  }
}

(function profileSyncLoop() {
  const now = Date.now();
  if (now - _lastProfileSyncAt > 1500) {
    syncProfileToSupabase();
  }
  setTimeout(profileSyncLoop, 1500);
})();

/* ===== AUTOSAVE ===== */
let _lastSaveAt = 0;
(function autosaveLoop() {
  const now = Date.now();
  if (now - _lastSaveAt > 300) {
    saveStore(store.get());
    _lastSaveAt = now;
  }
  requestAnimationFrame(autosaveLoop);
})();

/* ===== ENERGY REGEN ===== */
function tickEnergy() {
  const s = store.get();
  const p = s.player;
  if (!p) return;

  const now = Date.now();
  const interval = Math.max(10000, Number(p.energyIntervalMs || 300000));
  const maxE = Math.max(1, Number(p.energyMax || 10));
  const e = Math.max(0, Math.min(maxE, Numbcer(p.energy || 0)));

  if (e >= maxE) return;

  const elapsed = now - Number(p.lastEnergyAt || now);
  if (elapsed < interval) return;

  const gained = Math.floor(elapsed / interval);
  if (gained <= 0) return;

  const newE = Math.min(maxE, e + gained);
  const newLast = Number(p.lastEnergyAt || now) + gained * interval;

  store.set({
    player: {
      ...p,
      energy: newE,
      lastEnergyAt: newLast,
    },
  });
}
setInterval(tickEnergy, 1000);

/* ===== I18N ===== */
const i18n = new I18n(store);
i18n.register({
  tr: { loading: "Yükleniyor..." },
  en: { loading: "Loading..." },
});

/* ===== ASSETS ===== */
const assets = new Assets();

function addImage(key, url) {
  if (typeof assets.image === "function") return assets.image(key, url);
  if (typeof assets.loadImage === "function") return assets.loadImage(key, url);
  if (typeof assets.addImage === "function") return assets.addImage(key, url);
  console.warn("[ASSETS] image ekleme fonksiyonu yok:", key, url);
}

addImage("background", "./src/assets/ui/background.jpg");
addImage("missions", "./src/assets/missions.jpg");
addImage("pvp", "./src/assets/pvp.jpg");
addImage("weapons", "./src/assets/weapons.jpg");
addImage("nightclub", "./src/assets/nightclub.jpg");
addImage("coffeeshop", "./src/assets/coffeeshop.jpg");
addImage("xxx", "./src/assets/xxx.jpg");
addImage("tata", "./src/assets/tata.png");

/* BLACK MARKET */
addImage("blackmarket", "./src/assets/BlackMarket.png");
addImage("blackmarket_bg", "./src/assets/BlackMarket.png");
addImage("trade", "./src/assets/BlackMarket.png");

/* ===== HOME PATCH: BLACKMARKET CARD + COVER FIT ===== */
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

HomeScene.prototype._carouselItems = function () {
  return [
    { id: "missions", titleTR: "Görevler", titleEN: "Missions", sceneKey: "missions" },
    { id: "pvp", titleTR: "PvP", titleEN: "PvP", sceneKey: "pvp" },
    { id: "weapons", titleTR: "Silah Kaçakçısı", titleEN: "Arms Dealer", sceneKey: "weapons" },

    /* YENİ KART */
    { id: "blackmarket", titleTR: "Black Market", titleEN: "Black Market", sceneKey: "trade" },

    { id: "nightclub", titleTR: "Gece Kulübü", titleEN: "Nightclub", sceneKey: "nightclub" },
    { id: "coffeeshop", titleTR: "Coffeeshop", titleEN: "Coffeeshop", sceneKey: "coffeeshop" },
    { id: "xxx", titleTR: "Genel Ev", titleEN: "Brothel", sceneKey: "xxx" },
  ];
};

HomeScene.prototype.render = function (ctx, w, h) {
  const state = this.store.get();
  const safe = state?.ui?.safe ?? { x: 0, y: 0, w, h };

  const bg =
    (typeof this.assets.getImage === "function" && this.assets.getImage("background")) ||
    (typeof this.assets.get === "function" && this.assets.get("background")) ||
    this.assets.images?.background ||
    null;

  if (bg) {
    const iw = bg.width || 1;
    const ih = bg.height || 1;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    ctx.drawImage(bg, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, w, h);
  }

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, w, h);

  const HUD_TOP_RESERVED = 96;
  const CHAT_BOTTOM_RESERVED = 74;

  const carouselTop = safe.y + HUD_TOP_RESERVED;
  const carouselBottom = safe.y + safe.h - CHAT_BOTTOM_RESERVED;

  const areaH = Math.max(160, carouselBottom - carouselTop);
  const cx = safe.x + safe.w / 2;
  const cy = carouselTop + areaH / 2;

  const items = this._carouselItems();
  const idx = Math.max(0, Math.min(this.carousel.index, items.length - 1));
  this.carousel.index = idx;

  const cardW = Math.min(safe.w * 0.48, 420);
  const cardH = Math.min(areaH * 0.78, 290);

  const spacing = cardW + 28;
  const dragDX = this.carousel.dragging
    ? this.carousel.dragNowX - this.carousel.dragStartX
    : 0;

  const getImg = (key) => {
    return (
      (typeof this.assets.getImage === "function" && this.assets.getImage(key)) ||
      (typeof this.assets.get === "function" && this.assets.get(key)) ||
      this.assets.images?.[key] ||
      null
    );
  };

  const drawCard = (itemIndex) => {
    if (itemIndex < 0 || itemIndex >= items.length) return;

    const item = items[itemIndex];
    const offset = (itemIndex - idx) * spacing + dragDX;

    const dist = Math.abs(itemIndex - idx);
    const scale = dist === 0 ? 1 : 0.92;

    const w2 = cardW * scale;
    const h2 = cardH * scale;
    const x2 = cx - w2 / 2 + offset;
    const y2 = cy - h2 / 2;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    fillRoundRect(ctx, x2, y2, w2, h2, 18);

    ctx.save();
    roundRectPath(ctx, x2, y2, w2, h2, 18);
    ctx.clip();

    const img = getImg(item.id) || getImg(item.sceneKey);
    if (img) {
      const iw = img.width || 1;
      const ih = img.height || 1;

      /* cover: kartı tam doldurur, taşma görünmez çünkü clip var */
      const cover = Math.max(w2 / iw, h2 / ih);
      const zoom = 1.03;
      const dw = iw * cover * zoom;
      const dh = ih * cover * zoom;
      const dx = x2 + (w2 - dw) / 2;
      const dy = y2 + (h2 - dh) / 2;

      ctx.drawImage(img, dx, dy, dw, dh);

      ctx.fillStyle = dist === 0 ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.22)";
      ctx.fillRect(x2, y2, w2, h2);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(x2, y2, w2, h2);
    }

    ctx.restore();

    ctx.strokeStyle =
      dist === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)";
    strokeRoundRect(ctx, x2 + 0.5, y2 + 0.5, w2 - 1, h2 - 1, 18);

    const title = (state.lang ?? "tr") === "tr" ? item.titleTR : item.titleEN;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = dist === 0 ? "700 18px system-ui" : "700 16px system-ui";

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8;
    ctx.fillText(title, x2 + w2 / 2, y2 + h2 - 22);
    ctx.restore();

    if (itemIndex === idx) {
      this._cardRect = { x: x2, y: y2, w: w2, h: h2 };
    }
  };

  drawCard(idx - 1);
  drawCard(idx);
  drawCard(idx + 1);

  const dotsY = Math.min(carouselBottom - 10, cy + cardH / 2 + 18);
  const dotGap = 10;
  const total = (items.length - 1) * dotGap;
  const startX = cx - total / 2;

  for (let i = 0; i < items.length; i++) {
    ctx.beginPath();
    const dx = startX + i * dotGap;
    ctx.arc(dx, dotsY, 3, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle =
      i === idx ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)";
    ctx.fill();
  }
};

/* ===== INPUT / SCENES ===== */
const input = new Input(canvas);
const scenes = new SceneManager();

window.tcStore = store;
window.tcScenes = scenes;

window.tc = window.tc || {};
window.tc.dev = {
  coin(n = 100) {
    const s = store.get();
    store.set({ coins: (Number(s.coins) || 0) + Number(n || 0) });
    console.log("coins:", store.get().coins);
  },
  energy(n = 10) {
    const s = store.get();
    const p = s.player || {};
    const maxE = Math.max(1, Number(p.energyMax || 10));
    const next = Math.min(maxE, (Number(p.energy) || 0) + Number(n || 0));
    store.set({ player: { ...p, energy: next } });
    console.log("energy:", store.get().player.energy);
  },
  level(n = 1) {
    const s = store.get();
    const p = s.player || {};
    store.set({ player: { ...p, level: Number(n || 1) } });
    console.log("level:", store.get().player.level);
  },
  reset() {
    localStorage.removeItem(STORE_KEY);
    location.reload();
  },
};

/* ===== SCENES REGISTER ===== */
scenes.register("boot", new BootScene({ assets, i18n, scenes }));
scenes.register("intro", new IntroScene({ store, input, scenes, assets }));
scenes.register("home", new HomeScene({ store, input, i18n, assets, scenes }));

scenes.register("trade", new TradeScene({ store, scenes, assets }));

scenes.register(
  "coffeeshop",
  new CoffeeShopScene({ store, input, i18n, assets, scenes })
);

scenes.register(
  "nightclub",
  new NightclubScene({ store, input, i18n, assets, scenes })
);

scenes.register(
  "weapons",
  new WeaponsScene({ store, input, assets, scenes })
);

scenes.register("xxx", new StarsScene({ store, input, i18n, assets, scenes }));

scenes.register("missions", new SimpleScreenScene({ i18n, titleKey: "Missions" }));
scenes.register("pvp", new SimpleScreenScene({ i18n, titleKey: "PvP" }));
scenes.register("clan", new SimpleScreenScene({ i18n, titleKey: "Clan" }));

/* ===== ENGINE ===== */
const engine = new Engine({ canvas, ctx, input, scenes });

/* ===== KEEP SAFE AREA UPDATED ===== */
(function safeAreaLoop() {
  const s = store.get();
  store.set({ ui: { ...(s.ui || {}), safe: getSafeArea() } });
  requestAnimationFrame(safeAreaLoop);
})();

/* ===== UI ===== */
startHud(store);
startChat(store);
startMenu(store);
startStarsOverlay?.(store);
startWeaponsDealer?.({ store, scenes, assets, input });
startPvpLobby();

/* ===== START ===== */
scenes.go("boot");
engine.start();
