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

  onEnter() {
    this.stage = "splash";
    this.lock = false;
  }

  update() {
    if (this.lock) return;

    if (this.stage === "splash" && this.input.justPressed()) {
      this.stage = "warning";
      this.lock = true;
      setTimeout(() => (this.lock = false), 200);
      return;
    }

    if (this.stage === "warning" && this.input.justPressed()) {
      this.lock = true;
      this.createOrLoadUser();
    }
  }

  async createOrLoadUser() {
    const age = Number(prompt("Yaşınızı girin:"));

    if (!age || age < 18) {
      alert("Bu oyun sadece 18+ kullanıcılar içindir.");
      this.lock = false;
      return;
    }

    let username = "";

    try {
      const tg = window.Telegram?.WebApp?.initDataUnsafe?.user;

      if (tg) {
        username =
          tg.username ||
          [tg.first_name, tg.last_name].filter(Boolean).join(" ");
      }
    } catch {}

    if (!username) {
      username = prompt("Kullanıcı adı gir:");
    }

    if (!username) username = "Player";

    const telegramId =
      window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "test_user";

    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (!profile) {
      const { data } = await supabase
        .from("profiles")
        .insert({
          telegram_id: telegramId,
          username: username,
          age: age
        })
        .select()
        .single();

      profile = data;
    }

    const s = this.store.get();
    const p = s.player || {};

    this.store.set({
      player: {
        ...p,
        username: profile.username,
        level: profile.level,
        energy: profile.energy,
        energyMax: profile.energy_max,
      },
    });

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
      return;
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

      ctx.fillText("Devam etmek için ekrana dokun.", w / 2, 250);
    }
  }
}
