(function () {
  const GRID = 7;
  const START_HP = 1000;
  const START_MOVES = 12;
  const ACTIONS_PER_TURN = 2;
  const TURN_TIME_MS = 30000;
  const TURN_BANNER_MS = 1300;
  const DRAG_THRESHOLD = 16;

  const TILE = {
    PUNCH: "punch",
    KICK: "kick",
    SLAP: "slap",
    HEAD: "head",
    WEED: "weed",
  };

  const SPECIAL = {
    BULLET: "bullet",
    ROCKET: "rocket",
    BOMB: "bomb",
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

  const SPECIAL_META = {
    [SPECIAL.BULLET]: { label: { tr: "KURSUN", en: "BULLET" }, color: "#f9d66d", badge: "K" },
    [SPECIAL.ROCKET]: { label: { tr: "ROKET", en: "ROCKET" }, color: "#ff8a5b", badge: "R" },
    [SPECIAL.BOMB]: { label: { tr: "BOMBA", en: "BOMB" }, color: "#7cc6ff", badge: "B" },
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

  const PVP_CRUSH_TEXT = {
    tr: {
      back: "Geri",
      searching: "Rakip araniyor...",
      opponent: "Rakip",
      you: "Sen",
      youUpper: "SEN",
      moves: "Hamle",
      round: "Raund",
      time: "Sure",
      finished: "Bitti",
      pvpReady: "Hazir",
      searchingHint: "5sn icinde rakip bulunmazsa bot gelir",
      rule: "Surukleyerek veya dokunarak tas degistir • Raund basi 40sn • Extra move en fazla 2 hakta kalir",
      arenaReady: "IQ ARENA hazir",
      timeUpTurnEnemy: "Sure doldu • sira rakipte",
      timeUp: "Sure doldu",
      opponentTimedOut: "Rakibin suresi doldu",
      turnBanner: "SIRA SENDE",
      timeoutLose: "Hamle gelmedi â€¢ raund kaybi",
      timeoutWin: "Rakip oynamadi â€¢ kazandin",
      specialBullet: "KURSUN",
      specialRocket: "ROKET",
      specialBomb: "BOMBA",
      invalidMove: "Gecersiz hamle",
      opponentPlayed: "Rakip oynadi",
      thinkingStarted: "Dusunme suresi basladi",
      opponentNoMove: "Rakip hamle bulamadi",
      opponentPlaying: "Rakip oynuyor",
      comboStatus: "{actor} • Combo x{chain}",
      chainStatus: "{chain} chain",
      chainStatusExtra: "{chain} chain • Extra +{extra}",
      hit: "Vurus {damage}",
      hitHeal: "Vurus {damage} • Can +{heal}",
      hitExtra: "Vurus {damage} • Extra Move +{extra}",
      hitHealExtra: "Vurus {damage} • Can +{heal} • Extra Move +{extra}",
      opponentHit: "Rakip {damage} vurdu",
      opponentHitHeal: "Rakip {damage} vurdu • Can +{heal}",
      opponentHitExtra: "Rakip {damage} vurdu • Extra Move +{extra}",
      opponentHitHealExtra: "Rakip {damage} vurdu • Can +{heal} • Extra Move +{extra}",
      subline: "{info} • Sira: {turn} • Sure: {time}{online}",
      online: " • ONLINE",
      opponentReadyFirstYou: "{name} hazir • ilk sira sende",
      opponentReadyFirstEnemy: "{name} hazir • ilk sira rakipte",
      opponentReady: "{name} hazir",
      statusOpponentReady: "IQ ARENA • {name} hazir",
      arenaStopped: "IQ ARENA durdu",
      matchStopped: "Mac durduruldu",
      matchReady: "Mac hazir",
      botFound: "{name} bulundu • Bot",
      statusFound: "IQ ARENA • {name} bulundu",
      botJoined: "{name} maca girdi",
      matchLeft: "Mactan ciktin",
      opponentLeftWon: "Rakip cikti • kazandin",
      won: "Kazandin",
      lost: "Kaybettin",
      wonTitle: "KAZANDIN",
      lostTitle: "KAYBETTIN",
      rewardWon: "Kazandin • +{reward} YTON",
      opponentDown: "Rakip dustu",
      youDown: "Sen dustun",
      hpLead: "HP ustunlugu",
      hpLeadOpponent: "HP ustunlugu rakipte",
      matchCount: "{len}LU",
    },
    en: {
      back: "Back",
      searching: "Searching for opponent...",
      opponent: "Opponent",
      you: "You",
      youUpper: "YOU",
      moves: "Moves",
      round: "Round",
      time: "Time",
      finished: "Finished",
      pvpReady: "Ready",
      searchingHint: "If no opponent is found in 5s, a bot joins",
      rule: "Swap tiles by dragging or tapping • 40s per round • Extra moves can stack up to 2 actions",
      arenaReady: "IQ ARENA ready",
      timeUpTurnEnemy: "Time up • opponent turn",
      timeUp: "Time up",
      opponentTimedOut: "Opponent timed out",
      turnBanner: "YOUR TURN",
      timeoutLose: "No move made â€¢ round lost",
      timeoutWin: "Opponent did not play â€¢ you won",
      specialBullet: "BULLET",
      specialRocket: "ROCKET",
      specialBomb: "BOMB",
      invalidMove: "Invalid move",
      opponentPlayed: "Opponent played",
      thinkingStarted: "Thinking time started",
      opponentNoMove: "Opponent found no move",
      opponentPlaying: "Opponent is playing",
      comboStatus: "{actor} • Combo x{chain}",
      chainStatus: "{chain} chain",
      chainStatusExtra: "{chain} chain • Extra +{extra}",
      hit: "Hit {damage}",
      hitHeal: "Hit {damage} • Heal +{heal}",
      hitExtra: "Hit {damage} • Extra Move +{extra}",
      hitHealExtra: "Hit {damage} • Heal +{heal} • Extra Move +{extra}",
      opponentHit: "Opponent hit {damage}",
      opponentHitHeal: "Opponent hit {damage} • Heal +{heal}",
      opponentHitExtra: "Opponent hit {damage} • Extra Move +{extra}",
      opponentHitHealExtra: "Opponent hit {damage} • Heal +{heal} • Extra Move +{extra}",
      subline: "{info} • Turn: {turn} • Time: {time}{online}",
      online: " • ONLINE",
      opponentReadyFirstYou: "{name} is ready • you go first",
      opponentReadyFirstEnemy: "{name} is ready • opponent goes first",
      opponentReady: "{name} is ready",
      statusOpponentReady: "IQ ARENA • {name} ready",
      arenaStopped: "IQ ARENA stopped",
      matchStopped: "Match stopped",
      matchReady: "Match ready",
      botFound: "{name} found • Bot",
      statusFound: "IQ ARENA • {name} found",
      botJoined: "{name} joined the match",
      matchLeft: "You left the match",
      opponentLeftWon: "Opponent left • you won",
      won: "You won",
      lost: "You lost",
      wonTitle: "YOU WON",
      lostTitle: "YOU LOST",
      rewardWon: "You won • +{reward} YTON",
      opponentDown: "Opponent is down",
      youDown: "You are down",
      hpLead: "HP advantage",
      hpLeadOpponent: "Opponent has HP advantage",
      matchCount: "{len} MATCH",
    },
  };

  function normalizePvpCrushLang(lang) {
    return lang === "en" ? "en" : "tr";
  }

  function getPvpCrushLang() {
    return normalizePvpCrushLang(window.tcStore?.get?.()?.lang);
  }

  function pvpCrushText(key, fallback = "") {
    const code = getPvpCrushLang();
    return PVP_CRUSH_TEXT?.[code]?.[key] ?? PVP_CRUSH_TEXT?.tr?.[key] ?? fallback ?? key;
  }

  function pvpCrushFormat(key, vars = {}, fallback = "") {
    let text = pvpCrushText(key, fallback);
    Object.entries(vars || {}).forEach(([name, value]) => {
      text = text.replaceAll(`{${name}}`, String(value ?? ""));
    });
    return text;
  }

  function pvpCrushPlayerName() {
    const value = String(window.tcStore?.get?.()?.player?.username || "").trim();
    return value || pvpCrushText("you", "Sen");
  }

  function pvpCrushOpponentName(name = "") {
    const value = String(name || "").trim();
    return value || pvpCrushText("opponent", "Rakip");
  }

  function pvpCrushMatchCountLabel(len) {
    return pvpCrushFormat("matchCount", { len }, `${len}`);
  }

  function pvpCrushSpecialLabel(special) {
    const meta = SPECIAL_META[special] || null;
    if (!meta) return "";
    const code = getPvpCrushLang();
    return meta.label?.[code] || meta.label?.tr || String(special || "").toUpperCase();
  }

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

  function createTile(type, extras = null) {
    return { id: makeId(), type, special: extras?.special || null };
  }

  function getTileType(tile) {
    return String(tile?.type || "");
  }

  function getTileSpecial(tile) {
    return String(tile?.special || "");
  }

  function cellKey(r, c) {
    return `${r}:${c}`;
  }

  function parseCellKey(key) {
    const parts = String(key || "").split(":").map(Number);
    return { r: Number(parts[0] || 0), c: Number(parts[1] || 0) };
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
        const a = getTileType(prevRow[c]) || null;
        const b = getTileType(nextRow[c]) || null;
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
    return board.map((row) => row.map((c) => (c ? `${getTileType(c)[0] || "_" }${getTileSpecial(c) ? "!" : ""}` : "_")).join("")).join("|");
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
        const t = getTileType(cell);
        let end = c + 1;
        while (end < GRID && board[r][end] && getTileType(board[r][end]) === t) end += 1;
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
        const t = getTileType(cell);
        let end = r + 1;
        while (end < GRID && board[end][c] && getTileType(board[end][c]) === t) end += 1;
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

  function buildMatchGroups(matches) {
    const groups = [];
    const visited = new Set();
    const cellSets = matches.map((match) => new Set(match.cells.map((cell) => cellKey(cell.r, cell.c))));

    for (let i = 0; i < matches.length; i++) {
      if (visited.has(i)) continue;
      const queue = [i];
      visited.add(i);
      const groupedMatches = [];
      const groupedCellKeys = new Set();

      while (queue.length) {
        const idx = queue.shift();
        const match = matches[idx];
        groupedMatches.push(match);
        cellSets[idx].forEach((key) => groupedCellKeys.add(key));

        for (let j = 0; j < matches.length; j++) {
          if (visited.has(j)) continue;
          if (matches[j]?.type !== match?.type) continue;
          const shareCell = Array.from(cellSets[j]).some((key) => groupedCellKeys.has(key));
          if (!shareCell) continue;
          visited.add(j);
          queue.push(j);
        }
      }

      const uniqueCells = Array.from(groupedCellKeys).map(parseCellKey);
      const hasHorizontal = groupedMatches.some((match) => match.dir === "h");
      const hasVertical = groupedMatches.some((match) => match.dir === "v");
      const longestMatch = groupedMatches.slice().sort((a, b) => Number(b.len || 0) - Number(a.len || 0))[0] || groupedMatches[0];
      const intersectionKey = hasHorizontal && hasVertical
        ? Array.from(groupedCellKeys).find((key) => {
          let h = false;
          let v = false;
          for (const match of groupedMatches) {
            if (!cellSets[matches.indexOf(match)]?.has(key)) continue;
            if (match.dir === "h") h = true;
            if (match.dir === "v") v = true;
          }
          return h && v;
        })
        : null;
      const anchor = intersectionKey
        ? parseCellKey(intersectionKey)
        : (longestMatch?.cells?.[Math.floor((longestMatch.cells.length || 1) / 2)] || uniqueCells[0] || null);

      let special = null;
      if (hasHorizontal && hasVertical && uniqueCells.length >= 5) special = SPECIAL.BOMB;
      else if (Number(longestMatch?.len || 0) >= 5) special = SPECIAL.ROCKET;
      else if (Number(longestMatch?.len || 0) === 4) special = SPECIAL.BULLET;

      groups.push({
        type: longestMatch?.type || "",
        cells: uniqueCells,
        matches: groupedMatches,
        anchor,
        special,
      });
    }

    return groups;
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

  function buildSpecialSpawnLabel(special) {
    const label = pvpCrushSpecialLabel(special);
    if (!label) return "";
    if (getPvpCrushLang() === "en") return `${label} READY`;
    return `${label} HAZIR`;
  }

  function getExtraMoveCount(len) {
    if (len >= 6) return 3;
    if (len === 5) return 2;
    if (len === 4) return 1;
    return 0;
  }

  function getMatchFxLabel(len) {
    if (getPvpCrushLang() === "en") {
      if (len >= 6) return "ULTRA MOVE +3";
      if (len === 5) return "MEGA MOVE +2";
      if (len === 4) return "EXTRA MOVE +1";
      return "";
    }
    if (len >= 6) return "ULTRA HAMLE +3";
    if (len === 5) return "MEGA HAMLE +2";
    if (len === 4) return "EKSTRA HAMLE +1";
    return "";
  }

  function evaluateBoard(board) {
    const matches = findMatches(board);
    const remove = new Set();
    let damage = 0;
    let heal = 0;
    let extraMoves = 0;
    const fxBursts = [];
    const specialSpawns = [];

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
          label: pvpCrushMatchCountLabel(m.len),
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
        remove.add(cellKey(cell.r, cell.c));
      }
    }

    const matchGroups = buildMatchGroups(matches);
    for (const group of matchGroups) {
      if (!group?.special || !group.anchor) continue;
      const anchorKey = cellKey(group.anchor.r, group.anchor.c);
      remove.delete(anchorKey);
      specialSpawns.push({
        r: group.anchor.r,
        c: group.anchor.c,
        type: group.type,
        special: group.special,
      });
      fxBursts.push({
        kind: "special_create",
        label: buildSpecialSpawnLabel(group.special),
        color: SPECIAL_META[group.special]?.color || "#ffd166",
        len: Math.max(4, Number(group.cells?.length || 4)),
        cell: { r: group.anchor.r, c: group.anchor.c },
      });
    }

    return {
      hasAction: matches.length > 0,
      matches,
      remove,
      damage,
      heal,
      extraMoves,
      fxBursts,
      specialSpawns,
    };
  }

  function applyResolution(board, resolution) {
    const next = cloneBoard(board);
    for (const key of resolution.remove) {
      const [r, c] = key.split(":").map(Number);
      next[r][c] = null;
    }
    for (const spawn of resolution.specialSpawns || []) {
      if (!inBounds(spawn.r, spawn.c)) continue;
      next[spawn.r][spawn.c] = createTile(spawn.type, { special: spawn.special });
    }
    return collapseBoard(next);
  }

  function buildDropSpecs(prevBoard, nextBoard) {
    const prevIds = new Set();
    const out = [];
    let seq = 0;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const tile = prevBoard?.[r]?.[c];
        if (tile?.id) prevIds.add(tile.id);
      }
    }
    for (let c = 0; c < GRID; c++) {
      for (let r = 0; r < GRID; r++) {
        const tile = nextBoard?.[r]?.[c];
        if (!tile?.id || prevIds.has(tile.id)) continue;
        out.push({
          id: tile.id,
          type: tile.type,
          special: tile.special || null,
          r,
          c,
          delay: seq * 45 + randInt(0, 35),
          duration: 340 + randInt(0, 90),
          startOffset: 1 + (seq % 3) * 0.55 + Math.random() * 0.9,
        });
        seq += 1;
      }
    }
    return out;
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

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function collectBoardCells(board) {
    const out = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (board?.[r]?.[c]) out.push({ r, c });
      }
    }
    return out;
  }

  function buildSpecialTargets(board, cell, special) {
    if (!inBounds(cell?.r, cell?.c)) return [];

    if (special === SPECIAL.BULLET) {
      return Array.from({ length: GRID }, (_, c) => ({ r: cell.r, c }));
    }

    if (special === SPECIAL.BOMB) {
      const out = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = cell.r + dr;
          const cc = cell.c + dc;
          if (inBounds(rr, cc)) out.push({ r: rr, c: cc });
        }
      }
      return out;
    }

    if (special === SPECIAL.ROCKET) {
      const pool = collectBoardCells(board)
        .filter((pos) => !(pos.r === cell.r && pos.c === cell.c));
      shuffleInPlace(pool);
      return [cell, ...pool.slice(0, 5)];
    }

    return [cell];
  }

  function summarizeDestroyedTiles(board, targets) {
    let damage = 0;
    let heal = 0;

    for (const cell of targets) {
      const tile = board?.[cell.r]?.[cell.c];
      const type = getTileType(tile);
      if (type === TILE.PUNCH) damage += SLOT_DAMAGE.punch;
      if (type === TILE.KICK) damage += SLOT_DAMAGE.kick;
      if (type === TILE.SLAP) damage += SLOT_DAMAGE.slap;
      if (type === TILE.HEAD) damage += SLOT_DAMAGE.head;
      if (type === TILE.WEED) heal += 10;
    }

    return { damage, heal };
  }

  function buildSpecialResolution(board, cell) {
    const tile = board?.[cell?.r]?.[cell?.c];
    const special = getTileSpecial(tile);
    if (!tile || !special) return null;

    const targets = buildSpecialTargets(board, cell, special);
    const remove = new Set(targets.map((target) => cellKey(target.r, target.c)));
    const summary = summarizeDestroyedTiles(board, targets);

    return {
      hasAction: remove.size > 0,
      matches: [],
      remove,
      damage: summary.damage,
      heal: summary.heal,
      extraMoves: 0,
      fxBursts: [{
        kind: "special",
        label: pvpCrushSpecialLabel(special),
        color: SPECIAL_META[special]?.color || "#ffd166",
        len: Math.max(4, targets.length),
        cell: { r: cell.r, c: cell.c },
      }],
      specialSpawns: [],
      special,
    };
  }

  function calcBotAction(board, hpBias) {
    let bestSpecial = null;
    for (const cell of collectBoardCells(board)) {
      const tile = board?.[cell.r]?.[cell.c];
      const special = getTileSpecial(tile);
      if (!special) continue;
      const targets = buildSpecialTargets(board, cell, special);
      const summary = summarizeDestroyedTiles(board, targets);
      const score =
        summary.damage * 2.7 +
        summary.heal * (hpBias < 45 ? 2.2 : 1.1) +
        targets.length * 6 +
        (special === SPECIAL.BOMB ? 18 : special === SPECIAL.ROCKET ? 14 : 10);
      if (!bestSpecial || score > bestSpecial.score) {
        bestSpecial = { kind: "special", cell, score };
      }
    }

    const bestMove = calcBotMove(board, hpBias);
    if (!bestSpecial) return bestMove ? { kind: "swap", ...bestMove } : null;
    if (!bestMove || bestSpecial.score >= Number(bestMove.score || 0) + 10) return bestSpecial;
    return { kind: "swap", ...bestMove };
  }

  function drawTileIcon(ctx, tileLike, x, y, size, selected, animT) {
    const tile = tileLike && typeof tileLike === "object" ? tileLike : { type: tileLike, special: null };
    const meta = TILE_META[getTileType(tile)] || TILE_META[TILE.PUNCH];
    const special = getTileSpecial(tile);
    const specialMeta = SPECIAL_META[special] || null;
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

  function renderCrushTile(ctx, tileLike, x, y, size, selected, animT) {
    const tile = tileLike && typeof tileLike === "object" ? tileLike : { type: tileLike, special: null };
    const meta = TILE_META[getTileType(tile)] || TILE_META[TILE.PUNCH];
    const special = getTileSpecial(tile);
    const specialMeta = SPECIAL_META[special] || null;
    const img = ICON_IMAGES[meta.assetKey];
    const r = Math.max(8, Math.floor(size * 0.18));

    const tileGrad = ctx.createLinearGradient(x, y, x + size, y + size);
    tileGrad.addColorStop(0, meta.color + "22");
    tileGrad.addColorStop(1, meta.color + "0a");
    fillRoundRect(ctx, x, y, size, size, r, tileGrad);

    if (selected) {
      const pulse = 0.7 + 0.3 * Math.sin((animT || 0) * 0.006);
      strokeRoundRect(ctx, x, y, size, size, r, meta.color + Math.round(pulse * 255).toString(16).padStart(2, "0"), 2.5);
    } else {
      strokeRoundRect(ctx, x, y, size, size, r, meta.color + "33", 1);
    }

    ctx.fillStyle = meta.color + "bb";
    ctx.beginPath();
    ctx.arc(x + size - 7, y + 7, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (img && img.complete && (img.naturalWidth || img.width)) {
      const pad = Math.max(3, Math.floor(size * 0.1));
      const drawSize = Math.max(8, size - pad * 2);
      ctx.drawImage(img, x + pad, y + pad, drawSize, drawSize);
    } else {
      ctx.font = `900 ${Math.floor(size * 0.47)}px system-ui, Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(meta.emoji, x + size / 2, y + size / 2 + 1);
    }

    if (!specialMeta) return;

    const pulse = 0.72 + 0.28 * Math.sin((animT || 0) * 0.01);
    const badgeW = Math.max(18, Math.floor(size * 0.34));
    const badgeH = Math.max(14, Math.floor(size * 0.24));
    const badgeX = x + size - badgeW - 5;
    const badgeY = y + size - badgeH - 5;
    const glow = ctx.createRadialGradient(
      badgeX + badgeW * 0.5,
      badgeY + badgeH * 0.5,
      2,
      badgeX + badgeW * 0.5,
      badgeY + badgeH * 0.5,
      badgeW
    );
    glow.addColorStop(0, specialMeta.color + "bb");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(badgeX + badgeW * 0.5, badgeY + badgeH * 0.5, badgeW * 0.7, 0, Math.PI * 2);
    ctx.fill();
    fillRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, Math.max(6, Math.floor(badgeH * 0.45)), "rgba(8,10,18,0.88)");
    strokeRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, Math.max(6, Math.floor(badgeH * 0.45)), specialMeta.color + Math.round(pulse * 255).toString(16).padStart(2, "0"), 1.5);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.max(9, Math.floor(size * 0.16))}px system-ui, Arial`;
    ctx.fillStyle = "#fff4db";
    ctx.fillText(specialMeta.badge, badgeX + badgeW * 0.5, badgeY + badgeH * 0.54);
  }

  function makeArenaMarkup() {
    const opponentLabel = pvpCrushOpponentName();
    const playerLabel = pvpCrushPlayerName();
    const moveLabel = pvpCrushText("moves", "Hamle");
    return `
      <div class="tc-cage-root tc-crush-root">
        <div class="tc-cage-top tc-crush-top">
          <button class="tc-cage-x tc-crush-x" id="tcCrushClose" type="button" aria-label="${pvpCrushText("back", "Geri")}">✕</button>

          <div class="tc-cage-title-wrap tc-crush-title-wrap">
            <div class="tc-cage-neon tc-crush-neon">IQ ARENA</div>
            <div class="tc-cage-sub tc-crush-sub" id="tcCrushSub">${pvpCrushText("searching", "Rakip araniyor...")}</div>
          </div>
        </div>

        <div class="tc-cage-row tc-crush-row">
          <div class="tc-cage-card tc-crush-card">
            <div class="tc-cage-name tc-crush-name" id="tcCrushEnemyName">${opponentLabel}</div>
            <div class="tc-cage-hpbar tc-crush-hpbar"><div class="tc-cage-hpfill tc-crush-hpfill" id="tcCrushEnemyFill"></div></div>
            <div class="tc-cage-hptext tc-crush-hptext" id="tcCrushEnemyText">100 / 100</div>
            <div class="tc-crush-chipline" id="tcCrushEnemyMoves">${moveLabel}: 12</div>
          </div>

          <div class="tc-cage-vs tc-crush-vs" id="tcCrushTurn">VS</div>

          <div class="tc-cage-card tc-crush-card">
            <div class="tc-cage-name tc-crush-name" id="tcCrushMeName">${playerLabel}</div>
            <div class="tc-cage-hpbar tc-crush-hpbar"><div class="tc-cage-hpfill tc-crush-hpfill" id="tcCrushMeFill"></div></div>
            <div class="tc-cage-hptext tc-crush-hptext" id="tcCrushMeText">100 / 100</div>
            <div class="tc-crush-chipline" id="tcCrushMeMoves">${moveLabel}: 12</div>
          </div>
        </div>

        <div class="tc-cage-stage tc-crush-stage" id="tcCrushStage">
          <canvas class="tc-cage-canvas tc-crush-canvas"></canvas>
          <div class="tc-cage-toast tc-crush-toast" id="tcCrushToast"></div>
        </div>

        <div class="tc-cage-rule tc-crush-rule">${pvpCrushText("rule", "Surukleyerek veya dokunarak tas degistir • Raund basi 40sn • Extra move en fazla 2 hakta kalir")}</div>
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
    _opponent: { username: "", isBot: true },
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
    _hiddenTileIds: null,
    _resultOverlay: null,
    _fxReplayToken: 0,
    _lastRemoteStateSeq: 0,

    _lang() {
      return getPvpCrushLang();
    },

    _text(key, fallback = "") {
      return pvpCrushText(key, fallback);
    },

    _format(key, vars = {}, fallback = "") {
      return pvpCrushFormat(key, vars, fallback);
    },

    _playerName() {
      return pvpCrushPlayerName();
    },

    _opponentName(name = null) {
      return pvpCrushOpponentName(name == null ? this._opponent?.username : name);
    },


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

    _vibrate(pattern) {
      try {
        if (!navigator?.vibrate) return;
        navigator.vibrate(pattern);
      } catch (_) {}
    },

    _isTurnIntroActive() {
      return !!(this._state && Number(this._state.turnBannerUntil || 0) > Date.now());
    },

    _isTurnInputBlocked() {
      if (!this._state || this._state.turn !== "me") return false;
      return this._isTurnIntroActive();
    },

    _beginTurn(turn, opts = {}) {
      if (!this._state) return;
      const now = Date.now();
      const showBanner = turn === "me" && opts.showBanner !== false;
      this._state.turn = turn;
      this._state.turnMadeAction = false;
      this._state.turnTimerStartsAt = showBanner ? now + TURN_BANNER_MS : now;
      this._state.turnDeadlineAt = this._state.turnTimerStartsAt + TURN_TIME_MS;
      this._state.turnBannerText = showBanner ? this._text("turnBanner", "SIRA SENDE") : "";
      this._state.turnBannerUntil = showBanner ? now + TURN_BANNER_MS : 0;
      if (turn === "me") this._state.meActionLeft = ACTIONS_PER_TURN;
      else this._state.enemyActionLeft = ACTIONS_PER_TURN;
      this._updateHud();
      this._render();
    },

    _forceTurnTimeout(turn) {
      if (!this._state || this._state.finished || this._state.turn !== turn) return;
      const isOnline = this._isRealtimeMatch();
      const didPlayRound = !!this._state.turnMadeAction;
      if (turn === "me") {
        if (!didPlayRound) {
          this._state.info = this._text("timeoutLose", "Hamle gelmedi â€¢ raund kaybi");
          this._toast(this._text("timeoutLose", "Hamle gelmedi â€¢ raund kaybi"));
          this._finishGame(false, this._text("timeoutLose", "Hamle gelmedi â€¢ raund kaybi"));
          if (isOnline) {
            this._bumpNetworkSeq();
            this._broadcastOnline("finish_sync", {
              state: this._toNetworkState(),
              toastKey: "timeoutLose",
            }).catch?.(() => {});
          }
          return;
        }
        this._state.meActionLeft = 0;
        this._state.info = this._text("timeUpTurnEnemy", "Sure doldu • sira rakipte");
        this._toast(this._text("timeUp", "Sure doldu"));
        this._beginTurn("enemy", { showBanner: false });
        this._locked = true;
        if (this._running && !this._checkFinish()) {
          if (isOnline) {
            this._bumpNetworkSeq();
            this._broadcastOnline("state_sync", {
              state: this._toNetworkState(),
              toastKey: "opponentTimedOut",
            }).catch?.(() => {});
          } else {
            clearTimeout(this._turnTimer);
            this._turnTimer = setTimeout(() => this._enemyPlay(), randInt(450, 900));
          }
        }
      } else {
        if (!didPlayRound) {
          this._state.info = this._text("timeoutWin", "Rakip oynamadi â€¢ kazandin");
          this._toast(this._text("timeoutWin", "Rakip oynamadi â€¢ kazandin"));
          this._finishGame(true, this._text("timeoutWin", "Rakip oynamadi â€¢ kazandin"));
          if (isOnline) {
            this._bumpNetworkSeq();
            this._broadcastOnline("finish_sync", {
              state: this._toNetworkState(),
              toastKey: "timeoutWin",
            }).catch?.(() => {});
          }
          return;
        }
        this._state.enemyActionLeft = 0;
        this._state.info = this._text("opponentTimedOut", "Rakibin suresi doldu");
        this._toast(this._text("opponentTimedOut", "Rakibin suresi doldu"));
        this._beginTurn("me");
        this._locked = false;
        if (isOnline) {
          this._bumpNetworkSeq();
          this._broadcastOnline("state_sync", {
            state: this._toNetworkState(),
            toastKey: "opponentTimedOut",
          }).catch?.(() => {});
        }
      }
    },

    _startTurnTicker() {
      clearInterval(this._turnTicker);
      this._turnTicker = setInterval(() => {
        if (!this._state || this._state.finished || this._state.matchmaking) return;
        if (Number(this._state.turnTimerStartsAt || 0) > Date.now()) {
          this._updateHud();
          return;
        }
        const left = Number(this._state.turnDeadlineAt || 0) - Date.now();
        if (left <= 0) {
          this._forceTurnTimeout(this._state.turn);
          return;
        }
        this._updateHud();
      }, 200);
    },

    _getDisplayedTurnMs(turn) {
      if (!this._state || this._state.turn !== turn || this._state.matchmaking || this._state.finished) return null;
      const now = Date.now();
      const startsAt = Number(this._state.turnTimerStartsAt || 0);
      if (now < startsAt) return TURN_TIME_MS;
      return Math.max(0, Number(this._state.turnDeadlineAt || 0) - now);
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
      this._setStatus(this._text("arenaReady", "IQ ARENA hazir"));
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

    _bumpNetworkSeq() {
      if (!this._state) return 0;
      this._state.networkSeq = Math.max(1, Number(this._state.networkSeq || 0) + 1);
      return this._state.networkSeq;
    },

    _acceptRemoteNetworkState(netState) {
      const seq = Number(netState?.seq || 0);
      if (!seq) return true;
      if (seq <= Number(this._lastRemoteStateSeq || 0)) return false;
      this._lastRemoteStateSeq = seq;
      return true;
    },

    _toNetworkState() {
      if (!this._state) return null;
      const amIPlayer1 = !!this._matchCtx?.amIPlayer1;
      return {
        seq: Number(this._state.networkSeq || 1),
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
        turnMadeAction: !!this._state.turnMadeAction,
        turnClockActive: Date.now() >= Number(this._state.turnTimerStartsAt || 0),
        turnRemainingMs: Math.max(
          0,
          Date.now() >= Number(this._state.turnTimerStartsAt || 0)
            ? Number(this._state.turnDeadlineAt || 0) - Date.now()
            : TURN_TIME_MS
        ),
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
        duration: 240,
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
      if (meta.fromRemote && !this._acceptRemoteNetworkState(netState)) return;
      if (meta.fromRemote && meta.move?.from && meta.move?.to && !this._remoteSwapAnim) {
        if (this._startRemoteSwapAnimation(netState, meta)) return;
      }
      const amIPlayer1 = !!this._matchCtx?.amIPlayer1;
      const nextBoard = cloneBoard(netState.board || this._state.board);
      this._state.networkSeq = Math.max(
        Number(this._state.networkSeq || 1),
        Number(netState.seq || this._state.networkSeq || 1)
      );

      const prevTurn = this._state.turn;
      const nextTurn = (
        (netState.activePlayer === "player1" && amIPlayer1) ||
        (netState.activePlayer === "player2" && !amIPlayer1)
      ) ? "me" : "enemy";

      this._state.board = nextBoard;
      this._state.meHp = amIPlayer1 ? Number(netState.player1Hp) : Number(netState.player2Hp);
      this._state.enemyHp = amIPlayer1 ? Number(netState.player2Hp) : Number(netState.player1Hp);
      this._state.meMoves = amIPlayer1 ? Number(netState.player1Moves) : Number(netState.player2Moves);
      this._state.enemyMoves = amIPlayer1 ? Number(netState.player2Moves) : Number(netState.player1Moves);
      this._state.meActionLeft = amIPlayer1 ? Number(netState.player1ActionLeft) : Number(netState.player2ActionLeft);
      this._state.enemyActionLeft = amIPlayer1 ? Number(netState.player2ActionLeft) : Number(netState.player1ActionLeft);
      this._state.turn = nextTurn;
      this._state.turnMadeAction = !!netState.turnMadeAction;
      this._state.info = netState.info || this._state.info || "";
      this._state.finished = !!netState.finished;
      this._state.matchmaking = false;
      if (nextTurn !== prevTurn) {
        this._beginTurn(nextTurn, { showBanner: nextTurn === "me" });
        this._state.meActionLeft = amIPlayer1 ? Number(netState.player1ActionLeft) : Number(netState.player2ActionLeft);
        this._state.enemyActionLeft = amIPlayer1 ? Number(netState.player2ActionLeft) : Number(netState.player1ActionLeft);
        this._state.turnMadeAction = !!netState.turnMadeAction;
      } else if (nextTurn === "enemy") {
        const remainingMs = clamp(Number(netState.turnRemainingMs || TURN_TIME_MS), 0, TURN_TIME_MS);
        this._state.turnTimerStartsAt = Date.now();
        this._state.turnDeadlineAt = Date.now() + remainingMs;
        this._state.turnBannerText = "";
        this._state.turnBannerUntil = 0;
      }

      this._locked = this._state.finished ? true : this._state.turn !== "me";

      const toastText = meta.toastKey
        ? this._format(meta.toastKey, meta.toastVars || {}, meta.toast || "")
        : meta.toast;
      if (toastText) this._toast(toastText);
      const replayPromise = Array.isArray(meta.fxTimeline) && meta.fxTimeline.length
        ? this._queueFxTimeline(meta.fxTimeline)
        : Promise.resolve();

      if (this._state.finished) {
        const win = this._state.enemyHp <= 0 ||
          (this._state.meMoves <= 0 && this._state.enemyMoves <= 0 && this._state.meHp >= this._state.enemyHp);
        replayPromise.finally(() => {
          this._finishGame(win, this._state.info || (win ? this._text("won", "Kazandin") : this._text("lost", "Kaybettin")));
        });
        this._updateHud();
        this._render();
        return;
      }

      this._updateHud();
      this._render();
    },

    _spawnRainDrops(specs) {
      if (!Array.isArray(specs) || !specs.length) return;
      if (!this._hiddenTileIds) this._hiddenTileIds = new Set();
      for (const spec of specs) {
        const rect = this._tileRects.find((t) => t.r === spec.r && t.c === spec.c);
        if (!rect) continue;
        const tileId = spec.id || null;
        if (tileId) this._hiddenTileIds.add(tileId);
        this._effects.push({
          type: "tile_drop",
          tileId,
          tileType: spec.type,
          x: rect.x + 2,
          y: rect.y + 2 - rect.h * (spec.startOffset || 1.2),
          toY: rect.y + 2,
          size: rect.w - 4,
          life: 0,
          delay: Number(spec.delay || 0),
          duration: Number(spec.duration || 360),
        });
      }
    },

    async _queueFxTimeline(timeline) {
      if (!Array.isArray(timeline) || !timeline.length) return;
      const token = ++this._fxReplayToken;
      for (const step of timeline) {
        if (token !== this._fxReplayToken) return;
        if (step?.bursts?.length) this._spawnMatchEffects(step.bursts, { remote: true });
        if (step?.drops?.length) this._spawnRainDrops(step.drops);
        this._render();
        await this._sleep(Number(step?.waitMs || 250));
      }
    },

    _getStakeRewardYton() {
      const sqlMode = String(this._matchCtx?.sqlMode || "");
      if (sqlMode === "pvpcrush") return 100;
      if (sqlMode === "pvpcage") return 75;
      if (sqlMode === "pvpslotarena") return 150;
      const modeId = String(this._matchCtx?.modeId || "");
      if (modeId === "grid") return 100;
      if (modeId === "arena") return 75;
      if (modeId === "slotarena") return 150;
      return 0;
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
            toastKey: payload.toastKey || "",
            fromRemote: true,
            move: payload.move || null,
            fxTimeline: payload.fxTimeline || null,
          });
        })
        .on("broadcast", { event: "finish_sync" }, ({ payload }) => {
          if (!payload?.state) return;
          this._applyNetworkState(payload.state, {
            fromRemote: true,
            move: payload.move || null,
            fxTimeline: payload.fxTimeline || null,
          });
        })
        .on("broadcast", { event: "leave_match" }, () => {
          if (this._state?.finished) return;
          this._finishGame(true, this._text("opponentLeftWon", "Rakip cikti • kazandin"));
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
      if (this._els?.enemyName) this._els.enemyName.textContent = this._opponentName();
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
        this._beginTurn(amIPlayer1 ? "me" : "enemy", { showBanner: amIPlayer1 });
        this._state.info = amIPlayer1
          ? this._format("opponentReadyFirstYou", { name: this._opponentName() }, `${this._opponentName()} hazir • ilk sira sende`)
          : this._format("opponentReadyFirstEnemy", { name: this._opponentName() }, `${this._opponentName()} hazir • ilk sira rakipte`);
      } else {
        this._beginTurn("me", { showBanner: true });
        this._state.info = this._format("opponentReady", { name: this._opponentName() }, `${this._opponentName()} hazir`);
      }

      this._setStatus(this._format("statusOpponentReady", { name: this._opponentName() }, `IQ ARENA • ${this._opponentName()} hazir`));
      this._locked = this._state.turn !== "me";
      this._updateHud();
      this._render();
    },

    async stop() {
      const isForfeit = this._isRealtimeMatch() && this._onlineReady && !this._state?.finished;
      if (isForfeit) {
        await this._broadcastOnline("leave_match", { matchId: this._matchCtx?.matchId || null });
        this._finishGame(false, this._text("matchLeft", "Mactan ciktin"));
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
      this._fxReplayToken += 1;
      if (this._hiddenTileIds) this._hiddenTileIds.clear();
      this._resultOverlay = null;
      if (this._state) {
        this._state.matchmaking = false;
        this._state.info = this._text("matchStopped", "Mac durduruldu");
      }
      this._setStatus(this._text("arenaStopped", "IQ ARENA durdu"));
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
      this._hiddenTileIds = new Set();
      this._resultOverlay = null;
      this._fxReplayToken += 1;

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
        info: this._text("matchReady", "Mac hazir"),
        matchmaking: false,
        finished: false,
        turnMadeAction: false,
        turnTimerStartsAt: Date.now(),
        turnDeadlineAt: Date.now() + TURN_TIME_MS,
        turnBannerText: "",
        turnBannerUntil: 0,
        networkSeq: 1,
      };
      this._lastRemoteStateSeq = 0;

      if (this._els?.meName) {
        this._els.meName.textContent = this._playerName();
      }
      if (this._els?.enemyName) {
        this._els.enemyName.textContent = this._opponentName();
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
      this._state.info = this._format("botFound", { name }, `${name} bulundu • Bot`);
      this._setStatus(this._format("statusFound", { name }, `IQ ARENA • ${name} bulundu`));
      this._toast(this._format("botJoined", { name }, `${name} maca girdi`));
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
      if (status) status.textContent = `PvP • ${this._text("pvpReady", "Hazir")}`;
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
        if (!this._running || this._locked || this._state?.turn !== "me" || this._state?.matchmaking || this._isTurnInputBlocked()) return;
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
        if (!this._running || this._locked || this._state?.turn !== "me" || this._state?.matchmaking || this._isTurnInputBlocked()) return;
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
        if (!this._running || this._locked || this._state?.turn !== "me" || this._state?.matchmaking || this._isTurnInputBlocked()) return;
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
          const tile = this._state?.board?.[hit.r]?.[hit.c];
          if (getTileSpecial(tile)) {
            this._selected = null;
            this._activateSpecialTile(hit);
            ev.preventDefault?.();
            return;
          }
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
        this._finishGame(false, this._text("matchLeft", "Mactan ciktin"));
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

    _spawnMatchEffects(bursts, opts = {}) {
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
        this._vibrate(burst.kind === "extra" ? [12, 20, 22] : [10, 14, 10]);

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
            } else if (fx.type === "tile_drop") {
              if (fx.life < Number(fx.delay || 0)) {
                // wait
              }
            }

            const totalLife = fx.type === "tile_drop"
              ? Number(fx.delay || 0) + fx.duration
              : fx.duration;
            const alive = fx.life < totalLife;
            if (!alive && fx.type === "tile_drop" && fx.tileId && this._hiddenTileIds) {
              this._hiddenTileIds.delete(fx.tileId);
            }
            return alive;
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
      const moveLabel = this._text("moves", "Hamle");
      const roundLabel = this._text("round", "Raund");
      const timeLabel = this._text("time", "Sure");
      const meScale = clamp(s.meHp, 0, START_HP) / START_HP;
      const enemyScale = clamp(s.enemyHp, 0, START_HP) / START_HP;
      const meTurnMs = this._getDisplayedTurnMs("me");
      const enemyTurnMs = this._getDisplayedTurnMs("enemy");
      const activeTurnMs = s.turn === "me" ? meTurnMs : enemyTurnMs;
      const activeTimeText = fmtTurnTime(activeTurnMs == null ? 0 : activeTurnMs);

      this._els.meFill.style.transform = `scaleX(${meScale})`;
      this._els.enemyFill.style.transform = `scaleX(${enemyScale})`;
      this._els.meHpText.textContent = Math.round(s.meHp);
      this._els.enemyHpText.textContent = Math.round(s.enemyHp);

      if (this._els.rootMeFill) this._els.rootMeFill.style.transform = `scaleX(${meScale})`;
      if (this._els.rootEnemyFill) this._els.rootEnemyFill.style.transform = `scaleX(${enemyScale})`;
      if (this._els.rootMeText) this._els.rootMeText.textContent = `${Math.round(s.meHp)} / ${START_HP}`;
      if (this._els.rootEnemyText) this._els.rootEnemyText.textContent = `${Math.round(s.enemyHp)} / ${START_HP}`;

      const timeLeft = activeTimeText;
      if (this._els.meMoves) this._els.meMoves.textContent = `${moveLabel}: ${s.meMoves} • ${roundLabel}: ${s.meActionLeft}/2 • ${timeLabel}: ${s.turn === "me" && !s.matchmaking && !s.finished ? timeLeft : "--:--"}`;
      if (this._els.enemyMoves) this._els.enemyMoves.textContent = `${moveLabel}: ${s.enemyMoves} • ${roundLabel}: ${s.enemyActionLeft}/2 • ${timeLabel}: ${s.turn === "enemy" && !s.matchmaking && !s.finished ? timeLeft : "--:--"}`;
      if (this._els.meMoves) {
        this._els.meMoves.textContent = `${moveLabel}: ${s.meMoves} - ${roundLabel}: ${s.meActionLeft}/2 - ${timeLabel}: ${meTurnMs == null ? "--:--" : fmtTurnTime(meTurnMs)}`;
      }
      if (this._els.enemyMoves) {
        this._els.enemyMoves.textContent = `${moveLabel}: ${s.enemyMoves} - ${roundLabel}: ${s.enemyActionLeft}/2 - ${timeLabel}: ${enemyTurnMs == null ? "--:--" : fmtTurnTime(enemyTurnMs)}`;
      }

      if (this._els.turn) {
        if (s.matchmaking) {
          this._els.turn.textContent = "...";
        } else if (s.finished) {
          this._els.turn.textContent = this._text("finished", "Bitti");
        } else {
          this._els.turn.textContent = s.turn === "me" ? this._text("youUpper", "SEN") : "VS";
        }
      }

      if (this._els.sub) {
        this._els.sub.textContent = s.matchmaking
          ? this._text("searchingHint", "5sn icinde rakip bulunmazsa bot gelir")
          : this._format(
            "subline",
            {
              info: s.info || "Grid Heist",
              turn: s.turn === "me" ? this._text("you", "Sen") : this._opponentName(),
              time: timeLeft,
              online: this._isRealtimeMatch() ? this._text("online", " • ONLINE") : "",
            },
            `${s.info || "Grid Heist"} • Sira: ${s.turn === "me" ? this._text("you", "Sen") : this._opponentName()} • Sure: ${timeLeft}${this._isRealtimeMatch() ? " • ONLINE" : ""}`
          );
      }
    },

    async _playerMove(a, b) {
      if (!this._running || this._locked || this._state?.matchmaking) return;
      this._locked = true;

      const swapped = swapCells(this._state.board, a, b);
      const evalNow = evaluateBoard(swapped);
      if (!evalNow.hasAction) {
        this._toast(this._text("invalidMove", "Gecersiz hamle"));
        this._locked = false;
        this._selected = a;
        this._render();
        return;
      }

      this._state.board = swapped;
      this._state.turnMadeAction = true;
      this._render();
      await this._sleep(140);
      const turnFx = await this._resolveTurn("me", { initialResolution: evalNow });

      if (!this._running) return;
      if (this._checkFinish()) {
        if (this._isRealtimeMatch()) {
          this._bumpNetworkSeq();
          await this._broadcastOnline("finish_sync", {
          state: this._toNetworkState(),
          move: { from: a, to: b },
          fxTimeline: turnFx?.fxTimeline || [],
        });
        }
        return;
      }

      if (this._isRealtimeMatch()) {
        this._bumpNetworkSeq();
        await this._broadcastOnline("state_sync", {
          state: this._toNetworkState(),
          move: { from: a, to: b },
          toastKey: "opponentPlayed",
          fxTimeline: turnFx?.fxTimeline || [],
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

    async _activateSpecialTile(cell, actor = "me") {
      if (!this._running || this._state?.matchmaking) return;
      if (actor === "me" && (this._locked || this._state?.turn !== "me")) return;
      if (actor === "enemy" && this._state?.turn !== "enemy") return;

      const tile = this._state?.board?.[cell?.r]?.[cell?.c];
      const special = getTileSpecial(tile);
      if (!tile || !special) {
        if (actor === "me") this._locked = false;
        return;
      }

      this._locked = true;
      this._selected = null;
      this._state.turnMadeAction = true;
      this._state.info = pvpCrushSpecialLabel(special) || this._state.info;
      this._render();
      await this._sleep(actor === "me" ? 110 : 180);

      const resolution = buildSpecialResolution(this._state.board, cell);
      if (!resolution?.hasAction) {
        this._locked = actor !== "me";
        return;
      }

      const turnFx = await this._resolveTurn(actor, { initialResolution: resolution });
      if (!this._running) return;

      if (this._checkFinish()) {
        if (actor === "me" && this._isRealtimeMatch()) {
          this._bumpNetworkSeq();
          await this._broadcastOnline("finish_sync", {
            state: this._toNetworkState(),
            move: { special: special, at: { r: cell.r, c: cell.c } },
            fxTimeline: turnFx?.fxTimeline || [],
          });
        }
        return;
      }

      if (actor === "me" && this._isRealtimeMatch()) {
        this._bumpNetworkSeq();
        await this._broadcastOnline("state_sync", {
          state: this._toNetworkState(),
          move: { special: special, at: { r: cell.r, c: cell.c } },
          toastKey: "opponentPlayed",
          fxTimeline: turnFx?.fxTimeline || [],
        });
        this._locked = this._state.turn !== "me";
        return;
      }

      if (actor === "enemy") {
        if (this._state.turn === "enemy") {
          this._turnTimer = setTimeout(() => this._enemyPlay(), randInt(650, 1150));
        } else {
          this._locked = false;
        }
        return;
      }

      if (this._state.turn === "enemy") {
        this._turnTimer = setTimeout(() => this._enemyPlay(), randInt(700, 1250));
      } else {
        this._locked = false;
      }
    },

    async _enemyPlay() {
      if (this._isRealtimeMatch()) return;
      if (!this._running || !this._state || this._state.turn !== "enemy" || this._state.matchmaking) return;
      this._locked = true;

      const thinking = randInt(850, 1900);
      this._state.info = this._text("thinkingStarted", "Dusunme suresi basladi");
      this._updateHud();
      this._render();
      await this._sleep(thinking);

      const action = calcBotAction(this._state.board, this._state.enemyHp);
      if (!action) {
        this._state.info = this._text("opponentNoMove", "Rakip hamle bulamadi");
        this._toast(this._text("opponentNoMove", "Rakip hamle bulamadi"));
        this._finishGame(true, this._text("opponentNoMove", "Rakip hamle bulamadi"));
        return;
      }

      this._state.turnMadeAction = true;
      if (action.kind === "special") {
        this._state.info = this._text("opponentPlaying", "Rakip oynuyor");
        this._updateHud();
        this._render();
        await this._sleep(randInt(180, 320));
        await this._activateSpecialTile(action.cell, "enemy");
      } else {
        this._state.board = swapCells(this._state.board, action.a, action.b);
        this._state.info = this._text("opponentPlaying", "Rakip oynuyor");
        this._updateHud();
        this._render();
        await this._sleep(randInt(160, 320));
        await this._resolveTurn("enemy");
      }

      if (!this._running) return;
      if (this._checkFinish()) return;

      if (this._state.turn === "enemy") {
        this._turnTimer = setTimeout(() => this._enemyPlay(), randInt(650, 1150));
      } else {
        this._locked = false;
      }
    },

    async _resolveTurn(actor, opts = {}) {
      let board = this._state.board;
      let chain = 0;
      let totalDamage = 0;
      let totalHeal = 0;
      let totalExtra = 0;
      const fxTimeline = [];
      let res = opts.initialResolution || evaluateBoard(board);
      this._state.turnMadeAction = true;

      while (res?.hasAction) {

        chain += 1;
        totalDamage += res.damage;
        totalHeal += res.heal;
        totalExtra += res.extraMoves;

        this._render();
        this._spawnMatchEffects(res.fxBursts);

        const nextBoard = applyResolution(board, res);
        const drops = buildDropSpecs(board, nextBoard);
        board = nextBoard;
        this._state.board = board;
        this._spawnRainDrops(drops);
        fxTimeline.push({
          bursts: res.fxBursts.map((b) => ({
            kind: b.kind,
            label: b.label,
            color: b.color,
            len: b.len,
            cell: b.cell ? { r: b.cell.r, c: b.cell.c } : null,
          })),
          drops: drops.map((d) => ({ ...d })),
          waitMs: 260,
        });
        this._state.info = this._format(
          "comboStatus",
          { actor: actor === "me" ? this._text("youUpper", "SEN") : this._opponentName(), chain },
          `${actor === "me" ? this._text("youUpper", "SEN") : this._opponentName()} • Combo x${chain}`
        );
        this._updateHud();
        this._render();
        await this._sleep(250);
        res = evaluateBoard(board);
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
              ? this._format("hitHealExtra", { damage: totalDamage, heal: totalHeal, extra: totalExtra }, `Vurus ${totalDamage} • Can +${totalHeal} • Extra Move +${totalExtra}`)
              : this._format("hitExtra", { damage: totalDamage, extra: totalExtra }, `Vurus ${totalDamage} • Extra Move +${totalExtra}`)
          );
        } else {
          this._toast(
            totalHeal > 0
              ? this._format("hitHeal", { damage: totalDamage, heal: totalHeal }, `Vurus ${totalDamage} • Can +${totalHeal}`)
              : this._format("hit", { damage: totalDamage }, `Vurus ${totalDamage}`)
          );
        }

        if (this._state.meMoves <= 0 || this._state.meActionLeft <= 0) {
          this._beginTurn("enemy");
        } else {
          this._state.turn = "me";
          this._state.turnBannerText = "";
          this._state.turnBannerUntil = 0;
        }
      } else {
        this._state.enemyMoves = Math.max(0, this._state.enemyMoves - 1);
        this._state.enemyHp = clamp(this._state.enemyHp + totalHeal, 0, START_HP);
        this._state.meHp = clamp(this._state.meHp - totalDamage, 0, START_HP);
        this._state.enemyActionLeft = clamp(this._state.enemyActionLeft - 1 + totalExtra, 0, ACTIONS_PER_TURN);

        if (totalExtra > 0) {
          this._toast(
            totalHeal > 0
              ? this._format("opponentHitHealExtra", { damage: totalDamage, heal: totalHeal, extra: totalExtra }, `Rakip ${totalDamage} vurdu • Can +${totalHeal} • Extra Move +${totalExtra}`)
              : this._format("opponentHitExtra", { damage: totalDamage, extra: totalExtra }, `Rakip ${totalDamage} vurdu • Extra Move +${totalExtra}`)
          );
        } else {
          this._toast(
            totalHeal > 0
              ? this._format("opponentHitHeal", { damage: totalDamage, heal: totalHeal }, `Rakip ${totalDamage} vurdu • Can +${totalHeal}`)
              : this._format("opponentHit", { damage: totalDamage }, `Rakip ${totalDamage} vurdu`)
          );
        }

        if (this._state.enemyMoves <= 0 || this._state.enemyActionLeft <= 0) {
          this._beginTurn("me");
        } else {
          this._state.turn = "enemy";
          this._state.turnBannerText = "";
          this._state.turnBannerUntil = 0;
        }
      }

      this._state.info = totalExtra > 0
        ? this._format("chainStatusExtra", { chain: Math.max(1, chain), extra: totalExtra }, `${Math.max(1, chain)} chain • Extra +${totalExtra}`)
        : this._format("chainStatus", { chain: Math.max(1, chain) }, `${Math.max(1, chain)} chain`);
      this._updateHud();
      this._render();
      return { fxTimeline, totalDamage, totalHeal, totalExtra, chain };
    },

    _recordResult(win) {
      if (this._resultRecorded) return;
      this._resultRecorded = true;
      const store = window.tcStore;
      const now = Date.now();
      const REWARD_COINS = 36;
      const opponent = this._opponentName();
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
      const rewardYton = win ? this._getStakeRewardYton() : 0;
      this._setStatus(win ? this._text("won", "Kazandin") : this._text("lost", "Kaybettin"));
      this._state.info = reason || (win ? this._text("won", "Kazandin") : this._text("lost", "Kaybettin"));
      this._resultOverlay = {
        win,
        title: win ? this._text("wonTitle", "KAZANDIN") : this._text("lostTitle", "KAYBETTIN"),
        reason: this._state.info,
        rewardYton,
        shownAt: Date.now(),
      };
      this._toast(
        win
          ? (rewardYton ? this._format("rewardWon", { reward: rewardYton }, `Kazandin • +${rewardYton} YTON`) : this._text("won", "Kazandin"))
          : this._text("lost", "Kaybettin")
      );
      this._recordResult(win);
      this._updateHud();
      this._render();
      return true;
    },

    _checkFinish() {
      if (!this._state) return false;
      if (this._state.enemyHp <= 0) return this._finishGame(true, this._text("opponentDown", "Rakip dustu"));
      if (this._state.meHp <= 0) return this._finishGame(false, this._text("youDown", "Sen dustun"));

      if (this._state.meMoves <= 0 && this._state.enemyMoves <= 0) {
        if (this._state.meHp >= this._state.enemyHp) return this._finishGame(true, this._text("hpLead", "HP ustunlugu"));
        return this._finishGame(false, this._text("hpLeadOpponent", "HP ustunlugu rakipte"));
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
        } else if (fx.type === "tile_drop") {
          const life = Math.max(0, fx.life - Number(fx.delay || 0));
          if (life <= 0) continue;
          const tt = clamp(life / fx.duration, 0, 1);
          const ease = 1 - Math.pow(1 - tt, 3);
          const y = fx.y + (fx.toY - fx.y) * ease;
          ctx.globalAlpha = Math.min(1, 0.35 + tt * 0.8);
          renderCrushTile(ctx, { type: fx.tileType, special: fx.special || null }, fx.x, y, fx.size, false, Date.now());
        }
      }
      ctx.globalAlpha = 1;
    },

    _renderTurnBanner(ctx, w, h) {
      const text = String(this._state?.turnBannerText || "");
      const until = Number(this._state?.turnBannerUntil || 0);
      if (!text || !until) return;

      const left = until - Date.now();
      if (left <= 0 || this._state?.finished) {
        this._state.turnBannerText = "";
        this._state.turnBannerUntil = 0;
        return;
      }

      const t = clamp(1 - left / TURN_BANNER_MS, 0, 1);
      const alpha = t < 0.2 ? t / 0.2 : (t > 0.82 ? (1 - t) / 0.18 : 1);
      const y = h * 0.5 - 12 * Math.sin(t * Math.PI);
      const glowColor = "rgba(255,126,74," + (0.22 * alpha).toFixed(3) + ")";
      const halo = ctx.createRadialGradient(w * 0.5, y, 10, w * 0.5, y, Math.min(w, h) * 0.34);
      halo.addColorStop(0, glowColor);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(w * 0.5, y, Math.min(w, h) * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${Math.max(28, Math.floor(Math.min(w, h) * 0.085))}px system-ui, Arial`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(text, w * 0.5, y);
      ctx.shadowBlur = 28;
      ctx.shadowColor = "#ff7a4a";
      ctx.fillStyle = "#ffd784";
      ctx.fillText(text, w * 0.5, y);
      ctx.restore();
    },

    _renderResultOverlay(ctx, w, h) {
      const overlay = this._resultOverlay;
      if (!overlay) return;
      const boxW = Math.min(w - 32, 320);
      const boxH = Math.min(h - 36, 170);
      const boxX = Math.floor((w - boxW) / 2);
      const boxY = Math.floor((h - boxH) / 2);
      const titleColor = overlay.win ? "#7dff9b" : "#ff7d93";
      fillRoundRect(ctx, boxX, boxY, boxW, boxH, 24, "rgba(5,10,18,0.82)");
      strokeRoundRect(ctx, boxX, boxY, boxW, boxH, 24, titleColor + "88", 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.font = "900 30px system-ui, Arial";
      ctx.strokeText(overlay.title, boxX + boxW / 2, boxY + 44);
      ctx.fillStyle = titleColor;
      ctx.fillText(overlay.title, boxX + boxW / 2, boxY + 44);
      ctx.font = "800 15px system-ui, Arial";
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillText(String(overlay.reason || ""), boxX + boxW / 2, boxY + 86);
      if (overlay.rewardYton) {
        ctx.font = "900 24px system-ui, Arial";
        ctx.fillStyle = "#ffd166";
        ctx.fillText(`+${overlay.rewardYton} YTON`, boxX + boxW / 2, boxY + 124);
      }
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
      const ease = t < 0.55 ? 2.4 * t * t : 1 - Math.pow(-2 * t + 2, 2.4) / 2;
      const mix = (a, b) => a + (b - a) * ease;
      const pad = 2;
      const drawMoving = (tile, src, dst) => {
        const x = mix(src.x, dst.x);
        const y = mix(src.y, dst.y);
        const radius = Math.max(10, Math.floor(src.w * 0.18));
        const meta = TILE_META[tile.type] || TILE_META[TILE.PUNCH];
        for (let ghost = 2; ghost >= 1; ghost--) {
          const lag = ghost * 0.12;
          const gx = mix(src.x, dst.x) - (dst.x - src.x) * lag;
          const gy = mix(src.y, dst.y) - (dst.y - src.y) * lag;
          ctx.globalAlpha = 0.12 / ghost;
          renderCrushTile(ctx, tile, gx + pad, gy + pad, src.w - 4, false, Date.now());
        }
        ctx.globalAlpha = 1;
        fillRoundRect(ctx, x + pad, y + pad, src.w - 4, src.h - 4, radius, "rgba(255,255,255,0.10)");
        const glowR = src.w * 0.58;
        const glow = ctx.createRadialGradient(x + src.w / 2, y + src.h / 2, 2, x + src.w / 2, y + src.h / 2, glowR);
        glow.addColorStop(0, meta.color + "99");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x + src.w / 2, y + src.h / 2, glowR, 0, Math.PI * 2);
        ctx.fill();
        renderCrushTile(ctx, tile, x + pad, y + pad, src.w - 4, false, Date.now());
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

          if (tile && !hiddenByRemoteAnim && !(this._hiddenTileIds && this._hiddenTileIds.has(tile.id))) {
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

            renderCrushTile(ctx, tile, x + 2, y + 2, cell - 4, selected, Date.now());
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
      this._renderTurnBanner(ctx, w, h);
      this._renderResultOverlay(ctx, w, h);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.restore();
      this._updateHud();
    },
  };

  window.TonCrimePVP_CRUSH = api;
})();
