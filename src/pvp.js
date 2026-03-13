(() => {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const now = () => Date.now();

  const MODES = {
    street: {
      id: "street",
      title: "Grid Heist",
      subtitle: "Sokak Çatışması",
      desc: "Match Masters tarzı sıra tabanlı grid PvP. Silah, savunma ve ganimet komboları ile rakibi indir.",
      onlyFrom: null,
      badge: "Açık",
      accent: "orange",
      symbols: [
        { key: "blade", icon: "🔪", kind: "dmg", power: 7 },
        { key: "gun", icon: "🔫", kind: "dmg", power: 10 },
        { key: "guard", icon: "🛡️", kind: "shield", power: 5 },
        { key: "med", icon: "💊", kind: "heal", power: 4 },
        { key: "cash", icon: "💰", kind: "loot", power: 3 },
      ],
      opponents: ["Razor Veli", "Ghost Kemal", "Dark Bora", "Wolf Nihat", "Black Ferit"],
      intro: "Şehir sokakları sıcak. En temiz komboyu yapan parayı toplar.",
    },
    nightclub: {
      id: "nightclub",
      title: "Club Raid",
      subtitle: "Nightclub İç Saldırı",
      desc: "Sadece Nightclub içindeki rakiplere karşı daha sert ve daha coin odaklı raid modu.",
      onlyFrom: "nightclub",
      badge: "Nightclub",
      accent: "pink",
      symbols: [
        { key: "bottle", icon: "🍾", kind: "dmg", power: 8 },
        { key: "vip", icon: "💋", kind: "dmg", power: 9 },
        { key: "guard", icon: "🛡️", kind: "shield", power: 5 },
        { key: "boost", icon: "⚡", kind: "heal", power: 4 },
        { key: "cash", icon: "💵", kind: "loot", power: 4 },
      ],
      opponents: ["Velvet King", "Club Cobra", "Ruby Queen", "DJ Vandal", "Neon Murat"],
      intro: "Kulübün içinde işler kirli. Burada sadece içerideki oyuncular hedef alınır.",
    },
    coffeeshop: {
      id: "coffeeshop",
      title: "Smoke Ambush",
      subtitle: "Coffeeshop İç Pusu",
      desc: "Coffeeshop içindeki oyunculara karşı daha taktiksel, daha dayanıklı ve kontrol ağırlıklı bir mod.",
      onlyFrom: "coffeeshop",
      badge: "Coffeeshop",
      accent: "green",
      symbols: [
        { key: "bud", icon: "🌿", kind: "dmg", power: 7 },
        { key: "tox", icon: "💨", kind: "dmg", power: 8 },
        { key: "guard", icon: "🛡️", kind: "shield", power: 6 },
        { key: "med", icon: "🧪", kind: "heal", power: 5 },
        { key: "cash", icon: "💸", kind: "loot", power: 3 },
      ],
      opponents: ["Green Jack", "Haze Ali", "Fog Baron", "Amsterdam Efe", "Kush Yaman"],
      intro: "Sisli masalarda sessiz savaş. Burada dayanıklılık ve doğru zamanlama kazandırır.",
    },
  };

  const TIERS = [
    {
      id: "bronze",
      title: "Bronz Masa",
      energy: 6,
      coin: 0,
      winCoins: 18,
      winXp: 10,
      rank: 8,
      dmgMul: 1,
      hp: 100,
      badge: "Düşük Risk",
    },
    {
      id: "silver",
      title: "Gümüş Masa",
      energy: 10,
      coin: 15,
      winCoins: 42,
      winXp: 18,
      rank: 15,
      dmgMul: 1.12,
      hp: 112,
      badge: "Orta Risk",
    },
    {
      id: "gold",
      title: "Altın Masa",
      energy: 14,
      coin: 40,
      winCoins: 95,
      winXp: 30,
      rank: 28,
      dmgMul: 1.24,
      hp: 128,
      badge: "Yüksek Risk",
    },
  ];

  const BOARD_SIZE = 6;
  const STORAGE_LIMIT = 12;

  const $ = (id) => document.getElementById(id);

  function getStore() {
    return window.tcStore || null;
  }

  function getState() {
    return getStore()?.get?.() || {};
  }

  function setState(patch) {
    return getStore()?.set?.(patch);
  }

  function getCoins(s) {
    const root = Number(s?.coins ?? NaN);
    if (Number.isFinite(root)) return root;
    const pCoin = Number(s?.player?.coins ?? NaN);
    if (Number.isFinite(pCoin)) return pCoin;
    const yton = Number(s?.player?.yton ?? NaN);
    if (Number.isFinite(yton)) return yton;
    return 0;
  }

  function getEnergy(s) {
    const e = Number(s?.player?.energy ?? s?.energy ?? 0);
    return Number.isFinite(e) ? e : 0;
  }

  function getEnergyMax(s) {
    const e = Number(s?.player?.energyMax ?? 100);
    return Number.isFinite(e) && e > 0 ? e : 100;
  }

  function getPlayerName(s) {
    return String(s?.player?.username || "Player").trim() || "Player";
  }

  function pushChat(text) {
    const s = getState();
    const chat = Array.isArray(s.chatLog) ? s.chatLog.slice(-79) : [];
    const ts = now();
    const row = {
      id: `sys_${ts}_${Math.random().toString(36).slice(2, 7)}`,
      type: "system",
      username: "SYSTEM",
      text: String(text || ""),
      ts,
    };
    chat.push(row);
    setState({ chatLog: chat });
    try {
      window.dispatchEvent(new CustomEvent("tc:chat:push", { detail: row }));
    } catch (_) {}
  }

  function fire(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (_) {}
  }

  function ensureDefaults() {
    const st = getStore();
    if (!st) return;
    const s = st.get() || {};
    const p = s.player || {};
    const patch = {};
    const pPatch = { ...p };
    let pDirty = false;

    if (pPatch.username == null) { pPatch.username = "Player"; pDirty = true; }
    if (pPatch.level == null) { pPatch.level = 1; pDirty = true; }
    if (pPatch.xp == null) { pPatch.xp = 0; pDirty = true; }
    if (pPatch.xpToNext == null) { pPatch.xpToNext = 100; pDirty = true; }
    if (pPatch.energy == null) { pPatch.energy = 50; pDirty = true; }
    if (pPatch.energyMax == null) { pPatch.energyMax = 100; pDirty = true; }

    if (s.coins == null) patch.coins = 0;
    if (pDirty) patch.player = pPatch;

    const pvp = s.pvp || {};
    patch.pvp = {
      wins: Number(pvp.wins || 0),
      losses: Number(pvp.losses || 0),
      points: Number(pvp.points || 0),
      streak: Number(pvp.streak || 0),
      bestStreak: Number(pvp.bestStreak || 0),
      lastMode: pvp.lastMode || null,
      history: Array.isArray(pvp.history) ? pvp.history.slice(0, STORAGE_LIMIT) : [],
      leaderboard: Array.isArray(pvp.leaderboard) ? pvp.leaderboard.slice(0, 20) : [],
      sources: {
        home: Number(pvp?.sources?.home || 0),
        nightclub: Number(pvp?.sources?.nightclub || 0),
        coffeeshop: Number(pvp?.sources?.coffeeshop || 0),
      },
      modes: {
        street: { wins: Number(pvp?.modes?.street?.wins || 0), losses: Number(pvp?.modes?.street?.losses || 0) },
        nightclub: { wins: Number(pvp?.modes?.nightclub?.wins || 0), losses: Number(pvp?.modes?.nightclub?.losses || 0) },
        coffeeshop: { wins: Number(pvp?.modes?.coffeeshop?.wins || 0), losses: Number(pvp?.modes?.coffeeshop?.losses || 0) },
      },
    };

    st.set(patch);
  }

  function injectStyle() {
    if (document.getElementById("tc-pvp-grid-style")) return;
    const st = document.createElement("style");
    st.id = "tc-pvp-grid-style";
    st.textContent = `
#pvpWrap.tc-grid-hub{display:flex;flex-direction:column;}
#pvpWrap .hidden{display:none !important;}
#pvpWrap .tc-hub,
#pvpWrap .tc-match,
#pvpWrap .tc-result{display:flex;flex-direction:column;height:100%;gap:12px;position:relative;z-index:2;}
#pvpWrap .tc-hub{overflow:auto;padding-right:2px;}
#pvpWrap .tc-pill-row{display:flex;gap:8px;flex-wrap:wrap;}
#pvpWrap .tc-pill{padding:7px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);font-size:12px;color:#ecedf2;}
#pvpWrap .tc-game-grid{display:grid;grid-template-columns:1fr;gap:12px;}
#pvpWrap .tc-card{position:relative;border-radius:18px;padding:14px;border:1px solid rgba(255,255,255,.10);background:linear-gradient(180deg, rgba(22,26,34,.96) 0%, rgba(9,11,17,.96) 100%);box-shadow:0 12px 36px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.05);overflow:hidden;}
#pvpWrap .tc-card::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at top right, rgba(255,180,90,.14), transparent 35%);}
#pvpWrap .tc-card.sel{border-color:rgba(255,180,90,.45);box-shadow:0 14px 40px rgba(0,0,0,.42), inset 0 0 0 1px rgba(255,180,90,.14);}
#pvpWrap .tc-card.locked{opacity:.62;filter:saturate(.8);}
#pvpWrap .tc-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;}
#pvpWrap .tc-title{font-weight:800;font-size:18px;color:#fff;line-height:1.1;}
#pvpWrap .tc-sub{font-size:12px;color:#b9becb;margin-top:4px;}
#pvpWrap .tc-badge{font-size:11px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);white-space:nowrap;color:#fff;}
#pvpWrap .tc-desc{font-size:13px;line-height:1.45;color:#cbd0db;}
#pvpWrap .tc-symbols{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;}
#pvpWrap .tc-symbol{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);font-size:21px;}
#pvpWrap .tc-tier-grid{display:grid;grid-template-columns:1fr;gap:10px;margin-top:2px;}
#pvpWrap .tc-tier{padding:12px 12px 11px;border-radius:16px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.04);cursor:pointer;transition:transform .12s ease,border-color .12s ease;}
#pvpWrap .tc-tier.sel{border-color:rgba(255,180,90,.44);transform:translateY(-1px);}
#pvpWrap .tc-tier-top{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px;}
#pvpWrap .tc-tier-title{font-size:15px;font-weight:800;color:#fff;}
#pvpWrap .tc-tier-badge{font-size:11px;color:#ffd28f;}
#pvpWrap .tc-tier-meta{font-size:12px;line-height:1.5;color:#c6ccda;}
#pvpWrap .tc-cta{margin-top:2px;display:flex;gap:10px;flex-wrap:wrap;}
#pvpWrap .tc-btn{border:none;border-radius:14px;padding:12px 16px;font-weight:800;font-size:14px;cursor:pointer;}
#pvpWrap .tc-btn.primary{background:linear-gradient(180deg,#f0a44c,#d87d1f);color:#120a02;box-shadow:0 10px 24px rgba(216,125,31,.30);}
#pvpWrap .tc-btn.secondary{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.14);}
#pvpWrap .tc-btn:disabled{opacity:.5;cursor:not-allowed;}
#pvpWrap .tc-mini-note{font-size:12px;color:#9fa8ba;line-height:1.4;margin-top:2px;}
#pvpWrap .tc-board-wrap{display:flex;flex-direction:column;height:100%;gap:10px;}
#pvpWrap .tc-turn{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);}
#pvpWrap .tc-turn b{color:#fff;}
#pvpWrap .tc-board{display:grid;grid-template-columns:repeat(${BOARD_SIZE},1fr);gap:8px;flex:1 1 auto;align-content:center;}
#pvpWrap .tc-cell{aspect-ratio:1/1;min-height:42px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;user-select:none;background:linear-gradient(180deg, rgba(26,31,40,.96) 0%, rgba(9,11,16,.96) 100%);border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 8px 18px rgba(0,0,0,.24);transition:transform .12s ease,border-color .12s ease, box-shadow .12s ease;}
#pvpWrap .tc-cell.sel{transform:translateY(-2px);border-color:rgba(255,190,104,.72);box-shadow:0 0 0 2px rgba(255,190,104,.2),0 10px 20px rgba(0,0,0,.28);}
#pvpWrap .tc-cell.match{animation:tcMatchPop .28s ease;}
#pvpWrap .tc-cell.dim{opacity:.65;}
#pvpWrap .tc-log{min-height:56px;max-height:86px;overflow:auto;padding:10px 12px;border-radius:14px;background:rgba(0,0,0,.24);border:1px solid rgba(255,255,255,.08);font-size:12px;line-height:1.45;color:#d2d7e2;}
#pvpWrap .tc-result-box{padding:16px;border-radius:18px;border:1px solid rgba(255,255,255,.11);background:linear-gradient(180deg, rgba(20,24,31,.97) 0%, rgba(7,9,14,.97) 100%);box-shadow:0 12px 30px rgba(0,0,0,.34);}
#pvpWrap .tc-result-title{font-size:24px;font-weight:900;color:#fff;}
#pvpWrap .tc-result-sub{font-size:13px;color:#c7cfdd;margin-top:6px;line-height:1.45;}
#pvpWrap .tc-reward-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px;}
#pvpWrap .tc-reward{padding:12px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);text-align:center;}
#pvpWrap .tc-reward .v{font-size:18px;font-weight:900;color:#fff;}
#pvpWrap .tc-reward .k{font-size:11px;color:#aeb8ca;margin-top:4px;}
@keyframes tcMatchPop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
@media (min-width:680px){
  #pvpWrap .tc-game-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  #pvpWrap .tc-tier-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
}
`;
    document.head.appendChild(st);
  }

  function normalizeSource(detail) {
    const source = String(detail?.source || detail?.from || detail?.building || window.__tcCurrentScene || "home").toLowerCase();
    if (source.includes("night")) return "nightclub";
    if (source.includes("coffee")) return "coffeeshop";
    return "home";
  }

  function sceneTrackerBoot() {
    const wrapScenes = () => {
      const scenes = window.tcScenes;
      if (!scenes || scenes.__tcPvpWrapped || typeof scenes.go !== "function") return false;
      const orig = scenes.go.bind(scenes);
      scenes.go = (key, ...rest) => {
        try { window.__tcCurrentScene = String(key || ""); } catch (_) {}
        return orig(key, ...rest);
      };
      scenes.__tcPvpWrapped = true;
      return true;
    };

    if (!wrapScenes()) {
      const t = setInterval(() => {
        if (wrapScenes()) clearInterval(t);
      }, 250);
    }
  }

  function createBoard(modeId) {
    const mode = MODES[modeId];
    const keys = mode.symbols.map((s) => s.key);
    const board = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      board[y] = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        let chosen = pick(keys);
        let guard = 0;
        while (guard < 12) {
          const leftA = x >= 2 ? board[y][x - 1] : null;
          const leftB = x >= 1 ? board[y][x - 2] : null;
          const upA = y >= 1 ? board[y - 1][x] : null;
          const upB = y >= 2 ? board[y - 2][x] : null;
          if (!((leftA === chosen && leftB === chosen) || (upA === chosen && upB === chosen))) break;
          chosen = pick(keys);
          guard += 1;
        }
        board[y][x] = chosen;
      }
    }
    return board;
  }

  function cloneBoard(board) {
    return board.map((r) => r.slice());
  }

  function findMatches(board) {
    const out = new Set();

    for (let y = 0; y < BOARD_SIZE; y++) {
      let run = 1;
      for (let x = 1; x <= BOARD_SIZE; x++) {
        const same = x < BOARD_SIZE && board[y][x] === board[y][x - 1];
        if (same) {
          run += 1;
          continue;
        }
        if (run >= 3) {
          for (let i = 0; i < run; i++) out.add(`${x - 1 - i},${y}`);
        }
        run = 1;
      }
    }

    for (let x = 0; x < BOARD_SIZE; x++) {
      let run = 1;
      for (let y = 1; y <= BOARD_SIZE; y++) {
        const same = y < BOARD_SIZE && board[y][x] === board[y - 1][x];
        if (same) {
          run += 1;
          continue;
        }
        if (run >= 3) {
          for (let i = 0; i < run; i++) out.add(`${x},${y - 1 - i}`);
        }
        run = 1;
      }
    }

    return [...out].map((k) => {
      const [x, y] = k.split(",").map(Number);
      return { x, y, key: board[y][x] };
    });
  }

  function collapseBoard(board, modeId) {
    const mode = MODES[modeId];
    const keys = mode.symbols.map((s) => s.key);
    for (let x = 0; x < BOARD_SIZE; x++) {
      const col = [];
      for (let y = BOARD_SIZE - 1; y >= 0; y--) {
        if (board[y][x] != null) col.push(board[y][x]);
      }
      while (col.length < BOARD_SIZE) col.push(pick(keys));
      for (let y = BOARD_SIZE - 1, i = 0; y >= 0; y--, i++) {
        board[y][x] = col[i];
      }
    }
  }

  function symbolMeta(modeId, key) {
    return MODES[modeId].symbols.find((s) => s.key === key);
  }

  function applyTurn(match, actor, modeId, tier, matched) {
    const counts = {};
    for (const m of matched) counts[m.key] = (counts[m.key] || 0) + 1;
    const total = matched.length;
    const bonus = total >= 5 ? 1.45 : total >= 4 ? 1.2 : 1;

    let damage = 0;
    let shield = 0;
    let heal = 0;
    let loot = 0;

    Object.entries(counts).forEach(([key, qty]) => {
      const meta = symbolMeta(modeId, key);
      if (!meta) return;
      if (meta.kind === "dmg") damage += meta.power * qty;
      if (meta.kind === "shield") shield += meta.power * qty;
      if (meta.kind === "heal") heal += meta.power * qty;
      if (meta.kind === "loot") loot += meta.power * qty;
    });

    damage = Math.round(damage * tier.dmgMul * bonus);
    shield = Math.round(shield * bonus);
    heal = Math.round(heal * bonus);
    loot = Math.round(loot * bonus);

    const me = actor === "player" ? match.player : match.enemy;
    const foe = actor === "player" ? match.enemy : match.player;

    me.shield = Math.max(0, Number(me.shield || 0) + shield);
    me.hp = clamp(Number(me.hp || 0) + heal, 0, me.maxHp);
    me.loot = Number(me.loot || 0) + loot;

    let finalDamage = damage;
    const absorbed = Math.min(Number(foe.shield || 0), finalDamage);
    foe.shield = Math.max(0, Number(foe.shield || 0) - absorbed);
    finalDamage -= absorbed;
    foe.hp = clamp(Number(foe.hp || 0) - finalDamage, 0, foe.maxHp);

    return {
      counts,
      total,
      damage: finalDamage,
      absorbed,
      shield,
      heal,
      loot,
      bonus,
      actor,
      dead: foe.hp <= 0,
    };
  }

  function resolveBoard(match, actor) {
    const modeId = match.mode.id;
    const tier = match.tier;
    const board = match.board;
    const turns = [];
    let safety = 0;

    while (safety < 12) {
      const matched = findMatches(board);
      if (!matched.length) break;
      matched.forEach(({ x, y }) => { board[y][x] = null; });
      const result = applyTurn(match, actor, modeId, tier, matched);
      turns.push(result);
      collapseBoard(board, modeId);
      if (result.dead) break;
      safety += 1;
    }

    return turns;
  }

  function swap(board, a, b) {
    const t = board[a.y][a.x];
    board[a.y][a.x] = board[b.y][b.x];
    board[b.y][b.x] = t;
  }

  function adjacent(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  }

  function hasAnyMove(board) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const cur = { x, y };
        const nexts = [
          { x: x + 1, y },
          { x, y: y + 1 },
        ];
        for (const n of nexts) {
          if (n.x >= BOARD_SIZE || n.y >= BOARD_SIZE) continue;
          const tmp = cloneBoard(board);
          swap(tmp, cur, n);
          if (findMatches(tmp).length) return true;
        }
      }
    }
    return false;
  }

  function reshuffleUntilPlayable(board, modeId) {
    let guard = 0;
    while (!hasAnyMove(board) && guard < 24) {
      const fresh = createBoard(modeId);
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) board[y][x] = fresh[y][x];
      }
      guard += 1;
    }
  }

  function chooseBotMove(match) {
    let best = null;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const a = { x, y };
        const nexts = [
          { x: x + 1, y },
          { x, y: y + 1 },
        ];
        for (const b of nexts) {
          if (b.x >= BOARD_SIZE || b.y >= BOARD_SIZE) continue;
          const tempBoard = cloneBoard(match.board);
          const temp = {
            mode: match.mode,
            tier: match.tier,
            board: tempBoard,
            player: { ...match.player },
            enemy: { ...match.enemy },
          };
          swap(tempBoard, a, b);
          const first = findMatches(tempBoard);
          if (!first.length) continue;
          const turns = resolveBoard(temp, "enemy");
          const score = turns.reduce((sum, t) => sum + t.damage * 3 + t.shield + t.heal + t.loot, 0);
          if (!best || score > best.score) best = { a, b, score };
        }
      }
    }
    return best;
  }

  function gainXp(amount) {
    const s = getState();
    const p = s.player || {};
    let xp = Number(p.xp || 0) + Number(amount || 0);
    let level = Number(p.level || 1);
    let xpToNext = Math.max(100, Number(p.xpToNext || 100));
    while (xp >= xpToNext) {
      xp -= xpToNext;
      level += 1;
      xpToNext = 100;
    }
    setState({ player: { ...p, xp, level, xpToNext } });
  }

  const APP = {
    booted: false,
    els: null,
    ui: {
      screen: "hub",
      source: "home",
      selectedMode: "street",
      selectedTier: "bronze",
      selectedCell: null,
      animating: false,
      log: [],
      result: null,
    },
    match: null,
    timers: new Set(),
    legacyPatched: false,

    boot() {
      if (this.booted) return;
      ensureDefaults();
      injectStyle();
      sceneTrackerBoot();

      this.els = {
        layer: $("pvpLayer"),
        wrap: $("pvpWrap"),
        fab: $("pvpFab"),
        status: $("pvpStatus"),
        opponent: $("pvpOpponent"),
        opponentRow: $("pvpOpponentRow"),
        spinner: $("pvpSpinner"),
        start: $("pvpStart"),
        stop: $("pvpStop"),
        reset: $("pvpReset"),
        bars: $("pvpBars"),
        enemyFill: $("enemyFill"),
        enemyHpText: $("enemyHpText"),
        meFill: $("meFill"),
        meHpText: $("meHpText"),
        arena: $("arena"),
      };

      if (!this.els.wrap || !this.els.arena) return;

      this.els.fab && (this.els.fab.onclick = () => this.open({ source: normalizeSource({}) }));
      this.els.start && (this.els.start.onclick = () => this.startSelectedMatch());
      this.els.stop && (this.els.stop.onclick = () => this.onStopPressed());
      this.els.reset && (this.els.reset.onclick = () => this.onResetPressed());

      window.addEventListener("tc:openPvp", (e) => {
        this.open(e?.detail || {});
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.close();
      });

      this.booted = true;
      this.patchLegacyUiHints();
      this.renderHub();
    },

    patchLegacyUiHints() {
      if (this.legacyPatched) return;
      this.legacyPatched = true;
      try {
        window.startPvpLobby = () => {};
      } catch (_) {}
    },

    setStatus(text) {
      if (this.els?.status) this.els.status.textContent = `PvP • ${text}`;
    },

    setOpponent(text) {
      if (this.els?.opponent) this.els.opponent.textContent = text || "—";
    },

    setBars(meHp, meMax, enemyHp, enemyMax) {
      if (!this.els) return;
      const mePct = clamp(meHp / Math.max(1, meMax), 0, 1);
      const enPct = clamp(enemyHp / Math.max(1, enemyMax), 0, 1);
      if (this.els.meFill) this.els.meFill.style.transform = `scaleX(${mePct})`;
      if (this.els.enemyFill) this.els.enemyFill.style.transform = `scaleX(${enPct})`;
      if (this.els.meHpText) this.els.meHpText.textContent = `${Math.max(0, Math.round(meHp))}/${Math.round(meMax)}`;
      if (this.els.enemyHpText) this.els.enemyHpText.textContent = `${Math.max(0, Math.round(enemyHp))}/${Math.round(enemyMax)}`;
    },

    showBars(on) {
      if (this.els?.bars) this.els.bars.classList.toggle("hidden", !on);
    },

    open(detail = {}) {
      ensureDefaults();
      this.ui.source = normalizeSource(detail);
      this.ui.selectedMode = this.defaultModeForSource(this.ui.source);
      this.ui.selectedTier = "bronze";
      this.ui.selectedCell = null;
      this.ui.screen = "hub";
      this.ui.result = null;
      this.ui.log = [];
      this.stopTimers();
      this.match = null;
      this.els.wrap?.classList.add("open", "tc-grid-hub");
      this.renderHub();
    },

    close() {
      this.stopTimers();
      this.match = null;
      this.ui.selectedCell = null;
      this.els.wrap?.classList.remove("open");
      this.setStatus("Hazır");
      this.setOpponent("—");
      this.showBars(false);
      if (this.els?.arena) this.els.arena.innerHTML = "";
    },

    defaultModeForSource(source) {
      if (source === "nightclub") return "nightclub";
      if (source === "coffeeshop") return "coffeeshop";
      return "street";
    },

    currentTier() {
      return TIERS.find((t) => t.id === this.ui.selectedTier) || TIERS[0];
    },

    currentMode() {
      return MODES[this.ui.selectedMode] || MODES.street;
    },

    modeAvailable(modeId) {
      const mode = MODES[modeId];
      return !mode.onlyFrom || mode.onlyFrom === this.ui.source;
    },

    renderHub() {
      if (!this.els?.arena) return;
      this.ui.screen = "hub";
      this.showBars(false);
      this.setStatus("Oyun seç");
      this.setOpponent(this.ui.source === "home" ? "Genel Havuz" : `${this.ui.source} içi rakip`);
      if (this.els.start) this.els.start.classList.add("hidden");
      if (this.els.stop) this.els.stop.classList.add("hidden");
      if (this.els.reset) {
        this.els.reset.classList.remove("hidden");
        this.els.reset.textContent = "Kapat";
      }

      const mode = this.currentMode();
      const tier = this.currentTier();
      const cards = Object.values(MODES).map((m) => {
        const active = m.id === this.ui.selectedMode;
        const available = this.modeAvailable(m.id);
        return `
          <div class="tc-card ${active ? "sel" : ""} ${available ? "" : "locked"}" data-mode="${m.id}">
            <div class="tc-card-head">
              <div>
                <div class="tc-title">${m.title}</div>
                <div class="tc-sub">${m.subtitle}</div>
              </div>
              <div class="tc-badge">${available ? m.badge : "Kilitli"}</div>
            </div>
            <div class="tc-desc">${m.desc}</div>
            <div class="tc-symbols">${m.symbols.map((s) => `<div class="tc-symbol">${s.icon}</div>`).join("")}</div>
          </div>
        `;
      }).join("");

      const tiers = TIERS.map((t) => `
        <div class="tc-tier ${t.id === tier.id ? "sel" : ""}" data-tier="${t.id}">
          <div class="tc-tier-top">
            <div class="tc-tier-title">${t.title}</div>
            <div class="tc-tier-badge">${t.badge}</div>
          </div>
          <div class="tc-tier-meta">
            Giriş: ${t.energy} enerji${t.coin > 0 ? ` + ${t.coin} yton` : ""}<br>
            Kazanç: +${t.winCoins} yton • +${t.winXp} XP<br>
            Sezon Puanı: +${t.rank}
          </div>
        </div>
      `).join("");

      const sourceLabel = this.ui.source === "home"
        ? "Genel PvP merkezi"
        : this.ui.source === "nightclub"
          ? "Nightclub içi PvP bağlantısı"
          : "Coffeeshop içi PvP bağlantısı";

      this.els.arena.innerHTML = `
        <div class="tc-hub">
          <div class="tc-pill-row">
            <div class="tc-pill">${sourceLabel}</div>
            <div class="tc-pill">${mode.intro}</div>
          </div>
          <div class="tc-game-grid">${cards}</div>
          <div class="tc-card sel">
            <div class="tc-card-head">
              <div>
                <div class="tc-title">Masa Seç</div>
                <div class="tc-sub">HUD'da mevcut enerji ve coin zaten görünüyor; burada sadece giriş maliyeti gösterilir.</div>
              </div>
              <div class="tc-badge">${mode.title}</div>
            </div>
            <div class="tc-tier-grid">${tiers}</div>
            <div class="tc-cta">
              <button class="tc-btn primary" id="tcPvpBeginBtn" ${this.modeAvailable(mode.id) ? "" : "disabled"}>Maçı Aç</button>
              <button class="tc-btn secondary" id="tcPvpCloseBtn">Kapat</button>
            </div>
            <div class="tc-mini-note">
              ${this.modeAvailable(mode.id)
                ? `${mode.title} hazır. Rakip havuzu ve ödül seçtiğin girişe göre ayarlanır.`
                : `${mode.title} sadece ${mode.onlyFrom} içinden açılır.`}
            </div>
          </div>
        </div>
      `;

      this.els.arena.querySelectorAll("[data-mode]").forEach((el) => {
        el.onclick = () => {
          this.ui.selectedMode = el.dataset.mode;
          this.renderHub();
        };
      });
      this.els.arena.querySelectorAll("[data-tier]").forEach((el) => {
        el.onclick = () => {
          this.ui.selectedTier = el.dataset.tier;
          this.renderHub();
        };
      });
      const begin = this.els.arena.querySelector("#tcPvpBeginBtn");
      if (begin) begin.onclick = () => this.startSelectedMatch();
      const close = this.els.arena.querySelector("#tcPvpCloseBtn");
      if (close) close.onclick = () => this.close();
    },

    startSelectedMatch() {
      const mode = this.currentMode();
      const tier = this.currentTier();
      const s = getState();
      const energy = getEnergy(s);
      const coins = getCoins(s);

      if (!this.modeAvailable(mode.id)) {
        this.toast(`${mode.title} sadece ${mode.onlyFrom} içinden açılır.`);
        return;
      }
      if (energy < tier.energy) {
        this.toast(`Yetersiz enerji. Gerekli: ${tier.energy}`);
        return;
      }
      if (coins < tier.coin) {
        this.toast(`Yetersiz yton. Gerekli: ${tier.coin}`);
        return;
      }

      const p = s.player || {};
      setState({
        coins: Math.max(0, coins - tier.coin),
        player: {
          ...p,
          energy: Math.max(0, energy - tier.energy),
        },
      });

      const opponentName = pick(mode.opponents);
      const hp = tier.hp;
      this.match = {
        id: `pvp_${now()}`,
        source: this.ui.source,
        mode,
        tier,
        board: createBoard(mode.id),
        player: { name: getPlayerName(s), hp, maxHp: hp, shield: 0, loot: 0 },
        enemy: { name: opponentName, hp, maxHp: hp, shield: 0, loot: 0 },
        turn: "player",
        busy: false,
        lastSummary: "Maç başladı.",
      };
      reshuffleUntilPlayable(this.match.board, mode.id);
      this.ui.log = [`${mode.title} başladı. ${opponentName} sahaya indi.`];
      this.ui.screen = "match";
      this.ui.selectedCell = null;
      this.renderMatch();
    },

    renderMatch() {
      const match = this.match;
      if (!match || !this.els?.arena) return;
      this.showBars(true);
      this.setStatus(match.turn === "player" ? "Hamle sende" : "Rakip düşünüyor");
      this.setOpponent(match.enemy.name);
      this.setBars(match.player.hp, match.player.maxHp, match.enemy.hp, match.enemy.maxHp);

      if (this.els.start) this.els.start.classList.add("hidden");
      if (this.els.stop) {
        this.els.stop.classList.remove("hidden");
        this.els.stop.textContent = "Teslim Ol";
      }
      if (this.els.reset) {
        this.els.reset.classList.remove("hidden");
        this.els.reset.textContent = "Hub";
      }

      const modeMap = Object.fromEntries(match.mode.symbols.map((s) => [s.key, s.icon]));
      const boardHtml = match.board.map((row, y) => row.map((cell, x) => {
        const selected = this.ui.selectedCell && this.ui.selectedCell.x === x && this.ui.selectedCell.y === y;
        const dim = match.turn !== "player" || match.busy;
        return `<div class="tc-cell ${selected ? "sel" : ""} ${dim ? "dim" : ""}" data-x="${x}" data-y="${y}">${modeMap[cell] || "?"}</div>`;
      }).join("")).join("");

      const latest = this.ui.log.slice(-8).reverse().map((t) => `<div>${t}</div>`).join("");
      this.els.arena.innerHTML = `
        <div class="tc-match">
          <div class="tc-turn">
            <div><b>${match.mode.title}</b> • ${match.tier.title}</div>
            <div>${match.turn === "player" ? "Hamle sende" : `${match.enemy.name} hamle yapıyor`}</div>
          </div>
          <div class="tc-board-wrap">
            <div class="tc-board">${boardHtml}</div>
            <div class="tc-log">${latest}</div>
          </div>
        </div>
      `;

      this.els.arena.querySelectorAll(".tc-cell").forEach((el) => {
        el.onclick = () => this.onCellPress(Number(el.dataset.x), Number(el.dataset.y));
      });
    },

    onCellPress(x, y) {
      const match = this.match;
      if (!match || match.turn !== "player" || match.busy) return;

      const cur = { x, y };
      if (!this.ui.selectedCell) {
        this.ui.selectedCell = cur;
        this.renderMatch();
        return;
      }

      const prev = this.ui.selectedCell;
      if (prev.x === cur.x && prev.y === cur.y) {
        this.ui.selectedCell = null;
        this.renderMatch();
        return;
      }

      if (!adjacent(prev, cur)) {
        this.ui.selectedCell = cur;
        this.renderMatch();
        return;
      }

      const tempBoard = cloneBoard(match.board);
      swap(tempBoard, prev, cur);
      const matched = findMatches(tempBoard);
      if (!matched.length) {
        this.ui.selectedCell = null;
        this.toast("Geçersiz hamle");
        this.renderMatch();
        return;
      }

      match.busy = true;
      this.ui.selectedCell = null;
      swap(match.board, prev, cur);
      const turns = resolveBoard(match, "player");
      reshuffleUntilPlayable(match.board, match.mode.id);
      this.pushTurnLog(turns, match.player.name, match.enemy.name);

      if (match.enemy.hp <= 0) {
        this.finish("win");
        return;
      }

      match.turn = "enemy";
      match.busy = false;
      this.renderMatch();
      this.schedule(() => this.enemyMove(), 900);
    },

    enemyMove() {
      const match = this.match;
      if (!match || match.turn !== "enemy") return;
      match.busy = true;
      const move = chooseBotMove(match);
      if (!move) {
        reshuffleUntilPlayable(match.board, match.mode.id);
        this.ui.log.unshift(`${match.enemy.name} tahtayı yeniden karıştırdı.`);
        match.turn = "player";
        match.busy = false;
        this.renderMatch();
        return;
      }

      swap(match.board, move.a, move.b);
      const turns = resolveBoard(match, "enemy");
      reshuffleUntilPlayable(match.board, match.mode.id);
      this.pushTurnLog(turns, match.enemy.name, match.player.name);

      if (match.player.hp <= 0) {
        this.finish("lose");
        return;
      }

      match.turn = "player";
      match.busy = false;
      this.renderMatch();
    },

    pushTurnLog(turns, actorName, targetName) {
      if (!turns?.length) {
        this.ui.log.unshift(`${actorName} bir hamle yaptı ama güçlü combo kuramadı.`);
        return;
      }
      for (const t of turns) {
        const parts = [];
        if (t.damage > 0) parts.push(`${targetName}'e ${t.damage} hasar`);
        if (t.absorbed > 0) parts.push(`${t.absorbed} bloklandı`);
        if (t.shield > 0) parts.push(`+${t.shield} kalkan`);
        if (t.heal > 0) parts.push(`+${t.heal} can`);
        if (t.loot > 0) parts.push(`+${t.loot} loot`);
        if (t.bonus > 1) parts.push(`combo x${t.bonus.toFixed(2)}`);
        this.ui.log.unshift(`${actorName}: ${parts.join(" • ")}`);
      }
      this.ui.log = this.ui.log.slice(0, STORAGE_LIMIT);
      this.renderMatch();
    },

    finish(result) {
      const match = this.match;
      if (!match) return;
      this.stopTimers();
      const s = getState();
      const p = s.player || {};
      const pvp = s.pvp || {};
      const won = result === "win";
      const rewardCoins = won ? match.tier.winCoins + match.player.loot : 0;
      const rewardXp = won ? match.tier.winXp : 3;
      const nextCoins = getCoins(s) + rewardCoins;
      const wins = Number(pvp.wins || 0) + (won ? 1 : 0);
      const losses = Number(pvp.losses || 0) + (won ? 0 : 1);
      const streak = won ? Number(pvp.streak || 0) + 1 : 0;
      const bestStreak = Math.max(Number(pvp.bestStreak || 0), streak);
      const points = Math.max(0, Number(pvp.points || 0) + (won ? match.tier.rank : -Math.ceil(match.tier.rank * 0.35)));
      const modeBucket = { ...(pvp.modes?.[match.mode.id] || {}) };
      modeBucket.wins = Number(modeBucket.wins || 0) + (won ? 1 : 0);
      modeBucket.losses = Number(modeBucket.losses || 0) + (won ? 0 : 1);
      const sourceCount = Number(pvp?.sources?.[match.source] || 0) + 1;

      const historyRow = {
        id: match.id,
        ts: now(),
        mode: match.mode.id,
        source: match.source,
        tier: match.tier.id,
        result,
        opponent: match.enemy.name,
        rewardCoins,
        rewardXp,
      };
      const history = [historyRow, ...(Array.isArray(pvp.history) ? pvp.history : [])].slice(0, STORAGE_LIMIT);

      const leaderboard = [
        {
          username: getPlayerName(s),
          points,
          wins,
          losses,
          updatedAt: now(),
        },
        ...(Array.isArray(pvp.leaderboard) ? pvp.leaderboard.filter((r) => r.username !== getPlayerName(s)) : []),
      ].sort((a, b) => Number(b.points || 0) - Number(a.points || 0)).slice(0, 10);

      setState({
        coins: nextCoins,
        pvp: {
          ...pvp,
          wins,
          losses,
          points,
          streak,
          bestStreak,
          lastMode: match.mode.id,
          history,
          leaderboard,
          sources: {
            ...(pvp.sources || {}),
            [match.source]: sourceCount,
          },
          modes: {
            ...(pvp.modes || {}),
            [match.mode.id]: modeBucket,
          },
        },
        player: {
          ...p,
        },
      });
      gainXp(rewardXp);

      const combatText = won
        ? `🏆 ${getPlayerName(s)}, ${match.mode.title} maçında ${match.enemy.name}'i yendi.`
        : `💀 ${getPlayerName(s)}, ${match.mode.title} maçında ${match.enemy.name}'e kaybetti.`;
      pushChat(combatText);
      fire(won ? "tc:pvp:win" : "tc:pvp:lose", {
        matchId: match.id,
        opponent: { username: match.enemy.name, isBot: true },
        mode: match.mode.id,
        source: match.source,
        tier: match.tier.id,
      });

      this.ui.result = {
        result,
        title: won ? "Kazandın" : "Kaybettin",
        sub: won
          ? `${match.enemy.name} düştü. ${match.mode.title} için ${match.tier.title} ödülleri hesabına işlendi.`
          : `${match.enemy.name} bu raundu aldı. Rank puanının bir kısmı gitti ama tekrar girebilirsin.`,
        coins: rewardCoins,
        xp: rewardXp,
        points: won ? match.tier.rank : -Math.ceil(match.tier.rank * 0.35),
      };
      this.ui.screen = "result";
      this.renderResult();
    },

    renderResult() {
      const r = this.ui.result;
      if (!r || !this.els?.arena) return;
      this.showBars(false);
      this.setStatus(r.title);
      this.setOpponent("—");
      if (this.els.start) this.els.start.classList.add("hidden");
      if (this.els.stop) this.els.stop.classList.add("hidden");
      if (this.els.reset) {
        this.els.reset.classList.remove("hidden");
        this.els.reset.textContent = "Hub";
      }

      this.els.arena.innerHTML = `
        <div class="tc-result">
          <div class="tc-result-box">
            <div class="tc-result-title">${r.title}</div>
            <div class="tc-result-sub">${r.sub}</div>
            <div class="tc-reward-grid">
              <div class="tc-reward"><div class="v">${r.coins >= 0 ? `+${r.coins}` : r.coins}</div><div class="k">YTON</div></div>
              <div class="tc-reward"><div class="v">+${r.xp}</div><div class="k">XP</div></div>
              <div class="tc-reward"><div class="v">${r.points >= 0 ? `+${r.points}` : r.points}</div><div class="k">SEZON</div></div>
            </div>
            <div class="tc-cta" style="margin-top:14px;">
              <button class="tc-btn primary" id="tcPvpPlayAgain">Tekrar Oyna</button>
              <button class="tc-btn secondary" id="tcPvpBackHub">Hub</button>
            </div>
          </div>
        </div>
      `;
      this.els.arena.querySelector("#tcPvpPlayAgain")?.addEventListener("click", () => this.startSelectedMatch());
      this.els.arena.querySelector("#tcPvpBackHub")?.addEventListener("click", () => this.renderHub());
    },

    onStopPressed() {
      if (this.ui.screen === "match") {
        this.finish("lose");
        return;
      }
      this.renderHub();
    },

    onResetPressed() {
      if (this.ui.screen === "hub") {
        this.close();
        return;
      }
      this.renderHub();
    },

    setOpponentLegacy(opp) {
      if (opp && typeof opp.username === "string" && this.match) {
        this.match.enemy.name = opp.username;
        this.renderMatch();
      }
    },

    start() {
      this.open({ source: normalizeSource({}) });
    },

    stop() {
      this.stopTimers();
      if (this.ui.screen === "match") this.renderHub();
    },

    reset() {
      this.renderHub();
    },

    toast(msg) {
      let el = document.getElementById("pvpResultToast");
      if (!el) {
        el = document.createElement("div");
        el.id = "pvpResultToast";
        el.style.cssText = `position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:10020;padding:10px 14px;border-radius:12px;background:rgba(12,14,20,.92);border:1px solid rgba(255,255,255,.12);color:#fff;font:700 13px system-ui;box-shadow:0 12px 30px rgba(0,0,0,.35);opacity:0;transition:opacity .18s ease;pointer-events:none;`;
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = "1";
      clearTimeout(el._t);
      el._t = setTimeout(() => { el.style.opacity = "0"; }, 1300);
    },

    schedule(fn, ms) {
      const t = setTimeout(() => {
        this.timers.delete(t);
        fn();
      }, ms);
      this.timers.add(t);
      return t;
    },

    stopTimers() {
      this.timers.forEach((t) => clearTimeout(t));
      this.timers.clear();
    },
  };

  window.TonCrimePVP = {
    boot: () => APP.boot(),
    open: (detail) => APP.open(detail || {}),
    close: () => APP.close(),
    start: () => APP.start(),
    stop: () => APP.stop(),
    reset: () => APP.reset(),
    setOpponent: (opp) => APP.setOpponentLegacy(opp),
  };
})();
