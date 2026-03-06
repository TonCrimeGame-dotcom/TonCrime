import { supabase } from "../supabase.js";

export class IntroScene {
  constructor({ store, input, scenes, assets }) {
    this.store = store;
    this.input = input;
    this.scenes = scenes;
    this.assets = assets;

    this.stage = "splash";
    this.lock = false;
    this.errorText = "";
  }

  onEnter() {
    this.stage = "splash";
    this.lock = false;
    this.errorText = "";
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
    try {
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

      username = String(username || "Player").trim().slice(0, 24) || "Player";

      const telegramIdRaw =
        window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "test_user";

      const telegramId = String(telegramIdRaw);

      let { data: profile, error: selectError } = await supabase
        .from("profiles")
        .select("*")
        .eq("telegram_id", telegramId)
        .maybeSingle();

      if (selectError) {
        console.error("Supabase select error:", selectError);
      }

      if (!profile) {
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            telegram_id: telegramId,
            username: username,
            age: age
          });

        if (insertError) {
          console.error("Supabase insert error:", insertError);
          this.errorText = insertError.message || "Kayıt oluşturulamadı";

          // Fallback: yine de local aç
          const s = this.store.get();
          const p = s.player || {};
          this.store.set({
            player: {
              ...p,
              telegramId,
              username,
              age,
              level: Number(p.level || 1),
              energy: Number(p.energy || 10),
              energyMax: Number(p.energyMax || 10),
            },
          });

          this.scenes.go("home");
          return;
        }

        const { data: refetched, error: refetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("telegram_id", telegramId)
          .single();

        if (refetchError) {
          console.error("Supabase refetch error:", refetchError);
          this.errorText = refetchError.message || "Kayıt okunamadı";
        } else {
          profile = refetched;
        }
      }

      if (!profile) {
        // Son fallback
        profile = {
          telegram_id: telegramId,
          username,
          age,
          level: 1,
          energy: 10,
          energy_max: 10,
        };
      }

      const s = this.store.get();
      const p = s.player || {};

      this.store.set({
        player: {
          ...p,
          telegramId: profile.telegram_id || telegramId,
          username: profile.username || username,
          age: profile.age ?? age,
          level: Number(profile.level ?? p.level ?? 1),
          energy: Number(profile.energy ?? p.energy ?? 10),
          energyMax: Number(profile.energy_max ?? p.energyMax ?? 10),
        },
      });

      this.scenes.go("home");
    } catch (err) {
      console.error("IntroScene createOrLoadUser fatal error:", err);
      this.errorText = err?.message || "Bilinmeyen hata";
      alert(`Giriş hatası: ${this.errorText}`);
      this.lock = false;
    }
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

      if (this.errorText) {
        ctx.fillStyle = "#ff8a8a";
        ctx.font = "14px system-ui";
        ctx.fillText(this.errorText, w / 2, 320);
      }
    }
  }
}
