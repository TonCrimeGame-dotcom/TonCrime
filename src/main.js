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
import { MissionsScene } from "./scenes/MissionsScene.js";

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

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampInt(n, min = 0) {
  const v = Math.floor(Number(n) || 0);
  return Math.max(min, v);
}

const defaultState = {
  lang: "tr",
  coins: 0,
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

  dailyLogin: {
    lastClaimDay: null,
    streak: 0,
    totalClaims: 0,
    lastRewardText: "",
    rewardToastUntil: 0,
    got30DayWeapon: false,
  },

  missions: {
    lastDayKey: todayKey(),
    adsWatchedToday: 0,
    adsRewardClaimedToday: false,
    referrals: 0,
    referralMilestonesClaimed: {},
    pvpPlayedToday: 0,
    pvpWinsToday: 0,
    pvpPlayRewardClaimedToday: false,
    pvpWinRewardClaimedToday: false,
    energyRefillsToday: 0,
    energyRewardClaimedToday: false,
    levelRewardClaimed: {},
    telegramJoinRewardClaimed: false,
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
      weapons: { ...defaultState.weapons, ...(loaded.weapons || {}) },
      dailyLogin: { ...defaultState.dailyLogin, ...(loaded.dailyLogin || {}) },
      missions: { ...defaultState.missions, ...(loaded.missions || {}) },
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

function makeTestTelegramId() {
  try {
    const saved = localStorage.getItem("tc_test_telegram_id");
    if (saved) return saved;

    const id = "test_" + Math.random().toString(36).slice(2, 12);
    localStorage.setItem("tc_test_telegram_id", id);
    return id;
  } catch {
    return "test_" + Math.random().toString(36).slice(2, 12);
  }
}

function getTelegramId() {
  const tgUser = getTelegramUser();
  if (tgUser?.id) return String(tgUser.id);

  try {
    const storeId = String(store.get()?.player?.telegramId || "");
    if (storeId) return storeId;
  } catch (_) {}

  return makeTestTelegramId();
}

function getTelegramUsername() {
  const tgUser = getTelegramUser();

  if (tgUser?.username) return String(tgUser.username);

  const fullName = [tgUser?.first_name, tgUser?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) return fullName;

  try {
    const storeName = String(store.get()?.player?.username || "").trim();
    if (storeName && storeName !== "Player") return storeName;
  } catch (_) {}

  return "test_user";
}

function bootstrapTelegramUser() {
  try {
    const s = store.get();
    const p = s.player || {};

    const telegramId = getTelegramId();
    const username = getTelegramUsername();

    store.set({
      player: {
        ...p,
        telegramId,
        username,
      },
    });

    console.log("[TG INIT]", {
      telegramId,
      username,
      telegramUser: getTelegramUser(),
    });
  } catch (err) {
    console.error("[TG INIT ERROR]", err);
  }
}

bootstrapTelegramUser();

/* ===== MISSION STATE ===== */
function ensureMissionState() {
  const s = store.get();
  const m = s.missions || {};
  const today = todayKey();

  if (!s.missions) {
    store.set({ missions: { ...defaultState.missions } });
    return;
  }

  if (m.lastDayKey !== today) {
    store.set({
      missions: {
        ...defaultState.missions,
        ...m,
        lastDayKey: today,
        adsWatchedToday: 0,
        adsRewardClaimedToday: false,
        pvpPlayedToday: 0,
        pvpWinsToday: 0,
        pvpPlayRewardClaimedToday: false,
        pvpWinRewardClaimedToday: false,
        energyRefillsToday: 0,
        energyRewardClaimedToday: false,
      },
    });
  }
}

/* ===== DAILY LOGIN ===== */
function dayKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayKey() {
  return dayKeyFromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

function ensureDailyLoginState() {
  const s = store.get();

  if (!s.weapons) {
    store.set({
      weapons: {
        owned: {},
        equippedId: null,
      },
    });
  }

  if (!s.dailyLogin) {
    store.set({
      dailyLogin: {
        lastClaimDay: null,
        streak: 0,
        totalClaims: 0,
        lastRewardText: "",
        rewardToastUntil: 0,
        got30DayWeapon: false,
      },
    });
  }
}

function giveMp5RewardIfNeeded(p, w) {
  const nextWeapons = {
    ...w,
    owned: {
      ...(w.owned || {}),
      mp5: true,
    },
  };

  let nextPlayer = null;

  if (!p.weaponName || p.weaponName === "Silah Yok") {
    nextPlayer = {
      ...p,
      weaponName: "HK MP5 (9×19mm)",
      weaponBonus: "+%28",
      weaponIconBonusPct: 28,
    };
    nextWeapons.equippedId = w.equippedId || "mp5";
  }

  return { nextWeapons, nextPlayer };
}

function applyDailyLoginReward() {
  ensureDailyLoginState();

  const s = store.get();
  const dl = s.dailyLogin || {};
  const p = s.player || {};
  const w = s.weapons || { owned: {}, equippedId: null };

  const today = todayKey();
  const yesterday = yesterdayKey();

  if (dl.lastClaimDay === today) return;

  let streak = 1;
  if (dl.lastClaimDay === yesterday) {
    streak = Number(dl.streak || 0) + 1;
  }

  let coinReward = 10;
  let rewardText = `Günlük giriş bonusu: +10 yton • Seri: ${streak} gün`;

  if (streak === 7) {
    coinReward += 30;
    rewardText = "7. gün bonusu: +40 yton • İlk 7 gün toplamı 100 yton";
  }

  const patch = {
    coins: clampInt(Number(s.coins || 0) + coinReward),
    dailyLogin: {
      ...dl,
      lastClaimDay: today,
      streak,
      totalClaims: Number(dl.totalClaims || 0) + 1,
      lastRewardText: rewardText,
      rewardToastUntil: Date.now() + 5000,
      got30DayWeapon: !!dl.got30DayWeapon,
    },
  };

  if (streak >= 30 && !dl.got30DayWeapon) {
    const { nextWeapons, nextPlayer } = giveMp5RewardIfNeeded(p, w);
    patch.weapons = nextWeapons;
    if (nextPlayer) patch.player = nextPlayer;
    patch.dailyLogin.got30DayWeapon = true;
    patch.dailyLogin.lastRewardText = `${rewardText} • 30 gün ödülü: HK MP5 kazandın!`;
  }

  store.set(patch);

  setTimeout(() => {
    const latest = store.get();
    const txt = latest?.dailyLogin?.lastRewardText;
    if (txt) alert(txt);
  }, 120);
}

/* ===== SUPABASE REMOTE PLAYER STATE ===== */
let _lastProfileSyncAt = 0;
let _profileSyncBusy = false;
let _lastProfilePayload = "";
let _profileHydrated = false;

function buildProfilePayload() {
  const s = store.get();
  const p = s.player || {};
  const telegramId = getTelegramId();

  if (!telegramId) return null;

  return {
    telegram_id: telegramId,
    username: String(p.username || "Player"),
    age: p.age ?? null,
    level: clampInt(p.level || 1, 1),
    coins: clampInt(s.coins || 0),
    energy: clampInt(p.energy || 10),
    energy_max: clampInt(p.energyMax || 10, 1),
    updated_at: new Date().toISOString(),
  };
}

async function hydrateProfileFromSupabase() {
  const telegramId = getTelegramId();
  if (!telegramId) return false;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("telegram_id, username, age, level, coins, energy, energy_max")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (error) {
      console.error("Supabase profile load error:", error);
      return false;
    }

    if (!data) {
      const payload = buildProfilePayload();
      if (!payload) return false;

      const { error: insertError } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "telegram_id" });

      if (insertError) {
        console.error("Supabase profile bootstrap insert error:", insertError);
        return false;
      }

      _profileHydrated = true;
      _lastProfilePayload = JSON.stringify(payload);
      return true;
    }

    const s = store.get();
    const p = s.player || {};

    store.set({
      coins: clampInt(data.coins ?? s.coins ?? 0),
      player: {
        ...p,
        username: String(data.username || p.username || "Player"),
        telegramId: telegramId,
        age: data.age ?? p.age ?? null,
        level: clampInt(data.level ?? p.level ?? 1, 1),
        energy: clampInt(data.energy ?? p.energy ?? 10),
        energyMax: clampInt(data.energy_max ?? p.energyMax ?? 10, 1),
      },
    });

    _profileHydrated = true;
    _lastProfilePayload = JSON.stringify(buildProfilePayload() || {});
    return true;
  } catch (err) {
    console.error("Supabase profile hydrate fatal:", err);
    return false;
  }
}

async function syncProfileToSupabase() {
  if (_profileSyncBusy) return;
  if (!_profileHydrated) return;

  const s = store.get();
  if (!s?.intro?.profileCompleted) return;

  const payload = buildProfilePayload();
  if (!payload) return;

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
  if (now - _lastProfileSyncAt > 2000) {
    syncProfileToSupabase();
  }
  setTimeout(profileSyncLoop, 2000);
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
addImage("blackmarket", "./src/assets/BlackMarket.png");
addImage("blackmarket_bg", "./src/assets/BlackMarket.png");

/* ===== INPUT / SCENES ===== */
const input = new Input(canvas);
const scenes = new SceneManager();

window.tcStore = store;
window.tcScenes = scenes;

window.tc = window.tc || {};
window.tc.dev = {
  coin(n = 100) {
    const s = store.get();
    store.set({ coins: clampInt((Number(s.coins) || 0) + Number(n || 0)) });
    console.log("coins:", store.get().coins);
  },
  setcoin(n = 1000) {
    store.set({ coins: clampInt(n) });
    console.log("coins:", store.get().coins);
  },
  energy(n = 10) {
    const s = store.get();
    const p = s.player || {};
    const maxE = Math.max(1, Number(p.energyMax || 10));
    const next = Math.min(maxE, (Number(p.energy) || 0) + Number(n || 0));
    store.set({ player: { ...p, energy: clampInt(next) } });
    console.log("energy:", store.get().player.energy);
  },
  setenergy(n = 10) {
    const s = store.get();
    const p = s.player || {};
    const maxE = Math.max(1, Number(p.energyMax || 10));
    store.set({ player: { ...p, energy: Math.min(maxE, clampInt(n)) } });
    console.log("energy:", store.get().player.energy);
  },
  level(n = 1) {
    const s = store.get();
    const p = s.player || {};
    store.set({ player: { ...p, level: clampInt(n, 1) } });
    console.log("level:", store.get().player.level);
  },
  ad(n = 1) {
    ensureMissionState();
    const s = store.get();
    const m = s.missions || {};
    store.set({
      missions: {
        ...m,
        adsWatchedToday: Math.min(20, Number(m.adsWatchedToday || 0) + Number(n || 1)),
      },
    });
    console.log("adsWatchedToday:", store.get().missions.adsWatchedToday);
  },
  ref(n = 1) {
    ensureMissionState();
    const s = store.get();
    const m = s.missions || {};
    store.set({
      missions: {
        ...m,
        referrals: Math.max(0, Number(m.referrals || 0) + Number(n || 1)),
      },
    });
    console.log("referrals:", store.get().missions.referrals);
  },
  pvp(n = 1) {
    ensureMissionState();
    const s = store.get();
    const m = s.missions || {};
    store.set({
      missions: {
        ...m,
        pvpPlayedToday: Math.max(0, Number(m.pvpPlayedToday || 0) + Number(n || 1)),
      },
    });
    console.log("pvpPlayedToday:", store.get().missions.pvpPlayedToday);
  },
  pvpwin(n = 1) {
    ensureMissionState();
    const s = store.get();
    const m = s.missions || {};
    store.set({
      missions: {
        ...m,
        pvpWinsToday: Math.max(0, Number(m.pvpWinsToday || 0) + Number(n || 1)),
        pvpPlayedToday: Math.max(0, Number(m.pvpPlayedToday || 0) + Number(n || 1)),
      },
    });
    console.log("pvpWinsToday:", store.get().missions.pvpWinsToday);
  },
  refill(n = 1) {
    ensureMissionState();
    const s = store.get();
    const m = s.missions || {};
    store.set({
      missions: {
        ...m,
        energyRefillsToday: Math.max(0, Number(m.energyRefillsToday || 0) + Number(n || 1)),
      },
    });
    console.log("energyRefillsToday:", store.get().missions.energyRefillsToday);
  },
  syncnow() {
    syncProfileToSupabase();
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
scenes.register("intro", new IntroScene({ store, input, scenes, assets }));
scenes.register("home", new HomeScene({ store, input, i18n, assets, scenes }));

scenes.register(
  "trade",
  new TradeScene({ store, scenes, assets })
);

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

scenes.register(
  "missions",
  new MissionsScene({ store, input, assets, scenes })
);

scenes.register("xxx", new StarsScene({ store, input, i18n, assets, scenes }));
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

/* ===== MISSION EVENT TRACKERS ===== */
ensureMissionState();

window.addEventListener("tc:pvp:win", () => {
  ensureMissionState();
  const s = store.get();
  const m = s.missions || {};
  store.set({
    missions: {
      ...m,
      pvpPlayedToday: Number(m.pvpPlayedToday || 0) + 1,
      pvpWinsToday: Number(m.pvpWinsToday || 0) + 1,
    },
  });
});

window.addEventListener("tc:pvp:lose", () => {
  ensureMissionState();
  const s = store.get();
  const m = s.missions || {};
  store.set({
    missions: {
      ...m,
      pvpPlayedToday: Number(m.pvpPlayedToday || 0) + 1,
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

/* ===== STARTUP ===== */
async function startGame() {
  ensureMissionState();
  ensureDailyLoginState();

  await hydrateProfileFromSupabase();

  ensureMissionState();
  applyDailyLoginReward();

  const st = store.get();
  if (st?.intro?.profileCompleted) {
    scenes.go("boot");
  } else {
    scenes.go("intro");
  }

  engine.start();
}

startGame();
