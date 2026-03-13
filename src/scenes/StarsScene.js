import { stars } from "../assets/starsData.js";

export class StarsScene {
  constructor({ store, input, i18n, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes;

    this.scrollY = 0;
    this.maxScroll = 0;

    this.hit = [];

    this._down = false;
    this._downY = 0;
    this._startScroll = 0;

    this.bg = null;
  }

  onEnter() {
    const s = this.store.get();

    if (!s.stars) {
      this.store.set({
        stars: {
          owned: {},
          selectedId: null
        }
      });
    }

    this.bg =
      this.assets.get?.("xxx_bg") ||
      this.assets.images?.["xxx_bg"] ||
      null;
  }

  _clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  update() {
    const p = this.input.pointer || {};

    if (this.input.justPressed?.()) {
      this._down = true;
      this._downY = p.y;
      this._startScroll = this.scrollY;
    }

    if (this._down && this.input.isDown?.()) {
      const dy = p.y - this._downY;
      this.scrollY = this._clamp(this._startScroll - dy, 0, this.maxScroll);
    }

    if (this._down && this.input.justReleased?.()) {
      this._down = false;

      for (const r of this.hit) {
        if (
          p.x >= r.x &&
          p.x <= r.x + r.w &&
          p.y >= r.y &&
          p.y <= r.y + r.h
        ) {
          if (r.type === "back") {
            this.scenes.go("home");
            return;
          }

          const s = this.store.get();
          const owned = s.stars?.owned || {};

          if (!owned[r.star.id]) {
            this.buyStar(r.star);
          } else {
            this.selectStar(r.star.id);
          }
        }
      }
    }
  }

  buyStar(star) {
    const s = this.store.get();

    const coins = Number(s.coins || 0);
    const cost = Number(star.coinValue || 0);

    if (coins < cost) {
      window.dispatchEvent(
        new CustomEvent("tc:toast", {
          detail: { text: "Yetersiz coin" }
        })
      );
      return;
    }

    const starsState = s.stars || { owned: {} };
    const owned = starsState.owned || {};

    this.store.set({
      coins: coins - cost,
      stars: {
        ...starsState,
        owned: { ...owned, [star.id]: true },
        selectedId: star.id
      }
    });
  }

  selectStar(id) {
    const s = this.store.get();
    const starsState = s.stars || {};

    this.store.set({
      stars: {
        ...starsState,
        selectedId: id
      }
    });
  }

  render(ctx) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    this.hit = [];

    ctx.clearRect(0, 0, W, H);

    /* BACKGROUND */

    if (this.bg) {
      ctx.drawImage(this.bg, 0, 0, W, H);
    } else {
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    /* HEADER */

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, 70);

    ctx.fillStyle = "#fff";
    ctx.font = "700 22px Arial";
    ctx.fillText("GENEL EV", 20, 42);

    /* X BUTTON */

    const bx = W - 60;
    const by = 16;

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.roundRect(bx, by, 40, 40, 10);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "900 20px Arial";
    ctx.fillText("X", bx + 14, by + 26);

    this.hit.push({
      type: "back",
      x: bx,
      y: by,
      w: 40,
      h: 40
    });

    const s = this.store.get();
    const owned = s.stars?.owned || {};
    const selected = s.stars?.selectedId;

    /* LIST */

    const startY = 90 - this.scrollY;
    const rowH = 80;
    const pad = 14;

    let y = startY;

    for (const star of stars) {
      const isOwned = !!owned[star.id];
      const isSelected = selected === star.id;

      ctx.fillStyle = isSelected
        ? "rgba(0,200,120,0.25)"
        : "rgba(0,0,0,0.5)";

      ctx.beginPath();
      ctx.roundRect(14, y, W - 28, rowH, 14);
      ctx.fill();

      const img =
        this.assets.get?.(star.image) ||
        this.assets.images?.[star.image];

      if (img) {
        ctx.drawImage(img, 24, y + 10, 60, 60);
      }

      ctx.fillStyle = "#fff";
      ctx.font = "700 16px Arial";
      ctx.fillText(star.name, 100, y + 30);

      ctx.fillStyle = "#cfcfcf";
      ctx.font = "13px Arial";
      ctx.fillText(
        `+Enerji: ${star.energyGain}`,
        100,
        y + 52
      );

      const btnW = 90;
      const bx2 = W - btnW - 26;

      ctx.fillStyle = isOwned
        ? "rgba(80,80,80,0.7)"
        : "rgba(255,180,40,0.9)";

      ctx.beginPath();
      ctx.roundRect(bx2, y + 20, btnW, 36, 10);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "700 14px Arial";
      ctx.fillText(
        isOwned ? "SEÇ" : `${star.coinValue} COIN`,
        bx2 + 12,
        y + 43
      );

      this.hit.push({
        star,
        x: 14,
        y,
        w: W - 28,
        h: rowH
      });

      y += rowH + pad;
    }

    const contentH = y - startY;
    this.maxScroll = Math.max(0, contentH - (H - 120));
  }
}
