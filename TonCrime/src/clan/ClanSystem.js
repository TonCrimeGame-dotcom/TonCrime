
import {
  shallowClone,
  makeId,
  now,
  getUpgradeCost,
  getMaxMembersFromUpgrade,
  getVaultCapacity,
  getIncomeBonusPercent,
  getAttackBonus,
  getDefenseBonus,
} from "./ClanUtils.js";

function readStoreState(store) {
  if (!store) return {};
  if (typeof store.get === "function") return store.get() || {};
  if (typeof store.getState === "function") return store.getState() || {};
  return store.state || {};
}

function writeStoreState(store, nextState) {
  if (!store) return nextState;
  if (typeof store.set === "function") {
    store.set(nextState);
    return nextState;
  }
  if (typeof store.setState === "function") {
    store.setState(nextState);
    return nextState;
  }
  store.state = nextState;
  return nextState;
}

function updateStoreState(store, updater) {
  const prev = readStoreState(store);
  const base = shallowClone(prev);
  const next = updater(base) || base;
  return writeStoreState(store, next);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ensureRootClan(state) {
  if (!state.player) state.player = {};
  if (!state.player.name && state.player.username) state.player.name = state.player.username;
  if (!state.player.name) state.player.name = "Player";
  if (typeof state.player.cash !== "number") state.player.cash = 50000;
  if (typeof state.player.energy !== "number") state.player.energy = 100;
  if (typeof state.player.energyMax !== "number") state.player.energyMax = 100;
  if (typeof state.player.level !== "number") state.player.level = 1;
  if (typeof state.coins !== "number") state.coins = 0;
  if (state.clan === undefined) state.clan = null;
  ensureClanDirectory(state);
  syncClanProtection(state);
  return state;
}

function addLog(clan, type, text) {
  clan.logs = Array.isArray(clan.logs) ? clan.logs : [];
  clan.logs.unshift({
    id: makeId("log"),
    type,
    text,
    time: now(),
  });
  if (clan.logs.length > 60) clan.logs.length = 60;
}

function createDirectoryClan(name, tag, options = {}) {
  const t = now() - Math.floor(Math.random() * 1000 * 60 * 60 * 12);
  return {
    id: options.id || makeId("pubclan"),
    name,
    tag,
    logo: options.logo || "👑",
    description: options.description || "Aktif clan",
    minLevel: options.minLevel ?? 1,
    members: options.members ?? (12 + Math.floor(Math.random() * 18)),
    memberCap: options.memberCap ?? 30,
    power: options.power ?? (5000 + Math.floor(Math.random() * 25000)),
    region: options.region || "GLOBAL",
    shareMin: options.shareMin ?? 4,
    shareMax: options.shareMax ?? 12,
    joinMode: options.joinMode || "request",
    createdAt: options.createdAt || t,
  };
}

function ensureClanDirectory(state) {
  if (!state.clanDirectory || typeof state.clanDirectory !== "object") state.clanDirectory = {};
  const cd = state.clanDirectory;
  if (!Array.isArray(cd.clans) || !cd.clans.length) {
    cd.clans = [
      createDirectoryClan("OTTOMAN LEGACY", "OTT", {
        logo: "🦅", description: "Disiplinli savaş kadrosu. Avrupa saatlerinde aktif.", minLevel: 3, members: 21, memberCap: 30, power: 18450
      }),
      createDirectoryClan("BLOOD FAM", "BLD", {
        logo: "🩸", description: "PVP odaklı hızlı yükseliş clanı.", minLevel: 6, members: 17, memberCap: 25, power: 14320
      }),
      createDirectoryClan("NIGHT CROWS", "NCR", {
        logo: "🌙", description: "Gece baskınları ve ekonomi paylaşımı.", minLevel: 8, members: 24, memberCap: 30, power: 21990
      }),
      createDirectoryClan("TURKISH SYNDICATE", "TRS", {
        logo: "🔥", description: "Global açılmak isteyen aktif ekip.", minLevel: 10, members: 28, memberCap: 40, power: 30210
      }),
      createDirectoryClan("VELVET ELITE", "VLT", {
        logo: "💎", description: "Ekonomi ve trade odaklı elit clan.", minLevel: 5, members: 11, memberCap: 20, power: 11120
      }),
    ];
  }
  if (!cd.player || typeof cd.player !== "object") {
    cd.player = {
      search: "",
      pendingRequest: null,
      inbox: [
        {
          id: makeId("invite"),
          clanId: cd.clans[0].id,
          clanName: cd.clans[0].name,
          clanTag: cd.clans[0].tag,
          logo: cd.clans[0].logo,
          from: "Ottoman Legacy",
          createdAt: now() - 1000 * 60 * 45,
          expiresAt: now() + 1000 * 60 * 60 * 12,
        }
      ],
    };
  }
  if (!Array.isArray(cd.player.inbox)) cd.player.inbox = [];
  return cd;
}

function ensureMemberRecord(member = {}, index = 0, fallbackName = "Player") {
  const role = member.role || (index === 0 ? "leader" : "member");
  const normalizedRole = ["leader","co_leader","officer","member"].includes(role) ? role : "member";
  return {
    id: member.id || (index === 0 ? "player_main" : makeId("member")),
    name: member.name || fallbackName,
    role: normalizedRole,
    level: Math.max(1, Number(member.level || 1)),
    power: Math.max(0, Number(member.power || 100)),
    online: !!member.online,
    lastSeen: Number(member.lastSeen || now()),
    contribution: Math.max(0, Number(member.contribution || 0)),
    rewardShare: clamp(Number(member.rewardShare ?? (normalizedRole === "leader" ? 12 : normalizedRole === "co_leader" ? 8 : 5)), 0, 25),
  };
}

function ensureClanShape(clan, fallbackPlayerName = "Player") {
  if (!clan || typeof clan !== "object") return null;

  if (typeof clan.id !== "string" || !clan.id) clan.id = makeId("clan");
  if (typeof clan.name !== "string" || !clan.name.trim()) clan.name = "NEW CLAN";
  if (typeof clan.tag !== "string" || !clan.tag.trim()) clan.tag = "NWC";
  if (typeof clan.description !== "string") clan.description = "Yeni clan.";
  if (typeof clan.logo !== "string" || !clan.logo) clan.logo = "👑";

  clan.level = Math.max(1, Number(clan.level || 1));
  clan.xp = Math.max(0, Number(clan.xp || 0));
  clan.xpNext = Math.max(100, Number(clan.xpNext || 500));
  clan.rank = Math.max(0, Number(clan.rank || 999));
  clan.power = Math.max(0, Number(clan.power || 0));
  clan.territoryCount = Math.max(0, Number(clan.territoryCount || 0));
  clan.bank = Math.max(0, Number(clan.bank || 0));
  clan.dailyIncome = Math.max(0, Number(clan.dailyIncome || 2500));

  if (!clan.upgrades || typeof clan.upgrades !== "object") clan.upgrades = {};
  clan.upgrades.memberCap = Math.max(0, Number(clan.upgrades.memberCap || 0));
  clan.upgrades.vault = Math.max(0, Number(clan.upgrades.vault || 0));
  clan.upgrades.income = Math.max(0, Number(clan.upgrades.income || 0));
  clan.upgrades.attack = Math.max(0, Number(clan.upgrades.attack || 0));
  clan.upgrades.defense = Math.max(0, Number(clan.upgrades.defense || 0));

  if (!clan.limits || typeof clan.limits !== "object") clan.limits = {};
  clan.limits.members = Math.max(1, Number(clan.limits.members || 10));
  clan.limits.vaultCapacity = Math.max(1000, Number(clan.limits.vaultCapacity || 50000));

  if (!Array.isArray(clan.members) || !clan.members.length) {
    clan.members = [{
      id: "player_main",
      name: fallbackPlayerName,
      role: "leader",
      level: 1,
      power: 100,
      online: true,
      lastSeen: now(),
      contribution: 0,
      rewardShare: 12,
    }];
  }
  clan.members = clan.members.map((m, idx) => ensureMemberRecord(m, idx, fallbackPlayerName));

  if (!Array.isArray(clan.joinRequests)) clan.joinRequests = [];
  if (!Array.isArray(clan.logs)) clan.logs = [];
  if (!clan.wars || typeof clan.wars !== "object") clan.wars = {};
  if (!Array.isArray(clan.wars.active)) clan.wars.active = [];
  if (!Array.isArray(clan.wars.history)) clan.wars.history = [];
  if (!clan.invites || typeof clan.invites !== "object") clan.invites = {};
  if (!Array.isArray(clan.invites.outgoing)) clan.invites.outgoing = [];
  if (!Array.isArray(clan.invites.incoming)) clan.invites.incoming = [];
  clan.createdAt = Number(clan.createdAt || now());
  clan.globalReady = clan.globalReady !== false;

  return clan;
}

function syncClanProtection(state) {
  const protectedByClan = !!state.clan;
  if (!state.player) state.player = {};
  if (!state.player.clanBenefits || typeof state.player.clanBenefits !== "object") {
    state.player.clanBenefits = {};
  }
  state.player.clanBenefits.buildingProtection = protectedByClan;
  return state;
}

function createDefaultBossState(clanLevel = 1) {
  const hpBase = 12000 + Math.max(0, clanLevel - 1) * 3500;
  const startedAt = now();
  const endsAt = startedAt + 24 * 60 * 60 * 1000;

  return {
    season: 1,
    raidId: makeId("bossraid"),
    name: "SOKAK KRALI",
    title: "Clan Boss",
    status: "active",
    level: Math.max(1, clanLevel),
    maxHp: hpBase,
    hp: hpBase,
    startedAt,
    endsAt,
    totalDamage: 0,
    totalSpins: 0,
    dailySpinLimit: 5,
    energyPerSpin: 6,
    lastResult: null,
    recentResults: [],
    participants: {},
    rewards: {
      killCash: 25000,
      killCoins: 250,
      contributionCashPer100: 150,
      contributionXpPer100: 8,
    },
  };
}

function ensureBossState(clan) {
  if (!clan) return null;
  const fallback = {
    season: 0,
    raidId: null,
    name: "SOKAK KRALI",
    title: "Clan Boss",
    status: "idle",
    level: 1,
    maxHp: 0,
    hp: 0,
    startedAt: 0,
    endsAt: 0,
    totalDamage: 0,
    totalSpins: 0,
    dailySpinLimit: 5,
    energyPerSpin: 6,
    lastResult: null,
    recentResults: [],
    participants: {},
    rewards: {
      killCash: 25000,
      killCoins: 250,
      contributionCashPer100: 150,
      contributionXpPer100: 8,
    },
  };

  if (!clan.boss || typeof clan.boss !== "object") {
    clan.boss = { ...fallback };
  } else {
    clan.boss = {
      ...fallback,
      ...clan.boss,
      rewards: {
        ...fallback.rewards,
        ...(clan.boss.rewards || {}),
      },
    };
  }

  const boss = clan.boss;
  if (!boss.participants || typeof boss.participants !== "object") boss.participants = {};
  if (!Array.isArray(boss.recentResults)) boss.recentResults = [];
  boss.season = Math.max(0, Number(boss.season || 0));
  boss.level = Math.max(1, Number(boss.level || clan.level || 1));
  boss.maxHp = Math.max(0, Number(boss.maxHp || 0));
  boss.hp = Math.max(0, Number(boss.hp || 0));
  boss.startedAt = Math.max(0, Number(boss.startedAt || 0));
  boss.endsAt = Math.max(0, Number(boss.endsAt || 0));
  boss.totalDamage = Math.max(0, Number(boss.totalDamage || 0));
  boss.totalSpins = Math.max(0, Number(boss.totalSpins || 0));
  boss.dailySpinLimit = Math.max(1, Number(boss.dailySpinLimit || 5));
  boss.energyPerSpin = Math.max(1, Number(boss.energyPerSpin || 6));

  if (!["idle", "active", "defeated", "expired"].includes(String(boss.status || "").toLowerCase())) {
    boss.status = boss.hp > 0 ? "active" : "idle";
  } else {
    boss.status = String(boss.status).toLowerCase();
  }

  if (!boss.raidId && boss.status === "active") boss.raidId = makeId("bossraid");
  if (boss.status === "active" && boss.maxHp <= 0) {
    const fresh = createDefaultBossState(clan.level || 1);
    clan.boss = { ...fresh, season: Math.max(1, Number(boss.season || 1)), name: boss.name || fresh.name };
    return clan.boss;
  }
  if (boss.status === "active" && boss.endsAt > 0 && now() > boss.endsAt && boss.hp > 0) boss.status = "expired";
  return boss;
}

function ensureBossParticipant(clan, playerId = "player_main", playerName = "Player") {
  const boss = ensureBossState(clan);
  if (!boss.participants[playerId]) {
    boss.participants[playerId] = {
      playerId,
      name: playerName,
      totalDamage: 0,
      spinsToday: 0,
      lastSpinDay: dayKey(),
      bestHit: 0,
      bestCombo: "-",
      lastSymbols: [],
      rewardClaimedSeasons: [],
    };
  }
  const p = boss.participants[playerId];
  const today = dayKey();
  if (p.lastSpinDay !== today) {
    p.spinsToday = 0;
    p.lastSpinDay = today;
  }
  p.totalDamage = Math.max(0, Number(p.totalDamage || 0));
  p.spinsToday = Math.max(0, Number(p.spinsToday || 0));
  p.bestHit = Math.max(0, Number(p.bestHit || 0));
  if (!p.bestCombo) p.bestCombo = "-";
  if (!Array.isArray(p.lastSymbols)) p.lastSymbols = [];
  if (!Array.isArray(p.rewardClaimedSeasons)) p.rewardClaimedSeasons = [];
  return p;
}

function rollBossSymbols() {
  const symbols = ["punch", "kick", "slap", "head"];
  return Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
}

function symbolBaseDamage(symbol) {
  switch (symbol) {
    case "punch": return 12;
    case "kick": return 14;
    case "slap": return 8;
    case "head": return 16;
    default: return 10;
  }
}

function getBossDamageMultiplierByCombo(symbols) {
  const joined = symbols.join("|");
  const allSame = symbols[0] === symbols[1] && symbols[1] === symbols[2];
  if (allSame) {
    switch (symbols[0]) {
      case "punch": return { combo: "ÜÇLÜ YUMRUK", multiplier: 2.0, flat: 10, stun: false };
      case "kick": return { combo: "ÜÇLÜ TEKME", multiplier: 2.2, flat: 14, stun: false };
      case "slap": return { combo: "ÜÇLÜ TOKAT", multiplier: 1.8, flat: 8, stun: false };
      case "head": return { combo: "ÜÇLÜ KAFA", multiplier: 2.5, flat: 18, stun: true };
      default: return { combo: "ÜÇLÜ KOMBO", multiplier: 1.8, flat: 0, stun: false };
    }
  }
  if (joined === "punch|kick|head" || joined === "head|kick|punch") return { combo: "KOMBO DARBE", multiplier: 1.35, flat: 12, stun: false };
  if (joined === "slap|punch|kick" || joined === "kick|punch|slap") return { combo: "SOKAK KOMBOSU", multiplier: 1.25, flat: 8, stun: false };
  if (joined === "head|head|punch" || joined === "punch|head|head") return { combo: "KRİTİK KAFA", multiplier: 1.65, flat: 20, stun: true };
  if (joined === "punch|punch|head" || joined === "head|punch|punch") return { combo: "KEMİK KIRAN", multiplier: 1.55, flat: 16, stun: false };
  if (joined === "kick|kick|punch" || joined === "punch|kick|kick") return { combo: "UÇAN TEKME", multiplier: 1.45, flat: 14, stun: false };
  return { combo: "Normal Vuruş", multiplier: 1.0, flat: 0, stun: false };
}

function giveBossKillRewards(state, clan) {
  const boss = ensureBossState(clan);
  boss.status = "defeated";
  state.player.cash = Number(state.player.cash || 0) + Number(boss.rewards.killCash || 0);
  state.coins = Number(state.coins || 0) + Number(boss.rewards.killCoins || 0);
  addLog(clan, "boss", `${boss.name} yenildi. Clan ödülleri dağıtıldı.`);
}

function recomputeClan(clan) {
  ensureClanShape(clan);
  clan.limits.members = getMaxMembersFromUpgrade(clan.upgrades.memberCap || 0);
  clan.limits.vaultCapacity = getVaultCapacity(clan.upgrades.vault || 0);

  const attackBonus = getAttackBonus(clan.upgrades.attack || 0);
  const defenseBonus = getDefenseBonus(clan.upgrades.defense || 0);
  const incomeBonusPercent = getIncomeBonusPercent(clan.upgrades.income || 0);

  clan.power = clan.members.reduce((sum, m) => sum + Number(m.power || 0), 0) + attackBonus * 8 + defenseBonus * 8;
  clan.dailyIncome = Math.floor(2500 * (1 + incomeBonusPercent / 100));
  clan.rank = Math.max(1, 1500 - Math.floor(clan.power / 20));
  ensureBossState(clan);
  return clan;
}

function getMe(clan) {
  return clan?.members?.find((m) => m.id === "player_main") || null;
}

function canManageClan(clan) {
  const me = getMe(clan);
  return !!me && (me.role === "leader" || me.role === "co_leader");
}

function canInvite(clan) {
  const me = getMe(clan);
  return !!me && ["leader", "co_leader", "officer"].includes(me.role);
}

export class ClanSystem {
  static hasClan(store) {
    const state = ensureRootClan(readStoreState(store));
    return !!state.clan;
  }

  static getClan(store) {
    const state = ensureRootClan(readStoreState(store));
    if (!state.clan) return null;
    const fallbackPlayerName = state.player?.name || state.player?.username || "Player";
    ensureClanShape(state.clan, fallbackPlayerName);
    ensureBossState(state.clan);
    syncClanProtection(state);
    return state.clan;
  }

  static getDirectory(store) {
    const state = ensureRootClan(readStoreState(store));
    return ensureClanDirectory(state);
  }

  static browseClans(store, query = "") {
    const directory = this.getDirectory(store);
    const q = String(query || directory.player?.search || "").trim().toLowerCase();
    const rows = Array.isArray(directory.clans) ? directory.clans.slice() : [];
    if (!q) return rows;
    return rows.filter((c) => `${c.name} ${c.tag} ${c.description}`.toLowerCase().includes(q));
  }

  static tickPending(store) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const pending = state.clanDirectory?.player?.pendingRequest;
      if (!pending || state.clan) return state;
      const elapsed = now() - Number(pending.requestedAt || 0);
      const required = Number(pending.acceptAfterMs || 15000);
      if (elapsed < required) return state;

      const clanInfo = (state.clanDirectory?.clans || []).find((c) => c.id === pending.clanId);
      if (!clanInfo) {
        state.clanDirectory.player.pendingRequest = null;
        return state;
      }

      const playerName = state.player?.name || state.player?.username || "Player";
      state.clan = {
        id: clanInfo.id,
        name: clanInfo.name,
        tag: clanInfo.tag,
        logo: clanInfo.logo || "👑",
        description: clanInfo.description || "Global clan",
        level: 1,
        xp: 0,
        xpNext: 500,
        rank: 999,
        power: clanInfo.power || 0,
        territoryCount: 0,
        bank: 10000,
        dailyIncome: 2500,
        upgrades: { memberCap: 0, vault: 0, income: 0, attack: 0, defense: 0 },
        limits: { members: Math.max(10, Number(clanInfo.memberCap || 20)), vaultCapacity: 50000 },
        members: [
          ensureMemberRecord({ id:"player_main", name:playerName, role:"member", level:Number(state.player?.level || 1), power:Number(state.player?.power || 120), online:true, contribution:0, rewardShare:5 }, 0, playerName),
          ensureMemberRecord({ name:"Boss_"+clanInfo.tag, role:"leader", level:35, power:1200, online:true, contribution:120000, rewardShare:12 }, 1, "Boss"),
          ensureMemberRecord({ name:"Officer_"+clanInfo.tag, role:"co_leader", level:28, power:900, online:false, contribution:65000, rewardShare:8 }, 2, "Officer"),
        ],
        joinRequests: [],
        logs: [],
        wars: { active: [], history: [] },
        invites: { incoming: [], outgoing: [] },
        globalReady: true,
        createdAt: now() - 1000 * 60 * 60 * 24 * 10,
        boss: createDefaultBossState(1),
      };
      state.clan.members[0].role = "member";
      ensureClanShape(state.clan, playerName);
      addLog(state.clan, "system", `${playerName} clan başvurusu kabul edildi.`);
      state.clanDirectory.player.pendingRequest = null;
      syncClanProtection(state);
      return state;
    });
  }

  static requestJoinClan(store, clanId) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      if (state.clan) return state;
      const directory = ensureClanDirectory(state);
      const clan = (directory.clans || []).find((c) => c.id === clanId);
      if (!clan) return state;
      const playerLevel = Number(state.player?.level || 1);
      if (playerLevel < Number(clan.minLevel || 1)) return state;

      directory.player.pendingRequest = {
        id: makeId("joinreq"),
        clanId: clan.id,
        clanName: clan.name,
        clanTag: clan.tag,
        logo: clan.logo || "👑",
        requestedAt: now(),
        acceptAfterMs: 15000,
      };
      return state;
    });
  }

  static cancelJoinRequest(store) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      if (state.clanDirectory?.player) state.clanDirectory.player.pendingRequest = null;
      return state;
    });
  }

  static acceptInboxInvite(store, inviteId) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const inbox = state.clanDirectory?.player?.inbox || [];
      const invite = inbox.find((x) => x.id === inviteId);
      if (!invite || state.clan) return state;
      state.clanDirectory.player.pendingRequest = {
        id: makeId("joinreq"),
        clanId: invite.clanId,
        clanName: invite.clanName,
        clanTag: invite.clanTag,
        logo: invite.logo || "👑",
        requestedAt: now() - 15000,
        acceptAfterMs: 1000,
      };
      state.clanDirectory.player.inbox = inbox.filter((x) => x.id !== inviteId);
      return state;
    });
  }

  static declineInboxInvite(store, inviteId) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const inbox = state.clanDirectory?.player?.inbox || [];
      state.clanDirectory.player.inbox = inbox.filter((x) => x.id !== inviteId);
      return state;
    });
  }

  static createClan(store, payload = {}) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      if (state.clan) return state;
      const playerLevel = Number(state.player?.level || 1);
      if (playerLevel < 10) return state;
      const cost = 50;
      if (Number(state.coins || 0) < cost) return state;

      const playerName = state.player?.name || state.player?.username || "Player";
      const clanName = String(payload.name || "NEW CLAN").trim().slice(0, 24);
      const clanTag = String(payload.tag || "NWC").trim().slice(0, 5).toUpperCase();
      const description = String(payload.description || "Yeni clan.").trim().slice(0, 120);

      state.coins = Math.max(0, Number(state.coins || 0) - cost);
      state.clan = {
        id: makeId("clan"),
        name: clanName || "NEW CLAN",
        tag: clanTag || "NWC",
        logo: String(payload.logo || "👑"),
        level: 1,
        xp: 0,
        xpNext: 500,
        description,
        rank: 999,
        power: 0,
        territoryCount: 0,
        bank: 0,
        dailyIncome: 2500,
        upgrades: { memberCap: 0, vault: 0, income: 0, attack: 0, defense: 0 },
        limits: { members: 10, vaultCapacity: 50000 },
        members: [
          {
            id: "player_main",
            name: playerName,
            role: "leader",
            level: Number(state.player?.level || 1),
            power: Number(state.player?.power || 100),
            online: true,
            lastSeen: now(),
            contribution: 0,
            rewardShare: 12,
          },
        ],
        joinRequests: [],
        logs: [],
        wars: { active: [], history: [] },
        invites: { incoming: [], outgoing: [] },
        globalReady: true,
        createdAt: now(),
        boss: { season: 0, raidId: null, name: "SOKAK KRALI", title: "Clan Boss", status: "idle", level: 1, maxHp: 0, hp: 0, startedAt: 0, endsAt: 0, totalDamage: 0, totalSpins: 0, dailySpinLimit: 5, energyPerSpin: 6, lastResult: null, recentResults: [], participants: {}, rewards: { killCash: 25000, killCoins: 250, contributionCashPer100: 150, contributionXpPer100: 8 } },
      };

      ensureClanShape(state.clan, playerName);
      addLog(state.clan, "system", `${clanName} clan kuruldu.`);
      addLog(state.clan, "economy", `50 yTon clan kurulum bedeli ödendi.`);
      recomputeClan(state.clan);

      const directory = ensureClanDirectory(state);
      directory.player.pendingRequest = null;
      directory.clans.unshift(createDirectoryClan(state.clan.name, state.clan.tag, {
        id: state.clan.id, logo: state.clan.logo, description: state.clan.description, minLevel: 1, members: 1, memberCap: state.clan.limits.members, power: state.clan.power || 100
      }));
      syncClanProtection(state);
      return state;
    });
  }

  static leaveClan(store) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;

      ensureClanShape(clan, state.player?.name || "Player");
      const me = getMe(clan);
      if (me && me.role === "leader" && clan.members.length > 1) {
        const successor = clan.members.find((m) => m.id !== "player_main");
        if (successor) successor.role = "leader";
      }
      state.clan = null;
      syncClanProtection(state);
      return state;
    });
  }

  static donateToClan(store, amount) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;
      ensureClanShape(clan, state.player?.name || "Player");
      const value = Math.max(0, Math.floor(Number(amount || 0)));
      if (!value) return state;
      if ((state.player.cash || 0) < value) return state;

      const freeSpace = clan.limits.vaultCapacity - clan.bank;
      const finalAmount = Math.min(value, freeSpace);
      if (finalAmount <= 0) return state;

      state.player.cash -= finalAmount;
      clan.bank += finalAmount;
      const me = getMe(clan);
      if (me) me.contribution = Number(me.contribution || 0) + finalAmount;
      addLog(clan, "donation", `${state.player.name || "Player"} clan kasasına $${finalAmount.toLocaleString("tr-TR")} yatırdı.`);
      recomputeClan(clan);
      return state;
    });
  }

  static promoteMember(store, memberId, role = "co_leader") {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan || !canManageClan(clan)) return state;
      ensureClanShape(clan, state.player?.name || "Player");
      const member = clan.members.find((m) => m.id === memberId);
      if (!member || member.id === "player_main") return state;
      member.role = role === "co_leader" ? "co_leader" : "officer";
      if (member.role === "co_leader" && Number(member.rewardShare || 0) < 8) member.rewardShare = 8;
      addLog(clan, "member", `${member.name} ${member.role === "co_leader" ? "kurucu yardımcısı" : "subay"} oldu.`);
      recomputeClan(clan);
      return state;
    });
  }

  static setMemberRewardShare(store, memberId, share) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan || !canManageClan(clan)) return state;
      ensureClanShape(clan, state.player?.name || "Player");
      const member = clan.members.find((m) => m.id === memberId);
      if (!member) return state;
      member.rewardShare = clamp(Number(share || 0), 0, 25);
      addLog(clan, "reward", `${member.name} ödül payı %${member.rewardShare} olarak ayarlandı.`);
      recomputeClan(clan);
      return state;
    });
  }

  static createInvite(store, playerName) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan || !canInvite(clan)) return state;
      ensureClanShape(clan, state.player?.name || "Player");
      const cleanName = String(playerName || "").trim().slice(0, 18);
      if (!cleanName) return state;
      clan.invites.outgoing.unshift({
        id: makeId("outinvite"),
        playerName: cleanName,
        sentAt: now(),
        status: "pending",
      });
      addLog(clan, "invite", `${cleanName} oyuncusuna clan daveti gönderildi.`);
      return state;
    });
  }

  static kickMember(store, memberId) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan || !canManageClan(clan)) return state;
      ensureClanShape(clan, state.player?.name || "Player");
      if (memberId === "player_main") return state;
      const index = clan.members.findIndex((m) => m.id === memberId);
      if (index === -1) return state;
      const removed = clan.members[index];
      clan.members.splice(index, 1);
      addLog(clan, "member", `${removed.name} clan'dan çıkarıldı.`);
      recomputeClan(clan);
      return state;
    });
  }

  static addMockMember(store) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;
      ensureClanShape(clan, state.player?.name || "Player");
      if (clan.members.length >= clan.limits.members) return state;
      const names = ["Efe", "Arda", "Kerem", "Bora", "Emir", "Tuna", "Deniz", "Yiğit"];
      const pick = names[Math.floor(Math.random() * names.length)];
      clan.members.push(ensureMemberRecord({
        id: makeId("member"),
        name: `${pick}_${Math.floor(Math.random() * 99)}`,
        role: "member",
        level: 1 + Math.floor(Math.random() * 10),
        power: 40 + Math.floor(Math.random() * 120),
        online: Math.random() > 0.5,
        lastSeen: now() - Math.floor(Math.random() * 1000 * 60 * 60),
        contribution: Math.floor(Math.random() * 4000),
        rewardShare: 5,
      }, clan.members.length, pick));
      addLog(clan, "member", "Yeni üye clan'a katıldı.");
      recomputeClan(clan);
      return state;
    });
  }

  static startBossRaid(store) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;
      ensureClanShape(clan, state.player?.name || "Player");
      ensureBossState(clan);
      const nextSeason = Number(clan.boss?.season || 0) + 1;
      clan.boss = createDefaultBossState(clan.level || 1);
      clan.boss.season = nextSeason;
      clan.boss.name = `SOKAK KRALI ${nextSeason}`;
      addLog(clan, "boss", `${clan.boss.name} clan boss savaşı başladı.`);
      recomputeClan(clan);
      return state;
    });
  }

  static spinBoss(store) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;
      ensureClanShape(clan, state.player?.name || "Player");
      const boss = ensureBossState(clan);
      const playerName = state.player?.name || state.player?.username || "Player";
      const playerEnergy = Number(state.player?.energy || 0);

      if (boss.status === "idle" || boss.status === "expired" || boss.maxHp <= 0 || boss.dailySpinLimit <= 0 || boss.energyPerSpin <= 0) {
        const nextSeason = Math.max(1, Number(boss.season || 0) + (boss.status === "idle" || boss.status === "expired" ? 1 : 0));
        clan.boss = createDefaultBossState(clan.level || 1);
        clan.boss.season = nextSeason;
        clan.boss.name = `SOKAK KRALI ${nextSeason}`;
      }

      if (clan.boss.status !== "active") {
        clan.boss.lastResult = { ok: false, reason: "BOSS_NOT_ACTIVE", message: "Boss aktif değil." };
        return state;
      }

      const me = ensureBossParticipant(clan, "player_main", playerName);

      if (me.spinsToday >= Number(clan.boss.dailySpinLimit || 5)) {
        clan.boss.lastResult = { ok: false, reason: "DAILY_LIMIT", message: "Günlük boss spin limitin doldu." };
        return state;
      }

      if (playerEnergy < Number(clan.boss.energyPerSpin || 6)) {
        clan.boss.lastResult = { ok: false, reason: "NO_ENERGY", message: "Yeterli enerjin yok." };
        return state;
      }

      const symbols = rollBossSymbols();
      const base = symbols.reduce((sum, s) => sum + symbolBaseDamage(s), 0);
      const comboData = getBossDamageMultiplierByCombo(symbols);
      const clanAttackBonus = Number(getAttackBonus(clan.upgrades.attack || 0));
      const memberPower = Number(clan.members.find((m) => m.id === "player_main")?.power || state.player?.power || 100);

      const powerBonus = 1 + clamp(memberPower / 1000, 0, 0.35);
      const attackBonus = 1 + clanAttackBonus / 100;
      const stunBonus = comboData.stun ? 1.1 : 1.0;
      const rawDamage = (base + comboData.flat) * comboData.multiplier * powerBonus * attackBonus * stunBonus;
      const damage = Math.max(1, Math.floor(rawDamage));

      state.player.energy = Math.max(0, playerEnergy - Number(clan.boss.energyPerSpin || 6));
      clan.boss.hp = Math.max(0, Number(clan.boss.hp || 0) - damage);
      clan.boss.totalDamage = Math.max(0, Number(clan.boss.totalDamage || 0)) + damage;
      clan.boss.totalSpins = Math.max(0, Number(clan.boss.totalSpins || 0)) + 1;
      me.spinsToday = Math.max(0, Number(me.spinsToday || 0)) + 1;
      me.totalDamage = Math.max(0, Number(me.totalDamage || 0)) + damage;
      const prevBestHit = Math.max(0, Number(me.bestHit || 0));
      me.bestHit = Math.max(prevBestHit, damage);
      me.bestCombo = damage >= prevBestHit ? comboData.combo : me.bestCombo || comboData.combo;
      me.lastSymbols = symbols.slice();

      clan.boss.lastResult = {
        ok: true,
        symbols,
        combo: comboData.combo,
        damage,
        bossHp: clan.boss.hp,
        bossMaxHp: clan.boss.maxHp,
        spinsLeft: Math.max(0, Number(clan.boss.dailySpinLimit || 5) - me.spinsToday),
        energyLeft: state.player.energy,
        stun: !!comboData.stun,
      };

      clan.boss.recentResults.unshift({
        id: makeId("bossspin"),
        playerId: "player_main",
        name: playerName,
        symbols,
        combo: comboData.combo,
        damage,
        time: now(),
      });
      if (clan.boss.recentResults.length > 12) clan.boss.recentResults.length = 12;

      addLog(clan, "boss", `${playerName} ${comboData.combo} ile boss'a ${damage.toLocaleString("tr-TR")} hasar vurdu.`);
      const gainedXp = Math.max(5, Math.floor(damage / 12));
      clan.xp = Number(clan.xp || 0) + gainedXp;
      while (clan.xp >= clan.xpNext) {
        clan.xp -= clan.xpNext;
        clan.level += 1;
        clan.xpNext = Math.floor(clan.xpNext * 1.35);
      }
      if (clan.boss.hp <= 0 && clan.boss.status === "active") {
        clan.boss.hp = 0;
        clan.boss.status = "defeated";
        giveBossKillRewards(state, clan);
      }

      recomputeClan(clan);
      return state;
    });
  }

  static getBossLeaderboard(store) {
    const clan = this.getClan(store);
    if (!clan) return [];
    const boss = ensureBossState(clan);
    return Object.values(boss.participants || {}).sort((a, b) => Number(b.totalDamage || 0) - Number(a.totalDamage || 0)).slice(0, 10);
  }

  static getBossSpinStatus(store) {
    const clan = this.getClan(store);
    if (!clan) return null;
    const boss = ensureBossState(clan);
    const state = readStoreState(store);
    const me = ensureBossParticipant(clan, "player_main", state?.player?.name || state?.player?.username || "Player");
    const dailySpinLimit = Math.max(1, Number(boss.dailySpinLimit || 5));
    const energyPerSpin = Math.max(1, Number(boss.energyPerSpin || 6));
    const spinsUsedToday = Math.max(0, Number(me.spinsToday || 0));

    return {
      bossStatus: boss.status || "idle",
      bossHp: Math.max(0, Number(boss.hp || 0)),
      bossMaxHp: Math.max(0, Number(boss.maxHp || 0)),
      dailySpinLimit,
      spinsUsedToday,
      spinsLeft: Math.max(0, dailySpinLimit - spinsUsedToday),
      energyPerSpin,
      totalDamage: Math.max(0, Number(me.totalDamage || 0)),
      bestHit: Math.max(0, Number(me.bestHit || 0)),
      bestCombo: me.bestCombo || "-",
      lastResult: boss.lastResult || null,
    };
  }

  static getTabList() {
    return ["kesfet", "clan", "uyeler", "yonetim", "log"];
  }
}
