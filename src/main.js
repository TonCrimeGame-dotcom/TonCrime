import { Engine } from "./engine/Engine.js";
import { Store } from "./engine/Store.js";
import { SceneManager } from "./engine/SceneManager.js";
import { Input } from "./engine/Input.js";
import { Assets } from "./engine/Assets.js";
import { I18n } from "./engine/I18n.js";
import { supabase } from "./supabase.js";

import { StarsScene } from "./scenes/StarsScene.js";
import { WeaponsScene } from "./scenes/WeaponsDealerScene.js";
import * as BootSceneModule from "./scenes/BootScene.js";
import { IntroScene } from "./scenes/IntroScene.js";
import { HomeScene } from "./scenes/HomeScene.js";
import { MissionsScene as MissionsScreen } from "./scenes/MissionsScene.js?v=20260331-2";
import { ProfileScene } from "./scenes/ProfileScene.js";
import { CoffeeShopScene } from "./scenes/CoffeeShopScene.js";
import { NightclubScene } from "./scenes/NightclubScene.js";
import { TradeScene } from "./scenes/TradeScene.js";

import { ClanSystem } from "./clan/ClanSystem.js";
import { ClanScene } from "./scenes/ClanScene.js";
import { ClanCreateScene } from "./scenes/ClanCreateScene.js";

import { startStarsOverlay } from "./ui/StarsOverlay.js";
import { startHud } from "./ui/Hud.js";
import { startChat } from "./ui/Chat.js";
import { startActivityTicker } from "./ui/ActivityTicker.js";
import { startMenu } from "./ui/Menu.js";
import { startPvpLobby } from "./ui/PvpLobby.js";
import { startWeaponsDealer } from "./ui/WeaponsDealer.js";

const BootScene = BootSceneModule.BootScene || BootSceneModule.default;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const STARTING_YTON = 100;
const STARTING_LEVEL = 0;
const STARTING_XP = 0;
const STARTING_XP_TO_NEXT = 0;
const DEFAULT_XP_TO_NEXT = 100;
const MAX_PLAYER_ENERGY = 100;

let _viewportLockHeight = 0;
let _viewportLockWidth = 0;
let _viewportOrientation = "";
let _telegramViewportBound = false;

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readPlayerLevel(value, fallback = STARTING_LEVEL) {
  return Math.max(0, Math.floor(toFiniteNumber(value, fallback)));
}

function readPlayerXpToNext(player = null) {
  const level = readPlayerLevel(player?.level, STARTING_LEVEL);
  const xp = Math.max(0, toFiniteNumber(player?.xp, STARTING_XP));
  const xpToNext = toFiniteNumber(player?.xpToNext, STARTING_XP_TO_NEXT);
  if (level === STARTING_LEVEL && xp <= 0 && xpToNext <= 0) {
    return STARTING_XP_TO_NEXT;
  }
  return Math.max(1, xpToNext || DEFAULT_XP_TO_NEXT);
}

function getViewportSize() {
  return {
    w: Math.max(1, Math.floor(_viewportLockWidth || window.innerWidth || 1)),
    h: Math.max(1, Math.floor(_viewportLockHeight || window.innerHeight || 1)),
  };
}

function syncTelegramViewportLock() {
  const tg = window.Telegram?.WebApp;
  const orientation =
    (window.innerWidth || 0) > (window.innerHeight || 0) ? "landscape" : "portrait";

  if (orientation !== _viewportOrientation) {
    _viewportOrientation = orientation;
    _viewportLockHeight = 0;
    _viewportLockWidth = 0;
  }

  const nextHeight = Math.max(
    0,
    toFiniteNumber(tg?.viewportStableHeight, 0),
    toFiniteNumber(tg?.viewportHeight, 0),
    toFiniteNumber(window.visualViewport?.height, 0),
    toFiniteNumber(window.innerHeight, 0)
  );
  const nextWidth = Math.max(
    0,
    toFiniteNumber(window.visualViewport?.width, 0),
    toFiniteNumber(window.innerWidth, 0)
  );

  _viewportLockHeight = Math.max(_viewportLockHeight || 0, nextHeight || 0);
  _viewportLockWidth = Math.max(_viewportLockWidth || 0, nextWidth || 0);

  const { w, h } = getViewportSize();
  document.documentElement.style.setProperty("--tc-app-width", `${w}px`);
  document.documentElement.style.setProperty("--tc-app-height", `${h}px`);
}

function initTelegramViewport() {
  try {
    const tg = window.Telegram?.WebApp;
    if (!tg) {
      syncTelegramViewportLock();
      return;
    }

    tg.ready();
    tg.expand();

    if (typeof tg.disableVerticalSwipes === "function") {
      tg.disableVerticalSwipes();
    }

    if (typeof tg.requestFullscreen === "function") {
      Promise.resolve(tg.requestFullscreen()).catch(() => null);
    }

    syncTelegramViewportLock();

    if (!_telegramViewportBound && typeof tg.onEvent === "function") {
      _telegramViewportBound = true;
      tg.onEvent("viewportChanged", syncTelegramViewportLock);
      tg.onEvent("fullscreenChanged", syncTelegramViewportLock);
      tg.onEvent("fullscreenFailed", syncTelegramViewportLock);
    }
  } catch (_) {
    syncTelegramViewportLock();
  }
}

function getSafeArea() {
  const safe = document.getElementById("safe");
  const { w: vw, h: vh } = getViewportSize();

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
  const { w: cssW, h: cssH } = getViewportSize();

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

initTelegramViewport();
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
  coins: STARTING_YTON,
  yton: STARTING_YTON,
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
    level: STARTING_LEVEL,
    xp: STARTING_XP,
    xpToNext: STARTING_XP_TO_NEXT,
    weaponName: "Silah Yok",
    weaponBonus: "+0%",
    energy: MAX_PLAYER_ENERGY,
    energyMax: MAX_PLAYER_ENERGY,
    energyIntervalMs: 5 * 60 * 1000,
    lastEnergyAt: Date.now(),
  },

  stars: {
    owned: {},
    selectedId: null,
    lastClaimTs: {},
    twinBonusClaimed: {},
    diseaseUntil: 0,
    lastDiseaseAt: 0,
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

function buildStarterStatePatch(source = store.get()) {
  const snapshot = source || {};
  const player = snapshot.player || {};
  const wallet = snapshot.wallet || {};
  const telegramId = String(player.telegramId || getTelegramUser()?.id || "").trim();
  const username =
    String(
      player.username ||
      getTelegramUser()?.username ||
      [getTelegramUser()?.first_name, getTelegramUser()?.last_name].filter(Boolean).join(" ") ||
      ""
    ).trim();

  return {
    coins: STARTING_YTON,
    yton: STARTING_YTON,
    wallet: {
      ...wallet,
      yton: STARTING_YTON,
    },
    player: {
      ...player,
      telegramId,
      username,
      age: null,
      level: STARTING_LEVEL,
      xp: STARTING_XP,
      xpToNext: STARTING_XP_TO_NEXT,
      weaponName: "Silah Yok",
      weaponBonus: "+0%",
      energy: MAX_PLAYER_ENERGY,
      energyMax: MAX_PLAYER_ENERGY,
      energyIntervalMs: 5 * 60 * 1000,
      lastEnergyAt: Date.now(),
    },
  };
}

function ensureStarterProfileState() {
  const snapshot = store.get();
  if (snapshot?.intro?.profileCompleted) return;
  store.set(buildStarterStatePatch(snapshot));
}

ensureStarterProfileState();
normalizeGlobalUi(store);

window.addEventListener("resize", () => {
  syncTelegramViewportLock();
  fitCanvas();
  normalizeGlobalUi(store);
});
window.addEventListener("orientationchange", () => {
  syncTelegramViewportLock();
  fitCanvas();
  normalizeGlobalUi(store);
});
window.visualViewport?.addEventListener?.("resize", () => {
  syncTelegramViewportLock();
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

/* ===== SUPABASE PROFILE SYNC ===== */
let _lastProfileSyncAt = 0;
let _profileSyncBusy = false;
let _lastProfilePayload = "";
let _profileSyncEnabled = true;
let _profileSyncRetryAfter = 0;
let _profileBootstrapPromise = null;

function getProfileIdentityKey() {
  return String(
    store.get()?.player?.telegramId ||
    getTelegramUser()?.id ||
    window.tcGetProfileKey?.(store) ||
    ""
  ).trim();
}

function getBackendCandidates() {
  const raw = [
    window.TONCRIME_BACKEND_URL,
    window.__TONCRIME_BACKEND_URL__,
    localStorage.getItem("toncrime_backend_url"),
    localStorage.getItem("backendUrl"),
    "https://toncrime.onrender.com",
  ];

  const out = [];
  for (const item of raw) {
    const value = String(item || "").trim().replace(/\/$/, "");
    if (!value || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

async function fetchBackendJson(path, options = {}) {
  let lastErr = null;

  for (const base of getBackendCandidates()) {
    const url = `${base}${path}`;

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        lastErr = new Error(json?.error || `HTTP ${res.status}`);
        continue;
      }

      return json;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("backend unavailable");
}

function buildProfilePayload() {
  const s = store.get();
  const p = s.player || {};
  const telegramId = getProfileIdentityKey();

  if (!telegramId || !s?.intro?.profileCompleted) return null;

  return {
    telegram_id: telegramId,
    username: String(p.username || "Player").trim() || "Player",
    age: p.age ?? null,
    level: readPlayerLevel(p.level, STARTING_LEVEL),
    coins: Math.max(0, toFiniteNumber(s.coins, STARTING_YTON)),
    energy: Math.max(0, Math.min(MAX_PLAYER_ENERGY, toFiniteNumber(p.energy, MAX_PLAYER_ENERGY))),
    energy_max: Math.max(1, Math.min(MAX_PLAYER_ENERGY, toFiniteNumber(p.energyMax, MAX_PLAYER_ENERGY))),
    updated_at: new Date().toISOString(),
  };
}

function applyRemoteProfile(profile) {
  if (!profile || typeof profile !== "object") return false;

  const snapshot = store.get();
  const intro = snapshot.intro || {};
  const player = snapshot.player || {};
  const wallet = snapshot.wallet || {};
  const username = String(
    profile.username ||
    player.username ||
    getTelegramUser()?.username ||
    [getTelegramUser()?.first_name, getTelegramUser()?.last_name].filter(Boolean).join(" ") ||
    "Player"
  ).trim() || "Player";
  const level = readPlayerLevel(profile.level, player.level);
  const energyMax = Math.max(
    1,
    Math.min(MAX_PLAYER_ENERGY, toFiniteNumber(profile.energy_max, player.energyMax || MAX_PLAYER_ENERGY))
  );
  const energy = Math.max(
    0,
    Math.min(energyMax, toFiniteNumber(profile.energy, energyMax))
  );
  const coins = Math.max(0, toFiniteNumber(profile.coins, snapshot.coins || STARTING_YTON));
  const xp = level === STARTING_LEVEL ? STARTING_XP : Math.max(0, toFiniteNumber(player.xp, STARTING_XP));
  const xpToNext =
    level === STARTING_LEVEL && xp <= 0
      ? STARTING_XP_TO_NEXT
      : Math.max(1, toFiniteNumber(player.xpToNext, DEFAULT_XP_TO_NEXT));

  store.set({
    coins,
    yton: coins,
    wallet: {
      ...wallet,
      yton: coins,
    },
    intro: {
      ...intro,
      splashSeen: true,
      ageVerified: profile.age != null ? true : !!intro.ageVerified,
      profileCompleted: profile.age != null ? !!username : !!intro.profileCompleted,
    },
    player: {
      ...player,
      telegramId: String(profile.telegram_id || player.telegramId || getProfileIdentityKey()).trim(),
      username,
      age: profile.age ?? player.age ?? null,
      level,
      xp,
      xpToNext,
      energy,
      energyMax,
      lastEnergyAt: Date.now(),
    },
  });

  return true;
}

async function fetchProfileFromSupabase(identityKey) {
  if (!_profileSyncEnabled || !identityKey) return null;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("telegram_id", identityKey)
      .maybeSingle();

    if (error) {
      if (isSupabaseProfileSyncBlocked(error)) {
        _profileSyncEnabled = false;
      }
      throw error;
    }

    return data || null;
  } catch (err) {
    console.warn("Supabase profile fetch failed:", err);
    return null;
  }
}

async function fetchProfileFromBackend(identityKey) {
  if (!identityKey) return null;
  try {
    const json = await fetchBackendJson(
      `/public/profile?identity_key=${encodeURIComponent(identityKey)}`
    );
    return json?.item || null;
  } catch (err) {
    console.warn("Backend profile fetch failed:", err);
    return null;
  }
}

async function restoreProfileFromCloud(identityKey = getProfileIdentityKey()) {
  if (!identityKey) return false;

  const backendProfile = await fetchProfileFromBackend(identityKey);
  if (applyRemoteProfile(backendProfile)) return true;

  const supabaseProfile = await fetchProfileFromSupabase(identityKey);
  if (applyRemoteProfile(supabaseProfile)) return true;

  return false;
}

function isSupabaseProfileSyncBlocked(error) {
  const code = String(error?.code || "").trim();
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42501" ||
    status === 401 ||
    status === 403 ||
    message.includes("row-level security")
  );
}

async function syncProfileToSupabase(payload) {
  if (!_profileSyncEnabled) return false;

  try {
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "telegram_id" });

    if (error) {
      if (isSupabaseProfileSyncBlocked(error)) {
        _profileSyncEnabled = false;
        console.warn("Supabase profile sync disabled:", error);
      } else {
        console.error("Supabase profile sync error:", error);
      }
      return false;
    }

    return true;
  } catch (err) {
    console.error("Supabase profile sync fatal:", err);
    return false;
  }
}

async function syncProfileToBackend(payload) {
  try {
    const json = await fetchBackendJson("/public/profile-sync", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return !!json?.item;
  } catch (err) {
    console.error("Backend profile sync failed:", err);
    return false;
  }
}

async function syncProfileToCloud(force = false) {
  if (_profileSyncBusy) return;
  if (_profileSyncRetryAfter && Date.now() < _profileSyncRetryAfter) return;

  const payload = buildProfilePayload();
  if (!payload) return;
  const payloadKey = JSON.stringify(payload);
  if (!force && payloadKey === _lastProfilePayload) return;

  _profileSyncBusy = true;

  try {
    let synced = await syncProfileToSupabase(payload);
    if (!synced) {
      synced = await syncProfileToBackend(payload);
    }

    if (!synced) {
      _profileSyncRetryAfter = Date.now() + 30000;
      return;
    }

    _lastProfilePayload = payloadKey;
    _lastProfileSyncAt = Date.now();
    _profileSyncRetryAfter = 0;
  } finally {
    _profileSyncBusy = false;
  }
}

async function bootstrapPlayerProfile() {
  if (_profileBootstrapPromise) return _profileBootstrapPromise;

  _profileBootstrapPromise = (async () => {
    ensureStarterProfileState();

    if (typeof window.tcEnsureAuthSession === "function") {
      await window.tcEnsureAuthSession().catch(() => null);
    }

    const identityKey = getProfileIdentityKey();
    if (identityKey && typeof window.tcBindProfileToCurrentAuth === "function") {
      await window.tcBindProfileToCurrentAuth(identityKey).catch(() => null);
    }

    const restored = await restoreProfileFromCloud(identityKey);
    if (!restored) {
      ensureStarterProfileState();
    }

    await syncProfileToCloud(true).catch(() => null);
  })();

  return _profileBootstrapPromise;
}

const profileBootstrapReady = bootstrapPlayerProfile();
window.tcProfileBootstrapReady = profileBootstrapReady;

window.addEventListener("tc:profile-sync-now", () => {
  _lastProfileSyncAt = 0;
  syncProfileToCloud(true).catch(() => null);
});

(function profileSyncLoop() {
  const now = Date.now();
  if (now - _lastProfileSyncAt > 1500) {
    syncProfileToCloud();
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
  const maxE = Math.max(1, Math.min(MAX_PLAYER_ENERGY, Number(p.energyMax || MAX_PLAYER_ENERGY)));
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
  tr: {
    loading: "Yükleniyor...",
    "hud.wallet": "Cüzdan",
    "hud.openProfile": "Profili Aç",
    "hud.language": "Dil",
    "lang.current": "TR",
    "lang.switchTo": "English",
    "home.missions": "Görevler",
    "home.pvp": "PvP",
    "home.clan": "Clan",
    "home.weapons": "Silah Kaçakçısı",
    "home.blackmarket": "Black Market",
    "home.nightclub": "Gece Kulübü",
    "home.coffeeshop": "Coffeeshop",
    "home.xxx": "Genel Ev",
  },
  en: {
    loading: "Loading...",
    "hud.wallet": "Wallet",
    "hud.openProfile": "Open profile",
    "hud.language": "Language",
    "lang.current": "EN",
    "lang.switchTo": "Türkçe",
    "home.missions": "Missions",
    "home.pvp": "PvP",
    "home.clan": "Clan",
    "home.weapons": "Arms Dealer",
    "home.blackmarket": "Black Market",
    "home.nightclub": "Nightclub",
    "home.coffeeshop": "Coffeeshop",
    "home.xxx": "Brothel",
  },
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
class LegacyMissionsScene {
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
    const maxE = Math.max(1, Math.min(MAX_PLAYER_ENERGY, Number(p.energyMax || MAX_PLAYER_ENERGY)));
    const next = Math.min(maxE, Number(p.energy || 0) + Number(n || 0));
    this.store.set({ player: { ...p, energy: next } });
  }

  _grantXP(n) {
    const s = this.store.get();
    const p = s.player || {};
    let xp = Number(p.xp || 0) + Number(n || 0);
    let level = readPlayerLevel(p.level, STARTING_LEVEL);
    let xpToNext = readPlayerXpToNext(p);
    if (xpToNext <= 0) xpToNext = DEFAULT_XP_TO_NEXT;

    while (xpToNext > 0 && xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      xpToNext = DEFAULT_XP_TO_NEXT;
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

    if (type === "level" && readPlayerLevel(p.level, STARTING_LEVEL) >= 55 && m.levelClaimedAt !== 55) {
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
        title: `Level Görevi (Seviye ${readPlayerLevel(p.level, STARTING_LEVEL)}/55)`,
        desc: "55 level ve üstü ödül açılır.",
        reward: m.levelClaimedAt === 55 ? "Alındı" : "Ödül: +50 coin +25 XP",
        leftBtn: { text: "Seviye Bilgisi", action: "", disabled: true },
        rightBtn: {
          text: m.levelClaimedAt === 55 ? "Alındı" : "Ödülü Al",
          action: "claim:level",
          disabled: m.levelClaimedAt === 55 || readPlayerLevel(p.level, STARTING_LEVEL) < 55,
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
    const maxE = Math.max(1, Math.min(MAX_PLAYER_ENERGY, Number(p.energyMax || MAX_PLAYER_ENERGY)));
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
scenes.register("boot", new BootScene({ assets, i18n, scenes, readyPromise: profileBootstrapReady }));
scenes.register("intro", new IntroScene({ store, input, scenes, assets }));
scenes.register("home", new HomeScene({ store, input, i18n, assets, scenes }));
scenes.register("profile", new ProfileScene({ store, input, scenes, assets }));
scenes.register("missions", new MissionsScreen({ store, input, i18n, assets, scenes }));
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
  new WeaponsScene({ store, input, i18n, assets, scenes })
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
  scenes.register("pvp", new MissionsScreen({ store, input, i18n, assets, scenes }));
}

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
startHud(store, i18n);
startChat(store);
startActivityTicker(store);
startMenu(store);
startStarsOverlay?.(store);
startWeaponsDealer?.({ store, scenes, assets, input });
startPvpLobby();

normalizeGlobalUi(store);

/* ===== START ===== */
scenes.go("boot");
engine.start();
