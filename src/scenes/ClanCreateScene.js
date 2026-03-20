import { ClanSystem } from "../clan/ClanSystem.js";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pointInRect(px, py, r) {
  return !!r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export class ClanCreateScene {
  constructor({ engine, sceneManager, assets, input, store, i18n, scenes }) {
    this.engine = engine;
    this.sceneManager = sceneManager || scenes;
    this.scenes = scenes || sceneManager;
    this.assets = assets;
    this.input = input;
    this.store = store;
    this.i18n = i18n;

    this.buttons = [];
    this.layout = null;
    this.form = {
      name: "OTTOMAN",
      tag: "OTT",
      description: "Şehirde güç kurmak isteyen düzenli ve aktif ekip.",
    };
  }

  onEnter() {
    this.buttons = [];
    this.bindKeyboard();
  }

  onExit() {
    this.unbindKeyboard();
  }

  goScene(key) {
    if (this.sceneManager && typeof this.sceneManager.go === "function") {
      this.sceneManager.go(key);
      return;
    }
    if (this.scenes && typeof this.scenes.go === "function") {
      this.scenes.go(key);
    }
  }

  getPointer() {
    return (
      this.input?.pointer ||
      this.input?.p ||
      this.input?.mouse ||
      this.input?.state?.pointer ||
      { x: 0, y: 0 }
    );
  }

  isPressed() {
    if (typeof this.input?.justPressed === "function") return !!this.input.justPressed();
    if (typeof this.input?.isJustPressed === "function") {
      return (
        !!this.input.isJustPressed("pointer") ||
        !!this.input.isJustPressed("mouseLeft") ||
        !!this.input.isJustPressed("touch")
      );
    }
    return !!this.input?._justPressed || !!this.input?.mousePressed;
  }

  bindKeyboard() {
    this._keyHandler = (e) => {
      if (e.key === "1") {
        this.form.name = "OTTOMAN";
        this.form.tag = "OTT";
        this.form.description = "Şehirde güç kurmak isteyen düzenli ve aktif ekip.";
      } else if (e.key === "2") {
        this.form.name = "BLOOD FAM";
        this.form.tag = "BLD";
        this.form.description = "Güç, saygı ve hız üzerine kurulu sert ekip.";
      } else if (e.key === "3") {
        this.form.name = "NIGHT CROWS";
        this.form.tag = "NCR";
        this.form.description = "Gece operasyonlarında uzman, sessiz ve tehlikeli ekip.";
      } else if (e.key === "Enter") {
        ClanSystem.createClan(this.store, this.form);
        this.goScene("clan");
      }
    };

    window.addEventListener("keydown", this._keyHandler);
  }

  unbindKeyboard() {
    if (this._keyHandler) {
      window.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
  }

  _getViewport(ctx) {
    const state = this.store?.get?.() || {};
    const safe = state?.ui?.safe;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const fallbackW = Math.max(320, Math.round((ctx.canvas.width || window.innerWidth) / dpr));
    const fallbackH = Math.max(480, Math.round((ctx.canvas.height || window.innerHeight) / dpr));
    const hudReservedTop = Number(state?.ui?.hudReservedTop || 110);
    const chatReservedBottom = Number(state?.ui?.chatReservedBottom || 82);

    const sx = Number.isFinite(Number(safe?.x)) ? Number(safe.x) : 0;
    const sy = Number.isFinite(Number(safe?.y)) ? Number(safe.y) : 0;
    const sw = Number.isFinite(Number(safe?.w)) ? Number(safe.w) : fallbackW;
    const sh = Number.isFinite(Number(safe?.h)) ? Number(safe.h) : fallbackH;

    return {
      x: sx,
      y: sy + hudReservedTop,
      w: sw,
      h: Math.max(260, sh - hudReservedTop - chatReservedBottom - 10),
      fullW: sw,
      fullH: sh,
    };
  }

  _computeLayout(ctx) {
    const view = this._getViewport(ctx);
    const mobile = view.w <= 520;
    const pad = mobile ? 12 : 20;
    const panelX = view.x + pad;
    const panelY = view.y + (mobile ? 4 : 8);
    const panelW = Math.max(280, view.w - pad * 2);
    const panelH = Math.max(320, view.h - (mobile ? 8 : 12));

    const innerPad = mobile ? 14 : 28;
    const titleY = panelY + (mobile ? 30 : 40);
    const helpY = titleY + (mobile ? 28 : 38);
    const fieldLabelX = panelX + innerPad;
    const fieldValueX = mobile ? fieldLabelX : panelX + Math.min(230, panelW * 0.34);
    const fieldValueW = panelW - (fieldValueX - panelX) - innerPad;
    const fieldGap = mobile ? 62 : 58;
    const field1Y = helpY + (mobile ? 50 : 60);

    const templateY = field1Y + fieldGap * 3 + (mobile ? 34 : 22);
    const footerH = mobile ? 54 : 60;
    const buttonGap = mobile ? 10 : 14;
    const backW = mobile ? Math.max(100, Math.floor((panelW - innerPad * 2 - buttonGap) * 0.34)) : 140;
    const createW = panelW - innerPad * 2 - buttonGap - backW;
    const buttonsY = panelY + panelH - innerPad - footerH;

    return {
      mobile,
      panel: { x: panelX, y: panelY, w: panelW, h: panelH },
      titleY,
      helpY,
      fieldLabelX,
      fieldValueX,
      fieldValueW,
      field1Y,
      fieldGap,
      templateY,
      buttons: {
        back: { x: panelX + innerPad, y: buttonsY, w: backW, h: footerH },
        create: { x: panelX + innerPad + backW + buttonGap, y: buttonsY, w: createW, h: footerH },
      },
      contentBottom: buttonsY - 16,
    };
  }

  update() {
    const pointer = this.getPointer();
    const pressed = this.isPressed();
    if (!pressed) return;

    const px = Number(pointer.x || 0);
    const py = Number(pointer.y || 0);

    for (const btn of this.buttons) {
      if (pointInRect(px, py, btn)) {
        btn.onClick?.();
        return;
      }
    }
  }

  render(ctx) {
    const view = this._getViewport(ctx);
    const layout = this._computeLayout(ctx);
    this.layout = layout;

    this.buttons = [
      {
        ...layout.buttons.back,
        id: "back",
        text: "GERİ",
        onClick: () => this.goScene("home"),
      },
      {
        ...layout.buttons.create,
        id: "create",
        text: "CLAN KUR",
        onClick: () => {
          ClanSystem.createClan(this.store, this.form);
          this.goScene("clan");
        },
      },
    ];

    ctx.clearRect(0, 0, view.fullW, view.fullH);
    ctx.fillStyle = "#0a1020";
    ctx.fillRect(0, 0, view.fullW, view.fullH);

    this.drawPanel(ctx, layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h, 24, "#121a30");
    this.drawPanel(ctx, layout.panel.x + 6, layout.panel.y + 6, layout.panel.w - 12, layout.panel.h - 12, 20, "#16213d");

    ctx.fillStyle = "#ffffff";
    ctx.font = `${layout.mobile ? "900 24px" : "900 32px"} Arial`;
    ctx.fillText("CLAN OLUŞTUR", layout.panel.x + 16, layout.titleY);

    ctx.fillStyle = "#9cb2d9";
    ctx.font = `${layout.mobile ? "14px" : "18px"} Arial`;
    this.drawWrappedText(
      ctx,
      "Hazır şablon seçmek için 1 / 2 / 3 tuşlarını kullan. Hızlı oluşturmak için ENTER'a basabilirsin.",
      layout.panel.x + 16,
      layout.helpY,
      layout.panel.w - 32,
      layout.mobile ? 20 : 24
    );

    const labels = [
      { label: "Clan Adı", value: this.form.name },
      { label: "Tag", value: this.form.tag },
      { label: "Açıklama", value: this.form.description },
    ];

    labels.forEach((item, index) => {
      const y = layout.field1Y + layout.fieldGap * index;
      ctx.fillStyle = "#ffffff";
      ctx.font = `${layout.mobile ? "700 16px" : "700 22px"} Arial`;
      ctx.fillText(item.label, layout.fieldLabelX, y);

      ctx.fillStyle = "#d7e2f6";
      ctx.font = `${layout.mobile ? "15px" : "20px"} Arial`;
      this.drawWrappedText(
        ctx,
        item.value,
        layout.fieldValueX,
        y,
        layout.fieldValueW,
        layout.mobile ? 18 : 24
      );
    });

    const chipY = Math.min(layout.templateY, layout.contentBottom - (layout.mobile ? 66 : 34));
    const chipGap = layout.mobile ? 8 : 10;
    const chipW = Math.floor((layout.panel.w - 32 - chipGap * 2) / 3);

    ["1: OTTOMAN", "2: BLOOD FAM", "3: NIGHT CROWS"].forEach((txt, idx) => {
      const cx = layout.panel.x + 16 + idx * (chipW + chipGap);
      this.drawPanel(ctx, cx, chipY, chipW, layout.mobile ? 42 : 46, 14, "#213056");
      ctx.fillStyle = "#cfe0ff";
      ctx.font = `${layout.mobile ? "800 11px" : "800 14px"} Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, cx + chipW / 2, chipY + (layout.mobile ? 21 : 23));
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    });

    for (const btn of this.buttons) {
      this.drawButton(ctx, btn);
    }
  }

  drawButton(ctx, btn) {
    const fill = btn.id === "create" ? "#1d8f5a" : "#2c3d63";
    this.drawPanel(ctx, btn.x, btn.y, btn.w, btn.h, 14, fill);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${btn.h >= 58 ? 20 : 17}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  drawPanel(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
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
