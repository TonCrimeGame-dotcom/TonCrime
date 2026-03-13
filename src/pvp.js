class PvpScene {
  constructor({ store, input, scenes, assets }) {
    this.store = store;
    this.input = input;
    this.scenes = scenes;
    this.assets = assets;

    this.scrollY = 0;
    this.dragging = false;
    this.downY = 0;
    this.startScrollY = 0;

    this.cards = [
      {
        id: "grid",
        title: "Grid Heist",
        subtitle: "Sokak Çatışması",
        desc: "Match-3 tarzı grid PvP. Silah, savunma ve ganimet komboları ile rakibi indir.",
        open: true,
      },
      {
        id: "arena",
        title: "Arena Clash",
        subtitle: "1v1 Sokak Dövüşü",
        desc: "Klasik hızlı PvP. Kombolar ve kritik saldırılar.",
        open: true,
      },
      {
        id: "tournament",
        title: "Kartel Turnuvası",
        subtitle: "Sezonluk PvP",
        desc: "Lig sistemi ve sezon puanları.",
        open: false,
      },
    ];

    this.buttons = [];
  }

  enter() {
    this.bg = new Image();
    this.bg.src = "./src/assets/pvp-bg.png";
  }

  update() {
    const p = this.input.pointer;

    if (p.justDown) {
      this.dragging = true;
      this.downY = p.y;
      this.startScrollY = this.scrollY;
    }

    if (!p.down) this.dragging = false;

    if (this.dragging) {
      const dy = p.y - this.downY;
      this.scrollY = this.startScrollY - dy;
    }

    if (this.input.wheelDelta) {
      this.scrollY += this.input.wheelDelta * 0.5;
    }

    this.scrollY = Math.max(0, Math.min(this.scrollY, 800));
  }

  drawCard(ctx, card, x, y, w, h) {
    const r = 18;

    ctx.save();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(15,15,20,0.65)";
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,170,60,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px Inter";
    ctx.fillText(card.title, x + 24, y + 40);

    ctx.fillStyle = "#aaa";
    ctx.font = "16px Inter";
    ctx.fillText(card.subtitle, x + 24, y + 65);

    ctx.fillStyle = "#ccc";
    wrapText(ctx, card.desc, x + 24, y + 95, w - 50, 20);

    const btnW = 100;
    const btnH = 36;

    const bx = x + w - btnW - 20;
    const by = y + 20;

    ctx.fillStyle = card.open ? "#ff9c3a" : "#555";
    roundRect(ctx, bx, by, btnW, btnH, 10);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.font = "bold 16px Inter";
    ctx.textAlign = "center";
    ctx.fillText(card.open ? "Aç" : "Kilitli", bx + btnW / 2, by + 24);

    this.buttons.push({
      card,
      x: bx,
      y: by,
      w: btnW,
      h: btnH,
    });

    ctx.restore();
  }

  render(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (this.bg?.complete) {
      ctx.drawImage(this.bg, 0, 0, w, h);
    }

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, w, h);

    const panelX = 40;
    const panelY = 120;
    const panelW = w - 80;
    const panelH = h - 160;

    ctx.fillStyle = "rgba(20,20,25,0.6)";
    roundRect(ctx, panelX, panelY, panelW, panelH, 24);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,160,60,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px Inter";
    ctx.fillText("PvP • Oyun Seç", panelX + 30, panelY + 50);

    const startY = panelY + 90 - this.scrollY;

    let y = startY;

    this.buttons = [];

    for (const card of this.cards) {
      this.drawCard(ctx, card, panelX + 20, y, panelW - 40, 150);
      y += 170;
    }
  }

  pointerUp(x, y) {
    for (const b of this.buttons) {
      if (
        x > b.x &&
        x < b.x + b.w &&
        y > b.y &&
        y < b.y + b.h &&
        b.card.open
      ) {
        this.startGame(b.card.id);
      }
    }
  }

  startGame(id) {
    if (id === "grid") {
      window.dispatchEvent(new CustomEvent("tc:pvp:grid"));
    }

    if (id === "arena") {
      window.dispatchEvent(new CustomEvent("tc:pvp:arena"));
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line, x, y);
}
window.PvpScene = PvpScene;
window.TonCrimePVP = {
  arena: null,
  enemyFill: null,
  meFill: null,
  enemyHpText: null,
  meHpText: null,

  enemyHp: 100,
  meHp: 100,
  running: false,

  init(cfg) {
    this.arena = document.getElementById(cfg.arenaId);
    this.enemyFill = document.getElementById(cfg.enemyFillId);
    this.meFill = document.getElementById(cfg.meFillId);
    this.enemyHpText = document.getElementById(cfg.enemyHpTextId);
    this.meHpText = document.getElementById(cfg.meHpTextId);
  },

  boot() {
    console.log("[TonCrime] PvP booted");
  },

  start() {
    this.running = true;
    this.enemyHp = 100;
    this.meHp = 100;
    this.updateBars();
    this.loop();
  },

  stop() {
    this.running = false;
  },

  reset() {
    this.enemyHp = 100;
    this.meHp = 100;
    this.updateBars();
  },

  setOpponent(opp) {
    console.log("Opponent:", opp);
  },

  loop() {
    if (!this.running) return;

    const enemyHit = Math.floor(Math.random() * 8);
    const meHit = Math.floor(Math.random() * 8);

    this.enemyHp -= enemyHit;
    this.meHp -= meHit;

    this.enemyHp = Math.max(0, this.enemyHp);
    this.meHp = Math.max(0, this.meHp);

    this.updateBars();

    if (this.enemyHp <= 0) {
      this.running = false;
      window.dispatchEvent(new CustomEvent("tc:pvp:win"));
      return;
    }

    if (this.meHp <= 0) {
      this.running = false;
      window.dispatchEvent(new CustomEvent("tc:pvp:lose"));
      return;
    }

    setTimeout(() => this.loop(), 900);
  },

  updateBars() {
    if (this.enemyFill) this.enemyFill.style.transform = `scaleX(${this.enemyHp / 100})`;
    if (this.meFill) this.meFill.style.transform = `scaleX(${this.meHp / 100})`;

    if (this.enemyHpText) this.enemyHpText.textContent = this.enemyHp;
    if (this.meHpText) this.meHpText.textContent = this.meHp;
  }
};
