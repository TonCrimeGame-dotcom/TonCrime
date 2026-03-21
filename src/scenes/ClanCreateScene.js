import { ClanSystem } from "../clan/ClanSystem.js";

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
    this.form = {
      name: "OTTOMAN",
      tag: "OTT",
      description: "Şehirde güç kurmak isteyen düzenli ve aktif ekip.",
    };
  }

  onEnter() {
    this.buttons = [
      {
        id: "back",
        text: "GERİ",
        x: 40,
        y: 40,
        w: 140,
        h: 46,
        onClick: () => this.goScene("home"),
      },
      {
        id: "create",
        text: "CLAN KUR",
        x: 360,
        y: 560,
        w: 280,
        h: 60,
        onClick: () => {
          ClanSystem.createClan(this.store, this.form);
          this.goScene("clan");
        },
      },
    ];

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

  update() {
    const pointer = this.getPointer();
    const pressed = this.isPressed();
    if (!pressed) return;

    const px = Number(pointer.x || 0);
    const py = Number(pointer.y || 0);

    for (const btn of this.buttons) {
      if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
        btn.onClick?.();
        return;
      }
    }
  }

  render(ctx) {
    const rect = ctx.canvas?.getBoundingClientRect?.();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = rect?.width ? Math.round(rect.width) : Math.round((ctx.canvas.width || 1) / dpr);
    const h = rect?.height ? Math.round(rect.height) : Math.round((ctx.canvas.height || 1) / dpr);
    const mobile = w < 760;

    ctx.fillStyle = "#0a1020";
    ctx.fillRect(0, 0, w, h);

    this.buttons = [];

    if (mobile) {
      const pad = 14;
      const top = 86;
      const cardX = pad;
      const cardY = top;
      const cardW = w - pad * 2;
      const cardH = Math.max(420, h - top - 96);

      this.drawPanel(ctx, cardX, cardY, cardW, cardH, 20, "#121a30");
      this.drawPanel(ctx, cardX + 12, cardY + 12, cardW - 24, cardH - 88, 18, "#1a2745");

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px Arial";
      ctx.fillText("CLAN OLUŞTUR", cardX + 26, cardY + 48);

      ctx.fillStyle = "#9cb2d9";
      ctx.font = "14px Arial";
      ctx.fillText("Şablon: 1 / 2 / 3", cardX + 26, cardY + 78);
      ctx.fillText("Hızlı oluşturma: ENTER", cardX + 26, cardY + 100);

      const labelX = cardX + 26;
      const valueX = cardX + 26;
      let cy = cardY + 148;

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Arial";
      ctx.fillText("Clan Adı", labelX, cy);
      ctx.fillStyle = "#d7e2f6";
      ctx.font = "18px Arial";
      this.drawWrappedText(ctx, this.form.name, valueX, cy + 28, cardW - 52, 22);

      cy += 74;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Arial";
      ctx.fillText("Tag", labelX, cy);
      ctx.fillStyle = "#d7e2f6";
      ctx.font = "18px Arial";
      ctx.fillText(this.form.tag, valueX, cy + 28);

      cy += 68;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Arial";
      ctx.fillText("Açıklama", labelX, cy);
      ctx.fillStyle = "#d7e2f6";
      ctx.font = "16px Arial";
      this.drawWrappedText(ctx, this.form.description, valueX, cy + 28, cardW - 52, 24);

      const presetY = cardY + cardH - 128;
      ctx.fillStyle = "#7fa1d8";
      ctx.font = "13px Arial";
      ctx.fillText("1: OTTOMAN", cardX + 26, presetY);
      ctx.fillText("2: BLOOD FAM", cardX + 26, presetY + 20);
      ctx.fillText("3: NIGHT CROWS", cardX + 26, presetY + 40);

      const backBtn = { id: "back", text: "GERİ", x: cardX + 18, y: cardY + cardH - 74, w: Math.floor((cardW - 48) * 0.34), h: 44, onClick: () => this.goScene("home") };
      const createBtn = { id: "create", text: "CLAN KUR", x: backBtn.x + backBtn.w + 12, y: backBtn.y, w: cardW - 48 - backBtn.w - 12, h: 44, onClick: () => { ClanSystem.createClan(this.store, this.form); this.goScene("clan"); } };
      this.buttons.push(backBtn, createBtn);
    } else {
      const outerX = 120;
      const outerY = 90;
      const outerW = w - 240;
      const outerH = h - 180;
      const innerX = 160;
      const innerY = 140;
      const innerW = w - 320;
      const innerH = 340;

      this.drawPanel(ctx, outerX, outerY, outerW, outerH, 24, "#121a30");
      this.drawPanel(ctx, innerX, innerY, innerW, innerH, 18, "#1a2745");

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 34px Arial";
      ctx.fillText("CLAN OLUŞTUR", 190, 195);

      ctx.fillStyle = "#9cb2d9";
      ctx.font = "20px Arial";
      ctx.fillText("Hazır şablon seçmek için 1 / 2 / 3 tuşlarını kullan.", 190, 235);
      ctx.fillText("Hızlı oluşturmak için ENTER'a basabilirsin.", 190, 265);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px Arial";
      ctx.fillText("Clan Adı", 190, 330);
      ctx.fillText("Tag", 190, 390);
      ctx.fillText("Açıklama", 190, 450);

      ctx.fillStyle = "#d7e2f6";
      ctx.font = "22px Arial";
      ctx.fillText(this.form.name, 390, 330);
      ctx.fillText(this.form.tag, 390, 390);
      this.drawWrappedText(ctx, this.form.description, 390, 450, 420, 30);

      ctx.fillStyle = "#7fa1d8";
      ctx.font = "18px Arial";
      ctx.fillText("1: OTTOMAN", 190, 520);
      ctx.fillText("2: BLOOD FAM", 360, 520);
      ctx.fillText("3: NIGHT CROWS", 560, 520);

      this.buttons.push(
        { id: "back", text: "GERİ", x: 40, y: 40, w: 140, h: 46, onClick: () => this.goScene("home") },
        { id: "create", text: "CLAN KUR", x: 360, y: 560, w: 280, h: 60, onClick: () => { ClanSystem.createClan(this.store, this.form); this.goScene("clan"); } }
      );
    }

    for (const btn of this.buttons) {
      this.drawButton(ctx, btn);
    }
  }

  drawButton(ctx, btn) {
    const fill = btn.id === "create" ? "#1d8f5a" : "#2c3d63";
    this.drawPanel(ctx, btn.x, btn.y, btn.w, btn.h, 14, fill);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px Arial";
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
    const words = String(text || "").split(" ");
    let line = "";
    let yy = y;

    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + " ";
      if (ctx.measureText(test).width > maxWidth && i > 0) {
        ctx.fillText(line, x, yy);
        line = words[i] + " ";
        yy += lineHeight;
      } else {
        line = test;
      }
    }

    if (line) ctx.fillText(line, x, yy);
  }
}
