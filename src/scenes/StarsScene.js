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

    this._binded = false;
    this._down = false;
    this._pid = null;
    this._downX = 0;
    this._downY = 0;
    this._startScroll = 0;

    this._top = 70;
    this._bottomPad = 90;
  }

  onEnter() {
    const s = this.store.get();
    if (!s.stars) {
      this.store.set({
        stars: { owned: {}, selectedId: null, lastClaimTs: {}, twinBonusClaimed: {} },
      });
    }
    this._bindPointer();
  }

  onExit() {
    this._unbindPointer();
  }

  _clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  _canvas() {
    return document.getElementById("game");
  }

  _toCanvasXY(clientX, clientY) {
    const c = this._canvas();
    if (!c) return { x: clientX, y: clientY };
    const r = c.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  _bindPointer() {
    if (this._binded) return;
    const c = this._canvas();
    if (!c) return;

    c.style.touchAction = "none";

    this._onPD = (e) => {
      if (this._down) return;

      const { x, y } = this._toCanvasXY(e.clientX, e.clientY);

      this._down = true;
      this._pid = e.pointerId;
      this._downX = x;
      this._downY = y;
      this._startScroll = this.scrollY;

      c.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };

    this._onPM = (e) => {
      if (!this._down) return;
      if (this._pid != null && e.pointerId !== this._pid) return;

      const { y } = this._toCanvasXY(e.clientX, e.clientY);
      const dy = y - this._downY;

      this.scrollY = this._clamp(this._startScroll - dy, 0, this.maxScroll);
      e.preventDefault();
    };

    this._onPU = (e) => {
      if (!this._down) return;
      if (this._pid != null && e.pointerId !== this._pid) return;

      const { x, y } = this._toCanvasXY(e.clientX, e.clientY);
      const moved = Math.abs(x - this._downX) + Math.abs(y - this._downY);

      this._down = false;
      this._pid = null;

      if (moved < 10) this.onTap(x, y);

      e.preventDefault();
    };

    this._onWheel = (e) => {
      this.scrollY = this._clamp(this.scrollY + e.deltaY, 0, this.maxScroll);
      e.preventDefault();
    };

    c.addEventListener("pointerdown", this._onPD, { passive: false });
    c.addEventListener("pointermove", this._onPM, { passive: false });
    c.addEventListener("pointerup", this._onPU, { passive: false });
    c.addEventListener("pointercancel", this._onPU, { passive: false });
    c.addEventListener("wheel", this._onWheel, { passive: false });

    this._binded = true;
  }

  _unbindPointer() {
    if (!this._binded) return;
    const c = this._canvas();
    if (!c) return;

    c.removeEventListener("pointerdown", this._onPD);
    c.removeEventListener("pointermove", this._onPM);
    c.removeEventListener("pointerup", this._onPU);
    c.removeEventListener("pointercancel", this._onPU);
    c.removeEventListener("wheel", this._onWheel);

    this._binded = false;
    this._down = false;
    this._pid = null;
  }

  _computeLayout(H) {
    const HEADER_H = 56;

    const hud = document.getElementById("hudTop");
    const chat = document.getElementById("chatDrawer");

    const hudH = hud ? hud.offsetHeight : 0;
    const top = Math.max(HEADER_H + 14, hudH + 14);
    const bottomPad = chat ? 110 : 90;
    const viewH = Math.max(120, H - top - bottomPad);

    this._top = top;
    this._bottomPad = bottomPad;

    return { HEADER_H, top, bottomPad, viewH };
  }

  buyStar(star) {
    const s = this.store.get();

    const coins = Number(s.coins || 0);
    const cost = Number(star.coinValue || 0);

    const player = s.player || {};
    const energy = Number(player.energy || 0);
    const energyMax = Number(player.energyMax || 10);

    const starsState =
      s.stars || { owned: {}, selectedId: null, lastClaimTs: {}, twinBonusClaimed: {} };
    const owned = starsState.owned || {};

    if (owned[star.id]) return true;
    if (coins < cost) {
      window.dispatchEvent(
        new CustomEvent("tc:toast", { detail: { text: "Yetersiz coin" } })
      );
      return false;
    }

    const gain = Number(star.energyGain || 0);
    const newEnergyMax = energyMax + gain;
    const newEnergy = Math.min(newEnergyMax, energy + gain);

    this.store.set({
      coins: coins - cost,
      player: { ...player, energyMax: newEnergyMax, energy: newEnergy },
      stars: { ...starsState, owned: { ...owned, [star.id]: true }, selectedId: star.id },
    });

    window.dispatchEvent(new CustomEvent("tc:stars:open", { detail: { starId: star.id } }));
    return true;
  }

  onTap(x, y) {
    if (y <= 56 && x <= 90) {
      this.scenes.go("home");
      return;
    }

    for (const r of this.hit) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        const s = this.store.get();
        const owned = s.stars?.owned || {};
        const isOwned = !!owned[r.star.id];

        if (!isOwned) {
          this.buyStar(r.star);
          return;
        }

        this.selectStar(r.star.id);
        return;
      }
    }
  }

  selectStar(starId) {
    const s = this.store.get();
    const starsState =
      s.stars || { owned: {}, selectedId: null, lastClaimTs: {}, twinBonusClaimed: {} };

    this.store.set({ stars: { ...starsState, selectedId: starId } });
    window.dispatchEvent(new CustomEvent("tc:stars:open", { detail: { starId } }));
  }

  _fitText(ctx, text, maxW, startSize, minSize, weight = "700") {
    let size = startSize;
    while (size > minSize) {
      ctx.font = `${weight} ${size}px sans-serif`;
      if (ctx.measureText(text).width <= maxW) return size;
      size -= 1;
    }
    return minSize;
  }

  _drawClampedText(ctx, text, x, y, maxW) {
    let out = String(text || "");
    while (out.length > 0 && ctx.measureText(out).width > maxW) {
      out = out.slice(0, -1);
    }
    if (out !== text && out.length > 1) out = out.slice(0, -1) + "…";
    ctx.fillText(out, x, y);
  }

  render(ctx) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.floor(ctx.canvas.width / dpr);
    const H = Math.floor(ctx.canvas.height / dpr);

    const { top, bottomPad, viewH } = this._computeLayout(H);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, W, 56);
    ctx.fillStyle = "#fff";
    ctx.font = "20px sans-serif";
    ctx.fillText("GENEL EV", 110, 35);
    ctx.font = "16px sans-serif";
    ctx.fillText("< Geri", 16, 35);

    const s = this.store.get();
    const owned = s.stars?.owned || {};
    const selectedId = s.stars?.selectedId ?? null;

    const pad = W <= 420 ? 10 : 12;
    const cols = W <= 420 ? 2 : 3;
    const cardW = Math.floor((W - pad * (cols + 1)) / cols);
    const imgH = W <= 420 ? 96 : 84;
    const cardH = W <= 420 ? 170 : 155;

    const rows = Math.ceil(stars.length / cols);
    const contentH = rows * (cardH + pad) + pad;

    this.maxScroll = Math.max(0, contentH - viewH);
    this.scrollY = this._clamp(this.scrollY, 0, this.maxScroll);

    const contentY = top - this.scrollY;
    this.hit = [];

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = pad + col * (cardW + pad);
      const y = contentY + row * (cardH + pad);

      if (y > H - bottomPad + 80 || y < -cardH - 80) continue;

      const isOwned = !!owned[star.id];
      const isSelected = selectedId === star.id;

      ctx.fillStyle = isSelected ? "#1f6f2a" : "#1a1a1a";
      ctx.fillRect(x, y, cardW, cardH);

      const img =
        (typeof this.assets.get === "function" ? this.assets.get(star.image) : null) ||
        this.assets.images?.[star.image];

      if (img) {
        ctx.drawImage(img, x + 8, y + 8, cardW - 16, imgH);
      } else {
        ctx.fillStyle = "#2b2b2b";
        ctx.fillRect(x + 8, y + 8, cardW - 16, imgH);
      }

      const titleMaxW = cardW - 20;
      const titleSize = this._fitText(ctx, star.name, titleMaxW, W <= 420 ? 12 : 13, 10, "700");
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${titleSize}px sans-serif`;
      this._drawClampedText(ctx, star.name, x + 10, y + imgH + 26, titleMaxW);

      ctx.fillStyle = "#d9d9d9";
      ctx.font = `${W <= 420 ? 11 : 12}px sans-serif`;
      this._drawClampedText(ctx, `+Enerji: ${star.energyGain}`, x + 10, y + imgH + 46, titleMaxW);
      this._drawClampedText(ctx, `Fiyat: ${star.coinValue} coin`, x + 10, y + imgH + 62, titleMaxW);

      if (star.twinId) {
        ctx.fillStyle = "#ff4fd0";
        ctx.fillRect(x + 8, y + 8, 46, 18);
        ctx.fillStyle = "#000";
        ctx.font = "11px sans-serif";
        ctx.fillText("TWIN", x + 14, y + 21);
      }

      if (isOwned) {
        ctx.fillStyle = "#00d0ff";
        ctx.fillRect(x + cardW - 52, y + 8, 44, 18);
        ctx.fillStyle = "#000";
        ctx.font = "11px sans-serif";
        ctx.fillText("OWN", x + cardW - 44, y + 21);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fillRect(x + cardW - 64, y + 8, 56, 18);
        ctx.fillStyle = "#fff";
        ctx.font = "11px sans-serif";
        ctx.fillText("BUY", x + cardW - 48, y + 21);
      }

      this.hit.push({ x, y, w: cardW, h: cardH, star });
    }
  }
}
