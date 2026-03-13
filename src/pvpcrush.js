(function () {
  const GRID = 7;
  const START_HP = 100;
  const START_MOVES = 12;
  const DRAG_THRESHOLD = 16;

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
        while (end < GRID && board[r][end] && board[r][end].type === t) {
          end += 1;
        }

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
        while (end < GRID && board[end][c] && board[end][c].type === t) {
          end += 1;
        }

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
          <div class="tc-crush-chip tc-left-chip" id="tcCrushMeMoves">Hamle: 12</div>
          <div class="tc-crush-title" id="tcCrushTurn">
            <span class="tc-crush-neon">IQ ARENA</span>
            <small>Rakip aranıyor...</small>
          </div>
          <div class="tc-crush-chip tc-right-chip" id="tcCrushEnemyMoves">Rakip: 12</div>
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
      #pvpWrap {
        border: 1px solid rgba(255,255,255,0.10) !important;
        background: rgba(6,10,18,0.14) !important;
        backdrop-filter: blur(14px) !important;
        box-shadow: none !important;
      }
      #pvpHeader {
        background: transparent !important;
        border-bottom: 0 !important;
        padding: 10px 12px 4px !important;
      }
      #pvpBars {
        padding: 4px 12px 8px !important;
        gap: 10px !important;
        background: transparent !important;
      }
      #pvpWrap .pvpBtns,
      #pvpWrap #pvpStart,
      #pvpWrap #pvpStop,
      #pvpWrap #pvpReset {
        display: none !important;
      }
      #pvpOpponentRow {
        color: rgba(255,255,255,0.82) !important;
      }
      #pvpOpponentRow b {
        color: rgba(255,255,255,0.96) !important;
      }
      .pvpBar {
        background: rgba(255,255,255,0.06) !important;
        border: 1px solid rgba(255,255,255,0.10) !important;
      }
      .pvpFill {
        background: linear-gradient(90deg, rgba(255,255,255,0.88), rgba(210,220,255,0.55)) !important;
      }
      #arena {
        position: relative;
        overflow: hidden;
        touch-action: none;
        background: transparent !important;
        border-radius: 22px !important;
      }
      #arena .tc-crush-root {
        position: absolute;
        inset: 0;
        z-index: 5;
        display: flex;
        flex-direction: column;
        padding: 4px 2px 0;
        box-sizing: border-box;
        background: transparent;
      }
      #arena .tc-crush-head {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
        flex: 0 0 auto;
        background: transparent;
      }
      #arena .tc-crush-chip {
        min-height: 34px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(0,0,0,0.18);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 10px;
        font: 800 12px system-ui, Arial;
        backdrop-filter: blur(6px);
        text-align: center;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
      }
      #arena .tc-left-chip,
      #arena .tc-right-chip {
        background: rgba(0,0,0,0.26);
      }
      #arena .tc-crush-title {
        text-align: center;
        color: rgba(255,255,255,0.96);
        font: 900 12px system-ui, Arial;
        min-width: 120px;
      }
      #arena .tc-crush-neon {
        display: inline-block;
        font: 900 18px system-ui, Arial;
        letter-spacing: 1.2px;
        color: #ff4d9d;
        text-shadow:
          0 0 4px rgba(255,77,157,0.9),
          0 0 10px rgba(255,77,157,0.9),
          0 0 18px rgba(255,90,180,0.75),
          0 0 28px rgba(255,110,200,0.60);
        animation: tcArenaNeonPulse 1.25s ease-in-out infinite alternate;
      }
      #arena .tc-crush-title small {
        display: block;
        color: rgba(255,255,255,0.78);
        font: 700 10px system-ui, Arial;
        margin-top: 2px;
      }
      #arena .tc-crush-canvas {
        display: block;
        width: 100%;
        height: 100%;
        flex: 1 1 auto;
        border-radius: 20px;
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
        background: rgba(0,0,0,0.52);
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
      @keyframes tcArenaNeonPulse {
        0% {
          opacity: 0.82;
          text-shadow:
            0 0 3px rgba(255,77,157,0.75),
            0 0 8px rgba(255,77,157,0.72),
            0 0 16px rgba(255,90,180,0.46);
        }
        100% {
          opacity: 1;
          text-shadow:
            0 0 5px rgba(255,77,157,0.98),
            0 0 12px rgba(255,77,157,0.98),
            0 0 22px rgba(255,90,180,0.84),
            0 0 34px rgba(255,110,200,0.65);
        }
      }
      @media (max-width: 520px) {
        #pvpHeader {
          padding: 8px 10px 2px !important;
        }
        #pvpBars {
          padding: 2px 10px 8px !important;
          gap: 8px !important;
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
        #arena .tc-crush-neon {
          font-size: 16px;
        }
        #arena .tc-crush-title small {
          font-size: 9px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getStoreState() {
    return window.tcStore && typeof window.tcStore.get === "function" ? window.tcStore.get() || {} : {};
  }

  function setStorePatch(patch) {
    if (window.tcStore && typeof window.tcStore.set === "function") {
      window.tcStore.set(patch || {});
    }
  }

  function dispatchGameEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {}
  }

  function upsertLeaderboardEntry(board, entry) {
    const next = Array.isArray(board) ? board.map((x) => ({ ...x })) : [];
    const key = String(entry?.telegramId || entry?.username || "player");
    const idx = next.findIndex((x) => String(x.telegramId || x.username || "") === key);
    if (idx >= 0) next[idx] = { ...next[idx], ...entry };
    else next.push({ ...entry });
    next.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || Number(b.wins || 0) - Number(a.wins || 0));
    return next.slice(0, 50);
  }

  function persistMatchResult(result) {
    const state = getStoreState();
    const player = { ...(state.player || {}) };
    const pvp = { ...(state.pvp || {}) };
    const wins = Math.max(0, Number(pvp.wins || 0)) + (result === "win" ? 1 : 0);
    const losses = Math.max(0, Number(pvp.losses || 0)) + (result === "lose" ? 1 : 0);
    const rating = Math.max(600, Number(pvp.rating || 1000) + (result === "win" ? 14 : -9));
    const rewardCoins = result === "win" ? 24 : 8;
    const rewardXp = result === "win" ? 16 : 6;
    const xpNow = Math.max(0, Number(player.xp || 0));
    const xpToNext = Math.max(1, Number(player.xpToNext || 100));
    let nextXp = xpNow + rewardXp;
    let nextLevel = Math.max(1, Number(player.level || 1));
    let nextXpToNext = xpToNext;

    while (nextXp >= nextXpToNext) {
      nextXp -= nextXpToNext;
      nextLevel += 1;
      nextXpToNext = 100;
    }

    const match = {
      id: "pvp_" + Date.now(),
      mode: "iq_arena",
      opponent: pvp.currentOpponent || null,
      result,
      createdAt: Date.now(),
    };

    const recentMatches = [match, ...((Array.isArray(pvp.recentMatches) ? pvp.recentMatches : []).map((x) => ({ ...x })))].slice(0, 12);
    const leaderboard = upsertLeaderboardEntry(pvp.leaderboard, {
      telegramId: String(player.telegramId || player.id || "player_main"),
      username: String(player.username || "Player"),
      rating,
      wins,
      losses,
      updatedAt: Date.now(),
    });

    setStorePatch({
      coins: Math.max(0, Number(state.coins || 0) + rewardCoins),
      player: {
        ...player,
        xp: nextXp,
        xpToNext: nextXpToNext,
        level: nextLevel,
      },
      pvp: {
        ...pvp,
        wins,
        losses,
        rating,
        recentMatches,
        leaderboard,
      },
    });

    dispatchGameEvent(result === "win" ? "tc:pvp:win" : "tc:pvp:lose", {
      mode: "iq_arena",
      rewardCoins,
      rewardXp,
      opponent: pvp.currentOpponent || null,
    });
  }

  function fakeOpponentPool() {
    return [
      { username: "ShadowWolf", isBot: true, skill: 0.82 },
      { username: "NightTiger", isBot: true, skill: 0.78 },
      { username: "IronFist", isBot: true, skill: 0.8 },
      { username: "GhostKiller", isBot: true, skill: 0.76 },
      { username: "KartelKing", isBot: true, skill: 0.84 },
    ];
  }

  function calcHumanLikeBotMove(board, skill = 0.82) {
    const moves = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const dirs = [{ r: 0, c: 1 }, { r: 1, c: 0 }];
        for (const d of dirs) {
          const rr = r + d.r;
          const cc = c + d.c;
          if (!inBounds(rr, cc)) continue;
          const swapped = swapCells(board, { r, c }, { r: rr, c: cc });
          const res = evaluateBoard(swapped, { r: rr, c: cc }, { r, c }, { r: rr, c: cc });
          if (!res.hasAction) continue;
          let score = 0;
          score += res.damage * 3.2;
          score += res.heal * 1.2;
          score += res.coins * 0.7;
          score += res.shield * 0.9;
          score += res.extraMoves * 20;
          for (const m of res.matches) score += m.len * 4;
          score += Math.random() * 5;
          moves.push({ a: { r, c }, b: { r: rr, c: cc }, score });
        }
      }
    }
    if (!moves.length) return null;
    moves.sort((a, b) => b.score - a.score);
    const maxPick = skill >= 0.86 ? 1 : skill >= 0.8 ? Math.min(2, moves.length) : Math.min(4, moves.length);
    return moves[randInt(0, maxPick - 1)];
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
    _opponent: { username: "Rakip", isBot: true, skill: 0.82 },
    _turnTimer: null,
    _matchTimer: null,
    _searchToken: 0,
    _lastResultKey: "",
    _pointerDown: null,
    _dragStart: null,
    _dragFromTile: null,
    _dragConsumed: false,
    _releaseGuard: false,
    _unbind: null,

    init(opts = {}) {
      injectStyle();

      const arena = document.getElementById(opts.arenaId || "arena");
      const status = document.getElementById(opts.statusId || "pvpStatus");
      const enemyFill = document.getElementById(opts.enemyFillId || "enemyFill");
      const meFill = document.getElementById(opts.meFillId || "meFill");
      const enemyHpText = document.getElementById(opts.enemyHpTextId || "enemyHpText");
      const meHpText = document.getElementById(opts.meHpTextId || "meHpText");
      const opponentLabel = document.getElementById("pvpOpponent");
      const spinner = document.getElementById("pvpSpinner");
      const btnWrap = document.querySelector("#pvpWrap .pvpBtns");
      const startBtn = document.getElementById("pvpStart");
      const stopBtn = document.getElementById("pvpStop");
      const resetBtn = document.getElementById("pvpReset");
      const wrap = document.getElementById("pvpWrap");

      if (!arena || !status || !enemyFill || !meFill || !enemyHpText || !meHpText) {
        console.warn("[TonCrimePVP_CRUSH] arena/status/bar elementleri bulunamadı");
        return;
      }

      if (btnWrap) btnWrap.style.display = "none";
      if (startBtn) startBtn.style.display = "none";
      if (stopBtn) stopBtn.style.display = "none";
      if (resetBtn) resetBtn.style.display = "none";
      if (wrap) {
        wrap.style.background = "rgba(6,10,18,0.14)";
        wrap.style.borderColor = "rgba(255,255,255,0.10)";
      }

      this._destroyCanvasEvents();
      this.stop();

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
        opponentLabel,
        spinner,
        canvas,
        ctx,
        meMoves: arena.querySelector("#tcCrushMeMoves"),
        enemyMoves: arena.querySelector("#tcCrushEnemyMoves"),
        turn: arena.querySelector("#tcCrushTurn"),
        toast: arena.querySelector("#tcCrushToast"),
      };

      this._bindCanvas();
      this._safeResizeSequence();
      this.reset();

      this._inited = true;
      this._setStatus("IQ ARENA hazır");
    },

    setOpponent(opp) {
      this._opponent =
        opp && typeof opp.username === "string"
          ? { skill: 0.82, ...opp }
          : { username: "Rakip", isBot: true, skill: 0.82 };

      const state = getStoreState();
      setStorePatch({
        pvp: {
          ...(state.pvp || {}),
          currentOpponent: {
            username: this._opponent.username,
            isBot: !!this._opponent.isBot,
            foundAt: Date.now(),
          },
        },
      });

      if (this._els?.opponentLabel) {
        this._els.opponentLabel.textContent = this._opponent.username;
      }

      if (this._state) this._updateHud();
    },

    async start() {
      if (!this._inited) return;
      await this._waitUntilVisible();
      this.reset();

      this._safeResizeSequence();
      this._running = false;
      this._locked = true;
      this._selected = null;
      this._startMatchmaking();
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
      clearTimeout(this._turnTimer);
      clearTimeout(this._matchTimer);
      this._turnTimer = null;
      this._matchTimer = null;
      if (this._els?.spinner) this._els.spinner.classList.add("hidden");
      this._setStatus("Hazır");
      this._render();
    },

    reset() {
      clearTimeout(this._turnTimer);
      clearTimeout(this._matchTimer);
      this._turnTimer = null;
      this._matchTimer = null;
      this._running = false;
      this._locked = false;
      this._selected = null;
      this._pointerDown = null;
      this._dragStart = null;
      this._dragFromTile = null;
      this._dragConsumed = false;
      this._lastResultKey = "";

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
        info: "Maç bekleniyor",
      };

      if (this._els?.opponentLabel) this._els.opponentLabel.textContent = "aranıyor...";
      if (this._els?.spinner) this._els.spinner.classList.remove("hidden");
      this._safeResizeSequence();
      this._updateHud();
      this._render();
    },

    _startMatchmaking() {
      const token = ++this._searchToken;
      this._setStatus("Rakip aranıyor...");
      this._toast("Rakip aranıyor...");
      if (this._els?.spinner) this._els.spinner.classList.remove("hidden");
      if (this._els?.opponentLabel) this._els.opponentLabel.textContent = "aranıyor...";
      this._state.info = "Eşleşme aranıyor";
      this._updateHud();

      const maybeHuman = Math.random() < 0.38;
      if (maybeHuman) {
        const humanNames = ["MertX", "Ares77", "KartelBey", "NoirKid", "VelvetFox"];
        const delay = randInt(1800, 4400);
        this._matchTimer = setTimeout(() => {
          if (token !== this._searchToken) return;
          this.setOpponent({ username: choice(humanNames), isBot: false, skill: 0.76 + Math.random() * 0.08 });
          this._beginLiveMatch();
        }, delay);
      }

      setTimeout(() => {
        if (token !== this._searchToken || this._running) return;
        this.setOpponent(choice(fakeOpponentPool()));
        this._beginLiveMatch();
      }, 5000);
    },

    _beginLiveMatch() {
      clearTimeout(this._matchTimer);
      this._matchTimer = null;
      this._running = true;
      this._locked = false;
      this._selected = null;
      if (this._els?.spinner) this._els.spinner.classList.add("hidden");
      this._state.turn = "me";
      this._state.info = this._opponent.isBot ? "Bot rakip hazır" : "Canlı rakip hazır";
      this._setStatus(this._opponent.isBot ? "Bot rakip bulundu" : "Rakip bulundu");
      this._toast("Sıra sende");
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
      if (this._els?.status) {
        this._els.status.textContent = "PvP • " + text;
      }
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
        const turnText = !this._running
          ? "Rakip aranıyor..."
          : s.turn === "me"
          ? "Sıra sende"
          : `${this._opponent.username} düşünüyor`;
        this._els.turn.innerHTML = `<span class="tc-crush-neon">IQ ARENA</span><small>${turnText} • ${s.info || "Neon Heist"}</small>`;
      }
    },

    async _playerMove(a, b) {
      if (!this._running || this._locked) return;
      this._locked = true;

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
      await this._sleep(120);

      await this._resolveTurn("me", a, b);

      if (!this._running) return;
      if (this._checkFinish()) return;

      if (this._state.turn === "enemy") {
        this._turnTimer = setTimeout(() => this._enemyPlay(), randInt(760, 1700));
      } else {
        this._locked = false;
      }
    },

    async _enemyPlay() {
      if (!this._running || !this._state || this._state.turn !== "enemy") return;
      this._locked = true;

      const move = calcHumanLikeBotMove(this._state.board, Number(this._opponent.skill || 0.82));
      if (!move) {
        this._state.turn = "me";
        this._state.info = "Rakip hamle bulamadı";
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

      const thinkDelay = randInt(640, 1680);
      await this._sleep(thinkDelay);
      await this._resolveTurn("enemy", move.a, move.b);

      if (!this._running) return;
      if (this._checkFinish()) return;

      if (this._state.turn === "enemy") {
        this._turnTimer = setTimeout(() => this._enemyPlay(), randInt(720, 1650));
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

        this._toast(totalExtra > 0 ? `Vuruş ${dealt} • +${totalExtra} hamle` : `Vuruş ${dealt}`);
        this._state.turn = totalExtra > 0 && this._state.meMoves > 0 ? "me" : "enemy";
      } else {
        this._state.enemyMoves = Math.max(0, this._state.enemyMoves - 1 + totalExtra);

        const meBlock = Math.min(this._state.meArmor, totalDamage);
        const dealt = Math.max(0, totalDamage - meBlock);

        this._state.meArmor = Math.max(0, this._state.meArmor - totalDamage);
        this._state.meHp = clamp(this._state.meHp - dealt, 0, 100);
        this._state.enemyHp = clamp(this._state.enemyHp + totalHeal, 0, 100);
        this._state.enemyArmor = clamp(this._state.enemyArmor + totalShield, 0, 40);
        this._state.enemyCoins += totalCoins;

        this._toast(totalExtra > 0 ? `Rakip ${dealt} vurdu • +${totalExtra} hamle` : `Rakip ${dealt} vurdu`);
        this._state.turn = totalExtra > 0 && this._state.enemyMoves > 0 ? "enemy" : "me";
      }

      this._state.info = `${actor === "me" ? "SEN" : this._opponent.username} • ${Math.max(1, chain)} chain`;
      this._updateHud();
      this._render();
    },

    _finalizeMatch(result) {
      if (!this._state) return true;
      const key = result + "_" + this._state.meHp + "_" + this._state.enemyHp + "_" + this._state.meMoves + "_" + this._state.enemyMoves;
      if (this._lastResultKey === key) return true;
      this._lastResultKey = key;
      this._running = false;
      this._locked = true;
      clearTimeout(this._turnTimer);
      this._turnTimer = null;
      if (this._els?.spinner) this._els.spinner.classList.add("hidden");
      if (result === "win") {
        this._setStatus("Kazandın");
        this._toast("Kazandın • +24 YTON +16 XP");
      } else {
        this._setStatus("Kaybettin");
        this._toast("Kaybettin • +8 YTON +6 XP");
      }
      persistMatchResult(result);
      this._render();
      return true;
    },

    _checkFinish() {
      if (!this._state) return false;

      if (this._state.enemyHp <= 0) {
        return this._finalizeMatch("win");
      }

      if (this._state.meHp <= 0) {
        return this._finalizeMatch("lose");
      }

      if (this._state.meMoves <= 0 && this._state.enemyMoves <= 0) {
        return this._finalizeMatch(this._state.meHp >= this._state.enemyHp ? "win" : "lose");
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

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(18,20,28,0.34)");
      bg.addColorStop(1, "rgba(8,9,14,0.14)");
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

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const x = ox + c * cell;
          const y = oy + r * cell;
          const tile = this._state.board[r][c];
          const selected = this._selected && this._selected.r === r && this._selected.c === c;

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

          this._tileRects.push({ r, c, x, y, w: cell, h: cell });
        }
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      this._updateHud();
    },
  };

  window.TonCrimePVP_CRUSH = api;
})();
