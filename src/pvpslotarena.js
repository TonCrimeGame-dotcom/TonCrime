(function () {
  const COLS = 6;
  const ROWS = 6;
  const START_HP = 1000;
  const BASE_SPINS = 25;
  const BONUS_SPINS = 10;
  const BONUS_TRIGGER = 4;
  const MIN_CLUSTER = 8;
  const PLAYER_DECISION_MS = 3000;

  const ICONS = {
    weed:  { id: "weed",  emoji: "🌿", label: "OT",      color: "#35da7b", base: 12, weight: 16 },
    brain: { id: "brain", emoji: "🧠", label: "BEYİN",   color: "#ff5b64", base: 18, weight: 12 },
    drink: { id: "drink", emoji: "🍾", label: "ALKOL",   color: "#ffd166", base: 14, weight: 15 },
    kick:  { id: "kick",  emoji: "🦵", label: "TEKME",   color: "#66e26f", base: 16, weight: 15 },
    slap:  { id: "slap",  emoji: "🖐️", label: "TOKAT",   color: "#76b8ff", base: 11, weight: 17 },
    punch: { id: "punch", emoji: "👊", label: "YUMRUK",  color: "#ffb24a", base: 15, weight: 15 },
    bonus: { id: "bonus", emoji: "⭐", label: "BONUS",   color: "#d68bff", base: 0,  weight: 12 },
  };

  const PAY_SYMBOLS = ["weed", "brain", "drink", "kick", "slap", "punch"];
  const ALL_SYMBOLS = ["weed", "brain", "drink", "kick", "slap", "punch", "bonus"];
  const BOT_NAMES = ["ShadowWolf", "NightTiger", "GhostMafia", "RicoVane", "IronFist", "VoltKral", "SlyRaven"];
  const BONUS_MULTI_VALUES = [2, 3, 5, 8, 10, 12, 15, 20, 25, 50];
  const ICON_PATHS = {
    weed: "./src/assets/weed.png",
    brain: "./src/assets/brain.png",
    drink: "./src/assets/drink.png",
    kick: "./src/assets/kick.png",
    slap: "./src/assets/slap.png",
    punch: "./src/assets/punch.png",
    bonus: "./src/assets/bonus.png",
  };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function choice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function roundRectPath(ctx, x, y, w, h, r) {
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
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function strokeRoundRect(ctx, x, y, w, h, r, stroke, lw) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function weightedSymbol(includeBonus = true) {
    const list = includeBonus ? ALL_SYMBOLS : PAY_SYMBOLS;
    let total = 0;
    for (const id of list) total += ICONS[id].weight;
    let roll = Math.random() * total;
    for (const id of list) {
      roll -= ICONS[id].weight;
      if (roll <= 0) return id;
    }
    return list[list.length - 1];
  }

  function createCell(symbolId) {
    return {
      id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: symbolId,
    };
  }

  function makeBoard() {
    return Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => createCell(weightedSymbol(true)))
    );
  }

  function cloneBoard(board) {
    return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  function countTypes(board) {
    const map = new Map();
    let bonusCount = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        if (!cell) continue;
        if (cell.type === "bonus") {
          bonusCount += 1;
          continue;
        }
        map.set(cell.type, (map.get(cell.type) || 0) + 1);
      }
    }

    return { counts: map, bonusCount };
  }

  function getMultiplierDrop() {
    const count = randInt(1, 3);
    const out = [];
    for (let i = 0; i < count; i++) {
      const value = choice(BONUS_MULTI_VALUES);
      out.push({
        value,
        x: 0.12 + Math.random() * 0.76,
        y: -0.10 - Math.random() * 0.35,
        vy: 0.0045 + Math.random() * 0.0035,
        rot: -0.08 + Math.random() * 0.16,
        size: 0.92 + Math.random() * 0.28,
        glow: 0.7 + Math.random() * 0.6,
      });
    }
    return out;
  }

  function evaluateBoard(board, inBonus) {
    const { counts, bonusCount } = countTypes(board);
    const remove = new Set();
    const hits = [];
    let damage = 0;

    for (const [type, count] of counts.entries()) {
      if (count < MIN_CLUSTER) continue;
      const meta = ICONS[type];
      const extra = count - MIN_CLUSTER;
      const hitDamage = meta.base * count + extra * meta.base * 0.7;
      damage += hitDamage;
      hits.push({ type, count, damage: hitDamage });

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (cell && cell.type === type) remove.add(`${r}:${c}`);
        }
      }
    }

    let bonusTriggered = false;
    if (!inBonus && bonusCount >= BONUS_TRIGGER) {
      bonusTriggered = true;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (cell && cell.type === "bonus") remove.add(`${r}:${c}`);
        }
      }
    }

    if (inBonus && bonusCount > 0) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (cell && cell.type === "bonus") remove.add(`${r}:${c}`);
        }
      }
    }

    return { hits, damage, remove, bonusCount, bonusTriggered, hasAction: remove.size > 0 };
  }

  function tumble(board, removeSet, allowBonus = true) {
    const next = cloneBoard(board);
    const dropMap = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0));

    for (const key of removeSet) {
      const [r, c] = key.split(":").map(Number);
      if (next[r] && next[r][c]) next[r][c] = null;
    }

    for (let c = 0; c < COLS; c++) {
      const stack = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (next[r][c]) stack.push(next[r][c]);
      }

      let wr = ROWS - 1;
      for (let i = 0; i < stack.length; i++) {
        const item = stack[i];
        next[wr][c] = item;
        const oldBottomIndex = i;
        const oldRow = ROWS - 1 - oldBottomIndex;
        dropMap[wr][c] = Math.max(0, oldRow - wr);
        wr -= 1;
      }

      let newCount = 0;
      while (wr >= 0) {
        next[wr][c] = createCell(weightedSymbol(allowBonus));
        newCount += 1;
        dropMap[wr][c] = newCount + wr + 1;
        wr -= 1;
      }
    }

    return { board: next, dropMap };
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function drawSymbolArt(ctx, img, meta, x, y, w, h) {
    const pad = Math.max(4, Math.floor(Math.min(w, h) * 0.08));
    const innerX = x + pad;
    const innerY = y + pad;
    const innerW = Math.max(6, w - pad * 2);
    const innerH = Math.max(6, h - pad * 2);

    if (img && img.complete && (img.naturalWidth || img.width)) {
      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;
      const scale = Math.min(innerW / iw, innerH / ih);
      const dw = Math.max(4, iw * scale);
      const dh = Math.max(4, ih * scale);
      const dx = innerX + (innerW - dw) * 0.5;
      const dy = innerY + (innerH - dh) * 0.5;
      ctx.drawImage(img, dx, dy, dw, dh);
      return;
    }

    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.floor(Math.min(w, h) * 0.72)}px system-ui, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(meta.emoji, x + w / 2, y + h * 0.52);
  }

  function injectStyle() {
    const id = "tc-pvp-slot-style";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      #pvpStart, #pvpStop, #pvpReset { display: none !important; }
      #pvpHeader { display: none !important; }
      #pvpBars { display: none !important; }

      #arena {
        position: relative;
        overflow: hidden;
        touch-action: none;
        background:
          radial-gradient(circle at 50% 16%, rgba(255,94,94,0.14), transparent 30%),
          radial-gradient(circle at 50% 82%, rgba(255,180,70,0.12), transparent 34%),
          linear-gradient(180deg, rgba(16,18,28,0.98), rgba(6,8,14,1)) !important;
      }

      #arena .tc-cage-root.tc-crush-root {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        padding: 10px;
        box-sizing: border-box;
        color: #fff;
        user-select: none;
      }

      #arena .tc-cage-top.tc-crush-top {
        position: relative;
        flex: 0 0 auto;
        padding-top: 4px;
        margin-bottom: 10px;
      }

      #arena .tc-cage-x.tc-crush-x {
        position: absolute;
        right: 0;
        top: 0;
        width: 36px;
        height: 36px;
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 12px;
        background: rgba(0,0,0,0.34);
        color: rgba(255,255,255,0.92);
        font: 900 16px system-ui, Arial;
        backdrop-filter: blur(8px);
        cursor: pointer;
      }

      #arena .tc-cage-title-wrap.tc-crush-title-wrap {
        text-align: center;
        padding: 2px 42px 0;
      }

      #arena .tc-cage-neon.tc-crush-neon {
        display: inline-block;
        font: 900 22px system-ui, Arial;
        letter-spacing: 1.8px;
        text-transform: uppercase;
        color: #ff5858;
        text-shadow: 0 0 4px rgba(255,88,88,0.95), 0 0 10px rgba(255,88,88,0.95), 0 0 18px rgba(255,40,40,0.92), 0 0 34px rgba(255,0,0,0.78);
        animation: tcSlotNeon 1.15s ease-in-out infinite alternate;
      }

      @keyframes tcSlotNeon {
        0% { opacity: .76; transform: scale(0.995); }
        100% { opacity: 1; transform: scale(1.01); }
      }

      #arena .tc-cage-sub.tc-crush-sub {
        margin-top: 6px;
        font: 800 11px system-ui, Arial;
        color: rgba(255,255,255,0.74);
        letter-spacing: .4px;
      }

      #arena .tc-cage-row.tc-crush-row {
        display: grid;
        grid-template-columns: 1fr 96px 1fr;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      #arena .tc-cage-vs.tc-crush-vs {
        text-align: center;
        font: 900 16px system-ui, Arial;
        color: rgba(255,255,255,0.9);
      }

      #arena .tc-cage-card.tc-crush-card {
        min-height: 92px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        backdrop-filter: blur(8px);
        padding: 10px 12px;
        box-sizing: border-box;
      }

      #arena .tc-cage-name.tc-crush-name {
        font: 900 13px system-ui, Arial;
        color: rgba(255,255,255,0.96);
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #arena .tc-cage-hpbar.tc-crush-hpbar {
        height: 12px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.10);
      }

      #arena .tc-cage-hpfill.tc-crush-hpfill {
        height: 100%;
        width: 100%;
        transform-origin: left center;
        background: linear-gradient(90deg, #2fe870, #88ffb0);
      }

      #arena .tc-cage-hptext.tc-crush-hptext {
        margin-top: 6px;
        font: 800 11px system-ui, Arial;
        color: rgba(255,255,255,0.76);
        text-align: right;
      }

      #arena .tc-crush-chipline {
        margin-top: 8px;
        min-height: 26px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.18);
        color: rgba(255,255,255,0.92);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 8px;
        font: 800 11px system-ui, Arial;
      }

      #arena .tc-slot-spinbtn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 42px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.16);
        background: linear-gradient(180deg, rgba(255,124,66,0.94), rgba(255,71,121,0.88));
        box-shadow: 0 10px 26px rgba(255,71,121,0.18), inset 0 1px 0 rgba(255,255,255,0.22);
        color: #fff;
        font: 900 13px system-ui, Arial;
        letter-spacing: .4px;
        cursor: pointer;
        padding: 0 14px;
      }

      #arena .tc-slot-spinbtn[disabled] {
        opacity: .46;
        cursor: default;
      }

      #arena .tc-cage-stage.tc-crush-stage {
        position: relative;
        flex: 1 1 auto;
        min-height: 280px;
        border-radius: 20px;
        overflow: hidden;
        background: radial-gradient(circle at 50% 52%, rgba(255,255,255,0.04), transparent 30%), linear-gradient(180deg, rgba(18,22,34,0.88), rgba(6,10,18,0.95));
        border: 1px solid rgba(255,255,255,0.08);
      }

      #arena .tc-cage-canvas.tc-crush-canvas {
        width: 100%;
        height: 100%;
        display: block;
        touch-action: none;
      }

      #arena .tc-cage-toast.tc-crush-toast {
        position: absolute;
        left: 50%;
        bottom: 14px;
        transform: translateX(-50%);
        min-width: 170px;
        max-width: calc(100% - 28px);
        padding: 11px 14px;
        border-radius: 14px;
        background: rgba(0,0,0,0.56);
        border: 1px solid rgba(255,255,255,0.12);
        backdrop-filter: blur(8px);
        text-align: center;
        font: 900 12px system-ui, Arial;
        color: #fff;
        opacity: 0;
        transition: opacity .16s ease;
        pointer-events: none;
      }

      #arena .tc-cage-toast.tc-crush-toast.on { opacity: 1; }

      #arena .tc-slot-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 10px;
      }

      #arena .tc-slot-meta {
        min-width: 0;
        flex: 1 1 auto;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      #arena .tc-slot-meta-chip {
        min-height: 42px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.22);
        color: rgba(255,255,255,0.92);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 10px;
        text-align: center;
        font: 800 12px system-ui, Arial;
        letter-spacing: .2px;
        white-space: nowrap;
      }

      #arena .tc-cage-rule.tc-crush-rule {
        margin-top: 8px;
        text-align: center;
        font: 800 11px system-ui, Arial;
        color: rgba(255,255,255,0.65);
      }

      @media (max-width: 520px) {
        #arena .tc-cage-root.tc-crush-root { padding: 8px; }
        #arena .tc-cage-neon.tc-crush-neon { font-size: 18px; }
        #arena .tc-cage-row.tc-crush-row { grid-template-columns: 1fr 78px 1fr; gap: 8px; margin-bottom: 8px; }
        #arena .tc-cage-card.tc-crush-card { min-height: 88px; padding: 9px 10px; }
        #arena .tc-cage-vs.tc-crush-vs { font-size: 13px; }
        #arena .tc-slot-spinbtn { height: 38px; font-size: 12px; padding: 0 12px; }
        #arena .tc-slot-footer { gap: 8px; margin-top: 8px; }
        #arena .tc-slot-meta { gap: 6px; }
        #arena .tc-slot-meta-chip { min-height: 38px; font-size: 11px; padding: 0 6px; }
      }

      @media (max-width: 420px) {
        #arena .tc-cage-root.tc-crush-root { padding: 6px; }
        #arena .tc-cage-title-wrap.tc-crush-title-wrap { padding: 2px 34px 0; }
        #arena .tc-cage-neon.tc-crush-neon { font-size: 16px; letter-spacing: 1.1px; }
        #arena .tc-cage-sub.tc-crush-sub { font-size: 10px; }
        #arena .tc-cage-row.tc-crush-row { grid-template-columns: 1fr 62px 1fr; gap: 6px; }
        #arena .tc-cage-card.tc-crush-card { min-height: 80px; padding: 8px; border-radius: 14px; }
        #arena .tc-cage-name.tc-crush-name { font-size: 12px; margin-bottom: 6px; }
        #arena .tc-cage-stage.tc-crush-stage { min-height: 250px; border-radius: 16px; }
        #arena .tc-slot-footer { align-items: stretch; gap: 6px; }
        #arena .tc-slot-meta { gap: 5px; }
        #arena .tc-slot-meta-chip { min-height: 34px; font-size: 10px; padding: 0 4px; border-radius: 12px; }
        #arena .tc-slot-spinbtn { flex: 0 0 108px; height: 36px; font-size: 11px; padding: 0 8px; border-radius: 12px; }
        #arena .tc-cage-rule.tc-crush-rule { margin-top: 6px; font-size: 10px; }
      }
    `;
    document.head.appendChild(style);
  }

  function makeMarkup() {
    return `
      <div class="tc-cage-root tc-crush-root">
        <div class="tc-cage-top tc-crush-top">
          <button class="tc-cage-x tc-crush-x" id="tcSlotClose" type="button" aria-label="Geri">✕</button>

          <div class="tc-cage-title-wrap tc-crush-title-wrap">
            <div class="tc-cage-neon tc-crush-neon">SLOT ARENA</div>
            <div class="tc-cage-sub tc-crush-sub" id="tcSlotSub">6x6 tumble PvP • 4 BONUS ile free spin • 3 sn karar süresi</div>
          </div>
        </div>

        <div class="tc-cage-row tc-crush-row">
          <div class="tc-cage-card tc-crush-card">
            <div class="tc-cage-name tc-crush-name" id="tcSlotEnemyName">Rakip</div>
            <div class="tc-cage-hpbar tc-crush-hpbar"><div class="tc-cage-hpfill tc-crush-hpfill" id="tcSlotEnemyFill"></div></div>
            <div class="tc-cage-hptext tc-crush-hptext" id="tcSlotEnemyText">1000 / 1000</div>
            <div class="tc-crush-chipline" id="tcSlotEnemySpins">Spin: 25</div>
          </div>

          <div class="tc-cage-vs tc-crush-vs" id="tcSlotTurn">VS</div>

          <div class="tc-cage-card tc-crush-card">
            <div class="tc-cage-name tc-crush-name" id="tcSlotMeName">Sen</div>
            <div class="tc-cage-hpbar tc-crush-hpbar"><div class="tc-cage-hpfill tc-crush-hpfill" id="tcSlotMeFill"></div></div>
            <div class="tc-cage-hptext tc-crush-hptext" id="tcSlotMeText">1000 / 1000</div>
            <div class="tc-crush-chipline" id="tcSlotMeSpins">Spin: 25</div>
          </div>
        </div>

        <div class="tc-cage-stage tc-crush-stage" id="tcSlotStage">
          <canvas class="tc-cage-canvas tc-crush-canvas" id="tcSlotCanvas"></canvas>
          <div class="tc-cage-toast tc-crush-toast" id="tcSlotToast"></div>
        </div>

        <div class="tc-slot-footer">
          <div class="tc-slot-meta" id="tcSlotMetaWrap">
            <div class="tc-slot-meta-chip" id="tcSlotChipBase">BASE 25</div>
            <div class="tc-slot-meta-chip" id="tcSlotChipTimer">SPIN SÜRESİ 3</div>
            <div class="tc-slot-meta-chip" id="tcSlotChipTumble">TUMBLE 0</div>
          </div>
          <button class="tc-slot-spinbtn" id="tcSlotSpinBtn" type="button">SPIN BAŞLAT</button>
        </div>

        <div class="tc-cage-rule tc-crush-rule">8+ aynı ikon anywhere = patlar • 4+ BONUS = 10 free spin • Spin tuşu için 3 sn var</div>
      </div>
    `;
  }

  const api = {
    _els: null,
    _state: null,
    _iconImages: {},
    _running: false,
    _locked: false,
    _raf: 0,
    _opponent: { username: "ShadowWolf", isBot: true },
    _unbind: null,
    _resizeObserver: null,
    _queuedResolve: null,
    _turnTimer: null,
    _toastTimer: null,
    _lastTs: 0,

    init(opts = {}) {
      injectStyle();

      const arena = document.getElementById(opts.arenaId || "arena");
      const status = document.getElementById(opts.statusId || "pvpStatus");
      const enemyFill = document.getElementById(opts.enemyFillId || "enemyFill");
      const meFill = document.getElementById(opts.meFillId || "meFill");
      const enemyHpText = document.getElementById(opts.enemyHpTextId || "enemyHpText");
      const meHpText = document.getElementById(opts.meHpTextId || "meHpText");

      if (!arena || !status || !enemyFill || !meFill || !enemyHpText || !meHpText) {
        console.warn("[TonCrimePVP_SLOT] arena/status/bar elementleri bulunamadı");
        return;
      }

      this.stop();
      this._destroyEvents();
      this._preloadAssets();
      arena.innerHTML = makeMarkup();

      const canvas = arena.querySelector("#tcSlotCanvas");
      const ctx = canvas.getContext("2d");

      this._els = {
        arena,
        canvas,
        ctx,
        status,
        enemyFill,
        meFill,
        enemyHpText,
        meHpText,
        rootEnemyFill: arena.querySelector("#tcSlotEnemyFill"),
        rootMeFill: arena.querySelector("#tcSlotMeFill"),
        rootEnemyText: arena.querySelector("#tcSlotEnemyText"),
        rootMeText: arena.querySelector("#tcSlotMeText"),
        enemyName: arena.querySelector("#tcSlotEnemyName"),
        meName: arena.querySelector("#tcSlotMeName"),
        enemySpins: arena.querySelector("#tcSlotEnemySpins"),
        meSpins: arena.querySelector("#tcSlotMeSpins"),
        turn: arena.querySelector("#tcSlotTurn"),
        sub: arena.querySelector("#tcSlotSub"),
        toast: arena.querySelector("#tcSlotToast"),
        closeBtn: arena.querySelector("#tcSlotClose"),
        spinBtn: arena.querySelector("#tcSlotSpinBtn"),
        chipBase: arena.querySelector("#tcSlotChipBase"),
        chipTimer: arena.querySelector("#tcSlotChipTimer"),
        chipTumble: arena.querySelector("#tcSlotChipTumble"),
      };

      this._setupState();
      this._bindEvents();
      this._resizeCanvas();
      this._updateHud();
      this._render();
    },

    async _preloadAssets() {
      const keys = Object.keys(ICON_PATHS);
      const out = {};
      await Promise.all(keys.map(async (key) => {
        out[key] = await loadImage(ICON_PATHS[key]);
      }));
      this._iconImages = out;
      this._render();
    },

    _setupState() {
      this._state = {
        board: makeBoard(),
        meHp: START_HP,
        enemyHp: START_HP,
        meSpins: BASE_SPINS,
        enemySpins: BASE_SPINS,
        turn: "me",
        finished: false,
        spinning: false,
        inBonus: false,
        bonusOwner: null,
        bonusSpinsLeft: 0,
        bonusMultiplierBank: 0,
        displayedMultiplier: 0,
        multipliers: [],
        tumbleIndex: 0,
        info: "Hazır",
        fxHits: [],
        flashUntil: 0,
        shakeUntil: 0,
        spinOffset: 0,
        dropMap: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0)),
        dropProgress: 1,
        markedRemove: new Set(),
        decisionEndsAt: 0,
      };
    },

    setOpponent(opp) {
      this._opponent = opp && opp.username ? { ...opp } : { username: choice(BOT_NAMES), isBot: true };
      if (this._els?.enemyName) this._els.enemyName.textContent = this._opponent.username || "Rakip";
      this._render();
    },

    reset() {
      this.stop();
      if (!this._els) return;
      this._setupState();
      this._updateHud();
      this._setStatus("PvP • Slot Arena hazır");
      this._toast("Hazır");
      this._render();
    },

    start() {
      if (!this._els || !this._state) return;
      if (this._running) return;
      this._running = true;
      this._locked = false;
      if (this._els.meName) this._els.meName.textContent = "Sen";
      if (this._els.enemyName) this._els.enemyName.textContent = this._opponent.username || "Rakip";
      this._setStatus("PvP • Slot Arena başladı");
      this._state.info = "Sıran sende • 3 sn içinde spin başlat";
      this._startTurnWindow();
      this._tick(performance.now());
    },

    stop() {
      this._running = false;
      cancelAnimationFrame(this._raf);
      this._raf = 0;
      clearTimeout(this._queuedResolve);
      this._queuedResolve = null;
      clearTimeout(this._turnTimer);
      this._turnTimer = null;
    },

    _bindEvents() {
      if (!this._els) return;

      const onClose = () => {
        this.stop();
        try {
          const wrap = document.getElementById("pvpWrap");
          if (wrap) wrap.classList.remove("open");
        } catch (_) {}
      };

      const onSpin = async () => {
        if (!this._running || !this._state || this._state.turn !== "me" || this._state.spinning || this._state.finished) return;
        clearTimeout(this._turnTimer);
        this._turnTimer = null;
        await this._spinCurrentTurn();
      };

      this._els.closeBtn?.addEventListener("click", onClose);
      this._els.spinBtn?.addEventListener("click", onSpin);

      this._unbind = () => {
        this._els?.closeBtn?.removeEventListener("click", onClose);
        this._els?.spinBtn?.removeEventListener("click", onSpin);
      };

      if (typeof ResizeObserver !== "undefined") {
        this._resizeObserver = new ResizeObserver(() => {
          this._resizeCanvas();
          this._render();
        });
        this._resizeObserver.observe(this._els.canvas);
      }
    },

    _destroyEvents() {
      try { this._unbind?.(); } catch (_) {}
      this._unbind = null;
      try { this._resizeObserver?.disconnect?.(); } catch (_) {}
      this._resizeObserver = null;
    },

    _resizeCanvas() {
      if (!this._els?.canvas || !this._els?.ctx) return false;
      const canvas = this._els.canvas;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(10, Math.floor((rect.width || 300) * dpr));
      const height = Math.max(10, Math.floor((rect.height || 300) * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      this._els.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    },

    _setStatus(text) {
      if (this._els?.status) this._els.status.textContent = text;
    },

    _toast(text, ms = 1200) {
      if (!this._els?.toast) return;
      this._els.toast.textContent = String(text || "");
      this._els.toast.classList.add("on");
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        if (this._els?.toast) this._els.toast.classList.remove("on");
      }, ms);
    },

    _updateHud() {
      if (!this._els || !this._state) return;
      const s = this._state;
      const mePct = clamp(s.meHp / START_HP, 0, 1) * 100;
      const enemyPct = clamp(s.enemyHp / START_HP, 0, 1) * 100;
      const countdown = s.turn === "me" && !s.spinning && !s.finished && !s.inBonus && s.decisionEndsAt > 0
        ? Math.max(0, Math.ceil((s.decisionEndsAt - Date.now()) / 1000))
        : s.turn === "me" && !s.spinning && !s.finished && s.decisionEndsAt > 0
        ? Math.max(0, Math.ceil((s.decisionEndsAt - Date.now()) / 1000))
        : 0;

      const meHpTxt = `${Math.max(0, Math.round(s.meHp))} / ${START_HP}`;
      const enemyHpTxt = `${Math.max(0, Math.round(s.enemyHp))} / ${START_HP}`;
      const meSpinTxt = `Spin: ${s.meSpins}${s.inBonus && s.bonusOwner === "me" ? ` • BONUS ${s.bonusSpinsLeft}` : ""}`;
      const enemySpinTxt = `Spin: ${s.enemySpins}${s.inBonus && s.bonusOwner === "enemy" ? ` • BONUS ${s.bonusSpinsLeft}` : ""}`;

      this._els.meFill.style.transform = `scaleX(${mePct / 100})`;
      this._els.enemyFill.style.transform = `scaleX(${enemyPct / 100})`;
      this._els.rootMeFill.style.transform = `scaleX(${mePct / 100})`;
      this._els.rootEnemyFill.style.transform = `scaleX(${enemyPct / 100})`;
      this._els.meHpText.textContent = meHpTxt;
      this._els.enemyHpText.textContent = enemyHpTxt;
      this._els.rootMeText.textContent = meHpTxt;
      this._els.rootEnemyText.textContent = enemyHpTxt;
      this._els.meSpins.textContent = meSpinTxt;
      this._els.enemySpins.textContent = enemySpinTxt;
      this._els.turn.textContent = s.inBonus
        ? `${s.turn === "me" ? "SEN" : "RAKİP"} BONUS x${Math.max(0, Math.round(s.displayedMultiplier || 0))}`
        : (s.turn === "me" ? "SEN" : "RAKİP");
      this._els.sub.textContent = s.info;

      const chipBase = s.inBonus
        ? `${s.bonusOwner === "me" ? "SEN" : "RAKİP"} BONUS ${s.bonusSpinsLeft}`
        : `BASE ${Math.max(s.meSpins, s.enemySpins)}`;
      const chipTimer = s.turn === "me" && !s.spinning && !s.finished
        ? `SPIN SÜRESİ ${countdown}`
        : s.turn === "enemy" && !s.finished
        ? "RAKİP DÜŞÜNÜYOR"
        : "SONUÇ";
      const chipTumble = s.inBonus
        ? `ÇARPAN x${Math.max(0, s.bonusMultiplierBank)}`
        : `TUMBLE ${Math.max(0, s.tumbleIndex)}`;

      if (this._els.chipBase) this._els.chipBase.textContent = chipBase;
      if (this._els.chipTimer) this._els.chipTimer.textContent = chipTimer;
      if (this._els.chipTumble) this._els.chipTumble.textContent = chipTumble;

      if (this._els.spinBtn) {
        const show = s.turn === "me" && !s.spinning && !s.finished;
        this._els.spinBtn.style.visibility = show ? "visible" : "hidden";
        this._els.spinBtn.disabled = !show;
        this._els.spinBtn.textContent = show
          ? `SPIN BAŞLAT${countdown > 0 ? ` • ${countdown}` : ""}`
          : "SPIN BAŞLAT";
      }
    },

    _startTurnWindow() {
      const s = this._state;
      if (!s || s.finished || s.spinning) return;
      clearTimeout(this._turnTimer);

      if (s.turn === "me") {
        s.decisionEndsAt = Date.now() + PLAYER_DECISION_MS;
        s.info = s.inBonus && s.bonusOwner === "me"
          ? `Bonus sende • 3 sn içinde spin başlat`
          : `Sıran sende • 3 sn içinde spin başlat`;
        this._updateHud();
        this._render();
        this._turnTimer = setTimeout(() => {
          if (!this._running || !this._state || this._state.turn !== "me" || this._state.spinning || this._state.finished) return;
          this._toast("Süre doldu • sıra rakibe geçti", 950);
          this._advanceTurn(true);
        }, PLAYER_DECISION_MS + 40);
      } else {
        s.decisionEndsAt = 0;
        this._queueAutoTurn(900);
      }
    },

    _queueAutoTurn(delay = 500) {
      clearTimeout(this._queuedResolve);
      this._queuedResolve = setTimeout(async () => {
        this._queuedResolve = null;
        if (!this._running || this._state?.finished || this._state?.spinning) return;
        await this._spinCurrentTurn();
      }, delay);
    },

    async _spinCurrentTurn() {
      const s = this._state;
      if (!s || s.finished || s.spinning) return;
      const actor = s.turn;
      const remaining = actor === "me" ? s.meSpins : s.enemySpins;
      const available = s.inBonus && s.bonusOwner === actor ? s.bonusSpinsLeft : remaining;

      if (available <= 0) {
        this._advanceTurn();
        return;
      }

      clearTimeout(this._turnTimer);
      s.decisionEndsAt = 0;
      s.spinning = true;
      s.tumbleIndex = 0;
      s.markedRemove = new Set();
      s.info = actor === "me" ? "Spin atılıyor..." : `${this._opponent.username || "Rakip"} spin atıyor...`;
      this._updateHud();
      this._render();

      s.board = makeBoard();
      await this._spinAnimation();

      if (s.inBonus && s.bonusOwner === actor) {
        s.bonusSpinsLeft = Math.max(0, s.bonusSpinsLeft - 1);
      } else if (actor === "me") {
        s.meSpins = Math.max(0, s.meSpins - 1);
      } else {
        s.enemySpins = Math.max(0, s.enemySpins - 1);
      }

      await this._resolveTumbles(actor);

      if (s.inBonus && s.bonusOwner === actor && s.bonusSpinsLeft <= 0) {
        s.info = `BONUS BİTTİ • x${Math.max(1, s.bonusMultiplierBank)} sıfırlandı`;
        s.inBonus = false;
        s.bonusOwner = null;
        s.bonusMultiplierBank = 0;
        s.displayedMultiplier = 0;
        s.multipliers = [];
        await new Promise((r) => setTimeout(r, 650));
      }

      s.spinning = false;
      s.markedRemove = new Set();
      s.dropMap = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0));
      s.dropProgress = 1;
      this._updateHud();
      this._render();

      if (!this._checkFinish()) {
        this._advanceTurn();
      }
    },

    async _spinAnimation() {
      const s = this._state;
      const start = performance.now();
      const duration = 720;

      return new Promise((resolve) => {
        const frame = (ts) => {
          if (!this._state || !this._running) return resolve();
          const t = clamp((ts - start) / duration, 0, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          s.spinOffset = (1 - ease) * 38;
          this._render();
          if (t >= 1) {
            s.spinOffset = 0;
            this._render();
            resolve();
            return;
          }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    },

    async _animateDrop(dropMap) {
      const s = this._state;
      s.dropMap = dropMap;
      s.dropProgress = 0;

      const start = performance.now();
      const duration = 360;

      return new Promise((resolve) => {
        const frame = (ts) => {
          if (!this._state || !this._running) return resolve();
          const t = clamp((ts - start) / duration, 0, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          s.dropProgress = ease;
          this._render();
          if (t >= 1) {
            s.dropMap = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0));
            s.dropProgress = 1;
            this._render();
            resolve();
            return;
          }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    },

    async _resolveTumbles(actor) {
      const s = this._state;
      let chain = 0;
      let totalDamage = 0;
      let bonusJustStarted = false;

      while (true) {
        const res = evaluateBoard(s.board, s.inBonus && s.bonusOwner === actor);
        if (!res.hasAction) break;

        chain += 1;
        s.tumbleIndex = chain;
        s.markedRemove = new Set(res.remove);
        s.flashUntil = Date.now() + 300;
        s.info = res.damage > 0 ? `${chain}. tumble • 8+ ikon patladı` : `${chain}. tumble • bonus kontrol`;
        this._render();
        await new Promise((r) => setTimeout(r, 420));

        if (res.damage > 0) {
          let hitDamage = res.damage;
          if (s.inBonus && s.bonusOwner === actor) {
            const drops = getMultiplierDrop();
            s.multipliers = drops;
            const addMulti = drops.reduce((sum, d) => sum + d.value, 0);
            s.bonusMultiplierBank += addMulti;
            s.displayedMultiplier = s.bonusMultiplierBank;
            hitDamage *= Math.max(1, s.bonusMultiplierBank);
            s.info = `${chain}. tumble • x${s.bonusMultiplierBank} çarpan`;
          } else {
            s.info = `${chain}. tumble`;
          }
          totalDamage += hitDamage;
          this._applyDamage(actor === "me" ? "enemy" : "me", hitDamage);
          this._spawnHitFx(res.hits, actor === "me");
          this._toast(`${this._hitSummary(res.hits)} • ${Math.round(hitDamage)} hasar`, 900);
        }

        if (res.bonusTriggered) {
          s.inBonus = true;
          s.bonusOwner = actor;
          s.bonusSpinsLeft += BONUS_SPINS;
          s.bonusMultiplierBank = 0;
          s.displayedMultiplier = 0;
          s.multipliers = [];
          bonusJustStarted = true;
          this._toast(`⭐ BONUS AÇILDI! +${BONUS_SPINS} spin`, 1400);
          s.info = `${actor === "me" ? "Sen" : "Rakip"} bonus aldı`;
        }

        await new Promise((r) => setTimeout(r, 180));
        const tum = tumble(s.board, res.remove, true);
        s.markedRemove = new Set();
        s.board = tum.board;
        await this._animateDrop(tum.dropMap);
        await new Promise((r) => setTimeout(r, 120));
        if (this._checkFinish()) return;
      }

      if (totalDamage <= 0 && !bonusJustStarted) {
        s.info = s.turn === "me" ? "Boş spin" : "Rakip boş spin";
        this._toast("Kazanç yok", 700);
      }
      s.markedRemove = new Set();
    },

    _hitSummary(hits) {
      if (!hits || !hits.length) return "Kazanç";
      return hits.slice(0, 2).map((h) => `${ICONS[h.type].label} x${h.count}`).join(" + ");
    },

    _spawnHitFx(hits, fromMe) {
      const now = performance.now();
      for (const h of hits) {
        const meta = ICONS[h.type];
        this._state.fxHits.push({
          text: `${meta.label} • ${Math.round(h.damage)}`,
          color: meta.color,
          bornAt: now,
          side: fromMe ? "right" : "left",
          y: 0.44 + Math.random() * 0.18,
          life: 1,
        });
      }
      this._state.flashUntil = Date.now() + 120;
      this._state.shakeUntil = Date.now() + 180;
    },

    _applyDamage(target, amount) {
      if (!this._state || amount <= 0) return;
      if (target === "enemy") this._state.enemyHp = clamp(this._state.enemyHp - amount, 0, START_HP);
      else this._state.meHp = clamp(this._state.meHp - amount, 0, START_HP);
      this._updateHud();
    },

    _advanceTurn(skipped = false) {
      const s = this._state;
      if (!s || s.finished) return;

      clearTimeout(this._turnTimer);
      this._turnTimer = null;
      clearTimeout(this._queuedResolve);
      this._queuedResolve = null;

      if (!skipped && s.inBonus && s.bonusOwner === s.turn && s.bonusSpinsLeft > 0) {
        s.info = `${s.turn === "me" ? "Sen" : "Rakip"} bonus devam`;
        this._startTurnWindow();
        return;
      }

      s.turn = s.turn === "me" ? "enemy" : "me";
      s.info = s.turn === "me" ? "Sıran sende • 3 sn içinde spin başlat" : `${this._opponent.username || "Rakip"} sırada`;
      this._updateHud();
      this._render();
      this._checkFinish();
      if (!s.finished) this._startTurnWindow();
    },

    _checkFinish() {
      const s = this._state;
      if (!s || s.finished) return true;

      if (s.enemyHp <= 0) return this._finish(true, "Rakip düştü");
      if (s.meHp <= 0) return this._finish(false, "Sen düştün");

      const meDone = s.meSpins <= 0 && (!s.inBonus || s.bonusOwner !== "me" || s.bonusSpinsLeft <= 0);
      const enemyDone = s.enemySpins <= 0 && (!s.inBonus || s.bonusOwner !== "enemy" || s.bonusSpinsLeft <= 0);

      if (meDone && enemyDone && !s.spinning) {
        if (s.meHp >= s.enemyHp) return this._finish(true, "Spinler bitti • HP üstünlüğü");
        return this._finish(false, "Spinler bitti • Rakip önde");
      }
      return false;
    },

    _finish(win, reason) {
      const s = this._state;
      if (!s || s.finished) return true;
      s.finished = true;
      s.spinning = false;
      s.decisionEndsAt = 0;
      this._running = false;
      this._locked = true;
      clearTimeout(this._turnTimer);
      clearTimeout(this._queuedResolve);
      this._setStatus(win ? "PvP • Kazandın" : "PvP • Kaybettin");
      s.info = reason || (win ? "Kazandın" : "Kaybettin");
      this._toast(win ? "Kazandın!" : "Kaybettin!", 1200);
      this._recordResult(win);
      this._updateHud();
      this._render();
      return true;
    },

    _recordResult(win) {
      const store = window.tcStore;
      const now = Date.now();
      const opponent = this._opponent?.username || "Rakip";
      const resultItem = {
        id: `pvp_${now}`,
        opponent,
        result: win ? "win" : "loss",
        mode: "slot_arena",
        meHp: Math.round(this._state?.meHp || 0),
        enemyHp: Math.round(this._state?.enemyHp || 0),
        at: now,
      };

      if (store?.get && store?.set) {
        const state = store.get() || {};
        const pvp = { ...(state.pvp || {}) };
        const recentMatches = Array.isArray(pvp.recentMatches) ? pvp.recentMatches.slice(0, 19) : [];
        const leaderboard = Array.isArray(pvp.leaderboard) ? pvp.leaderboard.slice() : [];
        const playerName = String(state?.player?.username || "Player");

        pvp.wins = Number(pvp.wins || 0) + (win ? 1 : 0);
        pvp.losses = Number(pvp.losses || 0) + (win ? 0 : 1);
        pvp.rating = clamp(Number(pvp.rating || 1000) + (win ? 20 : -12), 0, 99999);
        pvp.currentOpponent = opponent;
        pvp.recentMatches = [resultItem, ...recentMatches];

        const score = Number(pvp.rating || 1000) + Number(pvp.wins || 0) * 8;
        const nextBoard = leaderboard.filter((x) => x && x.name !== playerName);
        nextBoard.push({
          id: String(state?.player?.id || "player_main"),
          name: playerName,
          wins: Number(pvp.wins || 0),
          losses: Number(pvp.losses || 0),
          rating: Number(pvp.rating || 1000),
          score,
          updatedAt: now,
        });
        nextBoard.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        pvp.leaderboard = nextBoard.slice(0, 50);

        store.set({ pvp });
      }

      const eventName = win ? "tc:pvp:win" : "tc:pvp:lose";
      try {
        window.dispatchEvent(new CustomEvent(eventName, { detail: resultItem }));
      } catch (_) {
        window.dispatchEvent(new Event(eventName));
      }
    },

    _tick(ts) {
      if (!this._running || !this._els || !this._state) return;
      const dt = this._lastTs ? Math.min(33, ts - this._lastTs) : 16;
      this._lastTs = ts;
      this._updateFx(dt);
      this._updateHud();
      this._render();
      this._raf = requestAnimationFrame((t) => this._tick(t));
    },

    _updateFx(dt) {
      const s = this._state;
      if (!s) return;
      const now = performance.now();
      for (let i = s.fxHits.length - 1; i >= 0; i--) {
        const fx = s.fxHits[i];
        const age = (now - fx.bornAt) / 850;
        fx.life = 1 - age;
        if (fx.life <= 0) s.fxHits.splice(i, 1);
      }

      if (s.multipliers?.length) {
        for (let i = s.multipliers.length - 1; i >= 0; i--) {
          const m = s.multipliers[i];
          m.y += m.vy * dt;
          if (m.y > 0.82) s.multipliers.splice(i, 1);
        }
      }
    },

    _drawBoard(ctx, x, y, w, h) {
      const s = this._state;
      const board = s.board;
      const small = w <= 420 || h <= 420;
      const gap = Math.max(small ? 3 : 5, Math.floor(Math.min(w / COLS, h / ROWS) * (small ? 0.05 : 0.08)));
      const cellW = Math.floor((w - gap * (COLS - 1)) / COLS);
      const cellH = Math.floor((h - gap * (ROWS - 1)) / ROWS);
      const spinOffset = s.spinOffset || 0;
      const flashPulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.02);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const px = x + c * (cellW + gap);
          const extraRows = s.dropMap?.[r]?.[c] || 0;
          const dropPx = extraRows > 0 ? (1 - s.dropProgress) * extraRows * (cellH + gap) : 0;
          const py = y + r * (cellH + gap) - dropPx + spinOffset;
          const cell = board[r][c];
          const meta = ICONS[cell?.type] || ICONS.punch;
          const key = `${r}:${c}`;
          const marked = s.markedRemove && s.markedRemove.has(key);

          const panel = ctx.createLinearGradient(px, py, px, py + cellH);
          panel.addColorStop(0, marked ? `rgba(255,255,255,${0.18 + flashPulse * 0.24})` : "rgba(255,255,255,0.10)");
          panel.addColorStop(1, marked ? `rgba(255,180,90,${0.10 + flashPulse * 0.14})` : "rgba(255,255,255,0.04)");
          fillRoundRect(ctx, px, py, cellW, cellH, 18, panel);
          strokeRoundRect(ctx, px, py, cellW, cellH, 18, marked ? "rgba(255,220,120,0.88)" : "rgba(255,255,255,0.11)", marked ? 2.1 : 1.2);

          const glow = ctx.createRadialGradient(px + cellW / 2, py + cellH / 2, 6, px + cellW / 2, py + cellH / 2, Math.max(cellW, cellH) * 0.52);
          glow.addColorStop(0, marked ? "rgba(255,235,150,0.95)" : meta.color + "99");
          glow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px + cellW / 2, py + cellH / 2, Math.min(cellW, cellH) * (marked ? 0.46 : 0.38), 0, Math.PI * 2);
          ctx.fill();

          if (marked) {
            ctx.fillStyle = `rgba(255,255,255,${0.10 + flashPulse * 0.18})`;
            fillRoundRect(ctx, px + 3, py + 3, cellW - 6, cellH - 6, 15, ctx.fillStyle);
          }

          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          drawSymbolArt(ctx, this._iconImages?.[cell?.type], meta, px, py, cellW, cellH);
        }
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },

    _drawMultipliers(ctx, x, y, w, h) {
      const s = this._state;
      if (!s.inBonus) return;

      for (const m of s.multipliers) {
        const px = x + w * m.x;
        const py = y + h * m.y;
        const bw = 58 * m.size;
        const bh = 34 * m.size;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(m.rot);
        const grad = ctx.createLinearGradient(-bw / 2, -bh / 2, -bw / 2, bh / 2);
        grad.addColorStop(0, "rgba(214,139,255,0.95)");
        grad.addColorStop(1, "rgba(121,75,255,0.95)");
        fillRoundRect(ctx, -bw / 2, -bh / 2, bw, bh, 12, grad);
        strokeRoundRect(ctx, -bw / 2, -bh / 2, bw, bh, 12, "rgba(255,255,255,0.25)", 1);
        ctx.shadowColor = "rgba(214,139,255,0.75)";
        ctx.shadowBlur = 18 * m.glow;
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${Math.floor(16 * m.size)}px system-ui, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`x${m.value}`, 0, 1);
        ctx.restore();
      }
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },

    _drawHudInsideStage(ctx, x, y, w) {
      const s = this._state;
      const infoY = y + 18;
      const countdown = s.turn === "me" && !s.spinning && !s.finished && s.decisionEndsAt > 0 ? Math.max(0, Math.ceil((s.decisionEndsAt - Date.now()) / 1000)) : 0;

      const chip1 = s.inBonus
        ? `${s.bonusOwner === "me" ? "SEN" : "RAKİP"} BONUS ${s.bonusSpinsLeft}`
        : `BASE ${Math.max(s.meSpins, s.enemySpins)}`;
      const chip2 = s.inBonus
        ? `TOPLAM ÇARPAN x${Math.max(0, s.bonusMultiplierBank)}`
        : `TUMBLE ${Math.max(0, s.tumbleIndex)}`;
      const chip3 = s.turn === "me" && !s.spinning && !s.finished ? `SPIN SÜRESİ ${countdown}` : (s.turn === "enemy" ? "RAKİP DÜŞÜNÜYOR" : "SONUÇ");

      fillRoundRect(ctx, x, infoY, 116, 26, 13, "rgba(0,0,0,0.34)");
      fillRoundRect(ctx, x + w - 166, infoY, 166, 26, 13, "rgba(0,0,0,0.34)");
      fillRoundRect(ctx, x + (w - 128) / 2, infoY, 128, 26, 13, "rgba(0,0,0,0.34)");
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "800 12px system-ui, Arial";
      ctx.textBaseline = "middle";
      ctx.fillText(chip1, x + 12, infoY + 13);
      ctx.textAlign = "center";
      ctx.fillText(chip3, x + w / 2, infoY + 13);
      ctx.textAlign = "right";
      ctx.fillText(chip2, x + w - 12, infoY + 13);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },

    _drawHitFx(ctx, w, h) {
      const s = this._state;
      if (!s.fxHits.length) return;
      for (const fx of s.fxHits) {
        const alpha = clamp(fx.life, 0, 1);
        const px = fx.side === "right" ? w * 0.76 : w * 0.24;
        const py = h * fx.y - (1 - fx.life) * 46;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fx.color;
        ctx.font = "900 24px system-ui, Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fx.text, px, py);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },

    _render() {
      if (!this._els?.ctx || !this._state || !this._els?.canvas) return;

      const ctx = this._els.ctx;
      const canvas = this._els.canvas;
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width || 300);
      const h = Math.round(rect.height || 300);
      if (w < 20 || h < 20) return;

      const shakeActive = Date.now() < this._state.shakeUntil;
      const sx = shakeActive ? (Math.random() - 0.5) * 6 : 0;
      const sy = shakeActive ? (Math.random() - 0.5) * 6 : 0;

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(sx, sy);

      const mobile = w <= 420;
      const pad = mobile ? 8 : Math.max(12, Math.floor(w * 0.03));
      const innerX = pad;
      const innerY = mobile ? 8 : 14;
      const innerW = w - pad * 2;
      const innerH = h - (mobile ? 16 : 28);

      const bg = ctx.createLinearGradient(0, innerY, 0, innerY + innerH);
      bg.addColorStop(0, "rgba(28,33,48,0.88)");
      bg.addColorStop(1, "rgba(10,12,18,0.96)");
      fillRoundRect(ctx, innerX, innerY, innerW, innerH, 22, bg);
      strokeRoundRect(ctx, innerX, innerY, innerW, innerH, 22, "rgba(255,255,255,0.08)", 1.2);

      const boardAreaX = innerX + 10;
      const boardAreaY = innerY + 10;
      const boardAreaW = innerW - 20;
      const boardAreaH = innerH - 20;

      this._drawBoard(ctx, boardAreaX, boardAreaY, boardAreaW, boardAreaH);
      this._drawMultipliers(ctx, boardAreaX, boardAreaY, boardAreaW, boardAreaH);
      this._drawHitFx(ctx, w, h);

      if (Date.now() < this._state.flashUntil) {
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fillRect(0, 0, w, h);
      }

      ctx.restore();
    },
  };

  window.TonCrimePVP_SLOT = api;
})();
