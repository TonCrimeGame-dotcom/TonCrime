import { supabase } from "../supabase.js";
import { getRuntimeProfileKey, getTelegramWebAppUser } from "../utils/profileKey.js";

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

    try {
      const { error } = await supabase.from("profiles").upsert({
        telegram_id: telegramId,
        username,
        age,
        level: 1,
        coins: 0,
        energy: startEnergy,
        energy_max: startEnergyMax,
      }, { onConflict: "telegram_id" });

      if (error) {
        console.error("Supabase kayıt hatası", error);
      }
    } catch (err) {
      console.log("Supabase kayıt hatası", err);
    }

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
