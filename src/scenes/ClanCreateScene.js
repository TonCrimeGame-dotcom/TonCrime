import { ClanSystem } from "../systems/clan/ClanSystem.js";

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
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.fillStyle = "#0a1020";
    ctx.fillRect(0, 0, w, h);

    this.drawPanel(ctx, 120, 90, w - 240, h - 180, 24, "#121a30");
    this.drawPanel(ctx, 160, 140, w - 320, 340, 18, "#1a2745");

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
