// src/pvpcrush.js
(function () {
  const GRID = 7;
  const START_HP = 100;
  const START_MOVES = 12;

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
    [TILE.PUNCH]: { emoji: "👊", label: "Yumruk", color: "#ffb24a" },
    [TILE.GUN]: { emoji: "🔫", label: "Silah", color: "#ff7a59" },
    [TILE.KNIFE]: { emoji: "🔪", label: "Bıçak", color: "#d66bff" },
    [TILE.MED]: { emoji: "💊", label: "İlaç", color: "#58d68d" },
    [TILE.CASH]: { emoji: "💰", label: "Coin", color: "#ffd166" },
    [TILE.SHIELD]: { emoji: "🛡️", label: "Kalkan", color: "#6fb8ff" },
    [TILE.BOMB]: { emoji: "💣", label: "Bomba", color: "#ffffff" },
  };

  const DAMAGE = {
    [TILE.PUNCH]: 8,
    [TILE.GUN]: 12,
    [TILE.KNIFE]: 10,
    [TILE.BOMB]: 18,
  };

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
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

  function strokeRoundRect(ctx, x, y, w, h, r, stroke, lineWidth = 1) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function makeId() {
    return `tile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function createTile(type) {
    return {
      id: makeId(),
      type,
    };
  }

  function cloneBoard(board) {
    return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  function shuffleTypes() {
    const arr = NORMAL_TYPES.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getWeightedType(seedBias) {
    const types = shuffleTypes();
    if (seedBias % 3 === 0) return choice(types);
    if (seedBias % 3 === 1) return choice(types.slice(0, 5));
    return choice(types.slice(1));
  }

  function buildFreshBoard(lastSignature) {
    let tries = 0;

    while (tries < 60) {
      tries += 1;

      const seedBias = Date.now() + tries * 17 + randInt(1, 99999);
      const board = Array.from({ length: GRID }, () =>
        Array.from({ length: GRID }, () => null)
      );

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          let t = getWeightedType(seedBias + r * 31 + c * 13);
          let safe = 0;

          while (
            safe < 20 &&
            ((c >= 2 &&
              board[r][c - 1] &&
              board[r][c - 2] &&
              board[r][c - 1].type === t &&
              board[r][c - 2].type === t) ||
              (r >= 2 &&
                board[r - 1][c] &&
                board[r - 2][c] &&
                board[r - 1][c].type === t &&
                board[r - 2][c].type === t))
          ) {
            t = getWeightedType(seedBias + safe * 7 + c * 5);
            safe += 1;
          }

          board[r][c] = createTile(t);
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

  function boardSignature(board) {
    return board.map((row) => row.map((c) => (c ? c.type[0] : "_")).join("")).join("|");
  }

  function swapCells(board, a, b) {
    const next = cloneBoard(board);
    const tmp = next[a.r][a.c];
    next[a.r][a.c] = next[b.r][b.c];
    next[b.r][b.c] = tmp;
    return next;
  }

  function isAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  function inBounds(r, c) {
    return r >= 0 && r < GRID && c >= 0 && c < GRID;
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

  function findMatches(board) {
    const matches = [];
    const used = new Set();

    function key(r, c) {
      return `${r}:${c}`;
    }

    for (let r = 0; r < GRID; r++) {
      let c = 0;
      while (c < GRID) {
        const cell = board[r][c];
        if (!cell) {
          c += 1;
          continue;
        }
        const t = cell.type;
        if (t === TILE.BOMB) {
          c += 1;
          continue;
        }

        let end = c + 1;
        while (
          end < GRID &&
          board[r][end] &&
          board[r][end].type === t
        ) {
          end += 1;
        }

        const len = end - c;
        if (len >= 3) {
          const cells = [];
          for (let i = c; i < end; i++) {
            cells.push({ r, c: i });
            used.add(key(r, i));
          }
          matches.push({
            type: t,
            len,
            dir: "h",
            cells,
          });
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
        if (t === TILE.BOMB) {
          r += 1;
          continue;
        }

        let end = r + 1;
        while (
          end < GRID &&
          board[end][c] &&
          board[end][c].type === t
        ) {
          end += 1;
        }

        const len = end - r;
        if (len >= 3) {
          const cells = [];
          for (let i = r; i < end; i++) {
            if (!used.has(key(i, c))) {
              cells.push({ r: i, c });
            } else {
              cells.push({ r: i, c });
            }
          }
          matches.push({
            type: t,
            len,
            dir: "v",
            cells,
          });
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

  function chooseBombSpawnCell(match, preferredCell) {
    if (preferredCell) {
      for (const p of match.cells) {
        if (p.r === preferredCell.r && p.c === preferredCell.c) return p;
      }
    }
    return match.cells[Math.floor(match.cells.length / 2)];
  }

  function evaluateMatches(board, matches, actor, preferredSpawn) {
    const remove = new Set();
    const bombsToSpawn = [];
    let damage = 0;
    let heal = 0;
    let coins = 0;
    let shield = 0;
    let extraMoves = 0;
    const triggeredBombs = [];

    function addRemove(r, c) {
      remove.add(`${r}:${c}`);
    }

    for (const m of matches) {
      if (m.len >= 4) {
        extraMoves += 1;
      }

      if (m.type === TILE.PUNCH) {
        damage += DAMAGE[TILE.PUNCH] + Math.max(0, m.len - 3) * 2;
      } else if (m.type === TILE.GUN) {
        damage += DAMAGE[TILE.GUN] + Math.max(0, m.len - 3) * 3;
      } else if (m.type === TILE.KNIFE) {
        damage += DAMAGE[TILE.KNIFE] + Math.max(0, m.len - 3) * 2;
      } else if (m.type === TILE.MED) {
        heal += 8 + Math.max(0, m.len - 3) * 3;
      } else if (m.type === TILE.CASH) {
        coins += 5 + Math.max(0, m.len - 3) * 3;
      } else if (m.type === TILE.SHIELD) {
        shield += 6 + Math.max(0, m.len - 3) * 2;
      }

      const spawnCell = m.len >= 5 ? chooseBombSpawnCell(m, preferredSpawn) : null;

      for (const cell of m.cells) {
        if (spawnCell && cell.r === spawnCell.r && cell.c === spawnCell.c) continue;
        addRemove(cell.r, cell.c);
      }

      if (spawnCell) {
        bombsToSpawn.push(spawnCell);
      }
    }

    const bombSources = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const cell = board[r][c];
        if (!cell || cell.type !== TILE.BOMB) continue;

        const left = c > 0 ? board[r][c - 1] : null;
        const right = c < GRID - 1 ? board[r][c + 1] : null;
        const up = r > 0 ? board[r - 1][c] : null;
        const down = r < GRID - 1 ? board[r + 1][c] : null;

        const armed =
          (left && right && left.type === right.type && left.type !== TILE.BOMB) ||
          (up && down && up.type === down.type && up.type !== TILE.BOMB);

        if (armed) {
          bombSources.push({ r, c });
        }
      }
    }

    for (const src of bombSources) {
      triggeredBombs.push(src);
      const blast = floodBombCells(src.r, src.c);
      for (const b of blast) {
        addRemove(b.r, b.c);
      }
      damage += DAMAGE[TILE.BOMB];
    }

    return {
      actor,
      damage,
      heal,
      coins,
      shield,
      extraMoves,
      remove,
      bombsToSpawn,
      triggeredBombs,
    };
  }

  function applyResolution(board, resolution) {
    const next = cloneBoard(board);

    for (const key of resolution.remove) {
      const [r, c] = key.split(":").map(Number);
      next[r][c] = null;
    }

    for (const bombCell of resolution.bombsToSpawn) {
      next[bombCell.r][bombCell.c] = createTile(TILE.BOMB);
    }

    return collapseBoard(next);
  }

  function firstDifference(before, after) {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const a = before[r][c]?.id || "";
        const b = after[r][c]?.id || "";
        if (a !== b) return { r, c };
      }
    }
    return null;
  }

  function calcBotMove(board) {
    let best = null;

    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const swaps = [
          { r2: r, c2: c + 1 },
          { r2: r + 1, c2: c },
        ];

        for (const s of swaps) {
          if (!inBounds(s.r2, s.c2)) continue;
          const swapped = swapCells(board, { r, c }, { r: s.r2, c: s.c2 });
          const matches = findMatches(swapped);
          if (!matches.length) continue;

          let score = 0;
          for (const m of matches) {
            score += m.len * 10;
            if (m.type === TILE.GUN) score += 8;
            if (m.type === TILE.PUNCH) score += 6;
            if (m.type === TILE.KNIFE) score += 6;
            if (m.type === TILE.MED) score += 3;
            if (m.type === TILE.CASH) score += 2;
            if (m.type === TILE.SHIELD) score += 3;
            if (m.len >= 4) score += 12;
            if (m.len >= 5) score += 18;
          }

          score += Math.random() * 4;

          if (!best || score > best.score) {
            best = {
              a: { r, c },
              b: { r: s.r2, c: s.c2 },
              score,
            };
          }
        }
      }
    }

    return best;
  }

  function dispatch(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  const api = {
    _inited: false,
    _running: false,
    _locked: false,
    _turnTimeout: null,
    _els: null,
    _state: null,
    _selected: null,
    _pointerDown: null,
    _tileRects: [],
    _lastBoardSignature: "",
    _opponent: { username: "Rakip", isBot: true },

    boot() {
      console.log("[TonCrimePVP_CRUSH] boot");
    },

    init(opts = {}) {
      const arena = document.getElementById(opts.arenaId || "arena");
      const status = document.getElementById(opts.statusId || "pvpStatus");
      const enemyFill = document.getElementById(opts.enemyFillId || "enemyFill");
      const meFill = document.getElementById(opts.meFillId || "meFill");
      const enemyHpText = document.getElementById(opts.enemyHpTextId || "enemyHpText");
      const meHpText = document.getElementById(opts.meHpTextId || "meHpText");

      if (!arena || !status || !enemyFill || !meFill || !enemyHpText || !meHpText) {
        console.warn("[TonCrimePVP_CRUSH] gerekli elementler yok");
        return;
      }

      this._injectStyle(arena.id || "arena");
      this._els = { arena, status, enemyFill, meFill, enemyHpText, meHpText };
      this._bindArena();
      this._inited = true;
      this.reset();
    },

    setOpponent(opp) {
      if (opp && typeof opp.username === "string") {
        this._opponent = { ...this._opponent, ...opp };
      }
    },

    start() {
      if (!this._inited) return;
      this.reset();
      this._running = true;
      this._setStatus(`Grid Heist • ${this._opponent.username}`);
      this._toast(`Sıra sende`);
      this._render();
    },

    stop() {
      this._running = false;
      this._locked = false;
      clearTimeout(this._turnTimeout);
      this._turnTimeout = null;
      this._setStatus("Durduruldu");
      this._render();
    },

    reset() {
      if (!this._inited) return;

      clearTimeout(this._turnTimeout);
      this._turnTimeout = null;
      this._locked = false;
      this._selected = null;
      this._pointerDown = null;

      const board = buildFreshBoard(this._lastBoardSignature);
      this._lastBoardSignature = boardSignature(board);

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
        lastFx: null,
        lastInfo: "Yeni maç",
      };

      this._updateBars();
      this._setStatus("Hazır");
      this._render();
    },

    _injectStyle(arenaId) {
      const styleId = "tc-pvp-crush-style";
      if (document.getElementById(styleId)) return;

      const css = `
#${arenaId}{
  position:relative;
  overflow:hidden;
  touch-action:none;
}
#${arenaId} .tc-crush-root{
  position:absolute;
  inset:0;
  z-index:3;
  display:flex;
  flex-direction:column;
  padding:10px;
  box-sizing:border-box;
}
#${arenaId} .tc-crush-top{
  display:grid;
  grid-template-columns:1fr auto 1fr;
  align-items:center;
  gap:8px;
  margin-bottom:8px;
}
#${arenaId} .tc-crush-pill{
  min-height:34px;
  border-radius:12px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(0,0,0,.34);
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:0 10px;
  font:800 12px system-ui, Arial;
  backdrop-filter: blur(6px);
}
#${arenaId} .tc-crush-center{
  text-align:center;
  color:rgba(255,255,255,.95);
  font:900 12px system-ui, Arial;
}
#${arenaId} .tc-crush-center small{
  display:block;
  color:rgba(255,255,255,.72);
  font:600 10px system-ui, Arial;
  margin-top:2px;
}
#${arenaId} .tc-crush-canvas{
  flex:1 1 auto;
  width:100%;
  height:100%;
  display:block;
  border-radius:16px;
}
#${arenaId} .tc-crush-toast{
  position:absolute;
  left:50%;
  top:50%;
  transform:translate(-50%, -50%);
  z-index:8;
  pointer-events:none;
  padding:10px 14px;
  border-radius:14px;
  background:rgba(0,0,0,.62);
  border:1px solid rgba(255,255,255,.14);
  color:#fff;
  font:900 13px system-ui, Arial;
  opacity:0;
  transition:opacity .16s ease;
  backdrop-filter: blur(10px);
  text-align:center;
  min-width:180px;
}
#${arenaId} .tc-crush-toast.on{
  opacity:1;
}
`;
      const st = document.createElement("style");
      st.id = styleId;
      st.textContent = css;
      document.head.appendChild(st);
    },

    _bindArena() {
      const arena = this._els.arena;
      arena.innerHTML = `
        <div class="tc-crush-root">
          <div class="tc-crush-top">
            <div class="tc-crush-pill" id="tcCrushMeMoves">Hamle: 12</div>
            <div class="tc-crush-center" id="tcCrushTurn">SEN<small>7x7 Grid Heist</small></div>
            <div class="tc-crush-pill" id="tcCrushEnemyMoves">Rakip: 12</div>
          </div>
          <canvas class="tc-crush-canvas"></canvas>
          <div class="tc-crush-toast" id="tcCrushToast"></div>
        </div>
      `;

      this._els.canvas = arena.querySelector(".tc-crush-canvas");
      this._els.ctx = this._els.canvas.getContext("2d");
      this._els.turn = arena.querySelector("#tcCrushTurn");
      this._els.meMoves = arena.querySelector("#tcCrushMeMoves");
      this._els.enemyMoves = arena.querySelector("#tcCrushEnemyMoves");
      this._els.toast = arena.querySelector("#tcCrushToast");

      const canvas = this._els.canvas;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.max(10, Math.floor(rect.width * dpr));
        canvas.height = Math.max(10, Math.floor(rect.height * dpr));
        this._els.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._render();
      };

      this._resizeHandler = resize;
      window.addEventListener("resize", resize);
      resize();

      const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        const clientX = e.touches?.[0]?.clientX ?? e.clientX;
        const clientY = e.touches?.[0]?.clientY ?? e.clientY;
        return { x: clientX - r.left, y: clientY - r.top };
      };

      const onDown = (e) => {
        if (!this._running || this._locked || this._state.turn !== "me") return;
        const p = getPos(e);
        const hit = this._hitTile(p.x, p.y);
        if (!hit) return;
        this._pointerDown = hit;
        e.preventDefault?.();
      };

      const onUp = (e) => {
        if (!this._running || this._locked || this._state.turn !== "me") return;
        if (!this._pointerDown) return;

        const p = getPos(e);
        const hit = this._hitTile(p.x, p.y);

        if (!hit) {
          this._selected = this._pointerDown;
          this._pointerDown = null;
          this._render();
          return;
        }

        if (
          this._selected &&
          this._selected.r === hit.r &&
          this._selected.c === hit.c
        ) {
          this._selected = null;
          this._pointerDown = null;
          this._render();
          return;
        }

        const from = this._selected || this._pointerDown;
        this._pointerDown = null;

        if (!from) return;

        if (!isAdjacent(from, hit)) {
          this._selected = hit;
          this._render();
          return;
        }

        this._selected = null;
        this._playerMove(from, hit);
        e.preventDefault?.();
      };

      canvas.addEventListener("mousedown", onDown);
      canvas.addEventListener("mouseup", onUp);
      canvas.addEventListener("touchstart", onDown, { passive: false });
      canvas.addEventListener("touchend", onUp, { passive: false });

      this._unbindCanvas = () => {
        window.removeEventListener("resize", resize);
        canvas.removeEventListener("mousedown", onDown);
        canvas.removeEventListener("mouseup", onUp);
        canvas.removeEventListener("touchstart", onDown);
        canvas.removeEventListener("touchend", onUp);
      };
    },

    _setStatus(text) {
      if (this._els?.status) this._els.status.textContent = "PvP • " + text;
    },

    _toast(text) {
      const el = this._els?.toast;
      if (!el) return;
      el.innerHTML = String(text || "");
      el.classList.add("on");
      clearTimeout(el._offT);
      el._offT = setTimeout(() => el.classList.remove("on"), 1100);
    },

    _updateBars() {
      if (!this._els || !this._state) return;
      const s = this._state;

      this._els.meFill.style.transform = `scaleX(${clamp(s.meHp, 0, 100) / 100})`;
      this._els.enemyFill.style.transform = `scaleX(${clamp(s.enemyHp, 0, 100) / 100})`;
      this._els.meHpText.textContent = Math.max(0, Math.round(s.meHp));
      this._els.enemyHpText.textContent = Math.max(0, Math.round(s.enemyHp));

      if (this._els.meMoves) this._els.meMoves.textContent = `Hamle: ${s.meMoves}`;
      if (this._els.enemyMoves) this._els.enemyMoves.textContent = `Rakip: ${s.enemyMoves}`;
      if (this._els.turn) {
        this._els.turn.innerHTML =
          `${s.turn === "me" ? "SEN" : this._opponent.username.toUpperCase()}<small>${s.lastInfo || "7x7 Grid Heist"}</small>`;
      }
    },

    _finish(result) {
      this._running = false;
      this._locked = true;
      clearTimeout(this._turnTimeout);
      this._turnTimeout = null;

      if (result === "win") {
        this._setStatus("Kazandın");
        this._toast("Kazandın");
        dispatch("tc:pvp:win", {
          mode: "grid",
          opponent: this._opponent,
          coins: this._state?.meCoins || 0,
        });
      } else {
        this._setStatus("Kaybettin");
        this._toast("Kaybettin");
        dispatch("tc:pvp:lose", {
          mode: "grid",
          opponent: this._opponent,
          coins: this._state?.meCoins || 0,
        });
      }

      this._render();
    },

    async _playerMove(a, b) {
      if (!this._running || this._locked) return;
      this._locked = true;

      const before = this._state.board;
      const swapped = swapCells(before, a, b);
      const matches = findMatches(swapped);

      const bombSwap =
        swapped[a.r][a.c]?.type === TILE.BOMB || swapped[b.r][b.c]?.type === TILE.BOMB;

      if (!matches.length && !bombSwap) {
        this._toast("Geçersiz hamle");
        this._locked = false;
        this._render();
        return;
      }

      this._state.board = swapped;
      this._render();
      await this._sleep(120);

      await this._resolveTurn("me", { a, b });

      if (!this._running) return;

      if (this._state.enemyHp <= 0) {
        this._finish("win");
        return;
      }

      if (this._state.meMoves <= 0 && this._state.enemyMoves <= 0) {
        this._finish(this._state.meHp >= this._state.enemyHp ? "win" : "lose");
        return;
      }

      if (this._state.turn === "enemy") {
        this._turnTimeout = setTimeout(() => this._enemyPlay(), 550);
      } else {
        this._locked = false;
      }
    },

    async _enemyPlay() {
      if (!this._running) return;
      this._locked = true;

      const botMove = calcBotMove(this._state.board);
      if (!botMove) {
        this._state.turn = "me";
        this._state.lastInfo = "Rakip hamle bulamadı";
        this._updateBars();
        this._render();
        this._locked = false;
        this._toast("Rakip hamle bulamadı");
        return;
      }

      const swapped = swapCells(this._state.board, botMove.a, botMove.b);
      this._state.board = swapped;
      this._state.lastInfo = "Rakip oynuyor";
      this._updateBars();
      this._render();

      await this._sleep(240);
      await this._resolveTurn("enemy", botMove);

      if (!this._running) return;

      if (this._state.meHp <= 0) {
        this._finish("lose");
        return;
      }

      if (this._state.meMoves <= 0 && this._state.enemyMoves <= 0) {
        this._finish(this._state.meHp >= this._state.enemyHp ? "win" : "lose");
        return;
      }

      if (this._state.turn === "enemy") {
        this._turnTimeout = setTimeout(() => this._enemyPlay(), 520);
      } else {
        this._locked = false;
      }
    },

    async _resolveTurn(actor, moveMeta) {
      let chain = 0;
      let board = this._state.board;
      let totalDamage = 0;
      let totalHeal = 0;
      let totalCoins = 0;
      let totalShield = 0;
      let totalExtra = 0;

      while (true) {
        const matches = findMatches(board);
        const preferredSpawn =
          chain === 0 && moveMeta ? firstDifference(this._state.board, board) || moveMeta.b : null;

        const resolution = evaluateMatches(board, matches, actor, preferredSpawn);

        if (
          !matches.length &&
          resolution.triggeredBombs.length === 0
        ) {
          break;
        }

        chain += 1;
        totalDamage += resolution.damage;
        totalHeal += resolution.heal;
        totalCoins += resolution.coins;
        totalShield += resolution.shield;
        totalExtra += resolution.extraMoves;

        board = applyResolution(board, resolution);
        this._state.board = board;
        this._state.lastInfo = `${actor === "me" ? "SEN" : this._opponent.username} • Combo x${chain}`;
        this._updateBars();
        this._render();
        await this._sleep(180);
      }

      if (!hasAnyPossibleMove(board)) {
        board = buildFreshBoard(this._lastBoardSignature);
      }

      this._lastBoardSignature = boardSignature(board);
      this._state.board = board;

      if (actor === "me") {
        this._state.meMoves = Math.max(0, this._state.meMoves - 1 + totalExtra);

        const enemyBlock = Math.min(this._state.enemyArmor, totalDamage);
        const finalDamage = Math.max(0, totalDamage - enemyBlock);
        this._state.enemyArmor = Math.max(0, this._state.enemyArmor - totalDamage);
        this._state.enemyHp = clamp(this._state.enemyHp - finalDamage, 0, 100);
        this._state.meHp = clamp(this._state.meHp + totalHeal, 0, 100);
        this._state.meCoins += totalCoins;
        this._state.meArmor = clamp(this._state.meArmor + totalShield, 0, 40);

        this._toast(
          totalExtra > 0
            ? `Vuruş ${finalDamage} • +${totalExtra} hamle`
            : `Vuruş ${finalDamage}`
        );

        this._state.turn = totalExtra > 0 && this._state.meMoves > 0 ? "me" : "enemy";
      } else {
        this._state.enemyMoves = Math.max(0, this._state.enemyMoves - 1 + totalExtra);

        const meBlock = Math.min(this._state.meArmor, totalDamage);
        const finalDamage = Math.max(0, totalDamage - meBlock);
        this._state.meArmor = Math.max(0, this._state.meArmor - totalDamage);
        this._state.meHp = clamp(this._state.meHp - finalDamage, 0, 100);
        this._state.enemyHp = clamp(this._state.enemyHp + totalHeal, 0, 100);
        this._state.enemyCoins += totalCoins;
        this._state.enemyArmor = clamp(this._state.enemyArmor + totalShield, 0, 40);

        this._toast(
          totalExtra > 0
            ? `Rakip ${finalDamage} vurdu • +${totalExtra} hamle`
            : `Rakip ${finalDamage} vurdu`
        );

        this._state.turn = totalExtra > 0 && this._state.enemyMoves > 0 ? "enemy" : "me";
      }

      this._state.lastInfo =
        `${actor === "me" ? "SEN" : this._opponent.username} • ${chain || 1} chain`;

      this._updateBars();
      this._render();

      if (this._state.meHp <= 0 || this._state.enemyHp <= 0) return;
      if (this._state.meMoves <= 0 && this._state.enemyMoves <= 0) return;
    },

    _sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    _hitTile(x, y) {
      for (const r of this._tileRects) {
        if (pointInRect(x, y, r)) return r;
      }
      return null;
    },

    _render() {
      if (!this._els?.ctx || !this._state) return;

      const ctx = this._els.ctx;
      const canvas = this._els.canvas;
      const w = canvas.clientWidth || 300;
      const h = canvas.clientHeight || 300;

      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(18,20,28,0.92)");
      bg.addColorStop(1, "rgba(8,9,14,0.98)");
      fillRoundRect(ctx, 0, 0, w, h, 16, bg);

      const boardPad = Math.max(10, Math.round(w * 0.028));
      const boardSize = Math.min(w - boardPad * 2, h - boardPad * 2);
      const cell = Math.floor(boardSize / GRID);
      const actualBoard = cell * GRID;
      const ox = Math.floor((w - actualBoard) / 2);
      const oy = Math.floor((h - actualBoard) / 2);

      this._tileRects = [];

      fillRoundRect(ctx, ox - 8, oy - 8, actualBoard + 16, actualBoard + 16, 18, "rgba(255,255,255,0.03)");
      strokeRoundRect(ctx, ox - 8, oy - 8, actualBoard + 16, actualBoard + 16, 18, "rgba(255,255,255,0.08)", 1);

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const x = ox + c * cell;
          const y = oy + r * cell;
          const tile = this._state.board[r][c];

          const isSelected =
            this._selected && this._selected.r === r && this._selected.c === c;

          fillRoundRect(
            ctx,
            x + 2,
            y + 2,
            cell - 4,
            cell - 4,
            Math.max(10, Math.floor(cell * 0.18)),
            isSelected ? "rgba(255,181,74,0.22)" : "rgba(255,255,255,0.06)"
          );

          strokeRoundRect(
            ctx,
            x + 2,
            y + 2,
            cell - 4,
            cell - 4,
            Math.max(10, Math.floor(cell * 0.18)),
            isSelected ? "rgba(255,181,74,0.92)" : "rgba(255,255,255,0.08)",
            isSelected ? 2 : 1
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
          }

          this._tileRects.push({
            r,
            c,
            x,
            y,
            w: cell,
            h: cell,
          });
        }
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      this._updateBars();
    },

    destroy() {
      this.stop();
      if (this._unbindCanvas) this._unbindCanvas();
      this._inited = false;
      this._els = null;
      this._state = null;
    },
  };

  window.TonCrimePVP_CRUSH = api;
})();
