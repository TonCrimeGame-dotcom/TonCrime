function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

export class MissionsScene {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;

    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScroll = 0;
    this.moved = 0;
    this.clickCandidate = false;

    this.hit = [];
  }

  onEnter() {
    this.scrollY = 0;
    this.maxScroll = 0;
    this.dragging = false;
    this.hit = [];
  }

  onExit() {}

  _daily() {
    const s = this.store.get();
    return s.dailyLogin || {
      lastClaimDay: null,
      streak: 0,
      totalClaims: 0,
      lastRewardText: "",
      rewardToastUntil: 0,
      got30DayWeapon: false,
    };
  }

  _todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  _safeRect() {
    const safe = this.store.get()?.ui?.safe;
    if (safe && Number.isFinite(safe.w) && Number.isFinite(safe.h)) return safe;
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  }

  _getBg() {
    if (typeof this.assets.getImage === "function") {
      return this.assets.getImage("missions") || this.assets.getImage("background");
    }
    if (typeof this.assets.get === "function") {
      return this.assets.get("missions") || this.assets.get("background");
    }
    return this.assets.images?.missions || this.assets.images?.background || null;
  }

  update() {
    const px = this.input.pointer?.x || 0;
    const py = this.input.pointer?.y || 0;

    if (this.input.justPressed()) {
      this.dragging = true;
      this.downY = py;
      this.startScroll = this.scrollY;
      this.moved = 0;
      this.clickCandidate = true;
    }

    if (this.dragging && this.input.isDown()) {
      const dy = py - this.downY;
      this.scrollY = clamp(this.startScroll - dy, 0, this.maxScroll);
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 10) this.clickCandidate = false;
    }

    if (this.dragging && this.input.justReleased()) {
      this.dragging = false;

      if (!this.clickCandidate) return;

      for (const h of this.hit) {
        if (pointInRect(px, py, h.rect)) {
          if (h.type === "back") {
            this.scenes.go("home");
            return;
          }
        }
      }
    }
  }

  render(ctx) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.floor(ctx.canvas.width / dpr);
    const H = Math.floor(ctx.canvas.height / dpr);
    const safe = this._safeRect();
    const bg = this._getBg();

    ctx.clearRect(0, 0, W, H);

    if (bg) {
      const iw = bg.width || 1;
      const ih = bg.height || 1;
      const scale = Math.max(W / iw, H / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.fillRect(0, 0, W, H);

    const panelX = safe.x + 12;
    const panelY = Math.max(74, safe.y + 74);
    const panelW = safe.w - 24;
    const panelH = safe.h - 148;

    ctx.fillStyle = "rgba(0,0,0,0.56)";
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, 18);

    const backRect = { x: panelX + 14, y: panelY + 12, w: 78, h: 30 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    fillRoundRect(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    strokeRoundRect(ctx, backRect.x + 0.5, backRect.y + 0.5, backRect.w - 1, backRect.h - 1, 10);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 12px system-ui";
    ctx.fillText("Geri", backRect.x + backRect.w / 2, backRect.y + backRect.h / 2);
    this.hit = [{ type: "back", rect: backRect }];

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "900 20px system-ui";
    ctx.fillText("Görevler", panelX + 16, panelY + 64);

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "12px system-ui";
    ctx.fillText("Günlük giriş bonusu ve görev takibi", panelX + 16, panelY + 84);

    const listX = panelX + 12;
    const listY = panelY + 100;
    const listW = panelW - 24;
    const listH = panelH - 112;

    const daily = this._daily();
    const streak = Number(daily.streak || 0);
    const claimedToday = daily.lastClaimDay === this._todayKey();

    const blocks = [];

    blocks.push({ type: "summary", h: 134 });
    blocks.push({ type: "title", h: 30, text: "7 Günlük Giriş Takvimi" });
    blocks.push({ type: "grid7", h: 210 });
    blocks.push({ type: "title", h: 30, text: "30 Gün Büyük Ödül" });
    blocks.push({ type: "reward30", h: 112 });
    blocks.push({ type: "title", h: 30, text: "Yakında Gelecek Görevler" });
    blocks.push({ type: "task", h: 68, title: "Reklam İzle", desc: "Günlük reklam görevleri eklenecek." });
    blocks.push({ type: "task", h: 68, title: "Arkadaş Davet Et", desc: "Davet ödülleri görev paneline bağlanacak." });
    blocks.push({ type: "task", h: 68, title: "PvP Oyna", desc: "Günlük PvP görevleri eklenecek." });
    blocks.push({ type: "task", h: 68, title: "Enerji Doldur", desc: "Mekanlardan enerji doldurma görevleri eklenecek." });

    const gap = 10;
    const contentH = blocks.reduce((a, b) => a + b.h, 0) + (blocks.length - 1) * gap + 10;
    this.maxScroll = Math.max(0, contentH - listH);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(listX, listY, listW, listH);
    ctx.clip();

    let y = listY + 4 - this.scrollY;

    for (const block of blocks) {
      if (block.type === "summary") {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, listX, y, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 16);

        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = "900 14px system-ui";
        ctx.fillText("Günlük Giriş Bonus Durumu", listX + 14, y + 22);

        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = "12px system-ui";
        ctx.fillText(`Bugün ödül: ${claimedToday ? "Alındı" : "Hazır"}`, listX + 14, y + 48);
        ctx.fillText(`Aktif seri: ${streak} gün`, listX + 14, y + 68);
        ctx.fillText(`7. gün ödülü: toplam 100 yton`, listX + 14, y + 88);
        ctx.fillText(`30. gün ödülü: HK MP5`, listX + 14, y + 108);

        const pillW = 132;
        const pillH = 34;
        const pillX = listX + listW - pillW - 14;
        const pillY = y + 46;
        ctx.fillStyle = claimedToday ? "rgba(31,111,42,0.85)" : "rgba(242,211,107,0.18)";
        fillRoundRect(ctx, pillX, pillY, pillW, pillH, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        strokeRoundRect(ctx, pillX + 0.5, pillY + 0.5, pillW - 1, pillH - 1, 12);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 12px system-ui";
        ctx.fillText(claimedToday ? "Bugün Alındı" : "Bugün Hazır", pillX + pillW / 2, pillY + pillH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }

      if (block.type === "title") {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = "900 14px system-ui";
        ctx.fillText(block.text, listX + 2, y + 22);
      }

      if (block.type === "grid7") {
        const cols = 4;
        const cellGap = 10;
        const cellW = Math.floor((listW - cellGap * (cols - 1)) / cols);
        const cellH = 92;

        for (let i = 0; i < 7; i++) {
          const day = i + 1;
          const row = Math.floor(i / cols);
          const col = i % cols;

          const cx = listX + col * (cellW + cellGap);
          const cy = y + row * (cellH + cellGap);

          const done = streak >= day;
          const isTodayTarget = streak + 1 === day && !claimedToday;
          const is7 = day === 7;

          ctx.fillStyle = done
            ? "rgba(31,111,42,0.80)"
            : isTodayTarget
            ? "rgba(242,211,107,0.18)"
            : "rgba(255,255,255,0.07)";
          fillRoundRect(ctx, cx, cy, cellW, cellH, 14);
          ctx.strokeStyle = is7 ? "rgba(242,211,107,0.42)" : "rgba(255,255,255,0.12)";
          strokeRoundRect(ctx, cx + 0.5, cy + 0.5, cellW - 1, cellH - 1, 14);

          ctx.fillStyle = "#fff";
          ctx.font = "900 13px system-ui";
          ctx.fillText(`Gün ${day}`, cx + 10, cy + 20);

          ctx.fillStyle = "rgba(255,255,255,0.78)";
          ctx.font = "12px system-ui";
          if (day === 7) {
            ctx.fillText("+40 yton", cx + 10, cy + 46);
            ctx.fillText("Toplam 100", cx + 10, cy + 66);
          } else {
            ctx.fillText("+10 yton", cx + 10, cy + 56);
          }

          if (done) {
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.font = "900 18px system-ui";
            ctx.fillText("✓", cx + cellW - 22, cy + 24);
          }
        }
      }

      if (block.type === "reward30") {
        const got30 = !!daily.got30DayWeapon;

        ctx.fillStyle = got30 ? "rgba(31,111,42,0.78)" : "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, listX, y, listW, block.h, 16);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 16);

        ctx.fillStyle = "#fff";
        ctx.font = "900 14px system-ui";
        ctx.fillText("30 gün kesintisiz giriş", listX + 14, y + 24);

        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = "12px system-ui";
        ctx.fillText("Ödül: HK MP5 (hafif makineli silah)", listX + 14, y + 50);
        ctx.fillText(`İlerleme: ${Math.min(streak, 30)}/30`, listX + 14, y + 72);
        ctx.fillText(got30 ? "Durum: Alındı" : "Durum: Bekliyor", listX + 14, y + 92);

        const barX = listX + listW - 150;
        const barY = y + 42;
        const barW = 120;
        const barH = 14;
        const pct = clamp(Math.min(streak, 30) / 30, 0, 1);

        ctx.fillStyle = "rgba(255,255,255,0.08)";
        fillRoundRect(ctx, barX, barY, barW, barH, 8);
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        fillRoundRect(ctx, barX, barY, Math.max(8, barW * pct), barH, 8);
      }

      if (block.type === "task") {
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        fillRoundRect(ctx, listX, y, listW, block.h, 14);
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        strokeRoundRect(ctx, listX + 0.5, y + 0.5, listW - 1, block.h - 1, 14);

        ctx.fillStyle = "#fff";
        ctx.font = "900 13px system-ui";
        ctx.fillText(block.title, listX + 14, y + 24);

        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = "12px system-ui";
        ctx.fillText(block.desc, listX + 14, y + 48);
      }

      y += block.h + gap;
    }

    ctx.restore();

    if (this.maxScroll > 0) {
      const trackX = panelX + panelW - 6;
      const trackY = listY;
      const trackH = listH;
      const thumbH = Math.max(36, (listH / contentH) * trackH);
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);

      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(trackX, trackY, 3, trackH);
      ctx.fillStyle = "rgba(255,255,255,0.34)";
      ctx.fillRect(trackX, thumbY, 3, thumbH);
    }
  }
}
