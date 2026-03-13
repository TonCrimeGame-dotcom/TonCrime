(function () {
  const GRID = 7;
  const START_HP = 100;
  const START_MOVES = 12;
  const DRAG_THRESHOLD = 16;
  const TURN_MS = 30000;

  const TILE = {
    PUNCH: "punch",
    GUN: "gun",
    KNIFE: "knife",
    MED: "med",
    CASH: "cash",
    SHIELD: "shield",
    BOMB: "bomb",
  };

  const NORMAL_TYPES = [
    TILE.PUNCH,
    TILE.GUN,
    TILE.KNIFE,
    TILE.MED,
    TILE.CASH,
    TILE.SHIELD,
  ];

  const TILE_META = {
    [TILE.PUNCH]: { emoji: "👊", color: "#ffb24a", label: "Yumruk" },
    [TILE.GUN]: { emoji: "🔫", color: "#ff7b59", label: "Silah" },
    [TILE.KNIFE]: { emoji: "🔪", color: "#d77dff", label: "Bıçak" },
    [TILE.MED]: { emoji: "💊", color: "#58d68d", label: "İlaç" },
    [TILE.CASH]: { emoji: "💰", color: "#ffd166", label: "Coin" },
    [TILE.SHIELD]: { emoji: "🛡️", color: "#69b7ff", label: "Kalkan" },
    [TILE.BOMB]: { emoji: "💣", color: "#ffffff", label: "Bomba" },
  };

  const DAMAGE = {
    [TILE.PUNCH]: 8,
    [TILE.GUN]: 12,
    [TILE.KNIFE]: 10,
    [TILE.BOMB]: 18,
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

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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
        if (!cell || cell.type === TILE.BOMB) {
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
        if (!cell || cell.type === TILE.BOMB) {
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

          const a = swapped[r][c];
          const b = swapped[rr][cc];
          if ((a && a.type === TILE.BOMB) || (b && b.type === TILE.BOMB)) return true;
        }
      }
    }
    return false;
  }

  function buildFreshBoard(lastSignature) {
    for (let tries = 0; tries < 80; tries++) {
      const seedBias = Date.now() + tries * 31 + randInt(1, 99999);
      const board = Array.from({ length: GRID }, () =>
        Array.from({ length: GRID }, () => null)
      );

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          let type = getWeightedType(seedBias + r * 13 + c * 17);
          let guard = 0;

          while (
            guard < 20 &&
            (
              (c >= 2 &&
                board[r][c - 1] &&
                board[r][c - 2] &&
                board[r][c - 1].type === type &&
                board[r][c - 2].type === type) ||
              (r >= 2 &&
                board[r - 1][c] &&
                board[r - 2][c] &&
                board[r - 1][c].type === type &&
                board[r - 2][c].type === type)
            )
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

  function floodBombCells(r, c) {
    const out = [];
    for (let rr = r - 1; rr <= r + 1; rr++) {
      for (let cc = c - 1; cc <= c + 1; cc++) {
        if (inBounds(rr, cc)) out.push({ r: rr, c: cc });
      }
    }
    return out;
  }

  function chooseBombSpawnCell(match, preferred) {
    if (preferred) {
      for (const cell of match.cells) {
        if (cell.r === preferred.r && cell.c === preferred.c) return cell;
      }
    }
    return match.cells[Math.floor(match.cells.length / 2)];
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

  function evaluateBoard(board, preferredSpawnCell, swapA, swapB) {
    const matches = findMatches(board);
    const remove = new Set();
    const bombsToSpawn = [];
    const bombTriggers = [];
    let damage = 0;
    let heal = 0;
    let coins = 0;
    let shield = 0;
    let extraMoves = 0;

    const bombSwap =
      (swapA && board[swapA.r]?.[swapA.c]?.type === TILE.BOMB) ||
      (swapB && board[swapB.r]?.[swapB.c]?.type === TILE.BOMB);

    function markRemove(r, c) {
      remove.add(r + ":" + c);
    }

    for (const m of matches) {
      if (m.len >= 4) extraMoves += 1;

      if (m.type === TILE.PUNCH) damage += DAMAGE[TILE.PUNCH] + Math.max(0, m.len - 3) * 2;
      if (m.type === TILE.GUN) damage += DAMAGE[TILE.GUN] + Math.max(0, m.len - 3) * 3;
      if (m.type === TILE.KNIFE) damage += DAMAGE[TILE.KNIFE] + Math.max(0, m.len - 3) * 2;
      if (m.type === TILE.MED) heal += 8 + Math.max(0, m.len - 3) * 3;
      if (m.type === TILE.CASH) coins += 5 + Math.max(0, m.len - 3) * 3;
      if (m.type === TILE.SHIELD) shield += 6 + Math.max(0, m.len - 3) * 2;

      const bombCell = m.len >= 5 ? chooseBombSpawnCell(m, preferredSpawnCell) : null;
      if (bombCell) extraMoves += 1;

      for (const cell of m.cells) {
        if (bombCell && cell.r === bombCell.r && cell.c === bombCell.c) continue;
        markRemove(cell.r, cell.c);
      }

      if (bombCell) bombsToSpawn.push(bombCell);
    }

    const bombsOnBoard = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (board[r][c] && board[r][c].type === TILE.BOMB) {
          bombsOnBoard.push({ r, c });
        }
      }
    }

    if (bombSwap) {
      for (const b of bombsOnBoard) bombTriggers.push(b);
    } else {
      for (const b of bombsOnBoard) {
        if (remove.has(b.r + ":" + b.c)) bombTriggers.push(b);
      }
    }

    for (const b of bombTriggers) {
      const blast = floodBombCells(b.r, b.c);
      for (const cell of blast) markRemove(cell.r, cell.c);
      damage += DAMAGE[TILE.BOMB];
    }

    return {
      hasAction: matches.length > 0 || bombTriggers.length > 0,
      remove,
      bombsToSpawn,
      bombTriggers,
      damage,
      heal,
      coins,
      shield,
      extraMoves,
      matches,
    };
  }

  function applyResolution(board, resolution) {
    const next = cloneBoard(board);

    for (const key of resolution.remove) {
      const [r, c] = key.split(":").map(Number);
      next[r][c] = null;
    }

    for (const b of resolution.bombsToSpawn) {
      next[b.r][b.c] = createTile(TILE.BOMB);
    }

    return collapseBoard(next);
  }

  function calcBotMove(board) {
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
          const res = evaluateBoard(swapped, { r: rr, c: cc }, { r, c }, { r: rr, c: cc });
          if (!res.hasAction) continue;

          let score = 0;
          score += res.damage * 3;
          score += res.heal * 1.1;
          score += res.coins * 0.7;
          score += res.shield * 0.8;
          score += res.extraMoves * 18;

          for (const m of res.matches) {
            score += m.len * 4;
            if (m.type === TILE.GUN) score += 9;
            if (m.type === TILE.PUNCH) score += 6;
            if (m.type === TILE.KNIFE) score += 7;
            if (m.type === TILE.MED) score += 4;
            if (m.type === TILE.SHIELD) score += 4;
            if (m.type === TILE.CASH) score += 2;
          }

          score += Math.random() * 3;

          if (!best || score > best.score) {
            best = {
              a: { r, c },
              b: { r: rr, c: cc },
              score,
            };
          }
        }
      }
    }

    return best;
  }

  function makeArenaMarkup() {
    return `
      <div class="tc-crush-root">
        <div class="tc-crush-head">
          <div class="tc-crush-chip" id="tcCrushMeMoves">Hamle: 12</div>
          <div class="tc-crush-title" id="tcCrushTurn">
            SEN
            <small id="tcCrushSub">7x7 Grid Heist</small>
          </div>
          <div class="tc-crush-chip" id="tcCrushEnemyMoves">Rakip: 12</div>
        </div>

        <div class="tc-crush-timer-row">
          <div class="tc-crush-timer-track"><div class="tc-crush-timer-fill" id="tcCrushTimerFill"></div></div>
          <div class="tc-crush-timer-text" id="tcCrushTimerText">30s</div>
        </div>

        <div class="tc-crush-combo-row">
          <div class="tc-crush-combo-track"><div class="tc-crush-combo-fill" id="tcCrushComboFill"></div></div>
          <div class="tc-crush-combo-text" id="tcCrushComboText">Combo x0</div>
        </div>

        <canvas class="tc-crush-canvas"></canvas>
        <div class="tc-crush-toast" id="tcCrushToast"></div>
        <div class="tc-crush-overlay" id="tcCrushOverlay"></div>
      </div>
    `;
  }

  function injectStyle() {
    const id = "tc-pvp-crush-style";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      #arena {
        position: relative;
        overflow: hidden;
        touch-action: none;
      }

      #arena .tc-crush-root {
        position: absolute;
        inset: 0;
        z-index: 5;
        display: flex;
        flex-direction: column;
        padding: 10px;
        box-sizing: border-box;
      }

      #arena .tc-crush-head {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 8px;
        align-items: center;
        margin-bottom: 6px;
        flex: 0 0 auto;
      }

      #arena .tc-crush-chip {
        min-height: 34px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(0,0,0,0.34);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 10px;
        font: 800 12px system-ui, Arial;
        backdrop-filter: blur(6px);
        text-align: center;
      }

      #arena .tc-crush-title {
        text-align: center;
        color: rgba(255,255,255,0.96);
        font: 900 12px system-ui, Arial;
      }

      #arena .tc-crush-title small {
        display: block;
        color: rgba(255,255,255,0.70);
        font: 600 10px system-ui, Arial;
        margin-top: 2px;
      }

      #arena .tc-crush-timer-row,
      #arena .tc-crush-combo-row {
        position: relative;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
        flex: 0 0 auto;
      }

      #arena .tc-crush-timer-track,
      #arena .tc-crush-combo-track {
        position: relative;
        height: 10px;
        border-radius: 999px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.07);
      }

      #arena .tc-crush-timer-fill {
        height: 100%;
        width: 100%;
        transform-origin: left center;
        background: linear-gradient(90deg, rgba(255,188,93,0.95), rgba(255,103,86,0.95));
        transition: transform 0.1s linear;
      }

      #arena .tc-crush-combo-fill {
        height: 100%;
        width: 0%;
        transform-origin: left center;
        background: linear-gradient(90deg, rgba(134,100,255,0.95), rgba(255,118,219,0.95));
        transition: transform 0.18s ease;
      }

      #arena .tc-crush-timer-text,
      #arena .tc-crush-combo-text {
        min-width: 72px;
        color: rgba(255,255,255,0.95);
        font: 900 12px system-ui, Arial;
        text-align: right;
      }

      #arena .tc-crush-canvas {
        display: block;
        width: 100%;
        height: 100%;
        flex: 1 1 auto;
        border-radius: 16px;
        touch-action: none;
      }

      #arena .tc-crush-toast {
        position: absolute;
        left: 50%;
        top: 16%;
        transform: translateX(-50%);
        z-index: 8;
        padding: 10px 14px;
        min-width: 180px;
        border-radius: 14px;
        background: rgba(0,0,0,0.62);
        border: 1px solid rgba(255,255,255,0.14);
        color: #fff;
        font: 900 13px system-ui, Arial;
        opacity: 0;
        pointer-events: none;
        transition: opacity .16s ease;
        backdrop-filter: blur(10px);
        text-align: center;
      }

      #arena .tc-crush-toast.on {
        opacity: 1;
      }

      #arena .tc-crush-overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        pointer-events: none;
        font: 1000 34px system-ui, Arial;
        color: rgba(255,255,255,0.96);
        text-shadow: 0 10px 30px rgba(0,0,0,0.6);
        opacity: 0;
        transform: scale(0.9);
        transition: opacity .24s ease, transform .24s ease;
      }

      #arena .tc-crush-overlay.on {
        opacity: 1;
        transform: scale(1);
      }

      #arena .tc-crush-overlay.win {
        background: radial-gradient(circle, rgba(75,255,157,0.14), rgba(0,0,0,0));
      }

      #arena .tc-crush-overlay.lose {
        background: radial-gradient(circle, rgba(255,95,95,0.14), rgba(0,0,0,0));
      }

      @media (max-width: 520px) {
        #arena .tc-crush-root {
          padding: 8px;
        }

        #arena .tc-crush-head {
          gap: 6px;
          margin-bottom: 6px;
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
    _countdownInterval: null,
    _pointerDown: null,
    _dragStart: null,
    _dragFromTile: null,
    _dragConsumed: false,
    _dragVector: { dx: 0, dy: 0 },
    _releaseGuard: false,
    _unbind: null,
    _swapAnim: null,
    _floatTexts: [],
    _particles: [],
    _screenFlash: null,
    _overlayTimer: null,
    _shake: null,
    _comboLevel: 0,
    _comboDecayTimer: null,

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

      this._destroyCanvasEvents();

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
        sub: arena.querySelector("#tcCrushSub"),
        toast: arena.querySelector("#tcCrushToast"),
        overlay: arena.querySelector("#tcCrushOverlay"),
        timerFill: arena.querySelector("#tcCrushTimerFill"),
        timerText: arena.querySelector("#tcCrushTimerText"),
        comboFill: arena.querySelector("#tcCrushComboFill"),
        comboText: arena.querySelector("#tcCrushComboText"),
      };

      this._bindCanvas();
      this._safeResizeSequence();
      this.reset();

      this._inited = true;
      this._setStatus("Grid Heist hazır");
    },

    setOpponent(opp) {
      this._opponent =
        opp && typeof opp.username === "string"
          ? { ...opp }
          : { username: "Rakip", isBot: true };

      if (this._state) this._updateHud();
    },

    async start() {
      if (!this._inited) return;
      await this._waitUntilVisible();

      this._safeResizeSequence();
      this._running = true;
      this._locked = false;
      this._selected = null;
      this._setStatus("Grid Heist başladı");
      this._toast("Sıra sende");
      this._setTurn("me", "SEN • Düşünme süresi başladı");
      this._render();

      requestAnimationFrame(() => {
        this._safeResizeSequence();
        this._render();
      });
    },

    stop() {
      this._running = false;
      this._locked = false;
      this._selected = null;
      this._pointerDown = null;
      this._dragStart = null;
      this._dragFromTile = null;
      this._dragVector = { dx: 0, dy: 0 };
      clearTimeout(this._turnTimer);
      this._turnTimer = null;
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
      clearTimeout(this._comboDecayTimer);
      this._comboDecayTimer = null;
      this._setStatus("Durduruldu");
      this._render();
    },

    reset() {
      clearTimeout(this._turnTimer);
      this._turnTimer = null;
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
      clearTimeout(this._comboDecayTimer);
      this._comboDecayTimer = null;

      this._running = false;
      this._locked = false;
      this._selected = null;
      this._pointerDown = null;
      this._dragStart = null;
      this._dragFromTile = null;
      this._dragConsumed = false;
      this._dragVector = { dx: 0, dy: 0 };
      this._swapAnim = null;
      this._floatTexts = [];
      this._particles = [];
      this._screenFlash = null;
      this._shake = null;
      this._comboLevel = 0;
      this._hideOverlay();

      const board = buildFreshBoard(this._lastSignature);
      this._lastSignature = boardSignature(board);

      this._state = {
        board,
        turn: "me",
        meHp: START_HP,
        enemyHp: START_HP,
        meMoves: START_MOVES,
        enemyMoves: START_MOVES,
        meArmor: 0,
        enemyArmor: 0,
        meCoins: 0,
        enemyCoins: 0,
        turnDeadline: Date.now() + TURN_MS,
        info: "Yeni maç",
      };

      this._safeResizeSequence();
      this._updateHud();
      this._render();
    },

    _bindCanvas() {
      const canvas = this._els.canvas;

      const getPos = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const touch = ev.touches?.[0] || ev.changedTouches?.[0];
        const clientX = touch ? touch.clientX : ev.clientX;
        const clientY = touch ? touch.clientY : ev.clientY;
        return {
          x: clientX - rect.left,
          y: clientY - rect.top,
        };
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
        if (!this._running || this._locked || this._state?.turn !== "me") return;
        const p = getPos(ev);
        const hit = this._hitTile(p.x, p.y);
        if (!hit) return;

        this._pointerDown = hit;
        this._selected = hit;
        this._dragStart = p;
        this._dragFromTile = hit;
        this._dragConsumed = false;
        this._dragVector = { dx: 0, dy: 0 };
        this._releaseGuard = false;
        this._render();
        ev.preventDefault?.();
      };

      const onMove = (ev) => {
        if (!this._running || this._locked || this._state?.turn !== "me") return;
        if (!this._dragStart || !this._dragFromTile || this._dragConsumed) return;

        const p = getPos(ev);
        const dx = p.x - this._dragStart.x;
        const dy = p.y - this._dragStart.y;

        this._dragVector = { dx, dy };
        this._render();

        const target = directionTarget(this._dragFromTile, dx, dy);
        if (!target) return;

        this._dragConsumed = true;
        this._selected = null;
        this._pointerDown = null;
        this._dragStart = null;
        this._dragVector = { dx: 0, dy: 0 };

        this._playerMove(this._dragFromTile, target);
        ev.preventDefault?.();
      };

      const onUp = (ev) => {
        if (!this._running || this._locked || this._state?.turn !== "me") return;
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
        this._dragVector = { dx: 0, dy: 0 };

        if (!startedDrag) return;
        if (dragConsumed) return;

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
        this._dragVector = { dx: 0, dy: 0 };
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
      if (this._els?.status) this._els.status.textContent = "PvP • " + text;
    },

    _toast(text) {
      const el = this._els?.toast;
      if (!el) return;
      el.textContent = String(text || "");
      el.classList.add("on");
      clearTimeout(el._offTimer);
      el._offTimer = setTimeout(() => el.classList.remove("on"), 1100);
    },

    _showOverlay(text, mode) {
      const el = this._els?.overlay;
      if (!el) return;
      clearTimeout(this._overlayTimer);
      el.textContent = text;
      el.className = `tc-crush-overlay on ${mode || ""}`.trim();
      this._overlayTimer = setTimeout(() => {
        this._hideOverlay();
      }, 1800);
    },

    _hideOverlay() {
      const el = this._els?.overlay;
      if (!el) return;
      el.className = "tc-crush-overlay";
      el.textContent = "";
    },

    _setTurn(turn, infoText) {
      if (!this._state) return;
      this._state.turn = turn;
      this._state.turnDeadline = Date.now() + TURN_MS;
      if (infoText) this._state.info = infoText;
      this._startCountdownLoop();
      this._updateHud();
      this._render();
    },

    _startCountdownLoop() {
      clearInterval(this._countdownInterval);
      this._countdownInterval = setInterval(() => {
        if (!this._running || !this._state) return;

        const msLeft = Math.max(0, this._state.turnDeadline - Date.now());
        this._updateHud();

        if (msLeft <= 0) {
          clearInterval(this._countdownInterval);
          this._countdownInterval = null;
          this._handleTurnTimeout();
        }
      }, 100);
    },

    _handleTurnTimeout() {
      if (!this._running || !this._state) return;

      if (this._state.turn === "me") {
        this._toast("Süre doldu • sıra rakibe geçti");
        this._spawnFloatingText("SÜRE BİTTİ", 0.5, 0.18, "#ff8b8b", 22);
        this._spawnShake(7, 260);
        this._locked = false;
        this._selected = null;
        this._setTurn("enemy", `${this._opponent.username} • Süre avantajı`);
        this._turnTimer = setTimeout(() => this._enemyPlay(), 450);
      } else {
        this._toast("Rakibin süresi doldu");
        this._spawnFloatingText("EXTRA ŞANS", 0.5, 0.18, "#9affbc", 22);
        this._spawnShake(4, 180);
        this._locked = false;
        this._setTurn("me", "SEN • Rakibin süresi bitti");
      }
    },

    _setCombo(level) {
      this._comboLevel = clamp(level, 0, 8);
      if (this._els?.comboFill) {
        this._els.comboFill.style.transform = `scaleX(${this._comboLevel / 8})`;
      }
      if (this._els?.comboText) {
        this._els.comboText.textContent = `Combo x${this._comboLevel}`;
      }

      clearTimeout(this._comboDecayTimer);
      if (this._comboLevel > 0) {
        this._comboDecayTimer = setTimeout(() => {
          this._comboLevel = 0;
          if (this._els?.comboFill) this._els.comboFill.style.transform = "scaleX(0)";
          if (this._els?.comboText) this._els.comboText.textContent = "Combo x0";
        }, 1800);
      }
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

      const who = s.turn === "me" ? "SEN" : this._opponent.username.toUpperCase();
      if (this._els.turn) this._els.turn.childNodes[0].nodeValue = who;
      if (this._els.sub) this._els.sub.textContent = s.info || "7x7 Grid Heist";

      const msLeft = Math.max(0, Number(s.turnDeadline || 0) - Date.now());
      const ratio = clamp(msLeft / TURN_MS, 0, 1);
      if (this._els.timerFill) this._els.timerFill.style.transform = `scaleX(${ratio})`;
      if (this._els.timerText) this._els.timerText.textContent = `${Math.ceil(msLeft / 1000)}s`;

      if (this._els.comboFill) this._els.comboFill.style.transform = `scaleX(${this._comboLevel / 8})`;
      if (this._els.comboText) this._els.comboText.textContent = `Combo x${this._comboLevel}`;
    },

    _spawnFloatingText(text, rx, ry, color, size = 18) {
      this._floatTexts.push({
        text,
        rx,
        ry,
        color,
        size,
        life: 1,
        vy: -0.45,
      });
    },

    _spawnBurst(rx, ry, color, count = 16, spread = 1) {
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const spd = (1.1 + Math.random() * 2.2) * spread;
        this._particles.push({
          rx,
          ry,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 1,
          color,
          radius: 2 + Math.random() * 4,
        });
      }
    },

    _spawnShake(power, duration) {
      this._shake = {
        power,
        duration,
        started: performance.now(),
      };
      requestAnimationFrame(() => this._animateFxFrame());
    },

    _spawnBombFx(cell) {
      const rx = (cell.c + 0.5) / GRID;
      const ry = (cell.r + 0.5) / GRID;
      this._spawnBurst(rx, ry, "rgba(255,160,100,0.95)", 24, 1.25);
      this._spawnFloatingText("💣 BOOM", rx, ry, "#ffd3a1", 20);
      this._screenFlash = { color: "rgba(255,160,80,0.16)", life: 1 };
      this._spawnShake(10, 240);
    },

    _spawnExtraMoveFx(extra) {
      this._spawnFloatingText(`+${extra} HAMLE`, 0.5, 0.22, "#ffcf78", 24);
      this._spawnBurst(0.5, 0.24, "rgba(255,210,120,0.92)", 18, 0.8);
    },

    _spawnWinFx() {
      this._showOverlay("KAZANDIN", "win");
      this._spawnBurst(0.5, 0.45, "rgba(94,255,162,0.95)", 34, 1.6);
      this._spawnFloatingText("VICTORY", 0.5, 0.40, "#9affbc", 28);
      this._screenFlash = { color: "rgba(94,255,162,0.16)", life: 1 };
      this._spawnShake(8, 360);
    },

    _spawnLoseFx() {
      this._showOverlay("KAYBETTİN", "lose");
      this._spawnBurst(0.5, 0.45, "rgba(255,104,104,0.95)", 28, 1.35);
      this._spawnFloatingText("DEFEAT", 0.5, 0.40, "#ff9e9e", 28);
      this._screenFlash = { color: "rgba(255,104,104,0.14)", life: 1 };
      this._spawnShake(6, 300);
    },

    async _animateSwap(a, b) {
      this._swapAnim = {
        a: { ...a },
        b: { ...b },
        tileA: this._state.board[a.r][a.c],
        tileB: this._state.board[b.r][b.c],
        startedAt: performance.now(),
        duration: 145,
      };

      return new Promise((resolve) => {
        const tick = () => {
          if (!this._swapAnim) return resolve();
          const t = clamp((performance.now() - this._swapAnim.startedAt) / this._swapAnim.duration, 0, 1);
          this._swapAnim.progress = easeOutCubic(t);
          this._render();
          if (t >= 1) {
            this._swapAnim = null;
            this._render();
            return resolve();
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },

    _animateFxFrame() {
      let needs = false;

      if (this._floatTexts.length) {
        needs = true;
        for (let i = this._floatTexts.length - 1; i >= 0; i--) {
          const fx = this._floatTexts[i];
          fx.life -= 0.03;
          fx.ry += fx.vy * 0.01;
          if (fx.life <= 0) this._floatTexts.splice(i, 1);
        }
      }

      if (this._particles.length) {
        needs = true;
        for (let i = this._particles.length - 1; i >= 0; i--) {
          const p = this._particles[i];
          p.life -= 0.03;
          p.rx += p.vx * 0.0028;
          p.ry += p.vy * 0.0028;
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.radius *= 0.99;
          if (p.life <= 0 || p.radius < 0.5) this._particles.splice(i, 1);
        }
      }

      if (this._screenFlash) {
        needs = true;
        this._screenFlash.life -= 0.05;
        if (this._screenFlash.life <= 0) this._screenFlash = null;
      }

      if (this._shake) {
        needs = true;
        const t = clamp((performance.now() - this._shake.started) / this._shake.duration, 0, 1);
        this._shake.progress = t;
        if (t >= 1) this._shake = null;
      }

      if (needs) requestAnimationFrame(() => this._animateFxFrame());
      this._render();
    },

    async _playerMove(a, b) {
      if (!this._running || this._locked) return;
      this._locked = true;

      await this._animateSwap(a, b);

      const swapped = swapCells(this._state.board, a, b);
      const evalNow = evaluateBoard(swapped, b, a, b);

      if (!evalNow.hasAction) {
        this._toast("Geçersiz hamle");
        this._locked = false;
        this._selected = a;
        this._render();
        return;
      }

      this._state.board = swapped;
      this._render();
      await this._sleep(90);

      await this._resolveTurn("me", a, b);

      if (!this._running) return;
      if (this._checkFinish()) return;

      if (this._state.turn === "enemy") {
        this._turnTimer = setTimeout(() => this._enemyPlay(), 520);
      } else {
        this._locked = false;
      }
    },

    async _enemyPlay() {
      if (!this._running || !this._state || this._state.turn !== "enemy") return;
      this._locked = true;

      const move = calcBotMove(this._state.board);
      if (!move) {
        this._setTurn("me", "SEN • Rakip hamle bulamadı");
        this._toast("Rakip hamle bulamadı");
        this._locked = false;
        return;
      }

      await this._animateSwap(move.a, move.b);

      this._state.board = swapCells(this._state.board, move.a, move.b);
      this._state.info = "Rakip oynuyor";
      this._updateHud();
      this._render();

      await this._sleep(160);
      await this._resolveTurn("enemy", move.a, move.b);

      if (!this._running) return;
      if (this._checkFinish()) return;

      if (this._state.turn === "enemy") {
        this._turnTimer = setTimeout(() => this._enemyPlay(), 480);
      } else {
        this._locked = false;
      }
    },

    async _resolveTurn(actor, swapA, swapB) {
      let board = this._state.board;
      let chain = 0;

      let totalDamage = 0;
      let totalHeal = 0;
      let totalCoins = 0;
      let totalShield = 0;
      let totalExtra = 0;

      while (true) {
        const res = evaluateBoard(board, swapB || null, swapA, swapB);
        if (!res.hasAction) break;

        chain += 1;
        totalDamage += res.damage;
        totalHeal += res.heal;
        totalCoins += res.coins;
        totalShield += res.shield;
        totalExtra += res.extraMoves;
        this._setCombo(chain);

        if (res.extraMoves > 0) this._spawnExtraMoveFx(res.extraMoves);
        if (res.bombTriggers?.length) {
          for (const bomb of res.bombTriggers) this._spawnBombFx(bomb);
        }

        for (const m of res.matches) {
          if (m.len >= 5) {
            const c = m.cells[Math.floor(m.cells.length / 2)];
            this._spawnFloatingText("BOMBA!", (c.c + 0.5) / GRID, (c.r + 0.5) / GRID, "#ffe2a8", 18);
          } else if (m.len >= 4) {
            const c = m.cells[Math.floor(m.cells.length / 2)];
            this._spawnFloatingText("EXTRA", (c.c + 0.5) / GRID, (c.r + 0.5) / GRID, "#ffd777", 16);
          }
        }

        this._animateFxFrame();

        board = applyResolution(board, res);
        this._state.board = board;
        this._state.info = `${actor === "me" ? "SEN" : this._opponent.username} • Combo x${chain}`;
        this._updateHud();
        this._render();
        await this._sleep(170);
      }

      if (!hasAnyPossibleMove(board)) {
        board = buildFreshBoard(this._lastSignature);
      }

      this._lastSignature = boardSignature(board);
      this._state.board = board;

      if (actor === "me") {
        this._state.meMoves = Math.max(0, this._state.meMoves - 1 + totalExtra);

        const enemyBlock = Math.min(this._state.enemyArmor, totalDamage);
        const dealt = Math.max(0, totalDamage - enemyBlock);

        this._state.enemyArmor = Math.max(0, this._state.enemyArmor - totalDamage);
        this._state.enemyHp = clamp(this._state.enemyHp - dealt, 0, 100);
        this._state.meHp = clamp(this._state.meHp + totalHeal, 0, 100);
        this._state.meArmor = clamp(this._state.meArmor + totalShield, 0, 40);
        this._state.meCoins += totalCoins;

        if (dealt > 0) this._spawnFloatingText(`-${dealt}`, 0.78, 0.12, "#ff9b86", 22);
        if (totalHeal > 0) this._spawnFloatingText(`+${totalHeal} HP`, 0.22, 0.12, "#8df7b7", 18);
        this._animateFxFrame();

        this._toast(totalExtra > 0 ? `Vuruş ${dealt} • +${totalExtra} hamle` : `Vuruş ${dealt}`);
        this._setTurn(
          totalExtra > 0 && this._state.meMoves > 0 ? "me" : "enemy",
          `${actor === "me" ? "SEN" : this._opponent.username} • ${Math.max(1, chain)} chain`
        );
      } else {
        this._state.enemyMoves = Math.max(0, this._state.enemyMoves - 1 + totalExtra);

        const meBlock = Math.min(this._state.meArmor, totalDamage);
        const dealt = Math.max(0, totalDamage - meBlock);

        this._state.meArmor = Math.max(0, this._state.meArmor - totalDamage);
        this._state.meHp = clamp(this._state.meHp - dealt, 0, 100);
        this._state.enemyHp = clamp(this._state.enemyHp + totalHeal, 0, 100);
        this._state.enemyArmor = clamp(this._state.enemyArmor + totalShield, 0, 40);
        this._state.enemyCoins += totalCoins;

        if (dealt > 0) this._spawnFloatingText(`-${dealt}`, 0.22, 0.12, "#ff9b86", 22);
        if (totalHeal > 0) this._spawnFloatingText(`+${totalHeal} HP`, 0.78, 0.12, "#8df7b7", 18);
        this._animateFxFrame();

        this._toast(totalExtra > 0 ? `Rakip ${dealt} vurdu • +${totalExtra} hamle` : `Rakip ${dealt} vurdu`);
        this._setTurn(
          totalExtra > 0 && this._state.enemyMoves > 0 ? "enemy" : "me",
          `${actor === "me" ? "SEN" : this._opponent.username} • ${Math.max(1, chain)} chain`
        );
      }
    },

    _checkFinish() {
      if (!this._state) return false;

      if (this._state.enemyHp <= 0) {
        this._running = false;
        this._locked = true;
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;
        this._setStatus("Kazandın");
        this._toast("Kazandın");
        this._spawnWinFx();
        window.dispatchEvent(new CustomEvent("tc:pvp:win"));
        this._render();
        return true;
      }

      if (this._state.meHp <= 0) {
        this._running = false;
        this._locked = true;
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;
        this._setStatus("Kaybettin");
        this._toast("Kaybettin");
        this._spawnLoseFx();
        window.dispatchEvent(new CustomEvent("tc:pvp:lose"));
        this._render();
        return true;
      }

      if (this._state.meMoves <= 0 && this._state.enemyMoves <= 0) {
        this._running = false;
        this._locked = true;
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;

        if (this._state.meHp >= this._state.enemyHp) {
          this._setStatus("Kazandın");
          this._toast("Kazandın");
          this._spawnWinFx();
          window.dispatchEvent(new CustomEvent("tc:pvp:win"));
        } else {
          this._setStatus("Kaybettin");
          this._toast("Kaybettin");
          this._spawnLoseFx();
          window.dispatchEvent(new CustomEvent("tc:pvp:lose"));
        }

        this._render();
        return true;
      }

      return false;
    },

    _sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    _drawTile(ctx, tile, x, y, cell, selected) {
      const meta = TILE_META[tile.type] || TILE_META[TILE.PUNCH];

      fillRoundRect(
        ctx,
        x + 2,
        y + 2,
        cell - 4,
        cell - 4,
        Math.max(10, Math.floor(cell * 0.18)),
        selected ? "rgba(255,181,74,0.22)" : "rgba(255,255,255,0.06)"
      );

      strokeRoundRect(
        ctx,
        x + 2,
        y + 2,
        cell - 4,
        cell - 4,
        Math.max(10, Math.floor(cell * 0.18)),
        selected ? "rgba(255,181,74,0.92)" : "rgba(255,255,255,0.08)",
        selected ? 2 : 1
      );

      const glow = ctx.createRadialGradient(
        x + cell / 2,
        y + cell / 2,
        4,
        x + cell / 2,
        y + cell / 2,
        cell * 0.48
      );
      glow.addColorStop(0, meta.color + "55");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + cell / 2, cell * 0.34, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `900 ${Math.floor(cell * 0.46)}px system-ui, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(meta.emoji, x + cell / 2, y + cell / 2 + 1);

      if (tile.type === TILE.BOMB) {
        ctx.font = `800 ${Math.max(8, Math.floor(cell * 0.16))}px system-ui, Arial`;
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.fillText("3x3", x + cell / 2, y + cell - Math.max(9, cell * 0.16));
      }
    },

    _render() {
      if (!this._els?.ctx || !this._state || !this._els?.canvas) return;

      const ctx = this._els.ctx;
      const canvas = this._els.canvas;
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width || 300);
      const h = Math.round(rect.height || 300);

      if (w < 20 || h < 20) return;

      let shakeX = 0;
      let shakeY = 0;
      if (this._shake) {
        const t = clamp((performance.now() - this._shake.started) / this._shake.duration, 0, 1);
        const fade = 1 - t;
        const amp = this._shake.power * fade;
        shakeX = (Math.random() * 2 - 1) * amp;
        shakeY = (Math.random() * 2 - 1) * amp;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(shakeX, shakeY);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(18,20,28,0.92)");
      bg.addColorStop(1, "rgba(8,9,14,0.98)");
      fillRoundRect(ctx, 0, 0, w, h, 16, bg);

      const boardPad = clamp(Math.round(w * 0.022), 8, 12);
      const usableW = w - boardPad * 2;
      const usableH = h - boardPad * 2;
      const boardSize = Math.min(usableW, usableH);
      const cell = Math.max(20, Math.floor(boardSize / GRID));
      const actual = cell * GRID;
      const ox = Math.floor((w - actual) / 2);
      const oy = Math.floor((h - actual) / 2);

      this._tileRects = [];

      fillRoundRect(ctx, ox - 8, oy - 8, actual + 16, actual + 16, 18, "rgba(255,255,255,0.03)");
      strokeRoundRect(ctx, ox - 8, oy - 8, actual + 16, actual + 16, 18, "rgba(255,255,255,0.08)", 1);

      const hiddenBySwap = new Set();
      if (this._swapAnim?.a && this._swapAnim?.b) {
        hiddenBySwap.add(`${this._swapAnim.a.r}:${this._swapAnim.a.c}`);
        hiddenBySwap.add(`${this._swapAnim.b.r}:${this._swapAnim.b.c}`);
      }

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const x = ox + c * cell;
          const y = oy + r * cell;
          const tile = this._state.board[r][c];
          const selected = this._selected && this._selected.r === r && this._selected.c === c;

          if (tile && !hiddenBySwap.has(`${r}:${c}`)) {
            let dx = 0;
            let dy = 0;
            if (selected && this._dragStart && !this._dragConsumed) {
              dx = clamp(this._dragVector.dx, -cell * 0.32, cell * 0.32);
              dy = clamp(this._dragVector.dy, -cell * 0.32, cell * 0.32);
            }
            this._drawTile(ctx, tile, x + dx, y + dy, cell, selected);
          }

          this._tileRects.push({ r, c, x, y, w: cell, h: cell });
        }
      }

      if (this._swapAnim) {
        const { a, b, tileA, tileB, progress = 0 } = this._swapAnim;
        const t = easeOutBack(progress);

        const ax = ox + a.c * cell;
        const ay = oy + a.r * cell;
        const bx = ox + b.c * cell;
        const by = oy + b.r * cell;

        const curAx = lerp(ax, bx, t);
        const curAy = lerp(ay, by, t);
        const curBx = lerp(bx, ax, t);
        const curBy = lerp(by, ay, t);

        if (tileA) this._drawTile(ctx, tileA, curAx, curAy, cell, false);
        if (tileB) this._drawTile(ctx, tileB, curBx, curBy, cell, false);
      }

      for (const p of this._particles) {
        ctx.save();
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(ox + p.rx * actual, oy + p.ry * actual, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const fx of this._floatTexts) {
        ctx.save();
        ctx.globalAlpha = clamp(fx.life, 0, 1);
        ctx.fillStyle = fx.color;
        ctx.font = `900 ${fx.size}px system-ui, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fx.text, ox + fx.rx * actual, oy + fx.ry * actual);
        ctx.restore();
      }

      if (this._screenFlash) {
        ctx.save();
        ctx.globalAlpha = clamp(this._screenFlash.life, 0, 1);
        ctx.fillStyle = this._screenFlash.color;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      ctx.restore();

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._updateHud();
    },
  };

  window.TonCrimePVP_CRUSH = api;
})();
