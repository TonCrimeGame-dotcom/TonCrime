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

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("tr-TR");
}

function rarityColor(r) {
  switch (String(r || "").toLowerCase()) {
    case "common":
      return "#a8b4c7";
    case "rare":
      return "#69b4ff";
    case "epic":
      return "#c97cff";
    case "legendary":
      return "#ffd166";
    default:
      return "#9ca3af";
  }
}

function crateName(kind) {
  return kind === "legendary" ? "Legendary Crate" : "Mystery Crate";
}

function glowForReward(reward, fallback = "#69b4ff") {
  return reward?.glow || rarityColor(reward?.item?.rarity) || fallback;
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

function spawnBurst(list, cx, cy, color, count = 18, power = 1) {
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.2;
    const speed = (1.2 + Math.random() * 3.6) * power;
    pushParticle(list, {
      x: cx,
      y: cy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 0.4,
      size: 2 + Math.random() * 4,
      life: 650 + Math.random() * 650,
      color,
      shape: Math.random() > 0.65 ? "spark" : "dot",
      spin: (Math.random() - 0.5) * 0.24,
      alpha: 0.95,
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

function drawLabel(ctx, x, y, text, align = "left", font = "13px system-ui", alpha = 0.72) {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
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
    this.audioCtx = null;
    this.state = this._makeState();
  }

  _makeState() {
    return {
      screen: "lobby",
      introPulse: 0,
      shimmer: 0,
      particles: [],

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
      wheelFlash: 0,
      wheelKick: 0,
      wheelPrevTickIndex: -1,

      crateKind: "mystery",
      cratePhase: "closed",
      crateStartAt: 0,
      crateDuration: 0,
      crateReward: null,
      crateReelItems: [],
      crateReelOffset: 0,
      crateReelFrom: 0,
      crateReelTo: 0,
      crateResultGranted: false,
      crateGlow: 0,
      crateFlash: 0,
      crateBlast: 0,
      revealScale: 0.8,
    };
  }

  onEnter(data = {}) {
    this.hitButtons = [];
    this.toast = { text: "", until: 0 };
    this.state = this._makeState();
    this._lastTick = 0;
    const mode = data.mode || "lobby";

    if (mode === "free_wheel") this._enterWheel("free");
    else if (mode === "premium_wheel") this._enterWheel("premium");
    else if (mode === "buy_open_mystery") this._buyAndOpenCrate("mystery");
    else if (mode === "buy_open_legendary") this._buyAndOpenCrate("legendary");
    else if (mode === "open_mystery") this._openInventoryCrate("mystery");
    else if (mode === "open_legendary") this._openInventoryCrate("legendary");
  }

  _ensureAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!this.audioCtx) this.audioCtx = new AC();
      if (this.audioCtx.state === "suspended") this.audioCtx.resume().catch(() => {});
      return this.audioCtx;
    } catch (_) {
      return null;
    }
  }

  _playTick(strength = 1) {
    const ac = this._ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200 + strength * 200, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035 * strength, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  _playWin(kind = "normal") {
    const ac = this._ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const notes = kind === "legendary" ? [540, 810, 1080] : [620, 880];
    notes.forEach((f, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = kind === "legendary" ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(f, now + i * 0.05);
      gain.gain.setValueAtTime(0.0001, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(kind === "legendary" ? 0.05 : 0.03, now + i * 0.05 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.22);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.24);
    });
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

  _buildCrateReel(targetReward, kind) {
    const items = [];
    const targetSlot = 30;
    for (let i = 0; i < 44; i += 1) {
      const rw = i === targetSlot ? targetReward : rollCrateReward(kind);
      items.push({ ...rw, item: rw.item ? { ...rw.item } : undefined });
    }
    items.targetSlot = targetSlot;
    return items;
  }

  _startCrateFlow(kind) {
    const reward = rollCrateReward(kind);
    this.state.screen = "crate";
    this.state.crateKind = kind;
    this.state.cratePhase = "charged";
    this.state.crateStartAt = Date.now();
    this.state.crateDuration = 950;
    this.state.crateReward = reward;
    this.state.crateReelItems = this._buildCrateReel(reward, kind);
    this.state.crateReelOffset = 0;
    this.state.crateReelFrom = 0;
    this.state.crateReelTo = 0;
    this.state.crateResultGranted = false;
    this.state.crateGlow = 0;
    this.state.crateFlash = 0;
    this.state.crateBlast = 0;
    this.state.revealScale = 0.8;
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
    this.state.wheelDuration = kind === "premium" ? 6200 : 4600;
    this.state.wheelStartAngle = 0;
    this.state.wheelEndAngle = endAngle;
    this.state.wheelAngle = 0;
    this.state.wheelRewardGranted = false;
    this.state.wheelResult = rewards[index];
    this.state.wheelFlash = 0;
    this.state.wheelKick = 0;
    this.state.wheelPrevTickIndex = -1;
  }

  _grantWheelReward() {
    if (this.state.wheelRewardGranted) return;
    applyLootReward(this.store, this.state.wheelResult, {
      freeSpinUsed: this.state.wheelKind === "free",
    });
    this.state.wheelRewardGranted = true;
    this.state.wheelFlash = 1;
    const glow = glowForReward(this.state.wheelResult, "#69b4ff");
    spawnBurst(this.state.particles, 280, 240, glow, 28, 1.25);
    this._playWin(this.state.wheelResult?.item?.rarity === "legendary" ? "legendary" : "normal");
    this._showToast(`Kazandın: ${formatRewardText(this.state.wheelResult)}`, 2400);
  }

  _grantCrateReward() {
    if (this.state.crateResultGranted) return;
    applyLootReward(this.store, this.state.crateReward);
    this.state.crateResultGranted = true;
    this.state.crateFlash = 1;
    const legendary = this.state.crateKind === "legendary" || this.state.crateReward?.item?.rarity === "legendary";
    const glow = glowForReward(this.state.crateReward, legendary ? "#ffd166" : "#69b4ff");
    spawnBurst(this.state.particles, 280, 300, glow, legendary ? 44 : 30, legendary ? 1.8 : 1.2);
    this.state.crateBlast = legendary ? 1 : 0.55;
    this._playWin(legendary ? "legendary" : "normal");
    this._showToast(`Sandık ödülü: ${formatRewardText(this.state.crateReward)}`, 2400);
  }

  _tickParticles(dt) {
    const list = this.state.particles;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      p.life -= dt;
      p.x += p.vx * (dt / 16.666);
      p.y += p.vy * (dt / 16.666);
      p.vy += 0.028 * (dt / 16.666);
      p.rot += p.spin * (dt / 16.666);
      if (p.life <= 0) list.splice(i, 1);
    }
  }

  _tickAnimations() {
    const now = Date.now();
    const dt = this._lastTick ? Math.min(40, now - this._lastTick) : 16;
    this._lastTick = now;
    const s = this.state;

    s.introPulse = (Math.sin(now / 300) + 1) * 0.5;
    s.shimmer = (Math.sin(now / 620) + 1) * 0.5;
    s.wheelKick *= 0.88;
    s.wheelFlash *= 0.93;
    s.crateFlash *= 0.93;
    s.crateBlast *= 0.92;
    s.crateGlow = lerp(s.crateGlow, s.screen === "crate" ? 1 : 0, 0.08);
    s.revealScale = lerp(s.revealScale, s.cratePhase === "reveal" ? 1 : 0.8, 0.12);
    this._tickParticles(dt);

    if (s.screen === "wheel" && s.wheelStartAt > 0) {
      const t = clamp((now - s.wheelStartAt) / Math.max(1, s.wheelDuration), 0, 1);
      const eased = easeOutQuint(t);
      const prev = s.wheelAngle;
      s.wheelAngle = s.wheelStartAngle + (s.wheelEndAngle - s.wheelStartAngle) * eased;
      const tickStep = 0.22;
      const prevIndex = Math.floor(prev / tickStep);
      const nextIndex = Math.floor(s.wheelAngle / tickStep);
      if (nextIndex !== prevIndex) {
        s.wheelKick = 1;
        this._playTick(Math.max(0.45, 1 - t * 0.45));
      }
      if (t >= 1 && !s.wheelRewardGranted) this._grantWheelReward();
    }

    if (s.screen === "crate") {
      if (s.cratePhase === "charged") {
        const t = clamp((now - s.crateStartAt) / Math.max(1, s.crateDuration), 0, 1);
        if (t >= 1) {
          s.cratePhase = "burst";
          s.crateStartAt = now;
          s.crateDuration = s.crateKind === "legendary" ? 820 : 620;
          spawnBurst(s.particles, 280, 255, s.crateKind === "legendary" ? "#ffd166" : "#69b4ff", s.crateKind === "legendary" ? 36 : 24, 1.5);
          this._playTick(1.2);
        }
      } else if (s.cratePhase === "burst") {
        const t = clamp((now - s.crateStartAt) / Math.max(1, s.crateDuration), 0, 1);
        s.crateBlast = Math.max(s.crateBlast, 1 - t);
        if (t >= 1) {
          s.cratePhase = "reel";
          s.crateStartAt = now;
          s.crateDuration = s.crateKind === "legendary" ? 4300 : 3600;
          const slotW = 104;
          const target = s.crateReelItems.targetSlot || 30;
          const visibleCenterShift = 2.5;
          s.crateReelFrom = 0;
          s.crateReelTo = target * slotW - slotW * visibleCenterShift;
        }
      } else if (s.cratePhase === "reel") {
        const t = clamp((now - s.crateStartAt) / Math.max(1, s.crateDuration), 0, 1);
        const eased = easeOutCubic(t);
        const prev = s.crateReelOffset;
        s.crateReelOffset = s.crateReelFrom + (s.crateReelTo - s.crateReelFrom) * eased;
        const tickStep = 28;
        if (Math.floor(prev / tickStep) !== Math.floor(s.crateReelOffset / tickStep)) {
          this._playTick(Math.max(0.45, 1 - t * 0.35));
        }
        if (t >= 1) {
          s.cratePhase = "reveal";
          this._grantCrateReward();
        }
      }
    }
  }

  update() {
    this._tickAnimations();
    if (!justReleased(this.input)) return;
    const ptr = getPointer(this.input);
    this._ensureAudio();

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
        default:
          return;
      }
    }
  }

  _drawButton(ctx, rect, text, style = "ghost") {
    let fill = "rgba(255,255,255,0.04)";
    let stroke = "rgba(255,255,255,0.12)";
    let txt = "rgba(255,255,255,0.95)";
    if (style === "primary") {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, "rgba(78,129,255,0.95)");
      g.addColorStop(1, "rgba(48,86,210,0.95)");
      fill = g;
      stroke = "rgba(145,189,255,0.42)";
    } else if (style === "gold") {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, "rgba(255,214,124,0.95)");
      g.addColorStop(1, "rgba(201,126,25,0.95)");
      fill = g;
      stroke = "rgba(255,238,190,0.36)";
      txt = "#1f1103";
    }
    ctx.fillStyle = fill;
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(18, rect.h / 2));
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(18, rect.h / 2));
    ctx.fillStyle = txt;
    ctx.font = `800 ${Math.max(12, Math.floor(rect.h * 0.34))}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  _drawGlassPanel(ctx, x, y, w, h, r = 28) {
    ctx.save();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "rgba(255,255,255,0.03)");
    g.addColorStop(1, "rgba(255,255,255,0.015)");
    ctx.fillStyle = g;
    fillRoundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1.1;
    strokeRoundRect(ctx, x, y, w, h, r);
    ctx.restore();
  }

  _drawHeader(ctx, panelX, panelY, panelW, compact) {
    const back = { x: panelX + 12, y: panelY + 12, w: compact ? 42 : 46, h: 34 };
    this.hitButtons.push({ rect: back, action: "back" });
    this._drawButton(ctx, back, "←", "ghost");

    ctx.fillStyle = "#fff";
    ctx.font = `900 ${compact ? 18 : 22}px system-ui`;
    ctx.fillText("Sandık & Çark", panelX + 66, panelY + (compact ? 33 : 36));
    drawLabel(ctx, panelX + 66, panelY + (compact ? 52 : 56), "Şeffaf panel • gerçek spin • dikey mobil uyum", "left", `${compact ? 11 : 12}px system-ui`, 0.68);

    const s = this.store.get();
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `800 ${compact ? 12 : 14}px system-ui`;
    ctx.fillText(`${fmtNum(s.coins || 0)} YTON`, panelX + panelW - 16, panelY + (compact ? 32 : 36));
    ctx.textAlign = "left";
  }

  _drawLobby(ctx, x, y, w, h, compact) {
    const freeReady = isFreeSpinReady(this.store);
    const mysteryCount = getInventoryCount(this.store, "Mystery Crate");
    const legendaryCount = getInventoryCount(this.store, "Legendary Crate");

    const heroH = compact ? 112 : 124;
    this._drawGlassPanel(ctx, x, y, w, heroH, 24);
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${compact ? 20 : 24}px system-ui`;
    ctx.fillText("Canlı Loot Odası", x + 16, y + 30);
    drawLabel(ctx, x + 16, y + 52, "Premium çarkta gerçek kumarhane tarzı dönüş, pointer tick ve rarity glow var.", "left", `${compact ? 11 : 12}px system-ui`, 0.72);
    drawLabel(ctx, x + 16, y + 70, "Sandık açılışı artık minimal enerji patlaması + slot bandı olarak çalışıyor.", "left", `${compact ? 11 : 12}px system-ui`, 0.72);

    const gap = 10;
    const btnY = y + heroH - 38;
    const btnW = Math.floor((w - gap - 32) / 2);
    const freeBtn = { x: x + 16, y: btnY, w: btnW, h: 28 };
    const premiumBtn = { x: x + 16 + btnW + gap, y: btnY, w: btnW, h: 28 };
    this.hitButtons.push({ rect: freeBtn, action: "enter_free_wheel" });
    this.hitButtons.push({ rect: premiumBtn, action: "enter_premium_wheel" });
    this._drawButton(ctx, freeBtn, freeReady ? "Ücretsiz Çark" : "Yarın Hazır", freeReady ? "primary" : "ghost");
    this._drawButton(ctx, premiumBtn, "Premium Çark • 90", "gold");

    y += heroH + 12;
    const cardGap = 10;
    const cardW = Math.floor((w - cardGap) / 2);
    const cardH = compact ? 160 : 176;
    const cards = [
      { x, y, w: cardW, h: cardH, kind: "mystery", title: "Mystery Crate", icon: "📦", count: mysteryCount, cost: 65, style: "primary" },
      { x: x + cardW + cardGap, y, w: cardW, h: cardH, kind: "legendary", title: "Legendary Crate", icon: "👑", count: legendaryCount, cost: 140, style: "gold" },
    ];

    for (const card of cards) {
      this._drawGlassPanel(ctx, card.x, card.y, card.w, card.h, 24);
      ctx.fillStyle = glowForReward({ item: { rarity: card.kind === "legendary" ? "legendary" : "rare" } }, "#69b4ff");
      ctx.globalAlpha = 0.12 + this.state.shimmer * 0.08;
      fillRoundRect(ctx, card.x + card.w - 66, card.y + 14, 44, 44, 16);
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#fff";
      ctx.font = `900 ${compact ? 24 : 28}px system-ui`;
      ctx.fillText(card.icon, card.x + 14, card.y + 34);
      ctx.font = `900 ${compact ? 16 : 18}px system-ui`;
      ctx.fillText(card.title, card.x + 14, card.y + 66);
      drawLabel(ctx, card.x + 14, card.y + 88, `${card.count} adet envanterde`, "left", `${compact ? 11 : 12}px system-ui`, 0.72);
      drawLabel(ctx, card.x + 14, card.y + 106, `Satın al & aç: ${card.cost} YTON`, "left", `${compact ? 11 : 12}px system-ui`, 0.72);
      drawLabel(ctx, card.x + 14, card.y + 124, "Animasyon: enerji kırılması + slot bandı + final glow", "left", `${compact ? 10 : 11}px system-ui`, 0.64);

      const btn = { x: card.x + 12, y: card.y + card.h - 32, w: card.w - 24, h: 24 };
      this.hitButtons.push({ rect: btn, action: "buy_open_crate", kind: card.kind });
      this._drawButton(ctx, btn, "Satın Al & Aç", card.style);
    }
  }

  _drawRewardGlow(ctx, cx, cy, radius, color, strength = 1) {
    const g = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
    g.addColorStop(0, `rgba(255,255,255,${0.14 * strength})`);
    const rgb = color === "#ffd166" ? "255,209,102" : color === "#c97cff" ? "201,124,255" : "105,180,255";
    g.addColorStop(0.45, `rgba(${rgb},${0.18 * strength})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawWheel(ctx, x, y, w, h, compact) {
    const s = this.state;
    const premium = s.wheelKind === "premium";
    const rewards = s.wheelRewards;
    const seg = (Math.PI * 2) / Math.max(1, rewards.length);
    const radius = Math.min(w * 0.46, h * 0.35, compact ? 170 : 190);
    const cx = x + w * 0.5;
    const cy = y + radius + (compact ? 48 : 58);

    ctx.fillStyle = "#fff";
    ctx.font = `900 ${compact ? 19 : 23}px system-ui`;
    ctx.fillText(premium ? "Premium çark" : "Ücretsiz çark", x + 8, y + 24);
    drawLabel(ctx, x + 8, y + 44, premium ? "Gerçek spin physics • pointer tick • rarity glow" : "Okun ince ucu durduğu dilimi kazandırır.", "left", `${compact ? 11 : 12}px system-ui`, 0.74);

    this._drawRewardGlow(ctx, cx, cy, radius + 34 + s.wheelFlash * 18, premium ? "#ffd166" : "#69b4ff", 1 + s.wheelFlash * 0.8);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.wheelAngle);
    for (let i = 0; i < rewards.length; i += 1) {
      const reward = rewards[i];
      const a0 = -Math.PI / 2 + i * seg;
      const a1 = a0 + seg;
      const glow = glowForReward(reward, premium ? "#ffd166" : "#69b4ff");
      const fill = ctx.createLinearGradient(Math.cos(a0) * radius, Math.sin(a0) * radius, Math.cos(a1) * radius, Math.sin(a1) * radius);
      fill.addColorStop(0, i % 2 === 0 ? "rgba(18,18,38,0.88)" : "rgba(40,24,70,0.88)");
      fill.addColorStop(1, i % 2 === 0 ? "rgba(31,20,57,0.88)" : "rgba(12,20,38,0.88)");
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, a0, a1);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2.1;
      ctx.stroke();

      const mid = a0 + seg / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.translate(radius * 0.66, 0);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${compact ? 18 : 22}px system-ui`;
      ctx.fillText(reward.icon || "🎁", 0, -8);
      ctx.font = `800 ${compact ? 8 : 9}px system-ui`;
      const label = formatRewardText(reward);
      ctx.fillText(label.length > 14 ? `${label.slice(0, 13)}…` : label, 0, 13);
      ctx.restore();
    }
    ctx.restore();

    ctx.strokeStyle = premium ? "rgba(255,214,124,0.96)" : "rgba(105,180,255,0.96)";
    ctx.lineWidth = compact ? 7 : 8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(10,10,18,0.96)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = premium ? "rgba(255,214,124,0.88)" : "rgba(105,180,255,0.88)";
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // inverted triangle pointer with sharp tip touching reward
    const pointerLen = compact ? 26 : 30;
    const baseW = compact ? 24 : 28;
    const pointerY = cy - radius - 3 + s.wheelKick * 4;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, pointerY); // sharp tip
    ctx.lineTo(cx - baseW / 2, pointerY - pointerLen);
    ctx.lineTo(cx + baseW / 2, pointerY - pointerLen);
    ctx.closePath();
    ctx.fillStyle = premium ? "#ffd166" : "#8fd1ff";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    const cardY = cy + radius + 22;
    const cardH = compact ? 86 : 92;
    this._drawGlassPanel(ctx, x + 10, cardY, w - 20, cardH, 24);
    const done = s.wheelRewardGranted;
    const resultGlow = glowForReward(s.wheelResult, premium ? "#ffd166" : "#69b4ff");
    if (done) {
      ctx.strokeStyle = resultGlow;
      ctx.lineWidth = 1.5;
      strokeRoundRect(ctx, x + 10, cardY, w - 20, cardH, 24);
    }
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${compact ? 22 : 26}px system-ui`;
    ctx.fillText(done ? (s.wheelResult.icon || "🎁") : "🎰", x + 24, cardY + 36);
    ctx.font = `900 ${compact ? 18 : 20}px system-ui`;
    ctx.fillText(done ? formatRewardText(s.wheelResult) : "Çark dönüyor...", x + 66, cardY + 32);
    drawLabel(ctx, x + 66, cardY + 54, done ? "Ödül hesabına işlendi." : "Durduğu dilim anında kazanılır.", "left", `${compact ? 11 : 12}px system-ui`, 0.72);

    if (done) {
      const btn = { x: x + w - 142, y: y + 6, w: 126, h: 32 };
      this.hitButtons.push({ rect: btn, action: "confirm_wheel" });
      this._drawButton(ctx, btn, "Tamam", premium ? "gold" : "primary");
    }
  }

  _drawCrateRevealCore(ctx, cx, cy, t, legendary) {
    const glow = legendary ? "#ffd166" : "#69b4ff";
    this._drawRewardGlow(ctx, cx, cy, 86 + t * 30, glow, 1.1 + t * 0.3);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(Date.now() / 220) * 0.06);
    const size = 62 + t * 10;
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    fillRoundRect(ctx, -size, -size, size * 2, size * 2, 24);
    ctx.strokeStyle = legendary ? "rgba(255,214,124,0.9)" : "rgba(105,180,255,0.85)";
    ctx.lineWidth = 2;
    strokeRoundRect(ctx, -size, -size, size * 2, size * 2, 24);
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.round(40 + t * 8)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(legendary ? "👑" : "📦", 0, 4);
    ctx.restore();
  }

  _drawCrate(ctx, x, y, w, h, compact) {
    const s = this.state;
    const legendary = s.crateKind === "legendary";
    const title = legendary ? "Legendary Crate" : "Mystery Crate";
    const sub = legendary
      ? "Legendary açılış: sinematik patlama + ağır slot bandı + glow reveal"
      : "Sandık açılışı: enerji kırılması + sağdan sola slot akışı + final reward";

    ctx.fillStyle = "#fff";
    ctx.font = `900 ${compact ? 19 : 23}px system-ui`;
    ctx.fillText(title, x + 8, y + 24);
    drawLabel(ctx, x + 8, y + 44, sub, "left", `${compact ? 11 : 12}px system-ui`, 0.74);

    const cx = x + w / 2;
    const coreY = y + (compact ? 132 : 148);

    if (s.cratePhase === "charged") {
      const t = clamp((Date.now() - s.crateStartAt) / Math.max(1, s.crateDuration), 0, 1);
      this._drawCrateRevealCore(ctx, cx, coreY, easeInOutCubic(t), legendary);
      drawLabel(ctx, cx, coreY + 102, "Açılış yükleniyor...", "center", `${compact ? 12 : 13}px system-ui`, 0.8);
    } else if (s.cratePhase === "burst") {
      const t = clamp((Date.now() - s.crateStartAt) / Math.max(1, s.crateDuration), 0, 1);
      const radius = 54 + easeOutQuint(t) * (legendary ? 140 : 100);
      this._drawRewardGlow(ctx, cx, coreY, radius, legendary ? "#ffd166" : "#69b4ff", 1.3);
      ctx.strokeStyle = legendary ? `rgba(255,214,124,${0.9 - t * 0.65})` : `rgba(105,180,255,${0.9 - t * 0.65})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, coreY, radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      if (legendary) {
        ctx.globalAlpha = 0.25 + (1 - t) * 0.3;
        for (let i = 0; i < 6; i += 1) {
          const a = (Math.PI * 2 * i) / 6 + Date.now() / 900;
          ctx.beginPath();
          ctx.moveTo(cx, coreY);
          ctx.lineTo(cx + Math.cos(a) * radius, coreY + Math.sin(a) * radius);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    const reelW = w - 18;
    const reelX = x + 9;
    const reelY = y + (compact ? 224 : 254);
    const reelH = compact ? 84 : 92;
    this._drawGlassPanel(ctx, reelX, reelY, reelW, reelH, 24);

    const centerX = reelX + reelW / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.03 + s.introPulse * 0.04})`;
    fillRoundRect(ctx, centerX - 48, reelY + 6, 96, reelH - 12, 18);
    ctx.strokeStyle = legendary ? "rgba(255,214,124,0.82)" : "rgba(105,180,255,0.82)";
    ctx.lineWidth = 2;
    strokeRoundRect(ctx, centerX - 48, reelY + 6, 96, reelH - 12, 18);

    ctx.save();
    roundRectPath(ctx, reelX + 8, reelY + 8, reelW - 16, reelH - 16, 16);
    ctx.clip();
    const itemW = compact ? 92 : 100;
    const gap = 8;
    for (let i = 0; i < s.crateReelItems.length; i += 1) {
      const reward = s.crateReelItems[i];
      const cellX = reelX + 24 + i * itemW - s.crateReelOffset;
      if (cellX < reelX - itemW || cellX > reelX + reelW + itemW) continue;
      const glow = glowForReward(reward, legendary ? "#ffd166" : "#69b4ff");
      ctx.fillStyle = "rgba(10,14,22,0.76)";
      fillRoundRect(ctx, cellX, reelY + 12, itemW - gap, reelH - 24, 18);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1.35;
      strokeRoundRect(ctx, cellX, reelY + 12, itemW - gap, reelH - 24, 18);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${compact ? 20 : 22}px system-ui`;
      ctx.fillText(reward.icon || "🎁", cellX + (itemW - gap) / 2, reelY + 38);
      ctx.font = `800 ${compact ? 9 : 10}px system-ui`;
      const label = formatRewardText(reward);
      ctx.fillText(label.length > 16 ? `${label.slice(0, 15)}…` : label, cellX + (itemW - gap) / 2, reelY + 63);
      ctx.textAlign = "left";
    }
    ctx.restore();

    // narrow center pointer for reel
    ctx.fillStyle = legendary ? "#ffd166" : "#69b4ff";
    fillRoundRect(ctx, centerX - 3, reelY + 4, 6, reelH - 8, 3);

    if (s.cratePhase === "reveal") {
      const rw = s.crateReward;
      const glow = glowForReward(rw, legendary ? "#ffd166" : "#69b4ff");
      const cardH = compact ? 90 : 100;
      const cardY = y + h - cardH - 12;
      this._drawRewardGlow(ctx, x + w / 2, cardY + cardH / 2, 110 + s.crateFlash * 36, glow, 1 + s.crateFlash * 0.8);
      this._drawGlassPanel(ctx, x + 8, cardY, w - 16, cardH, 24);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1.6;
      strokeRoundRect(ctx, x + 8, cardY, w - 16, cardH, 24);
      ctx.save();
      ctx.translate(x + 26, cardY + cardH / 2);
      ctx.scale(s.revealScale, s.revealScale);
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${compact ? 22 : 26}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rw.icon || "🎁", 0, 0);
      ctx.restore();
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${compact ? 18 : 22}px system-ui`;
      ctx.fillText(formatRewardText(rw), x + 62, cardY + 34);
      drawLabel(ctx, x + 62, cardY + 56, legendary ? "Legendary sinematik ödül işlendi." : "Ödül otomatik hesabına işlendi.", "left", `${compact ? 11 : 12}px system-ui`, 0.74);
      const ok = { x: x + w - 142, y: y + 6, w: 126, h: 32 };
      this.hitButtons.push({ rect: ok, action: "confirm_crate" });
      this._drawButton(ctx, ok, "Tamam", legendary ? "gold" : "primary");
    }
  }

  render(ctx, w, h) {
    this.hitButtons = [];
    const bg = (typeof this.assets?.getImage === "function" ? this.assets.getImage("background") : null)
      || (typeof this.assets?.get === "function" ? this.assets.get("background") : null);

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
    og.addColorStop(0, "rgba(2,4,9,0.38)");
    og.addColorStop(1, "rgba(4,6,12,0.52)");
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, w, h);

    const compact = w <= 600 || h <= 900;
    const panelMargin = compact ? 10 : 12;
    const panelX = panelMargin;
    const panelY = 10;
    const panelW = w - panelMargin * 2;
    const panelH = h - (compact ? 20 : 22);

    // transparent, colorless panel
    this._drawGlassPanel(ctx, panelX, panelY, panelW, panelH, compact ? 24 : 28);
    this._drawHeader(ctx, panelX, panelY, panelW, compact);

    const innerX = panelX + 12;
    const innerY = panelY + (compact ? 64 : 72);
    const innerW = panelW - 24;
    const innerH = panelH - (compact ? 76 : 86);

    if (this.state.screen === "wheel") this._drawWheel(ctx, innerX, innerY, innerW, innerH, compact);
    else if (this.state.screen === "crate") this._drawCrate(ctx, innerX, innerY, innerW, innerH, compact);
    else this._drawLobby(ctx, innerX, innerY, innerW, innerH, compact);

    drawParticles(ctx, this.state.particles);

    if (this.toast.text && this.toast.until > Date.now()) {
      const tw = Math.min(panelW - 36, compact ? 300 : 360);
      const tx = panelX + (panelW - tw) / 2;
      const ty = panelY + panelH - (compact ? 56 : 58);
      this._drawGlassPanel(ctx, tx, ty, tw, 36, 18);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      strokeRoundRect(ctx, tx, ty, tw, 36, 18);
      ctx.fillStyle = "#fff";
      ctx.font = "800 13px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.toast.text, tx + tw / 2, ty + 18);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }
}
