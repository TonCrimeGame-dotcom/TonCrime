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

function lerp(a, b, t) {
  return a + (b - a) * t;
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

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function rarityColor(r) {
  switch (String(r || "").toLowerCase()) {
    case "common":
      return "#a0aec0";
    case "rare":
      return "#61a8ff";
    case "epic":
      return "#ca78ff";
    case "legendary":
      return "#ffcc66";
    default:
      return "#9ca3af";
  }
}

function crateName(kind) {
  return kind === "legendary" ? "Legendary Crate" : "Mystery Crate";
}

function pushParticle(list, p) {
  list.push({
    x: p.x || 0,
    y: p.y || 0,
    vx: p.vx || 0,
    vy: p.vy || 0,
    life: p.life || 1000,
    maxLife: p.maxLife || p.life || 1000,
    size: p.size || 4,
    color: p.color || "#ffd166",
    alpha: p.alpha == null ? 1 : p.alpha,
    spin: p.spin || 0,
    rot: p.rot || 0,
    shape: p.shape || "dot",
  });
}

function spawnBurst(list, cx, cy, color, count = 18) {
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.15;
    const speed = 1.2 + Math.random() * 3.2;
    pushParticle(list, {
      x: cx,
      y: cy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 0.8,
      size: 2 + Math.random() * 4,
      life: 650 + Math.random() * 550,
      color,
      shape: Math.random() > 0.5 ? "dot" : "spark",
      spin: (Math.random() - 0.5) * 0.2,
    });
  }
}

function drawParticles(ctx, list) {
  for (const p of list) {
    const a = clamp(p.life / Math.max(1, p.maxLife), 0, 1) * (p.alpha == null ? 1 : p.alpha);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    if (p.shape === "spark") {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.lineTo(p.size, 0);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function getPointer(input) {
  return input?.pointer || input?.p || { x: 0, y: 0 };
}

function justReleased(input) {
  if (typeof input?.justReleased === "function") return !!input.justReleased();
  return !!input?._justReleased || !!input?.mouseReleased;
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
      introPulse: 0,
      particles: [],
      shimmer: 0,

      wheelKind: "free",
      wheelRewards: [],
      wheelSelectedIndex: 0,
      wheelStartAt: 0,
      wheelDuration: 0,
      wheelStartAngle: 0,
      wheelEndAngle: 0,
      wheelAngle: 0,
      wheelVelocity: 0,
      wheelRewardGranted: false,
      wheelResult: null,
      pointerKick: 0,
      wheelFlash: 0,

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
      crateGlow: 0,
      crateLidOpen: 0,
      crateShake: 0,
      crateFlash: 0,
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

  _showToast(text, ms = 1700) {
    this.toast = { text: String(text || ""), until: Date.now() + ms };
  }

  _goBack() {
    try {
      this.scenes.go("trade", { tab: "loot" });
    } catch (_) {
      try {
        this.scenes.go("home");
      } catch (_) {}
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
    const reward = rollCrateReward(kind);
    const reelItems = this._buildCrateReel(reward, kind);
    this.state.screen = "crate";
    this.state.crateKind = kind;
    this.state.cratePhase = "closed";
    this.state.crateStartAt = Date.now();
    this.state.crateDuration = 0;
    this.state.crateResultGranted = false;
    this.state.crateReward = reward;
    this.state.crateReelItems = reelItems;
    this.state.crateReelOffset = 0;
    this.state.crateReelFrom = 0;
    this.state.crateReelTo = 0;
    this.state.crateGlow = 0;
    this.state.crateLidOpen = 0;
    this.state.crateShake = 0;
    this.state.crateFlash = 0;
  }

  _buildCrateReel(targetReward, kind) {
    const items = [];
    const targetSlot = 26;
    for (let i = 0; i < 40; i += 1) {
      const rw = i === targetSlot ? targetReward : rollCrateReward(kind);
      items.push({ ...rw, item: rw.item ? { ...rw.item } : undefined });
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
    const selectedCenter = -Math.PI / 2 + index * seg + seg / 2;
    const extraSpins = kind === "premium" ? 10 : 7;
    const endAngle = extraSpins * Math.PI * 2 + (desiredCenter - selectedCenter);

    this.state.screen = "wheel";
    this.state.wheelKind = kind;
    this.state.wheelRewards = rewards;
    this.state.wheelSelectedIndex = index;
    this.state.wheelStartAt = Date.now();
    this.state.wheelDuration = kind === "premium" ? 5200 : 3900;
    this.state.wheelStartAngle = 0;
    this.state.wheelEndAngle = endAngle;
    this.state.wheelAngle = 0;
    this.state.wheelVelocity = 0;
    this.state.wheelRewardGranted = false;
    this.state.wheelResult = rewards[index];
    this.state.pointerKick = 0;
    this.state.wheelFlash = 0;
  }

  _grantWheelReward() {
    if (this.state.wheelRewardGranted) return;
    applyLootReward(this.store, this.state.wheelResult, {
      freeSpinUsed: this.state.wheelKind === "free",
    });
    this.state.wheelRewardGranted = true;
    this.state.wheelFlash = 1;
    const glow = this.state.wheelResult?.glow || rarityColor(this.state.wheelResult?.item?.rarity);
    spawnBurst(this.state.particles, 280, 250, glow, 24);
    this._showToast(`Kazandın: ${formatRewardText(this.state.wheelResult)}`, 2300);
  }

  _grantCrateReward() {
    if (this.state.crateResultGranted) return;
    applyLootReward(this.store, this.state.crateReward);
    this.state.crateResultGranted = true;
    this.state.crateFlash = 1;
    const glow = this.state.crateReward?.glow || rarityColor(this.state.crateReward?.item?.rarity);
    spawnBurst(this.state.particles, 280, 340, glow, 28);
    this._showToast(`Sandık ödülü: ${formatRewardText(this.state.crateReward)}`, 2300);
  }

  _tickParticles(dt) {
    const list = this.state.particles;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      p.life -= dt;
      p.x += p.vx * (dt / 16.666);
      p.y += p.vy * (dt / 16.666);
      p.vy += 0.035 * (dt / 16.666);
      p.rot += p.spin * (dt / 16.666);
      if (p.life <= 0) list.splice(i, 1);
    }
  }

  _tickAnimations() {
    const now = Date.now();
    const dt = this._lastTick ? Math.min(40, now - this._lastTick) : 16;
    this._lastTick = now;
    const s = this.state;

    s.introPulse = (Math.sin(now / 260) + 1) * 0.5;
    s.shimmer = (Math.sin(now / 520) + 1) * 0.5;
    s.pointerKick *= 0.9;
    s.wheelFlash *= 0.93;
    s.crateFlash *= 0.93;
    s.crateGlow = lerp(s.crateGlow, s.cratePhase === "reveal" ? 1 : (s.cratePhase === "opening" ? 0.72 : 0.28), 0.08);
    this._tickParticles(dt);

    if (s.screen === "wheel" && s.wheelStartAt > 0) {
      const t = clamp((now - s.wheelStartAt) / Math.max(1, s.wheelDuration), 0, 1);
      const eased = easeOutExpo(t);
      const prev = s.wheelAngle;
      s.wheelAngle = s.wheelStartAngle + (s.wheelEndAngle - s.wheelStartAngle) * eased;
      s.wheelVelocity = s.wheelAngle - prev;
      if (Math.floor(prev / 0.32) !== Math.floor(s.wheelAngle / 0.32)) {
        s.pointerKick = 1;
      }
      if (t >= 1 && !s.wheelRewardGranted) {
        this._grantWheelReward();
      }
    }

    if (s.screen === "crate" && s.cratePhase === "opening") {
      const t = clamp((now - s.crateStartAt) / Math.max(1, s.crateDuration), 0, 1);
      s.crateLidOpen = easeOutCubic(t);
      s.crateShake = (1 - t) * (s.crateKind === "legendary" ? 8 : 5);
      if (t >= 1) {
        s.cratePhase = "reel";
        s.crateStartAt = now;
        s.crateDuration = s.crateKind === "legendary" ? 4300 : 3600;
        const slotW = 104;
        const target = s.crateReelItems.targetSlot || 26;
        const visibleCenterShift = 2.5;
        s.crateReelFrom = 0;
        s.crateReelTo = target * slotW - slotW * visibleCenterShift;
        spawnBurst(this.state.particles, 280, 250, s.crateKind === "legendary" ? "#ffcc66" : "#61a8ff", 20);
      }
    }

    if (s.screen === "crate" && s.cratePhase === "reel") {
      const t = clamp((now - s.crateStartAt) / Math.max(1, s.crateDuration), 0, 1);
      const eased = easeOutCubic(t);
      s.crateReelOffset = s.crateReelFrom + (s.crateReelTo - s.crateReelFrom) * eased;
      s.crateShake = (1 - t) * 2;
      if (t >= 1) {
        s.cratePhase = "reveal";
        s.crateShake = 0;
        this._grantCrateReward();
      }
    }
  }

  update() {
    this._tickAnimations();
    if (!justReleased(this.input)) return;
    const ptr = getPointer(this.input);

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
        case "confirm_crate":
          this.state.screen = "lobby";
          return;
        case "tap_chest":
          if (this.state.cratePhase === "closed") {
            this.state.cratePhase = "opening";
            this.state.crateStartAt = Date.now();
            this.state.crateDuration = this.state.crateKind === "legendary" ? 1200 : 950;
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
      fill = g;
      stroke = "rgba(255,255,255,0.28)";
    } else if (style === "gold") {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, "rgba(255,210,120,0.96)");
      g.addColorStop(1, "rgba(196,122,22,0.96)");
      fill = g;
      txt = "#201305";
      stroke = "rgba(255,255,255,0.25)";
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
    ctx.fillText("Gerçek çember çark • açılan kasa • slot akışı", panelX + 72, panelY + 58);

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

    const heroH = 126;
    const hg = ctx.createLinearGradient(x, y, x + w, y + heroH);
    hg.addColorStop(0, "rgba(87,45,140,0.92)");
    hg.addColorStop(1, "rgba(18,12,36,0.92)");
    ctx.fillStyle = hg;
    fillRoundRect(ctx, x, y, w, heroH, 24);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, x, y, w, heroH, 24);

    ctx.fillStyle = "#fff";
    ctx.font = "900 22px system-ui";
    ctx.fillText("Canlı Loot Odası", x + 18, y + 34);
    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "13px system-ui";
    ctx.fillText("Premium çark artık gerçek bir daire olarak döner ve okun gösterdiği ödül düşer.", x + 18, y + 56);
    ctx.fillText("Kasa tıkla-aç akışı, slot bandı ve final ödül kartı ayrı animasyonla çalışır.", x + 18, y + 76);

    const freeBtn = { x: x + 18, y: y + 88, w: 140, h: 28 };
    const premiumBtn = { x: x + 166, y: y + 88, w: 164, h: 28 };
    this.hitButtons.push({ rect: freeBtn, action: "enter_free_wheel" });
    this.hitButtons.push({ rect: premiumBtn, action: "enter_premium_wheel" });
    this._drawButton(ctx, freeBtn, freeReady ? "Ücretsiz Çark" : "Yarın Hazır", freeReady ? "primary" : "ghost");
    this._drawButton(ctx, premiumBtn, "Premium Çark • 90", "gold");

    y += heroH + 14;

    const gap = 10;
    const cw = Math.floor((w - gap) / 2);
    const cards = [
      { x, y, w: cw, h: 184, kind: "mystery", icon: "📦", title: "Mystery Crate", subtitle: `${mysteryCount} adet envanterde`, cost: 65, primary: "primary" },
      { x: x + cw + gap, y, w: cw, h: 184, kind: "legendary", icon: "👑", title: "Legendary Crate", subtitle: `${legendaryCount} adet envanterde`, cost: 140, primary: "gold" },
    ];

    for (const card of cards) {
      const g = ctx.createLinearGradient(card.x, card.y, card.x + card.w, card.y + card.h);
      g.addColorStop(0, card.kind === "legendary" ? "rgba(112,74,12,0.90)" : "rgba(18,42,82,0.90)");
      g.addColorStop(1, "rgba(10,12,20,0.94)");
      ctx.fillStyle = g;
      fillRoundRect(ctx, card.x, card.y, card.w, card.h, 22);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      strokeRoundRect(ctx, card.x, card.y, card.w, card.h, 22);

      ctx.save();
      ctx.globalAlpha = 0.12 + this.state.shimmer * 0.08;
      ctx.fillStyle = card.kind === "legendary" ? "#ffcc66" : "#61a8ff";
      fillRoundRect(ctx, card.x + card.w - 74, card.y + 16, 48, 48, 18);
      ctx.restore();

      ctx.fillStyle = "#fff";
      ctx.font = "900 26px system-ui";
      ctx.fillText(card.icon, card.x + 16, card.y + 34);
      ctx.font = "900 18px system-ui";
      ctx.fillText(card.title, card.x + 16, card.y + 66);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "13px system-ui";
      ctx.fillText(card.subtitle, card.x + 16, card.y + 90);
      ctx.fillText(`Satın al & aç: ${card.cost} YTON`, card.x + 16, card.y + 112);
      ctx.fillText("Tıklayınca kasa görünür, kapak açılır, slot akar.", card.x + 16, card.y + 132);

      const b1 = { x: card.x + 14, y: card.y + 146, w: card.w - 28, h: 22 };
      this.hitButtons.push({ rect: b1, action: "buy_open_crate", kind: card.kind });
      this._drawButton(ctx, b1, "Satın Al & Aç", card.primary);
    }
  }

  _drawWheel(ctx, x, y, w, h) {
    const s = this.state;
    const cx = x + w * 0.5;
    const cy = y + h * 0.42;
    const radius = Math.min(w, h) * 0.29;
    const rewards = s.wheelRewards;
    const seg = (Math.PI * 2) / Math.max(1, rewards.length);
    const premium = s.wheelKind === "premium";

    const outerGlow = premium ? "#ffcc66" : "#61a8ff";
    const haloR = radius + 24 + s.introPulse * 10 + s.wheelFlash * 10;
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, haloR);
    halo.addColorStop(0, `rgba(255,255,255,${0.10 + s.wheelFlash * 0.10})`);
    halo.addColorStop(0.6, premium ? `rgba(255,204,102,${0.16 + s.introPulse * 0.08})` : `rgba(97,168,255,${0.14 + s.introPulse * 0.08})`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.wheelAngle);

    for (let i = 0; i < rewards.length; i += 1) {
      const a0 = -Math.PI / 2 + i * seg;
      const a1 = a0 + seg;
      const reward = rewards[i];
      const glow = reward.glow || (reward.type === "item" ? rarityColor(reward.item?.rarity) : outerGlow);
      const grad = ctx.createLinearGradient(Math.cos(a0) * radius, Math.sin(a0) * radius, Math.cos(a1) * radius, Math.sin(a1) * radius);
      grad.addColorStop(0, i % 2 === 0 ? "rgba(27,31,46,0.98)" : "rgba(55,27,84,0.98)");
      grad.addColorStop(1, i % 2 === 0 ? "rgba(49,18,62,0.98)" : "rgba(16,24,44,0.98)");

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, a0, a1);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 2.3;
      ctx.strokeStyle = glow;
      ctx.stroke();

      const mid = a0 + seg / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.translate(radius * 0.67, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = premium ? "900 28px system-ui" : "900 24px system-ui";
      ctx.fillText(reward.icon || "🎁", 0, -6);
      ctx.font = "800 10px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      const label = formatRewardText(reward);
      ctx.fillText(label.length > 13 ? `${label.slice(0, 12)}…` : label, 0, 18);
      ctx.restore();
    }

    ctx.restore();

    ctx.save();
    ctx.strokeStyle = premium ? "rgba(255,220,120,0.92)" : "rgba(140,198,255,0.88)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(16,18,24,0.96)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = premium ? "rgba(255,216,125,0.92)" : "rgba(97,168,255,0.90)";
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy - radius - 24 + s.pointerKick * 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-18, 28);
    ctx.lineTo(18, 28);
    ctx.closePath();
    ctx.fillStyle = premium ? "#ffd166" : "#8bc8ff";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.font = "900 22px system-ui";
    ctx.fillText(premium ? "Premium çark" : "Ücretsiz çark", x + 12, y + 24);
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "13px system-ui";
    ctx.fillText(s.wheelRewardGranted ? `Kazanç: ${formatRewardText(s.wheelResult)}` : "Okun durduğu dilim direkt kazanılır.", x + 12, y + 46);

    const card = { x: x + 18, y: y + h - 118, w: w - 36, h: 92 };
    ctx.fillStyle = "rgba(8,12,20,0.76)";
    fillRoundRect(ctx, card.x, card.y, card.w, card.h, 22);
    ctx.strokeStyle = s.wheelRewardGranted ? (s.wheelResult.glow || rarityColor(s.wheelResult.item?.rarity)) : "rgba(255,255,255,0.12)";
    strokeRoundRect(ctx, card.x, card.y, card.w, card.h, 22);

    ctx.fillStyle = "#fff";
    ctx.font = "900 30px system-ui";
    ctx.fillText(s.wheelRewardGranted ? (s.wheelResult.icon || "🎁") : "🎯", card.x + 16, card.y + 42);
    ctx.font = "900 19px system-ui";
    ctx.fillText(s.wheelRewardGranted ? formatRewardText(s.wheelResult) : "Çark dönüyor...", card.x + 68, card.y + 36);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "13px system-ui";
    ctx.fillText(s.wheelRewardGranted ? "Ödül hesabına işlendi." : "Spin bitince ödül otomatik yazılır.", card.x + 68, card.y + 58);

    if (s.wheelRewardGranted) {
      const btn = { x: x + w - 150, y: y + 10, w: 132, h: 34 };
      this.hitButtons.push({ rect: btn, action: "confirm_wheel" });
      this._drawButton(ctx, btn, "Tamam", premium ? "gold" : "primary");
    }
  }

  _drawChest(ctx, cx, cy, scale, openT, rare = false, shake = 0) {
    ctx.save();
    ctx.translate(cx + (Math.random() - 0.5) * shake, cy + (Math.random() - 0.5) * shake);
    ctx.scale(scale, scale);

    const glow = ctx.createRadialGradient(0, 10, 18, 0, 10, 110);
    glow.addColorStop(0, rare ? "rgba(255,210,120,0.34)" : "rgba(109,173,255,0.28)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 12, 110, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rare ? "#8a5713" : "#23457d";
    fillRoundRect(ctx, -88, -4, 176, 92, 18);
    ctx.strokeStyle = "rgba(255,236,194,0.50)";
    ctx.lineWidth = 4;
    strokeRoundRect(ctx, -88, -4, 176, 92, 18);

    ctx.fillStyle = rare ? "#d39a31" : "#4b7ed0";
    fillRoundRect(ctx, -12, 12, 24, 30, 8);

    ctx.save();
    ctx.translate(0, -8);
    ctx.rotate(-1.18 * openT);
    ctx.fillStyle = rare ? "#b67b23" : "#345d9c";
    fillRoundRect(ctx, -92, -56, 184, 56, 16);
    ctx.strokeStyle = "rgba(255,245,210,0.5)";
    strokeRoundRect(ctx, -92, -56, 184, 56, 16);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    fillRoundRect(ctx, -72, -44, 144, 14, 8);
    ctx.restore();

    if (openT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25 * openT;
      ctx.fillStyle = rare ? "#ffdb8b" : "#8bc8ff";
      for (let i = 0; i < 6; i += 1) {
        const a = -0.8 + i * 0.32;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(Math.cos(a) * 74, -Math.sin(a) * 90);
        ctx.lineTo(Math.cos(a) * 42, -Math.sin(a) * 58);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  _drawCrate(ctx, x, y, w, h) {
    const s = this.state;
    const title = s.crateKind === "legendary" ? "Legendary Crate" : "Mystery Crate";
    const premium = s.crateKind === "legendary";
    const accent = premium ? "#ffcc66" : "#61a8ff";

    ctx.fillStyle = "#fff";
    ctx.font = "900 22px system-ui";
    ctx.fillText(title, x + 12, y + 24);
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "13px system-ui";
    ctx.fillText("Sandığa dokun. Kapak açılsın. Sonra ödül bandı slot gibi sağdan sola aksın.", x + 12, y + 46);

    const cx = x + w / 2;
    const cy = y + 146;
    this._drawChest(ctx, cx, cy, 1.02, s.crateLidOpen, premium, s.crateShake);

    if (s.cratePhase === "closed") {
      const tap = { x: cx - 104, y: cy - 96, w: 208, h: 184 };
      this.hitButtons.push({ rect: tap, action: "tap_chest" });
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.font = "900 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Sandığa dokun", cx, cy + 116);
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.font = "13px system-ui";
      ctx.fillText("Açılınca slot bandı dönüp ortadaki ödülde duracak.", cx, cy + 138);
      ctx.textAlign = "left";
      return;
    }

    const reelX = x + 18;
    const reelY = y + 266;
    const reelW = w - 36;
    const reelH = 104;

    const rg = ctx.createLinearGradient(reelX, reelY, reelX, reelY + reelH);
    rg.addColorStop(0, "rgba(10,14,22,0.84)");
    rg.addColorStop(1, "rgba(8,12,20,0.92)");
    ctx.fillStyle = rg;
    fillRoundRect(ctx, reelX, reelY, reelW, reelH, 20);
    ctx.strokeStyle = `rgba(${premium ? "255,215,120" : "97,168,255"},0.45)`;
    strokeRoundRect(ctx, reelX, reelY, reelW, reelH, 20);

    const centerX = reelX + reelW / 2;
    ctx.save();
    ctx.globalAlpha = 0.18 + s.crateGlow * 0.14;
    ctx.fillStyle = accent;
    fillRoundRect(ctx, centerX - 56, reelY + 6, 112, reelH - 12, 16);
    ctx.restore();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    strokeRoundRect(ctx, centerX - 56, reelY + 6, 112, reelH - 12, 16);

    ctx.save();
    roundRectPath(ctx, reelX + 8, reelY + 8, reelW - 16, reelH - 16, 14);
    ctx.clip();
    const itemW = 104;
    const itemGap = 8;
    for (let i = 0; i < s.crateReelItems.length; i += 1) {
      const reward = s.crateReelItems[i];
      const cellX = reelX + 24 + i * itemW - s.crateReelOffset;
      if (cellX < reelX - itemW || cellX > reelX + reelW + itemW) continue;
      const glow = reward.glow || rarityColor(reward.item?.rarity);
      ctx.fillStyle = "rgba(24,30,42,0.96)";
      fillRoundRect(ctx, cellX, reelY + 14, itemW - itemGap, reelH - 28, 16);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1.6;
      strokeRoundRect(ctx, cellX, reelY + 14, itemW - itemGap, reelH - 28, 16);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 24px system-ui";
      ctx.fillText(reward.icon || "🎁", cellX + (itemW - itemGap) / 2, reelY + 42);
      ctx.font = "800 10px system-ui";
      const label = formatRewardText(reward);
      ctx.fillText(label.length > 14 ? `${label.slice(0, 13)}…` : label, cellX + (itemW - itemGap) / 2, reelY + 69);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    ctx.restore();

    ctx.fillStyle = accent;
    fillRoundRect(ctx, centerX - 4, reelY + 3, 8, reelH - 6, 4);

    if (s.cratePhase === "reveal") {
      const rw = s.crateReward;
      const glow = rw.glow || rarityColor(rw.item?.rarity);
      const card = { x: x + 18, y: y + h - 112, w: w - 36, h: 88 };
      ctx.fillStyle = "rgba(10,12,20,0.90)";
      fillRoundRect(ctx, card.x, card.y, card.w, card.h, 22);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      strokeRoundRect(ctx, card.x, card.y, card.w, card.h, 22);
      ctx.fillStyle = "#fff";
      ctx.font = "900 28px system-ui";
      ctx.fillText(rw.icon || "🎁", card.x + 16, card.y + 42);
      ctx.font = "900 20px system-ui";
      ctx.fillText(formatRewardText(rw), card.x + 66, card.y + 34);
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "13px system-ui";
      ctx.fillText("Ödül otomatik hesabına işlendi.", card.x + 66, card.y + 56);
      const ok = { x: x + w - 150, y: y + 10, w: 132, h: 34 };
      this.hitButtons.push({ rect: ok, action: "confirm_crate" });
      this._drawButton(ctx, ok, "Tamam", premium ? "gold" : "primary");
    }
  }

  render(ctx, w, h) {
    this.hitButtons = [];

    const bg =
      (typeof this.assets?.getImage === "function" && this.assets.getImage("trade")) ||
      (typeof this.assets?.get === "function" && this.assets.get("trade")) ||
      (typeof this.assets?.getImage === "function" && this.assets.getImage("background")) ||
      (typeof this.assets?.get === "function" && this.assets.get("background")) ||
      null;

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
    og.addColorStop(0, "rgba(4,6,12,0.76)");
    og.addColorStop(1, "rgba(10,12,20,0.90)");
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

    drawParticles(ctx, this.state.particles);

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
