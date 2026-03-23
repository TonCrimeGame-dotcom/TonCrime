const PROFILE_KEY_STORAGE = "toncrime_profile_key_v1";
function safeGetLocalStorage(key) {
  try { return localStorage.getItem(key) || ""; } catch { return ""; }
}
function safeSetLocalStorage(key, value) {
  try { localStorage.setItem(key, value); } catch {}
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
  try { return window.Telegram?.WebApp?.initDataUnsafe?.user || null; } catch { return null; }
}
function getRuntimeProfileKey(store = null) {
  const fromStore = String(store?.get?.()?.player?.telegramId || "").trim();
  if (fromStore) return fromStore;
  const tgUser = getTelegramWebAppUser();
  const tgId = String(tgUser?.id || "").trim();
  if (tgId) return tgId;
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
      this.stage = "warning";
      const s = this.store.get();
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

    const age = Number(window.prompt("Yaşınızı girin:", "18"));
    if (!Number.isFinite(age) || age < 18) {
      window.alert("Bu oyun sadece 18+ içindir.");
      this.lock = false;
      return;
    }

    const tgUser = getTelegramWebAppUser();
    const telegramId = getRuntimeProfileKey(this.store);

    let username = tgUser?.username || window.prompt("Kullanıcı adı gir:", "Player") || "Player";
    username = String(username).trim().slice(0, 24) || "Player";

    const state = this.store.get();
    const prevPlayer = state.player || {};
    const startEnergyMax = Math.max(50, Number(prevPlayer.energyMax || 50));
    const startEnergy = Math.max(50, Math.min(startEnergyMax, Number(prevPlayer.energy || startEnergyMax)));

    this.store.set({
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
        level: 1,
        energy: startEnergy,
        energyMax: startEnergyMax,
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
      ctx.fillText("Devam etmek için dokun", w / 2, h - 60);
    }

    if (this.stage === "warning") {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";

      ctx.font = "28px system-ui";
      ctx.fillText("+18 UYARI", w / 2, 150);

      ctx.font = "16px system-ui";
      ctx.fillText("Bu oyun cinsellik, şiddet ve yasaklı madde içerir.", w / 2, 210);
      ctx.fillText("Devam etmek için dokun.", w / 2, 250);
    }
  }
}

export default IntroScene;
