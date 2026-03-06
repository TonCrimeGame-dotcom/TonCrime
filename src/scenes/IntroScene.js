export class IntroScene {
  constructor({ store, input, scenes, assets }) {
    this.store = store;
    this.input = input;
    this.scenes = scenes;
    this.assets = assets;

    this.stage = "splash";
  }

  update() {
    if (this.stage === "splash") {
      if (this.input.justPressed()) {
        this.stage = "warning";
      }
    }

    if (this.stage === "warning") {
      if (this.input.justPressed()) {
        this.askAge();
      }
    }
  }

  askAge() {
    const age = prompt("Yaşınızı girin:");

    if (!age || Number(age) < 18) {
      alert("Bu oyun sadece +18 kullanıcılar içindir.");
      return;
    }

    this.askUsername();
  }

  askUsername() {
    let username = "";

    try {
      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

      if (tgUser) {
        username =
          tgUser.username ||
          [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ");
      }
    } catch {}

    if (!username) {
      username = prompt("Kullanıcı adı gir:");
    }

    this.store.set({
      player: {
        username: username || "Player",
        level: 1,
        energy: 10,
        energyMax: 10,
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

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Devam etmek için ekrana dokun", w / 2, h - 60);
    }

    if (this.stage === "warning") {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "#fff";
      ctx.font = "26px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("+18 UYARI", w / 2, 140);

      ctx.font = "16px system-ui";
      ctx.fillText(
        "Bu oyun cinsellik, yasaklı madde ve şiddet içerir.",
        w / 2,
        200
      );

      ctx.fillText("Devam etmek için ekrana dokun", w / 2, 260);
    }
  }
}