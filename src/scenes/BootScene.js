export class BootScene {
  constructor({ assets, i18n, scenes }) {
    this.assets = assets;
    this.i18n = i18n;
    this.scenes = scenes;
    this._started = false;
  }

  async onEnter() {
    if (this._started) return;
    this._started = true;

    try {
      await this.assets.loadImages([
        // Genel / carousel
        { key: "background", src: "./src/assets/ui/background.jpg" },
        { key: "profile", src: "./src/assets/ui/background.jpg" },
        { key: "missions", src: "./src/assets/missions.jpg" },
        { key: "pvp", src: "./src/assets/pvp.jpg" },
        { key: "weapons", src: "./src/assets/weapons.jpg" },
        { key: "nightclub", src: "./src/assets/nightclub.jpg" },
        { key: "coffeeshop", src: "./src/assets/coffeeshop.jpg" },
        { key: "xxx", src: "./src/assets/xxx.jpg" },

        // Silah sayfası
        { key: "weapons_bg", src: "./src/assets/weapons.png" },

        // XXX / stars
        { key: "xxx_bg", src: "./src/assets/xxx.jpg" },

        // CoffeeShop
        { key: "coffeeshop_bg", src: "./src/assets/coffeeshop.png" },
        { key: "coffeeshop_book", src: "./src/assets/coffeeshop_book.png" },
        { key: "coffeeshop_menu", src: "./src/assets/coffeeshop_menu.png" },
      ]);
    } catch (err) {
      console.error("BootScene asset load error:", err);
    }

    // intro YOK -> direkt home'a geç
    this.scenes.go("home");
  }

  render(ctx, w, h) {
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 22px system-ui";
    ctx.fillText(this.i18n?.t?.("loading") || "Yükleniyor...", w / 2, h / 2);
  }
}
