import { Engine } from "./engine/Engine.js";
import { Store } from "./engine/Store.js";
import { SceneManager } from "./engine/SceneManager.js";
import { Input } from "./engine/Input.js";
import { Assets } from "./engine/Assets.js";
import { I18n } from "./engine/I18n.js";

import { StarsScene } from "./scenes/StarsScene.js";
import { WeaponsScene } from "./scenes/WeaponsDealerScene.js";
import { BootScene } from "./scenes/BootScene.js";
import { HomeScene } from "./scenes/HomeScene.js";
import { SimpleScreenScene } from "./scenes/SimpleScreenScene.js";
import { CoffeeShopScene } from "./scenes/CoffeeShopScene.js";
import { NightclubScene } from "./scenes/NightclubScene.js";
import { ProfileScene } from "./scenes/ProfileScene.js";

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
  coins: 0,
  premium: false,

  player: {
    username: "Player",
    telegramId: "",
    level: 1,
    xp: 30,
    xpToNext: 100,
    weaponName: "Silah Yok",
    weaponBonus: "+0%",
    weaponIconBonusPct: 0,
    energy: 10,
    energyMax: 10,
    energyIntervalMs: 5 * 60 * 1000,
    lastEnergyAt: Date.now(),
  },

  profile: {
    id: "TC-PLAYER",
    avatar: "😈",
    bio: "TonCrime sokaklarında aktif.",
    isPublic: true,
    telegramId: "",
    walletAddress: "",
    premiumType: "none",
    premiumUntil: 0,
    joinedAt: Date.now(),
  },

  leaderboard: {
    rankGlobal: 0,
    rankWeekly: 0,
    pvpWins: 0,
    pvpLosses: 0,
  },

  finance: {
    tonBalance: 0,
    ytonBalance: 0,
    totalIncomeTon: 0,
    totalExpenseTon: 0,
    totalIncomeYton: 0,
    totalExpenseYton: 0,
    history: [],
  },

  pvpHistory: [],

  stars: {
    owned: {},
    selectedId: null,
    lastClaimTs: {},
    twinBonusClaimed: {},
  },

  weapons: {
    owned: {},
    equippedId: null,
  },

  ui: { safe: getSafeArea() },
};

const loaded = loadStore();
const initial = loaded
  ? {
      ...defaultState,
      ...loaded,
      player: { ...defaultState.player, ...(loaded.player || {}) },
      profile: { ...defaultState.profile, ...(loaded.profile || {}) },
      leaderboard: { ...defaultState.leaderboard, ...(loaded.leaderboard || {}) },
      finance: {
        ...defaultState.finance,
        ...(loaded.finance || {}),
        history: Array.isArray(loaded.finance?.history) ? loaded.finance.history : [],
      },
      stars: { ...defaultState.stars, ...(loaded.stars || {}) },
      weapons: { ...defaultState.weapons, ...(loaded.weapons || {}) },
      pvpHistory: Array.isArray(loaded.pvpHistory) ? loaded.pvpHistory : [],
      ui: { safe: getSafeArea() },
    }
  : defaultState;

const store = new Store(initial);

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

function normalizeProfileState() {
  const s = store.get();
  const p = s.player || {};
  const profile = s.profile || {};
  const baseId =
    String(p.telegramId || profile.telegramId || p.username || "PLAYER")
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 10) || "PLAYER";

  store.set({
    profile: {
      ...profile,
      id: profile.id || `TC-${baseId}`,
      avatar: profile.avatar || "😈",
      bio: profile.bio || "TonCrime sokaklarında aktif.",
      premiumType: s.premium ? "premium" : profile.premiumType || "none",
      telegramId: String(p.telegramId || profile.telegramId || ""),
      joinedAt: Number(profile.joinedAt || Date.now()),
    },
  });
}
normalizeProfileState();

function pushFinanceHistory(entry) {
  const s = store.get();
  const finance = s.finance || { history: [] };
  const next = [{ ts: Date.now(), ...entry }, ...(finance.history || [])].slice(0, 30);
  store.set({ finance: { ...finance, history: next } });
}

function updateLeaderboardPatch(result) {
  const s = store.get();
  const lb = s.leaderboard || {};
  const wins = Number(lb.pvpWins || 0) + (result === "win" ? 1 : 0);
  const losses = Number(lb.pvpLosses || 0) + (result === "lose" ? 1 : 0);
  const rankGlobal = Math.max(1, 5000 - wins * 17 + losses * 5);
  const rankWeekly = Math.max(1, 1000 - wins * 9 + losses * 3);
  return { pvpWins: wins, pvpLosses: losses, rankGlobal, rankWeekly };
}

function applyXp(amount) {
  const s = store.get();
  const p = s.player || {};
  let xp = Number(p.xp || 0) + Number(amount || 0);
  let level = Number(p.level || 1);
  let xpToNext = Math.max(100, Number(p.xpToNext || 100));

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = Math.round(xpToNext * 1.18);
  }

  store.set({ player: { ...p, xp, level, xpToNext } });
}

window.addEventListener("tc:pvp:win", (ev) => {
  const s = store.get();
  const rewardCoin = 25;
  const rewardXp = 12;
  const opp = ev.detail?.opponent || {};

  store.set({
    coins: Number(s.coins || 0) + rewardCoin,
    leaderboard: updateLeaderboardPatch("win"),
    pvpHistory: [
      {
        id: ev.detail?.matchId || `m_${Date.now()}`,
        result: "win",
        opponentName: opp.username || "Rakip",
        opponentId: opp.id || "",
        rewardCoin,
        rewardXp,
        playedAt: Date.now(),
      },
      ...(Array.isArray(s.pvpHistory) ? s.pvpHistory : []),
    ].slice(0, 30),
  });

  applyXp(rewardXp);

  const fin = store.get().finance || {};
  store.set({
    finance: {
      ...fin,
      totalIncomeYton: Number(fin.totalIncomeYton || 0) + rewardCoin,
    },
  });
  pushFinanceHistory({
    type: "pvp_win",
    label: "PvP galibiyeti",
    amount: rewardCoin,
    unit: "coin",
  });
});

window.addEventListener("tc:pvp:lose", (ev) => {
  const s = store.get();
  const rewardXp = 4;
  const opp = ev.detail?.opponent || {};

  store.set({
    leaderboard: updateLeaderboardPatch("lose"),
    pvpHistory: [
      {
        id: ev.detail?.matchId || `m_${Date.now()}`,
        result: "lose",
        opponentName: opp.username || "Rakip",
        opponentId: opp.id || "",
        rewardCoin: 0,
        rewardXp,
        playedAt: Date.now(),
      },
      ...(Array.isArray(s.pvpHistory) ? s.pvpHistory : []),
    ].slice(0, 30),
  });

  applyXp(rewardXp);
  pushFinanceHistory({
    type: "pvp_lose",
    label: "PvP mağlubiyeti",
    amount: 0,
    unit: "coin",
  });
});

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
addImage("profile", "./src/assets/ui/background.jpg");
addImage("missions", "./src/assets/missions.jpg");
addImage("pvp", "./src/assets/pvp.jpg");
addImage("weapons", "./src/assets/weapons.jpg");
addImage("nightclub", "./src/assets/nightclub.jpg");
addImage("coffeeshop", "./src/assets/coffeeshop.jpg");
addImage("xxx", "./src/assets/xxx.jpg");

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
    pushFinanceHistory({
      type: "dev_coin",
      label: "Dev coin",
      amount: Number(n || 0),
      unit: "coin",
    });
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
  profile() {
    scenes.go("profile");
  },
  win() {
    window.dispatchEvent(
      new CustomEvent("tc:pvp:win", {
        detail: { matchId: "dev_" + Date.now(), opponent: { username: "Bot" } },
      })
    );
  },
  lose() {
    window.dispatchEvent(
      new CustomEvent("tc:pvp:lose", {
        detail: { matchId: "dev_" + Date.now(), opponent: { username: "Bot" } },
      })
    );
  },
  reset() {
    localStorage.removeItem(STORE_KEY);
    location.reload();
  },
};

window.dev = () => {
  const s = store.get();
  store.set({
    coins: 999,
    player: { ...(s.player || {}), energy: 10, energyMax: 10 },
  });
};

/* ===== SCENES REGISTER ===== */
scenes.register("boot", new BootScene({ assets, i18n, scenes }));
scenes.register("home", new HomeScene({ store, input, i18n, assets, scenes }));
scenes.register("profile", new ProfileScene({ store, input, assets, scenes }));

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
