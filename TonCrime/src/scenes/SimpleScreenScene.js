export class SimpleScreenScene {
  constructor({ i18n, titleKey }) {
    this.i18n = i18n;
    this.titleKey = titleKey;
  }

  render(ctx, w, h) {
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "26px system-ui";
    ctx.fillText(this.i18n.t(this.titleKey), w / 2, h / 2);

    ctx.font = "14px system-ui";
    ctx.fillText("(placeholder)", w / 2, h / 2 + 28);

    ctx.font = "13px system-ui";
    ctx.fillText("Geri dönmek için sayfayı yenile (F5)", w / 2, h / 2 + 56);
  }
}
