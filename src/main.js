import { Engine } from "./engine/Engine.js";
import { Store } from "./engine/Store.js";
import { SceneManager } from "./engine/SceneManager.js";
import { Input } from "./engine/Input.js";
import { Assets } from "./engine/Assets.js";
import { I18n } from "./engine/I18n.js";
import { clearLocalProfileMemory, fetchBackendJson, forgetCurrentProfile, getBackendCandidates } from "./supabase.js";

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
const APP_TIMEZONE = "Europe/Istanbul";
const DESKTOP_SHELL_MIN_VIEWPORT = 900;
const DESKTOP_SHELL_MAX_WIDTH = 560;
const DESKTOP_SHELL_MAX_HEIGHT = 980;
const DESKTOP_SHELL_ASPECT = 9 / 16;
const SINGLE_SESSION_DEVICE_KEY = "toncrime_device_instance_id_v1";
const SINGLE_SESSION_HEARTBEAT_MS = 15_000;
const SINGLE_SESSION_OVERLAY_ID = "tc-single-session-lock";

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

function readPvpCount(value, fallback = 0) {
  return Math.max(0, Math.floor(toFiniteNumber(value, fallback)));
}

function readPvpRating(value, fallback = 1000) {
  return Math.max(0, Math.floor(toFiniteNumber(value, fallback)));
}

function readTimestampMs(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (!value) return Math.max(0, toFiniteNumber(fallback, 0));
  const parsed = new Date(value).getTime();
  if (Number.isFinite(parsed)) return Math.max(0, parsed);
  return Math.max(0, toFiniteNumber(fallback, 0));
}

function toIsoTimestamp(value) {
  const ts = readTimestampMs(value, 0);
  return ts > 0 ? new Date(ts).toISOString() : null;
}

function getLeaderboardEntryId(entry, fallback = "") {
  return String(entry?.id || entry?.telegram_id || entry?.telegramId || fallback || "").trim();
}

function normalizeLeaderboardEntry(entry, index = 0) {
  const wins = readPvpCount(entry?.wins, entry?.pvp_wins);
  const losses = readPvpCount(entry?.losses, entry?.pvp_losses);
  const rating = readPvpRating(entry?.rating, entry?.pvp_rating);
  const score = Math.max(0, Math.floor(toFiniteNumber(entry?.score, rating + wins * 8)));
  const updatedAt = toIsoTimestamp(entry?.updatedAt || entry?.pvp_last_match_at || entry?.updated_at || entry?.created_at) || new Date(0).toISOString();

  return {
    id: getLeaderboardEntryId(entry, `rank_${index + 1}`) || `rank_${index + 1}`,
    telegram_id: String(entry?.telegram_id || entry?.telegramId || "").trim(),
    name: String(entry?.name || entry?.username || "Player").trim() || "Player",
    wins,
    losses,
    rating,
    score,
    updatedAt,
    rank: Math.max(1, Math.floor(toFiniteNumber(entry?.rank, index + 1))),
  };
}

function buildLeaderboardKey(items = []) {
  return items
    .map((item) => {
      const normalized = normalizeLeaderboardEntry(item);
      return [
        normalized.id,
        normalized.rating,
        normalized.wins,
        normalized.losses,
        normalized.updatedAt,
      ].join(":");
    })
    .join("|");
}

function getViewportSize() {
  return {
    w: Math.max(1, Math.floor(_viewportLockWidth || window.innerWidth || 1)),
    h: Math.max(1, Math.floor(_viewportLockHeight || window.innerHeight || 1)),
  };
}

function isDesktopTelegramShell(viewportW = window.innerWidth || 0, viewportH = window.innerHeight || 0) {
  const tg = window.Telegram?.WebApp;
  if (!tg) return false;

  const ua = String(window.navigator?.userAgent || "");
  const coarsePointer = !!window.matchMedia?.("(pointer: coarse)")?.matches;
  const mobileUa = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(ua);
  const longSide = Math.max(Number(viewportW || 0), Number(viewportH || 0));

  return !coarsePointer && !mobileUa && longSide >= DESKTOP_SHELL_MIN_VIEWPORT;
}

function getDesktopTelegramShellFrame(viewportW, viewportH) {
  const safeViewportW = Math.max(360, Math.floor(viewportW || window.innerWidth || 360));
  const safeViewportH = Math.max(520, Math.floor(viewportH || window.innerHeight || 520));
  const margin = Math.max(16, Math.min(36, Math.round(Math.min(safeViewportW, safeViewportH) * 0.03)));
  const maxWidth = Math.max(360, Math.min(DESKTOP_SHELL_MAX_WIDTH, safeViewportW - margin * 2));
  const maxHeight = Math.max(520, Math.min(DESKTOP_SHELL_MAX_HEIGHT, safeViewportH - margin * 2));

  let width = maxWidth;
  let height = Math.round(width / DESKTOP_SHELL_ASPECT);

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * DESKTOP_SHELL_ASPECT);
  }

  const left = Math.max(0, Math.floor((safeViewportW - width) / 2));
  const top = Math.max(0, Math.floor((safeViewportH - height) / 2));

  return {
    width,
    height,
    left,
    top,
    right: Math.max(0, safeViewportW - left - width),
    bottom: Math.max(0, safeViewportH - top - height),
  };
}

function applyViewportFrame(frame, desktopShell = false) {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--tc-app-width", `${Math.max(1, Math.floor(frame.width || 1))}px`);
  rootStyle.setProperty("--tc-app-height", `${Math.max(1, Math.floor(frame.height || 1))}px`);
  rootStyle.setProperty("--tc-app-left", `${Math.max(0, Math.floor(frame.left || 0))}px`);
  rootStyle.setProperty("--tc-app-top", `${Math.max(0, Math.floor(frame.top || 0))}px`);
  rootStyle.setProperty("--tc-app-radius", desktopShell ? "26px" : "0px");
  rootStyle.setProperty(
    "--tc-app-shadow",
    desktopShell ? "0 24px 70px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.08)" : "none"
  );

  if (desktopShell) {
    rootStyle.setProperty("--sal", `${Math.max(0, Math.floor(frame.left || 0))}px`);
    rootStyle.setProperty("--sat", `${Math.max(0, Math.floor(frame.top || 0))}px`);
    rootStyle.setProperty("--sar", `${Math.max(0, Math.floor(frame.right || 0))}px`);
    rootStyle.setProperty("--sab", `${Math.max(0, Math.floor(frame.bottom || 0))}px`);
  } else {
    rootStyle.removeProperty("--sal");
    rootStyle.removeProperty("--sat");
    rootStyle.removeProperty("--sar");
    rootStyle.removeProperty("--sab");
  }
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

  if (isDesktopTelegramShell(nextWidth, nextHeight)) {
    const frame = getDesktopTelegramShellFrame(nextWidth, nextHeight);
    _viewportLockHeight = frame.height;
    _viewportLockWidth = frame.width;
    applyViewportFrame(frame, true);
    return;
  }

  _viewportLockHeight = Math.max(_viewportLockHeight || 0, nextHeight || 0);
  _viewportLockWidth = Math.max(_viewportLockWidth || 0, nextWidth || 0);

  const { w, h } = getViewportSize();
  applyViewportFrame({ width: w, height: h, left: 0, top: 0, right: 0, bottom: 0 }, false);
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

    if (isDesktopTelegramShell(window.innerWidth || 0, window.innerHeight || 0)) {
      if (typeof tg.exitFullscreen === "function") {
        Promise.resolve(tg.exitFullscreen()).catch(() => null);
      }
    } else if (typeof tg.requestFullscreen === "function") {
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
  const canvasRect = canvas?.getBoundingClientRect?.() || {
    left: 0,
    top: 0,
    right: vw,
    bottom: vh,
    width: vw,
    height: vh,
  };
  const canvasW = Math.max(0, Math.round(canvasRect.width || vw));
  const canvasH = Math.max(0, Math.round(canvasRect.height || vh));

  if (!safe) {
    return { x: 0, y: 0, w: canvasW, h: canvasH };
  }

  const r = safe.getBoundingClientRect();
  const leftInset = Math.max(0, Math.round((r.left || 0) - (canvasRect.left || 0)));
  const topInset = Math.max(0, Math.round((r.top || 0) - (canvasRect.top || 0)));
  const rightInset = Math.max(0, Math.round((canvasRect.right || canvasW) - (r.right || 0)));
  const bottomInset = Math.max(0, Math.round((canvasRect.bottom || canvasH) - (r.bottom || 0)));

  return {
    x: Math.min(canvasW, leftInset),
    y: Math.min(canvasH, topInset),
    w: Math.max(0, canvasW - leftInset - rightInset),
    h: Math.max(0, canvasH - topInset - bottomInset),
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
    canvas.style.left = "var(--tc-app-left, 0px)";
    canvas.style.top = "var(--tc-app-top, 0px)";
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
    tutorialSeen: false,
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
    lastEnergyResetKey: dayKey(),
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

  dailyLogin: {
    lastClaimKey: "",
    streak: 0,
    pending: false,
    pendingKey: "",
    pendingReward: 0,
    pendingStreak: 0,
  },

  pvp: {
    wins: 0,
    losses: 0,
    rating: 1000,
    currentOpponent: null,
    recentMatches: [],
    leaderboard: [],
    lastMatchAt: 0,
    leaderboardUpdatedAt: 0,
    leaderboardSource: "local",
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
      dailyLogin: { ...defaultState.dailyLogin, ...(loaded.dailyLogin || {}) },
      pvp: { ...defaultState.pvp, ...(loaded.pvp || {}) },
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
  const pvp = snapshot.pvp || {};
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
      lastEnergyResetKey: dayKey(),
    },
    pvp: {
      ...pvp,
      wins: 0,
      losses: 0,
      rating: 1000,
      currentOpponent: null,
      recentMatches: [],
      leaderboard: [],
      lastMatchAt: 0,
      leaderboardUpdatedAt: 0,
      leaderboardSource: "local",
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

function dayKey(value = Date.now()) {
  try {
    const targetDate = value instanceof Date ? value : new Date(value);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(targetDate);

    const year = parts.find((part) => part.type === "year")?.value || "0000";
    const month = parts.find((part) => part.type === "month")?.value || "00";
    const day = parts.find((part) => part.type === "day")?.value || "00";
    return `${year}-${month}-${day}`;
  } catch {
    const d = value instanceof Date ? value : new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }
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

function ensureDailyEnergyReset() {
  const s = store.get();
  const p = s.player || {};
  const today = dayKey();
  if (String(p.lastEnergyResetKey || "") === today) return;

  const energyMax = Math.max(
    1,
    Math.min(MAX_PLAYER_ENERGY, Number(p.energyMax || MAX_PLAYER_ENERGY))
  );

  store.set({
    player: {
      ...p,
      energy: energyMax,
      energyMax,
      lastEnergyAt: Date.now(),
      lastEnergyResetKey: today,
    },
  });
}
ensureDailyEnergyReset();

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

function safeLocalRead(key) {
  try {
    return String(localStorage.getItem(key) || "");
  } catch {
    return "";
  }
}

function safeLocalWrite(key, value) {
  try {
    localStorage.setItem(key, String(value ?? ""));
  } catch {}
}

function makeRuntimeToken(prefix = "id") {
  try {
    const buf = new Uint8Array(12);
    crypto.getRandomValues(buf);
    const token = [...buf].map((part) => part.toString(16).padStart(2, "0")).join("");
    return `${prefix}_${token}`;
  } catch {
    return `${prefix}_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
  }
}

function getSingleSessionDeviceId() {
  let value = safeLocalRead(SINGLE_SESSION_DEVICE_KEY).trim();
  if (!value) {
    value = makeRuntimeToken("dev");
    safeLocalWrite(SINGLE_SESSION_DEVICE_KEY, value);
  }
  return value;
}

function detectSingleSessionDeviceLabel() {
  const ua = String(window.navigator?.userAgent || "");
  const desktopShell = isDesktopTelegramShell(window.innerWidth || 0, window.innerHeight || 0);
  if (desktopShell) return "PC Telegram";
  if (/iphone/i.test(ua)) return "iPhone Telegram";
  if (/ipad/i.test(ua)) return "iPad Telegram";
  if (/android/i.test(ua)) return "Android Telegram";
  return "Telegram Device";
}

const _singleSessionState = {
  deviceId: getSingleSessionDeviceId(),
  sessionId: makeRuntimeToken("sess"),
  deviceLabel: detectSingleSessionDeviceLabel(),
  claimed: false,
  locked: false,
  supported: true,
  heartbeatTimer: 0,
  heartbeatBusy: false,
};

function ensureSingleSessionOverlay() {
  let root = document.getElementById(SINGLE_SESSION_OVERLAY_ID);
  if (root) return root;

  root = document.createElement("div");
  root.id = SINGLE_SESSION_OVERLAY_ID;
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = "99999";
  root.style.display = "none";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.padding = "24px";
  root.style.background = "rgba(6, 8, 14, 0.86)";
  root.style.backdropFilter = "blur(8px)";

  const card = document.createElement("div");
  card.style.width = "min(92vw, 420px)";
  card.style.padding = "24px 22px";
  card.style.borderRadius = "24px";
  card.style.border = "1px solid rgba(255,255,255,0.12)";
  card.style.background = "linear-gradient(180deg, rgba(23,26,39,0.96), rgba(14,16,26,0.96))";
  card.style.boxShadow = "0 24px 60px rgba(0,0,0,0.42)";
  card.style.color = "#f7f2e9";
  card.style.fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
  card.style.textAlign = "center";

  const title = document.createElement("div");
  title.textContent = "Oturum Başka Cihazda Açık";
  title.style.fontSize = "22px";
  title.style.fontWeight = "800";
  title.style.letterSpacing = "0.02em";
  title.style.marginBottom = "10px";

  const body = document.createElement("div");
  body.setAttribute("data-role", "message");
  body.textContent = "Bu Telegram hesabı şu anda başka bir cihazda aktif.";
  body.style.fontSize = "15px";
  body.style.lineHeight = "1.5";
  body.style.opacity = "0.92";
  body.style.marginBottom = "18px";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Tekrar Dene";
  button.style.border = "0";
  button.style.borderRadius = "14px";
  button.style.padding = "12px 18px";
  button.style.cursor = "pointer";
  button.style.fontWeight = "700";
  button.style.background = "linear-gradient(180deg, #ffb25a, #ff7b32)";
  button.style.color = "#1a1007";
  button.addEventListener("click", () => {
    claimSingleSession(true).catch(() => null);
  });

  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(button);
  root.appendChild(card);
  document.body.appendChild(root);
  return root;
}

function stopSingleSessionHeartbeat() {
  if (_singleSessionState.heartbeatTimer) {
    clearInterval(_singleSessionState.heartbeatTimer);
    _singleSessionState.heartbeatTimer = 0;
  }
  _singleSessionState.heartbeatBusy = false;
}

function lockSingleSession(message = "Bu Telegram hesabı şu anda başka bir cihazda aktif.") {
  _singleSessionState.locked = true;
  _singleSessionState.claimed = false;
  stopSingleSessionHeartbeat();

  const overlay = ensureSingleSessionOverlay();
  const messageNode = overlay.querySelector('[data-role="message"]');
  if (messageNode) {
    messageNode.textContent = message;
  }
  overlay.style.display = "flex";

  try {
    window.tcEngine?.stop?.();
  } catch {}
}

function unlockSingleSession() {
  _singleSessionState.locked = false;
  const overlay = document.getElementById(SINGLE_SESSION_OVERLAY_ID);
  if (overlay) overlay.style.display = "none";

  if (window.tcEngineStarted) {
    try {
      window.tcEngine?.start?.();
    } catch {}
  }
}

/* ===== CLOUD PROFILE SYNC ===== */
let _lastProfileSyncAt = 0;
let _profileSyncBusy = false;
let _lastProfilePayload = "";
let _profileSyncRetryAfter = 0;
let _profileBootstrapPromise = null;
let _lastLeaderboardSyncAt = 0;
let _leaderboardSyncBusy = false;
let _leaderboardSyncRetryAfter = 0;
let _lastLeaderboardPayload = "";

function getProfileIdentityKey() {
  return String(
    store.get()?.player?.telegramId ||
    getTelegramUser()?.id ||
    window.tcGetProfileKey?.(store) ||
    ""
  ).trim();
}

function buildSingleSessionPayload() {
  const identityKey = getProfileIdentityKey();
  if (!identityKey) return null;

  const player = store.get()?.player || {};
  return {
    identity_key: identityKey,
    telegram_id: identityKey,
    username: String(
      player.username ||
      getTelegramUser()?.username ||
      [getTelegramUser()?.first_name, getTelegramUser()?.last_name].filter(Boolean).join(" ") ||
      "Player"
    ).trim() || "Player",
    device_id: _singleSessionState.deviceId,
    session_id: _singleSessionState.sessionId,
    device_label: _singleSessionState.deviceLabel,
    tg_init_data: String(window.Telegram?.WebApp?.initData || "").trim(),
  };
}

async function releaseSingleSession(useBeacon = false) {
  const payload = buildSingleSessionPayload();
  if (!payload || !_singleSessionState.claimed) return;

  stopSingleSessionHeartbeat();
  _singleSessionState.claimed = false;

  if (useBeacon && typeof navigator.sendBeacon === "function") {
    const body = JSON.stringify(payload);
    for (const base of getBackendCandidates()) {
      try {
        const ok = navigator.sendBeacon(
          `${String(base || "").replace(/\/$/, "")}/public/session/release`,
          new Blob([body], { type: "application/json" })
        );
        if (ok) return;
      } catch {}
    }
  }

  try {
    await fetchBackendJson("/public/session/release", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {}
}

function startSingleSessionHeartbeat() {
  stopSingleSessionHeartbeat();
  if (_singleSessionState.locked || !_singleSessionState.claimed || _singleSessionState.supported === false) {
    return;
  }

  _singleSessionState.heartbeatTimer = window.setInterval(async () => {
    if (_singleSessionState.heartbeatBusy || _singleSessionState.locked) return;

    const payload = buildSingleSessionPayload();
    if (!payload) return;

    _singleSessionState.heartbeatBusy = true;
    try {
      const json = await fetchBackendJson("/public/session/heartbeat", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (json?.supported === false) {
        _singleSessionState.supported = false;
        stopSingleSessionHeartbeat();
        return;
      }
    } catch (err) {
      const msg = String(err?.message || "").toLowerCase();
      if (
        msg.includes("session_replaced") ||
        msg.includes("session_active_elsewhere") ||
        msg.includes("session_missing")
      ) {
        lockSingleSession("Bu hesap başka bir cihazda aktif kaldığı için burada oyun durduruldu.");
      }
    } finally {
      _singleSessionState.heartbeatBusy = false;
    }
  }, SINGLE_SESSION_HEARTBEAT_MS);
}

async function claimSingleSession(force = false) {
  const payload = buildSingleSessionPayload();
  if (!payload) return false;
  if (_singleSessionState.claimed && !force && !_singleSessionState.locked) return true;

  try {
    const json = await fetchBackendJson("/public/session/claim", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    _singleSessionState.claimed = true;
    _singleSessionState.supported = json?.supported !== false;
    unlockSingleSession();
    if (_singleSessionState.supported) {
      startSingleSessionHeartbeat();
    }
    return true;
  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("session_active_elsewhere")) {
      lockSingleSession("Bu Telegram hesabı başka bir cihazda açık. Önce oradaki oturumu kapatıp sonra tekrar deneyin.");
      return false;
    }
    console.warn("Single session claim failed:", err);
    return false;
  }
}

function buildProfilePayload() {
  const s = store.get();
  const p = s.player || {};
  const pvp = s.pvp || {};
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
    pvp_wins: readPvpCount(pvp.wins, 0),
    pvp_losses: readPvpCount(pvp.losses, 0),
    pvp_rating: readPvpRating(pvp.rating, 1000),
    pvp_last_match_at: toIsoTimestamp(pvp.lastMatchAt || pvp.last_match_at),
    device_id: _singleSessionState.deviceId,
    session_id: _singleSessionState.sessionId,
    device_label: _singleSessionState.deviceLabel,
    updated_at: new Date().toISOString(),
  };
}

function applyRemoteProfile(profile) {
  if (!profile || typeof profile !== "object") return false;

  const snapshot = store.get();
  const intro = snapshot.intro || {};
  const player = snapshot.player || {};
  const wallet = snapshot.wallet || {};
  const pvp = snapshot.pvp || {};
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
  const wins = readPvpCount(profile.pvp_wins, pvp.wins);
  const losses = readPvpCount(profile.pvp_losses, pvp.losses);
  const rating = readPvpRating(profile.pvp_rating, pvp.rating || 1000);
  const lastMatchAt = readTimestampMs(profile.pvp_last_match_at, pvp.lastMatchAt);

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
    pvp: {
      ...pvp,
      wins,
      losses,
      rating,
      lastMatchAt,
    },
  });

  return true;
}

function buildProfilePayloadKey(payload) {
  if (!payload || typeof payload !== "object") return "";
  const { updated_at, ...stable } = payload;
  return JSON.stringify(stable);
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

async function fetchPvpLeaderboardFromBackend(limit = 50) {
  try {
    const json = await fetchBackendJson(
      `/public/pvp/leaderboard?limit=${Math.max(5, Math.min(100, Math.floor(limit || 50)))}`
    );
    return Array.isArray(json?.items) ? json.items : [];
  } catch (err) {
    console.warn("Backend pvp leaderboard fetch failed:", err);
    return null;
  }
}

function applyRemotePvpLeaderboard(items) {
  if (!Array.isArray(items)) return false;

  const normalized = items
    .map((item, index) => normalizeLeaderboardEntry(item, index))
    .filter((item) => item.id && item.name)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 50)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const nextKey = buildLeaderboardKey(normalized);
  if (!normalized.length && !_lastLeaderboardPayload) {
    return false;
  }

  const snapshot = store.get();
  const pvp = snapshot.pvp || {};
  if (nextKey === _lastLeaderboardPayload && Array.isArray(pvp.leaderboard) && pvp.leaderboard.length === normalized.length) {
    return true;
  }

  store.set({
    pvp: {
      ...pvp,
      leaderboard: normalized,
      leaderboardUpdatedAt: Date.now(),
      leaderboardSource: "cloud",
    },
  });

  _lastLeaderboardPayload = nextKey;
  return true;
}

async function restoreProfileFromCloud(identityKey = getProfileIdentityKey()) {
  if (!identityKey) return false;

  const backendProfile = await fetchProfileFromBackend(identityKey);
  if (applyRemoteProfile(backendProfile)) return true;

  return false;
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
  if (_singleSessionState.locked) return;
  if (_profileSyncBusy) return;
  if (_profileSyncRetryAfter && Date.now() < _profileSyncRetryAfter) return;

  const payload = buildProfilePayload();
  if (!payload) return;
  const payloadKey = buildProfilePayloadKey(payload);
  if (!force && payloadKey === _lastProfilePayload) return;

  _profileSyncBusy = true;

  try {
    const synced = await syncProfileToBackend(payload);

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

async function syncLeaderboardFromCloud(force = false) {
  if (_singleSessionState.locked) return;
  if (_leaderboardSyncBusy) return;
  if (_leaderboardSyncRetryAfter && Date.now() < _leaderboardSyncRetryAfter) return;
  if (!force && Date.now() - _lastLeaderboardSyncAt < 10_000) return;

  _leaderboardSyncBusy = true;

  try {
    const items = await fetchPvpLeaderboardFromBackend(50);
    if (!items) {
      _leaderboardSyncRetryAfter = Date.now() + 20_000;
      return;
    }

    applyRemotePvpLeaderboard(items);
    _lastLeaderboardSyncAt = Date.now();
    _leaderboardSyncRetryAfter = 0;
  } finally {
    _leaderboardSyncBusy = false;
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

    if (identityKey) {
      const claimed = await claimSingleSession().catch(() => false);
      if (!claimed && _singleSessionState.locked) {
        return false;
      }
    }

    const restored = await restoreProfileFromCloud(identityKey);
    if (!restored) {
      ensureStarterProfileState();
    }

    await syncProfileToCloud(true).catch(() => null);
    await syncLeaderboardFromCloud(true).catch(() => null);
  })();

  return _profileBootstrapPromise;
}

const profileBootstrapReady = bootstrapPlayerProfile();
window.tcProfileBootstrapReady = profileBootstrapReady;

window.addEventListener("tc:profile-sync-now", () => {
  _lastProfileSyncAt = 0;
  _lastLeaderboardSyncAt = 0;
  syncProfileToCloud(true).catch(() => null);
  syncLeaderboardFromCloud(true).catch(() => null);
});

window.addEventListener("tc:pvp:leaderboard-sync-now", () => {
  _lastProfileSyncAt = 0;
  _lastLeaderboardSyncAt = 0;
  syncProfileToCloud(true).catch(() => null);
  syncLeaderboardFromCloud(true).catch(() => null);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !_singleSessionState.locked) {
    claimSingleSession().catch(() => null);
  }
});

window.addEventListener("focus", () => {
  if (!_singleSessionState.locked) {
    claimSingleSession().catch(() => null);
  }
});

window.addEventListener("pagehide", () => {
  releaseSingleSession(true).catch(() => null);
});

window.addEventListener("beforeunload", () => {
  releaseSingleSession(true).catch(() => null);
});

(function profileSyncLoop() {
  const now = Date.now();
  if (now - _lastProfileSyncAt > 1500) {
    syncProfileToCloud();
  }
  setTimeout(profileSyncLoop, 1500);
})();

(function leaderboardSyncLoop() {
  syncLeaderboardFromCloud().catch(() => null);
  setTimeout(leaderboardSyncLoop, 5000);
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

/* ===== DAILY ENERGY RESET ===== */
function tickDailyEnergyReset() {
  ensureDailyEnergyReset();
}
setInterval(tickDailyEnergyReset, 60 * 1000);

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
  softReset() {
    clearLocalProfileMemory();
    location.reload();
  },
  reset() {
    return forgetCurrentProfile({ reload: true })
      .then((result) => {
        console.log("Profil tamamen sifirlandi:", result);
        return result;
      })
      .catch((err) => {
        console.error("Profil sifirlama basarisiz:", err);
        throw err;
      });
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
window.tcEngine = engine;
window.tcEngineStarted = false;

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
  const pvp = s.pvp || {};
  store.set({
    missions: {
      ...m,
      pvpPlayed: Number(m.pvpPlayed || 0) + 1,
    },
    pvp: {
      ...pvp,
      lastMatchAt: Date.now(),
    },
  });

  _lastProfileSyncAt = 0;
  _lastLeaderboardSyncAt = 0;
  syncProfileToCloud(true).catch(() => null);
  syncLeaderboardFromCloud(true).catch(() => null);
});

window.addEventListener("tc:pvp:lose", () => {
  const s = store.get();
  const m = s.missions || {};
  const pvp = s.pvp || {};
  store.set({
    missions: {
      ...m,
      pvpPlayed: Number(m.pvpPlayed || 0) + 1,
    },
    pvp: {
      ...pvp,
      lastMatchAt: Date.now(),
    },
  });

  _lastProfileSyncAt = 0;
  _lastLeaderboardSyncAt = 0;
  syncProfileToCloud(true).catch(() => null);
  syncLeaderboardFromCloud(true).catch(() => null);
});

function startProgressionOverlay(storeRef, i18nRef) {
  const ROOT_ID = "tc-progression-overlay";
  let currentSceneKey = "";
  let mode = "";
  let tutorialStep = 0;
  let refs = null;

  function ui(tr, en) {
    const lang = i18nRef?.getLang?.() || storeRef.get()?.lang || "tr";
    return lang === "en" ? en : tr;
  }

  function formatCoins(value) {
    const locale = ui("tr-TR", "en-US");
    return Number(value || 0).toLocaleString(locale);
  }

  function ensureDailyLoginPending() {
    const snapshot = storeRef.get() || {};
    if (!snapshot?.intro?.profileCompleted) return false;

    const daily = snapshot.dailyLogin || {};
    const today = dayKey();
    if (String(daily.lastClaimKey || "") === today || String(daily.pendingKey || "") === today || daily.pending) {
      return false;
    }

    const yesterday = dayKey(Date.now() - 24 * 60 * 60 * 1000);
    const streak = String(daily.lastClaimKey || "") === yesterday
      ? Math.max(1, Number(daily.streak || 0) + 1)
      : 1;
    const reward = Math.min(90, 12 + (streak - 1) * 6);

    storeRef.set({
      dailyLogin: {
        ...daily,
        pending: true,
        pendingKey: today,
        pendingReward: reward,
        pendingStreak: streak,
      },
    });
    return true;
  }

  function getTutorialSteps() {
    return [
      {
        title: ui("Hud ve Profil", "HUD and Profile"),
        body: ui(
          "Ust panelden enerji, seviye, YTON ve aktif silahini takip et. Sol ustteki buton artik Satin Al ekranini acar.",
          "Track energy, level, YTON and your active weapon from the HUD. The top-left button now opens the Buy screen."
        ),
      },
      {
        title: ui("Gorev Merkezi", "Mission Center"),
        body: ui(
          "Gorevlerde reklam, Telegram, PvP ve arkadas daveti akislari vardir. Reklamlar enerji doldurur, davet linki ise gorev ilerlemesini acar.",
          "Missions cover ads, Telegram, PvP and friend invites. Ads refill energy, while your invite link drives referral progress."
        ),
      },
      {
        title: ui("Black Market", "Black Market"),
        body: ui(
          "Kesfet, Envanter, Pazar, Carklar ve Satin Al sekmeleri ayni ekrandadir. Premium uyelik artik Satin Al ekraninda satilir.",
          "Explore, Inventory, Market, Wheels and Buy all live in the same screen. Premium membership is now sold inside the Buy tab."
        ),
      },
      {
        title: ui("PvP Modlari", "PvP Modes"),
        body: ui(
          "Slot Arena, Cage Fight ve diger PvP modlarinda mac sonucu otomatik kaydedilir. Rakip cikarsa hukum galibiyet artik aninda verilir.",
          "Slot Arena, Cage Fight and the other PvP modes now save results automatically. If the opponent leaves, you get the forfeit win immediately."
        ),
      },
      {
        title: ui("Isletmeler ve Pazar", "Businesses and Market"),
        body: ui(
          "Premium uyelikle bir isletme acip gunluk uretim toplayabilir, urunleri envantere cekip pazarda satabilirsin.",
          "With premium membership you can unlock a business, collect daily production, move items into inventory and list them on the market."
        ),
      },
    ];
  }

  function ensureDom() {
    if (refs?.root) return refs;

    if (!document.getElementById(`${ROOT_ID}-style`)) {
      const style = document.createElement("style");
      style.id = `${ROOT_ID}-style`;
      style.textContent = `
        #${ROOT_ID} {
          position: fixed;
          inset: 0;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 7000;
          background: rgba(5, 8, 14, 0.72);
          backdrop-filter: blur(14px);
        }
        #${ROOT_ID}.open { display: flex; }
        #${ROOT_ID} .tc-progress-card {
          width: min(100%, 420px);
          border-radius: 24px;
          padding: 22px 20px 18px;
          border: 1px solid rgba(255,255,255,0.12);
          background: linear-gradient(180deg, rgba(18,24,34,0.94), rgba(8,12,18,0.96));
          box-shadow: 0 24px 70px rgba(0,0,0,0.38);
          color: #fff;
        }
        #${ROOT_ID} .tc-progress-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          font: 800 11px system-ui;
          letter-spacing: 0.5px;
          color: #ffe4a8;
          background: rgba(255,201,110,0.12);
          border: 1px solid rgba(255,201,110,0.24);
        }
        #${ROOT_ID} .tc-progress-title {
          margin-top: 14px;
          font: 900 22px system-ui;
          line-height: 1.15;
        }
        #${ROOT_ID} .tc-progress-body {
          margin-top: 10px;
          color: rgba(255,255,255,0.78);
          font: 500 14px/1.5 system-ui;
        }
        #${ROOT_ID} .tc-progress-highlight {
          margin-top: 16px;
          padding: 14px 16px;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255,214,120,0.14), rgba(96,56,18,0.18));
          border: 1px solid rgba(255,214,120,0.22);
        }
        #${ROOT_ID} .tc-progress-highlight strong {
          display: block;
          font: 900 24px system-ui;
          color: #ffe8b6;
        }
        #${ROOT_ID} .tc-progress-highlight span {
          display: block;
          margin-top: 4px;
          color: rgba(255,255,255,0.72);
          font: 600 12px system-ui;
        }
        #${ROOT_ID} .tc-progress-actions {
          display: flex;
          gap: 10px;
          margin-top: 18px;
        }
        #${ROOT_ID} button {
          flex: 1 1 0;
          height: 42px;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          font: 800 13px system-ui;
        }
        #${ROOT_ID} .tc-progress-secondary {
          color: rgba(255,255,255,0.86);
          background: rgba(255,255,255,0.08);
        }
        #${ROOT_ID} .tc-progress-primary {
          color: #2a1204;
          background: linear-gradient(180deg, rgba(255,234,171,0.98), rgba(255,193,74,0.96));
          box-shadow: 0 10px 24px rgba(255,176,74,0.22);
        }
        #${ROOT_ID} .tc-progress-footer {
          margin-top: 12px;
          color: rgba(255,255,255,0.52);
          font: 600 11px system-ui;
        }
      `;
      document.head.appendChild(style);
    }

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="tc-progress-card" role="dialog" aria-modal="true" aria-live="polite">
        <div class="tc-progress-kicker" id="${ROOT_ID}-kicker"></div>
        <div class="tc-progress-title" id="${ROOT_ID}-title"></div>
        <div class="tc-progress-body" id="${ROOT_ID}-body"></div>
        <div class="tc-progress-highlight" id="${ROOT_ID}-highlight"></div>
        <div class="tc-progress-actions">
          <button class="tc-progress-secondary" id="${ROOT_ID}-secondary" type="button"></button>
          <button class="tc-progress-primary" id="${ROOT_ID}-primary" type="button"></button>
        </div>
        <div class="tc-progress-footer" id="${ROOT_ID}-footer"></div>
      </div>
    `;
    document.body.appendChild(root);

    refs = {
      root,
      kicker: root.querySelector(`#${ROOT_ID}-kicker`),
      title: root.querySelector(`#${ROOT_ID}-title`),
      body: root.querySelector(`#${ROOT_ID}-body`),
      highlight: root.querySelector(`#${ROOT_ID}-highlight`),
      secondary: root.querySelector(`#${ROOT_ID}-secondary`),
      primary: root.querySelector(`#${ROOT_ID}-primary`),
      footer: root.querySelector(`#${ROOT_ID}-footer`),
    };

    refs.secondary.addEventListener("click", () => {
      if (mode === "tutorial") {
        const snapshot = storeRef.get() || {};
        storeRef.set({
          intro: {
            ...(snapshot.intro || {}),
            tutorialSeen: true,
          },
        });
      }
      hide();
      evaluate();
    });

    refs.primary.addEventListener("click", () => {
      if (mode === "daily") {
        const snapshot = storeRef.get() || {};
        const daily = snapshot.dailyLogin || {};
        const reward = Math.max(0, Number(daily.pendingReward || 0));
        const nextCoins = Math.max(0, Number(snapshot.coins ?? snapshot.yton ?? 0) + reward);
        storeRef.set({
          coins: nextCoins,
          yton: nextCoins,
          wallet: {
            ...(snapshot.wallet || {}),
            yton: nextCoins,
          },
          dailyLogin: {
            ...daily,
            lastClaimKey: String(daily.pendingKey || dayKey()),
            streak: Math.max(1, Number(daily.pendingStreak || daily.streak || 1)),
            pending: false,
            pendingKey: "",
            pendingReward: 0,
            pendingStreak: 0,
          },
        });
        hide();
        evaluate();
        return;
      }

      const steps = getTutorialSteps();
      if (tutorialStep >= steps.length - 1) {
        const snapshot = storeRef.get() || {};
        storeRef.set({
          intro: {
            ...(snapshot.intro || {}),
            tutorialSeen: true,
          },
        });
        hide();
        evaluate();
        return;
      }

      tutorialStep += 1;
      render();
    });

    return refs;
  }

  function hide() {
    if (!refs?.root) return;
    refs.root.classList.remove("open");
    mode = "";
  }

  function render() {
    ensureDom();
    const snapshot = storeRef.get() || {};

    if (mode === "daily") {
      const daily = snapshot.dailyLogin || {};
      refs.kicker.textContent = ui("GUNLUK GIRIS", "DAILY LOGIN");
      refs.title.textContent = ui("Gunluk odulun hazir", "Your daily reward is ready");
      refs.body.textContent = ui(
        "Bugun oyuna girdigin icin YTON odulunu al. Ardisik gunlerde giris yaptikca seri bonusu buyur.",
        "Claim your YTON reward for logging in today. Keep coming back daily to grow your streak bonus."
      );
      refs.highlight.innerHTML = `<strong>+${formatCoins(daily.pendingReward || 0)} YTON</strong><span>${ui(`Seri gun ${Math.max(1, Number(daily.pendingStreak || 1))}`, `Streak day ${Math.max(1, Number(daily.pendingStreak || 1))}`)}</span>`;
      refs.secondary.style.display = "none";
      refs.primary.textContent = ui("Odulu Al", "Claim Reward");
      refs.footer.textContent = ui("Odul bir kez gunluk verilir.", "This reward is granted once per day.");
      return;
    }

    const steps = getTutorialSteps();
    const step = steps[Math.max(0, Math.min(tutorialStep, steps.length - 1))];
    refs.kicker.textContent = ui("OYUN REHBERI", "GAME GUIDE");
    refs.title.textContent = step.title;
    refs.body.textContent = step.body;
    refs.highlight.innerHTML = `<strong>${tutorialStep + 1} / ${steps.length}</strong><span>${ui("Temel sistemleri 1 dakikada ogren.", "Learn the core systems in under a minute.")}</span>`;
    refs.secondary.style.display = "";
    refs.secondary.textContent = ui("Gec", "Skip");
    refs.primary.textContent = tutorialStep >= steps.length - 1 ? ui("Basla", "Start") : ui("Sonraki", "Next");
    refs.footer.textContent = ui("Bu rehber ilk acilista otomatik gosterilir.", "This guide is shown automatically on the first launch.");
  }

  function show(nextMode) {
    ensureDom();
    if (mode !== nextMode) {
      mode = nextMode;
      if (nextMode === "tutorial") tutorialStep = 0;
    }
    render();
    refs.root.classList.add("open");
  }

  function evaluate() {
    if (ensureDailyLoginPending()) return;

    const snapshot = storeRef.get() || {};
    if (currentSceneKey !== "home") {
      hide();
      return;
    }

    if (snapshot.dailyLogin?.pending) {
      show("daily");
      return;
    }

    if (snapshot.intro?.profileCompleted && !snapshot.intro?.tutorialSeen) {
      show("tutorial");
      return;
    }

    hide();
  }

  window.addEventListener("tc:scene-changed", (event) => {
    currentSceneKey = String(event?.detail?.key || "");
    evaluate();
  });

  storeRef.subscribe(() => {
    if (mode) render();
    evaluate();
  });
}

/* ===== UI ===== */
startHud(store, i18n);
startChat(store);
startActivityTicker(store);
startMenu(store);
startStarsOverlay?.(store);
startWeaponsDealer?.({ store, scenes, assets, input });
startPvpLobby();
startProgressionOverlay(store, i18n);

normalizeGlobalUi(store);

/* ===== START ===== */
scenes.go("boot");
engine.start();
window.tcEngineStarted = true;
if (_singleSessionState.locked) {
  engine.stop();
}
