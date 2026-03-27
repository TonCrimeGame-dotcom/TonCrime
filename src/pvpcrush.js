(function () {
  const GRID = 7;
  const START_HP = 1000;
  const START_MOVES = 12;
  const ACTIONS_PER_TURN = 2;
  const TURN_TIME_MS = 40000;
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
    [TILE.PUNCH]: { id: "punch", emoji: "👊", label: "YUMRUK", color: "#ffb24a", damage: SLOT_DAMAGE.punch, bad: false, heal: false, assetKey: "punch" },
    [TILE.KICK]: { id: "kick", emoji: "🦵", label: "TEKME", color: "#63e36c", damage: SLOT_DAMAGE.kick, bad: false, heal: false, assetKey: "kick" },
    [TILE.SLAP]: { id: "slap", emoji: "🖐️", label: "TOKAT", color: "#7cb6ff", damage: SLOT_DAMAGE.slap, bad: false, heal: false, assetKey: "slap" },
    [TILE.HEAD]: { id: "brain", emoji: "🧠", label: "BEYİN", color: "#ff6464", damage: SLOT_DAMAGE.head, bad: false, heal: false, assetKey: "brain" },
    [TILE.WEED]: { id: "weed", emoji: "🌿", label: "OT", color: "#33dd77", damage: 0, bad: false, heal: true, assetKey: "weed" },
  };

  const ICON_PATHS = {
    punch: "./src/assets/punch.png",
    kick: "./src/assets/kick.png",
    slap: "./src/assets/slap.png",
    brain: "./src/assets/brain.png",
    weed: "./src/assets/weed.png",
    drink: "./src/assets/drink.png",
  };

  const ICON_IMAGES = {};
  let ICONS_LOADING = null;

  function loadIcons() {
    if (ICONS_LOADING) return ICONS_LOADING;

    const jobs = Object.entries(ICON_PATHS).map(([key, src]) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          ICON_IMAGES[key] = img;
          resolve();
        };
        img.onerror = () => {
          ICON_IMAGES[key] = null;
          resolve();
        };
        img.src = src;
      });
    });

    ICONS_LOADING = Promise.all(jobs);
    return ICONS_LOADING;
  }

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

  function fmtTurnTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const sec = total % 60;
    return `00:${String(sec).padStart(2, "0")}`;
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

  function diffBoardCells(prevBoard, nextBoard) {
    const out = [];
    if (!Array.isArray(prevBoard) || !Array.isArray(nextBoard)) return out;
    const rows = Math.min(prevBoard.length || 0, nextBoard.length || 0, GRID);
    for (let r = 0; r < rows; r++) {
      const prevRow = Array.isArray(prevBoard[r]) ? prevBoard[r] : [];
      const nextRow = Array.isArray(nextBoard[r]) ? nextBoard[r] : [];
      const cols = Math.min(prevRow.length || 0, nextRow.length || 0, GRID);
      for (let c = 0; c < cols; c++) {
        const a = prevRow[c]?.type || null;
        const b = nextRow[c]?.type || null;
        if (a !== b) out.push({ r, c });
      }
    }
    return out;
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

  function getExtraMoveCount(len) {
    if (len >= 6) return 3;
    if (len === 5) return 2;
    if (len === 4) return 1;
    return 0;
  }

  function getMatchFxLabel(len) {
    if (len >= 6) return "ULTRA MOVE +3";
    if (len === 5) return "MEGA MOVE +2";
    if (len === 4) return "EXTRA MOVE +1";
    return "";
  }

  function evaluateBoard(board) {
    const matches = findMatches(board);
    const remove = new Set();
    let damage = 0;
    let heal = 0;
    let extraMoves = 0;
    const fxBursts = [];

    for (const m of matches) {
      const bonus = Math.max(0, m.len - 3);
      const center = m.cells[Math.floor(m.cells.length / 2)] || m.cells[0];
      const moveGain = getExtraMoveCount(m.len);

      if (moveGain > 0) {
        extraMoves += moveGain;
        fxBursts.push({
          kind: "extra",
          label: getMatchFxLabel(m.len),
          color: "#ffd166",
          len: m.len,
          cell: center,
        });
      } else {
        fxBursts.push({
          kind: "match",
          label: `${m.len}LÜ`,
          color: (TILE_META[m.type] || TILE_META[TILE.PUNCH]).color,
          len: m.len,
          cell: center,
        });
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

    return {
      hasAction: matches.length > 0,
      matches,
      remove,
      damage,
      heal,
      extraMoves,
      fxBursts,
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
            if (m.len >= 4) score += getExtraMoveCount(m.len) * 22;
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

  function drawTileIcon(ctx, tileType, x, y, size, selected, animT) {
    const meta = TILE_META[tileType] || TILE_META[TILE.PUNCH];
    const img = ICON_IMAGES[meta.assetKey];
    const r = Math.max(8, Math.floor(size * 0.18));

    // Renkli tile zemin
    const tileGrad = ctx.createLinearGradient(x, y, x + size, y + size);
    tileGrad.addColorStop(0, meta.color + "22");
    tileGrad.addColorStop(1, meta.color + "0a");
    fillRoundRect(ctx, x, y, size, size, r, tileGrad);

    // Seçili tile için parlayan border
    if (selected) {
      const pulse = 0.7 + 0.3 * Math.sin((animT || 0) * 0.006);
      strokeRoundRect(ctx, x, y, size, size, r, meta.color + Math.round(pulse * 255).toString(16).padStart(2, "0"), 2.5);
    } else {
      strokeRoundRect(ctx, x, y, size, size, r, meta.color + "33", 1);
    }

    // Köşe aksanı (küçük renkli nokta sağ üstte)
    ctx.fillStyle = meta.color + "bb";
    ctx.beginPath();
    ctx.arc(x + size - 7, y + 7, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // PNG varsa çiz
    if (img && img.complete && (img.naturalWidth || img.width)) {
      const pad = Math.max(3, Math.floor(size * 0.1));
      const drawSize = Math.max(8, size - pad * 2);
      ctx.drawImage(img, x + pad, y + pad, drawSize, drawSize);
      return;
    }

    // Fallback — emoji
    ctx.font = `900 ${Math.floor(size * 0.47)}px system-ui, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(meta.emoji, x + size / 2, y + size / 2 + 1);
  }

  function makeArenaMarkup() {
    return `
      <div class="tc-cage-root tc-crush-root">
        <div class="tc-cage-top tc-crush-top">
          <button class="tc-cage-x tc-crush-x" id="tcCrushClose" type="button" aria-label="Geri">✕</button>

          <div class="tc-cage-title-wrap tc-crush-title-wrap">
            <div class="tc-cage-neon tc-crush-neon">IQ ARENA</div>
            <div class="tc-cage-sub tc-crush-sub" id="tcCrushSub">Rakip aranıyor...</div>
          </div>
        </div>

        <div class="tc-cage-row tc-crush-row">
          <div class="tc-cage-card tc-crush-card">
            <div class="tc-cage-name tc-crush-name" id="tcCrushEnemyName">Rakip</div>
            <div class="tc-cage-hpbar tc-crush-hpbar"><div class="tc-cage-hpfill tc-crush-hpfill" id="tcCrushEnemyFill"></div></div>
            <div class="tc-cage-hptext tc-crush-hptext" id="tcCrushEnemyText">100 / 100</div>
            <div class="tc-crush-chipline" id="tcCrushEnemyMoves">Hamle: 12</div>
          </div>

          <div class="tc-cage-vs tc-crush-vs" id="tcCrushTurn">VS</div>

          <div class="tc-cage-card tc-crush-card">
            <div class="tc-cage-name tc-crush-name" id="tcCrushMeName">Sen</div>
            <div class="tc-cage-hpbar tc-crush-hpbar"><div class="tc-cage-hpfill tc-crush-hpfill" id="tcCrushMeFill"></div></div>
            <div class="tc-cage-hptext tc-crush-hptext" id="tcCrushMeText">100 / 100</div>
            <div class="tc-crush-chipline" id="tcCrushMeMoves">Hamle: 12</div>
          </div>
        </div>

        <div class="tc-cage-stage tc-crush-stage" id="tcCrushStage">
          <canvas class="tc-cage-canvas tc-crush-canvas"></canvas>
          <div class="tc-cage-toast tc-crush-toast" id="tcCrushToast"></div>
        </div>

        <div class="tc-cage-rule tc-crush-rule">Sürükleyerek veya dokunarak taş değiştir • Raund başı 40sn • Extra move en fazla 2 hakta kalır</div>
      </div>
    `;
  }

  function injectStyle() {
    const id = "tc-pvp-crush-style";
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
          radial-gradient(circle at 50% 20%, rgba(255,100,100,0.12), transparent 34%),
          radial-gradient(circle at 50% 80%, rgba(255,180,70,0.10), transparent 34%),
          linear-gradient(180deg, rgba(16,18,28,0.96), rgba(6,8,14,0.98)) !important;
      }

      #arena .tc-cage-root {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        padding: 10px;
        box-sizing: border-box;
        color: #fff;
        user-select: none;
      }

      #arena .tc-cage-top {
        position: relative;
        flex: 0 0 auto;
        padding-top: 4px;
        margin-bottom: 10px;
      }

      #arena .tc-cage-x {
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

      #arena .tc-cage-title-wrap {
        text-align: center;
        padding: 2px 42px 0;
      }

      #arena .tc-cage-neon {
        display: inline-block;
        font: 900 22px system-ui, Arial;
        letter-spacing: 1.8px;
        text-transform: uppercase;
        color: #ff5858;
        text-shadow:
          0 0 4px rgba(255,88,88,0.95),
          0 0 10px rgba(255,88,88,0.95),
          0 0 18px rgba(255,40,40,0.92),
          0 0 34px rgba(255,0,0,0.78);
        animation: tcCrushNeon 1.15s ease-in-out infinite alternate;
      }

      @keyframes tcCrushNeon {
        0% {
          opacity: .76;
          transform: scale(0.995);
          text-shadow:
            0 0 3px rgba(255,88,88,0.84),
            0 0 8px rgba(255,88,88,0.84),
            0 0 16px rgba(255,20,20,0.74);
        }
        100% {
          opacity: 1;
          transform: scale(1.01);
          text-shadow:
            0 0 5px rgba(255,110,110,1),
            0 0 12px rgba(255,90,90,1),
            0 0 24px rgba(255,40,40,0.98),
            0 0 42px rgba(255,0,0,0.90);
        }
      }

      #arena .tc-cage-sub {
        margin-top: 6px;
        font: 800 11px system-ui, Arial;
        color: rgba(255,255,255,0.74);
        letter-spacing: .4px;
      }

      #arena .tc-cage-row {
        display: grid;
        grid-template-columns: 1fr 76px 1fr;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      #arena .tc-cage-vs {
        text-align: center;
        font: 900 16px system-ui, Arial;
        color: rgba(255,255,255,0.9);
      }

      #arena .tc-cage-card {
        min-height: 88px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        backdrop-filter: blur(8px);
        padding: 10px 12px;
        box-sizing: border-box;
      }

      #arena .tc-cage-name {
        font: 900 13px system-ui, Arial;
        color: rgba(255,255,255,0.96);
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #arena .tc-cage-hpbar {
        height: 12px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.10);
      }

      #arena .tc-cage-hpfill {
        height: 100%;
        width: 100%;
        transform-origin: left center;
        background: linear-gradient(90deg, #2fe870, #88ffb0);
      }

      #arena .tc-cage-hptext {
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
        backdrop-filter: blur(4px);
        text-align: center;
      }

      #arena .tc-cage-stage {
        position: relative;
        flex: 1 1 auto;
        min-height: 280px;
        border-radius: 20px;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 52%, rgba(255,255,255,0.04), transparent 30%),
          linear-gradient(180deg, rgba(18,22,34,0.88), rgba(6,10,18,0.95));
        border: 1px solid rgba(255,255,255,0.08);
      }

      #arena .tc-cage-canvas {
        width: 100%;
        height: 100%;
        display: block;
        touch-action: none;
      }

      #arena .tc-cage-toast {
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

      #arena .tc-cage-toast.on { opacity: 1; }

      #arena .tc-cage-rule {
        margin-top: 8px;
        text-align: center;
        font: 800 11px system-ui, Arial;
        color: rgba(255,255,255,0.65);
      }

      @media (max-width: 520px) {
        #arena .tc-cage-neon { font-size: 18px; }
        #arena .tc-cage-row {
          grid-template-columns: 1fr 54px 1fr;
          gap: 8px;
        }
        #arena .tc-cage-card {
          min-height: 82px;
          padding: 9px 10px;
        }
        #arena .tc-cage-vs { font-size: 13px; }
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
    _pointerDown: null,
    _dragStart: null,
    _dragFromTile: null,
    _dragConsumed: false,
    _releaseGuard: false,
    _unbind: null,
    _effects: [],
    _flashAlpha: 0,
    _flashColor: "#ffd166",
    _animFrame: null,
    _turnTicker: null,
    _audioCtx: null,
    _shakeUntil: 0,
    _matchCtx: null,
    _onlineChannel: null,
    _onlineReady: false,
    _resultRecorded: false,
    _remoteSwipe: null,
    _remoteSwipeUntil: 0,
    _remoteSwapAnim: null,


    _ensureAudio() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!this._audioCtx) {
        try {
          this._audioCtx = new AC();
        } catch (_) {
          return null;
        }
      }
      if (this._audioCtx?.state === "suspended") {
        this._audioCtx.resume().catch(() => {});
      }
      return this._audioCtx;
    },

    _playExplosionSound(power = 1) {
      const ac = this._ensureAudio();
      if (!ac) return;
      const now = ac.currentTime;
      const dur = 0.12 + Math.min(0.22, power * 0.025);

      try {
        const buffer = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const t = i / data.length;
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
        }

        const noise = ac.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = ac.createBiquadFilter();
        noiseFilter.type = "lowpass";
        noiseFilter.frequency.setValueAtTime(1800 + power * 120, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(220, now + dur);

        const noiseGain = ac.createGain();
        noiseGain.gain.setValueAtTime(0.0001, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.18 + Math.min(0.18, power * 0.02), now + 0.01);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        const osc = ac.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(130 + power * 6, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + dur);

        const oscGain = ac.createGain();
        oscGain.gain.setValueAtTime(0.0001, now);
        oscGain.gain.exponentialRampToValueAtTime(0.08 + Math.min(0.1, power * 0.012), now + 0.01);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ac.destination);

        osc.connect(oscGain);
        oscGain.connect(ac.destination);

        noise.start(now);
        noise.stop(now + dur);
        osc.start(now);
        osc.stop(now + dur);
      } catch (_) {}
    },

    _beginTurn(turn) {
      if (!this._state) return;
      this._state.turn = turn;
      this._state.turnDeadlineAt = Date.now() + TURN_TIME_MS;
      if (turn === "me") this._state.meActionLeft = ACTIONS_PER_TURN;
      else this._state.enemyActionLeft = ACTIONS_PER_TURN;
      this._updateHud();
      this._render();
    },

    _forceTurnTimeout(turn) {
      if (!this._state || this._state.finished || this._state.turn !== turn) return;
      const isOnline = this._isRealtimeMatch();
      if (turn === "me") {
        this._state.meActionLeft = 0;
        this._state.info = "Süre doldu • sıra rakipte";
        this._toast("Süre doldu");
        this._beginTurn("enemy");
        this._locked = true;
        if (this._running && !this._checkFinish()) {
          if (isOnline) {
            this._broadcastOnline("state_sync", {
              state: this._toNetworkState(),
              toast: "Rakibin süresi doldu",
            }).catch?.(() => {});
          } else {
            clearTimeout(this._turnTimer);
            this._turnTimer = setTimeout(() => this._enemyPlay(), randInt(450, 900));
          }
        }
      } else {
        if (isOnline) return;
        this._state.enemyActionLeft = 0;
        this._state.info = "Rakibin süresi doldu";
        this._toast("Rakibin süresi doldu");
        this._beginTurn("me");
        this._locked = false;
      }
    },

    _startTurnTicker() {
      clearInterval(this._turnTicker);
      this._turnTicker = setInterval(() => {
        if (!this._state || this._state.finished || this._state.matchmaking) return;
        const left = Number(this._state.turnDeadlineAt || 0) - Date.now();
        if (left <= 0) {
          this._forceTurnTimeout(this._state.turn);
          return;
        }
        this._updateHud();
      }, 200);
    },

    async init(opts = {}) {
      injectStyle();
      loadIcons().then(() => this._render());

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
        stage: arena.querySelector("#tcCrushStage"),
        close: arena.querySelector("#tcCrushClose"),
        sub: arena.querySelector("#tcCrushSub"),
        meMoves: arena.querySelector("#tcCrushMeMoves"),
        enemyMoves: arena.querySelector("#tcCrushEnemyMoves"),
        turn: arena.querySelector("#tcCrushTurn"),
        toast: arena.querySelector("#tcCrushToast"),
        rootEnemyFill: arena.querySelector("#tcCrushEnemyFill"),
        rootMeFill: arena.querySelector("#tcCrushMeFill"),
        rootEnemyText: arena.querySelector("#tcCrushEnemyText"),
        rootMeText: arena.querySelector("#tcCrushMeText"),
        enemyName: arena.querySelector("#tcCrushEnemyName"),
        meName: arena.querySelector("#tcCrushMeName"),
      };

      this._bindCanvas();
      this._safeResizeSequence();
      this.reset();

      this._inited = true;
      this._setStatus("IQ ARENA hazır");
      this._startFxLoop();
      this._startTurnTicker();
    },

    setMatchContext(ctx) {
      this._matchCtx = ctx && ctx.matchId ? { ...ctx } : null;
    },

    _getSupabase() {
      return window.supabase || window.tcSupabase || null;
    },

    _isRealtimeMatch() {
      return !!(this._matchCtx && this._matchCtx.matchId && !this._matchCtx.isBotMatch);
    },

    _toNetworkState() {
      if (!this._state) return null;
      const amIPlayer1 = !!this._matchCtx?.amIPlayer1;
      return {
        board: cloneBoard(this._state.board),
        player1Hp: amIPlayer1 ? this._state.meHp : this._state.enemyHp,
        player2Hp: amIPlayer1 ? this._state.enemyHp : this._state.meHp,
        player1Moves: amIPlayer1 ? this._state.meMoves : this._state.enemyMoves,
        player2Moves: amIPlayer1 ? this._state.enemyMoves : this._state.meMoves,
        player1ActionLeft: amIPlayer1 ? this._state.meActionLeft : this._state.enemyActionLeft,
        player2ActionLeft: amIPlayer1 ? this._state.enemyActionLeft : this._state.meActionLeft,
        activePlayer: this._state.turn === "me"
          ? (amIPlayer1 ? "player1" : "player2")
          : (amIPlayer1 ? "player2" : "player1"),
        info: this._state.info || "",
        finished: !!this._state.finished,
      };
    },

    _startRemoteSwapAnimation(netState, meta = {}) {
      if (!this._state || !meta?.move?.from || !meta?.move?.to) return false;
      const from = { r: Number(meta.move.from.r), c: Number(meta.move.from.c) };
      const to = { r: Number(meta.move.to.r), c: Number(meta.move.to.c) };
      if (![from.r, from.c, to.r, to.c].every(Number.isFinite)) return false;
      if (!this._state.board?.[from.r]?.[from.c] || !this._state.board?.[to.r]?.[to.c]) return false;

      this._remoteSwapAnim = {
        from,
        to,
        startAt: performance.now(),
        duration: 150,
        board: cloneBoard(this._state.board),
        nextState: netState,
        nextMeta: { ...meta, fromRemote: false, move: null },
      };
      this._render();
      return true;
    },

    _tickRemoteSwapAnimation(now = performance.now()) {
      const anim = this._remoteSwapAnim;
      if (!anim) return false;
      const t = clamp((now - anim.startAt) / anim.duration, 0, 1);
      if (t < 1) return true;
      const nextState = anim.nextState;
      const nextMeta = anim.nextMeta || {};
      this._remoteSwapAnim = null;
      this._applyNetworkState(nextState, nextMeta);
      return false;
    },

    _applyNetworkState(netState, meta = {}) {
      if (!this._state || !netState) return;
      if (meta.fromRemote && meta.move?.from && meta.move?.to && !this._remoteSwapAnim) {
        if (this._startRemoteSwapAnimation(netState, meta)) return;
      }
      const amIPlayer1 = !!this._matchCtx?.amIPlayer1;
      const nextBoard = cloneBoard(netState.board || this._state.board);

      this._state.board = nextBoard;
      this._state.meHp = amIPlayer1 ? Number(netState.player1Hp) : Number(netState.player2Hp);
      this._state.enemyHp = amIPlayer1 ? Number(netState.player2Hp) : Number(netState.player1Hp);
      this._state.meMoves = amIPlayer1 ? Number(netState.player1Moves) : Number(netState.player2Moves);
      this._state.enemyMoves = amIPlayer1 ? Number(netState.player2Moves) : Number(netState.player1Moves);
      this._state.meActionLeft = amIPlayer1 ? Number(netState.player1ActionLeft) : Number(netState.player2ActionLeft);
      this._state.enemyActionLeft = amIPlayer1 ? Number(netState.player2ActionLeft) : Number(netState.player1ActionLeft);
      this._state.turn = (
        (netState.activePlayer === "player1" && amIPlayer1) ||
        (netState.activePlayer === "player2" && !amIPlayer1)
      ) ? "me" : "enemy";
      this._state.info = netState.info || this._state.info || "";
      this._state.finished = !!netState.finished;
      this._state.matchmaking = false;
      this._state.turnDeadlineAt = Date.now() + TURN_TIME_MS;

      this._locked = this._state.finished ? true : this._state.turn !== "me";

      if (this._state.finished) {
        const win = this._state.enemyHp <= 0 ||
          (this._state.meMoves <= 0 && this._state.enemyMoves <= 0 && this._state.meHp >= this._state.enemyHp);
        this._finishGame(win, this._state.info || (win ? "Kazandın" : "Kaybettin"));
        return;
      }

      if (meta.toast) this._toast(meta.toast);
      this._updateHud();
      this._render();
    },

    async _destroyOnlineChannel() {
      const sb = this._getSupabase();
      if (this._onlineChannel && sb?.removeChannel) {
        try { await sb.removeChannel(this._onlineChannel); } catch (_) {}
      }
      this._onlineChannel = null;
      this._onlineReady = false;
    },

    async _broadcastOnline(event, payload) {
      if (!this._onlineChannel) return;
      try {
        await this._onlineChannel.send({
          type: "broadcast",
          event,
          payload: payload || {},
        });
      } catch (_) {}
    },

    async _setupOnlineRoom() {
      if (!this._isRealtimeMatch()) return false;
      const sb = this._getSupabase();
      if (!sb?.channel) return false;

      await this._destroyOnlineChannel();

      const room = `tc-pvp-room-${this._matchCtx.matchId}`;
      this._onlineChannel = sb.channel(room, { config: { broadcast: { self: false } } });

      this._onlineChannel
        .on("broadcast", { event: "request_state" }, async () => {
          if (!this._running || !this._state || !this._onlineReady) return;
          if (!this._matchCtx?.amIPlayer1) return;
          await this._broadcastOnline("init_state", {
            state: this._toNetworkState(),
          });
        })
        .on("broadcast", { event: "init_state" }, ({ payload }) => {
          if (!payload?.state) return;
          this._applyNetworkState(payload.state, { fromRemote: true });
        })
        .on("broadcast", { event: "state_sync" }, ({ payload }) => {
          if (!payload?.state) return;
          this._applyNetworkState(payload.state, {
            toast: payload.toast || "",
            fromRemote: true,
            move: payload.move || null,
          });
        })
        .on("broadcast", { event: "finish_sync" }, ({ payload }) => {
          if (!payload?.state) return;
          this._applyNetworkState(payload.state, {
            fromRemote: true,
            move: payload.move || null,
          });
        })
        .on("broadcast", { event: "leave_match" }, () => {
          if (this._state?.finished) return;
          this._finishGame(true, "Rakip çıktı • kazandın");
        });

      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        try {
          this._onlineChannel.subscribe((status) => {
            if (status === "SUBSCRIBED") finish();
          });
        } catch (_) {
          finish();
        }
        setTimeout(finish, 1500);
      });

      this._onlineReady = true;
      if (this._matchCtx?.amIPlayer1 && this._state) {
        await this._broadcastOnline("init_state", { state: this._toNetworkState() });
      } else {
        await this._broadcastOnline("request_state", { matchId: this._matchCtx?.matchId || null });
      }
      return true;
    },

    setOpponent(opp) {
      if (opp && typeof opp.username === "string") {
        this._opponent = { ...opp };
      }
      if (this._els?.enemyName) this._els.enemyName.textContent = this._opponent?.username || "Rakip";
      if (this._state) this._updateHud();
    },

    async start() {
      if (!this._inited) return;
      await this._waitUntilVisible();

      this.reset();
      this._running = true;
      this._state.matchmaking = false;
      clearTimeout(this._queueTimer);
      this._queueTimer = null;

      if (this._isRealtimeMatch()) {
        await this._setupOnlineRoom();
        const amIPlayer1 = !!this._matchCtx?.amIPlayer1;
        this._state.turn = amIPlayer1 ? "me" : "enemy";
        this._state.turnDeadlineAt = Date.now() + TURN_TIME_MS;
        this._state.info = amIPlayer1
          ? `${this._opponent?.username || "Rakip"} hazır • ilk sıra sende`
          : `${this._opponent?.username || "Rakip"} hazır • ilk sıra rakipte`;
      } else {
        this._state.turn = "me";
        this._state.turnDeadlineAt = Date.now() + TURN_TIME_MS;
        this._state.info = `${this._opponent?.username || "Rakip"} hazır`;
      }

      this._setStatus(`IQ ARENA • ${this._opponent?.username || "Rakip"} hazır`);
      this._locked = this._state.turn !== "me";
      this._updateHud();
      this._render();
    },

    async stop() {
      const isForfeit = this._isRealtimeMatch() && this._onlineReady && !this._state?.finished;
      if (isForfeit) {
        await this._broadcastOnline("leave_match", { matchId: this._matchCtx?.matchId || null });
        this._finishGame(false, "Maçtan çıktın");
        await this._destroyOnlineChannel();
        return;
      }

      this._running = false;
      this._locked = false;
      this._selected = null;
      this._pointerDown = null;
      this._dragStart = null;
      this._dragFromTile = null;
      clearTimeout(this._turnTimer);
      clearTimeout(this._queueTimer);
      clearInterval(this._turnTicker);
      this._turnTimer = null;
      this._queueTimer = null;
      if (this._state) {
        this._state.matchmaking = false;
        this._state.info = "Maç durduruldu";
      }
      this._setStatus("IQ ARENA durdu");
      this._render();
      await this._destroyOnlineChannel();
    },

    reset() {
      clearTimeout(this._turnTimer);
      clearTimeout(this._queueTimer);
      clearInterval(this._turnTicker);
      this._turnTimer = null;
      this._queueTimer = null;
      this._startTurnTicker();
      this._running = false;
      this._locked = false;
      this._selected = null;
      this._pointerDown = null;
      this._dragStart = null;
      this._dragFromTile = null;
      this._dragConsumed = false;
      this._effects = [];
      this._flashAlpha = 0;
      this._flashColor = "#ffd166";
      this._resultRecorded = false;
      this._remoteSwipe = null;
      this._remoteSwipeUntil = 0;
      this._remoteSwapAnim = null;

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
        turnDeadlineAt: Date.now() + TURN_TIME_MS,
      };

      if (this._els?.meName) {
        const playerName = String(window.tcStore?.get?.()?.player?.username || "Sen").trim() || "Sen";
        this._els.meName.textContent = playerName;
      }
      if (this._els?.enemyName) {
        this._els.enemyName.textContent = this._opponent?.username || "Rakip";
      }

      this._safeResizeSequence();
      this._updateHud();
      this._render();
    },

    _spawnBotAfterQueue() {
      if (this._isRealtimeMatch()) return;
      const name = choice(BOT_NAMES);
      this._opponent = { username: name, isBot: true };
      this._state.matchmaking = false;
      this._state.info = `${name} bulundu • Bot`;
      this._setStatus(`IQ ARENA • ${name} bulundu`);
      this._toast(`${name} maça girdi`);
      this._locked = false;
      if (this._els?.enemyName) this._els.enemyName.textContent = name;
      this._updateHud();
      this._render();
    },

    async backToMenu() {
      await this.stop();

      const wrap = document.getElementById("pvpWrap");
      const arena = document.getElementById("arena");
      const status = document.getElementById("pvpStatus");
      const opponent = document.getElementById("pvpOpponent");
      const spinner = document.getElementById("pvpSpinner");

      if (arena) arena.innerHTML = "";
      if (wrap) {
        wrap.classList.remove("open");
        wrap.style.display = "none";
      }
      if (status) status.textContent = "PvP • Hazır";
      if (opponent) opponent.textContent = "—";
      if (spinner) spinner.classList.add("hidden");
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

      const onPageHide = () => {
        if (!this._isRealtimeMatch() || !this._onlineReady || !this._running || this._state?.finished) return;
        this._broadcastOnline("leave_match", { matchId: this._matchCtx?.matchId || null }).catch?.(() => {});
        this._finishGame(false, "Maçtan çıktın");
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
      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("beforeunload", onPageHide);

      if (this._els?.close) {
        this._els.close.onclick = () => this.backToMenu();
      }

      if (window.ResizeObserver && this._els?.stage) {
        this._resizeObserver?.disconnect?.();
        this._resizeObserver = new ResizeObserver(() => {
          this._safeResizeSequence();
          this._render();
        });
        this._resizeObserver.observe(this._els.stage);
      }

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
        window.removeEventListener("pagehide", onPageHide);
        window.removeEventListener("beforeunload", onPageHide);
        if (this._els?.close) this._els.close.onclick = null;
      };
    },

    _destroyCanvasEvents() {
      if (this._unbind) {
        this._unbind();
        this._unbind = null;
      }
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
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
      this._els.status.textContent = text ? `PvP • ${text}` : "PvP • IQ ARENA";
    },

    _toast(text) {
      const el = this._els?.toast;
      if (!el) return;
      el.textContent = String(text || "");
      el.classList.add("on");
      clearTimeout(el._offTimer);
      el._offTimer = setTimeout(() => el.classList.remove("on"), 1100);
    },

    _spawnMatchEffects(bursts) {
      if (!Array.isArray(bursts) || !bursts.length) return;

      for (const burst of bursts) {
        const rect = this._tileRects.find((t) => t.r === burst.cell?.r && t.c === burst.cell?.c);
        if (!rect) continue;

        const meta = TILE_META[this._state?.board?.[burst.cell.r]?.[burst.cell.c]?.type] || null;
        const color = burst.color || meta?.color || "#ffd166";
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        const count = burst.kind === "extra" ? 18 + burst.len * 2 : 10 + burst.len * 2;

        this._flashAlpha = 0.24 + Math.min(0.28, burst.len * 0.04);
        this._flashColor = color;
        this._shakeUntil = Date.now() + 90 + burst.len * 28;
        this._playExplosionSound(burst.len + (burst.kind === "extra" ? 2 : 0));

        this._effects.push({
          type: "label",
          x: cx,
          y: cy,
          life: 0,
          duration: burst.kind === "extra" ? 860 : 620,
          text: burst.label,
          color,
          big: burst.kind === "extra",
        });

        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
          const speed = burst.kind === "extra" ? 1.8 + Math.random() * 2.1 : 1.3 + Math.random() * 1.7;
          this._effects.push({
            type: "particle",
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.3,
            radius: burst.kind === "extra" ? 2.2 + Math.random() * 2.5 : 1.5 + Math.random() * 1.8,
            life: 0,
            duration: 520 + Math.random() * 260,
            color,
          });
        }

        for (let i = 0; i < 6 + burst.len; i++) {
          this._effects.push({
            type: "spark",
            x: cx + (-rect.w * 0.18 + Math.random() * rect.w * 0.36),
            y: cy + (-rect.h * 0.18 + Math.random() * rect.h * 0.36),
            vx: -0.8 + Math.random() * 1.6,
            vy: -1.8 - Math.random() * 1.4,
            size: 3 + Math.random() * 4,
            life: 0,
            duration: 280 + Math.random() * 180,
            color,
          });
        }

        if (burst.kind === "extra") {
          for (let i = 0; i < 2 + getExtraMoveCount(burst.len); i++) {
            this._effects.push({
              type: "ring",
              x: cx,
              y: cy,
              r: rect.w * (0.16 + i * 0.03),
              maxR: rect.w * (0.65 + i * 0.16),
              life: 0,
              duration: 520 + i * 110,
              color,
            });
          }
        }
      }
    },

    _startFxLoop() {
      if (this._animFrame) cancelAnimationFrame(this._animFrame);

      const loop = () => {
        let dirty = false;
        const now = performance.now();

        if (this._effects.length) {
          dirty = true;
          this._effects = this._effects.filter((fx) => {
            if (!fx._last) fx._last = now;
            const dt = Math.max(8, now - fx._last);
            fx._last = now;
            fx.life += dt;

            if (fx.type === "particle") {
              fx.x += fx.vx * (dt / 16.6667);
              fx.y += fx.vy * (dt / 16.6667);
              fx.vy += 0.04 * (dt / 16.6667);
            } else if (fx.type === "spark") {
              fx.x += fx.vx * (dt / 16.6667);
              fx.y += fx.vy * (dt / 16.6667);
              fx.vy += 0.07 * (dt / 16.6667);
            } else if (fx.type === "label") {
              fx.y -= 0.34 * (dt / 16.6667);
            } else if (fx.type === "ring") {
              const t = clamp(fx.life / fx.duration, 0, 1);
              fx.r = fx.r + (fx.maxR - fx.r) * Math.min(1, 0.15 + t * 0.2);
            }

            return fx.life < fx.duration;
          });
        }

        if (this._flashAlpha > 0.001) {
          dirty = true;
          this._flashAlpha *= 0.86;
        } else {
          this._flashAlpha = 0;
        }

        if (this._remoteSwapAnim) {
          dirty = true;
          this._tickRemoteSwapAnimation(now);
        }

        if (dirty) this._render();
        this._animFrame = requestAnimationFrame(loop);
      };

      this._animFrame = requestAnimationFrame(loop);
    },

    _updateHud() {
      if (!this._els || !this._state) return;
      const s = this._state;
      const meScale = clamp(s.meHp, 0, START_HP) / START_HP;
      const enemyScale = clamp(s.enemyHp, 0, START_HP) / START_HP;

      this._els.meFill.style.transform = `scaleX(${meScale})`;
      this._els.enemyFill.style.transform = `scaleX(${enemyScale})`;
      this._els.meHpText.textContent = Math.round(s.meHp);
      this._els.enemyHpText.textContent = Math.round(s.enemyHp);

      if (this._els.rootMeFill) this._els.rootMeFill.style.transform = `scaleX(${meScale})`;
      if (this._els.rootEnemyFill) this._els.rootEnemyFill.style.transform = `scaleX(${enemyScale})`;
      if (this._els.rootMeText) this._els.rootMeText.textContent = `${Math.round(s.meHp)} / ${START_HP}`;
      if (this._els.rootEnemyText) this._els.rootEnemyText.textContent = `${Math.round(s.enemyHp)} / ${START_HP}`;

      const timeLeft = fmtTurnTime(Math.max(0, Number(s.turnDeadlineAt || 0) - Date.now()));
      if (this._els.meMoves) this._els.meMoves.textContent = `Hamle: ${s.meMoves} • Raund: ${s.meActionLeft}/2 • Süre: ${s.turn === "me" && !s.matchmaking && !s.finished ? timeLeft : "--:--"}`;
      if (this._els.enemyMoves) this._els.enemyMoves.textContent = `Hamle: ${s.enemyMoves} • Raund: ${s.enemyActionLeft}/2 • Süre: ${s.turn === "enemy" && !s.matchmaking && !s.finished ? timeLeft : "--:--"}`;

      if (this._els.turn) {
        if (s.matchmaking) {
          this._els.turn.textContent = "...";
        } else if (s.finished) {
          this._els.turn.textContent = "Bitti";
        } else {
          this._els.turn.textContent = s.turn === "me" ? "SEN" : "VS";
        }
      }

      if (this._els.sub) {
        this._els.sub.textContent = s.matchmaking
          ? "5sn içinde rakip bulunmazsa bot gelir"
          : `${s.info || "Grid Heist"} • Sıra: ${s.turn === "me" ? "Sen" : this._opponent.username} • Süre: ${timeLeft}${this._isRealtimeMatch() ? " • ONLINE" : ""}`;
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
      if (this._checkFinish()) {
        if (this._isRealtimeMatch()) {
          await this._broadcastOnline("finish_sync", {
          state: this._toNetworkState(),
          move: { from: a, to: b },
        });
        }
        return;
      }

      if (this._isRealtimeMatch()) {
        await this._broadcastOnline("state_sync", {
          state: this._toNetworkState(),
          move: { from: a, to: b },
          toast: "Rakip oynadı",
        });
        this._locked = this._state.turn !== "me";
        return;
      }

      if (this._state.turn === "enemy") {
        const delay = randInt(700, 1250);
        this._turnTimer = setTimeout(() => this._enemyPlay(), delay);
      } else {
        this._locked = false;
      }
    },

    async _enemyPlay() {
      if (this._isRealtimeMatch()) return;
      if (!this._running || !this._state || this._state.turn !== "enemy" || this._state.matchmaking) return;
      this._locked = true;

      const thinking = randInt(850, 1900);
      this._state.info = "Düşünme süresi başladı";
      this._updateHud();
      this._render();
      await this._sleep(thinking);

      const move = calcBotMove(this._state.board, this._state.enemyHp);
      if (!move) {
        this._beginTurn("me");
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

      while (true) {
        const res = evaluateBoard(board);
        if (!res.hasAction) break;

        chain += 1;
        totalDamage += res.damage;
        totalHeal += res.heal;
        totalExtra += res.extraMoves;

        this._render();
        this._spawnMatchEffects(res.fxBursts);

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

      if (actor === "me") {
        this._state.meMoves = Math.max(0, this._state.meMoves - 1);
        this._state.meHp = clamp(this._state.meHp + totalHeal, 0, START_HP);
        this._state.enemyHp = clamp(this._state.enemyHp - totalDamage, 0, START_HP);
        this._state.meActionLeft = clamp(this._state.meActionLeft - 1 + totalExtra, 0, ACTIONS_PER_TURN);

        if (totalExtra > 0) {
          this._toast(
            totalHeal > 0
              ? `Vuruş ${totalDamage} • Can +${totalHeal} • Extra Move +${totalExtra}`
              : `Vuruş ${totalDamage} • Extra Move +${totalExtra}`
          );
        } else {
          this._toast(totalHeal > 0 ? `Vuruş ${totalDamage} • Can +${totalHeal}` : `Vuruş ${totalDamage}`);
        }

        if (this._state.meMoves <= 0 || this._state.meActionLeft <= 0) {
          this._beginTurn("enemy");
        } else {
          this._state.turnDeadlineAt = Date.now() + TURN_TIME_MS;
          this._state.turn = "me";
        }
      } else {
        this._state.enemyMoves = Math.max(0, this._state.enemyMoves - 1);
        this._state.enemyHp = clamp(this._state.enemyHp + totalHeal, 0, START_HP);
        this._state.meHp = clamp(this._state.meHp - totalDamage, 0, START_HP);
        this._state.enemyActionLeft = clamp(this._state.enemyActionLeft - 1 + totalExtra, 0, ACTIONS_PER_TURN);

        if (totalExtra > 0) {
          this._toast(
            totalHeal > 0
              ? `Rakip ${totalDamage} vurdu • Can +${totalHeal} • Extra Move +${totalExtra}`
              : `Rakip ${totalDamage} vurdu • Extra Move +${totalExtra}`
          );
        } else {
          this._toast(totalHeal > 0 ? `Rakip ${totalDamage} vurdu • Can +${totalHeal}` : `Rakip ${totalDamage} vurdu`);
        }

        if (this._state.enemyMoves <= 0 || this._state.enemyActionLeft <= 0) {
          this._beginTurn("me");
        } else {
          this._state.turnDeadlineAt = Date.now() + TURN_TIME_MS;
          this._state.turn = "enemy";
        }
      }

      this._state.info = totalExtra > 0 ? `${Math.max(1, chain)} chain • Extra +${totalExtra}` : `${Math.max(1, chain)} chain`;
      this._updateHud();
      this._render();
    },

    _recordResult(win) {
      if (this._resultRecorded) return;
      this._resultRecorded = true;
      const store = window.tcStore;
      const now = Date.now();
      const REWARD_COINS = 36;
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
        const nextCoins = Number(state.coins || 0) + (win && !pvp.payoutDone ? REWARD_COINS : 0);
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

        store.set({
          coins: nextCoins,
          pvp: {
            ...pvp,
            payoutDone: true,
          },
        });
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

    _renderEffects(ctx) {
      for (const fx of this._effects) {
        const t = clamp(fx.life / fx.duration, 0, 1);
        const alpha = 1 - t;

        if (fx.type === "particle") {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = fx.color;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.radius * (0.8 + (1 - t) * 0.35), 0, Math.PI * 2);
          ctx.fill();
        } else if (fx.type === "spark") {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = fx.color;
          fillRoundRect(ctx, fx.x - fx.size * 0.5, fx.y - fx.size * 0.5, fx.size, fx.size, 2, fx.color);
        } else if (fx.type === "label") {
          ctx.globalAlpha = alpha;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = fx.big ? "900 18px system-ui, Arial" : "900 14px system-ui, Arial";
          ctx.lineWidth = fx.big ? 5 : 4;
          ctx.strokeStyle = "rgba(0,0,0,0.55)";
          ctx.strokeText(fx.text, fx.x, fx.y);
          ctx.fillStyle = fx.color;
          ctx.fillText(fx.text, fx.x, fx.y);
        } else if (fx.type === "ring") {
          ctx.globalAlpha = alpha * 0.7;
          ctx.strokeStyle = fx.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fx.x, fx.y, fx.r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },
    _renderRemoteSwap(ctx) {
      const anim = this._remoteSwapAnim;
      if (!anim?.from || !anim?.to || !anim?.board) return;
      const fromRect = this._tileRects.find((t) => t.r === anim.from.r && t.c === anim.from.c);
      const toRect = this._tileRects.find((t) => t.r === anim.to.r && t.c === anim.to.c);
      if (!fromRect || !toRect) return;
      const fromTile = anim.board?.[anim.from.r]?.[anim.from.c];
      const toTile = anim.board?.[anim.to.r]?.[anim.to.c];
      if (!fromTile || !toTile) return;

      const t = clamp((performance.now() - anim.startAt) / anim.duration, 0, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const mix = (a, b) => a + (b - a) * ease;
      const pad = 2;
      const drawMoving = (tile, src, dst) => {
        const x = mix(src.x, dst.x);
        const y = mix(src.y, dst.y);
        const radius = Math.max(10, Math.floor(src.w * 0.18));
        fillRoundRect(ctx, x + pad, y + pad, src.w - 4, src.h - 4, radius, "rgba(255,255,255,0.08)");
        const meta = TILE_META[tile.type] || TILE_META[TILE.PUNCH];
        const glowR = src.w * 0.4;
        const glow = ctx.createRadialGradient(x + src.w / 2, y + src.h / 2, 2, x + src.w / 2, y + src.h / 2, glowR);
        glow.addColorStop(0, meta.color + "66");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x + src.w / 2, y + src.h / 2, glowR, 0, Math.PI * 2);
        ctx.fill();
        drawTileIcon(ctx, tile.type, x + pad, y + pad, src.w - 4, false, Date.now());
      };

      ctx.save();
      ctx.globalAlpha = 0.98;
      drawMoving(fromTile, fromRect, toRect);
      drawMoving(toTile, toRect, fromRect);
      ctx.restore();
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
      ctx.save();
      if (Date.now() < this._shakeUntil) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }

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
      shell.addColorStop(0, "rgba(20,10,38,0.72)");
      shell.addColorStop(0.5, "rgba(8,14,28,0.68)");
      shell.addColorStop(1, "rgba(2,6,16,0.82)");
      fillRoundRect(ctx, ox - 14, oy - 14, actual + 28, actual + 28, 22, shell);
      strokeRoundRect(ctx, ox - 14, oy - 14, actual + 28, actual + 28, 22, "rgba(255,178,74,0.18)", 1.5);

      const inner = ctx.createLinearGradient(0, oy, 0, oy + actual);
      inner.addColorStop(0, "rgba(22,16,42,0.90)");
      inner.addColorStop(1, "rgba(10,14,28,0.95)");
      fillRoundRect(ctx, ox - 4, oy - 4, actual + 8, actual + 8, 18, inner);

      // Izgara çizgileri (hafif)
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let gi = 0; gi <= GRID; gi++) {
        ctx.beginPath();
        ctx.moveTo(ox + gi * cell, oy);
        ctx.lineTo(ox + gi * cell, oy + actual);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox, oy + gi * cell);
        ctx.lineTo(ox + actual, oy + gi * cell);
        ctx.stroke();
      }

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const x = ox + c * cell;
          const y = oy + r * cell;
          const tile = this._state.board[r][c];
          const selected = this._selected && this._selected.r === r && this._selected.c === c;
          const radius = Math.max(10, Math.floor(cell * 0.18));
          const hiddenByRemoteAnim = !!(
            this._remoteSwapAnim && (
              (this._remoteSwapAnim.from.r === r && this._remoteSwapAnim.from.c === c) ||
              (this._remoteSwapAnim.to.r === r && this._remoteSwapAnim.to.c === c)
            )
          );

          // Zemin (tile rengi drawTileIcon içinde yönetiliyor artık)
          fillRoundRect(
            ctx, x + 2, y + 2, cell - 4, cell - 4, radius,
            selected ? "rgba(255,181,74,0.18)" : "rgba(255,255,255,0.05)"
          );

          if (tile && !hiddenByRemoteAnim) {
            const meta = TILE_META[tile.type] || TILE_META[TILE.PUNCH];

            // Güçlü glow
            const glowR = selected ? cell * 0.52 : cell * 0.38;
            const glow = ctx.createRadialGradient(x + cell / 2, y + cell / 2, 2, x + cell / 2, y + cell / 2, glowR);
            glow.addColorStop(0, meta.color + (selected ? "88" : "44"));
            glow.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(x + cell / 2, y + cell / 2, glowR, 0, Math.PI * 2);
            ctx.fill();

            drawTileIcon(ctx, tile.type, x + 2, y + 2, cell - 4, selected, Date.now());
          } else {
            strokeRoundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, radius, "rgba(255,255,255,0.06)", 1);
          }

          this._tileRects.push({ r, c, x, y, w: cell, h: cell });
        }
      }

      if (this._flashAlpha > 0) {
        ctx.globalAlpha = this._flashAlpha;
        ctx.fillStyle = this._flashColor;
        fillRoundRect(ctx, ox - 8, oy - 8, actual + 16, actual + 16, 18, this._flashColor);
        ctx.globalAlpha = 1;
      }

      this._renderRemoteSwap(ctx);
      this._renderEffects(ctx);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.restore();
      this._updateHud();
    },
  };

  window.TonCrimePVP_CRUSH = api;
})();
