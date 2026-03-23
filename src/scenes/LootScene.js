
import {
  getWheelRewards,
  rollCrateReward,
  applyLootReward,
  isFreeSpinReady,
  getInventoryCount,
  consumeInventoryCrate,
  formatRewardText,
} from "../loot/LootTables.js";

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

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function rarityColor(r) {
  switch (String(r || "").toLowerCase()) {
    case "common": return "#a0aec0";
    case "rare": return "#61a8ff";
    case "epic": return "#ca78ff";
    case "legendary": return "#ffcc66";
    default: return "#9ca3af";
  }
}

function crateName(kind) {
  return kind === "legendary" ? "Legendary Crate" : "Mystery Crate";
}

function drawStarburst(ctx, cx, cy, radius, count, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(255,212,120,${alpha})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (radius * 0.36), Math.sin(a) * (radius * 0.36));
    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    ctx.stroke();
  }
  ctx.restore();
}

export class LootScene {
  constructor({ store, input, assets, scenes }) {
    this.store = store;
    this.input = input;
    this.assets = assets;
    this.scenes = scenes;

    this.hitButtons = [];
    this.toast = { text: "", until: 0 };
    this.state = this._makeState();
  }

  _makeState() {
    return {
      screen: "lobby",
      wheelKind: "free",
      wheelRewards: [],
      wheelSelectedIndex: 0,
      wheelStartAt: 0,
      wheelDuration: 0,
      wheelStartAngle: 0,
      wheelEndAngle: 0,
      wheelAngle: 0,
      wheelRewardGranted: false,
      wheelResult: null,

      crateKind: "mystery",
      cratePhase: "closed",
      crateStartAt: 0,
      crateDuration: 0,
      crateReward: null,
      crateResultGranted: false,
      crateReelItems: [],
      crateReelOffset: 0,
      crateReelFrom: 0,
      crateReelTo: 0,

      introPulse: 0,
    };
  }

  onEnter(data = {}) {
    this.hitButtons = [];
    this.state = this._makeState();
    this._entry = data || {};
    const mode = data.mode || "lobby";

    if (mode === "free_wheel") this._enterWheel("free");
    else if (mode === "premium_wheel") this._enterWheel("premium");
    else if (mode === "buy_open_mystery") this._buyAndOpenCrate("mystery");
    else if (mode === "buy_open_legendary") this._buyAndOpenCrate("legendary");
    else if (mode === "open_mystery") this._openInventoryCrate("mystery");
    else if (mode === "open_legendary") this._openInventoryCrate("legendary");
  }

  _showToast(text, ms = 1600) {
    this.toast = { text: String(text || ""), until: Date.now() + ms };
  }

  _goBack() {
    try {
      this.scenes.go("trade", { tab: "loot" });
    } catch (_) {
      try { this.scenes.go("home"); } catch (_) {}
    }
  }

  _buyAndOpenCrate(kind) {
    const s = this.store.get();
    const cost = kind === "legendary" ? 140 : 65;
    if (Number(s.coins || 0) < cost) {
      this._showToast("Yetersiz yton");
      this.state.screen = "lobby";
      return;
    }
    this.store.set({ coins: Number(s.coins || 0) - cost });
    this._startCrateFlow(kind);
  }

  _openInventoryCrate(kind) {
    const ok = consumeInventoryCrate(this.store, crateName(kind));
    if (!ok) {
      this._showToast("Envanterde sandık yok");
      this.state.screen = "lobby";
      return;
    }
    this._startCrateFlow(kind);
  }

  _startCrateFlow(kind) {
    this.state.screen = "crate";
    this.state.crateKind = kind;
    this.state.cratePhase = "closed";
    this.state.crateStartAt = Date.now();
    this.state.crateDuration = 0;
    this.state.crateResultGranted = false;
    this.state.crateReward = rollCrateReward(kind);
    this.state.crateReelItems = this._buildCrateReel(this.state.crateReward, kind);
    this.state.crateReelOffset = 0;
    this.state.crateReelFrom = 0;
    this.state.crateReelTo = 0;
  }

  _buildCrateReel(targetReward, kind) {
    const items = [];
    const bank = [];
    for (let i = 0; i < 30; i += 1) bank.push(rollCrateReward(kind));
    const targetSlot = 20;
    for (let i = 0; i < 28; i += 1) {
      items.push(i === targetSlot ? { ...targetReward, item: targetReward.item ? { ...targetReward.item } : undefined } : bank[i % bank.length]);
    }
    items.targetSlot = targetSlot;
    return items;
  }

  _enterWheel(kind) {
    const s = this.store.get();
    if (kind === "free" && !isFreeSpinReady(this.store)) {
      this._showToast("Günlük ücretsiz çark kullanıldı");
      this.state.screen = "lobby";
      return;
    }
    if (kind === "premium") {
      const cost = 90;
      if (Number(s.coins || 0) < cost) {
        this._showToast("Premium çark için yetersiz yton");
        this.state.screen = "lobby";
        return;
      }
      this.store.set({ coins: Number(s.coins || 0) - cost });
    }

    const rewards = getWheelRewards(kind);
    const index = Math.floor(Math.random() * rewards.length);
    const seg = (Math.PI * 2) / rewards.length;
    const desiredCenter = -Math.PI / 2;
    const selectedCenter = (-Math.PI / 2) + index * seg + seg / 2;
    const extraSpins = kind === "premium" ? 8 : 6;
    const endAngle = extraSpins * Math.PI * 2 + (desiredCenter - selectedCenter);

    this.state.screen = "wheel";
    this.state.wheelKind = kind;
    this.state.wheelRewards = rewards;
    this.state.wheelSelectedIndex = index;
    this.state.wheelStartAt = Date.now();
    this.state.wheelDuration = kind === "premium" ? 4600 : 3600;
    this.state.wheelStartAngle = 0;
    this.state.wheelEndAngle = endAngle;
    this.state.wheelAngle = 0;
    this.state.wheelRewardGranted = false;
    this.state.wheelResult = rewards[index];
  }

  _grantWheelReward() {
    if (this.state.wheelRewardGranted) return;
    applyLootReward(this.store, this.state.wheelResult, { freeSpinUsed: this.state.wheelKind === "free" });
    this.state.wheelRewardGranted = true;
    this._showToast(`Kazandın: ${formatRewardText(this.state.wheelResult)}`, 2200);
  }

  _grantCrateReward() {
    if (this.state.crateResultGranted) return;
    applyLootReward(this.store, this.state.crateReward);
    this.state.crateResultGranted = true;
    this._showToast(`Sandık ödülü: ${formatRewardText(this.state.crateReward)}`, 2200);
  }

  _tickAnimations() {
    const now = Date.now();
    const s = this.state;
    s.introPulse = (Math.sin(now / 280) + 1) * 0.5;

    if (s.screen === "wheel" && s.wheelStartAt > 0) {
      const t = clamp((now - s.wheelStartAt) / Math.max(1, s.wheelDuration), 0, 1);
      const eased = easeOutExpo(t);
      s.wheelAngle = s.wheelStartAngle + (s.wheelEndAngle - s.wheelStartAngle) * eased;
      if (t >= 1 && !s.wheelRewardGranted) this._grantWheelReward();
    }

    if (s.screen === "crate" && s.cratePhase === "opening") {
      const t = clamp((now - s.crateStartAt) / Math.max(1, s.crateDuration), 0, 1);
      if (t >= 1) {
        s.cratePhase = "reel";
        s.crateStartAt = now;
        s.crateDuration = 3400;
        const slotW = 96;
        const target = s.crateReelItems.targetSlot || 20;
        s.crateReelFrom = 0;
        s.crateReelTo = target * slotW - slotW * 1.5;
      }
    }

    if (s.screen === "crate" && s.cratePhase === "reel") {
      const t = clamp((now - s.crateStartAt) / Math.max(1, s.crateDuration), 0, 1);
      const eased = easeOutCubic(t);
      s.crateReelOffset = s.crateReelFrom + (s.crateReelTo - s.crateReelFrom) * eased;
      if (t >= 1) {
        s.cratePhase = "reveal";
        this._grantCrateReward();
      }
    }
  }

  update() {
    this._tickAnimations();
    const ptr = this.input?.pointer || { x: 0, y: 0 };
    if (!this.input?.justReleased?.()) return;

    for (let i = this.hitButtons.length - 1; i >= 0; i -= 1) {
      const h = this.hitButtons[i];
      if (!pointInRect(ptr.x, ptr.y, h.rect)) continue;
      switch (h.action) {
        case "back":
          this._goBack();
          return;
        case "enter_free_wheel":
          this._enterWheel("free");
          return;
        case "enter_premium_wheel":
          this._enterWheel("premium");
          return;
        case "buy_open_crate":
          this._buyAndOpenCrate(h.kind);
          return;
        case "open_inventory_crate":
          this._openInventoryCrate(h.kind);
          return;
        case "confirm_wheel":
          this.state.screen = "lobby";
          return;
        case "confirm_crate":
          this.state.screen = "lobby";
          return;
        case "tap_chest":
          if (this.state.cratePhase === "closed") {
            this.state.cratePhase = "opening";
            this.state.crateStartAt = Date.now();
            this.state.crateDuration = 900;
          }
          return;
        default:
          return;
      }
    }
  }

  _drawButton(ctx, rect, text, style = "ghost") {
    let fill = "rgba(255,255,255,0.06)";
    let stroke = "rgba(255,255,255,0.12)";
    let txt = "rgba(255,255,255,0.92)";
    if (style === "primary") {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, "rgba(78,129,255,0.96)");
      g.addColorStop(1, "rgba(48,86,210,0.96)");
      fill = g; stroke = "rgba(255,255,255,0.28)";
    } else if (style === "gold") {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, "rgba(255,210,120,0.96)");
      g.addColorStop(1, "rgba(196,122,22,0.96)");
      fill = g; txt = "#201305"; stroke = "rgba(255,255,255,0.25)";
    }
    ctx.fillStyle = fill;
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);
    ctx.fillStyle = txt;
    ctx.font = "800 13px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  _drawHeader(ctx, panelX, panelY, panelW) {
    const back = { x: panelX + 12, y: panelY + 12, w: 44, h: 36 };
    this.hitButtons.push({ rect: back, action: "back" });
    this._drawButton(ctx, back, "←", "ghost");

    ctx.fillStyle = "#fff";
    ctx.font = "900 24px system-ui";
    ctx.fillText("Sandık & Çark", panelX + 72, panelY + 38);
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "13px system-ui";
    ctx.fillText("Animasyonlu loot odası • ödüller ayrı modülden yönetilir", panelX + 72, panelY + 58);

    const s = this.store.get();
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "800 14px system-ui";
    ctx.fillText(`${fmtNum(s.coins || 0)} YTON`, panelX + panelW - 18, panelY + 38);
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "12px system-ui";
    ctx.fillText(`Enerji ${fmtNum(s.player?.energy || 0)}/${fmtNum(s.player?.energyMax || 0)}`, panelX + panelW - 18, panelY + 56);
    ctx.textAlign = "left";
  }

  _drawLobby(ctx, x, y, w) {
    const freeReady = isFreeSpinReady(this.store);
    const mysteryCount = getInventoryCount(this.store, "Mystery Crate");
    const legendaryCount = getInventoryCount(this.store, "Legendary Crate");

    const hero = { x, y, w, h: 116 };
    const hg = ctx.createLinearGradient(x, y, x + w, y + hero.h);
    hg.addColorStop(0, "rgba(87,45,140,0.92)");
    hg.addColorStop(1, "rgba(18,12,36,0.92)");
    ctx.fillStyle = hg;
    fillRoundRect(ctx, x, y, w, hero.h, 24);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, x, y, w, hero.h, 24);
    ctx.fillStyle = "#fff";
    ctx.font = "900 22px system-ui";
    ctx.fillText("Canlı Loot Odası", x + 18, y + 34);
    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "13px system-ui";
    ctx.fillText("Çark gerçek bir çember. Sandık ise tek sıra slot gibi akar ve durur.", x + 18, y + 56);
    ctx.fillText("Ödül listelerini src/loot/LootTables.js içinden kolayca değiştirebilirsin.", x + 18, y + 76);

    const freeBtn = { x: x + 18, y: y + 84, w: 140, h: 26 };
    const premiumBtn = { x: x + 166, y: y + 84, w: 154, h: 26 };
    this.hitButtons.push({ rect: freeBtn, action: "enter_free_wheel" });
    this.hitButtons.push({ rect: premiumBtn, action: "enter_premium_wheel" });
    this._drawButton(ctx, freeBtn, freeReady ? "Ücretsiz Çark" : "Yarın Hazır", freeReady ? "primary" : "ghost");
    this._drawButton(ctx, premiumBtn, "Premium Çark • 90", "gold");

    y += 132;

    const left = { x, y, w: Math.floor((w - 10) / 2), h: 176 };
    const right = { x: x + Math.floor((w - 10) / 2) + 10, y, w: Math.floor((w - 10) / 2), h: 176 };
    const cards = [
      { rect: left, kind: "mystery", icon: "📦", title: "Mystery Crate", subtitle: `${mysteryCount} adet envanterde`, cost: 65 },
      { rect: right, kind: "legendary", icon: "👑", title: "Legendary Crate", subtitle: `${legendaryCount} adet envanterde`, cost: 140 },
    ];

    for (const card of cards) {
      const g = ctx.createLinearGradient(card.rect.x, card.rect.y, card.rect.x + card.rect.w, card.rect.y + card.rect.h);
      g.addColorStop(0, card.kind === "legendary" ? "rgba(112,74,12,0.90)" : "rgba(18,42,82,0.90)");
      g.addColorStop(1, "rgba(10,12,20,0.94)");
      ctx.fillStyle = g;
      fillRoundRect(ctx, card.rect.x, card.rect.y, card.rect.w, card.rect.h, 22);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx, card.rect.x, card.rect.y, card.rect.w, card.rect.h, 22);
      ctx.fillStyle = "#fff";
      ctx.font = "900 26px system-ui";
      ctx.fillText(card.icon, card.rect.x + 16, card.rect.y + 34);
      ctx.font = "900 18px system-ui";
      ctx.fillText(card.title, card.rect.x + 16, card.rect.y + 64);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "13px system-ui";
      ctx.fillText(card.subtitle, card.rect.x + 16, card.rect.y + 88);
      ctx.fillText(`Satın al & aç: ${card.cost} YTON`, card.rect.x + 16, card.rect.y + 108);

      const b1 = { x: card.rect.x + 14, y: card.rect.y + 124, w: card.rect.w - 28, h: 20 };
      const b2 = { x: card.rect.x + 14, y: card.rect.y + 148, w: card.rect.w - 28, h: 20 };
      this.hitButtons.push({ rect: b1, action: "buy_open_crate", kind: card.kind });
      this.hitButtons.push({ rect: b2, action: "open_inventory_crate", kind: card.kind });
      this._drawButton(ctx, b1, `Satın Al & Aç`, card.kind === "legendary" ? "gold" : "primary");
      this._drawButton(ctx, b2, `Envanterden Aç`, "ghost");
    }
  }

  _drawWheel(ctx, x, y, w, h) {
    const s = this.state;
    const cx = x + w * 0.5;
    const cy = y + h * 0.46;
    const radius = Math.min(w, h) * 0.3;
    const rewards = s.wheelRewards;
    const seg = (Math.PI * 2) / rewards.length;

    drawStarburst(ctx, cx, cy, radius + 22 + s.introPulse * 12, 18, 0.12 + s.introPulse * 0.08);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.wheelAngle);

    for (let i = 0; i < rewards.length; i += 1) {
      const a0 = -Math.PI / 2 + i * seg;
      const a1 = a0 + seg;
      const reward = rewards[i];
      const glow = reward.glow || (reward.type === "item" ? rarityColor(reward.item?.rarity) : "#ffd166");

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, a0, a1);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? "rgba(23,30,44,0.98)" : "rgba(47,20,74,0.98)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = glow;
      ctx.stroke();

      const mid = a0 + seg / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.translate(radius * 0.63, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "#fff";
      ctx.font = "900 26px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(reward.icon || "🎁", 0, -4);
      ctx.font = "800 11px system-ui";
      ctx.fillText(formatRewardText(reward).replace("Enerji", "EN"), 0, 16);
      ctx.restore();
    }

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(16,18,24,0.95)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,216,125,0.85)";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - radius - 22);
    ctx.lineTo(cx - 16, cy - radius + 8);
    ctx.lineTo(cx + 16, cy - radius + 8);
    ctx.closePath();
    ctx.fillStyle = "#ffd166";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke();

    const done = s.wheelRewardGranted;
    ctx.fillStyle = "#fff";
    ctx.font = "900 22px system-ui";
    ctx.fillText(done ? "Çark durdu" : (s.wheelKind === "premium" ? "Premium çark dönüyor" : "Ücretsiz çark dönüyor"), x + 12, y + 24);
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "13px system-ui";
    ctx.fillText(done ? `Kazanç: ${formatRewardText(s.wheelResult)}` : "Okun işaret ettiği ödül senin olur.", x + 12, y + 46);

    const card = { x: x + 18, y: y + h - 110, w: w - 36, h: 88 };
    ctx.fillStyle = "rgba(8,12,20,0.72)";
    fillRoundRect(ctx, card.x, card.y, card.w, card.h, 22);
    ctx.strokeStyle = done ? (s.wheelResult.glow || rarityColor(s.wheelResult.item?.rarity)) : "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, card.x, card.y, card.w, card.h, 22);
    ctx.fillStyle = "#fff";
    ctx.font = "900 28px system-ui";
    ctx.fillText(done ? (s.wheelResult.icon || "🎁") : "🎯", card.x + 18, card.y + 38);
    ctx.font = "900 20px system-ui";
    ctx.fillText(done ? formatRewardText(s.wheelResult) : "Çark dönüyor...", card.x + 70, card.y + 36);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "13px system-ui";
    ctx.fillText(done ? "Ödül otomatik envanterine / hesabına işlendi." : "Spin bitince ödül otomatik hesabına yazılır.", card.x + 70, card.y + 58);

    if (done) {
      const btn = { x: x + w - 150, y: y + 10, w: 132, h: 34 };
      this.hitButtons.push({ rect: btn, action: "confirm_wheel" });
      this._drawButton(ctx, btn, "Tamam", "primary");
    }
  }

  _drawChest(ctx, cx, cy, scale, openT, rare = false) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    const glow = rare ? "rgba(255,210,120,0.25)" : "rgba(109,173,255,0.22)";
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 8, 98, 0, Math.PI * 2);
    ctx.fill();

    const wobble = Math.sin(Date.now() / 70) * 3 * (1 - openT);
    ctx.translate(wobble, 0);

    ctx.fillStyle = rare ? "#9f6518" : "#264b87";
    fillRoundRect(ctx, -86, -8, 172, 88, 18);
    ctx.strokeStyle = "rgba(255,230,180,0.45)";
    ctx.lineWidth = 4;
    strokeRoundRect(ctx, -86, -8, 172, 88, 18);

    ctx.save();
    ctx.translate(0, -10);
    ctx.rotate(-1.2 * openT);
    ctx.fillStyle = rare ? "#c08429" : "#3d68ad";
    fillRoundRect(ctx, -90, -56, 180, 54, 16);
    ctx.strokeStyle = "rgba(255,245,210,0.5)";
    ctx.lineWidth = 4;
    strokeRoundRect(ctx, -90, -56, 180, 54, 16);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    fillRoundRect(ctx, -74, -44, 148, 14, 8);
    ctx.restore();

    ctx.fillStyle = "rgba(255,216,133,0.9)";
    fillRoundRect(ctx, -10, 8, 20, 28, 8);
    ctx.restore();
  }

  _drawCrate(ctx, x, y, w, h) {
    const s = this.state;
    const title = s.crateKind === "legendary" ? "Legendary Crate" : "Mystery Crate";
    ctx.fillStyle = "#fff";
    ctx.font = "900 22px system-ui";
    ctx.fillText(title, x + 12, y + 24);
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "13px system-ui";
    ctx.fillText("Sandığa dokun, kapak açılsın. Sonra tek sıra ödül bandı akıp dursun ve dursun.", x + 12, y + 46);

    const cx = x + w / 2;
    const cy = y + 150;

    if (s.cratePhase === "closed") {
      this._drawChest(ctx, cx, cy, 1 + s.introPulse * 0.03, 0, s.crateKind === "legendary");
      const tap = { x: cx - 100, y: cy - 100, w: 200, h: 180 };
      this.hitButtons.push({ rect: tap, action: "tap_chest" });
      ctx.fillStyle = "rgba(255,255,255,0.86)";
      ctx.font = "900 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Sandığa dokun", cx, cy + 116);
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "13px system-ui";
      ctx.fillText("Açılınca ödül bandı sağdan sola akacak.", cx, cy + 138);
      ctx.textAlign = "left";
      return;
    }

    let openT = 0;
    if (s.cratePhase === "opening") {
      openT = clamp((Date.now() - s.crateStartAt) / Math.max(1, s.crateDuration), 0, 1);
      this._drawChest(ctx, cx, cy, 1.02, openT, s.crateKind === "legendary");
      drawStarburst(ctx, cx, cy - 26, 80 + openT * 24, 14, 0.15 + openT * 0.25);
    } else {
      this._drawChest(ctx, cx, cy, 1.02, 1, s.crateKind === "legendary");
      drawStarburst(ctx, cx, cy - 26, 104 + s.introPulse * 8, 16, 0.28);
    }

    const reelX = x + 18;
    const reelY = y + 270;
    const reelW = w - 36;
    const reelH = 94;

    ctx.fillStyle = "rgba(8,12,20,0.78)";
    fillRoundRect(ctx, reelX, reelY, reelW, reelH, 20);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    strokeRoundRect(ctx, reelX, reelY, reelW, reelH, 20);

    const centerX = reelX + reelW / 2;
    ctx.fillStyle = `rgba(255,215,120,${0.10 + s.introPulse * 0.15})`;
    fillRoundRect(ctx, centerX - 46, reelY + 6, 92, reelH - 12, 16);
    ctx.strokeStyle = "rgba(255,215,120,0.68)";
    ctx.lineWidth = 2;
    strokeRoundRect(ctx, centerX - 46, reelY + 6, 92, reelH - 12, 16);

    ctx.save();
    roundRectPath(ctx, reelX + 8, reelY + 8, reelW - 16, reelH - 16, 14);
    ctx.clip();
    const itemW = 96;
    const itemGap = 6;
    for (let i = 0; i < s.crateReelItems.length; i += 1) {
      const reward = s.crateReelItems[i];
      const cellX = reelX + 24 + i * itemW - s.crateReelOffset;
      if (cellX < reelX - itemW || cellX > reelX + reelW + itemW) continue;
      const glow = reward.glow || rarityColor(reward.item?.rarity);
      ctx.fillStyle = "rgba(24,30,42,0.95)";
      fillRoundRect(ctx, cellX, reelY + 14, itemW - itemGap, reelH - 28, 16);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1.5;
      strokeRoundRect(ctx, cellX, reelY + 14, itemW - itemGap, reelH - 28, 16);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "900 24px system-ui";
      ctx.fillText(reward.icon || "🎁", cellX + (itemW - itemGap) / 2, reelY + 44);
      ctx.font = "800 10px system-ui";
      ctx.fillText(formatRewardText(reward), cellX + (itemW - itemGap) / 2, reelY + 68);
      ctx.textAlign = "left";
    }
    ctx.restore();

    ctx.fillStyle = "#ffd166";
    fillRoundRect(ctx, centerX - 4, reelY + 2, 8, reelH - 4, 4);

    if (s.cratePhase === "reveal") {
      const rw = s.crateReward;
      const card = { x: x + 18, y: y + h - 104, w: w - 36, h: 84 };
      ctx.fillStyle = "rgba(10,12,20,0.86)";
      fillRoundRect(ctx, card.x, card.y, card.w, card.h, 22);
      ctx.strokeStyle = rw.glow || rarityColor(rw.item?.rarity);
      strokeRoundRect(ctx, card.x, card.y, card.w, card.h, 22);
      ctx.fillStyle = "#fff";
      ctx.font = "900 26px system-ui";
      ctx.fillText(rw.icon || "🎁", card.x + 16, card.y + 38);
      ctx.font = "900 20px system-ui";
      ctx.fillText(formatRewardText(rw), card.x + 66, card.y + 34);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "13px system-ui";
      ctx.fillText("Ödül otomatik hesabına işlendi.", card.x + 66, card.y + 56);
      const ok = { x: x + w - 150, y: y + 10, w: 132, h: 34 };
      this.hitButtons.push({ rect: ok, action: "confirm_crate" });
      this._drawButton(ctx, ok, "Tamam", "primary");
    }
  }

  render(ctx, w, h) {
    this.hitButtons = [];
    const bg = (typeof this.assets?.getImage === "function" ? this.assets.getImage("background") : null) || (typeof this.assets?.get === "function" ? this.assets.get("background") : null);
    if (bg) {
      const iw = bg.width || 1;
      const ih = bg.height || 1;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#080b12";
      ctx.fillRect(0, 0, w, h);
    }

    const og = ctx.createLinearGradient(0, 0, 0, h);
    og.addColorStop(0, "rgba(4,6,12,0.72)");
    og.addColorStop(1, "rgba(10,12,20,0.88)");
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, w, h);

    const panelW = Math.min(w - 20, 560);
    const panelH = Math.min(h - 24, 760);
    const panelX = (w - panelW) / 2;
    const panelY = 12;

    const pg = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    pg.addColorStop(0, "rgba(16,18,28,0.80)");
    pg.addColorStop(1, "rgba(8,10,18,0.92)");
    ctx.fillStyle = pg;
    fillRoundRect(ctx, panelX, panelY, panelW, panelH, 28);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.2;
    strokeRoundRect(ctx, panelX, panelY, panelW, panelH, 28);

    this._drawHeader(ctx, panelX, panelY, panelW);

    const innerX = panelX + 14;
    const innerY = panelY + 76;
    const innerW = panelW - 28;
    const innerH = panelH - 90;

    if (this.state.screen === "wheel") this._drawWheel(ctx, innerX, innerY, innerW, innerH);
    else if (this.state.screen === "crate") this._drawCrate(ctx, innerX, innerY, innerW, innerH);
    else this._drawLobby(ctx, innerX, innerY, innerW);

    if (this.toast.text && this.toast.until > Date.now()) {
      const tw = Math.min(panelW - 80, 340);
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - 50;
      ctx.fillStyle = "rgba(10,12,20,0.92)";
      fillRoundRect(ctx, tx, ty, tw, 34, 17);
      ctx.strokeStyle = "rgba(255,215,120,0.35)";
      strokeRoundRect(ctx, tx, ty, tw, 34, 17);
      ctx.fillStyle = "#fff";
      ctx.font = "800 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.toast.text, tx + tw / 2, ty + 17);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }
}
