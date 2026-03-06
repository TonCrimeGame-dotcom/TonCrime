export class BootScene {
  constructor({ assets, i18n, scenes }) {
    this.assets = assets;
    this.i18n = i18n;
    this.scenes = scenes;
  }

  async onEnter() {
    await this.assets.loadImages([
      // Intro / yapımcı logosu
      { key: "tata", src: "./src/assets/tata.png" },

      // Genel / carousel
      { key: "weapons_bg", src: "./src/assets/weapons.png" },
      { key: "missions", src: "./src/assets/missions.jpg" },
      { key: "pvp", src: "./src/assets/pvp.jpg" },
      { key: "weapons", src: "./src/assets/weapons.jpg" },
      { key: "nightclub", src: "./src/assets/nightclub.jpg" },
      { key: "coffeeshop", src: "./src/assets/coffeeshop.jpg" },
      { key: "xxx", src: "./src/assets/xxx.jpg" },

      // Ticaret kartı + background
      { key: "blackmarket", src: "./src/assets/BlackMarket.png" },
      { key: "blackmarket_bg", src: "./src/assets/BlackMarket.png" },

      // xxx background
      { key: "xxx_bg", src: "./src/assets/xxx.jpg" },

      // CoffeeShop
      { key: "coffeeshop_bg", src: "./src/assets/coffeeshop.png" },
      { key: "coffeeshop_book", src: "./src/assets/coffeeshop_book.png" },
      { key: "coffeeshop_menu", src: "./src/assets/coffeeshop_menu.png" }
    ]);

    this.scenes.go("intro");
  }

  render(ctx, w, h) {
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#ffffff";
    ctx.font = "20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(this.i18n.t("loading"), w / 2, h / 2);
  }
}
