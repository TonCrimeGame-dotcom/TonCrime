(function () {
  const GRID = 7;
  const START_HP = 100;
  const START_MOVES = 12;
  const ACTIONS_PER_TURN = 2;
  const TURN_TIME_MS = 30000;
  const DRAG_THRESHOLD = 16;

  const TILE = {
    PUNCH: "punch",
    KICK: "kick",
    SLAP: "slap",
    HEAD: "head",
    WEED: "weed",
  };

  const NORMAL_TYPES = [TILE.PUNCH, TILE.KICK, TILE.SLAP, TILE.HEAD, TILE.WEED];

  const SLOT_DAMAGE = {
    punch: 12,
    kick: 14,
    slap: 8,
    head: 16,
  };

  const TILE_META = {
    [TILE.PUNCH]: { emoji: "👊", color: "#ffb24a", label: "Yumruk" },
    [TILE.KICK]: { emoji: "🦵", color: "#63e36c", label: "Tekme" },
    [TILE.SLAP]: { emoji: "🖐️", color: "#7cb6ff", label: "Tokat" },
    [TILE.HEAD]: { emoji: "🧠", color: "#ff6464", label: "Kafa" },
    [TILE.WEED]: { emoji: "🌿", color: "#30d37b", label: "Ot" },
  };

  const BOT_NAMES = [
    "ShadowWolf",
    "RicoVane",
    "MertKhan",
    "SlyRaven",
    "ViperAce",
    "NoirJack",
    "GhostMafia",
    "VoltKral",
  ];

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function choice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
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

  function makeId() {
    return "tile_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  function createTile(type) {
    return { id: makeId(), type };
  }

  function cloneBoard(board) {
    return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  function inBounds(r, c) {
    return r >= 0 && r < GRID && c >= 0 && c < GRID;
  }

  function isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  function swapCells(board, a, b) {
    const next = cloneBoard(board);
    const tmp = next[a.r][a.c];
    next[a.r][a.c] = next[b.r][b.c];
    next[b.r][b.c] = tmp;
    return next;
  }

  function boardSignature(board) {
    return board.map((row) => row.map((c) => (c ? c.type[0] : "_")).join("")).join("|");
  }

  function getWeightedType(seedBias) {
    const arr = NORMAL_TYPES.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (seedBias + i * 17 + randInt(0, 999)) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr[(seedBias + randInt(0, 999)) % arr.length];
  }

  function findMatches(board) {
    const matches = [];

    for (let r = 0; r < GRID; r++) {
      let c = 0;
      while (c < GRID) {
        const cell = board[r][c];
        if (!cell) {
          c += 1;
          continue;
        }
        const t = cell.type;
        let end = c + 1;
        while (end < GRID && board[r][end] && board[r][end].type === t) end += 1;
        const len = end - c;
        if (len >= 3) {
          const cells = [];
          for (let i = c; i < end; i++) cells.push({ r, c: i });
          matches.push({ dir: "h", type: t, len, cells });
        }
        c = end;
      }
    }

    for (let c = 0; c < GRID; c++) {
      let r = 0;
      while (r < GRID) {
        const cell = board[r][c];
        if (!cell) {
          r += 1;
          continue;
        }
        const t = cell.type;
        let end = r + 1;
        while (end < GRID && board[end][c] && board[end][c].type === t) end += 1;
        const len = end - r;
        if (len >= 3) {
          const cells = [];
          for (let i = r; i < end; i++) cells.push({ r: i, c });
          matches.push({ dir: "v", type: t, len, cells });
        }
        r = end;
      }
    }

    return matches;
  }

  function hasAnyPossibleMove(board) {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const dirs = [
          { r: 0, c: 1 },
          { r: 1, c: 0 },
        ];
        for (const d of dirs) {
          const rr = r + d.r;
          const cc = c + d.c;
          if (!inBounds(rr, cc)) continue;
          const swapped = swapCells(board, { r, c }, { r: rr, c: cc });
          if (findMatches(swapped).length > 0) return true;
        }
      }
    }
    return false;
  }

  function buildFreshBoard(lastSignature) {
    for (let tries = 0; tries < 80; tries++) {
      const seedBias = Date.now() + tries * 31 + randInt(1, 99999);
      const board = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => null));

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          let type = getWeightedType(seedBias + r * 13 + c * 17);
          let guard = 0;
          while (
            guard < 20 &&
            ((c >= 2 &&
              board[r][c - 1] &&
              board[r][c - 2] &&
              board[r][c - 1].type === type &&
              board[r][c - 2].type === type) ||
              (r >= 2 &&
                board[r - 1][c] &&
                board[r - 2][c] &&
                board[r - 1][c].type === type &&
                board[r - 2][c].type === type))
          ) {
            type = getWeightedType(seedBias + guard * 7 + c * 19);
            guard += 1;
          }
          board[r][c] = createTile(type);
        }
      }

      const sig = boardSignature(board);
      if (sig !== lastSignature && findMatches(board).length === 0 && hasAnyPossibleMove(board)) {
        return board;
      }
    }

    return Array.from({ length: GRID }, () =>
      Array.from({ length: GRID }, () => createTile(choice(NORMAL_TYPES)))
    );
  }

  function collapseBoard(board) {
    const next = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => null));
    for (let c = 0; c < GRID; c++) {
      const stack = [];
      for (let r = GRID - 1; r >= 0; r--) {
        if (board[r][c]) stack.push(board[r][c]);
      }
      let wr = GRID - 1;
      for (const item of stack) {
        next[wr][c] = item;
        wr -= 1;
      }
      while (wr >= 0) {
        next[wr][c] = createTile(choice(NORMAL_TYPES));
        wr -= 1;
      }
    }
    return next;
  }

  function evaluateBoard(board) {
    const matches = findMatches(board);
    const remove = new Set();
    let damage = 0;
    let heal = 0;
    let extraMoves = 0;
    const rowClears = [];
    const extraMoveBursts = [];

    for (const m of matches) {
      const bonus = Math.max(0, m.len - 3);

      if (m.len >= 4) {
        extraMoves += 1;
        extraMoveBursts.push({
          type: m.type,
          len: m.len,
          cells: m.cells.map((cell) => ({ ...cell })),
        });

        const rowIndex = m.cells[Math.floor(m.cells.length / 2)]?.r ?? m.cells[0]?.r ?? 0;
        if (!rowClears.includes(rowIndex)) rowClears.push(rowIndex);
      }

      if (m.type === TILE.PUNCH) damage += SLOT_DAMAGE.punch + bonus * 2;
      if (m.type === TILE.KICK) damage += SLOT_DAMAGE.kick + bonus * 3;
      if (m.type === TILE.SLAP) damage += SLOT_DAMAGE.slap + bonus * 2;
      if (m.type === TILE.HEAD) damage += SLOT_DAMAGE.head + bonus * 3;
      if (m.type === TILE.WEED) heal += 10 + bonus * 3;

      for (const cell of m.cells) {
        remove.add(cell.r + ":" + cell.c);
      }
    }

    for (const rowIndex of rowClears) {
      for (let c = 0; c < GRID; c++) {
        remove.add(rowIndex + ":" + c);
      }
    }

    return {
      hasAction: matches.length > 0,
      matches,
      remove,
      damage,
      heal,
      extraMoves,
      rowClears,
      extraMoveBursts,
    };
  }

  function applyResolution(board, resolution) {
    const next = cloneBoard(board);
    for (const key of resolution.remove) {
      const [r, c] = key.split(":").map(Number);
      next[r][c] = null;
    }
    return collapseBoard(next);
  }

  function calcBotMove(board, hpBias) {
    let best = null;

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const dirs = [
          { r: 0, c: 1 },
          { r: 1, c: 0 },
        ];
        for (const d of dirs) {
          const rr = r + d.r;
          const cc = c + d.c;
          if (!inBounds(rr, cc)) continue;

          const swapped = swapCells(board, { r, c }, { r: rr, c: cc });
          const res = evaluateBoard(swapped);
          if (!res.hasAction) continue;

          let score = 0;
          score += res.damage * 3.1;
          score += res.heal * (hpBias < 40 ? 2.5 : 1.1);
          score += res.extraMoves * 24;

          for (const m of res.matches) {
            score += m.len * 5;
            if (m.type === TILE.HEAD) score += 10;
            if (m.type === TILE.KICK) score += 8;
            if (m.type === TILE.PUNCH) score += 6;
            if (m.type === TILE.SLAP) score += 4;
            if (m.type === TILE.WEED) score += hpBias < 55 ? 8 : 2;
          }

          score += Math.random() * 6;

          if (!best || score > best.score) {
            best = { a: { r, c }, b: { r: rr, c: cc }, score };
          }
        }
      }
    }

    return best;
  }

  function makeArenaMarkup() {
    return `
<div class="tc-crush-root">
  <button class="tc-crush-close" id="tcCrushClose" type="button" aria-label="Geri">×</button>

  <div class="tc-crush-head">
    <div class="tc-crush-chip" id="tcCrushMeMoves">Hamle: 12</div>
    <div class="tc-crush-title-wrap">
      <div class="tc-crush-title" id="tcCrushTurn">
        <span class="tc-crush-neon">IQ ARENA</span>
        <small>Rakip aranıyor...</small>
      </div>
      <div class="tc-crush-timer" id="tcCrushTimer">30</div>
    </div>
    <div class="tc-crush-chip" id="tcCrushEnemyMoves">Rakip: 12</div>
  </div>

  <canvas class="tc-crush-canvas"></canvas>
  <div class="tc-crush-toast" id="tcCrushToast"></div>
</div>
    `;
  }

  function injectStyle() {
    const id = "tc-pvp-crush-style";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      #pvpStart, #pvpStop, #pvpReset {
        display: none !important;
      }
      #arena {
        position: relative;
        overflow: hidden;
        touch-action: none;
        background: transparent !important;
      }
      #arena .tc-crush-root {
        position: absolute;
        inset: 0;
        z-index: 5;
        display: flex;
        flex-direction: column;
        padding: 8px 4px 2px;
        box-sizing: border-box;
        background: transparent;
      }
#arena .tc-crush-close {
  position: absolute;
top: -30px;
right: 12px;
  z-index: 50;

  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 0;
  background: transparent;

  color: #ff2b2b;
  font: 900 34px/1 system-ui, Arial;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  box-shadow: none;
  backdrop-filter: none;
  text-shadow:
    0 0 6px rgba(255, 40, 40, 0.9),
    0 0 14px rgba(255, 40, 40, 0.55);
}
      #arena .tc-crush-close:active {
        transform: scale(0.96);
      }
      #arena .tc-crush-head {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 8px;
        align-items: center;
        margin: 2px 42px 10px 0;
        flex: 0 0 auto;
      }
      #arena .tc-crush-title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
      }
      #arena .tc-crush-chip {
        min-height: 32px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.18);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 10px;
        font: 800 12px system-ui, Arial;
        backdrop-filter: blur(4px);
        text-align: center;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
      }
      #arena .tc-crush-title {
        text-align: center;
        color: rgba(255,255,255,0.98);
        font: 900 12px system-ui, Arial;
      }
      #arena .tc-crush-timer {
        min-width: 44px;
        height: 32px;
        padding: 0 10px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(0,0,0,0.10);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font: 900 14px system-ui, Arial;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
      }
      #arena .tc-crush-timer.low {
        color: #ff7676;
        border-color: rgba(255,90,90,0.35);
        text-shadow:
          0 0 6px rgba(255,80,80,0.8),
          0 0 14px rgba(255,44,44,0.55);
      }
      #arena .tc-crush-title small {
        display: block;
        color: rgba(255,255,255,0.76);
        font: 700 10px system-ui, Arial;
        margin-top: 4px;
        letter-spacing: 0.2px;
      }
      #arena .tc-crush-neon {
        display: inline-block;
        color: #ff4e4e;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        text-shadow:
          0 0 4px rgba(255,70,70,0.95),
          0 0 10px rgba(255,70,70,0.95),
          0 0 20px rgba(255,34,34,0.9),
          0 0 34px rgba(255,20,20,0.72);
        animation: tcCrushNeon 1.15s ease-in-out infinite alternate;
      }
      @keyframes tcCrushNeon {
        0% {
          opacity: 0.74;
          filter: brightness(0.86);
          text-shadow:
            0 0 2px rgba(255,70,70,0.85),
            0 0 6px rgba(255,70,70,0.82),
            0 0 14px rgba(255,34,34,0.78);
        }
        100% {
          opacity: 1;
          filter: brightness(1.12);
          text-shadow:
            0 0 5px rgba(255,90,90,1),
            0 0 12px rgba(255,74,74,1),
            0 0 24px rgba(255,36,36,0.95),
            0 0 40px rgba(255,0,0,0.88);
        }
      }
      #arena .tc-crush-canvas {
        display: block;
        width: 100%;
        height: 100%;
        flex: 1 1 auto;
        border-radius: 18px;
        touch-action: none;
        background: transparent;
      }
      #arena .tc-crush-toast {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 8;
        padding: 10px 14px;
        min-width: 180px;
        border-radius: 14px;
        background: rgba(0,0,0,0.22);
        border: 1px solid rgba(255,255,255,0.12);
        color: #fff;
        font: 900 13px system-ui, Arial;
        opacity: 0;
        pointer-events: none;
        transition: opacity .16s ease;
        backdrop-filter: blur(8px);
        text-align: center;
      }
      #arena .tc-crush-toast.on {
        opacity: 1;
      }
      @media (max-width: 520px) {
        #arena .tc-crush-root {
          padding: 6px 2px 0;
        }
        #arena .tc-crush-head {
          gap: 6px;
          margin: 0 38px 8px 0;
        }
        #arena .tc-crush-chip {
          min-height: 30px;
          padding: 0 8px;
          font-size: 11px;
          border-radius: 10px;
        }
        #arena .tc-crush-title {
          font-size: 11px;
        }
        #arena .tc-crush-timer {
          min-width: 38px;
          height: 30px;
          font-size: 12px;
          border-radius: 10px;
        }
        #arena .tc-crush-close {
          width: 32px;
          height: 32px;
          top: 4px;
          right: 4px;
        }
        #arena .tc-crush-title small {
          font-size: 9px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const api = {
    _inited: false,
    _running: false,
    _locked: false,
    _els: null,
    _state: null,
    _selected: null,
    _tileRects: [],
    _lastSignature: "",
    _opponent: { username: "Rakip", isBot: true },
    _turnTimer: null,
    _queueTimer: null,
    _timerTick: null,
    _frameHandle: null,
    _pointerDown: null,
    _dragStart: null,
    _dragFromTile: null,
    _dragConsumed: false,
    _releaseGuard: false,
    _fx: [],
    _unbind: null,

    init(opts = {}) {
      injectStyle();

      const arena = document.getElementById(opts.arenaId || "arena");
      const status = document.getElementById(opts.statusId || "pvpStatus");
      const enemyFill = document.getElementById(opts.enemyFillId || "enemyFill");
      const meFill = document.getElementById(opts.meFillId || "meFill");
      const enemyHpText = document.getElementById(opts.enemyHpTextId || "enemyHpText");
      const meHpText = document.getElementById(opts.meHpTextId || "meHpText");

      if (!arena || !status || !enemyFill || !meFill || !enemyHpText || !meHpText) {
        console.warn("[TonCrimePVP_CRUSH] arena/status/bar elementleri bulunamadı");
        return;
      }

      ["pvpStart", "pvpStop", "pvpReset"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
      });

      this._destroyCanvasEvents();
      clearTimeout(this._queueTimer);
      clearTimeout(this._turnTimer);

      arena.innerHTML = makeArenaMarkup();
      const canvas = arena.querySelector(".tc-crush-canvas");
      const ctx = canvas.getContext("2d");

      this._els = {
        arena,
        status,
        enemyFill,
        meFill,
        enemyHpText,
        meHpText,
        canvas,
        ctx,
        meMoves: arena.querySelector("#tcCrushMeMoves"),
        enemyMoves: arena.querySelector("#tcCrushEnemyMoves"),
        turn: arena.querySelector("#tcCrushTurn"),
        timer: arena.querySelector("#tcCrushTimer"),
        closeBtn: arena.querySelector("#tcCrushClose"),
        toast: arena.querySelector("#tcCrushToast"),
      };

      if (this._els.closeBtn) {
        this._els.closeBtn.onclick = () => this.close();
      }

      this._bindCanvas();
      this._safeResizeSequence();
      this._startFrameLoop();
      this.reset();

      this._inited = true;
      this._setStatus("IQ ARENA hazır");
    },

    setOpponent(opp) {
      if (opp && typeof opp.username === "string") {
        this._opponent = { ...opp };
      }
      if (this._state) this._updateHud();
    },

    async start() {
      if (!this._inited) return;
      await this._waitUntilVisible();

      this.reset();
      this._running = true;
      this._locked = true;
      this._state.matchmaking = true;
      this._state.turn = "me";
      this._state.info = "Rakip aranıyor...";
      this._setStatus("IQ ARENA • rakip aranıyor");
      this._toast("Rakip aranıyor...");
      this._updateHud();
      this._render();

      clearTimeout(this._queueTimer);
      this._queueTimer = setTimeout(() => {
        if (!this._running) return;
        this._spawnBotAfterQueue();
      }, 5000);
    },

    stop() {
      this._running = false;
      this._locked = false;
      this._selected = null;
      this._pointerDown = null;
      this._dragStart = null;
      this._dragFromTile = null;
      clearTimeout(this._turnTimer);
      clearTimeout(this._queueTimer);
      this._clearTurnTimer();
      this._turnTimer = null;
      this._queueTimer = null;
      this._fx = [];
      if (this._state) {
        this._state.matchmaking = false;
        this._state.info = "Maç durduruldu";
      }
      this._setStatus("IQ ARENA durdu");
      this._render();
    },

    reset() {
      clearTimeout(this._turnTimer);
      clearTimeout(this._queueTimer);
      this._clearTurnTimer();
      this._turnTimer = null;
      this._queueTimer = null;
      this._running = false;
      this._locked = false;
      this._selected = null;
      this._pointerDown = null;
      this._dragStart = null;
      this._dragFromTile = null;
      this._dragConsumed = false;

      const board = buildFreshBoard(this._lastSignature);
      this._lastSignature = boardSignature(board);

      this._state = {
        board,
        turn: "me",
        meHp: START_HP,
        enemyHp: START_HP,
        meMoves: START_MOVES,
        enemyMoves: START_MOVES,
        meActionLeft: ACTIONS_PER_TURN,
        enemyActionLeft: ACTIONS_PER_TURN,
        info: "Maç hazır",
        matchmaking: false,
        finished: false,
        turnEndsAt: 0,
        turnSecondsLeft: Math.ceil(TURN_TIME_MS / 1000),
      };

      this._safeResizeSequence();
      this._updateHud();
      this._render();
    },

    _spawnBotAfterQueue() {
      const name = choice(BOT_NAMES);
      this._opponent = { username: name, isBot: true };
      this._state.matchmaking = false;
      this._state.info = `${name} bulundu • Bot`;
      this._setStatus(`IQ ARENA • ${name} bulundu`);
      this._toast(`${name} maça girdi`);
      this._locked = false;
      this._startTurnTimer("me");
      this._updateHud();
      this._render();
    },

    _startFrameLoop() {
      if (this._frameHandle) return;
      const step = () => {
        if (!this._inited) {
          this._frameHandle = null;
          return;
        }
        this._render();
        this._frameHandle = requestAnimationFrame(step);
      };
      this._frameHandle = requestAnimationFrame(step);
    },

    _stopFrameLoop() {
      if (this._frameHandle) cancelAnimationFrame(this._frameHandle);
      this._frameHandle = null;
    },

    _clearTurnTimer() {
      clearInterval(this._timerTick);
      this._timerTick = null;
      if (this._state) {
        this._state.turnEndsAt = 0;
        this._state.turnSecondsLeft = 0;
      }
    },

    _startTurnTimer(turn) {
      if (!this._state || this._state.finished || this._state.matchmaking) return;
      this._clearTurnTimer();
      this._state.turn = turn;
      this._state.turnEndsAt = Date.now() + TURN_TIME_MS;
      this._state.turnSecondsLeft = Math.ceil(TURN_TIME_MS / 1000);
      this._timerTick = setInterval(() => {
        if (!this._state || this._state.finished || this._state.matchmaking) {
          this._clearTurnTimer();
          return;
        }
        const left = Math.max(0, this._state.turnEndsAt - Date.now());
        this._state.turnSecondsLeft = Math.ceil(left / 1000);
        if (left <= 0) {
          this._clearTurnTimer();
          this._onTurnExpired();
        }
      }, 120);
    },

    _queueFx(fx) {
      this._fx.push({ ...fx, id: Date.now() + Math.random() });
    },

    _onTurnExpired() {
      if (!this._running || !this._state || this._state.finished) return;

      if (this._state.turn === "me") {
        this._state.info = "Süre bitti • Raund rakibe geçti";
        this._state.turn = "enemy";
        this._state.enemyActionLeft = ACTIONS_PER_TURN;
        this._toast("Süre doldu");
        this._locked = true;
        this._updateHud();
        this._render();
        this._turnTimer = setTimeout(() => this._enemyPlay(), 500);
      } else {
        this._state.info = "Rakibin süresi doldu";
        this._state.turn = "me";
        this._state.meActionLeft = ACTIONS_PER_TURN;
        this._toast("Rakibin süresi doldu");
        this._locked = false;
        this._startTurnTimer("me");
        this._updateHud();
        this._render();
      }
    },

    close() {
      this.stop();
      this._clearTurnTimer();
      try {
        const wrap = document.getElementById("pvpWrap");
        if (wrap) {
          wrap.classList.remove("open");
          wrap.style.display = "none";
        }
        const layer = document.getElementById("pvpLayer");
        if (layer) layer.style.pointerEvents = "none";
        const fab = document.getElementById("pvpFab");
        if (fab) fab.style.display = "";
      } catch (_) {}
      try {
        window.dispatchEvent(new Event("tc:closePvp"));
      } catch (_) {}
    },

    _bindCanvas() {
      const canvas = this._els.canvas;
      const getPos = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const touch = ev.touches?.[0] || ev.changedTouches?.[0];
        const clientX = touch ? touch.clientX : ev.clientX;
        const clientY = touch ? touch.clientY : ev.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
      };

      const directionTarget = (from, dx, dy) => {
        if (!from) return null;
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return null;
        if (Math.abs(dx) >= Math.abs(dy)) {
          const nc = from.c + (dx > 0 ? 1 : -1);
          if (!inBounds(from.r, nc)) return null;
          return { r: from.r, c: nc };
        }
        const nr = from.r + (dy > 0 ? 1 : -1);
        if (!inBounds(nr, from.c)) return null;
        return { r: nr, c: from.c };
      };

      const onDown = (ev) => {
        if (!this._running || this._locked || this._state?.turn !== "me" || this._state?.matchmaking) return;
        const p = getPos(ev);
        const hit = this._hitTile(p.x, p.y);
        if (!hit) return;
        this._pointerDown = hit;
        this._selected = hit;
        this._dragStart = p;
        this._dragFromTile = hit;
        this._dragConsumed = false;
        this._releaseGuard = false;
        this._render();
        ev.preventDefault?.();
      };

      const onMove = (ev) => {
        if (!this._running || this._locked || this._state?.turn !== "me" || this._state?.matchmaking) return;
        if (!this._dragStart || !this._dragFromTile || this._dragConsumed) return;
        const p = getPos(ev);
        const dx = p.x - this._dragStart.x;
        const dy = p.y - this._dragStart.y;
        const target = directionTarget(this._dragFromTile, dx, dy);
        if (!target) return;
        this._dragConsumed = true;
        this._selected = null;
        this._pointerDown = null;
        this._dragStart = null;
        this._playerMove(this._dragFromTile, target);
        ev.preventDefault?.();
      };

      const onUp = (ev) => {
        if (!this._running || this._locked || this._state?.turn !== "me" || this._state?.matchmaking) return;
        if (this._releaseGuard) return;
        this._releaseGuard = true;

        const from = this._selected || this._pointerDown;
        const startedDrag = !!this._dragFromTile;
        const dragConsumed = !!this._dragConsumed;
        const p = getPos(ev);
        const hit = this._hitTile(p.x, p.y);

        this._pointerDown = null;
        this._dragStart = null;
        this._dragFromTile = null;
        this._dragConsumed = false;

        if (!startedDrag || dragConsumed) return;
        if (!from && !hit) {
          this._selected = null;
          this._render();
          return;
        }
        if (!hit) {
          this._selected = from || null;
          this._render();
          return;
        }
        if (this._selected && this._selected.r === hit.r && this._selected.c === hit.c) {
          this._render();
          return;
        }
        if (!from) {
          this._selected = hit;
          this._render();
          return;
        }
        if (!isAdjacent(from, hit)) {
          this._selected = hit;
          this._render();
          return;
        }
        this._selected = null;
        this._playerMove(from, hit);
        ev.preventDefault?.();
      };

      const onCancel = () => {
        this._pointerDown = null;
        this._dragStart = null;
        this._dragFromTile = null;
        this._dragConsumed = false;
        this._releaseGuard = false;
      };

      const onResize = () => {
        this._safeResizeSequence();
        this._render();
      };

      canvas.addEventListener("mousedown", onDown);
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("mouseup", onUp);
      canvas.addEventListener("mouseleave", onCancel);
      canvas.addEventListener("touchstart", onDown, { passive: false });
      canvas.addEventListener("touchmove", onMove, { passive: false });
      canvas.addEventListener("touchend", onUp, { passive: false });
      canvas.addEventListener("touchcancel", onCancel, { passive: false });
      window.addEventListener("resize", onResize);

      this._unbind = () => {
        canvas.removeEventListener("mousedown", onDown);
        canvas.removeEventListener("mousemove", onMove);
        canvas.removeEventListener("mouseup", onUp);
        canvas.removeEventListener("mouseleave", onCancel);
        canvas.removeEventListener("touchstart", onDown);
        canvas.removeEventListener("touchmove", onMove);
        canvas.removeEventListener("touchend", onUp);
        canvas.removeEventListener("touchcancel", onCancel);
        window.removeEventListener("resize", onResize);
      };
    },

    _destroyCanvasEvents() {
      if (this._unbind) {
        this._unbind();
        this._unbind = null;
      }
    },

    _resizeCanvas() {
      if (!this._els?.canvas || !this._els?.ctx) return false;
      const canvas = this._els.canvas;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(10, Math.floor(rect.width * dpr));
      const height = Math.max(10, Math.floor(rect.height * dpr));
      if (!rect.width || !rect.height) return false;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      this._els.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    },

    _safeResizeSequence() {
      this._resizeCanvas();
      setTimeout(() => {
        this._resizeCanvas();
        this._render();
      }, 50);
      setTimeout(() => {
        this._resizeCanvas();
        this._render();
      }, 140);
      requestAnimationFrame(() => {
        this._resizeCanvas();
        this._render();
      });
    },

    async _waitUntilVisible() {
      if (!this._els?.arena) return;
      for (let i = 0; i < 20; i++) {
        const rect = this._els.arena.getBoundingClientRect();
        if (rect.width > 40 && rect.height > 40) {
          this._resizeCanvas();
          return;
        }
        await this._sleep(30);
      }
      this._resizeCanvas();
    },

    _hitTile(x, y) {
      for (const r of this._tileRects) {
        if (pointInRect(x, y, r)) return r;
      }
      return null;
    },

    _setStatus(text) {
      if (!this._els?.status) return;
      this._els.status.innerHTML = `<span style="color:#fff;opacity:.96">PvP • </span><span class="tc-crush-neon">IQ ARENA</span><span style="color:#fff;opacity:.88"> ${text ? "• " + text : ""}</span>`;
    },

    _toast(text) {
      const el = this._els?.toast;
      if (!el) return;
      el.textContent = String(text || "");
      el.classList.add("on");
      clearTimeout(el._offTimer);
      el._offTimer = setTimeout(() => el.classList.remove("on"), 1100);
    },

    _updateHud() {
      if (!this._els || !this._state) return;
      const s = this._state;
      this._els.meFill.style.transform = `scaleX(${clamp(s.meHp, 0, 100) / 100})`;
      this._els.enemyFill.style.transform = `scaleX(${clamp(s.enemyHp, 0, 100) / 100})`;
      this._els.meHpText.textContent = Math.round(s.meHp);
      this._els.enemyHpText.textContent = Math.round(s.enemyHp);
      if (this._els.meMoves) this._els.meMoves.textContent = `Hamle: ${s.meMoves}`;
      if (this._els.enemyMoves) this._els.enemyMoves.textContent = `${this._opponent.username}: ${s.enemyMoves}`;
      if (this._els.turn) {
        const who = s.matchmaking ? "IQ ARENA" : s.turn === "me" ? "SEN" : this._opponent.username.toUpperCase();
        const sub = s.matchmaking
          ? "5sn içinde rakip bulunmazsa bot gelir"
          : `${s.info || "Grid Heist"} • Raund hamlesi ${s.turn === "me" ? s.meActionLeft : s.enemyActionLeft}/2`;
        this._els.turn.innerHTML = `<span class="tc-crush-neon">${who === "IQ ARENA" ? "IQ ARENA" : who}</span><small>${sub}</small>`;
      }
      if (this._els.timer) {
        const leftSec = s.matchmaking
          ? 5
          : Math.max(0, Number(s.turnSecondsLeft || Math.ceil(Math.max(0, (s.turnEndsAt || 0) - Date.now()) / 1000)));
        this._els.timer.textContent = String(leftSec);
        this._els.timer.classList.toggle("low", leftSec <= 10 && !s.matchmaking && !s.finished);
      }
    },

    async _playerMove(a, b) {
      if (!this._running || this._locked || this._state?.matchmaking) return;
      this._locked = true;

      const swapped = swapCells(this._state.board, a, b);
      const evalNow = evaluateBoard(swapped);
      if (!evalNow.hasAction) {
        this._toast("Geçersiz hamle");
        this._locked = false;
        this._selected = a;
        this._render();
        return;
      }

      this._state.board = swapped;
      this._render();
      await this._sleep(110);
      await this._resolveTurn("me");

      if (!this._running) return;
      if (this._checkFinish()) return;

      if (this._state.turn === "enemy") {
        const delay = randInt(700, 1250);
        this._turnTimer = setTimeout(() => this._enemyPlay(), delay);
      } else {
        this._locked = false;
      }
    },

    async _enemyPlay() {
      if (!this._running || !this._state || this._state.turn !== "enemy" || this._state.matchmaking) return;
      this._locked = true;

      const thinking = randInt(850, 1900);
      this._state.info = "Düşünme süresi başladı";
      this._updateHud();
      this._render();
      await this._sleep(thinking);

      const move = calcBotMove(this._state.board, this._state.enemyHp);
      if (!move) {
        this._state.turn = "me";
        this._state.meActionLeft = ACTIONS_PER_TURN;
        this._state.info = "Rakip hamle bulamadı";
        this._startTurnTimer("me");
        this._updateHud();
        this._render();
        this._toast("Rakip hamle bulamadı");
        this._locked = false;
        return;
      }

      this._state.board = swapCells(this._state.board, move.a, move.b);
      this._state.info = "Rakip oynuyor";
      this._updateHud();
      this._render();
      await this._sleep(randInt(160, 320));
      await this._resolveTurn("enemy");

      if (!this._running) return;
      if (this._checkFinish()) return;

      if (this._state.turn === "enemy") {
        this._turnTimer = setTimeout(() => this._enemyPlay(), randInt(650, 1150));
      } else {
        this._locked = false;
      }
    },

    async _resolveTurn(actor) {
      let board = this._state.board;
      let chain = 0;
      let totalDamage = 0;
      let totalHeal = 0;
      let totalExtra = 0;
      const rowClearCount = { value: 0 };

      while (true) {
        const res = evaluateBoard(board);
        if (!res.hasAction) break;

        chain += 1;
        totalDamage += res.damage;
        totalHeal += res.heal;
        totalExtra += res.extraMoves;

        if (res.rowClears?.length) {
          rowClearCount.value += res.rowClears.length;
          for (const rowIndex of res.rowClears) {
            this._queueFx({
              kind: "rowClear",
              row: rowIndex,
              startAt: performance.now(),
              endAt: performance.now() + 420,
            });
          }
        }

        if (res.extraMoveBursts?.length) {
          for (const burst of res.extraMoveBursts) {
            const cell = burst.cells[Math.floor(burst.cells.length / 2)] || burst.cells[0];
            this._queueFx({
              kind: "extraMove",
              cell,
              len: burst.len,
              startAt: performance.now(),
              endAt: performance.now() + 650,
            });
          }
        }

        board = applyResolution(board, res);
        this._state.board = board;
        this._state.info = `${actor === "me" ? "SEN" : this._opponent.username} • Combo x${chain}`;
        this._updateHud();
        this._render();
        await this._sleep(185);
      }

      if (!hasAnyPossibleMove(board)) {
        board = buildFreshBoard(this._lastSignature);
      }

      this._lastSignature = boardSignature(board);
      this._state.board = board;

      const bonusText = [];
      if (rowClearCount.value > 0) bonusText.push(`Satır temizleme x${rowClearCount.value}`);
      if (totalExtra > 0) bonusText.push(`Extra Move +${totalExtra}`);

      if (actor === "me") {
        this._state.meMoves = Math.max(0, this._state.meMoves - 1 + totalExtra);
        this._state.meHp = clamp(this._state.meHp + totalHeal, 0, 100);
        this._state.enemyHp = clamp(this._state.enemyHp - totalDamage, 0, 100);
        this._state.meActionLeft = Math.max(0, this._state.meActionLeft - 1);

        const baseToast = totalHeal > 0 ? `Vuruş ${totalDamage} • Can +${totalHeal}` : `Vuruş ${totalDamage}`;
        this._toast(bonusText.length ? `${baseToast} • ${bonusText.join(" • ")}` : baseToast);

        if (this._state.meMoves <= 0 || this._state.meActionLeft <= 0) {
          this._state.turn = "enemy";
          this._state.enemyActionLeft = ACTIONS_PER_TURN;
          this._startTurnTimer("enemy");
        } else {
          this._state.turn = "me";
          this._startTurnTimer("me");
        }
      } else {
        this._state.enemyMoves = Math.max(0, this._state.enemyMoves - 1 + totalExtra);
        this._state.enemyHp = clamp(this._state.enemyHp + totalHeal, 0, 100);
        this._state.meHp = clamp(this._state.meHp - totalDamage, 0, 100);
        this._state.enemyActionLeft = Math.max(0, this._state.enemyActionLeft - 1);

        const baseToast = totalHeal > 0 ? `Rakip ${totalDamage} vurdu • Can +${totalHeal}` : `Rakip ${totalDamage} vurdu`;
        this._toast(bonusText.length ? `${baseToast} • ${bonusText.join(" • ")}` : baseToast);

        if (this._state.enemyMoves <= 0 || this._state.enemyActionLeft <= 0) {
          this._state.turn = "me";
          this._state.meActionLeft = ACTIONS_PER_TURN;
          this._startTurnTimer("me");
        } else {
          this._state.turn = "enemy";
          this._startTurnTimer("enemy");
        }
      }

      this._state.info = `${Math.max(1, chain)} chain`;
      this._updateHud();
      this._render();
    },

    _recordResult(win) {
      const store = window.tcStore;
      const now = Date.now();
      const opponent = this._opponent?.username || "Rakip";
      const resultItem = {
        id: `pvp_${now}`,
        opponent,
        result: win ? "win" : "loss",
        mode: "iq_arena",
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
        pvp.rating = clamp(Number(pvp.rating || 1000) + (win ? 18 : -12), 0, 99999);
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

    _finishGame(win, reason) {
      if (!this._state || this._state.finished) return true;
      this._state.finished = true;
      this._running = false;
      this._locked = true;
      clearTimeout(this._turnTimer);
      clearTimeout(this._queueTimer);
      this._clearTurnTimer();
      this._turnTimer = null;
      this._queueTimer = null;
      this._setStatus(win ? "Kazandın" : "Kaybettin");
      this._state.info = reason || (win ? "Kazandın" : "Kaybettin");
      this._toast(win ? "Kazandın" : "Kaybettin");
      this._recordResult(win);
      this._updateHud();
      this._render();
      return true;
    },

    _checkFinish() {
      if (!this._state) return false;
      if (this._state.enemyHp <= 0) return this._finishGame(true, "Rakip düştü");
      if (this._state.meHp <= 0) return this._finishGame(false, "Sen düştün");

      if (this._state.meMoves <= 0 && this._state.enemyMoves <= 0) {
        if (this._state.meHp >= this._state.enemyHp) return this._finishGame(true, "HP üstünlüğü");
        return this._finishGame(false, "HP üstünlüğü rakipte");
      }
      return false;
    },

    _sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    _render() {
      if (!this._els?.ctx || !this._state || !this._els?.canvas) return;

      const ctx = this._els.ctx;
      const canvas = this._els.canvas;
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width || 300);
      const h = Math.round(rect.height || 300);
      if (w < 20 || h < 20) return;

      ctx.clearRect(0, 0, w, h);

      const boardPad = clamp(Math.round(w * 0.018), 6, 10);
      const usableW = w - boardPad * 2;
      const usableH = h - boardPad * 2;
      const boardSize = Math.min(usableW, usableH);
      const cell = Math.max(20, Math.floor(boardSize / GRID));
      const actual = cell * GRID;
      const ox = Math.floor((w - actual) / 2);
      const oy = Math.floor((h - actual) / 2);

      this._tileRects = [];

      const shell = ctx.createLinearGradient(0, oy - 12, 0, oy + actual + 24);
      shell.addColorStop(0, "rgba(8,14,28,0.56)");
      shell.addColorStop(1, "rgba(2,6,16,0.76)");
      fillRoundRect(ctx, ox - 14, oy - 14, actual + 28, actual + 28, 22, shell);
      strokeRoundRect(ctx, ox - 14, oy - 14, actual + 28, actual + 28, 22, "rgba(255,255,255,0.08)", 1.2);

      const inner = ctx.createLinearGradient(0, oy, 0, oy + actual);
      inner.addColorStop(0, "rgba(16,22,38,0.86)");
      inner.addColorStop(1, "rgba(10,14,28,0.92)");
      fillRoundRect(ctx, ox - 4, oy - 4, actual + 8, actual + 8, 18, inner);

      const now = performance.now();
      this._fx = (this._fx || []).filter((fx) => (fx.endAt || 0) > now);

      for (const fx of this._fx) {
        if (fx.kind !== "rowClear") continue;
        const t = clamp((now - fx.startAt) / Math.max(1, fx.endAt - fx.startAt), 0, 1);
        const y = oy + fx.row * cell;
        const alpha = (1 - t) * 0.55;
        const rowGlow = ctx.createLinearGradient(ox, y, ox + actual, y);
        rowGlow.addColorStop(0, `rgba(255,230,140,${alpha * 0.15})`);
        rowGlow.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
        rowGlow.addColorStop(1, `rgba(255,110,110,${alpha * 0.2})`);
        fillRoundRect(ctx, ox + 2, y + 4, actual - 4, cell - 8, Math.max(8, Math.floor(cell * 0.18)), rowGlow);

        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 2 + (1 - t) * 3;
        ctx.beginPath();
        ctx.moveTo(ox + 6, y + cell / 2);
        ctx.lineTo(ox + actual - 6, y + cell / 2);
        ctx.stroke();
        ctx.restore();
      }

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const x = ox + c * cell;
          const y = oy + r * cell;
          const tile = this._state.board[r][c];
          const selected = this._selected && this._selected.r === r && this._selected.c === c;
          const radius = Math.max(10, Math.floor(cell * 0.18));

          fillRoundRect(
            ctx,
            x + 2,
            y + 2,
            cell - 4,
            cell - 4,
            radius,
            selected ? "rgba(255,181,74,0.22)" : "rgba(255,255,255,0.07)"
          );
          strokeRoundRect(
            ctx,
            x + 2,
            y + 2,
            cell - 4,
            cell - 4,
            radius,
            selected ? "rgba(255,181,74,0.96)" : "rgba(255,255,255,0.08)",
            selected ? 2 : 1
          );

          if (tile) {
            const meta = TILE_META[tile.type] || TILE_META[TILE.PUNCH];
            const glow = ctx.createRadialGradient(
              x + cell / 2,
              y + cell / 2,
              4,
              x + cell / 2,
              y + cell / 2,
              cell * 0.48
            );
            glow.addColorStop(0, meta.color + "66");
            glow.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x + cell / 2, y + cell / 2, cell * 0.34, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = `900 ${Math.floor(cell * 0.47)}px system-ui, Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#fff";
            ctx.fillText(meta.emoji, x + cell / 2, y + cell / 2 + 1);
          }

          this._tileRects.push({ r, c, x, y, w: cell, h: cell });
        }
      }

      for (const fx of this._fx) {
        if (fx.kind !== "extraMove" || !fx.cell) continue;
        const t = clamp((now - fx.startAt) / Math.max(1, fx.endAt - fx.startAt), 0, 1);
        const cx = ox + fx.cell.c * cell + cell / 2;
        const cy = oy + fx.cell.r * cell + cell / 2;
        const alpha = 1 - t;
        const radius = cell * (0.20 + t * 0.34);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "rgba(255,205,96,0.92)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffd16f";
        ctx.font = `900 ${Math.max(12, Math.floor(cell * 0.24))}px system-ui, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("EXTRA", cx, cy - Math.max(12, cell * 0.32));
        ctx.fillText(`+1`, cx, cy + Math.max(10, cell * 0.30));
        ctx.restore();
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._updateHud();
    },
  };

  window.TonCrimePVP_CRUSH = api;
})();
