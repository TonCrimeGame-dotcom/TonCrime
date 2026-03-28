import { Engine } from "./engine/Engine.js";
import { Store } from "./engine/Store.js";
import { SceneManager } from "./engine/SceneManager.js";
import { Input } from "./engine/Input.js";
import { Assets } from "./engine/Assets.js";
import { I18n } from "./engine/I18n.js";
import { supabase, ensureAuthSession, ensureGuestIdentitySync, getProfileKey, bindProfileToCurrentAuth } from "./supabase.js";

import { StarsScene } from "./scenes/StarsScene.js";
import { WeaponsScene } from "./scenes/WeaponsDealerScene.js";
import * as BootSceneModule from "./scenes/BootScene.js";
import { IntroScene } from "./scenes/IntroScene.js";
import { HomeScene } from "./scenes/HomeScene.js";
import { CoffeeShopScene } from "./scenes/CoffeeShopScene.js";
import { NightclubScene } from "./scenes/NightclubScene.js";
import { TradeScene } from "./scenes/TradeScene.js";
import { ProfileScene } from "./scenes/ProfileScene.js";

import { ClanSystem } from "./clan/ClanSystem.js";
import { ClanScene } from "./scenes/ClanScene.js";
import { ClanCreateScene } from "./scenes/ClanCreateScene.js";

import { startStarsOverlay } from "./ui/StarsOverlay.js";
import { startHud } from "./ui/Hud.js";
import { startChat } from "./ui/Chat.js";
import { startBotEngine } from "./engine/BotEngine.js";
import { startMenu } from "./ui/Menu.js";
import { startPvpLobby } from "./ui/PvpLobby.js";
import { startWeaponsDealer } from "./ui/WeaponsDealer.js";

const BootScene = BootSceneModule.BootScene || BootSceneModule.default;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

function getSafeArea() {
  const safe = document.getElementById("safe");
  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;

  if (!safe) {
    return { x: 0, y: 0, w: vw, h: vh };
  }

  const r = safe.getBoundingClientRect();

  return {
    x: Math.max(0, Math.round(r.left)),
    y: Math.max(0, Math.round(r.top)),
    w: Math.max(0, Math.round(r.width || vw)),
    h: Math.max(0, Math.round(r.height || vh)),
  };
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

function normalizeGlobalUi(store) {
  const hudTop = document.getElementById("hudTop");
  const chatDrawer = document.getElementById("chatDrawer");
  const pvpLayer = document.getElementById("pvpLayer");
  const pvpFab = document.getElementById("pvpFab");

  if (canvas) {
    canvas.style.position = "fixed";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.zIndex = "1000";
  }

  if (hudTop) {
    hudTop.style.zIndex = "5000";
    hudTop.style.opacity = "1";
  }

  if (chatDrawer) {
    chatDrawer.style.zIndex = "6000";
  }

  if (pvpLayer) {
    pvpLayer.style.zIndex = "7000";
  }

  if (pvpFab) {
    pvpFab.style.zIndex = "6500";
  }

  if (!store) return;

  const s = store.get();
  const ui = s.ui || {};

  const hudHeight = hudTop ? hudTop.offsetHeight : 110;
  const chatClosedHeight = 52;

  store.set({
    ui: {
      ...ui,
      safe: getSafeArea(),
      hudReservedTop: Math.max(110, hudHeight + 8),
      chatReservedBottom: Math.max(82, chatClosedHeight + 24),
    },
  });
}

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
      ui: {
        ...(defaultState.ui || {}),
        ...(loaded.ui || {}),
        safe: getSafeArea(),
      },
    }
  : defaultState;

const store = new Store(initial);
window.tcStore = store;

function syncLeaderboardSnapshot() {
  try {
    const s = store.get() || {};
    const pvp = { ...(s.pvp || {}) };
    const player = s.player || {};
    const username = String(player.username || "Player").trim() || "Player";
    const board = Array.isArray(pvp.leaderboard) ? pvp.leaderboard.map((x) => ({ ...x })) : [];
    const wins = Math.max(0, Number(pvp.wins || 0));
    const losses = Math.max(0, Number(pvp.losses || 0));
    const rating = Math.max(0, Number(pvp.rating || 1000));
    const score = rating + wins * 8;
    const entry = {
      id: String(player.telegramId || player.id || "player_main"),
      name: username,
      wins,
      losses,
      rating,
      score,
      updatedAt: Date.now(),
    };
    const next = board.filter((x) => x && String(x.name || "") !== username);
    next.push(entry);
    next.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    if (JSON.stringify(next.slice(0, 50)) !== JSON.stringify(board.slice(0, 50))) {
      store.set({
        pvp: {
          ...pvp,
          leaderboard: next.slice(0, 50),
        },
      });
    }
  } catch (err) {
    console.warn("[TonCrime] leaderboard sync failed:", err);
  }
}

syncLeaderboardSnapshot();

normalizeGlobalUi(store);

window.addEventListener("resize", () => {
  fitCanvas();
  normalizeGlobalUi(store);
});

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

function ensureRuntimeProfileIdentity() {
  try {
    const s = store.get() || {};
    const p = s.player || {};
    const telegramId = String(p.telegramId || getProfileKey(store) || "").trim();
    if (!telegramId) return;
    ensureGuestIdentitySync(store);
    if (String(p.telegramId || "").trim() !== telegramId) {
      store.set({
        player: {
          ...p,
          telegramId,
        },
      });
    }
  } catch (_) {}
}
ensureRuntimeProfileIdentity();

/* ===== SUPABASE PROFILE SYNC ===== */
let _profileSyncWarned = false;
async function syncProfileToSupabase() {
  try {
    ensureRuntimeProfileIdentity();
    const profileKey = String(getProfileKey(store) || "").trim();
    if (!profileKey) return null;

    const authUser = await ensureAuthSession().catch(() => null);
    if (!authUser) {
      if (!_profileSyncWarned) {
        _profileSyncWarned = true;
        console.warn("[PROFILE_SYNC] auth session unavailable; profile bind postponed.");
      }
      return null;
    }

    _profileSyncWarned = false;
    return await bindProfileToCurrentAuth(profileKey).catch((err) => {
      console.warn("[PROFILE_SYNC] bind failed:", err?.message || err);
      return null;
    });
  } catch (err) {
    if (!_profileSyncWarned) {
      _profileSyncWarned = true;
      console.warn("[PROFILE_SYNC] unexpected error:", err?.message || err);
    }
    return null;
  }
}

window.addEventListener("tc:profile-sync-now", () => {
  syncProfileToSupabase().catch(() => null);
});

/* ===== AUTH WARMUP ===== */
setTimeout(() => {
  ensureGuestIdentitySync(store);
  ensureRuntimeProfileIdentity();
  ensureAuthSession().then(() => syncProfileToSupabase()).catch(() => null);
}, 1200);
setTimeout(() => {
  syncProfileToSupabase().catch(() => null);
}, 4500);

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

addImage("background", "./src/assets/pvp-bg.png");
addImage("missions", "./src/assets/missions.jpg");
addImage("pvp", "./src/assets/pvp.jpg");
addImage("weapons", "./src/assets/weapons.jpg");
addImage("nightclub", "./src/assets/nightclub.jpg");
addImage("coffeeshop", "./src/assets/coffeeshop.jpg");
addImage("xxx", "./src/assets/xxx.jpg");
addImage("tata", "./src/assets/tata.png");
addImage("background_alt", "./src/assets/nightclub-bg.png");
addImage("home_bg", "./src/assets/pvp-bg.png");
addImage("clan", "./src/assets/Clan-bg.png");
addImage("clan_bg", "./src/assets/Clan-bg.png");
addImage("nightclub_bg", "./src/assets/nightclub-bg.png");
addImage("pvp_bg", "./src/assets/pvp-bg.png");
addImage("xxx_bg", "./src/assets/xxx-bg.png");

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

/* ===== MISSIONS SCENE ===== */

function missionClamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function missionPointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function missionRoundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function missionFillRoundRect(ctx, x, y, w, h, r) {
  missionRoundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function missionStrokeRoundRect(ctx, x, y, w, h, r) {
  missionRoundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

function missionDrawCoverImage(ctx, img, x, y, w, h, alpha = 1) {
  if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) * 0.5;
  const dy = y + (h - dh) * 0.5;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.globalAlpha = prev;
}

function missionGetAssetImageSafe(assets, key) {
  if (!assets) return null;
  try {
    if (typeof assets.getImage === "function") {
      const a = assets.getImage(key);
      if (a) return a;
    }
    if (typeof assets.get === "function") {
      const a = assets.get(key);
      if (a) return a;
    }
    if (assets.images?.[key]) return assets.images[key];
    if (assets[key]) return assets[key];
  } catch (_) {}
  return null;
}

function missionFmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function missionDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function missionWrapLines(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length >= maxLines - 1) break;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines && words.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 2 && ctx.measureText(last + "…").width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last + (last.endsWith("…") ? "" : "…");
  }

  return lines;
}

function missionEnsureDefaults(store) {
  const s = store.get() || {};
  const m = s.missions || {};

  store.set({
    missions: {
      ...m,
      dailyAdWatched: Number(m.dailyAdWatched || 0),
      dailyAdClaimed: !!m.dailyAdClaimed,
      referrals: Number(m.referrals || 0),
      referralClaim10: !!m.referralClaim10,
      referralClaim100: !!m.referralClaim100,
      referralClaim1000: !!m.referralClaim1000,
      referralClaim5000: !!m.referralClaim5000,
      pvpPlayed: Number(m.pvpPlayed || 0),
      pvpClaimed: !!m.pvpClaimed,
      energyRefillUsed: Number(m.energyRefillUsed || 0),
      energyClaimed: !!m.energyClaimed,
      telegramJoined: !!m.telegramJoined,
      telegramClaimed: !!m.telegramClaimed,
      levelClaimedAt: Number(m.levelClaimedAt || 0),
      lastDailyKey: String(m.lastDailyKey || ""),
    },
  });
}

class MissionsScene {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScrollY = 0;
    this.moved = 0;
    this.tapCandidate = false;

    this.hit = [];
    this.hitBack = null;
    this.toastText = "";
    this.toastUntil = 0;

    this.telegramUrl = "https://t.me/TONCRIME";
    this.inviteUrl = "https://t.me/share/url?url=https://t.me/TONCRIME_BOT";
  }

  onEnter() {
    missionEnsureDefaults(this.store);
    this._ensureDailyReset();
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.moved = 0;
    this.tapCandidate = false;
    this.hit = [];
    this.hitBack = null;
  }

  _safeRect(w, h) {
    const s = this.store.get() || {};
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

  _showToast(text, ms = 1600) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _ensureDailyReset() {
    const s = this.store.get() || {};
    const m = s.missions || {};
    const today = missionDayKey();
    if (m.lastDailyKey === today) return;

    this.store.set({
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

  _grantCoins(n) {
    const s = this.store.get() || {};
    this.store.set({ coins: Number(s.coins || 0) + Number(n || 0) });
  }

  _grantXP(n) {
    const s = this.store.get() || {};
    const p = s.player || {};
    let xp = Number(p.xp || 0) + Number(n || 0);
    let level = Number(p.level || 1);
    let xpToNext = Math.max(1, Number(p.xpToNext || 100));

    while (xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      xpToNext = 100;
    }

    this.store.set({
      player: {
        ...p,
        xp,
        level,
        xpToNext,
      },
    });
  }

  _grantEnergy(n) {
    const s = this.store.get() || {};
    const p = s.player || {};
    const maxE = Math.max(1, Number(p.energyMax || 100));
    const next = missionClamp(Number(p.energy || 0) + Number(n || 0), 0, maxE);

    this.store.set({
      player: {
        ...p,
        energy: next,
      },
    });
  }

  _setMissions(patch = {}) {
    const s = this.store.get() || {};
    const m = s.missions || {};
    this.store.set({
      missions: {
        ...m,
        ...patch,
      },
    });
  }

  async _watchAd() {
    const s = this.store.get() || {};
    const m = s.missions || {};
    if (Number(m.dailyAdWatched || 0) >= 20) {
      this._showToast("Günlük reklam limiti doldu");
      return;
    }

    let ok = false;

    try {
      if (typeof window?.showRewardedAd === "function") {
        const r = await window.showRewardedAd();
        ok = !!r || r === undefined;
      } else if (typeof window?.tcAds?.showRewarded === "function") {
        const r = await window.tcAds.showRewarded();
        ok = !!r || r === undefined;
      } else {
        ok = true;
      }
    } catch (_) {
      ok = false;
    }

    if (!ok) {
      this._showToast("Reklam tamamlanmadı");
      return;
    }

    const s2 = this.store.get() || {};
    const m2 = s2.missions || {};
    this.store.set({
      missions: {
        ...m2,
        dailyAdWatched: missionClamp(Number(m2.dailyAdWatched || 0) + 1, 0, 20),
      },
    });

    this._grantEnergy(1);
    this._showToast("+1 enerji");
  }

  _openInvite() {
    try {
      const rawUrl = "https://t.me/TONCRIME_BOT";
      if (navigator.share) {
        navigator.share({
          title: "TonCrime",
          text: "TonCrime'e katıl",
          url: rawUrl,
        }).catch(() => {});
      } else {
        window.open(this.inviteUrl, "_blank");
      }
    } catch (_) {}

    this._showToast("Davet bağlantısı açıldı");
  }

  _openTelegramTask() {
    const s = this.store.get() || {};
    const m = s.missions || {};

    if (m.telegramClaimed) {
      this._showToast("Telegram ödülü alındı");
      return;
    }

    if (!m.telegramJoined) {
      try {
        window.open(this.telegramUrl, "_blank");
      } catch (_) {}
      this._setMissions({ telegramJoined: true });
      this._showToast("Katılım açıldı");
      return;
    }

    this._grantCoins(20);
    this._setMissions({
      telegramJoined: true,
      telegramClaimed: true,
    });
    this._showToast("+20 coin");
  }

  _openPvp() {
    try {
      window.dispatchEvent(new CustomEvent("tc:openPvp", { detail: { source: "missions" } }));
    } catch (_) {}
    this._showToast("PvP açılıyor");
  }

  _claim(type) {
    const s = this.store.get() || {};
    const m = s.missions || {};
    const p = s.player || {};

    if (type === "dailyAd" && Number(m.dailyAdWatched || 0) >= 20 && !m.dailyAdClaimed) {
      this._grantCoins(20);
      this._grantXP(10);
      this._setMissions({ dailyAdClaimed: true });
      this._showToast("Reklam ödülü alındı");
      return;
    }

    if (type === "pvp" && Number(m.pvpPlayed || 0) >= 3 && !m.pvpClaimed) {
      this._grantCoins(15);
      this._grantXP(20);
      this._setMissions({ pvpClaimed: true });
      this._showToast("PvP ödülü alındı");
      return;
    }

    if (type === "energy" && Number(m.energyRefillUsed || 0) >= 1 && !m.energyClaimed) {
      this._grantCoins(10);
      this._grantEnergy(10);
      this._setMissions({ energyClaimed: true });
      this._showToast("Enerji ödülü alındı");
      return;
    }

    if (type === "level" && Number(p.level || 1) >= 55 && Number(m.levelClaimedAt || 0) !== 55) {
      this._grantCoins(50);
      this._grantXP(25);
      this._setMissions({ levelClaimedAt: 55 });
      this._showToast("Level ödülü alındı");
      return;
    }

    if (type === "ref10" && Number(m.referrals || 0) >= 10 && !m.referralClaim10) {
      this._setMissions({ referralClaim10: true });
      const s2 = this.store.get() || {};
      const p2 = s2.player || {};
      this.store.set({ player: { ...p2, weaponName: "Başlangıç Bıçağı", weaponBonus: "+3%" } });
      this._showToast("10 davet ödülü alındı");
      return;
    }

    if (type === "ref100" && Number(m.referrals || 0) >= 100 && !m.referralClaim100) {
      this._setMissions({ referralClaim100: true });
      const s2 = this.store.get() || {};
      const p2 = s2.player || {};
      this.store.set({ player: { ...p2, weaponName: "Orta Seviye Silah", weaponBonus: "+8%" } });
      this._showToast("100 davet ödülü alındı");
      return;
    }

    if (type === "ref1000" && Number(m.referrals || 0) >= 1000 && !m.referralClaim1000) {
      this._setMissions({ referralClaim1000: true });
      const s2 = this.store.get() || {};
      const p2 = s2.player || {};
      this.store.set({ player: { ...p2, weaponName: "En Güçlü Silah", weaponBonus: "+18%" } });
      this._showToast("1000 davet ödülü alındı");
      return;
    }

    if (type === "ref5000" && Number(m.referrals || 0) >= 5000 && !m.referralClaim5000) {
      this._setMissions({ referralClaim5000: true });
      this.store.set({ premium: true });
      this._showToast("5000 davet ödülü alındı");
    }
  }

  _cards() {
    const s = this.store.get() || {};
    const m = s.missions || {};
    const p = s.player || {};

    return [
      {
        key: "ads",
        title: `Günlük Reklam İzle (${missionFmtNum(m.dailyAdWatched)}/20)`,
        desc: "Her reklam +1 enerji verir. 20 reklama ulaştığında görev ödülü açılır.",
        reward: m.dailyAdClaimed ? "Ödül alındı" : "Ödül: +20 coin • +10 XP",
        buttonLabel: m.dailyAdClaimed ? "Alındı" : Number(m.dailyAdWatched || 0) >= 20 ? "Ödülü Al" : "İzle",
        buttonKind: m.dailyAdClaimed ? "done" : Number(m.dailyAdWatched || 0) >= 20 ? "claim" : "action",
        action: m.dailyAdClaimed ? null : Number(m.dailyAdWatched || 0) >= 20 ? "claim:dailyAd" : "watchAd",
        progress: missionClamp(Number(m.dailyAdWatched || 0) / 20, 0, 1),
      },
      {
        key: "invite",
        title: `Arkadaş Davet (${missionFmtNum(m.referrals)})`,
        desc: "Davet bağlantını paylaş. Backend bağlı olduğunda sayı otomatik ilerler.",
        reward: "Eşikler: 10 • 100 • 1000 • 5000",
        buttonLabel: "Davet Et",
        buttonKind: "action",
        action: "invite",
        progress: missionClamp(Number(m.referrals || 0) / 10, 0, 1),
      },
      {
        key: "pvp",
        title: `PvP Oyna (${missionFmtNum(m.pvpPlayed)}/3)`,
        desc: "3 maç tamamla. Görev ekranından direkt PvP açılabilir.",
        reward: m.pvpClaimed ? "Ödül alındı" : "Ödül: +15 coin • +20 XP",
        buttonLabel: m.pvpClaimed ? "Alındı" : Number(m.pvpPlayed || 0) >= 3 ? "Ödülü Al" : "Oyna",
        buttonKind: m.pvpClaimed ? "done" : Number(m.pvpPlayed || 0) >= 3 ? "claim" : "action",
        action: m.pvpClaimed ? null : Number(m.pvpPlayed || 0) >= 3 ? "claim:pvp" : "openPvp",
        progress: missionClamp(Number(m.pvpPlayed || 0) / 3, 0, 1),
      },
      {
        key: "energy",
        title: `Enerji Doldur (${Math.min(1, Number(m.energyRefillUsed || 0))}/1)`,
        desc: "Bir kez enerji dolumu yap. Sistem bağlanınca görev otomatik ilerler.",
        reward: m.energyClaimed ? "Ödül alındı" : "Ödül: +10 coin • +10 enerji",
        buttonLabel: m.energyClaimed ? "Alındı" : Number(m.energyRefillUsed || 0) >= 1 ? "Ödülü Al" : "Takipte",
        buttonKind: m.energyClaimed ? "done" : Number(m.energyRefillUsed || 0) >= 1 ? "claim" : "info",
        action: m.energyClaimed ? null : Number(m.energyRefillUsed || 0) >= 1 ? "claim:energy" : null,
        progress: missionClamp(Number(m.energyRefillUsed || 0), 0, 1),
      },
      {
        key: "level",
        title: `Level Görevi (Seviye ${missionFmtNum(p.level)}/55)`,
        desc: "55 level ve üstü olduğunda ödül açılır.",
        reward: Number(m.levelClaimedAt || 0) === 55 ? "Ödül alındı" : "Ödül: +50 coin • +25 XP",
        buttonLabel: Number(m.levelClaimedAt || 0) === 55 ? "Alındı" : Number(p.level || 1) >= 55 ? "Ödülü Al" : "Takipte",
        buttonKind: Number(m.levelClaimedAt || 0) === 55 ? "done" : Number(p.level || 1) >= 55 ? "claim" : "info",
        action: Number(m.levelClaimedAt || 0) === 55 ? null : Number(p.level || 1) >= 55 ? "claim:level" : null,
        progress: missionClamp(Number(p.level || 1) / 55, 0, 1),
      },
      {
        key: "telegram",
        title: "Telegram Grubuna Katıl",
        desc: "Önce katıl, sonra aynı butondan ödülü al.",
        reward: m.telegramClaimed ? "Ödül alındı" : "Ödül: +20 coin",
        buttonLabel: m.telegramClaimed ? "Alındı" : m.telegramJoined ? "Al" : "Katıl",
        buttonKind: m.telegramClaimed ? "done" : m.telegramJoined ? "claim" : "telegram",
        action: m.telegramClaimed ? null : "telegram",
        progress: m.telegramClaimed ? 1 : m.telegramJoined ? 1 : 0,
      },
      {
        key: "refThresholds",
        title: "Davet Eşik Ödülleri",
        desc: "Davet sayısına göre açılan ekstra ödüller.",
        reward: "10 / 100 / 1000 / 5000",
        buttonLabel: "Detay",
        buttonKind: "info",
        action: null,
        progress: missionClamp(Number(m.referrals || 0) / 5000, 0, 1),
        extraRows: [
          {
            text: `10 davet → ${m.referralClaim10 ? "Alındı" : "Başlangıç Bıçağı"}`,
            action: m.referralClaim10 ? null : Number(m.referrals || 0) >= 10 ? "claim:ref10" : null,
            label: m.referralClaim10 ? "Alındı" : Number(m.referrals || 0) >= 10 ? "Al" : "Kilitli",
            kind: m.referralClaim10 ? "done" : Number(m.referrals || 0) >= 10 ? "claim" : "info",
          },
          {
            text: `100 davet → ${m.referralClaim100 ? "Alındı" : "Orta Seviye Silah"}`,
            action: m.referralClaim100 ? null : Number(m.referrals || 0) >= 100 ? "claim:ref100" : null,
            label: m.referralClaim100 ? "Alındı" : Number(m.referrals || 0) >= 100 ? "Al" : "Kilitli",
            kind: m.referralClaim100 ? "done" : Number(m.referrals || 0) >= 100 ? "claim" : "info",
          },
          {
            text: `1000 davet → ${m.referralClaim1000 ? "Alındı" : "En Güçlü Silah"}`,
            action: m.referralClaim1000 ? null : Number(m.referrals || 0) >= 1000 ? "claim:ref1000" : null,
            label: m.referralClaim1000 ? "Alındı" : Number(m.referrals || 0) >= 1000 ? "Al" : "Kilitli",
            kind: m.referralClaim1000 ? "done" : Number(m.referrals || 0) >= 1000 ? "claim" : "info",
          },
          {
            text: `5000 davet → ${m.referralClaim5000 ? "Alındı" : "Premium"}`,
            action: m.referralClaim5000 ? null : Number(m.referrals || 0) >= 5000 ? "claim:ref5000" : null,
            label: m.referralClaim5000 ? "Alındı" : Number(m.referrals || 0) >= 5000 ? "Al" : "Kilitli",
            kind: m.referralClaim5000 ? "done" : Number(m.referrals || 0) >= 5000 ? "claim" : "info",
          },
        ],
      },
    ];
  }

  update() {
    this._ensureDailyReset();

    const p = this.input?.pointer || { x: 0, y: 0 };
    const px = Number(p.x || 0);
    const py = Number(p.y || 0);

    if (this.input.justPressed?.()) {
      this.dragging = true;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.moved = 0;
      this.tapCandidate = true;
    }

    if (this.dragging && this.input.isDown?.()) {
      const dy = py - this.downY;
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 6) {
        this.tapCandidate = false;
        this.scrollY = missionClamp(this.startScrollY - dy, 0, this.maxScroll);
      }
    }

    if (this.input.justReleased?.()) {
      const wasTap = this.tapCandidate && this.moved < 10;
      this.dragging = false;
      if (!wasTap) return;

      if (this.hitBack && missionPointInRect(px, py, this.hitBack)) {
        this.scenes.go("home");
        return;
      }

      for (const h of this.hit) {
        if (!missionPointInRect(px, py, h.rect)) continue;
        if (h.type === "watchAd") return this._watchAd();
        if (h.type === "invite") return this._openInvite();
        if (h.type === "telegram") return this._openTelegramTask();
        if (h.type === "openPvp") return this._openPvp();
        if (h.type === "claim") return this._claim(h.key);
      }
    }
  }

  render(ctx, w, h) {
    const s = this.store.get() || {};
    const safe = this._safeRect(w, h);
    const isTiny = safe.w <= 400;

    const bg =
      missionGetAssetImageSafe(this.assets, "missions") ||
      missionGetAssetImageSafe(this.assets, "pvp") ||
      missionGetAssetImageSafe(this.assets, "background");

    ctx.clearRect(0, 0, w, h);
    if (bg) {
      missionDrawCoverImage(ctx, bg, 0, 0, w, h, 1);
    } else {
      ctx.fillStyle = "#0b0a0f";
      ctx.fillRect(0, 0, w, h);
    }

    const bgOverlay = ctx.createLinearGradient(0, 0, 0, h);
    bgOverlay.addColorStop(0, "rgba(6,6,9,0.40)");
    bgOverlay.addColorStop(0.35, "rgba(8,7,6,0.56)");
    bgOverlay.addColorStop(1, "rgba(4,4,5,0.78)");
    ctx.fillStyle = bgOverlay;
    ctx.fillRect(0, 0, w, h);

    this.hit = [];
    this.hitBack = null;

    const panelX = safe.x;
    const panelY = safe.y;
    const panelW = safe.w;
    const panelH = safe.h;

    ctx.fillStyle = "rgba(8,8,10,0.24)";
    missionFillRoundRect(ctx, panelX, panelY, panelW, panelH, 22);
    ctx.strokeStyle = "rgba(255,194,96,0.22)";
    missionStrokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 22);

    const headerH = isTiny ? 54 : 58;
    const infoH = isTiny ? 72 : 80;
    const footerH = isTiny ? 44 : 48;

    const headerRect = { x: panelX + 10, y: panelY + 10, w: panelW - 20, h: headerH };
    const infoRect = { x: panelX + 10, y: headerRect.y + headerRect.h + 10, w: panelW - 20, h: infoH };
    const listRect = {
      x: panelX + 10,
      y: infoRect.y + infoRect.h + 10,
      w: panelW - 20,
      h: Math.max(140, panelH - headerH - infoH - footerH - 50),
    };
    const footerRect = {
      x: panelX + 10,
      y: listRect.y + listRect.h + 10,
      w: panelW - 20,
      h: footerH,
    };

    const glassFill = "rgba(12,12,15,0.46)";
    const glassStroke = "rgba(255,255,255,0.10)";

    ctx.fillStyle = glassFill;
    missionFillRoundRect(ctx, headerRect.x, headerRect.y, headerRect.w, headerRect.h, 20);
    ctx.strokeStyle = glassStroke;
    missionStrokeRoundRect(ctx, headerRect.x + 0.5, headerRect.y + 0.5, headerRect.w - 1, headerRect.h - 1, 20);

    ctx.fillStyle = glassFill;
    missionFillRoundRect(ctx, infoRect.x, infoRect.y, infoRect.w, infoRect.h, 18);
    ctx.strokeStyle = glassStroke;
    missionStrokeRoundRect(ctx, infoRect.x + 0.5, infoRect.y + 0.5, infoRect.w - 1, infoRect.h - 1, 18);

    ctx.fillStyle = "rgba(10,10,12,0.50)";
    missionFillRoundRect(ctx, listRect.x, listRect.y, listRect.w, listRect.h, 18);
    ctx.strokeStyle = "rgba(255,194,96,0.18)";
    missionStrokeRoundRect(ctx, listRect.x + 0.5, listRect.y + 0.5, listRect.w - 1, listRect.h - 1, 18);

    ctx.fillStyle = glassFill;
    missionFillRoundRect(ctx, footerRect.x, footerRect.y, footerRect.w, footerRect.h, 18);
    ctx.strokeStyle = glassStroke;
    missionStrokeRoundRect(ctx, footerRect.x + 0.5, footerRect.y + 0.5, footerRect.w - 1, footerRect.h - 1, 18);

    const closeW = isTiny ? 44 : 48;
    const closeH = 34;
    const closeRect = {
      x: headerRect.x + headerRect.w - closeW - 10,
      y: headerRect.y + 10,
      w: closeW,
      h: closeH,
    };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    missionFillRoundRect(ctx, closeRect.x, closeRect.y, closeRect.w, closeRect.h, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    missionStrokeRoundRect(ctx, closeRect.x + 0.5, closeRect.y + 0.5, closeRect.w - 1, closeRect.h - 1, 12);
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${isTiny ? 13 : 14}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("X", closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2 + 0.5);
    this.hitBack = closeRect;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = `900 ${isTiny ? 18 : 20}px system-ui`;
    ctx.fillText("Görevler", headerRect.x + 14, headerRect.y + 28);
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = `${isTiny ? 11 : 12}px system-ui`;
    ctx.fillText("Günlük • sosyal • davet ödülleri", headerRect.x + 14, headerRect.y + 46);

    const p = s.player || {};
    const m = s.missions || {};
    const summaryLeft = infoRect.x + 14;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `900 ${isTiny ? 14 : 15}px system-ui`;
    ctx.fillText("Bugünkü ilerleme", summaryLeft, infoRect.y + 24);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = `${isTiny ? 10 : 11}px system-ui`;
    ctx.fillText(`Level ${missionFmtNum(p.level || 1)} • Enerji ${missionFmtNum(p.energy || 0)}/${missionFmtNum(p.energyMax || 100)}`, summaryLeft, infoRect.y + 44);
    ctx.fillText(`Davet ${missionFmtNum(m.referrals || 0)} • PvP ${missionFmtNum(m.pvpPlayed || 0)}/3 • Reklam ${missionFmtNum(m.dailyAdWatched || 0)}/20`, summaryLeft, infoRect.y + 61);

    ctx.save();
    missionRoundRectPath(ctx, listRect.x, listRect.y, listRect.w, listRect.h, 18);
    ctx.clip();

    const cards = this._cards();
    const rowGap = 8;
    const baseRowH = isTiny ? 88 : 92;
    let y = listRect.y + 8 - this.scrollY;

    for (const card of cards) {
      const x = listRect.x + 8;
      const w2 = listRect.w - 16;
      const hasExtra = Array.isArray(card.extraRows) && card.extraRows.length > 0;
      const rowH = hasExtra ? (isTiny ? 176 : 184) : baseRowH;

      if (y + rowH >= listRect.y - 12 && y <= listRect.y + listRect.h + 12) {
        ctx.fillStyle = "rgba(13,10,16,0.44)";
        missionFillRoundRect(ctx, x, y, w2, rowH, 18);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        missionStrokeRoundRect(ctx, x + 0.5, y + 0.5, w2 - 1, rowH - 1, 18);

        const pad = 14;
        const btnW = isTiny ? 92 : 104;
        const btnH = 42;
        const btnX = x + w2 - btnW - 12;
        const btnY = y + 18;
        const textMaxW = w2 - btnW - pad * 2 - 18;

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${isTiny ? 13 : 15}px system-ui`;
        ctx.fillText(card.title, x + pad, y + 26);

        ctx.fillStyle = "rgba(255,255,255,0.76)";
        ctx.font = `${isTiny ? 10 : 11}px system-ui`;
        const descLines = missionWrapLines(ctx, card.desc, textMaxW, 2);
        for (let i = 0; i < descLines.length; i++) {
          ctx.fillText(descLines[i], x + pad, y + 45 + i * 14);
        }

        ctx.fillStyle = "rgba(255,255,255,0.62)";
        ctx.font = `${isTiny ? 10 : 11}px system-ui`;
        const rewardLines = missionWrapLines(ctx, card.reward, textMaxW, 1);
        ctx.fillText(rewardLines[0] || "", x + pad, y + 73);

        const barX = x + pad;
        const barY = y + rowH - 16;
        const barW = w2 - pad * 2;
        const barH = 6;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        missionFillRoundRect(ctx, barX, barY, barW, barH, 4);
        ctx.fillStyle = "rgba(255,176,44,0.96)";
        missionFillRoundRect(ctx, barX, barY, barW * missionClamp(card.progress || 0, 0, 1), barH, 4);

        let btnBg = "rgba(255,255,255,0.08)";
        let btnStroke = "rgba(255,255,255,0.14)";
        let btnText = "#ffffff";

        if (card.buttonKind === "done") {
          btnBg = "rgba(255,255,255,0.05)";
          btnStroke = "rgba(255,255,255,0.08)";
          btnText = "rgba(255,255,255,0.45)";
        } else if (card.buttonKind === "claim" || card.buttonKind === "telegram" || card.buttonKind === "action") {
          btnBg = "rgba(190,140,62,0.88)";
          btnStroke = "rgba(255,214,139,0.34)";
          btnText = "#ffffff";
        }

        ctx.fillStyle = btnBg;
        missionFillRoundRect(ctx, btnX, btnY, btnW, btnH, 14);
        ctx.strokeStyle = btnStroke;
        missionStrokeRoundRect(ctx, btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1, 14);
        ctx.fillStyle = btnText;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${isTiny ? 12 : 13}px system-ui`;
        ctx.fillText(card.buttonLabel, btnX + btnW / 2, btnY + btnH / 2 + 0.5);

        if (card.action) {
          if (card.action === "watchAd") this.hit.push({ type: "watchAd", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          else if (card.action === "invite") this.hit.push({ type: "invite", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          else if (card.action === "telegram") this.hit.push({ type: "telegram", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          else if (card.action === "openPvp") this.hit.push({ type: "openPvp", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          else if (card.action.startsWith("claim:")) this.hit.push({ type: "claim", key: card.action.replace("claim:", ""), rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
        }

        if (hasExtra) {
          let extraY = y + 92;
          for (const row of card.extraRows) {
            const rx = x + 12;
            const rw = w2 - 24;
            const rh = 24;
            const sBtnW = 74;
            const sBtnH = 26;
            const sBtnX = rx + rw - sBtnW - 8;
            const sBtnY = extraY - 1;

            ctx.fillStyle = "rgba(255,255,255,0.04)";
            missionFillRoundRect(ctx, rx, extraY, rw, rh, 10);
            ctx.strokeStyle = "rgba(255,255,255,0.06)";
            missionStrokeRoundRect(ctx, rx + 0.5, extraY + 0.5, rw - 1, rh - 1, 10);

            ctx.fillStyle = "rgba(255,255,255,0.82)";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.font = `${isTiny ? 10 : 11}px system-ui`;
            const rowTextMax = rw - sBtnW - 28;
            const rowText = missionWrapLines(ctx, row.text, rowTextMax, 1)[0] || "";
            ctx.fillText(rowText, rx + 10, extraY + rh / 2 + 0.5);

            let sbg = "rgba(255,255,255,0.05)";
            let sstroke = "rgba(255,255,255,0.08)";
            let stext = "rgba(255,255,255,0.45)";
            if (row.kind === "claim") {
              sbg = "rgba(190,140,62,0.88)";
              sstroke = "rgba(255,214,139,0.34)";
              stext = "#ffffff";
            } else if (row.kind === "done") {
              sbg = "rgba(255,255,255,0.05)";
              sstroke = "rgba(255,255,255,0.08)";
              stext = "rgba(255,255,255,0.45)";
            }

            ctx.fillStyle = sbg;
            missionFillRoundRect(ctx, sBtnX, sBtnY, sBtnW, sBtnH, 12);
            ctx.strokeStyle = sstroke;
            missionStrokeRoundRect(ctx, sBtnX + 0.5, sBtnY + 0.5, sBtnW - 1, sBtnH - 1, 12);
            ctx.fillStyle = stext;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `900 ${isTiny ? 10 : 11}px system-ui`;
            ctx.fillText(row.label, sBtnX + sBtnW / 2, sBtnY + sBtnH / 2 + 0.5);

            if (row.action && row.action.startsWith("claim:")) {
              this.hit.push({ type: "claim", key: row.action.replace("claim:", ""), rect: { x: sBtnX, y: sBtnY, w: sBtnW, h: sBtnH } });
            }

            extraY += 30;
          }
        }
      }

      y += rowH + rowGap;
    }

    const totalContent = y - (listRect.y + 8);
    this.maxScroll = Math.max(0, totalContent - listRect.h + 8);
    this.scrollY = missionClamp(this.scrollY, 0, this.maxScroll);

    if (this.maxScroll > 2) {
      const trackX = listRect.x + listRect.w - 6;
      const trackY = listRect.y + 8;
      const trackH = listRect.h - 16;
      const thumbH = Math.max(42, trackH * (listRect.h / Math.max(listRect.h, totalContent)));
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / Math.max(1, this.maxScroll));
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      missionFillRoundRect(ctx, trackX, trackY, 4, trackH, 2);
      ctx.fillStyle = "rgba(255,176,44,0.86)";
      missionFillRoundRect(ctx, trackX, thumbY, 4, thumbH, 2);
    }

    ctx.restore();

    const readyCount = cards.filter((card) => card.action && (card.buttonKind === "claim" || card.buttonKind === "telegram" || card.buttonKind === "action")).length;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `900 ${isTiny ? 13 : 14}px system-ui`;
    ctx.fillText(`Hazır görev: ${missionFmtNum(readyCount)}`, footerRect.x + 12, footerRect.y + 21);
    ctx.fillStyle = "rgba(255,255,255,0.66)";
    ctx.font = `${isTiny ? 10 : 11}px system-ui`;
    ctx.fillText(`Coin ${missionFmtNum(s.coins || 0)} • XP ${missionFmtNum((s.player || {}).xp || 0)}`, footerRect.x + 12, footerRect.y + 38);

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(panelW - 36, 280);
      const th = 38;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 10;
      ctx.fillStyle = "rgba(10,10,14,0.92)";
      missionFillRoundRect(ctx, tx, ty, tw, th, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      missionStrokeRoundRect(ctx, tx, ty, tw, th, 14);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 13px system-ui";
      ctx.fillText(this.toastText, tx + tw / 2, ty + th / 2);
    }
  }
}


/* ===== CLAN HUB SCENE ===== */
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
    this.scenes.go("clan");
  }

  render() {}
}

/* ===== INPUT / SCENES ===== */
const input = new Input(canvas);
const scenes = new SceneManager();

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
    store.set({ clan: null });
    console.log("Clan sıfırlandı.");
  },
  reset() {
    localStorage.removeItem(STORE_KEY);
    location.reload();
  },
};

/* ===== SCENES REGISTER ===== */
if (typeof BootScene !== "function") {
  throw new Error('BootScene export bulunamadı. BootScene.js içinde export default veya export class BootScene olmalı.');
}
scenes.register("boot", new BootScene({ assets, i18n, scenes }));
scenes.register("intro", new IntroScene({ store, input, scenes, assets }));
scenes.register("home", new HomeScene({ store, input, i18n, assets, scenes }));
scenes.register("missions", new MissionsScene({ store, input, assets, scenes }));
scenes.register("trade", new TradeScene({ store, input, i18n, assets, scenes }));

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
if (typeof window.PvpScene === "function") {
  scenes.register(
    "pvp",
    new window.PvpScene({
      store,
      input,
      assets,
      scenes,
      source: "menu",
    })
  );
} else {
  console.warn("[TonCrime] PvpScene bulunamadı, fallback MissionsScene çalıştı.");
  scenes.register("pvp", new MissionsScene({ store, input, assets, scenes }));
}

scenes.register("profile", new ProfileScene({ store, input, assets, scenes }));

scenes.register("clanhub", new ClanHubScene({ store, scenes }));

scenes.register(
  "clan",
  new ClanScene({ store, input, i18n, assets, scenes })
);

scenes.register(
  "clan_create",
  new ClanCreateScene({ store, input, i18n, assets, scenes })
);

window.addEventListener("tc:openPvp", () => {
  try {
    scenes.go("pvp");
  } catch (err) {
    console.warn("[TonCrime] tc:openPvp açılamadı:", err);
  }
});

window.addEventListener("tc:openProfile", () => {
  try {
    const s = store.get() || {};
    store.set({
      ui: {
        ...(s.ui || {}),
        profileTab: "profile",
      },
    });
    syncLeaderboardSnapshot();
    scenes.go("profile");
  } catch (err) {
    console.warn("[TonCrime] tc:openProfile açılamadı:", err);
  }
});

window.addEventListener("tc:openWallet", () => {
  try {
    const s = store.get() || {};
    store.set({
      ui: {
        ...(s.ui || {}),
        profileTab: "wallet",
      },
    });
    syncLeaderboardSnapshot();
    scenes.go("profile");
  } catch (err) {
    console.warn("[TonCrime] tc:openWallet açılamadı:", err);
  }
});

/* ===== ENGINE ===== */
const engine = new Engine({ canvas, ctx, input, scenes });

/* ===== KEEP SAFE AREA UPDATED ===== */
(function safeAreaLoop() {
  const s = store.get();
  const ui = s.ui || {};
  store.set({
    ui: {
      ...ui,
      safe: getSafeArea(),
    },
  });
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
  syncLeaderboardSnapshot();
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
  syncLeaderboardSnapshot();
});

/* ===== UI ===== */
startHud(store);
startChat(store);
startBotEngine(store);
startMenu(store);
startStarsOverlay?.(store);
startWeaponsDealer?.({ store, scenes, assets, input });
startPvpLobby();

normalizeGlobalUi(store);

/* ===== START ===== */
scenes.go("boot");
engine.start();
