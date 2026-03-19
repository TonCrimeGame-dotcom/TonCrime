export class BootScene {
  constructor({ assets, i18n, scenes } = {}) {
    this.assets = assets;
    this.i18n = i18n;
    this.scenes = scenes;
    this._started = false;
  }

  onEnter() {
    if (this._started) return;
    this._started = true;

    try {
      if (typeof this.assets?.loadAll === "function") {
        Promise.resolve(this.assets.loadAll()).finally(() => {
          this.scenes?.go?.("intro");
        });
        return;
      }

      if (typeof this.assets?.load === "function") {
        Promise.resolve(this.assets.load()).finally(() => {
          this.scenes?.go?.("intro");
        });
        return;
      }
    } catch (err) {
      console.error("[BootScene] asset load error:", err);
    }

    this.scenes?.go?.("intro");
  }

  update() {}

  render(ctx, w, h) {
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "800 24px system-ui, Arial";
    ctx.fillText("TonCrime", w / 2, h / 2 - 10);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "600 14px system-ui, Arial";
    ctx.fillText(this.i18n?.t?.("loading") || "Yükleniyor...", w / 2, h / 2 + 20);
  }
}

export default BootScene;
