import { Engine } from "./engine/Engine.js";
import { Store } from "./engine/Store.js";
import { SceneManager } from "./engine/SceneManager.js";
import { Input } from "./engine/Input.js";
import { Assets } from "./engine/Assets.js";
import { I18n } from "./engine/I18n.js";
import { supabase } from "./supabase.js";
import { ProfileScene } from "./scenes/ProfileScene.js";
import { StarsScene } from "./scenes/StarsScene.js";
import { WeaponsScene } from "./scenes/WeaponsDealerScene.js";
import { BootScene } from "./scenes/BootScene.js";
import { IntroScene } from "./scenes/IntroScene.js";
import { HomeScene } from "./scenes/HomeScene.js";
import { CoffeeShopScene } from "./scenes/CoffeeShopScene.js";
import { NightclubScene } from "./scenes/NightclubScene.js";
import { TradeScene } from "./scenes/TradeScene.js";

import { ClanSystem } from "./clan/ClanSystem.js";
import { ClanScene } from "./scenes/ClanScene.js";
import { ClanCreateScene } from "./scenes/ClanCreateScene.js";

import { startStarsOverlay } from "./ui/StarsOverlay.js";
import { startHud } from "./ui/Hud.js";
import { startChat } from "./ui/Chat.js";
import { startMenu } from "./ui/Menu.js";
import { startPvpLobby } from "./ui/PvpLobby.js";
import { startWeaponsDealer } from "./ui/WeaponsDealer.js";
import { startBotEngine } from "./BotEngine.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

/* =========================================================
 * BASE HELPERS
 * =======================================================*/
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function roundRectPath(ctx2, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx2.beginPath();
  ctx2.moveTo(x + rr, y);
  ctx2.arcTo(x + w, y, x + w, y + h, rr);
  ctx2.arcTo(x + w, y + h, x, y + h, rr);
  ctx2.arcTo(x, y + h, x, y, rr);
  ctx2.arcTo(x, y, x + w, y, rr);
  ctx2.closePath();
}

function fillRoundRect(ctx2, x, y, w, h, r) {
  roundRectPath(ctx2, x, y, w, h, r);
  ctx2.fill();
}

function strokeRoundRect(ctx2, x, y, w, h, r) {
  roundRectPath(ctx2, x, y, w, h, r);
  ctx2.stroke();
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function getAssetImageSafe(a, key) {
  try {
    return (
      (typeof a.getImage === "function" && a.getImage(key)) ||
      (typeof a.get === "function" && a.get(key)) ||
      a.images?.[key] ||
      a[key] ||
      null
    );
  } catch {
    return null;
  }
}

function drawCoverImage(ctx2, img, x, y, w, h, alpha = 1) {
  if (!img) return;

  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) * 0.5;
  const dy = y + (h - dh) * 0.5;

  const prev = ctx2.globalAlpha;
  ctx2.globalAlpha = alpha;
  ctx2.drawImage(img, dx, dy, dw, dh);
  ctx2.globalAlpha = prev;
}

function wrapLines(ctx2, text, maxWidth, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i += 1) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx2.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length >= maxLines - 1) break;
    }
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines && words.length) {
    let last = lines[lines.length - 1];
    while (last.length > 2 && ctx2.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }

  return lines;
}

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
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
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

  if (chatDrawer) chatDrawer.style.zIndex = "6000";
  if (pvpLayer) pvpLayer.style.zIndex = "7000";
  if (pvpFab) pvpFab.style.zIndex = "6500";

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

/* =========================================================
 * STORE
 * =======================================================*/
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
    weaponBonus: "",
    energy: 50,
    energyMax: 50,
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

  ui: {
    safe: getSafeArea(),
    hudReservedTop: 118,
    chatReservedBottom: 82,
  },

  bots: [],
  botState: {
    enabled: true,
    bootstrapped: false,
    lastPresenceAt: 0,
    lastMarketAt: 0,
    lastChatAt: 0,
  },
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
        ...defaultState.ui,
        ...(loaded.ui || {}),
        safe: getSafeArea(),
      },
    }
  : { ...defaultState };

const store = new Store(initial);
window.tcStore = store;

(function fixLegacyEnergyState() {
  const s = store.get() || {};
  const p = s.player || {};
  const energy = Number(p.energy || 0);
  const energyMax = Number(p.energyMax || 0);

  // Eski kayıtlar 10 / 10 gibi yanlış değerlerle gelirse bir kez 50 / 50 düzelt.
  if (energyMax <= 10 || energy <= 10) {
    store.set({
      player: {
        ...p,
        energy: 50,
        energyMax: 50,
      },
    });
  }
})();

normalizeGlobalUi(store);

window.addEventListener("resize", () => {
  fitCanvas();
  normalizeGlobalUi(store);
});

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

/* =========================================================
 * TELEGRAM USER INIT
 * =======================================================*/
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

/* =========================================================
 * SUPABASE PROFILE SYNC
 * =======================================================*/
let _lastProfileSyncAt = 0;
let _profileSyncBusy = false;
let _lastProfilePayload = "";

async function syncProfileToSupabase() {
  if (_profileSyncBusy) return;

  const s = store.get();
  const p = s.player || {};

  let syncEnergy = Number(p.energy || 0);
  let syncEnergyMax = Number(p.energyMax || 0);

  // Legacy 10/10 kayıtları otomatik 50/50 yap ve DB'ye öyle yaz.
  if (syncEnergyMax <= 10 || syncEnergy <= 10) {
    syncEnergy = 50;
    syncEnergyMax = 50;
    store.set({
      player: {
        ...p,
        energy: syncEnergy,
        energyMax: syncEnergyMax,
      },
    });
  }
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
    energy: syncEnergy || 50,
    energy_max: syncEnergyMax || 50,
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

/* =========================================================
 * AUTOSAVE
 * =======================================================*/
let _lastSaveAt = 0;
(function autosaveLoop() {
  const now = Date.now();
  if (now - _lastSaveAt > 300) {
    saveStore(store.get());
    _lastSaveAt = now;
  }
  requestAnimationFrame(autosaveLoop);
})();

/* =========================================================
 * ENERGY REGEN
 * =======================================================*/
function tickEnergy() {
  const s = store.get();
  const p = s.player;
  if (!p) return;

  const now = Date.now();
  const interval = Math.max(10000, Number(p.energyIntervalMs || 300000));
  const maxE = Math.max(1, Number(p.energyMax || 50));
  const e = clamp(Number(p.energy || 0), 0, maxE);

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

/* =========================================================
 * I18N
 * =======================================================*/
const i18n = new I18n(store);
i18n.register({
  tr: { loading: "Yükleniyor..." },
  en: { loading: "Loading..." },
});

/* =========================================================
 * ASSETS
 * =======================================================*/
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
addImage("clan_bg", "./src/assets/Clan-bg.png");
addImage("xxx", "./src/assets/xxx.jpg");
addImage("xxx_bg", "./src/assets/xxx-bg.png");
addImage("tata", "./src/assets/tata.png");
addImage("skull", "./src/assets/skull.png");
addImage("drink", "./src/assets/drink.png");
addImage("slap", "./src/assets/slap.png");
addImage("kick", "./src/assets/kick.png");
addImage("punch", "./src/assets/punch.png");
addImage("bonus", "./src/assets/bonus.png");
addImage("brain", "./src/assets/brain.png");
addImage("weed", "./src/assets/weed.png");

addImage("blackmarket", "./src/assets/BlackMarket.png");
addImage("blackmarket_bg", "./src/assets/BlackMarket.png");
addImage("trade", "./src/assets/BlackMarket.png");

/* =========================================================
 * MISSIONS SCENE
 * =======================================================*/
class MissionsScene {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;

    this.hitBack = null;
    this.hitButtons = [];
    this.scrollY = 0;
    this.maxScroll = 0;

    this.dragging = false;
    this.downX = 0;
    this.downY = 0;
    this.startScrollY = 0;
    this.moved = 0;
    this.tapCandidate = false;

    this.toastText = "";
    this.toastUntil = 0;

    this.telegramUrl = "https://t.me/TONCRIME";
    this.inviteUrl = "https://t.me/share/url?url=https://t.me/TONCRIME_BOT";
  }

  onEnter() {
    ensureDailyMissionReset();
    this.scrollY = 0;
    this.maxScroll = 0;
    this.hitButtons = [];
    this.hitBack = null;
  }

  _safeRect(w, h) {
    const s = this.store.get() || {};
    const safe = s?.ui?.safe || { x: 0, y: 0, w, h };
    const topReserved = Number(s?.ui?.hudReservedTop || 110);
    const bottomReserved = Number(s?.ui?.chatReservedBottom || 82);

    return {
      x: safe.x + 12,
      y: safe.y + topReserved + 6,
      w: safe.w - 24,
      h: safe.h - topReserved - bottomReserved - 12,
    };
  }

  _showToast(text, ms = 1400) {
    this.toastText = String(text || "");
    this.toastUntil = Date.now() + ms;
  }

  _grantCoins(n) {
    const s = this.store.get();
    this.store.set({ coins: Number(s.coins || 0) + Number(n || 0) });
  }

  _grantEnergy(n) {
    const s = this.store.get();
    const p = s.player || {};
    const maxE = Math.max(1, Number(p.energyMax || 50));
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

    this.store.set({ player: { ...p, xp, level, xpToNext } });
  }

  _setMissions(patch = {}) {
    const s = this.store.get();
    const m = s.missions || {};
    this.store.set({
      missions: {
        ...m,
        ...patch,
      },
    });
  }

  async _watchAd() {
    const s = this.store.get();
    const m = s.missions || {};

    if (Number(m.dailyAdWatched || 0) >= 20) {
      this._showToast("Günlük reklam limiti doldu");
      return;
    }

    let ok = false;

    try {
      if (typeof window?.showRewardedAd === "function") {
        const res = await window.showRewardedAd();
        ok = !!res || res === undefined;
      } else if (typeof window?.tcAds?.showRewarded === "function") {
        const res = await window.tcAds.showRewarded();
        ok = !!res || res === undefined;
      } else {
        ok = true;
      }
    } catch {
      ok = false;
    }

    if (!ok) {
      this._showToast("Reklam tamamlanmadı");
      return;
    }

    const s2 = this.store.get();
    const m2 = s2.missions || {};
    this.store.set({
      missions: {
        ...m2,
        dailyAdWatched: clamp(Number(m2.dailyAdWatched || 0) + 1, 0, 20),
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
    const s = this.store.get();
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

    this._claim("telegram");
  }

  _openPvp() {
    try {
      window.dispatchEvent(new CustomEvent("tc:openPvp", { detail: { source: "missions" } }));
    } catch (_) {}
    this._showToast("PvP açılıyor");
  }

  _claim(type) {
    const s = this.store.get();
    const m = { ...(s.missions || {}) };
    const p = s.player || {};

    if (type === "dailyAd" && m.dailyAdWatched >= 20 && !m.dailyAdClaimed) {
      m.dailyAdClaimed = true;
      this.store.set({ missions: m });
      this.store.set({
        player: {
          ...(this.store.get().player || {}),
          weaponName: "Reklam Ustası",
          weaponBonus: "+2%",
        },
      });
      this._showToast("Reklam görevi ödülü alındı");
      return;
    }

    if (type === "ref10" && m.referrals >= 10 && !m.referralClaim10) {
      m.referralClaim10 = true;
      this.store.set({ missions: m });
      this.store.set({
        player: {
          ...(this.store.get().player || {}),
          weaponName: "Başlangıç Bıçağı",
          weaponBonus: "+3%",
        },
      });
      this._showToast("10 davet ödülü alındı");
      return;
    }

    if (type === "ref100" && m.referrals >= 100 && !m.referralClaim100) {
      m.referralClaim100 = true;
      this.store.set({ missions: m });
      this.store.set({
        player: {
          ...(this.store.get().player || {}),
          weaponName: "Orta Seviye Silah",
          weaponBonus: "+8%",
        },
      });
      this._showToast("100 davet ödülü alındı");
      return;
    }

    if (type === "ref1000" && m.referrals >= 1000 && !m.referralClaim1000) {
      m.referralClaim1000 = true;
      this.store.set({ missions: m });
      this.store.set({
        player: {
          ...(this.store.get().player || {}),
          weaponName: "En Güçlü Silah",
          weaponBonus: "+18%",
        },
      });
      this._showToast("1000 davet ödülü alındı");
      return;
    }

    if (type === "ref5000" && m.referrals >= 5000 && !m.referralClaim5000) {
      m.referralClaim5000 = true;
      this.store.set({ missions: m, premium: true });
      this._showToast("5000 davet ödülü alındı");
      return;
    }

    if (type === "pvp" && m.pvpPlayed >= 3 && !m.pvpClaimed) {
      m.pvpClaimed = true;
      this.store.set({ missions: m });
      this._grantXP(20);
      this._grantCoins(15);
      this._showToast("PvP ödülü alındı");
      return;
    }

    if (type === "energy" && m.energyRefillUsed >= 1 && !m.energyClaimed) {
      m.energyClaimed = true;
      this.store.set({ missions: m });
      this._grantCoins(10);
      this._grantEnergy(10);
      this._showToast("Enerji ödülü alındı");
      return;
    }

    if (type === "telegram" && m.telegramJoined && !m.telegramClaimed) {
      m.telegramClaimed = true;
      this.store.set({ missions: m });
      this._grantCoins(20);
      this._showToast("Telegram ödülü alındı");
      return;
    }

    if (type === "level" && Number(p.level || 1) >= 55 && m.levelClaimedAt !== 55) {
      m.levelClaimedAt = 55;
      this.store.set({ missions: m });
      this._grantCoins(50);
      this._grantXP(25);
      this._showToast("Level ödülü alındı");
    }
  }

  _buildRows() {
    const s = this.store.get();
    const p = s.player || {};
    const m = s.missions || {};

    return [
      {
        key: "ads",
        title: `Günlük Reklam İzle (${fmtNum(m.dailyAdWatched)}/20)`,
        desc: "Her reklam +1 enerji verir. 20 reklama ulaşınca görev ödülü açılır.",
        reward: m.dailyAdClaimed ? "Ödül alındı" : "Ödül: özel silah bonusu",
        tags: ["Reklam", "Enerji"],
        buttonLabel: m.dailyAdClaimed
          ? "Alındı"
          : Number(m.dailyAdWatched || 0) >= 20
          ? "Ödülü Al"
          : "İzle",
        buttonKind: m.dailyAdClaimed
          ? "done"
          : Number(m.dailyAdWatched || 0) >= 20
          ? "claim"
          : "action",
        action: m.dailyAdClaimed
          ? null
          : Number(m.dailyAdWatched || 0) >= 20
          ? "claim:dailyAd"
          : "watchAd",
        progress: clamp(Number(m.dailyAdWatched || 0) / 20, 0, 1),
      },
      {
        key: "invite",
        title: `Arkadaş Davet (${fmtNum(m.referrals)})`,
        desc: "Davet bağlantını paylaş. Davet sayısı backend bağlanınca otomatik ilerler.",
        reward: "10 / 100 / 1000 / 5000 eşik ödülleri",
        tags: ["Davet", "Referral"],
        buttonLabel: "Davet Et",
        buttonKind: "action",
        action: "invite",
        progress: clamp(Number(m.referrals || 0) / 10, 0, 1),
      },
      {
        key: "pvp",
        title: `PvP Oyna (${fmtNum(m.pvpPlayed)}/3)`,
        desc: "3 maç tamamla. PvP butonu görev sayfasından direkt açılır.",
        reward: m.pvpClaimed ? "Ödül alındı" : "Ödül: +15 coin +20 XP",
        tags: ["PvP", "Maç"],
        buttonLabel: m.pvpClaimed
          ? "Alındı"
          : Number(m.pvpPlayed || 0) >= 3
          ? "Ödülü Al"
          : "Oyna",
        buttonKind: m.pvpClaimed
          ? "done"
          : Number(m.pvpPlayed || 0) >= 3
          ? "claim"
          : "action",
        action: m.pvpClaimed
          ? null
          : Number(m.pvpPlayed || 0) >= 3
          ? "claim:pvp"
          : "openPvp",
        progress: clamp(Number(m.pvpPlayed || 0) / 3, 0, 1),
      },
      {
        key: "energy",
        title: `Enerji Doldur (${Math.min(1, Number(m.energyRefillUsed || 0))}/1)`,
        desc: "Bir kez enerji dolumu yap. Enerji satın alma bağlanınca otomatik ilerler.",
        reward: m.energyClaimed ? "Ödül alındı" : "Ödül: +10 coin +10 enerji",
        tags: ["Enerji", "Bina"],
        buttonLabel: m.energyClaimed
          ? "Alındı"
          : Number(m.energyRefillUsed || 0) >= 1
          ? "Ödülü Al"
          : "Takipte",
        buttonKind: m.energyClaimed
          ? "done"
          : Number(m.energyRefillUsed || 0) >= 1
          ? "claim"
          : "info",
        action: m.energyClaimed
          ? null
          : Number(m.energyRefillUsed || 0) >= 1
          ? "claim:energy"
          : null,
        progress: clamp(Number(m.energyRefillUsed || 0), 0, 1),
      },
      {
        key: "level",
        title: `Level Görevi (Seviye ${fmtNum(p.level || 1)}/55)`,
        desc: "55 level ve üstü olduğunda ödül açılır.",
        reward: Number(m.levelClaimedAt || 0) === 55 ? "Ödül alındı" : "Ödül: +50 coin +25 XP",
        tags: ["Level", "XP"],
        buttonLabel:
          Number(m.levelClaimedAt || 0) === 55
            ? "Alındı"
            : Number(p.level || 1) >= 55
            ? "Ödülü Al"
            : "Takipte",
        buttonKind:
          Number(m.levelClaimedAt || 0) === 55
            ? "done"
            : Number(p.level || 1) >= 55
            ? "claim"
            : "info",
        action:
          Number(m.levelClaimedAt || 0) === 55
            ? null
            : Number(p.level || 1) >= 55
            ? "claim:level"
            : null,
        progress: clamp(Number(p.level || 1) / 55, 0, 1),
      },
      {
        key: "telegram",
        title: "Telegram Grubuna Katıl",
        desc: "Tek butonlu akış: önce katıl, sonra aynı buton ödülü al haline döner.",
        reward: m.telegramClaimed ? "Ödül alındı" : "Ödül: +20 coin",
        tags: ["Telegram", "Sosyal"],
        buttonLabel: m.telegramClaimed ? "Alındı" : m.telegramJoined ? "Al" : "Katıl",
        buttonKind: m.telegramClaimed ? "done" : m.telegramJoined ? "claim" : "telegram",
        action: m.telegramClaimed ? null : "telegram",
        progress: m.telegramClaimed ? 1 : m.telegramJoined ? 1 : 0,
      },
      {
        key: "thresholds",
        title: "Davet Eşik Ödülleri",
        desc: "Aşağıdaki eşiklerden uygun olanı al.",
        reward: "10 / 100 / 1000 / 5000",
        tags: ["Ödül", "Eşik"],
        buttonLabel: "Detay",
        buttonKind: "info",
        action: null,
        progress: clamp(Number(m.referrals || 0) / 5000, 0, 1),
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
            action:
              m.referralClaim1000 ? null : Number(m.referrals || 0) >= 1000 ? "claim:ref1000" : null,
            label:
              m.referralClaim1000 ? "Alındı" : Number(m.referrals || 0) >= 1000 ? "Al" : "Kilitli",
            kind:
              m.referralClaim1000 ? "done" : Number(m.referrals || 0) >= 1000 ? "claim" : "info",
          },
          {
            text: `5000 davet → ${m.referralClaim5000 ? "Alındı" : "Premium"}`,
            action:
              m.referralClaim5000 ? null : Number(m.referrals || 0) >= 5000 ? "claim:ref5000" : null,
            label:
              m.referralClaim5000 ? "Alındı" : Number(m.referrals || 0) >= 5000 ? "Al" : "Kilitli",
            kind:
              m.referralClaim5000 ? "done" : Number(m.referrals || 0) >= 5000 ? "claim" : "info",
          },
        ],
      },
    ];
  }

  update() {
    const p = this.input?.pointer || { x: 0, y: 0 };
    const px = Number(p.x || 0);
    const py = Number(p.y || 0);

    if (this.input.justPressed?.()) {
      this.dragging = true;
      this.downX = px;
      this.downY = py;
      this.startScrollY = this.scrollY;
      this.moved = 0;
      this.tapCandidate = true;
    }

    if (this.dragging) {
      const dy = py - this.downY;
      this.moved = Math.max(this.moved, Math.abs(dy));

      if (this.moved > 6) {
        this.tapCandidate = false;
        this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);
      }
    }

    if (!this.input.justReleased?.()) return;

    const wasTap = this.tapCandidate && this.moved < 10;
    this.dragging = false;

    if (!wasTap) return;

    if (this.hitBack && pointInRect(px, py, this.hitBack)) {
      this.scenes.go("home");
      return;
    }

    for (const b of this.hitButtons) {
      if (!pointInRect(px, py, b.rect)) continue;

      if (b.type === "watchAd") {
        this._watchAd();
        return;
      }

      if (b.type === "invite") {
        this._openInvite();
        return;
      }

      if (b.type === "telegram") {
        this._openTelegramTask();
        return;
      }

      if (b.type === "openPvp") {
        this._openPvp();
        return;
      }

      if (b.type === "claim") {
        this._claim(b.key);
        return;
      }
    }
  }

  render(ctx2, w, h) {
    const s = this.store.get();
    const p = s.player || {};
    const safe = this._safeRect(w, h);

    const bg =
      getAssetImageSafe(this.assets, "missions") ||
      getAssetImageSafe(this.assets, "pvp") ||
      getAssetImageSafe(this.assets, "background");

    if (bg) {
      drawCoverImage(ctx2, bg, 0, 0, w, h, 1);
    } else {
      ctx2.fillStyle = "#0b0a0f";
      ctx2.fillRect(0, 0, w, h);
    }

    ctx2.fillStyle = "rgba(0,0,0,0.52)";
    ctx2.fillRect(0, 0, w, h);

    const panelX = safe.x;
    const panelY = safe.y;
    const panelW = safe.w;
    const panelH = safe.h;

    this.hitButtons = [];
    this.hitBack = null;

    ctx2.fillStyle = "rgba(12,8,10,0.34)";
    fillRoundRect(ctx2, panelX, panelY, panelW, panelH, 24);
    ctx2.strokeStyle = "rgba(255,173,58,0.6)";
    ctx2.lineWidth = 1.2;
    strokeRoundRect(ctx2, panelX, panelY, panelW, panelH, 24);

    const headerH = 108;
    const innerX = panelX + 14;
    const innerW = panelW - 28;

    ctx2.fillStyle = "rgba(255,255,255,0.045)";
    fillRoundRect(ctx2, innerX, panelY + 12, innerW, headerH, 18);
    ctx2.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx2, innerX, panelY + 12, innerW, headerH, 18);

    ctx2.textAlign = "left";
    ctx2.textBaseline = "alphabetic";
    ctx2.fillStyle = "#ffffff";
    ctx2.font = "700 18px system-ui";
    ctx2.fillText("Görevler", innerX + 16, panelY + 42);

    ctx2.fillStyle = "rgba(255,255,255,0.78)";
    ctx2.font = "13px system-ui";
    ctx2.fillText("Günlük görevler, sosyal görevler ve davet ödülleri", innerX + 16, panelY + 65);

    const backW = 92;
    const backH = 42;
    const backX = innerX + innerW - backW - 12;
    const backY = panelY + 24;
    this.hitBack = { x: backX, y: backY, w: backW, h: backH };

    ctx2.fillStyle = "rgba(30,28,38,0.9)";
    fillRoundRect(ctx2, backX, backY, backW, backH, 14);
    ctx2.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx2, backX, backY, backW, backH, 14);
    ctx2.fillStyle = "#ffffff";
    ctx2.font = "700 14px system-ui";
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText("Kapat", backX + backW / 2, backY + backH / 2);

    const chips = [
      `LVL ${fmtNum(p.level || 1)}`,
      `${fmtNum(p.energy || 0)}/${fmtNum(p.energyMax || 100)} EN`,
      `${fmtNum(s.missions?.referrals || 0)} DAVET`,
    ];

    let chipX = innerX + 16;
    const chipY = panelY + 82;

    for (const chip of chips) {
      ctx2.font = "600 12px system-ui";
      const tw = ctx2.measureText(chip).width;
      const cw = tw + 22;
      ctx2.fillStyle = "rgba(255,255,255,0.06)";
      fillRoundRect(ctx2, chipX, chipY, cw, 24, 12);
      ctx2.strokeStyle = "rgba(255,255,255,0.08)";
      strokeRoundRect(ctx2, chipX, chipY, cw, 24, 12);
      ctx2.fillStyle = "rgba(255,255,255,0.92)";
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText(chip, chipX + cw / 2, chipY + 12);
      chipX += cw + 8;
    }

    const contentX = panelX + 10;
    const contentY = panelY + headerH + 20;
    const contentW = panelW - 20;
    const contentH = panelH - headerH - 30;

    ctx2.save();
    roundRectPath(ctx2, contentX, contentY, contentW, contentH, 18);
    ctx2.clip();

    const cards = this._buildRows();
    let y = contentY + 4 - this.scrollY;
    const gap = 14;

    for (const card of cards) {
      const x = contentX + 4;
      const w2 = contentW - 8;
      const hasExtra = Array.isArray(card.extraRows) && card.extraRows.length > 0;
      const cardH = hasExtra ? 220 : 126;

      if (y + cardH >= contentY - 12 && y <= contentY + contentH + 12) {
        ctx2.fillStyle = "rgba(13,10,16,0.56)";
        fillRoundRect(ctx2, x, y, w2, cardH, 20);
        ctx2.strokeStyle = "rgba(255,170,40,0.50)";
        ctx2.lineWidth = 1;
        strokeRoundRect(ctx2, x, y, w2, cardH, 20);

        const pad = 14;
        const btnW = 104;
        const btnH = 42;
        const btnX = x + w2 - btnW - 14;
        const btnY = y + 18;

        const textMaxW = w2 - btnW - pad * 2 - 24;

        ctx2.fillStyle = "#ffffff";
        ctx2.textAlign = "left";
        ctx2.textBaseline = "alphabetic";
        ctx2.font = "700 16px system-ui";
        ctx2.fillText(card.title, x + pad, y + 28);

        ctx2.fillStyle = "rgba(255,255,255,0.76)";
        ctx2.font = "13px system-ui";
        const descLines = wrapLines(ctx2, card.desc, textMaxW, 2);
        for (let i = 0; i < descLines.length; i += 1) {
          ctx2.fillText(descLines[i], x + pad, y + 50 + i * 16);
        }

        let tagX = x + pad;
        const tagY = y + 76;

        for (const tag of card.tags || []) {
          ctx2.font = "600 11px system-ui";
          const tw = ctx2.measureText(String(tag)).width;
          const chipW = tw + 18;

          ctx2.fillStyle = "rgba(255,255,255,0.06)";
          fillRoundRect(ctx2, tagX, tagY, chipW, 22, 11);
          ctx2.strokeStyle = "rgba(255,255,255,0.08)";
          strokeRoundRect(ctx2, tagX, tagY, chipW, 22, 11);
          ctx2.fillStyle = "rgba(255,255,255,0.90)";
          ctx2.textAlign = "center";
          ctx2.textBaseline = "middle";
          ctx2.fillText(String(tag), tagX + chipW / 2, tagY + 11);

          tagX += chipW + 7;
        }

        const barX = x + pad;
        const barY = y + 104;
        const barW = w2 - pad * 2;
        const barH = 8;

        ctx2.fillStyle = "rgba(255,255,255,0.08)";
        fillRoundRect(ctx2, barX, barY, barW, barH, 4);
        ctx2.fillStyle = "rgba(255,176,44,0.98)";
        fillRoundRect(ctx2, barX, barY, barW * clamp(card.progress || 0, 0, 1), barH, 4);

        ctx2.fillStyle = "rgba(255,255,255,0.76)";
        ctx2.textAlign = "left";
        ctx2.textBaseline = "alphabetic";
        ctx2.font = "12px system-ui";
        ctx2.fillText(card.reward, x + pad, y + 96);

        let btnBg = "rgba(255,255,255,0.08)";
        let btnStroke = "rgba(255,255,255,0.12)";
        let btnText = "#ffffff";

        if (card.buttonKind === "done") {
          btnBg = "rgba(31,111,42,0.88)";
          btnStroke = "rgba(102,208,120,0.45)";
        } else if (card.buttonKind === "claim") {
          btnBg = "rgba(255,186,59,0.18)";
          btnStroke = "rgba(255,186,59,0.50)";
        } else if (card.buttonKind === "telegram") {
          btnBg = "rgba(88,160,255,0.18)";
          btnStroke = "rgba(88,160,255,0.45)";
        } else if (card.buttonKind === "info") {
          btnBg = "rgba(255,255,255,0.05)";
          btnStroke = "rgba(255,255,255,0.08)";
          btnText = "rgba(255,255,255,0.55)";
        }

        ctx2.fillStyle = btnBg;
        fillRoundRect(ctx2, btnX, btnY, btnW, btnH, 15);
        ctx2.strokeStyle = btnStroke;
        strokeRoundRect(ctx2, btnX, btnY, btnW, btnH, 15);
        ctx2.fillStyle = btnText;
        ctx2.font = "700 14px system-ui";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText(card.buttonLabel, btnX + btnW / 2, btnY + btnH / 2);

        if (card.action) {
          if (card.action === "watchAd") {
            this.hitButtons.push({ type: "watchAd", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          } else if (card.action === "invite") {
            this.hitButtons.push({ type: "invite", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          } else if (card.action === "telegram") {
            this.hitButtons.push({ type: "telegram", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          } else if (card.action === "openPvp") {
            this.hitButtons.push({ type: "openPvp", rect: { x: btnX, y: btnY, w: btnW, h: btnH } });
          } else if (card.action.startsWith("claim:")) {
            this.hitButtons.push({
              type: "claim",
              key: card.action.replace("claim:", ""),
              rect: { x: btnX, y: btnY, w: btnW, h: btnH },
            });
          }
        }

        if (hasExtra) {
          let rowY = y + 122;

          for (const row of card.extraRows) {
            const rx = x + 12;
            const rw = w2 - 24;
            const rh = 21;

            ctx2.fillStyle = "rgba(255,255,255,0.04)";
            fillRoundRect(ctx2, rx, rowY, rw, rh, 10);
            ctx2.strokeStyle = "rgba(255,255,255,0.06)";
            strokeRoundRect(ctx2, rx, rowY, rw, rh, 10);

            const smallBtnW = 72;
            const smallBtnH = 25;
            const smallBtnX = rx + rw - smallBtnW - 8;
            const smallBtnY = rowY - 2;

            ctx2.fillStyle = "rgba(255,255,255,0.78)";
            ctx2.textAlign = "left";
            ctx2.textBaseline = "middle";
            ctx2.font = "12px system-ui";
            ctx2.fillText(row.text, rx + 10, rowY + rh / 2);

            let sbg = "rgba(255,255,255,0.05)";
            let sstroke = "rgba(255,255,255,0.08)";
            let stext = "rgba(255,255,255,0.55)";

            if (row.kind === "done") {
              sbg = "rgba(31,111,42,0.88)";
              sstroke = "rgba(102,208,120,0.45)";
              stext = "#ffffff";
            } else if (row.kind === "claim") {
              sbg = "rgba(255,186,59,0.18)";
              sstroke = "rgba(255,186,59,0.50)";
              stext = "#ffffff";
            }

            ctx2.fillStyle = sbg;
            fillRoundRect(ctx2, smallBtnX, smallBtnY, smallBtnW, smallBtnH, 12);
            ctx2.strokeStyle = sstroke;
            strokeRoundRect(ctx2, smallBtnX, smallBtnY, smallBtnW, smallBtnH, 12);
            ctx2.fillStyle = stext;
            ctx2.textAlign = "center";
            ctx2.textBaseline = "middle";
            ctx2.font = "700 12px system-ui";
            ctx2.fillText(row.label, smallBtnX + smallBtnW / 2, smallBtnY + smallBtnH / 2);

            if (row.action && row.action.startsWith("claim:")) {
              this.hitButtons.push({
                type: "claim",
                key: row.action.replace("claim:", ""),
                rect: { x: smallBtnX, y: smallBtnY, w: smallBtnW, h: smallBtnH },
              });
            }

            rowY += 30;
          }
        }
      }

      y += cardH + gap;
    }

    const totalContent = y - (contentY + 4);
    this.maxScroll = Math.max(0, totalContent - contentH + 8);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    if (this.maxScroll > 2) {
      const trackX = contentX + contentW - 6;
      const trackY = contentY + 8;
      const trackH = contentH - 16;
      const thumbH = Math.max(42, trackH * (contentH / Math.max(contentH, totalContent)));
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / Math.max(1, this.maxScroll));

      ctx2.fillStyle = "rgba(255,255,255,0.08)";
      fillRoundRect(ctx2, trackX, trackY, 4, trackH, 2);
      ctx2.fillStyle = "rgba(255,176,44,0.86)";
      fillRoundRect(ctx2, trackX, thumbY, 4, thumbH, 2);
    }

    ctx2.restore();

    if (this.toastText && Date.now() < this.toastUntil) {
      const tw = Math.min(panelW - 36, 280);
      const th = 38;
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - th - 10;

      ctx2.fillStyle = "rgba(10,10,14,0.92)";
      fillRoundRect(ctx2, tx, ty, tw, th, 14);
      ctx2.strokeStyle = "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx2, tx, ty, tw, th, 14);
      ctx2.fillStyle = "#ffffff";
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.font = "700 13px system-ui";
      ctx2.fillText(this.toastText, tx + tw / 2, ty + th / 2);
    }
  }
}

/* =========================================================
 * CLAN HUB
 * =======================================================*/
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

/* =========================================================
 * INPUT / SCENES
 * =======================================================*/
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
    const maxE = Math.max(1, Number(p.energyMax || 50));
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
  missionPvp(n = 3) {
    const s = store.get();
    const m = s.missions || {};
    store.set({ missions: { ...m, pvpPlayed: Number(n || 0) } });
  },
  missionEnergy(n = 1) {
    const s = store.get();
    const m = s.missions || {};
    store.set({ missions: { ...m, energyRefillUsed: Number(n || 0) } });
  },
  telegramJoined(v = true) {
    const s = store.get();
    const m = s.missions || {};
    store.set({ missions: { ...m, telegramJoined: !!v } });
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

const PvpScene = window.PvpScene;

/* =========================================================
 * SCENES REGISTER
 * =======================================================*/
scenes.register("boot", new BootScene({ assets, i18n, scenes }));
scenes.register("intro", new IntroScene({ store, input, scenes, assets }));
scenes.register("home", new HomeScene({ store, input, i18n, assets, scenes }));
scenes.register("missions", new MissionsScene({ store, input, assets, scenes }));
scenes.register("trade", new TradeScene({ store, input, i18n, assets, scenes }));

scenes.register("profile", new ProfileScene({ store, input, scenes, assets }));
scenes.register("coffeeshop", new CoffeeShopScene({ store, input, i18n, assets, scenes }));
scenes.register("nightclub", new NightclubScene({ store, input, i18n, assets, scenes }));
scenes.register("weapons", new WeaponsScene({ store, input, assets, scenes }));
scenes.register("xxx", new StarsScene({ store, input, i18n, assets, scenes }));

if (typeof PvpScene === "function") {
  scenes.register("pvp", new PvpScene({ store, input, scenes, assets }));
}

scenes.register("clanhub", new ClanHubScene({ store, scenes }));
scenes.register("clan", new ClanScene({ store, input, i18n, assets, scenes }));
scenes.register("clan_create", new ClanCreateScene({ store, input, i18n, assets, scenes }));

/* =========================================================
 * ENGINE
 * =======================================================*/
const engine = new Engine({ canvas, ctx, input, scenes });

/* =========================================================
 * KEEP SAFE AREA UPDATED
 * =======================================================*/
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

/* =========================================================
 * MISSION TRACKING EVENTS
 * =======================================================*/
function incrementMissionField(field, amount = 1) {
  const s = store.get();
  const m = s.missions || {};
  store.set({
    missions: {
      ...m,
      [field]: Number(m[field] || 0) + Number(amount || 0),
    },
  });
}

window.addEventListener("tc:pvp:win", () => incrementMissionField("pvpPlayed", 1));
window.addEventListener("tc:pvp:lose", () => incrementMissionField("pvpPlayed", 1));

window.addEventListener("tc:mission:energyBought", (ev) => {
  const amount = Number(ev?.detail?.amount || 0);
  if (amount > 0) incrementMissionField("energyRefillUsed", 1);
});

window.addEventListener("tc:mission:referral", (ev) => {
  const amount = Number(ev?.detail?.amount || 1);
  incrementMissionField("referrals", amount);
});

window.addEventListener("tc:openProfile", () => {
  scenes.go("profile");
});

/* =========================================================
 * UI
 * =======================================================*/
startHud(store);
startChat(store);
startBotEngine(store);
startMenu(store);
startStarsOverlay?.(store);
startWeaponsDealer?.({ store, scenes, assets, input });
startPvpLobby();

normalizeGlobalUi(store);

/* =========================================================
 * START
 * =======================================================*/
scenes.go("boot");
engine.start();
