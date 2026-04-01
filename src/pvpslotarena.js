(function () {
  const COLS = 6;
  const ROWS = 6;
  const START_HP = 1000;
  const BASE_SPINS = 24;
  const BONUS_SPINS = 10;
  const BONUS_CHANCE = 0.10;
  const SPIN_EXPLODE_CHANCE = 0.36;
  const BONUS_MODE_EXPLODE_CHANCE = 0.42;
  const CHAIN_CONTINUE_CHANCE = 0.30;
  const BONUS_TRIGGER = 4;
  const MIN_CLUSTER = 8;
  const PLAYER_DECISION_MS = 3000;
  const MATCH_WATCH_MS = 700;
  const SYNC_HEARTBEAT_MS = 900;
  const FLOW_EXTRA_MS = 500;

  const ICONS = {
    weed:  { id: "weed",  emoji: "🌿", label: "OT",      color: "#35da7b", base: 12, weight: 17 },
    brain: { id: "brain", emoji: "🧠", label: "BEYIN",   color: "#ff5b64", base: 18, weight: 15 },
    drink: { id: "drink", emoji: "🍾", label: "ALKOL",   color: "#ffd166", base: 14, weight: 17 },
    kick:  { id: "kick",  emoji: "🦵", label: "TEKME",   color: "#66e26f", base: 16, weight: 16 },
    slap:  { id: "slap",  emoji: "🖐️", label: "TOKAT",   color: "#76b8ff", base: 11, weight: 18 },
    punch: { id: "punch", emoji: "👊", label: "YUMRUK",  color: "#ffb24a", base: 15, weight: 17 },
    bonus: { id: "bonus", emoji: "⭐", label: "BONUS",   color: "#d68bff", base: 0,  weight: 4 },
  };

  const PAY_SYMBOLS = ["weed", "brain", "drink", "kick", "slap", "punch"];
  const ALL_SYMBOLS = ["weed", "brain", "drink", "kick", "slap", "punch", "bonus"];
  const BOT_NAMES = ["ShadowWolf", "NightTiger", "GhostMafia", "RicoVane", "IronFist", "VoltKral", "SlyRaven"];
  const BONUS_MULTI_VALUES = [2, 3, 5, 8, 10, 12, 15, 20, 25, 50];
  const ICON_PATHS = {
    weed: "./assets/weed.png",
    brain: "./assets/brain.png",
    drink: "./assets/drink.png",
    kick: "./assets/kick.png",
    slap: "./assets/slap.png",
    punch: "./assets/punch.png",
    bonus: "./assets/bonus.png",
  };

  const PVP_SLOT_TEXT = {
    tr: {
      back: "Geri",
      title: "SLOT ARENA",
      subtitle: "{cols}x{rows} tumble PvP • {spins} spin • {bonus} BONUS ile free spin",
      opponent: "Rakip",
      you: "Sen",
      youUpper: "SEN",
      opponentUpper: "RAKIP",
      spin: "Spin",
      resultWon: "KAZANDIN",
      resultLost: "KAYBETTIN",
      resultDefaultReason: "Mac bitti",
      resultPrize: "+{value} YTON",
      resultNoteReward: "Odul backend tarafinda islenir",
      resultNoteNoReward: "YTON odulu backend tarafinda islenir",
      resultNoteLoss: "Bu mac kayip olarak islenir",
      chipBase: "BASE {value}",
      chipSpinTimer: "SPIN SURESI {value}",
      chipTumble: "TUMBLE {value}",
      chipResult: "SONUC",
      chipMultiplier: "TOPLAM CARPAN x{value}",
      opponentThinking: "RAKIP DUSUNUYOR",
      spinButton: "SPIN BASLAT",
      spinButtonTimer: "SPIN BASLAT • {value}",
      rule: "8+ ayni ikon = patlar • BONUS sansi %10 • zincir sansi %30",
      ready: "Hazir",
      slotReadyStatus: "PvP • Slot Arena hazir",
      pvpReadyStatus: "PvP • Hazir",
      slotStartedStatus: "PvP • Slot Arena basladi",
      yourTurnStart: "Siran sende • 3 sn icinde spin baslat",
      opponentStarts: "{name} basliyor",
      spinRequestSent: "Spin istegi gonderildi",
      matchEnded: "Mac sonlandi",
      opponentQuit: "Rakip mactan cikti",
      wonStatus: "PvP • Kazandin",
      lostStatus: "PvP • Kaybettin",
      wonToast: "Kazandin!",
      lostToast: "Kaybettin!",
      bonusTurnLabel: "{owner} BONUS x{value}",
      turnLabel: "{owner}",
      bonusOwnerChip: "{owner} BONUS {value}",
      bonusTurnWindow: "Bonus sende • 3 sn icinde spin baslat",
      opponentMustSpin: "{name} • 3 sn icinde spin atmali",
      timeoutToEnemy: "Sure doldu • sira rakibe gecti",
      opponentTimeout: "Rakip sureyi kacirdi",
      spinningSelf: "Spin atiliyor...",
      spinningEnemy: "{name} spin atiyor...",
      bonusEnded: "BONUS BITTI • x{value} sifirlandi",
      tumbleExploded: "{chain}. tumble • 8+ ikon patladi",
      tumbleBonusCheck: "{chain}. tumble • bonus kontrol",
      tumbleMultiplier: "{chain}. tumble • x{value} carpan",
      tumblePlain: "{chain}. tumble",
      damageToast: "{summary} • {damage} hasar",
      bonusOpened: "BONUS ACILDI! +{spins} spin",
      bonusAwarded: "{owner} bonus aldi",
      emptySpin: "Bos spin",
      opponentEmptySpin: "Rakip bos spin",
      noWin: "Kazanc yok",
      bonusContinue: "{owner} bonus devam",
      yourTurnAgain: "Siran sende • 3 sn icinde spin baslat",
      opponentTurn: "{name} sirada",
      opponentDown: "Rakip dustu",
      youDown: "Sen dustun",
      spinsFinishedHpLead: "Spinler bitti • HP ustunlugu",
      spinsFinishedOpponentLead: "Spinler bitti • Rakip onde",
    },
    en: {
      back: "Back",
      title: "SLOT ARENA",
      subtitle: "{cols}x{rows} tumble PvP • {spins} spins • free spins with {bonus} BONUS",
      opponent: "Opponent",
      you: "You",
      youUpper: "YOU",
      opponentUpper: "OPPONENT",
      spin: "Spin",
      resultWon: "YOU WON",
      resultLost: "YOU LOST",
      resultDefaultReason: "Match ended",
      resultPrize: "+{value} YTON",
      resultNoteReward: "Reward is processed by backend",
      resultNoteNoReward: "YTON reward is processed by backend",
      resultNoteLoss: "This match is recorded as a loss",
      chipBase: "BASE {value}",
      chipSpinTimer: "SPIN TIMER {value}",
      chipTumble: "TUMBLE {value}",
      chipResult: "RESULT",
      chipMultiplier: "TOTAL MULTI x{value}",
      opponentThinking: "OPPONENT THINKING",
      spinButton: "START SPIN",
      spinButtonTimer: "START SPIN • {value}",
      rule: "8+ matching icons explode • BONUS chance 10% • chain chance 30%",
      ready: "Ready",
      slotReadyStatus: "PvP • Slot Arena ready",
      pvpReadyStatus: "PvP • Ready",
      slotStartedStatus: "PvP • Slot Arena started",
      yourTurnStart: "Your turn • start a spin within 3s",
      opponentStarts: "{name} starts",
      spinRequestSent: "Spin request sent",
      matchEnded: "Match ended",
      opponentQuit: "Opponent left the match",
      wonStatus: "PvP • You won",
      lostStatus: "PvP • You lost",
      wonToast: "You won!",
      lostToast: "You lost!",
      bonusTurnLabel: "{owner} BONUS x{value}",
      turnLabel: "{owner}",
      bonusOwnerChip: "{owner} BONUS {value}",
      bonusTurnWindow: "Bonus is yours • start a spin within 3s",
      opponentMustSpin: "{name} • must spin within 3s",
      timeoutToEnemy: "Time up • turn passed to opponent",
      opponentTimeout: "Opponent missed the timer",
      spinningSelf: "Spinning...",
      spinningEnemy: "{name} is spinning...",
      bonusEnded: "BONUS ENDED • x{value} reset",
      tumbleExploded: "{chain}. tumble • 8+ icons exploded",
      tumbleBonusCheck: "{chain}. tumble • bonus check",
      tumbleMultiplier: "{chain}. tumble • x{value} multiplier",
      tumblePlain: "{chain}. tumble",
      damageToast: "{summary} • {damage} damage",
      bonusOpened: "BONUS OPENED! +{spins} spins",
      bonusAwarded: "{owner} got the bonus",
      emptySpin: "Empty spin",
      opponentEmptySpin: "Opponent empty spin",
      noWin: "No win",
      bonusContinue: "{owner} bonus continues",
      yourTurnAgain: "Your turn • start a spin within 3s",
      opponentTurn: "{name} turn",
      opponentDown: "Opponent is down",
      youDown: "You are down",
      spinsFinishedHpLead: "Spins ended • HP advantage",
      spinsFinishedOpponentLead: "Spins ended • Opponent ahead",
    },
  };

  const PVP_SLOT_ICON_LABELS = {
    weed: { tr: "OT", en: "WEED" },
    brain: { tr: "BEYIN", en: "BRAIN" },
    drink: { tr: "ALKOL", en: "ALCOHOL" },
    kick: { tr: "TEKME", en: "KICK" },
    slap: { tr: "TOKAT", en: "SLAP" },
    punch: { tr: "YUMRUK", en: "PUNCH" },
    bonus: { tr: "BONUS", en: "BONUS" },
  };

  function normalizePvpSlotLang(lang) {
    return lang === "en" ? "en" : "tr";
  }

  function getPvpSlotLang() {
    return normalizePvpSlotLang(window.tcStore?.get?.()?.lang);
  }

  function pvpSlotText(key, fallback = "") {
    const code = getPvpSlotLang();
    return PVP_SLOT_TEXT?.[code]?.[key] ?? PVP_SLOT_TEXT?.tr?.[key] ?? fallback ?? key;
  }

  function pvpSlotFormat(key, vars = {}, fallback = "") {
    let text = pvpSlotText(key, fallback);
    Object.entries(vars || {}).forEach(([name, value]) => {
      text = text.replaceAll(`{${name}}`, String(value ?? ""));
    });
    return text;
  }

  function pvpSlotPlayerName() {
    const value = String(window.tcStore?.get?.()?.player?.username || "").trim();
    return value || pvpSlotText("you", "Sen");
  }

  function pvpSlotOpponentName(name = "") {
    const value = String(name || "").trim();
    return value || pvpSlotText("opponent", "Rakip");
  }

  function pvpSlotIconLabel(id, fallback = "") {
    const code = getPvpSlotLang();
    return PVP_SLOT_ICON_LABELS?.[id]?.[code] ?? PVP_SLOT_ICON_LABELS?.[id]?.tr ?? fallback ?? id;
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

  function weightedChoiceFrom(list) {
    const pool = Array.isArray(list) && list.length ? list : PAY_SYMBOLS;
    let total = 0;
    for (const id of pool) total += Number(ICONS[id]?.weight || 1);
    let roll = Math.random() * Math.max(1, total);
    for (const id of pool) {
      roll -= Number(ICONS[id]?.weight || 1);
      if (roll <= 0) return id;
    }
    return pool[pool.length - 1];
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function makeEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
  }

  function createCell(type) {
    const safeType = ICONS[type] ? type : 'punch';
    return { type: safeType };
  }

  function allCoords() {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) out.push({ r, c });
    }
    return out;
  }

  function takeRandom(source, count) {
    const pool = source.slice();
    shuffle(pool);
    const picked = pool.slice(0, Math.max(0, count));
    const pickedSet = new Set(picked.map((p) => `${p.r}:${p.c}`));
    const rest = source.filter((p) => !pickedSet.has(`${p.r}:${p.c}`));
    return { picked, rest };
  }

  function countBoardTotals(board) {
    const counts = Object.fromEntries(PAY_SYMBOLS.map((id) => [id, 0]));
    let bonusCount = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r]?.[c];
        if (!cell) continue;
        if (cell.type === 'bonus') bonusCount += 1;
        else if (counts[cell.type] != null) counts[cell.type] += 1;
      }
    }
    return { counts, bonusCount };
  }

  function chooseSafeSymbol(counts, caps) {
    let candidates = PAY_SYMBOLS.filter((id) => (counts[id] || 0) < Number(caps[id] ?? (MIN_CLUSTER - 1)));
    if (!candidates.length) {
      const minCount = Math.min(...PAY_SYMBOLS.map((id) => counts[id] || 0));
      candidates = PAY_SYMBOLS.filter((id) => (counts[id] || 0) <= minCount);
    }
    return weightedChoiceFrom(candidates);
  }

  function fillBoardWithPlan(board, coords, opts = {}) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const { counts, bonusCount: startBonus } = countBoardTotals(board);
    const caps = Object.fromEntries(PAY_SYMBOLS.map((id) => [id, MIN_CLUSTER - 1]));
    let bonusCount = startBonus;
    let remaining = coords.slice();

    if (options.forceBonus && Number(bonusCount || 0) < BONUS_TRIGGER) {
      const needBonus = Math.max(0, BONUS_TRIGGER - bonusCount);
      if (needBonus > 0 && needBonus <= remaining.length) {
        const { picked, rest } = takeRandom(remaining, needBonus);
        remaining = rest;
        for (const pos of picked) {
          board[pos.r][pos.c] = createCell('bonus');
          bonusCount += 1;
        }
      }
    }

    if (options.forceCluster) {
      const candidates = shuffle(PAY_SYMBOLS.slice()).map((id) => {
        const existing = Number(counts[id] || 0);
        const maxTarget = Math.min(MIN_CLUSTER + 2, existing + remaining.length);
        if (maxTarget < MIN_CLUSTER) return null;
        const target = randInt(MIN_CLUSTER, maxTarget);
        const need = target - existing;
        if (need <= 0 || need > remaining.length) return null;
        return { id, target, need };
      }).filter(Boolean);

      if (candidates.length) {
        const pickedPlan = candidates[0];
        caps[pickedPlan.id] = pickedPlan.target;
        const taken = takeRandom(remaining, pickedPlan.need);
        remaining = taken.rest;
        for (const pos of taken.picked) {
          board[pos.r][pos.c] = createCell(pickedPlan.id);
          counts[pickedPlan.id] = Number(counts[pickedPlan.id] || 0) + 1;
        }
      }
    }

    for (const pos of remaining) {
      const id = chooseSafeSymbol(counts, caps);
      board[pos.r][pos.c] = createCell(id);
      counts[id] = Number(counts[id] || 0) + 1;
    }

    return board;
  }

  function makeBoard(options = {}) {
    const board = makeEmptyBoard();
    return fillBoardWithPlan(board, allCoords(), options);
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
        if (cell.type === 'bonus') {
          bonusCount += 1;
          continue;
        }
        map.set(cell.type, (map.get(cell.type) || 0) + 1);
      }
    }

    return { counts: map, bonusCount };
  }

  function getMultiplierDrop() {
    const count = randInt(1, 2);
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

  function createSpinIntroMap() {
    return Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => ({
        fromRows: 1.75 + Math.random() * 4.25 + (ROWS - r) * 0.08,
        delay: Math.random() * 0.28 + c * 0.012,
      }))
    );
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
      const hitDamage = meta.base * (count * 0.42 + extra * 0.18);
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
          if (cell && cell.type === 'bonus') remove.add(`${r}:${c}`);
        }
      }
    }

    if (inBonus && bonusCount > 0) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = board[r][c];
          if (cell && cell.type === 'bonus') remove.add(`${r}:${c}`);
        }
      }
    }

    return { hits, damage, remove, bonusCount, bonusTriggered, hasAction: remove.size > 0 };
  }

  function tumble(board, removeSet, options = {}) {
    const next = cloneBoard(board);
    const dropMap = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0));

    for (const key of removeSet) {
      const [r, c] = key.split(':').map(Number);
      if (next[r] && next[r][c]) next[r][c] = null;
    }

    const emptyCoords = [];
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
        next[wr][c] = null;
        newCount += 1;
        dropMap[wr][c] = newCount + wr + 1;
        emptyCoords.push({ r: wr, c });
        wr -= 1;
      }
    }

    fillBoardWithPlan(next, emptyCoords, {
      forceCluster: !!options.forceCluster,
      forceBonus: !!options.forceBonus,
    });

    return { board: next, dropMap };
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const tries = [src];
      if (typeof src === "string" && src.startsWith("./assets/")) {
        tries.push(src.replace("./assets/", "./src/assets/"));
      } else if (typeof src === "string" && src.startsWith("./src/assets/")) {
        tries.push(src.replace("./src/assets/", "./assets/"));
      }
      let i = 0;
      const next = () => {
        if (i >= tries.length) return resolve(null);
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => next();
        img.src = tries[i++];
      };
      next();
    });
  }

  function hasActiveDropMap(dropMap) {
    if (!Array.isArray(dropMap)) return false;
    for (const row of dropMap) {
      if (!Array.isArray(row)) continue;
      for (const value of row) {
        if (Number(value || 0) > 0) return true;
      }
    }
    return false;
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

    const rg = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, Math.max(w, h) * 0.55);
    rg.addColorStop(0, meta.color + "bb");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.34, 0, Math.PI * 2);
    ctx.fill();
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

      #arena .tc-slot-result {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(4, 6, 12, 0.48);
        backdrop-filter: blur(6px);
        opacity: 0;
        pointer-events: none;
        transition: opacity .18s ease;
      }

      #arena .tc-slot-result.on {
        opacity: 1;
        pointer-events: auto;
      }

      #arena .tc-slot-result-card {
        width: min(320px, calc(100% - 20px));
        border-radius: 20px;
        padding: 20px 18px;
        text-align: center;
        border: 1px solid rgba(255,255,255,0.16);
        background: linear-gradient(180deg, rgba(24,28,42,0.96), rgba(12,14,24,0.96));
        box-shadow: 0 22px 60px rgba(0,0,0,0.34);
      }

      #arena .tc-slot-result-title {
        font: 900 28px system-ui, Arial;
        letter-spacing: 1.2px;
        color: #fff;
        text-transform: uppercase;
      }

      #arena .tc-slot-result-title.win {
        color: #7dffae;
        text-shadow: 0 0 14px rgba(125,255,174,0.28);
      }

      #arena .tc-slot-result-title.loss {
        color: #ff8282;
        text-shadow: 0 0 14px rgba(255,130,130,0.24);
      }

      #arena .tc-slot-result-reason {
        margin-top: 8px;
        font: 800 13px system-ui, Arial;
        color: rgba(255,255,255,0.78);
      }

      #arena .tc-slot-result-prize {
        margin-top: 14px;
        font: 900 22px system-ui, Arial;
        color: #ffd36f;
      }

      #arena .tc-slot-result-note {
        margin-top: 8px;
        font: 700 11px system-ui, Arial;
        color: rgba(255,255,255,0.62);
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
    const opponentLabel = pvpSlotOpponentName();
    const playerLabel = pvpSlotPlayerName();
    const spinLabel = pvpSlotText("spin", "Spin");
    return `
      <div class="tc-cage-root tc-crush-root">
        <div class="tc-cage-top tc-crush-top">
          <button class="tc-cage-x tc-crush-x" id="tcSlotClose" type="button" aria-label="${pvpSlotText("back", "Geri")}">✕</button>

          <div class="tc-cage-title-wrap tc-crush-title-wrap">
            <div class="tc-cage-neon tc-crush-neon">${pvpSlotText("title", "SLOT ARENA")}</div>
            <div class="tc-cage-sub tc-crush-sub" id="tcSlotSub">${pvpSlotFormat("subtitle", { cols: COLS, rows: ROWS, spins: BASE_SPINS, bonus: BONUS_TRIGGER }, `${COLS}x${ROWS} tumble PvP • ${BASE_SPINS} spin • ${BONUS_TRIGGER} BONUS ile free spin`)}</div>
          </div>
        </div>

        <div class="tc-cage-row tc-crush-row">
          <div class="tc-cage-card tc-crush-card">
            <div class="tc-cage-name tc-crush-name" id="tcSlotEnemyName">${opponentLabel}</div>
            <div class="tc-cage-hpbar tc-crush-hpbar"><div class="tc-cage-hpfill tc-crush-hpfill" id="tcSlotEnemyFill"></div></div>
            <div class="tc-cage-hptext tc-crush-hptext" id="tcSlotEnemyText">1000 / 1000</div>
            <div class="tc-crush-chipline" id="tcSlotEnemySpins">${spinLabel}: ${BASE_SPINS}</div>
          </div>

          <div class="tc-cage-vs tc-crush-vs" id="tcSlotTurn">VS</div>

          <div class="tc-cage-card tc-crush-card">
            <div class="tc-cage-name tc-crush-name" id="tcSlotMeName">${playerLabel}</div>
            <div class="tc-cage-hpbar tc-crush-hpbar"><div class="tc-cage-hpfill tc-crush-hpfill" id="tcSlotMeFill"></div></div>
            <div class="tc-cage-hptext tc-crush-hptext" id="tcSlotMeText">1000 / 1000</div>
            <div class="tc-crush-chipline" id="tcSlotMeSpins">${spinLabel}: ${BASE_SPINS}</div>
          </div>
        </div>

        <div class="tc-cage-stage tc-crush-stage" id="tcSlotStage">
          <canvas class="tc-cage-canvas tc-crush-canvas" id="tcSlotCanvas"></canvas>
          <div class="tc-cage-toast tc-crush-toast" id="tcSlotToast"></div>
                  <div class="tc-slot-result" id="tcSlotResult">
            <div class="tc-slot-result-card">
              <div class="tc-slot-result-title" id="tcSlotResultTitle">${pvpSlotText("resultWon", "KAZANDIN")}</div>
              <div class="tc-slot-result-reason" id="tcSlotResultReason">${pvpSlotText("resultDefaultReason", "Mac bitti")}</div>
              <div class="tc-slot-result-prize" id="tcSlotResultPrize">+0 YTON</div>
              <div class="tc-slot-result-note" id="tcSlotResultNote">${pvpSlotText("resultNoteReward", "Odul backend tarafinda islenir")}</div>
            </div>
          </div>
        </div>

        <div class="tc-slot-footer">
          <div class="tc-slot-meta" id="tcSlotMetaWrap">
            <div class="tc-slot-meta-chip" id="tcSlotChipBase">${pvpSlotFormat("chipBase", { value: BASE_SPINS }, `BASE ${BASE_SPINS}`)}</div>
            <div class="tc-slot-meta-chip" id="tcSlotChipTimer">${pvpSlotFormat("chipSpinTimer", { value: 3 }, `SPIN SURESI 3`)}</div>
            <div class="tc-slot-meta-chip" id="tcSlotChipTumble">${pvpSlotFormat("chipTumble", { value: 0 }, "TUMBLE 0")}</div>
          </div>
          <button class="tc-slot-spinbtn" id="tcSlotSpinBtn" type="button">${pvpSlotText("spinButton", "SPIN BASLAT")}</button>
        </div>

        <div class="tc-cage-rule tc-crush-rule">${pvpSlotText("rule", "8+ ayni ikon = patlar • BONUS sansi %10 • zincir sansi %30")}</div>
      </div>
    `;
  }


  function deepCloneSafe(value) {
    try {
      return value == null ? value : JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function normalizeSeq(n) {
    const num = Number(n || 0);
    return Number.isFinite(num) ? num : 0;
  }

  const api = {
    _els: null,
    _state: null,
    _iconImages: {},
    _running: false,
    _locked: false,
    _raf: 0,
    _opponent: { username: "ShadowWolf", isBot: false },
    _unbind: null,
    _resizeObserver: null,
    _queuedResolve: null,
    _turnTimer: null,
    _toastTimer: null,
    _lastTs: 0,
    _matchCtx: null,
    _matchWatchTimer: null,
    _syncChannel: null,
    _syncHeartbeat: null,
    _syncReady: false,
    _syncSessionId: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    _lastSentSeq: 0,
    _lastAppliedSeq: 0,
    _lastAppliedFingerprint: "",
    _lastSyncTs: 0,
    _resultReported: false,
    onMatchFinished: null,

    _lang() {
      return getPvpSlotLang();
    },

    _text(key, fallback = "") {
      return pvpSlotText(key, fallback);
    },

    _format(key, vars = {}, fallback = "") {
      return pvpSlotFormat(key, vars, fallback);
    },

    _playerName() {
      return pvpSlotPlayerName();
    },

    _opponentName(name = null) {
      return pvpSlotOpponentName(name == null ? this._opponent?.username : name);
    },

    _iconLabel(id, fallback = "") {
      return pvpSlotIconLabel(id, fallback);
    },

    _ownerLabel(side, upper = false) {
      if (side === "me") return this._text(upper ? "youUpper" : "you", upper ? "SEN" : "Sen");
      return this._text(upper ? "opponentUpper" : "opponent", upper ? "RAKIP" : "Rakip");
    },

    _setInfo(key, vars = {}, fallback = "") {
      if (!this._state) return "";
      const text = key ? this._format(key, vars, fallback) : String(fallback || "");
      this._state.infoKey = key || "";
      this._state.infoVars = vars || null;
      this._state.info = text;
      return text;
    },

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
        resultWrap: arena.querySelector("#tcSlotResult"),
        resultTitle: arena.querySelector("#tcSlotResultTitle"),
        resultReason: arena.querySelector("#tcSlotResultReason"),
        resultPrize: arena.querySelector("#tcSlotResultPrize"),
        resultNote: arena.querySelector("#tcSlotResultNote"),
      };

      this._setupState();
      this._bindEvents();
      this._resizeCanvas();
      this._updateHud();
      this._render();
      this._preloadAssets();
    },

    async _preloadAssets() {
      const keys = Object.keys(ICON_PATHS);
      const out = {};
      await Promise.all(keys.map(async (key) => {
        out[key] = await loadImage(ICON_PATHS[key]);
      }));
      this._iconImages = out;
      if (this._state) this._state.imageReady = true;
      this._render();
    },

    _setupState() {
      const startsAsMe = this._matchCtx?.amIPlayer1 !== false;
      this._state = {
        board: makeBoard(),
        meHp: START_HP,
        enemyHp: START_HP,
        meSpins: BASE_SPINS,
        enemySpins: BASE_SPINS,
        turn: startsAsMe ? "me" : "enemy",
        finished: false,
        spinning: false,
        inBonus: false,
        bonusOwner: null,
        bonusSpinsLeft: 0,
        bonusMultiplierBank: 0,
        displayedMultiplier: 0,
        multipliers: [],
        tumbleIndex: 0,
        info: "",
        infoKey: "ready",
        infoVars: null,
        fxHits: [],
        flashUntil: 0,
        shakeUntil: 0,
        spinOffset: 0,
        dropMap: Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0)),
        dropProgress: 1,
        markedRemove: new Set(),
        decisionEndsAt: 0,
        imageReady: !!this._iconImages,
        spinIntroMap: null,
        spinIntroProgress: 1,
        result: null,
        resultReason: "",
        resultReasonKey: "",
        resultReasonVars: null,
      };
      this._setInfo("ready", {}, this._text("ready", "Hazir"));
    },

    setOpponent(opp) {
      this._opponent = opp && opp.username ? { ...opp } : { username: choice(BOT_NAMES), isBot: false };
      if (this._els?.enemyName) this._els.enemyName.textContent = this._opponentName();
      this._render();
    },

    setMatchContext(ctx) {
      this._matchCtx = ctx && typeof ctx === "object" ? { ...ctx } : null;
      if (this._running) {
        this._beginMatchWatch();
        this._setupSync();
      }
    },

    _getRealtimeClient() {
      return window.tcSupabase || window.supabase || null;
    },

    _isOnlineMatch() {
      const ctx = this._matchCtx || {};
      return !!(ctx.matchId && ctx.userId && !ctx.isBotMatch && ctx.player1Id && ctx.player2Id && this._getRealtimeClient());
    },

    _isAuthoritativePeer() {
      return !!(this._isOnlineMatch() && this._matchCtx?.amIPlayer1);
    },

    _mySideKey() {
      return this._matchCtx?.amIPlayer1 ? "p1" : "p2";
    },

    _localTurnSide() {
      return this._state?.turn === "me" ? this._mySideKey() : (this._mySideKey() === "p1" ? "p2" : "p1");
    },

    _clearSync() {
      clearInterval(this._syncHeartbeat);
      this._syncHeartbeat = null;
      this._syncReady = false;
      try { this._syncChannel?.unsubscribe?.(); } catch (_) {}
      this._syncChannel = null;
    },

    _broadcast(event, payload = {}) {
      try {
        if (!this._syncChannel || !this._syncReady) return false;
        this._syncChannel.send({
          type: "broadcast",
          event,
          payload: {
            ...payload,
            matchId: this._matchCtx?.matchId || null,
            senderId: this._matchCtx?.userId || null,
            sessionId: this._syncSessionId,
            sentAt: Date.now(),
          },
        });
        return true;
      } catch (_) {
        return false;
      }
    },
    _buildCanonicalSnapshot(reason = "sync") {
      const s = this._state;
      if (!s) return null;
      this._lastSentSeq = normalizeSeq(this._lastSentSeq) + 1;
      const zeroMap = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0));
      return {
        seq: this._lastSentSeq,
        reason,
        board: cloneBoard(s.board || makeBoard()),
        p1Hp: Number(s.meHp || 0),
        p2Hp: Number(s.enemyHp || 0),
        p1Spins: Number(s.meSpins || 0),
        p2Spins: Number(s.enemySpins || 0),
        turnOwner: s.turn === "me" ? "p1" : "p2",
        finished: !!s.finished,
        spinning: !!s.spinning,
        inBonus: !!s.inBonus,
        bonusOwner: s.bonusOwner === "me" ? "p1" : s.bonusOwner === "enemy" ? "p2" : null,
        bonusSpinsLeft: Number(s.bonusSpinsLeft || 0),
        bonusMultiplierBank: Number(s.bonusMultiplierBank || 0),
        displayedMultiplier: Number(s.displayedMultiplier || 0),
        multipliers: deepCloneSafe(s.multipliers || []),
        tumbleIndex: Number(s.tumbleIndex || 0),
        info: String(s.info || ""),
        infoKey: String(s.infoKey || ""),
        infoVars: deepCloneSafe(s.infoVars || null),
        decisionEndsAt: Number(s.decisionEndsAt || 0),
        markedRemove: Array.from(s.markedRemove || []),
        dropMap: deepCloneSafe(s.dropMap || zeroMap),
        dropProgress: Number(s.dropProgress ?? 1),
        spinIntroMap: deepCloneSafe(s.spinIntroMap || null),
        spinIntroProgress: Number(s.spinIntroProgress ?? 1),
        resultReason: String(s.resultReason || ""),
        resultReasonKey: String(s.resultReasonKey || ""),
        resultReasonVars: deepCloneSafe(s.resultReasonVars || null),
        winnerSide: s.finished ? (s.enemyHp <= 0 || (s.meHp >= s.enemyHp && s.meSpins <= 0 && s.enemySpins <= 0) ? "p1" : "p2") : null,
      };
    },

    _snapshotFingerprint(snapshot) {
      if (!snapshot) return "";
      try {
        return JSON.stringify({
          reason: String(snapshot.reason || ""),
          board: snapshot.board || null,
          p1Hp: Number(snapshot.p1Hp || 0),
          p2Hp: Number(snapshot.p2Hp || 0),
          p1Spins: Number(snapshot.p1Spins || 0),
          p2Spins: Number(snapshot.p2Spins || 0),
          turnOwner: String(snapshot.turnOwner || ""),
          finished: !!snapshot.finished,
          spinning: !!snapshot.spinning,
          inBonus: !!snapshot.inBonus,
          bonusOwner: snapshot.bonusOwner || null,
          bonusSpinsLeft: Number(snapshot.bonusSpinsLeft || 0),
          bonusMultiplierBank: Number(snapshot.bonusMultiplierBank || 0),
          displayedMultiplier: Number(snapshot.displayedMultiplier || 0),
          tumbleIndex: Number(snapshot.tumbleIndex || 0),
          infoKey: String(snapshot.infoKey || ""),
          info: String(snapshot.info || ""),
          decisionEndsAt: Number(snapshot.decisionEndsAt || 0),
          resultReasonKey: String(snapshot.resultReasonKey || ""),
          winnerSide: snapshot.winnerSide || null,
        });
      } catch (_) {
        return "";
      }
    },

    _broadcastState(reason = "sync") {
      if (!this._isAuthoritativePeer()) return false;
      const snapshot = this._buildCanonicalSnapshot(reason);
      if (!snapshot) return false;
      this._lastSyncTs = Date.now();
      return this._broadcast("state", { snapshot });
    },
    _applyCanonicalSnapshot(snapshot, opts = {}) {
      if (!snapshot || !this._state) return;
      const seq = normalizeSeq(snapshot.seq);
      if (!opts.force && seq && seq <= normalizeSeq(this._lastAppliedSeq)) return;
      if (seq) this._lastAppliedSeq = seq;
      this._lastSyncTs = Date.now();
      const passiveSync = snapshot.reason === "heartbeat" || snapshot.reason === "sync_reply";
      if (!opts.force && !this._isAuthoritativePeer() && passiveSync && !snapshot.finished && (this._remoteSpinAnimating || this._remoteDropAnimating)) {
        return;
      }
      const fingerprint = this._snapshotFingerprint(snapshot);
      if (!opts.force && !this._isAuthoritativePeer() && passiveSync && fingerprint && fingerprint === this._lastAppliedFingerprint) {
        return;
      }
      this._lastAppliedFingerprint = fingerprint;

      const amIPlayer1 = !!this._matchCtx?.amIPlayer1;
      const mySide = amIPlayer1 ? "p1" : "p2";
      const enemySide = amIPlayer1 ? "p2" : "p1";
      const s = this._state;

      s.board = cloneBoard(snapshot.board || makeBoard());
      s.meHp = Number(snapshot[`${mySide}Hp`] ?? START_HP);
      s.enemyHp = Number(snapshot[`${enemySide}Hp`] ?? START_HP);
      s.meSpins = Number(snapshot[`${mySide}Spins`] ?? BASE_SPINS);
      s.enemySpins = Number(snapshot[`${enemySide}Spins`] ?? BASE_SPINS);
      s.turn = snapshot.turnOwner === mySide ? "me" : "enemy";
      const incomingFinished = !!snapshot.finished;
      s.finished = incomingFinished && !!opts.silentFinish;
      s.spinning = !!snapshot.spinning;
      s.inBonus = !!snapshot.inBonus;
      s.bonusOwner = snapshot.bonusOwner === mySide ? "me" : snapshot.bonusOwner === enemySide ? "enemy" : null;
      s.bonusSpinsLeft = Number(snapshot.bonusSpinsLeft || 0);
      s.bonusMultiplierBank = Number(snapshot.bonusMultiplierBank || 0);
      s.displayedMultiplier = Number(snapshot.displayedMultiplier || 0);
      s.multipliers = deepCloneSafe(snapshot.multipliers || []);
      s.tumbleIndex = Number(snapshot.tumbleIndex || 0);
      s.infoKey = String(snapshot.infoKey || "");
      s.infoVars = snapshot.infoVars || null;
      s.info = s.infoKey
        ? this._format(s.infoKey, s.infoVars || {}, String(snapshot.info || ""))
        : String(snapshot.info || (s.turn === "me"
          ? this._format("yourTurnAgain", {}, "Siran sende • 3 sn icinde spin baslat")
          : this._format("opponentTurn", { name: this._opponentName() }, `${this._opponentName()} sirada`)));
      s.decisionEndsAt = Number(snapshot.decisionEndsAt || 0);
      s.markedRemove = new Set(snapshot.markedRemove || []);
      s.dropMap = deepCloneSafe(snapshot.dropMap || Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0)));
      s.dropProgress = Number(snapshot.dropProgress ?? 1);
      s.spinIntroMap = deepCloneSafe(snapshot.spinIntroMap || null);
      s.spinIntroProgress = Number(snapshot.spinIntroProgress ?? 1);
      s.resultReason = String(snapshot.resultReason || "");
      s.resultReasonKey = String(snapshot.resultReasonKey || "");
      s.resultReasonVars = snapshot.resultReasonVars || null;

      if (!this._isAuthoritativePeer() && snapshot.reason === "tumble_hit") {
        const actorLocal = snapshot.turnOwner === mySide ? "me" : "enemy";
        const res = evaluateBoard(s.board, s.inBonus && s.bonusOwner === s.turn);
        if (res?.remove?.size) s.markedRemove = new Set(res.remove);
        if (res?.damage > 0) this._spawnHitFx(res.hits, actorLocal === "me");
      }

      if (!this._isAuthoritativePeer() && snapshot.reason === "roll_ready" && s.spinIntroMap) {
        this._playRemoteSpinIntro();
      }

      if (!this._isAuthoritativePeer() && snapshot.reason === "tumble_drop" && hasActiveDropMap(s.dropMap)) {
        this._playRemoteDrop(s.dropMap);
      }

      this._updateHud();
      this._render();

      if (snapshot.finished && !opts.silentFinish) {
        const didWin = String(snapshot.winnerSide || "") === mySide;
        this._finish(
          didWin,
          snapshot.resultReason || snapshot.info || this._text("matchEnded", "Mac sonlandi"),
          {
            notify: true,
            reasonKey: snapshot.resultReasonKey || "",
            reasonVars: snapshot.resultReasonVars || null,
          }
        );
      }
    },

    _handleSyncBroadcast(payload) {
      const snapshot = payload?.snapshot || null;
      if (!snapshot) return;
      if (this._isAuthoritativePeer()) return;
      this._applyCanonicalSnapshot(snapshot);
    },

    _handleSpinRequestBroadcast(payload) {
      if (!this._isAuthoritativePeer() || !this._running || !this._state || this._state.finished || this._state.spinning) return;
      const side = String(payload?.side || "");
      const expected = this._state.turn === "me" ? "p1" : "p2";
      if (!side || side !== expected) return;
      clearTimeout(this._turnTimer);
      this._turnTimer = null;
      this._spinCurrentTurn().catch?.(() => {});
    },

    _handleSyncRequestBroadcast() {
      if (!this._isAuthoritativePeer()) return;
      this._broadcastState("sync_reply");
    },

    _setupSync() {
      this._clearSync();
      if (!this._isOnlineMatch()) return;
      const sb = this._getRealtimeClient();
      if (!sb?.channel) return;
      const channelName = `toncrime-slot-sync-${this._matchCtx.matchId}`;
      this._syncChannel = sb
        .channel(channelName, { config: { broadcast: { self: false, ack: false } } })
        .on("broadcast", { event: "state" }, ({ payload }) => this._handleSyncBroadcast(payload))
        .on("broadcast", { event: "spin_request" }, ({ payload }) => this._handleSpinRequestBroadcast(payload))
        .on("broadcast", { event: "sync_request" }, ({ payload }) => this._handleSyncRequestBroadcast(payload))
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          this._syncReady = true;
          if (this._isAuthoritativePeer()) {
            this._broadcastState("initial");
            clearInterval(this._syncHeartbeat);
            this._syncHeartbeat = setInterval(() => {
              if (!this._running || this._state?.finished) return;
              this._broadcastState("heartbeat");
            }, SYNC_HEARTBEAT_MS);
          } else {
            this._broadcast("sync_request", { want: "state" });
          }
        });
    },

    resolveOpponentQuit() {
      if (!this._state || this._state.finished) return;
      this._finish(true, this._text("opponentQuit", "Rakip mactan cikti"), { notify: true, reasonKey: "opponentQuit" });
    },

    reset() {
      this.stop();
      if (!this._els) return;
      this._resultReported = false;
      this._lastSentSeq = 0;
      this._lastAppliedSeq = 0;
      this._lastAppliedFingerprint = "";
      this._setupState();
      this._hideResultOverlay();
      this._updateHud();
      this._setStatus(this._text("slotReadyStatus", "PvP • Slot Arena hazir"));
      this._toast(this._text("ready", "Hazir"));
      this._render();
    },

    start() {
      if (!this._els || !this._state) return;
      if (this._running) return;
      this._running = true;
      this._locked = false;
      if (this._els.meName) this._els.meName.textContent = this._playerName();
      if (this._els.enemyName) this._els.enemyName.textContent = this._opponentName();
      this._setStatus(this._text("slotStartedStatus", "PvP • Slot Arena basladi"));
      if (this._state.turn === "me") {
        this._setInfo("yourTurnStart", {}, this._text("yourTurnStart", "Siran sende • 3 sn icinde spin baslat"));
      } else {
        this._setInfo("opponentStarts", { name: this._opponentName() }, `${this._opponentName()} basliyor`);
      }
      this._hideResultOverlay();
      this._beginMatchWatch();
      this._setupSync();
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
      this._stopMatchWatch();
      this._clearSync();
    },

    _bindEvents() {
      if (!this._els) return;

      const onClose = () => {
        const shouldReportLoss = !!(this._state && !this._state.finished);
        if (shouldReportLoss && typeof this.onMatchFinished === "function" && !this._resultReported) {
          this._resultReported = true;
          try { this.onMatchFinished(false, { reason: "quit" }); } catch (_) {}
        }
        this.stop();
        try {
          const arena = document.getElementById("arena");
          const wrap = document.getElementById("pvpWrap");
          const status = document.getElementById("pvpStatus");
          const opponent = document.getElementById("pvpOpponent");
          const spinner = document.getElementById("pvpSpinner");
          if (arena) arena.innerHTML = "";
          if (wrap) {
            wrap.classList.remove("open");
            wrap.style.display = "none";
          }
          if (status) status.textContent = this._text("pvpReadyStatus", "PvP • Hazir");
          if (opponent) opponent.textContent = "—";
          if (spinner) spinner.classList.add("hidden");
        } catch (_) {}
      };

      const onSpin = async () => {
        if (!this._running || !this._state || this._state.turn !== "me" || this._state.spinning || this._state.finished) return;
        clearTimeout(this._turnTimer);
        this._turnTimer = null;
        if (this._isOnlineMatch() && !this._isAuthoritativePeer()) {
          this._broadcast("spin_request", { side: this._mySideKey() });
          this._toast(this._text("spinRequestSent", "Spin istegi gonderildi"), 650);
          return;
        }
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

    _playRemoteSpinIntro() {
      if (this._remoteSpinAnimating || !this._state?.spinIntroMap) return;
      this._remoteSpinAnimating = true;
      this._spinAnimation().finally(() => {
        this._remoteSpinAnimating = false;
        if (!this._state) return;
        this._state.spinIntroMap = null;
        this._state.spinIntroProgress = 1;
        this._render();
      });
    },

    _playRemoteDrop(dropMap) {
      if (this._remoteDropAnimating || !hasActiveDropMap(dropMap)) return;
      this._remoteDropAnimating = true;
      this._animateDrop(dropMap).finally(() => {
        this._remoteDropAnimating = false;
      });
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

    _vibrate(pattern = 40) {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(pattern);
        }
      } catch (_) {}
    },

    _estimatePrizeYton(win) {
      if (!win) return 0;
      const ctxPrize = Number(this._matchCtx?.prizeYton || 0);
      if (ctxPrize > 0) return ctxPrize;
      try {
        const state = window.tcStore?.get?.() || {};
        const stake = Number(state?.pvp?.entryStake || 0);
        return stake > 0 ? stake : 0;
      } catch (_) {
        return 0;
      }
    },

    _hideResultOverlay() {
      if (!this._els?.resultWrap) return;
      this._els.resultWrap.classList.remove("on");
    },

    _showResultOverlay(win, reason) {
      if (!this._els?.resultWrap) return;
      const prize = this._estimatePrizeYton(win);
      if (this._els.resultTitle) {
        this._els.resultTitle.textContent = win ? this._text("resultWon", "KAZANDIN") : this._text("resultLost", "KAYBETTIN");
        this._els.resultTitle.classList.remove("win", "loss");
        this._els.resultTitle.classList.add(win ? "win" : "loss");
      }
      if (this._els.resultReason) this._els.resultReason.textContent = String(reason || this._text("resultDefaultReason", "Mac bitti"));
      if (this._els.resultPrize) this._els.resultPrize.textContent = win ? this._format("resultPrize", { value: Math.max(0, Math.round(prize)) }, `+${Math.max(0, Math.round(prize))} YTON`) : "+0 YTON";
      if (this._els.resultNote) this._els.resultNote.textContent = win
        ? (prize > 0 ? this._text("resultNoteReward", "Odul backend tarafinda islenir") : this._text("resultNoteNoReward", "YTON odulu backend tarafinda islenir"))
        : this._text("resultNoteLoss", "Bu mac kayip olarak islenir");
      this._els.resultWrap.classList.add("on");
    },

    _stopMatchWatch() {
      clearInterval(this._matchWatchTimer);
      this._matchWatchTimer = null;
    },

    _beginMatchWatch() {
      this._stopMatchWatch();
      const matchId = this._matchCtx?.matchId;
      if (!matchId || !this._getRealtimeClient()) return;
      this._matchWatchTimer = setInterval(() => {
        this._pollMatchStateOnce().catch?.(() => {});
      }, MATCH_WATCH_MS);
    },

    async _pollMatchStateOnce() {
      const sb = this._getRealtimeClient();
      if (!this._matchCtx?.matchId || !sb || this._state?.finished) return;
      const { data } = await sb
        .from("pvp_matches")
        .select("id,status,winner_user_id,player1_id,player2_id")
        .eq("id", this._matchCtx.matchId)
        .maybeSingle();
      if (!data) return;
      const myId = String(this._matchCtx?.userId || "");
      const winnerId = String(data?.winner_user_id || "");
      if (winnerId) {
        const didWin = myId && winnerId === myId;
        this._finish(!!didWin, this._text("matchEnded", "Mac sonlandi"), { notify: !!didWin, reasonKey: "matchEnded" });
        return;
      }
      const status = String(data?.status || "").toLowerCase();
      if ((status === "cancelled" || status === "canceled") && !this._state?.finished) {
        this._finish(true, this._text("opponentQuit", "Rakip mactan cikti"), { notify: false, reasonKey: "opponentQuit" });
      }
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
      const spinLabel = this._text("spin", "Spin");
      const meSpinTxt = `${spinLabel}: ${s.meSpins}${s.inBonus && s.bonusOwner === "me" ? ` • BONUS ${s.bonusSpinsLeft}` : ""}`;
      const enemySpinTxt = `${spinLabel}: ${s.enemySpins}${s.inBonus && s.bonusOwner === "enemy" ? ` • BONUS ${s.bonusSpinsLeft}` : ""}`;

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
        ? this._format("bonusTurnLabel", { owner: this._ownerLabel(s.turn, true), value: Math.max(0, Math.round(s.displayedMultiplier || 0)) }, `${this._ownerLabel(s.turn, true)} BONUS x${Math.max(0, Math.round(s.displayedMultiplier || 0))}`)
        : this._format("turnLabel", { owner: this._ownerLabel(s.turn, true) }, this._ownerLabel(s.turn, true));
      this._els.sub.textContent = s.info;

      const chipBase = s.inBonus
        ? this._format("bonusOwnerChip", { owner: this._ownerLabel(s.bonusOwner, true), value: s.bonusSpinsLeft }, `${this._ownerLabel(s.bonusOwner, true)} BONUS ${s.bonusSpinsLeft}`)
        : this._format("chipBase", { value: Math.max(s.meSpins, s.enemySpins) }, `BASE ${Math.max(s.meSpins, s.enemySpins)}`);
      const chipTimer = s.turn === "me" && !s.spinning && !s.finished
        ? this._format("chipSpinTimer", { value: countdown }, `SPIN SURESI ${countdown}`)
        : s.turn === "enemy" && !s.finished
        ? this._text("opponentThinking", "RAKIP DUSUNUYOR")
        : this._text("chipResult", "SONUC");
      const chipTumble = s.inBonus
        ? this._format("chipMultiplier", { value: Math.max(0, s.bonusMultiplierBank) }, `TOPLAM CARPAN x${Math.max(0, s.bonusMultiplierBank)}`)
        : this._format("chipTumble", { value: Math.max(0, s.tumbleIndex) }, `TUMBLE ${Math.max(0, s.tumbleIndex)}`);

      if (this._els.chipBase) this._els.chipBase.textContent = chipBase;
      if (this._els.chipTimer) this._els.chipTimer.textContent = chipTimer;
      if (this._els.chipTumble) this._els.chipTumble.textContent = chipTumble;

      if (this._els.spinBtn) {
        const show = s.turn === "me" && !s.spinning && !s.finished;
        this._els.spinBtn.style.visibility = show ? "visible" : "hidden";
        this._els.spinBtn.disabled = !show;
        this._els.spinBtn.textContent = show
          ? (countdown > 0
            ? this._format("spinButtonTimer", { value: countdown }, `SPIN BASLAT • ${countdown}`)
            : this._text("spinButton", "SPIN BASLAT"))
          : this._text("spinButton", "SPIN BASLAT");
      }
    },

    _startTurnWindow() {
      const s = this._state;
      if (!s || s.finished || s.spinning) return;
      clearTimeout(this._turnTimer);

      if (this._isOnlineMatch()) {
        if (!this._isAuthoritativePeer()) {
          this._updateHud();
          this._render();
          return;
        }
        s.decisionEndsAt = Date.now() + PLAYER_DECISION_MS;
        if (s.turn === "me") {
          this._setInfo(
            s.inBonus && s.bonusOwner === "me" ? "bonusTurnWindow" : "yourTurnStart",
            {},
            s.inBonus && s.bonusOwner === "me" ? "Bonus sende • 3 sn icinde spin baslat" : "Siran sende • 3 sn icinde spin baslat"
          );
        } else {
          this._setInfo("opponentMustSpin", { name: this._opponentName() }, `${this._opponentName()} • 3 sn icinde spin atmali`);
        }
        this._updateHud();
        this._render();
        this._broadcastState("turn_window");
        this._turnTimer = setTimeout(() => {
          if (!this._running || !this._state || this._state.spinning || this._state.finished) return;
          this._toast(this._state.turn === "me" ? this._text("timeoutToEnemy", "Sure doldu • sira rakibe gecti") : this._text("opponentTimeout", "Rakip sureyi kacirdi"), 950);
          this._advanceTurn(true);
        }, PLAYER_DECISION_MS + 40);
        return;
      }

      if (s.turn === "me") {
        s.decisionEndsAt = Date.now() + PLAYER_DECISION_MS;
        this._setInfo(
          s.inBonus && s.bonusOwner === "me" ? "bonusTurnWindow" : "yourTurnStart",
          {},
          s.inBonus && s.bonusOwner === "me" ? "Bonus sende • 3 sn icinde spin baslat" : "Siran sende • 3 sn icinde spin baslat"
        );
        this._updateHud();
        this._render();
        this._turnTimer = setTimeout(() => {
          if (!this._running || !this._state || this._state.turn !== "me" || this._state.spinning || this._state.finished) return;
          this._toast(this._text("timeoutToEnemy", "Sure doldu • sira rakibe gecti"), 950);
          this._advanceTurn(true);
        }, PLAYER_DECISION_MS + 40);
      } else {
        s.decisionEndsAt = 0;
        this._queueAutoTurn(900);
      }
    },

    _queueAutoTurn(delay = 750) {
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
      if (actor === "me") this._setInfo("spinningSelf", {}, "Spin atiliyor...");
      else this._setInfo("spinningEnemy", { name: this._opponentName() }, `${this._opponentName()} spin atiyor...`);
      this._updateHud();
      this._render();
      if (this._isAuthoritativePeer()) this._broadcastState("spin_start");

      const inOwnedBonus = s.inBonus && s.bonusOwner === actor;
      const rollBonus = !inOwnedBonus && Math.random() < BONUS_CHANCE;
      const rollWin = !rollBonus && Math.random() < (inOwnedBonus ? BONUS_MODE_EXPLODE_CHANCE : SPIN_EXPLODE_CHANCE);

      s.board = makeBoard({
        forceBonus: rollBonus,
        forceCluster: rollWin,
      });
      s.spinIntroMap = createSpinIntroMap();
      s.spinIntroProgress = 0;
      if (this._isAuthoritativePeer()) this._broadcastState("roll_ready");
      await this._spinAnimation();
      s.spinIntroMap = null;
      s.spinIntroProgress = 1;

      if (s.inBonus && s.bonusOwner === actor) {
        s.bonusSpinsLeft = Math.max(0, s.bonusSpinsLeft - 1);
      } else if (actor === "me") {
        s.meSpins = Math.max(0, s.meSpins - 1);
      } else {
        s.enemySpins = Math.max(0, s.enemySpins - 1);
      }

      await this._resolveTumbles(actor);

      if (s.inBonus && s.bonusOwner === actor && s.bonusSpinsLeft <= 0) {
        this._setInfo("bonusEnded", { value: Math.max(1, s.bonusMultiplierBank) }, `BONUS BITTI • x${Math.max(1, s.bonusMultiplierBank)} sifirlandi`);
        s.inBonus = false;
        s.bonusOwner = null;
        s.bonusMultiplierBank = 0;
        s.displayedMultiplier = 0;
        s.multipliers = [];
        await new Promise((r) => setTimeout(r, 950));
      }

      s.spinning = false;
      s.markedRemove = new Set();
      s.dropMap = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => 0));
      s.dropProgress = 1;
      this._updateHud();
      this._render();
      if (this._isAuthoritativePeer()) this._broadcastState("spin_end");

      if (!this._checkFinish()) {
        this._advanceTurn();
      }
    },

    async _spinAnimation() {
      const s = this._state;
      const start = performance.now();
      const duration = 980 + FLOW_EXTRA_MS;

      return new Promise((resolve) => {
        const frame = (ts) => {
          if (!this._state || !this._running) return resolve();
          const t = clamp((ts - start) / duration, 0, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          s.spinIntroProgress = ease;
          this._render();
          if (t >= 1) {
            s.spinIntroProgress = 1;
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
      const duration = 520;

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
        this._setInfo(
          res.damage > 0 ? "tumbleExploded" : "tumbleBonusCheck",
          { chain },
          res.damage > 0 ? `${chain}. tumble • 8+ ikon patladi` : `${chain}. tumble • bonus kontrol`
        );
        this._render();
        await new Promise((r) => setTimeout(r, 560));

        if (res.damage > 0) {
          let hitDamage = res.damage;
          if (s.inBonus && s.bonusOwner === actor) {
            const drops = getMultiplierDrop();
            s.multipliers = drops;
            const addMulti = drops.reduce((sum, d) => sum + d.value, 0);
            s.bonusMultiplierBank = Math.min(20, s.bonusMultiplierBank + addMulti);
            s.displayedMultiplier = s.bonusMultiplierBank;
            hitDamage *= Math.max(1, s.bonusMultiplierBank);
            this._setInfo("tumbleMultiplier", { chain, value: s.bonusMultiplierBank }, `${chain}. tumble • x${s.bonusMultiplierBank} carpan`);
          } else {
            this._setInfo("tumblePlain", { chain }, `${chain}. tumble`);
          }
          totalDamage += hitDamage;
          this._applyDamage(actor === "me" ? "enemy" : "me", hitDamage);
          this._spawnHitFx(res.hits, actor === "me");
          this._vibrate(chain > 1 ? [60, 35, 60] : [45]);
          this._toast(this._format("damageToast", { summary: this._hitSummary(res.hits), damage: Math.round(hitDamage) }, `${this._hitSummary(res.hits)} • ${Math.round(hitDamage)} hasar`), 900);
        }

        if (res.bonusTriggered) {
          s.inBonus = true;
          s.bonusOwner = actor;
          s.bonusSpinsLeft += BONUS_SPINS;
          s.bonusMultiplierBank = 0;
          s.displayedMultiplier = 0;
          s.multipliers = [];
          bonusJustStarted = true;
          this._toast(`⭐ ${this._format("bonusOpened", { spins: BONUS_SPINS }, `BONUS ACILDI! +${BONUS_SPINS} spin`)}`, 1400);
          this._setInfo("bonusAwarded", { owner: this._ownerLabel(actor, false) }, `${this._ownerLabel(actor, false)} bonus aldi`);
        }

        if (this._isAuthoritativePeer()) this._broadcastState("tumble_hit");
        await new Promise((r) => setTimeout(r, 260));
        const tum = tumble(s.board, res.remove, {
          forceCluster: Math.random() < CHAIN_CONTINUE_CHANCE,
          forceBonus: false,
        });
        s.markedRemove = new Set();
        s.board = tum.board;
        s.dropMap = tum.dropMap;
        s.dropProgress = 0;
        if (this._isAuthoritativePeer()) this._broadcastState("tumble_drop");
        await this._animateDrop(tum.dropMap);
        await new Promise((r) => setTimeout(r, 190));
        if (this._checkFinish()) return;
      }

      if (totalDamage <= 0 && !bonusJustStarted) {
        this._setInfo(s.turn === "me" ? "emptySpin" : "opponentEmptySpin", {}, s.turn === "me" ? "Bos spin" : "Rakip bos spin");
        this._toast(this._text("noWin", "Kazanc yok"), 700);
      }
      s.markedRemove = new Set();
    },

    _hitSummary(hits) {
      if (!hits || !hits.length) return this._text("noWin", "Kazanc yok");
      return hits.slice(0, 2).map((h) => `${this._iconLabel(h.type, ICONS[h.type].label)} x${h.count}`).join(" + ");
    },

    _spawnHitFx(hits, fromMe) {
      const now = performance.now();
      for (const h of hits) {
        const meta = ICONS[h.type];
        this._state.fxHits.push({
          text: `${this._iconLabel(h.type, meta.label)} • ${Math.round(h.damage)}`,
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
      this._stopMatchWatch();
      clearTimeout(this._queuedResolve);
      this._queuedResolve = null;

      if (!skipped && s.inBonus && s.bonusOwner === s.turn && s.bonusSpinsLeft > 0) {
        this._setInfo("bonusContinue", { owner: this._ownerLabel(s.turn, false) }, `${this._ownerLabel(s.turn, false)} bonus devam`);
        this._startTurnWindow();
        return;
      }

      s.turn = s.turn === "me" ? "enemy" : "me";
      if (s.turn === "me") this._setInfo("yourTurnAgain", {}, "Siran sende • 3 sn icinde spin baslat");
      else this._setInfo("opponentTurn", { name: this._opponentName() }, `${this._opponentName()} sirada`);
      this._updateHud();
      this._render();
      if (this._isAuthoritativePeer()) this._broadcastState(skipped ? "turn_skip" : "turn_advance");
      this._checkFinish();
      if (!s.finished) this._startTurnWindow();
    },

    _checkFinish() {
      const s = this._state;
      if (!s || s.finished) return true;

      if (s.enemyHp <= 0) return this._finish(true, this._text("opponentDown", "Rakip dustu"), { reasonKey: "opponentDown" });
      if (s.meHp <= 0) return this._finish(false, this._text("youDown", "Sen dustun"), { reasonKey: "youDown" });

      const meDone = s.meSpins <= 0 && (!s.inBonus || s.bonusOwner !== "me" || s.bonusSpinsLeft <= 0);
      const enemyDone = s.enemySpins <= 0 && (!s.inBonus || s.bonusOwner !== "enemy" || s.bonusSpinsLeft <= 0);

      if (meDone && enemyDone && !s.spinning) {
        if (s.meHp >= s.enemyHp) return this._finish(true, this._text("spinsFinishedHpLead", "Spinler bitti • HP ustunlugu"), { reasonKey: "spinsFinishedHpLead" });
        return this._finish(false, this._text("spinsFinishedOpponentLead", "Spinler bitti • Rakip onde"), { reasonKey: "spinsFinishedOpponentLead" });
      }
      return false;
    },

    _finish(win, reason, opts = {}) {
      const s = this._state;
      if (!s || s.finished) return true;
      const finalReason = opts.reasonKey
        ? this._format(opts.reasonKey, opts.reasonVars || {}, reason || "")
        : String(reason || (win ? this._text("wonToast", "Kazandin!") : this._text("lostToast", "Kaybettin!")));
      s.finished = true;
      s.spinning = false;
      s.decisionEndsAt = 0;
      s.resultReasonKey = String(opts.reasonKey || "");
      s.resultReasonVars = opts.reasonVars || null;
      s.resultReason = finalReason;
      this._running = false;
      this._locked = true;
      clearTimeout(this._turnTimer);
      clearTimeout(this._queuedResolve);
      this._stopMatchWatch();
      this._setStatus(win ? this._text("wonStatus", "PvP • Kazandin") : this._text("lostStatus", "PvP • Kaybettin"));
      this._setInfo("", null, finalReason);
      this._toast(win ? this._text("wonToast", "Kazandin!") : this._text("lostToast", "Kaybettin!"), 1200);
      this._showResultOverlay(!!win, finalReason);
      this._recordResult(win);
      if (this._isAuthoritativePeer()) this._broadcastState("finish");
      if (!this._resultReported && typeof this.onMatchFinished === "function" && opts.notify !== false) {
        this._resultReported = true;
        try { this.onMatchFinished(!!win, { reason: finalReason || "finish" }); } catch (_) {}
      }
      this._updateHud();
      this._render();
      return true;
    },

    _recordResult(win) {
      const store = window.tcStore;
      const now = Date.now();
      const opponent = this._opponentName();
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
      const flashPulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.02);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const px = x + c * (cellW + gap);
          const extraRows = s.dropMap?.[r]?.[c] || 0;
          const dropPx = extraRows > 0 ? (1 - s.dropProgress) * extraRows * (cellH + gap) : 0;
          let py = y + r * (cellH + gap) - dropPx;
          const intro = s.spinIntroMap?.[r]?.[c];
          if (intro) {
            const introT = clamp((s.spinIntroProgress - Number(intro.delay || 0)) / Math.max(0.001, 1 - Number(intro.delay || 0)), 0, 1);
            const introEase = 1 - Math.pow(1 - introT, 3);
            const introDrop = (1 - introEase) * Number(intro.fromRows || 0) * (cellH + gap);
            py -= introDrop;
          }
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
        ? this._format("bonusOwnerChip", { owner: this._ownerLabel(s.bonusOwner, true), value: s.bonusSpinsLeft }, `${this._ownerLabel(s.bonusOwner, true)} BONUS ${s.bonusSpinsLeft}`)
        : this._format("chipBase", { value: Math.max(s.meSpins, s.enemySpins) }, `BASE ${Math.max(s.meSpins, s.enemySpins)}`);
      const chip2 = s.inBonus
        ? this._format("chipMultiplier", { value: Math.max(0, s.bonusMultiplierBank) }, `TOPLAM CARPAN x${Math.max(0, s.bonusMultiplierBank)}`)
        : this._format("chipTumble", { value: Math.max(0, s.tumbleIndex) }, `TUMBLE ${Math.max(0, s.tumbleIndex)}`);
      const chip3 = s.turn === "me" && !s.spinning && !s.finished
        ? this._format("chipSpinTimer", { value: countdown }, `SPIN SURESI ${countdown}`)
        : (s.turn === "enemy" ? this._text("opponentThinking", "RAKIP DUSUNUYOR") : this._text("chipResult", "SONUC"));

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
