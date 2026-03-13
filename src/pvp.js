(function () {
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function fillRoundRect(ctx, x, y, w, h, r, fill) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function strokeRoundRect(ctx, x, y, w, h, r, stroke, lw) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function drawCoverImage(ctx, img, x, y, w, h, alpha) {
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) * 0.5;
    const dy = y + (h - dh) * 0.5;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalAlpha = prev;
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
      } else {
        lines.push(line);
        line = words[i];
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function getImageFromAssets(assets, key) {
    if (!assets) return null;
    if (typeof assets.get === "function") {
      const a = assets.get(key);
      if (a) return a;
    }
    if (assets[key]) return assets[key];
    if (assets.images && assets.images[key]) return assets.images[key];
    return null;
  }

  class PvpScene {
    constructor({ store, input, scenes, assets }) {
      this.store = store;
      this.input = input;
      this.scenes = scenes;
      this.assets = assets;

      this.scrollY = 0;
      this.maxScroll = 0;
      this.dragging = false;
      this.downY = 0;
      this.startScrollY = 0;
      this.velocityY = 0;
      this.lastPointerY = 0;

      this.panelRect = { x: 0, y: 0, w: 0, h: 0 };
      this.closeRect = null;
      this.cardRects = [];
      this.modePills = [];

      this.source = "general";

      this.cards = [
        {
          id: "grid",
          title: "Grid Heist",
          subtitle: "Sokak Çatışması",
          desc: "Match Masters tarzı sıra tabanlı grid PvP. Silah, savunma, ilaç ve ganimet komboları ile rakibi indir.",
          tags: ["Bıçak", "Silah", "Kalkan", "İlaç", "Ganimet"],
          open: true,
          accent: "#ffb24a",
        },
        {
          id: "arena",
          title: "Arena Clash",
          subtitle: "1v1 Sokak Dövüşü",
          desc: "Daha hızlı klasik PvP modu. Kritik saldırılar, kısa maçlar ve direkt ödül mantığı.",
          tags: ["Hızlı", "Crit", "Düello", "XP"],
          open: true,
          accent: "#ff9340",
        },
        {
          id: "tournament",
          title: "Kartel Turnuvası",
          subtitle: "Sezonluk PvP",
          desc: "Sezon puanı ve lig mantığı. Şimdilik yakında.",
          tags: ["Sezon", "Lig", "Ödül"],
          open: false,
          accent: "#7f7f86",
        },
      ];

      this.bg = null;
      this.fallbackBg = new Image();
      this.fallbackBg.src = "./src/assets/pvp-bg.png";
    }

    enter() {
      this.bg =
        getImageFromAssets(this.assets, "pvp_bg") ||
        getImageFromAssets(this.assets, "pvp-bg") ||
        getImageFromAssets(this.assets, "pvp") ||
        this.fallbackBg;

      const s = this.store?.get?.() || {};
      this.source = s?.pvp?.source || "general";
      this.scrollY = 0;
      this.velocityY = 0;
      this.dragging = false;
    }

    _headerText() {
      if (this.source === "nightclub") return "Rakip Havuzu: Nightclub içi";
      if (this.source === "coffeeshop") return "Rakip Havuzu: Coffeeshop içi";
      return "Rakip Havuzu: Genel";
    }

    _availableCards() {
      if (this.source === "nightclub") {
        return this.cards.filter((c) => c.id === "grid" || c.id === "arena");
      }
      if (this.source === "coffeeshop") {
        return this.cards.filter((c) => c.id === "grid");
      }
      return this.cards;
    }

    update(dt) {
      const p = this.input?.pointer;
      if (!p) return;

      if (p.justDown) {
        this.dragging = true;
        this.downY = p.y;
        this.lastPointerY = p.y;
        this.startScrollY = this.scrollY;
        this.velocityY = 0;
      }

      if (this.dragging && p.down) {
        const dy = p.y - this.downY;
        this.scrollY = clamp(this.startScrollY - dy, 0, this.maxScroll);

        const step = this.lastPointerY - p.y;
        this.velocityY = step;
        this.lastPointerY = p.y;
      }

      if (!p.down) {
        if (this.dragging) this.dragging = false;
      }

      const wheel = Number(this.input?.wheelDelta || 0);
      if (wheel) {
        this.scrollY = clamp(this.scrollY + wheel * 0.55, 0, this.maxScroll);
      }

      if (!this.dragging && Math.abs(this.velocityY) > 0.1) {
        this.scrollY = clamp(this.scrollY + this.velocityY, 0, this.maxScroll);
        this.velocityY *= 0.9;
      }
    }

    pointerUp(x, y) {
      if (this.closeRect && pointInRect(x, y, this.closeRect)) {
        this.scenes.go("home");
        return;
      }

      for (let i = 0; i < this.cardRects.length; i++) {
        const r = this.cardRects[i];
        if (pointInRect(x, y, r.btn) && r.card.open) {
          this.startGame(r.card.id);
          return;
        }
      }
    }

    startGame(id) {
      const s = this.store?.get?.() || {};
      const pvp = { ...(s.pvp || {}) };

      pvp.selectedMode = id;
      pvp.source = this.source || "general";

      this.store?.set?.({ pvp });

      if (id === "grid") {
        window.dispatchEvent(new CustomEvent("tc:pvp:grid", { detail: pvp }));
        return;
      }

      if (id === "arena") {
        window.dispatchEvent(new CustomEvent("tc:pvp:arena", { detail: pvp }));
        return;
      }
    }

    render(ctx) {
      const canvas = ctx.canvas;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      drawCoverImage(ctx, this.bg || this.fallbackBg, 0, 0, w, h, 1);

      const fade = ctx.createLinearGradient(0, 0, 0, h);
      fade.addColorStop(0, "rgba(0,0,0,0.28)");
      fade.addColorStop(0.5, "rgba(0,0,0,0.40)");
      fade.addColorStop(1, "rgba(0,0,0,0.62)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, w, h);

      const side = Math.max(12, Math.round(w * 0.03));
      const top = Math.max(102, Math.round(h * 0.14));
      const bottom = Math.max(66, Math.round(h * 0.10));

      const panelX = side;
      const panelY = top;
      const panelW = w - side * 2;
      const panelH = h - top - bottom;

      this.panelRect.x = panelX;
      this.panelRect.y = panelY;
      this.panelRect.w = panelW;
      this.panelRect.h = panelH;

      ctx.save();
      fillRoundRect(ctx, panelX, panelY, panelW, panelH, 22, "rgba(10,14,24,0.20)");
      strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 22, "rgba(255,181,74,0.0)", 0);

      const gloss = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
      gloss.addColorStop(0, "rgba(255,255,255,0.06)");
      gloss.addColorStop(1, "rgba(255,255,255,0.01)");
      fillRoundRect(ctx, panelX + 1, panelY + 1, panelW - 2, panelH - 2, 21, gloss);

      const innerPad = Math.max(14, Math.round(panelW * 0.03));
      const titleSize = clamp(Math.round(panelW * 0.045), 22, 34);
      const subtitleSize = clamp(Math.round(panelW * 0.022), 12, 16);
      const cardTitleSize = clamp(Math.round(panelW * 0.042), 19, 28);
      const cardSubSize = clamp(Math.round(panelW * 0.022), 11, 15);
      const cardTextSize = clamp(Math.round(panelW * 0.023), 12, 16);

      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.font = `700 ${titleSize}px system-ui, Arial`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("PvP • Oyun Seç", panelX + innerPad, panelY + 16);

      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = `500 ${subtitleSize}px system-ui, Arial`;
      ctx.fillText(this._headerText(), panelX + innerPad, panelY + 16 + titleSize + 10);

      const closeW = clamp(Math.round(panelW * 0.14), 84, 112);
      const closeH = clamp(Math.round(panelH * 0.065), 34, 42);
      const closeX = panelX + panelW - innerPad - closeW;
      const closeY = panelY + 14;
      this.closeRect = { x: closeX, y: closeY, w: closeW, h: closeH };

      fillRoundRect(ctx, closeX, closeY, closeW, closeH, 12, "rgba(20,20,26,0.72)");
      strokeRoundRect(ctx, closeX, closeY, closeW, closeH, 12, "rgba(255,255,255,0.16)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `700 ${clamp(Math.round(closeH * 0.36), 12, 16)}px system-ui, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Kapat", closeX + closeW / 2, closeY + closeH / 2);

      const chipsY = panelY + 16 + titleSize + 10 + subtitleSize + 14;
      const chipH = clamp(Math.round(panelH * 0.06), 28, 36);

      const chips = [
        { id: "general", label: "Genel PvP merkezi" },
        {
          id: this.source,
          label:
            this.source === "nightclub"
              ? "Nightclub içi havuz"
              : this.source === "coffeeshop"
              ? "Coffeeshop içi havuz"
              : "Şehir sokakları sıcak. En temiz komboyu yapan parayı toplar."
        }
      ];

      this.modePills = [];
      let chipX = panelX + innerPad;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${clamp(Math.round(chipH * 0.34), 11, 14)}px system-ui, Arial`;

      for (let i = 0; i < chips.length; i++) {
        const c = chips[i];
        const textW = Math.ceil(ctx.measureText(c.label).width);
        const chipW = Math.min(panelW - innerPad * 2, textW + 24);
        fillRoundRect(ctx, chipX, chipsY, chipW, chipH, chipH * 0.5, "rgba(18,18,22,0.46)");
        strokeRoundRect(ctx, chipX, chipsY, chipW, chipH, chipH * 0.5, "rgba(255,255,255,0.14)", 1);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(c.label, chipX + 12, chipsY + chipH / 2 + 0.5);
        chipX += chipW + 10;
        if (chipX > panelX + panelW - innerPad - 80) break;
      }

      const cards = this._availableCards();
      const scrollTop = chipsY + chipH + 14;
      const contentBottomPad = 16;
      const viewportTop = scrollTop;
      const viewportBottom = panelY + panelH - contentBottomPad;
      const viewportH = viewportBottom - viewportTop;

      const cardGap = 14;
      const cardH = clamp(Math.round(panelH * 0.22), 150, 188);
      const contentH = cards.length * cardH + Math.max(0, cards.length - 1) * cardGap;
      this.maxScroll = Math.max(0, contentH - viewportH);

      ctx.beginPath();
      ctx.rect(panelX + 1, viewportTop, panelW - 2, viewportH);
      ctx.clip();

      this.cardRects = [];

      let y = viewportTop - this.scrollY;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const x = panelX + innerPad;
        const cw = panelW - innerPad * 2;

        fillRoundRect(ctx, x, y, cw, cardH, 18, "rgba(6,10,18,0.56)");
        strokeRoundRect(ctx, x, y, cw, cardH, 18, card.open ? "rgba(255,170,50,0.72)" : "rgba(255,255,255,0.14)", 1.4);

        const shine = ctx.createLinearGradient(x, y, x + cw, y + cardH);
        shine.addColorStop(0, "rgba(255,160,50,0.05)");
        shine.addColorStop(0.4, "rgba(0,0,0,0)");
        shine.addColorStop(1, "rgba(255,255,255,0.02)");
        fillRoundRect(ctx, x + 1, y + 1, cw - 2, cardH - 2, 17, shine);

        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = `700 ${cardTitleSize}px system-ui, Arial`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(card.title, x + 18, y + 14);

        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = `500 ${cardSubSize}px system-ui, Arial`;
        ctx.fillText(card.subtitle, x + 18, y + 14 + cardTitleSize + 5);

        const btnW = clamp(Math.round(cw * 0.16), 72, 92);
        const btnH = clamp(Math.round(cardH * 0.22), 32, 38);
        const btnX = x + cw - btnW - 14;
        const btnY = y + 14;

        fillRoundRect(
          ctx,
          btnX,
          btnY,
          btnW,
          btnH,
          12,
          card.open ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.08)"
        );
        strokeRoundRect(
          ctx,
          btnX,
          btnY,
          btnW,
          btnH,
          12,
          card.open ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
          1
        );

        ctx.fillStyle = card.open ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.56)";
        ctx.font = `700 ${clamp(Math.round(btnH * 0.34), 11, 14)}px system-ui, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(card.open ? "Açık" : "Kilitli", btnX + btnW / 2, btnY + btnH / 2);

        const descX = x + 18;
        const descY = y + 14 + cardTitleSize + 5 + cardSubSize + 12;
        const descW = cw - 36;
        ctx.fillStyle = "rgba(255,255,255,0.80)";
        ctx.font = `500 ${cardTextSize}px system-ui, Arial`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const lines = wrapLines(ctx, card.desc, descW);
        let lineY = descY;
        const lineH = Math.round(cardTextSize * 1.35);
        for (let li = 0; li < Math.min(lines.length, 3); li++) {
          ctx.fillText(lines[li], descX, lineY);
          lineY += lineH;
        }

        let tagX = x + 18;
        const tagY = y + cardH - 48;
        const tagH = 30;
        ctx.font = `600 12px system-ui, Arial`;
        for (let t = 0; t < card.tags.length; t++) {
          const label = card.tags[t];
          const tw = Math.ceil(ctx.measureText(label).width) + 20;
          if (tagX + tw > x + cw - 18) break;
          fillRoundRect(ctx, tagX, tagY, tw, tagH, 10, "rgba(255,255,255,0.06)");
          strokeRoundRect(ctx, tagX, tagY, tw, tagH, 10, "rgba(255,255,255,0.10)", 1);
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, tagX + tw / 2, tagY + tagH / 2);
          tagX += tw + 8;
        }

        this.cardRects.push({
          card,
          btn: { x: btnX, y: btnY, w: btnW, h: btnH }
        });

        y += cardH + cardGap;
      }

      ctx.restore();

      if (this.maxScroll > 0) {
        const trackW = 4;
        const trackX = panelX + panelW - 8;
        const trackY = viewportTop;
        const trackH = viewportH;
        fillRoundRect(ctx, trackX, trackY, trackW, trackH, 4, "rgba(255,255,255,0.08)");

        const thumbH = Math.max(42, trackH * (viewportH / contentH));
        const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);
        fillRoundRect(ctx, trackX, thumbY, trackW, thumbH, 4, "rgba(255,181,74,0.78)");
      }
    }
  }

  window.PvpScene = PvpScene;

  window.TonCrimePVP = {
    boot() {
      console.log("[TonCrime] PvP booted");
    },
    init() {},
    start() {},
    stop() {},
    reset() {},
    setOpponent() {}
  };
})();
