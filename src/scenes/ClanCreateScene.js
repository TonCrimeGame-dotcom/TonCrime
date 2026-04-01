import { ClanSystem } from "../clan/ClanSystem.js";

function rr(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
}
function strokeRR(ctx, x, y, w, h, r, color, line = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
}
function textLine(ctx, text, x, y, maxWidth) {
  const value = String(text || "");
  if (!maxWidth || ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }
  let t = value;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  ctx.fillText(t + "…", x, y);
}
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) {
    ctx.fillText("-", x, y);
    return;
  }
  let line = "";
  let yy = y;
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      textLine(ctx, line, x, yy, maxWidth);
      yy += lineHeight;
      lines += 1;
      line = words[i];
      if (lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) textLine(ctx, line, x, yy, maxWidth);
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function getPointer(input) {
  return input?.pointer || input?.p || input?.mouse || input?.state?.pointer || { x: 0, y: 0 };
}
function justPressed(input) {
  if (typeof input?.justPressed === "function") return !!input.justPressed();
  if (typeof input?.isJustPressed === "function") {
    return !!input.isJustPressed("pointer") || !!input.isJustPressed("mouseLeft") || !!input.isJustPressed("touch");
  }
  return !!input?._justPressed || !!input?.mousePressed;
}
function canvasCssSize(canvas) {
  const rect = canvas?.getBoundingClientRect?.();
  if (rect && rect.width > 0 && rect.height > 0) {
    return { w: Math.round(rect.width), h: Math.round(rect.height) };
  }
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  return {
    w: Math.max(1, Math.round((canvas?.width || 1) / dpr)),
    h: Math.max(1, Math.round((canvas?.height || 1) / dpr)),
  };
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
    this.form = {
      name: "",
      tag: "OTT",
      description: "Şehirde güç kurmak isteyen düzenli ve aktif ekip.",
    };
    this.cost = 50;
    this.focusField = null;
  }

  _lang() {
    const lang = this.i18n?.getLang?.() || this.store?.get?.()?.lang || "tr";
    return lang === "en" ? "en" : "tr";
  }

  _ui(trText, enText) {
    return this._lang() === "en" ? enText : trText;
  }

  onEnter() {
    const s = this.store?.get?.() || {};
    const username = String(s.player?.username || s.player?.name || "").trim();
    if (!this.form.name) this.form.name = username ? `${username} Clan` : this._ui("Yeni Clan", "New Clan");
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
    if (this.scenes && typeof this.scenes.go === "function") this.scenes.go(key);
  }

  bindKeyboard() {
    this._keyHandler = (e) => {
      if (e.key === "1") {
        this.form.name = "OTTOMAN";
        this.form.tag = "OTT";
        this.form.description = this._ui("Şehirde güç kurmak isteyen düzenli ve aktif ekip.", "An organized and active crew building power in the city.");
        return;
      }
      if (e.key === "2") {
        this.form.name = "BLOOD FAM";
        this.form.tag = "BLD";
        this.form.description = this._ui("Güç, saygı ve hız üzerine kurulu sert ekip.", "A hard crew built on power, respect, and speed.");
        return;
      }
      if (e.key === "3") {
        this.form.name = "NIGHT CROWS";
        this.form.tag = "NCR";
        this.form.description = this._ui("Gece operasyonlarında uzman, sessiz ve tehlikeli ekip.", "A silent and dangerous crew specializing in night operations.");
        return;
      }
      if (e.key === "Enter") {
        this.createClan();
        return;
      }
      if (!this.focusField) return;
      if (e.key === "Backspace") {
        this.form[this.focusField] = String(this.form[this.focusField] || "").slice(0, -1);
        return;
      }
      if (e.key.length !== 1) return;
      if (this.focusField === "name") this.form.name = (String(this.form.name || "") + e.key).slice(0, 24);
      if (this.focusField === "tag") this.form.tag = (String(this.form.tag || "") + e.key).toUpperCase().replace(/[^A-Z0-9ÇĞİÖŞÜ]/gi, "").slice(0, 5);
      if (this.focusField === "description") this.form.description = (String(this.form.description || "") + e.key).slice(0, 120);
    };
    window.addEventListener("keydown", this._keyHandler);
  }

  unbindKeyboard() {
    if (this._keyHandler) {
      window.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
  }

  promptEdit(field) {
    const labels = {
      name: this._ui("Clan adını gir", "Enter clan name"),
      tag: this._ui("Clan tag gir (max 5)", "Enter clan tag (max 5)"),
      description: this._ui("Clan açıklaması gir", "Enter clan description"),
    };
    const current = String(this.form[field] || "");
    const next = window.prompt(labels[field], current);
    if (next == null) return;
    if (field === "name") this.form.name = next.trim().slice(0, 24) || current || this._ui("Yeni Clan", "New Clan");
    if (field === "tag") this.form.tag = next.trim().toUpperCase().replace(/[^A-Z0-9ÇĞİÖŞÜ]/gi, "").slice(0, 5) || "TAG";
    if (field === "description") this.form.description = next.trim().slice(0, 120) || this._ui("Yeni clan.", "New clan.");
  }

  createClan() {
    const before = Number(this.store?.get?.()?.coins || 0);
    ClanSystem.createClan(this.store, this.form);
    const afterState = this.store?.get?.() || {};
    if (afterState.clan) {
      this.goScene("clan");
      return;
    }
    const lvl = Number(afterState.player?.level || 1);
    const coins = Number(afterState.coins || 0);
    if (lvl < 10) {
      window.alert(this._ui("Clan kurmak için seviye 10 olmalısın.", "You must be level 10 to create a clan."));
      return;
    }
    if (before < this.cost || coins < this.cost) {
      window.alert(this._ui("Clan kurmak için 50 yTon gerekli.", "50 yTon is required to create a clan."));
    }
  }

  update() {
    const pressed = justPressed(this.input);
    if (!pressed) return;
    const p = getPointer(this.input);
    const px = Number(p.x || 0);
    const py = Number(p.y || 0);
    this.focusField = null;
    for (const btn of this.buttons) {
      if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
        btn.onClick?.();
        return;
      }
    }
  }

  getLayout(ctx) {
    const size = canvasCssSize(ctx.canvas);
    const w = size.w;
    const h = size.h;
    const mobile = w < 760;
    const s = this.store?.get?.() || {};
    const safe = s.ui?.safe || { x: 0, y: 0, w, h };
    const topReserved = Number(s.ui?.hudReservedTop || (mobile ? 82 : 96));
    const bottomReserved = Number(s.ui?.chatReservedBottom || (mobile ? 72 : 84));
    const pad = mobile ? 14 : 28;
    const panelX = safe.x + pad;
    const panelY = Math.max(safe.y + 10, safe.y + topReserved + 8);
    const panelW = safe.w - pad * 2;
    const panelH = safe.h - (panelY - safe.y) - bottomReserved - 10;
    return { mobile, w, h, panelX, panelY, panelW, panelH };
  }

  drawBg(ctx, w, h) {
    const img =
      (typeof this.assets?.getImage === "function" ? this.assets.getImage("clan_bg") : null) ||
      this.assets?.images?.clan_bg ||
      this.assets?.images?.clan ||
      null;
    if (img) {
      const scale = Math.max(w / (img.width || 1), h / (img.height || 1));
      const dw = (img.width || 1) * scale;
      const dh = (img.height || 1) * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#07111f";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = "rgba(2,7,18,0.18)";
    ctx.fillRect(0, 0, w, h);
  }

  render(ctx) {
    const L = this.getLayout(ctx);
    const state = this.store?.get?.() || {};
    const coins = Number(state.coins || 0);
    const canPay = coins >= this.cost;
    const mobile = L.mobile;
    this.buttons = [];

    this.drawBg(ctx, L.w, L.h);

    fillRR(ctx, L.panelX, L.panelY, L.panelW, L.panelH, mobile ? 20 : 28, "rgba(8,18,42,0.46)");
    strokeRR(ctx, L.panelX, L.panelY, L.panelW, L.panelH, mobile ? 20 : 28, "rgba(91,141,255,0.42)", 2);

    const closeSize = mobile ? 36 : 42;
    const closeBtn = {
      x: L.panelX + L.panelW - closeSize - 12,
      y: L.panelY + 12,
      w: closeSize,
      h: closeSize,
      onClick: () => this.goScene("clan"),
    };
    this.buttons.push(closeBtn);
    fillRR(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(0,0,0,0.35)");
    strokeRR(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, 12, "rgba(255,255,255,0.16)", 1);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${mobile ? 22 : 24}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("X", closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const innerX = L.panelX + (mobile ? 16 : 28);
    const innerY = L.panelY + (mobile ? 40 : 56);
    const innerW = L.panelW - (mobile ? 32 : 56);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${mobile ? 24 : 34}px Arial`;
    ctx.fillText(this._ui("CLAN OLUŞTUR", "CREATE CLAN"), innerX, innerY);

    ctx.fillStyle = "#b3c7f6";
    ctx.font = `${mobile ? 15 : 18}px Arial`;
    ctx.fillText(this._ui(`Kurulum bedeli: ${this.cost} yTon`, `Creation cost: ${this.cost} yTon`), innerX, innerY + (mobile ? 28 : 36));
    ctx.fillText(this._ui("Şablon: 1 / 2 / 3", "Template: 1 / 2 / 3"), innerX, innerY + (mobile ? 50 : 62));

    const labelFont = `bold ${mobile ? 15 : 22}px Arial`;
    const valueFont = `${mobile ? 18 : 22}px Arial`;
    const fieldY0 = innerY + (mobile ? 86 : 120);
    const rowGap = mobile ? 74 : 92;
    const fieldH = mobile ? 46 : 52;

    const fields = [
      { key: "name", label: this._ui("Clan Adı", "Clan Name"), value: this.form.name || this._ui("Yeni Clan", "New Clan") },
      { key: "tag", label: "Tag", value: this.form.tag || "TAG" },
      { key: "description", label: this._ui("Açıklama", "Description"), value: this.form.description || this._ui("Yeni clan.", "New clan.") },
    ];

    fields.forEach((field, idx) => {
      const fy = fieldY0 + idx * rowGap;
      ctx.fillStyle = "#ffffff";
      ctx.font = labelFont;
      ctx.fillText(field.label, innerX, fy);
      const box = {
        x: innerX,
        y: fy + 10,
        w: innerW,
        h: field.key === "description" ? fieldH + (mobile ? 34 : 42) : fieldH,
        onClick: () => {
          this.focusField = field.key;
          this.promptEdit(field.key);
        },
      };
      this.buttons.push(box);
      fillRR(ctx, box.x, box.y, box.w, box.h, 16, "rgba(15,32,70,0.56)");
      strokeRR(ctx, box.x, box.y, box.w, box.h, 16, this.focusField === field.key ? "rgba(109,170,255,0.85)" : "rgba(255,255,255,0.14)", 1.5);
      ctx.fillStyle = "#dce7ff";
      ctx.font = valueFont;
      if (field.key === "description") drawWrappedText(ctx, field.value, box.x + 14, box.y + 24, box.w - 28, mobile ? 20 : 24, mobile ? 3 : 4);
      else textLine(ctx, field.value, box.x + 14, box.y + 30, box.w - 28);
    });

    const tipsY = fieldY0 + rowGap * 3 + (mobile ? 26 : 44);
    ctx.fillStyle = "#93b2f0";
    ctx.font = `${mobile ? 14 : 17}px Arial`;
    ctx.fillText(this._ui("Alanlara dokunup düzenleyebilirsin.", "Tap fields to edit them."), innerX, tipsY);

    const btnH = mobile ? 52 : 60;
    const btnGap = mobile ? 12 : 16;
    const btnY = L.panelY + L.panelH - btnH - 18;
    const backW = mobile ? Math.floor(innerW * 0.34) : 180;
    const createW = innerW - backW - btnGap;

    const backBtn = { x: innerX, y: btnY, w: backW, h: btnH, onClick: () => this.goScene("clan") };
    const createBtn = { x: innerX + backW + btnGap, y: btnY, w: createW, h: btnH, onClick: () => this.createClan() };
    this.buttons.push(backBtn, createBtn);

    fillRR(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, 16, "rgba(64,84,132,0.82)");
    fillRR(ctx, createBtn.x, createBtn.y, createBtn.w, createBtn.h, 16, canPay ? "rgba(31,140,94,0.92)" : "rgba(110,74,74,0.92)");
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${mobile ? 18 : 22}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this._ui("GERİ", "BACK"), backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2);
    ctx.fillText(
      canPay ? this._ui(`CLAN KUR • ${this.cost}`, `CREATE CLAN • ${this.cost}`) : this._ui(`${this.cost} YTON GEREK`, `${this.cost} YTON REQUIRED`),
      createBtn.x + createBtn.w / 2,
      createBtn.y + createBtn.h / 2
    );
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}
