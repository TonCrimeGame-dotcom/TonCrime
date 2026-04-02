const PROFILE_KEY_STORAGE = "toncrime_profile_key_v1";
const STARTING_YTON = 100;
const STARTING_LEVEL = 0;
const STARTING_XP = 0;
const STARTING_XP_TO_NEXT = 0;
const MAX_PLAYER_ENERGY = 100;
const TELEGRAM_PROFILE_KEY_RE = /^\d{4,20}$/;

function safeGetLocalStorage(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function randomProfilePart() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replaceAll("-", "");
    }
  } catch {}

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function getTelegramWebAppUser() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  } catch {
    return null;
  }
}

function isTelegramMiniAppContext() {
  try {
    return !!window.Telegram?.WebApp;
  } catch {
    return false;
  }
}

function isTrustedTelegramProfileKey(value) {
  return TELEGRAM_PROFILE_KEY_RE.test(String(value || "").trim());
}

function getRuntimeProfileKey(store = null) {
  const tgUser = getTelegramWebAppUser();
  const tgId = String(tgUser?.id || "").trim();
  if (tgId) return tgId;

  const fromStore = String(store?.get?.()?.player?.telegramId || "").trim();
  if (isTrustedTelegramProfileKey(fromStore)) return fromStore;

  const fromBridge = String(window.tcGetProfileKey?.(store) || "").trim();
  if (isTrustedTelegramProfileKey(fromBridge)) return fromBridge;

  if (isTelegramMiniAppContext()) {
    return "";
  }

  let guestKey = safeGetLocalStorage(PROFILE_KEY_STORAGE).trim();
  if (!guestKey) {
    guestKey = `guest_${randomProfilePart()}`;
    safeSetLocalStorage(PROFILE_KEY_STORAGE, guestKey);
  }

  return guestKey;
}

function getImageSafe(assets, key) {
  if (!assets) return null;
  if (typeof assets.getImage === "function") return assets.getImage(key) || null;
  if (typeof assets.get === "function") return assets.get(key) || null;
  return assets.images?.[key] || null;
}

export class IntroScene {
  constructor({ store, input, scenes, assets }) {
    this.store = store;
    this.input = input;
    this.scenes = scenes;
    this.assets = assets;

    this.stage = "splash";
    this.lock = false;
  }

  async onEnter() {
    const s = this.store.get();

    if (s?.intro?.profileCompleted && s?.player?.username) {
      try {
        window.dispatchEvent(new CustomEvent("tc:profile-sync-now"));
      } catch {}
      this.scenes.go("home");
      return;
    }

    this.stage = s?.intro?.splashSeen ? "warning" : "splash";
    this.lock = false;
  }

  update() {
    if (this.lock) return;

    if (this.stage === "splash" && this.input.justPressed()) {
      const s = this.store.get();
      this.stage = "warning";
      this.store.set({
        intro: {
          ...(s.intro || {}),
          splashSeen: true,
        },
      });
      return;
    }

    if (this.stage === "warning" && this.input.justPressed()) {
      this.createUser();
    }
  }

  async createUser() {
    if (this.lock) return;
    this.lock = true;

    const age = Number(window.prompt("Yasinizi girin:", "18"));
    if (!Number.isFinite(age) || age < 18) {
      window.alert("Bu oyun sadece 18+ icindir.");
      this.lock = false;
      return;
    }

    const tgUser = getTelegramWebAppUser();
    const telegramId = getRuntimeProfileKey(this.store);
    if (!telegramId) {
      window.alert("Telegram kimligi henuz hazir degil. Mini App'i kapatip tekrar acin.");
      this.lock = false;
      return;
    }
    let username =
      tgUser?.username ||
      [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(" ") ||
      window.prompt("Kullanici adi gir:", "Player") ||
      "Player";

    username = String(username).trim().slice(0, 24) || "Player";

    const state = this.store.get();
    const prevPlayer = state.player || {};

    this.store.set({
      coins: STARTING_YTON,
      yton: STARTING_YTON,
      wallet: {
        ...(state.wallet || {}),
        yton: STARTING_YTON,
      },
      intro: {
        ...(state.intro || {}),
        splashSeen: true,
        ageVerified: true,
        profileCompleted: true,
      },
      player: {
        ...prevPlayer,
        telegramId,
        username,
        age,
        level: STARTING_LEVEL,
        xp: STARTING_XP,
        xpToNext: STARTING_XP_TO_NEXT,
        weaponName: "Silah Yok",
        weaponBonus: "+0%",
        energy: MAX_PLAYER_ENERGY,
        energyMax: MAX_PLAYER_ENERGY,
        lastEnergyAt: Date.now(),
      },
    });

    try {
      window.dispatchEvent(new CustomEvent("tc:profile-sync-now"));
    } catch {}

    this.scenes.go("home");
  }

  render(ctx, w, h) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    if (this.stage === "splash") {
      const img = getImageSafe(this.assets, "tata");

      if (img) {
        const scale = Math.min(w / img.width, h / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }

      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = "18px system-ui";
      ctx.fillText("Devam etmek icin dokun", w / 2, h - 60);
    }

    if (this.stage === "warning") {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";

      ctx.font = "28px system-ui";
      ctx.fillText("+18 UYARI", w / 2, 150);

      ctx.font = "16px system-ui";
      ctx.fillText("Bu oyun siddet, cinsellik ve yasakli madde icerir.", w / 2, 210);
      ctx.fillText("Devam etmek icin dokun.", w / 2, 250);
    }
  }
}

export default IntroScene;
