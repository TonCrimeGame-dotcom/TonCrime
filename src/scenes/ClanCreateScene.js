import { ClanSystem } from "../clan/ClanSystem.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function roundRect(ctx, x, y, w, h, r) {
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
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, stroke, lw = 1) {
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function getPointer(input) {
  return input?.pointer || input?.p || input?.mouse || input?.state?.pointer || { x: 0, y: 0, down: false };
}

export class ClanCreateScene {
  constructor({ store, input, i18n, assets, scenes, sceneManager }) {
    this.store = store;
    this.input = input;
    this.i18n = i18n;
    this.assets = assets;
    this.scenes = scenes || sceneManager;

    this.buttons = [];
    this._wasDown = false;
    this.form = {
      name: "OTTOMAN",
      tag: "OTT",
      description: "Şehirde güç kurmak isteyen düzenli ve aktif ekip.",
    };
  }

  enter() { this.onEnter(); }
  exit() { this.onExit(); }

  onEnter() {
    this.buttons = [];
    this._wasDown = false;
  }

  onExit() {
    this._wasDown = false;
  }

  goScene(key) {
    if (this.scenes && typeof this.scenes.go === "function") {
      this.scenes.go(key);
    }
  }

  createClan() {
    try {
      ClanSystem.createClan(this.store, this.form);
    } catch (err) {
      console.error("[ClanCreateScene] createClan error:", err);
      return;
    }
    this.goScene("clan");
  }

  update() {
    if (ClanSystem?.hasClan?.(this.store)) {
      this.goScene("clan");
      return;
    }

    const p = getPointer(this.input);
    const px = Number(p.x || 0);
    const py = Number(p.y || 0);
    const isDown = !!(p.down || this.input?.isDown?.());
    const justUp = !isDown && this._wasDown;

    if (justUp) {
      for (const btn of this.buttons) {
        if (pointInRect(px, py, btn)) {
          btn.onClick?.();
          break;
        }
      }
    }

    this._wasDown = isDown;
  }

  render(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const s = this.store?.get?.() || {};
    const safe = s?.ui?.safe || { x: 0, y: 0, w, h };
    const topReserved = Number(s?.ui?.hudReservedTop || 92);
    const bottomReserved = Number(s?.ui?.chatReservedBottom || 58);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0b0f18";
    ctx.fillRect(0, 0, w, h);

    const padX = clamp(Math.round(safe.w * 0.05), 14, 26);
    const panelX = safe.x + padX;
    const panelY = safe.y + topReserved + 10;
    const panelW = safe.w - padX * 2;
    const panelH = Math.max(280, safe.h - topReserved - bottomReserved - 20);
    const radius = clamp(Math.round(panelW * 0.05), 16, 24);

    fillRoundRect(ctx, panelX, panelY, panelW, panelH, radius, "rgba(14,18,28,0.94)");
    strokeRoundRect(ctx, panelX, panelY, panelW, panelH, radius, "rgba(255,180,74,0.35)", 1.25);

    const inner = clamp(Math.round(panelW * 0.06), 16, 28);
    const titleSize = clamp(Math.round(panelW * 0.08), 22, 34);
    const textSize = clamp(Math.round(panelW * 0.04), 13, 18);
    const smallSize = clamp(Math.round(panelW * 0.035), 11, 15);

    let y = panelY + inner;

    ctx.fillStyle = "#fff";
    ctx.font = `700 ${titleSize}px system-ui, Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Clan Kur", panelX + inner, y);
    y += titleSize + 10;

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = `500 ${textSize}px system-ui, Arial`;
    const info = "Hazır şablon ile tek dokunuşta clan oluştur.";
    ctx.fillText(info, panelX + inner, y);
    y += textSize + 18;

    const boxH = clamp(Math.round(panelH * 0.14), 52, 74);
    const labelW = clamp(Math.round(panelW * 0.24), 88, 120);
    const valueX = panelX + inner + labelW;

    const drawRow = (label, value) => {
      fillRoundRect(ctx, panelX + inner, y, panelW - inner * 2, boxH, 14, "rgba(255,255,255,0.05)");
      strokeRoundRect(ctx, panelX + inner, y, panelW - inner * 2, boxH, 14, "rgba(255,255,255,0.10)", 1);
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = `600 ${smallSize}px system-ui, Arial`;
      ctx.fillText(label, panelX + inner + 14, y + 12);
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${textSize}px system-ui, Arial`;
      ctx.fillText(value, valueX, y + 10);
      y += boxH + 12;
    };

    drawRow("Clan Adı", this.form.name);
    drawRow("Etiket", this.form.tag);

    const descH = clamp(Math.round(panelH * 0.22), 80, 120);
    fillRoundRect(ctx, panelX + inner, y, panelW - inner * 2, descH, 14, "rgba(255,255,255,0.05)");
    strokeRoundRect(ctx, panelX + inner, y, panelW - inner * 2, descH, 14, "rgba(255,255,255,0.10)", 1);
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = `600 ${smallSize}px system-ui, Arial`;
    ctx.fillText("Açıklama", panelX + inner + 14, y + 12);
    ctx.fillStyle = "#fff";
    ctx.font = `500 ${smallSize}px system-ui, Arial`;
    this.drawWrappedText(ctx, this.form.description, panelX + inner + 14, y + 34, panelW - inner * 2 - 28, smallSize + 6);
    y += descH + 16;

    const btnH = clamp(Math.round(panelH * 0.11), 44, 56);
    const gap = 12;
    const btnW = Math.floor((panelW - inner * 2 - gap) / 2);
    const btnY = Math.min(panelY + panelH - inner - btnH, y);

    this.buttons = [
      {
        id: "back",
        x: panelX + inner,
        y: btnY,
        w: btnW,
        h: btnH,
        onClick: () => this.goScene("home"),
      },
      {
        id: "create",
        x: panelX + inner + btnW + gap,
        y: btnY,
        w: btnW,
        h: btnH,
        onClick: () => this.createClan(),
      },
    ];

    for (const btn of this.buttons) {
      const fill = btn.id === "create" ? "rgba(29,143,90,0.95)" : "rgba(44,61,99,0.95)";
      fillRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, fill);
      strokeRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 14, "rgba(255,255,255,0.16)", 1);
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${clamp(Math.round(btnH * 0.34), 14, 18)}px system-ui, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btn.id === "create" ? "Clan Kur" : "Geri", btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    let line = "";
    let yy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line ? `${line} ${words[i]}` : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = words[i];
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }
}
