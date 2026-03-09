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
import { CoffeeShopScene } from "./scenes/CoffeeShopScene.js";
import { NightclubScene } from "./scenes/NightclubScene.js";
import { TradeScene } from "./scenes/TradeScene.js";

import { ClanSystem } from "./clan/ClanSystem.js";

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

  missions: {
    dailyAdWatched: 0,
    dailyAdClaimed: false,

    referrals: 0,
    referralClaim10: false,
    referralClaim100: false,
    referralClaim1000: false,
    referralClaim5000: false,

    pvpPlayed: 0,
    pvpClaimed: false,

    energyRefillUsed: 0,
    energyClaimed: false,

    telegramJoined: false,
    telegramClaimed: false,

    levelClaimedAt: 0,
    lastDailyKey: "",
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
      missions: { ...defaultState.missions, ...(loaded.missions || {}) },
      ui: { safe: getSafeArea() },
    }
  : defaultState;

const store = new Store(initial);

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function ensureDailyMissionReset() {
  const s = store.get();
  const m = s.missions || {};
  const today = dayKey();
  if (m.lastDailyKey === today) return;

  store.set({
    missions: {
      ...m,
      dailyAdWatched: 0,
      dailyAdClaimed: false,
      pvpPlayed: 0,
      pvpClaimed: false,
      energyRefillUsed: 0,
      energyClaimed: false,
      lastDailyKey: today,
    },
  });
}
ensureDailyMissionReset();

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
  const e = Math.max(0, Math.min(maxE, Number(p.energy || 0)));

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

/* ===== HELPERS ===== */
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

function getAssetImageSafe(a, key) {
  return (
    (typeof a.getImage === "function" && a.getImage(key)) ||
    (typeof a.get === "function" && a.get(key)) ||
    a.images?.[key] ||
    null
  );
}

/* ===== PREMIUM HOME PATCH ===== */
HomeScene.prototype._carouselItems = function () {
  return [
    { id: "missions", titleTR: "Görevler", titleEN: "Missions", sceneKey: "missions" },
    { id: "pvp", titleTR: "PvP", titleEN: "PvP", sceneKey: "pvp" },
    { id: "weapons", titleTR: "Silah Kaçakçısı", titleEN: "Arms Dealer", sceneKey: "weapons" },
    { id: "blackmarket", titleTR: "Black Market", titleEN: "Black Market", sceneKey: "trade" },
    { id: "nightclub", titleTR: "Gece Kulübü", titleEN: "Nightclub", sceneKey: "nightclub" },
    { id: "coffeeshop", titleTR: "Coffeeshop", titleEN: "Coffeeshop", sceneKey: "coffeeshop" },
    { id: "clan", titleTR: "Clan", titleEN: "Clan", sceneKey: "clanhub" },
    { id: "xxx", titleTR: "Genel Ev", titleEN: "Brothel", sceneKey: "xxx" },
  ];
};

HomeScene.prototype.render = function (ctx, w, h) {
  const state = this.store.get();
  const safe = state?.ui?.safe ?? { x: 0, y: 0, w, h };

  const bg = getAssetImageSafe(this.assets, "background");
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

  ctx.fillStyle = "rgba(0,0,0,0.28)";
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

  const cardW = Math.min(safe.w * 0.58, 410);
  const cardH = Math.min(areaH * 0.72, 310);
  const sideScale = 0.72;

  const sideW = cardW * sideScale;
  const maxSpacingByScreen = Math.max(cardW * 0.56, safe.w / 2 - sideW / 2 - 8);
  const spacing = Math.min(cardW * 0.88, maxSpacingByScreen);

  const dragDX = this.carousel.dragging
    ? this.carousel.dragNowX - this.carousel.dragStartX
    : 0;

  const getImg = (item) => {
    return (
      getAssetImageSafe(this.assets, item.id) ||
      getAssetImageSafe(this.assets, item.sceneKey) ||
      getAssetImageSafe(this.assets, `${item.id}_bg`) ||
      getAssetImageSafe(this.assets, "background")
    );
  };

  const drawCard = (itemIndex) => {
    if (itemIndex < 0 || itemIndex >= items.length) return;

    const item = items[itemIndex];
    const rel = itemIndex - idx;
    const offset = rel * spacing + dragDX;
    const dist = Math.abs(rel);
    const scale = dist === 0 ? 1 : sideScale;

    const w2 = cardW * scale;
    const h2 = cardH * scale;
    let x2 = cx - w2 / 2 + offset;
    const y2 = cy - h2 / 2;

    const minX = safe.x + 4;
    const maxX = safe.x + safe.w - w2 - 4;
    x2 = Math.max(minX, Math.min(maxX, x2));

    ctx.save();
    ctx.globalAlpha = dist === 0 ? 1 : 0.92;

    ctx.fillStyle = "rgba(0,0,0,0.56)";
    fillRoundRect(ctx, x2, y2, w2, h2, 18);

    ctx.save();
    roundRectPath(ctx, x2, y2, w2, h2, 18);
    ctx.clip();

    const img = getImg(item);
    if (img) {
      const iw = img.width || 1;
      const ih = img.height || 1;

      /* 1) Arka planı kartı doldursun */
      const bgScale = Math.max(w2 / iw, h2 / ih);
      const bgW = iw * bgScale;
      const bgH = ih * bgScale;
      const bgX = x2 + (w2 - bgW) / 2;
      const bgY = y2 + (h2 - bgH) / 2;
      ctx.drawImage(img, bgX, bgY, bgW, bgH);

      /* 2) Arka planı biraz karart */
      ctx.fillStyle = dist === 0 ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.42)";
      ctx.fillRect(x2, y2, w2, h2);

      /* 3) Resmin tamamını önde göster */
      const padImg = dist === 0 ? 8 : 10;
      const fitScale = Math.min((w2 - padImg * 2) / iw, (h2 - padImg * 2) / ih);
      const fitW = iw * fitScale;
      const fitH = ih * fitScale;
      const fitX = x2 + (w2 - fitW) / 2;
      const fitY = y2 + (h2 - fitH) / 2;
      ctx.drawImage(img, fitX, fitY, fitW, fitH);

      /* 4) Hafif üst katman */
      ctx.fillStyle = dist === 0 ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.18)";
      ctx.fillRect(x2, y2, w2, h2);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x2, y2, w2, h2);
    }

    const grad = ctx.createLinearGradient(0, y2 + h2 * 0.42, 0, y2 + h2);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.76)");
    ctx.fillStyle = grad;
    ctx.fillRect(x2, y2, w2, h2);

    ctx.restore();

    ctx.strokeStyle =
      dist === 0 ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, x2 + 0.5, y2 + 0.5, w2 - 1, h2 - 1, 18);

    if (dist !== 0) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      fillRoundRect(ctx, x2, y2, w2, h2, 18);
    }

    const title = (state.lang ?? "tr") === "tr" ? item.titleTR : item.titleEN;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = dist === 0 ? "700 18px system-ui" : "700 15px system-ui";
    ctx.shadowColor = "rgba(0,0,0,0.80)";
    ctx.shadowBlur = 10;
    ctx.fillText(title, x2 + w2 / 2, y2 + h2 - 28);
    ctx.shadowBlur = 0;

    ctx.restore();

    if (itemIndex === idx) {
      this._cardRect = { x: x2, y: y2, w: w2, h: h2 };
    }
  };

  const visibleCards = [idx - 1, idx, idx + 1]
    .filter((i) => i >= 0 && i < items.length)
    .sort((a, b) => {
      const aDepth = Math.abs((a - idx) * spacing + dragDX);
      const bDepth = Math.abs((b - idx) * spacing + dragDX);
      return bDepth - aDepth;
    });

  visibleCards.forEach(drawCard);

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
      i === idx ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.28)";
    ctx.fill();
  }
};

/* ===== MISSIONS SCENE ===== */
class MissionsScene {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;
    this.hitBack = null;
    this.hitButtons = [];
  }

  onEnter() {
    ensureDailyMissionReset();
  }

  _grantCoins(n) {
    const s = this.store.get();
    this.store.set({ coins: Number(s.coins || 0) + Number(n || 0) });
  }

  _grantEnergy(n) {
    const s = this.store.get();
    const p = s.player || {};
    const maxE = Math.max(1, Number(p.energyMax || 10));
    const next = Math.min(maxE, Number(p.energy || 0) + Number(n || 0));
    this.store.set({ player: { ...p, energy: next } });
  }

  _grantXP(n) {
    const s = this.store.get();
    const p = s.player || {};
    let xp = Number(p.xp || 0) + Number(n || 0);
    let level = Number(p.level || 1);
    let xpToNext = Number(p.xpToNext || 100);

    while (xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      xpToNext = 100;
    }

    this.store.set({
      player: { ...p, xp, level, xpToNext },
    });
  }

  _claim(type) {
    const s = this.store.get();
    const m = { ...(s.missions || {}) };
    const p = s.player || {};

    if (type === "dailyAd" && m.dailyAdWatched >= 20 && !m.dailyAdClaimed) {
      m.dailyAdClaimed = true;
      this.store.set({ missions: m });
      const s2 = this.store.get();
      this.store.set({
        player: {
          ...(s2.player || {}),
          weaponName: "Reklam Ustası",
          weaponBonus: "+2%",
        },
      });
      return;
    }

    if (type === "ref10" && m.referrals >= 10 && !m.referralClaim10) {
      m.referralClaim10 = true;
      this.store.set({ missions: m });
      const s2 = this.store.get();
      this.store.set({
        player: {
          ...(s2.player || {}),
          weaponName: "Başlangıç Bıçağı",
          weaponBonus: "+3%",
        },
      });
      return;
    }

    if (type === "ref100" && m.referrals >= 100 && !m.referralClaim100) {
      m.referralClaim100 = true;
      this.store.set({ missions: m });
      const s2 = this.store.get();
      this.store.set({
        player: {
          ...(s2.player || {}),
          weaponName: "Orta Seviye Silah",
          weaponBonus: "+8%",
        },
      });
      return;
    }

    if (type === "ref1000" && m.referrals >= 1000 && !m.referralClaim1000) {
      m.referralClaim1000 = true;
      this.store.set({ missions: m });
      const s2 = this.store.get();
      this.store.set({
        player: {
          ...(s2.player || {}),
          weaponName: "En Güçlü Silah",
          weaponBonus: "+18%",
        },
      });
      return;
    }

    if (type === "ref5000" && m.referrals >= 5000 && !m.referralClaim5000) {
      m.referralClaim5000 = true;
      this.store.set({ missions: m, premium: true });
      return;
    }

    if (type === "pvp" && m.pvpPlayed >= 3 && !m.pvpClaimed) {
      m.pvpClaimed = true;
      this.store.set({ missions: m });
      this._grantXP(20);
      this._grantCoins(15);
      return;
    }

    if (type === "energy" && m.energyRefillUsed >= 1 && !m.energyClaimed) {
      m.energyClaimed = true;
      this.store.set({ missions: m });
      this._grantCoins(10);
      this._grantEnergy(10);
      return;
    }

    if (type === "telegram" && m.telegramJoined && !m.telegramClaimed) {
      m.telegramClaimed = true;
      this.store.set({ missions: m });
      this._grantCoins(20);
      return;
    }

    if (type === "level" && Number(p.level || 1) >= 55 && m.levelClaimedAt !== 55) {
      m.levelClaimedAt = 55;
      this.store.set({ missions: m });
      this._grantCoins(50);
      this._grantXP(25);
      return;
    }
  }

  update() {
    const px = this.input.pointer.x;
    const py = this.input.pointer.y;

    if (!this.input.justReleased()) return;

    if (this.hitBack && pointInRect(px, py, this.hitBack)) {
      this.scenes.go("home");
      return;
    }

    for (const b of this.hitButtons) {
      if (pointInRect(px, py, b.rect)) {
        if (b.action === "watchAd") {
          const s = this.store.get();
          const m = s.missions || {};
          if (m.dailyAdWatched < 20) {
            this.store.set({
              missions: {
                ...m,
                dailyAdWatched: Math.min(20, Number(m.dailyAdWatched || 0) + 1),
              },
            });
          }
          return;
        }

        if (b.action === "addReferral") {
          const s = this.store.get();
          const m = s.missions || {};
          this.store.set({
            missions: {
              ...m,
              referrals: Number(m.referrals || 0) + 1,
            },
          });
          return;
        }

        if (b.action === "simulatePvp") {
          const s = this.store.get();
          const m = s.missions || {};
          this.store.set({
            missions: {
              ...m,
              pvpPlayed: Number(m.pvpPlayed || 0) + 1,
            },
          });
          return;
        }

        if (b.action === "simulateEnergy") {
          const s = this.store.get();
          const m = s.missions || {};
          this.store.set({
            missions: {
              ...m,
              energyRefillUsed: 1,
            },
          });
          return;
        }

        if (b.action === "joinTelegram") {
          const s = this.store.get();
          const m = s.missions || {};
          this.store.set({
            missions: {
              ...m,
              telegramJoined: true,
            },
          });
          return;
        }

        if (b.action.startsWith("claim:")) {
          this._claim(b.action.replace("claim:", ""));
          return;
        }
      }
    }
  }

  render(ctx, w, h) {
    const s = this.store.get();
    const p = s.player || {};
    const m = s.missions || {};
    const safe = s?.ui?.safe ?? { x: 0, y: 0, w, h };

    const bg =
      getAssetImageSafe(this.assets, "missions") ||
      getAssetImageSafe(this.assets, "background");

    if (bg) {
      const scale = Math.max(w / bg.width, h / bg.height);
      const dw = bg.width * scale;
      const dh = bg.height * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, 0, w, h);

    const left = safe.x + 14;
    const top = safe.y + 18;
    const panelW = Math.min(760, safe.w - 28);
    const rowH = 76;
    const gap = 12;

    ctx.fillStyle = "#fff";
    ctx.font = "700 24px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Görevler", left, top + 8);

    const backRect = { x: left, y: top + 24, w: 110, h: 38 };
    this.hitBack = backRect;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    fillRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    strokeRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 12);
    ctx.fillStyle = "#fff";
    ctx.font = "700 15px system-ui";
    ctx.fillText("← Geri", backRect.x + 22, backRect.y + 21);

    this.hitButtons = [];

    const rows = [
      {
        title: `Günlük Reklam İzle (${m.dailyAdWatched || 0}/20)`,
        desc: "Her reklam izleme testi ile ilerler. 20 olunca ödül alınır.",
        reward: m.dailyAdClaimed ? "Alındı" : "Ödül: özel silah bonusu",
        leftBtn: { text: "İlerle +1", action: "watchAd" },
        rightBtn: {
          text: m.dailyAdClaimed ? "Alındı" : "Ödülü Al",
          action: "claim:dailyAd",
          disabled: m.dailyAdClaimed || (m.dailyAdWatched || 0) < 20,
        },
      },
      {
        title: `Arkadaş Davet (${m.referrals || 0})`,
        desc: "10 / 100 / 1000 / 5000 eşik ödülleri var.",
        reward: "10 düşük silah • 100 orta • 1000 en güçlü • 5000 premium",
        leftBtn: { text: "Davet +1", action: "addReferral" },
        rightBtn: { text: "Ödüller", action: "", disabled: true },
      },
      {
        title: `PvP Oyna (${m.pvpPlayed || 0}/3)`,
        desc: "3 maç simülasyonu sonrası ödül alınır.",
        reward: m.pvpClaimed ? "Alındı" : "Ödül: +15 coin +20 XP",
        leftBtn: { text: "Maç +1", action: "simulatePvp" },
        rightBtn: {
          text: m.pvpClaimed ? "Alındı" : "Ödülü Al",
          action: "claim:pvp",
          disabled: m.pvpClaimed || (m.pvpPlayed || 0) < 3,
        },
      },
      {
        title: `Enerji Doldur (${m.energyRefillUsed || 0}/1)`,
        desc: "Bir kez enerji dolumu simülasyonu yap.",
        reward: m.energyClaimed ? "Alındı" : "Ödül: +10 coin +10 enerji",
        leftBtn: { text: "Dolum Yap", action: "simulateEnergy" },
        rightBtn: {
          text: m.energyClaimed ? "Alındı" : "Ödülü Al",
          action: "claim:energy",
          disabled: m.energyClaimed || (m.energyRefillUsed || 0) < 1,
        },
      },
      {
        title: `Level Görevi (Seviye ${Number(p.level || 1)}/55)`,
        desc: "55 level ve üstü ödül açılır.",
        reward: m.levelClaimedAt === 55 ? "Alındı" : "Ödül: +50 coin +25 XP",
        leftBtn: { text: "Seviye Bilgisi", action: "", disabled: true },
        rightBtn: {
          text: m.levelClaimedAt === 55 ? "Alındı" : "Ödülü Al",
          action: "claim:level",
          disabled: m.levelClaimedAt === 55 || Number(p.level || 1) < 55,
        },
      },
      {
        title: `Telegram Grubuna Katıl`,
        desc: "Katılım simülasyonu ile açılır.",
        reward: m.telegramClaimed ? "Alındı" : "Ödül: +20 coin",
        leftBtn: { text: "Katıldım", action: "joinTelegram" },
        rightBtn: {
          text: m.telegramClaimed ? "Alındı" : "Ödülü Al",
          action: "claim:telegram",
          disabled: m.telegramClaimed || !m.telegramJoined,
        },
      },
      {
        title: "Davet Eşik Ödülleri",
        desc: "Aşağıdaki butonlardan uygun olanı al.",
        reward:
          [
            !m.referralClaim10 ? "10" : null,
            !m.referralClaim100 ? "100" : null,
            !m.referralClaim1000 ? "1000" : null,
            !m.referralClaim5000 ? "5000" : null,
          ]
            .filter(Boolean)
            .join(" / ") || "Hepsi alındı",
        leftBtn: {
          text: m.referralClaim10 ? "10 Alındı" : "10 Ödülü",
          action: "claim:ref10",
          disabled: m.referralClaim10 || (m.referrals || 0) < 10,
        },
        rightBtn: {
          text: m.referralClaim100 ? "100 Alındı" : "100 Ödülü",
          action: "claim:ref100",
          disabled: m.referralClaim100 || (m.referrals || 0) < 100,
        },
        extraBtns: [
          {
            text: m.referralClaim1000 ? "1000 Alındı" : "1000 Ödülü",
            action: "claim:ref1000",
            disabled: m.referralClaim1000 || (m.referrals || 0) < 1000,
          },
          {
            text: m.referralClaim5000 ? "5000 Alındı" : "5000 Ödülü",
            action: "claim:ref5000",
            disabled: m.referralClaim5000 || (m.referrals || 0) < 5000,
          },
        ],
      },
    ];

    let y = top + 78;
    const maxVisibleBottom = safe.y + safe.h - 86;

    for (const row of rows) {
      if (y + rowH > maxVisibleBottom) break;

      ctx.fillStyle = "rgba(0,0,0,0.52)";
      fillRoundRect(ctx, left, y, panelW, rowH, 16);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      strokeRoundRect(ctx, left, y, panelW, rowH, 16);

      ctx.fillStyle = "#fff";
      ctx.font = "700 16px system-ui";
      ctx.fillText(row.title, left + 14, y + 18);

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "13px system-ui";
      ctx.fillText(row.desc, left + 14, y + 40);

      ctx.fillStyle = "rgba(255,255,255,0.60)";
      ctx.font = "12px system-ui";
      ctx.fillText(row.reward, left + 14, y + 59);

      const btnW = 118;
      const btnH = 34;
      const btnGap = 8;
      let bx = left + panelW - btnW - 14;

      const drawBtn = (btn) => {
        const r = { x: bx, y: y + 21, w: btnW, h: btnH };
        ctx.fillStyle = btn.disabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.14)";
        fillRoundRect(ctx, r.x, r.y, r.w, r.h, 11);
        ctx.strokeStyle = btn.disabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.16)";
        strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 11);

        ctx.fillStyle = btn.disabled ? "rgba(255,255,255,0.45)" : "#fff";
        ctx.font = "700 12px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(btn.text, r.x + r.w / 2, r.y + r.h / 2);

        ctx.textAlign = "left";
        if (!btn.disabled && btn.action) {
          this.hitButtons.push({ rect: r, action: btn.action });
        }
        bx -= btnW + btnGap;
      };

      if (row.extraBtns?.length) {
        [...row.extraBtns].reverse().forEach(drawBtn);
      }
      drawBtn(row.rightBtn);
      drawBtn(row.leftBtn);

      y += rowH + gap;
    }
  }
}

/* ===== CLAN SCENES ===== */
function clanMoney(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function clanRoleLabel(role) {
  switch (String(role || "").toLowerCase()) {
    case "leader":
      return "Lider";
    case "officer":
      return "Yardımcı";
    default:
      return "Üye";
  }
}

function clanButton(ctx, hitList, x, y, w, h, text, onClick, active = false, disabled = false) {
  const rect = { x, y, w, h };
  hitList.push({ rect, onClick, disabled });

  ctx.fillStyle = disabled
    ? "rgba(255,255,255,0.07)"
    : active
    ? "rgba(255,255,255,0.18)"
    : "rgba(255,255,255,0.11)";
  fillRoundRect(ctx, x, y, w, h, 12);
  ctx.strokeStyle = active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)";
  strokeRoundRect(ctx, x, y, w, h, 12);

  ctx.fillStyle = disabled ? "rgba(255,255,255,0.45)" : "#fff";
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function clanDrawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").split(" ");
  let line = "";
  let yy = y;

  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line, x, yy);
      line = words[i] + " ";
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

class ClanHubScene {
  constructor({ scenes, store }) {
    this.scenes = scenes;
    this.store = store;
    this._redirected = false;
  }

  onEnter() {
    this._redirected = false;
  }

  update() {
    if (this._redirected) return;
    this._redirected = true;
    this.scenes.go(ClanSystem.hasClan(this.store) ? "clan" : "clan_create");
  }

  render() {}
}

class ClanCreateSceneLocal {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;
    this.buttons = [];
  }

  onEnter() {
    this.buttons = [];
  }

  update() {
    if (!this.input.justReleased()) return;
    const px = this.input.pointer.x;
    const py = this.input.pointer.y;

    for (const b of this.buttons) {
      if (!b.disabled && pointInRect(px, py, b.rect)) {
        b.onClick?.();
        return;
      }
    }
  }

  render(ctx, w, h) {
    const s = this.store.get();
    const safe = s?.ui?.safe ?? { x: 0, y: 0, w, h };
    const p = s.player || {};

    const bg =
      getAssetImageSafe(this.assets, "background") ||
      getAssetImageSafe(this.assets, "blackmarket");
    if (bg) {
      const scale = Math.max(w / bg.width, h / bg.height);
      const dw = bg.width * scale;
      const dh = bg.height * scale;
      ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, w, h);

    const panelW = Math.min(760, safe.w - 24);
    const panelH = Math.min(520, safe.h - 24);
    const x = safe.x + (safe.w - panelW) / 2;
    const y = safe.y + (safe.h - panelH) / 2;

    ctx.fillStyle = "rgba(15,18,28,0.92)";
    fillRoundRect(ctx, x, y, panelW, panelH, 22);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, x, y, panelW, panelH, 22);

    ctx.fillStyle = "#fff";
    ctx.font = "700 28px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Clan Kur", x + 26, y + 38);

    ctx.font = "400 16px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillText("Aktif clan kurup anında panele geç.", x + 26, y + 74);

    const username = String(p.username || "Player");
    const sampleName = `${username.slice(0, 10) || "Player"} Clan`;
    const sampleTag = String((username.slice(0, 3) || "PCR")).toUpperCase();

    const info = [
      `Kurulacak Clan: ${sampleName}`,
      `Tag: ${sampleTag}`,
      `Açıklama: Şehirde güç kurmak isteyen aktif ekip.`,
      `Oyuncu: ${username}`,
      `Level: ${Number(p.level || 1)}`,
    ];

    ctx.font = "600 16px system-ui";
    let yy = y + 132;
    for (const row of info) {
      ctx.fillStyle = "#fff";
      ctx.fillText(row, x + 26, yy);
      yy += 34;
    }

    ctx.font = "400 15px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.74)";
    clanDrawWrappedText(
      ctx,
      "Clan oluştur tuşu mevcut kullanıcı adına göre clan açar ve doğrudan clan paneline geçirir.",
      x + 26,
      y + 280,
      panelW - 52,
      24
    );

    this.buttons = [];
    clanButton(ctx, this.buttons, x + 26, y + panelH - 70, 130, 46, "← Geri", () => {
      this.scenes.go("home");
    });

    clanButton(
      ctx,
      this.buttons,
      x + panelW - 216,
      y + panelH - 70,
      190,
      46,
      "Clan Oluştur",
      () => {
        if (!ClanSystem.hasClan(this.store)) {
          ClanSystem.createClan(this.store, {
            name: sampleName,
            tag: sampleTag,
            description: "Şehirde güç kurmak isteyen aktif ekip.",
          });
        }
        this.scenes.go("clan");
      }
    );
  }
}

class ClanSceneLocal {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;
    this.activeTab = "genel";
    this.hit = [];
  }

  onEnter() {
    this.activeTab = "genel";
    this.hit = [];
    const s = this.store.get();
    if (s.clan && !Array.isArray(s.allClans)) {
      this.store.set({
        allClans: [
          {
            name: "Shadow Syndicate",
            tag: "SHD",
            level: 6,
            stats: { totalDonations: 18000, totalWarWins: 3, totalBossKills: 2 },
            upgrades: { pvpBonus: 2, energyBonus: 1, tradeBonus: 1 },
            members: [
              { level: 50, power: 500 },
              { level: 45, power: 450 },
              { level: 55, power: 650 },
            ],
          },
          {
            name: "Istanbul Cartel",
            tag: "IST",
            level: 4,
            stats: { totalDonations: 12000, totalWarWins: 1, totalBossKills: 1 },
            upgrades: { pvpBonus: 1, energyBonus: 1, tradeBonus: 0 },
            members: [
              { level: 40, power: 350 },
              { level: 38, power: 300 },
            ],
          },
        ],
      });
    }
  }

  update() {
    if (!this.input.justReleased()) return;
    const px = this.input.pointer.x;
    const py = this.input.pointer.y;

    for (const item of this.hit) {
      if (!item.disabled && pointInRect(px, py, item.rect)) {
        item.onClick?.();
        return;
      }
    }
  }

  render(ctx, w, h) {
    const s = this.store.get();
    const safe = s?.ui?.safe ?? { x: 0, y: 0, w, h };
    const clan = ClanSystem.getClan(s);

    if (!clan) {
      this.scenes.go("clan_create");
      return;
    }

    const bg =
      getAssetImageSafe(this.assets, "background") ||
      getAssetImageSafe(this.assets, "blackmarket");
    if (bg) {
      const scale = Math.max(w / bg.width, h / bg.height);
      const dw = bg.width * scale;
      const dh = bg.height * scale;
      ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.76)";
    ctx.fillRect(0, 0, w, h);

    const panelX = safe.x + 12;
    const panelY = safe.y + 14;
    const panelW = safe.w - 24;
    const panelH = safe.h - 28;

    ctx.fillStyle = "rgba(13,16,24,0.92)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 20);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 20);

    this.hit = [];

    ctx.fillStyle = "#fff";
    ctx.font = "700 26px system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${clan.name} [${clan.tag}]`, panelX + 18, panelY + 34);

    ctx.font = "400 14px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.76)";
    const clanPower = ClanSystem.calcPower(clan);
    ctx.fillText(
      `Seviye ${clan.level} • Güç ${clanPower} • Üye ${clan.members.length}/${clan.maxMembers}`,
      panelX + 18,
      panelY + 58
    );

    clanButton(ctx, this.hit, panelX + 18, panelY + 72, 120, 40, "← Geri", () => {
      this.scenes.go("home");
    });

    clanButton(
      ctx,
      this.hit,
      panelX + panelW - 176,
      panelY + 72,
      158,
      40,
      "Clan'dan Çık",
      () => {
        const me = this.store.get().player || {};
        ClanSystem.leaveClan(this.store, me.id || me.telegramId || "player");
        this.scenes.go("clan_create");
      }
    );

    const tabs = [
      { id: "genel", label: "GENEL" },
      { id: "uyeler", label: "ÜYELER" },
      { id: "bagis", label: "BAĞIŞ" },
      { id: "gelistirme", label: "UPGRADE" },
      { id: "chat", label: "CHAT" },
      { id: "market", label: "MARKET" },
      { id: "boss", label: "BOSS" },
      { id: "savas", label: "SAVAŞ" },
      { id: "rank", label: "RANK" },
      { id: "log", label: "LOG" },
    ];

    let tx = panelX + 18;
    let ty = panelY + 126;
    tabs.forEach((tab) => {
      if (tx + 110 > panelX + panelW - 18) {
        tx = panelX + 18;
        ty += 46;
      }
      clanButton(
        ctx,
        this.hit,
        tx,
        ty,
        102,
        38,
        tab.label,
        () => {
          this.activeTab = tab.id;
        },
        this.activeTab === tab.id
      );
      tx += 110;
    });

    const bodyY = ty + 52;
    const bodyX = panelX + 18;
    const bodyW = panelW - 36;
    const bodyH = panelY + panelH - bodyY - 18;

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    fillRoundRect(ctx, bodyX, bodyY, bodyW, bodyH, 16);

    if (this.activeTab === "genel") {
      const lines = [
        `Açıklama: ${clan.description || "-"}`,
        `TON Kasa: ${clanMoney(clan.bank)}`,
        `yTON Kasa: ${clanMoney(clan.ytonBank)}`,
        `Enerji Kasa: ${clanMoney(clan.energyBank)}`,
        `XP: ${clan.xp}`,
        `Davet Kodu: ${clan.inviteCode}`,
      ];
      ctx.fillStyle = "#fff";
      ctx.font = "600 16px system-ui";
      let yy = bodyY + 34;
      for (const line of lines) {
        ctx.fillText(line, bodyX + 18, yy);
        yy += 32;
      }

      clanButton(ctx, this.hit, bodyX + 18, bodyY + bodyH - 56, 180, 40, "Yeni Davet Kodu", () => {
        ClanSystem.generateInvite(this.store);
      });

      clanButton(
        ctx,
        this.hit,
        bodyX + 210,
        bodyY + bodyH - 56,
        180,
        40,
        "Örnek Üye Ekle",
        () => {
          ClanSystem.addMember(this.store, {
            id: `mock_${Date.now()}`,
            name: `Üye ${Math.floor(Math.random() * 90 + 10)}`,
            role: "Member",
            level: Math.floor(Math.random() * 25) + 20,
            power: Math.floor(Math.random() * 400) + 150,
          });
        },
        false,
        clan.members.length >= clan.maxMembers
      );
    }

    if (this.activeTab === "uyeler") {
      ctx.fillStyle = "#fff";
      ctx.font = "600 16px system-ui";
      let yy = bodyY + 28;
      clan.members.slice(0, 10).forEach((m, i) => {
        ctx.fillText(
          `${i + 1}. ${m.name} • ${clanRoleLabel(m.role)} • Lv.${m.level} • Güç ${m.power || 0}`,
          bodyX + 18,
          yy
        );
        yy += 30;
      });
    }

    if (this.activeTab === "bagis") {
      ctx.fillStyle = "#fff";
      ctx.font = "600 16px system-ui";
      ctx.fillText(`Clan Kasası: ${clanMoney(clan.bank)} TON`, bodyX + 18, bodyY + 34);
      clanButton(ctx, this.hit, bodyX + 18, bodyY + 64, 150, 42, "+10 TON", () => ClanSystem.donate(this.store, 10, "ton"));
      clanButton(ctx, this.hit, bodyX + 182, bodyY + 64, 150, 42, "+50 TON", () => ClanSystem.donate(this.store, 50, "ton"));
      clanButton(ctx, this.hit, bodyX + 346, bodyY + 64, 160, 42, "+100 TON", () => ClanSystem.donate(this.store, 100, "ton"));
      clanButton(ctx, this.hit, bodyX + 18, bodyY + 122, 150, 42, "+25 yTON", () => ClanSystem.donate(this.store, 25, "yton"));
      clanButton(ctx, this.hit, bodyX + 182, bodyY + 122, 150, 42, "+50 Enerji", () => ClanSystem.donate(this.store, 50, "energy"));
    }

    if (this.activeTab === "gelistirme") {
      const upgradeRows = [
        { label: "Üye Limiti +5", cost: clan.level * 500 + clan.upgrades.memberCap * 250, action: () => ClanSystem.upgradeMembers(this.store) },
        { label: "PvP Bonus", cost: 800 + clan.upgrades.pvpBonus * 400, action: () => ClanSystem.upgradePvP(this.store) },
        { label: "Enerji Bonus", cost: 600 + clan.upgrades.energyBonus * 300, action: () => ClanSystem.upgradeEnergy(this.store) },
        { label: "Trade Bonus", cost: 900 + clan.upgrades.tradeBonus * 450, action: () => ClanSystem.upgradeTrade(this.store) },
      ];

      let yy = bodyY + 30;
      upgradeRows.forEach((row) => {
        ctx.fillStyle = "#fff";
        ctx.font = "600 15px system-ui";
        ctx.fillText(`${row.label} • Maliyet ${clanMoney(row.cost)} TON`, bodyX + 18, yy);
        clanButton(ctx, this.hit, bodyX + bodyW - 160, yy - 18, 142, 38, "Yükselt", row.action, false, clan.bank < row.cost);
        yy += 54;
      });
    }

    if (this.activeTab === "chat") {
      ctx.fillStyle = "#fff";
      ctx.font = "600 15px system-ui";
      let yy = bodyY + 28;
      const messages = (clan.chat || []).slice(-8).reverse();
      if (!messages.length) {
        ctx.fillText("Henüz mesaj yok.", bodyX + 18, yy);
      } else {
        messages.forEach((m) => {
          clanDrawWrappedText(ctx, `${m.name}: ${m.msg}`, bodyX + 18, yy, bodyW - 36, 22);
          yy += 34;
        });
      }

      clanButton(ctx, this.hit, bodyX + 18, bodyY + bodyH - 56, 150, 40, "Merhaba Yaz", () => {
        ClanSystem.sendChat(this.store, "Selam ekip!");
      });
      clanButton(ctx, this.hit, bodyX + 182, bodyY + bodyH - 56, 170, 40, "Savaş Çağrısı", () => {
        ClanSystem.sendChat(this.store, "Clan war için hazır olun.");
      });
    }

    if (this.activeTab === "market") {
      ctx.fillStyle = "#fff";
      ctx.font = "600 15px system-ui";
      let yy = bodyY + 28;
      const items = clan.market || [];
      if (!items.length) {
        ctx.fillText("Market boş.", bodyX + 18, yy);
      } else {
        items.slice(0, 6).forEach((it, i) => {
          ctx.fillText(`${it.name} • ${it.price} TON • ${it.seller}`, bodyX + 18, yy);
          clanButton(ctx, this.hit, bodyX + bodyW - 118, yy - 18, 100, 36, "Satın Al", () => {
            ClanSystem.buyMarketItem(this.store, i);
          });
          yy += 46;
        });
      }

      clanButton(ctx, this.hit, bodyX + 18, bodyY + bodyH - 56, 180, 40, "Örnek İlan Ekle", () => {
        ClanSystem.addMarketItem(this.store, {
          name: "OG Kush",
          price: Math.floor(Math.random() * 80) + 20,
          seller: this.store.get().player?.username || "Seller",
          qty: 1,
        });
      });
    }

    if (this.activeTab === "boss") {
      const boss = clan.boss || { hp: 0, maxHp: 1 };
      ctx.fillStyle = "#fff";
      ctx.font = "600 16px system-ui";
      ctx.fillText(`Boss HP: ${clanMoney(boss.hp)} / ${clanMoney(boss.maxHp)}`, bodyX + 18, bodyY + 34);

      const barX = bodyX + 18;
      const barY = bodyY + 58;
      const barW = Math.max(180, bodyW - 36);
      const ratio = Math.max(0, Math.min(1, boss.hp / Math.max(1, boss.maxHp)));
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      fillRoundRect(ctx, barX, barY, barW, 18, 9);
      ctx.fillStyle = "rgba(255,80,80,0.85)";
      fillRoundRect(ctx, barX, barY, barW * ratio, 18, 9);

      clanButton(ctx, this.hit, bodyX + 18, bodyY + 96, 170, 40, "1000 Hasar Vur", () => {
        ClanSystem.attackBoss(this.store, 1000);
      });

      clanButton(ctx, this.hit, bodyX + 202, bodyY + 96, 170, 40, "5000 Hasar Vur", () => {
        ClanSystem.attackBoss(this.store, 5000);
      });
    }

    if (this.activeTab === "savas") {
      const war = clan.war;
      ctx.fillStyle = "#fff";
      ctx.font = "600 16px system-ui";

      if (!war) {
        ctx.fillText("Aktif clan war yok.", bodyX + 18, bodyY + 34);
        clanButton(ctx, this.hit, bodyX + 18, bodyY + 64, 180, 42, "Savaşı Başlat", () => {
          ClanSystem.startWar(this.store);
        });
      } else {
        ctx.fillText(`Düşman: ${war.enemy}`, bodyX + 18, bodyY + 34);
        ctx.fillText(`İlerleme: ${war.progress}/${war.target}`, bodyX + 18, bodyY + 62);
        ctx.fillText(`Ödül: ${war.reward} TON`, bodyX + 18, bodyY + 90);
        ctx.fillText(`Durum: ${war.status}`, bodyX + 18, bodyY + 118);

        const barX = bodyX + 18;
        const barY = bodyY + 144;
        const barW = Math.max(180, bodyW - 36);
        const ratio = Math.max(0, Math.min(1, war.progress / Math.max(1, war.target)));
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, barX, barY, barW, 18, 9);
        ctx.fillStyle = war.status === "won" ? "rgba(90,220,120,0.88)" : "rgba(255,180,80,0.88)";
        fillRoundRect(ctx, barX, barY, barW * ratio, 18, 9);

        if (war.status === "active") {
          clanButton(ctx, this.hit, bodyX + 18, bodyY + 178, 170, 40, "500 Saldırı", () => {
            ClanSystem.attackWar(this.store, 500);
          });
          clanButton(ctx, this.hit, bodyX + 202, bodyY + 178, 170, 40, "2500 Saldırı", () => {
            ClanSystem.attackWar(this.store, 2500);
          });
        }

        clanButton(ctx, this.hit, bodyX + 18, bodyY + bodyH - 56, 160, 40, "Savaşı Sıfırla", () => {
          ClanSystem.resetWar(this.store);
        });
      }
    }

    if (this.activeTab === "rank") {
      const board = ClanSystem.leaderboard(this.store);
      ctx.fillStyle = "#fff";
      ctx.font = "600 15px system-ui";
      let yy = bodyY + 28;
      if (!board.length) {
        ctx.fillText("Sıralama yok.", bodyX + 18, yy);
      } else {
        board.slice(0, 8).forEach((c, i) => {
          ctx.fillText(`${i + 1}. ${c.name} [${c.tag}] • Güç ${ClanSystem.calcPower(c)}`, bodyX + 18, yy);
          yy += 30;
        });
      }
    }

    if (this.activeTab === "log") {
      const logs = clan.log || [];
      ctx.fillStyle = "#fff";
      ctx.font = "600 15px system-ui";
      let yy = bodyY + 28;
      if (!logs.length) {
        ctx.fillText("Henüz log yok.", bodyX + 18, yy);
      } else {
        logs.slice(-10).reverse().forEach((log) => {
          clanDrawWrappedText(ctx, `• ${String(log)}`, bodyX + 18, yy, bodyW - 36, 22);
          yy += 32;
        });
      }
    }
  }
}

/* ===== INPUT / SCENES ===== */
const input = new Input(canvas);
const scenes = new SceneManager();

window.tcStore = store;
window.tcScenes = scenes;

window.tc = window.tc || {};
window.tc.dev = {
  coin(n = 100) {
    const s = store.get();
    store.set({ coins: Number(s.coins || 0) + Number(n || 0) });
    console.log("coins:", store.get().coins);
  },
  energy(n = 10) {
    const s = store.get();
    const p = s.player || {};
    const maxE = Math.max(1, Number(p.energyMax || 10));
    const next = Math.min(maxE, Number(p.energy || 0) + Number(n || 0));
    store.set({ player: { ...p, energy: next } });
    console.log("energy:", store.get().player.energy);
  },
  level(n = 1) {
    const s = store.get();
    const p = s.player || {};
    store.set({ player: { ...p, level: Number(n || 1) } });
    console.log("level:", store.get().player.level);
  },
  missionAds(n = 20) {
    const s = store.get();
    const m = s.missions || {};
    store.set({ missions: { ...m, dailyAdWatched: Number(n || 0) } });
  },
  refs(n = 100) {
    const s = store.get();
    const m = s.missions || {};
    store.set({ missions: { ...m, referrals: Number(n || 0) } });
  },
  clanCreate() {
    if (ClanSystem.hasClan(store)) {
      console.log("Zaten clan var.");
      return;
    }

    ClanSystem.createClan(store, {
      name: "OTTOMAN",
      tag: "OTT",
      description: "Şehirde güç kurmak isteyen düzenli ve aktif ekip.",
    });

    console.log("Clan oluşturuldu:", store.get().clan);
  },
  clanReset() {
    const s = store.get();
    store.set({ ...s, clan: null });
    console.log("Clan sıfırlandı.");
  },
  clanAddMember() {
    ClanSystem.addMember(store, {
      id: `mock_${Date.now()}`,
      name: `Üye ${Math.floor(Math.random() * 90 + 10)}`,
      role: "Member",
      level: Math.floor(Math.random() * 25) + 20,
      power: Math.floor(Math.random() * 400) + 150,
    });
    console.log("Üye eklendi:", store.get().clan?.members?.length || 0);
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
scenes.register("missions", new MissionsScene({ store, input, assets, scenes }));
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
scenes.register("pvp", new MissionsScene({ store, input, assets, scenes }));

scenes.register("clanhub", new ClanHubScene({ store, scenes }));

scenes.register(
  "clan",
  new ClanSceneLocal({ store, input, assets, scenes })
);

scenes.register(
  "clan_create",
  new ClanCreateSceneLocal({ store, input, assets, scenes })
);

/* ===== ENGINE ===== */
const engine = new Engine({ canvas, ctx, input, scenes });

/* ===== KEEP SAFE AREA UPDATED ===== */
(function safeAreaLoop() {
  const s = store.get();
  store.set({ ui: { ...(s.ui || {}), safe: getSafeArea() } });
  requestAnimationFrame(safeAreaLoop);
})();

/* ===== PVP / MISSIONS TRACKING ===== */
window.addEventListener("tc:pvp:win", () => {
  const s = store.get();
  const m = s.missions || {};
  store.set({
    missions: {
      ...m,
      pvpPlayed: Number(m.pvpPlayed || 0) + 1,
    },
  });
});

window.addEventListener("tc:pvp:lose", () => {
  const s = store.get();
  const m = s.missions || {};
  store.set({
    missions: {
      ...m,
      pvpPlayed: Number(m.pvpPlayed || 0) + 1,
    },
  });
});

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
