import { supabase } from "../supabase.js";

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

    /* Eğer profil daha önce oluşturulduysa direkt oyuna gir */
    if (s?.intro?.profileCompleted && s?.player?.username) {
      this.scenes.go("home");
      return;
    }

    this.stage = "splash";
    this.lock = false;
  }

  update() {
    if (this.lock) return;

    /* Splash → +18 ekranı */
    if (this.stage === "splash" && this.input.justPressed()) {
      this.stage = "warning";
      return;
    }

    /* +18 ekranından kullanıcı oluştur */
    if (this.stage === "warning" && this.input.justPressed()) {
      this.createUser();
    }
  }

  async createUser() {
    this.lock = true;

    const age = Number(prompt("Yaşınızı girin:", "18"));
    if (!Number.isFinite(age) || age < 18) {
      alert("Bu oyun sadece 18+ içindir.");
      this.lock = false;
      return;
    }

    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const telegramId = String(tgUser?.id || "test_user");

    let username =
      tgUser?.username ||
      prompt("Kullanıcı adı gir:", "Player") ||
      "Player";

    username = username.trim().slice(0, 24);

    /* Supabase'e kayıt */
    try {
      await supabase.from("profiles").upsert({
        telegram_id: telegramId,
        username,
        age,
        level: 1,
        coins: 0,
        energy: 10,
        energy_max: 10,
      });
    } catch (err) {
      console.log("Supabase kayıt hatası", err);
    }

    const s = this.store.get();
    const p = s.player || {};

    /* LOCAL STORE'A KALICI YAZ */
    this.store.set({
      intro: {
        splashSeen: true,
        ageVerified: true,
        profileCompleted: true,
      },
      player: {
        ...p,
        telegramId,
        username,
        age,
        level: 1,
        energy: 10,
        energyMax: 10,
      },
    });

    /* OYUNA GİR */
    this.scenes.go("home");
  }

  render(ctx, w, h) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    if (this.stage === "splash") {
      const img = this.assets.getImage("tata");

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
      ctx.fillText(
        "Bu oyun cinsellik, şiddet ve yasaklı madde içerir.",
        w / 2,
        210
      );

      ctx.fillText("Devam etmek için dokun.", w / 2, 250);
    }
  }
}
