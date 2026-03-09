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

function ensureRootClan(state) {
  if (!state.clan) state.clan = null;
  if (!state.player) state.player = {};
  if (!state.player.name && state.player.username) state.player.name = state.player.username;
  if (!state.player.name) state.player.name = "Player";
  if (typeof state.player.cash !== "number") state.player.cash = 50000;
  if (typeof state.player.energy !== "number") state.player.energy = 100;
  if (typeof state.player.energyMax !== "number") state.player.energyMax = 100;
  if (typeof state.coins !== "number") state.coins = 0;
  return state;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addLog(clan, type, text) {
  clan.logs = clan.logs || [];
  clan.logs.unshift({
    id: makeId("log"),
    type,
    text,
    time: now(),
  });

  if (clan.logs.length > 60) {
    clan.logs.length = 60;
  }
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
    status: "active", // idle | active | defeated | expired
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

  if (!clan.boss) {
    clan.boss = {
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
  }

  if (!clan.boss.participants) clan.boss.participants = {};
  if (!Array.isArray(clan.boss.recentResults)) clan.boss.recentResults = [];
  if (!clan.boss.rewards) {
    clan.boss.rewards = {
      killCash: 25000,
      killCoins: 250,
      contributionCashPer100: 150,
      contributionXpPer100: 8,
    };
  }

  const boss = clan.boss;

  if (boss.status === "active" && boss.endsAt > 0 && now() > boss.endsAt && boss.hp > 0) {
    boss.status = "expired";
  }

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

  return p;
}

function getBossDamageMultiplierByCombo(symbols) {
  const joined = symbols.join("|");

  const allSame = symbols[0] === symbols[1] && symbols[1] === symbols[2];
  if (allSame) {
    switch (symbols[0]) {
      case "punch":
        return { combo: "ÜÇLÜ YUMRUK", multiplier: 2.0, flat: 10, stun: false };
      case "kick":
        return { combo: "ÜÇLÜ TEKME", multiplier: 2.2, flat: 14, stun: false };
      case "slap":
        return { combo: "ÜÇLÜ TOKAT", multiplier: 1.8, flat: 8, stun: false };
      case "head":
        return { combo: "ÜÇLÜ KAFA", multiplier: 2.5, flat: 18, stun: true };
      default:
        return { combo: "ÜÇLÜ KOMBO", multiplier: 1.8, flat: 0, stun: false };
    }
  }

  if (joined === "punch|kick|head" || joined === "head|kick|punch") {
    return { combo: "KOMBO DARBE", multiplier: 1.35, flat: 12, stun: false };
  }

  if (joined === "slap|punch|kick" || joined === "kick|punch|slap") {
    return { combo: "SOKAK KOMBOSU", multiplier: 1.25, flat: 8, stun: false };
  }

  if (joined === "head|head|punch" || joined === "punch|head|head") {
    return { combo: "KRİTİK KAFA", multiplier: 1.65, flat: 20, stun: true };
  }

  if (joined === "punch|punch|head" || joined === "head|punch|punch") {
    return { combo: "KEMİK KIRAN", multiplier: 1.55, flat: 16, stun: false };
  }

  if (joined === "kick|kick|punch" || joined === "punch|kick|kick") {
    return { combo: "ZIRH KIRMA", multiplier: 1.60, flat: 15, stun: false };
  }

  if (joined === "slap|head|slap" || joined === "head|slap|head") {
    return { combo: "SERSEMLETME", multiplier: 1.40, flat: 10, stun: true };
  }

  const uniqueCount = new Set(symbols).size;
  if (uniqueCount === 3) {
    return { combo: "KARIŞIK SALDIRI", multiplier: 1.15, flat: 4, stun: false };
  }

  return { combo: "NORMAL VURUŞ", multiplier: 1.0, flat: 0, stun: false };
}

function rollBossSymbols() {
  const pool = [
    { key: "punch", weight: 32 },
    { key: "kick", weight: 27 },
    { key: "slap", weight: 24 },
    { key: "head", weight: 17 },
  ];

  const total = pool.reduce((sum, item) => sum + item.weight, 0);

  function pickOne() {
    let r = Math.random() * total;
    for (const item of pool) {
      r -= item.weight;
      if (r <= 0) return item.key;
    }
    return pool[0].key;
  }

  return [pickOne(), pickOne(), pickOne()];
}

function symbolBaseDamage(key) {
  switch (key) {
    case "slap":
      return 8;
    case "punch":
      return 12;
    case "kick":
      return 14;
    case "head":
      return 16;
    default:
      return 5;
  }
}

function recomputeClan(clan) {
  if (!clan) return null;

  clan.limits.members = getMaxMembersFromUpgrade(clan.upgrades.memberCap || 0);
  clan.limits.vaultCapacity = getVaultCapacity(clan.upgrades.vault || 0);

  const membersPower = (clan.members || []).reduce((sum, m) => sum + Number(m.power || 0), 0);
  const attackBonus = getAttackBonus(clan.upgrades.attack || 0);
  const defenseBonus = getDefenseBonus(clan.upgrades.defense || 0);
  const incomeBonusPercent = getIncomeBonusPercent(clan.upgrades.income || 0);

  clan.power = membersPower + attackBonus * 10 + defenseBonus * 10;
  clan.dailyIncome = Math.floor(2500 + clan.level * 500 + membersPower * 2 + (2500 * incomeBonusPercent) / 100);

  if (clan.bank > clan.limits.vaultCapacity) {
    clan.bank = clan.limits.vaultCapacity;
  }

  ensureBossState(clan);

  return clan;
}

function giveBossKillRewards(state, clan) {
  const boss = ensureBossState(clan);
  if (!boss || boss.status !== "defeated") return;

  const participants = Object.values(boss.participants || {});
  const my = participants.find((p) => p.playerId === "player_main");
  const myDamage = Number(my?.totalDamage || 0);

  const contributionCash = Math.floor((myDamage / 100) * boss.rewards.contributionCashPer100);
  const contributionXp = Math.floor((myDamage / 100) * boss.rewards.contributionXpPer100);

  state.player.cash = Number(state.player.cash || 0) + contributionCash;
  state.coins = Number(state.coins || 0) + Number(boss.rewards.killCoins || 0);

  clan.bank = clamp(
    Number(clan.bank || 0) + Number(boss.rewards.killCash || 0),
    0,
    clan.limits.vaultCapacity
  );

  const currentXp = Number(clan.xp || 0) + contributionXp + 150;
  clan.xp = currentXp;

  while (clan.xp >= clan.xpNext) {
    clan.xp -= clan.xpNext;
    clan.level += 1;
    clan.xpNext = Math.floor(clan.xpNext * 1.35);
  }

  addLog(
    clan,
    "boss",
    `${boss.name} indirildi! Clan kasasına $${Number(boss.rewards.killCash || 0).toLocaleString("tr-TR")} ve oyuncuya ${Number(
      boss.rewards.killCoins || 0
    ).toLocaleString("tr-TR")} coin verildi.`
  );
}

export class ClanSystem {
  static hasClan(store) {
    const state = ensureRootClan(readStoreState(store));
    return !!state.clan;
  }

  static getClan(store) {
    const state = ensureRootClan(readStoreState(store));
    if (!state.clan) return null;
    ensureBossState(state.clan);
    return state.clan;
  }

  static getBossState(store) {
    const clan = this.getClan(store);
    if (!clan) return null;
    return ensureBossState(clan);
  }

  static createClan(store, payload = {}) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);

      if (state.clan) return state;

      const playerName = state.player?.name || state.player?.username || "Player";
      const clanName = String(payload.name || "NEW CLAN").trim().slice(0, 24);
      const clanTag = String(payload.tag || "NWC").trim().slice(0, 5).toUpperCase();
      const description = String(payload.description || "Yeni clan.").trim().slice(0, 120);

      state.clan = {
        id: makeId("clan"),
        name: clanName || "NEW CLAN",
        tag: clanTag || "NWC",
        level: 1,
        xp: 0,
        xpNext: 500,
        logo: "default",
        description,
        rank: 999,
        power: 0,
        territoryCount: 0,
        bank: 0,
        dailyIncome: 2500,

        upgrades: {
          memberCap: 0,
          vault: 0,
          income: 0,
          attack: 0,
          defense: 0,
        },

        limits: {
          members: 10,
          vaultCapacity: 50000,
        },

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
          },
        ],

        joinRequests: [],
        logs: [],
        wars: {
          active: [],
          history: [],
        },

        boss: {
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
        },
      };

      addLog(state.clan, "system", `${clanName} clan kuruldu.`);
      recomputeClan(state.clan);
      return state;
    });
  }

  static leaveClan(store) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;

      const me = clan.members.find((m) => m.id === "player_main");
      if (me && me.role === "leader" && clan.members.length > 1) {
        return state;
      }

      state.clan = null;
      return state;
    });
  }

  static donateToClan(store, amount) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;

      const value = Math.max(0, Math.floor(Number(amount || 0)));
      if (!value) return state;
      if ((state.player.cash || 0) < value) return state;

      const freeSpace = clan.limits.vaultCapacity - clan.bank;
      const finalAmount = Math.min(value, freeSpace);
      if (finalAmount <= 0) return state;

      state.player.cash -= finalAmount;
      clan.bank += finalAmount;

      const me = clan.members.find((m) => m.id === "player_main");
      if (me) {
        me.contribution = Number(me.contribution || 0) + finalAmount;
      }

      addLog(clan, "donation", `${state.player.name || "Player"} clan kasasına $${finalAmount.toLocaleString("tr-TR")} yatırdı.`);
      recomputeClan(clan);
      return state;
    });
  }

  static upgrade(store, type) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;

      const currentLevel = Number(clan.upgrades?.[type] || 0);
      const cost = getUpgradeCost(type, currentLevel);

      if (clan.bank < cost) return state;

      clan.bank -= cost;
      clan.upgrades[type] = currentLevel + 1;

      addLog(clan, "upgrade", `${type} geliştirmesi seviye ${currentLevel + 1} oldu.`);
      recomputeClan(clan);
      return state;
    });
  }

  static addMockMember(store) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;
      if (clan.members.length >= clan.limits.members) return state;

      const names = ["Efe", "Arda", "Kerem", "Bora", "Emir", "Tuna", "Deniz", "Yiğit"];
      const pick = names[Math.floor(Math.random() * names.length)];

      clan.members.push({
        id: makeId("member"),
        name: `${pick}_${Math.floor(Math.random() * 99)}`,
        role: "member",
        level: 1 + Math.floor(Math.random() * 10),
        power: 40 + Math.floor(Math.random() * 120),
        online: Math.random() > 0.5,
        lastSeen: now() - Math.floor(Math.random() * 1000 * 60 * 60),
        contribution: Math.floor(Math.random() * 4000),
      });

      addLog(clan, "member", "Yeni üye clan'a katıldı.");
      recomputeClan(clan);
      return state;
    });
  }

  static kickMember(store, memberId) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;
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

  static startBossRaid(store) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);
      const clan = state.clan;
      if (!clan) return state;

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

      const boss = ensureBossState(clan);
      const playerName = state.player?.name || state.player?.username || "Player";
      const playerEnergy = Number(state.player?.energy || 0);

      if (boss.status === "idle" || boss.status === "expired") {
        clan.boss = createDefaultBossState(clan.level || 1);
        clan.boss.season = Number(boss.season || 0) + 1;
        clan.boss.name = `SOKAK KRALI ${clan.boss.season}`;
      }

      if (clan.boss.status !== "active") return state;

      const me = ensureBossParticipant(clan, "player_main", playerName);

      if (me.spinsToday >= Number(clan.boss.dailySpinLimit || 5)) {
        clan.boss.lastResult = {
          ok: false,
          reason: "DAILY_LIMIT",
          message: "Günlük boss spin limitin doldu.",
        };
        return state;
      }

      if (playerEnergy < Number(clan.boss.energyPerSpin || 6)) {
        clan.boss.lastResult = {
          ok: false,
          reason: "NO_ENERGY",
          message: "Yeterli enerjin yok.",
        };
        return state;
      }

      const symbols = rollBossSymbols();
      const base = symbols.reduce((sum, s) => sum + symbolBaseDamage(s), 0);
      const comboData = getBossDamageMultiplierByCombo(symbols);

      const clanAttackBonus = Number(getAttackBonus(clan.upgrades.attack || 0));
      const memberPower = Number(
        clan.members.find((m) => m.id === "player_main")?.power || state.player?.power || 100
      );
      const powerBonus = 1 + clamp(memberPower / 1000, 0, 0.35);
      const attackBonus = 1 + clanAttackBonus / 100;
      const stunBonus = comboData.stun ? 1.1 : 1.0;

      const rawDamage = (base + comboData.flat) * comboData.multiplier * powerBonus * attackBonus * stunBonus;
      const damage = Math.max(1, Math.floor(rawDamage));

      state.player.energy = Math.max(0, playerEnergy - Number(clan.boss.energyPerSpin || 6));
      clan.boss.hp = Math.max(0, Number(clan.boss.hp || 0) - damage);
      clan.boss.totalDamage = Number(clan.boss.totalDamage || 0) + damage;
      clan.boss.totalSpins = Number(clan.boss.totalSpins || 0) + 1;

      me.spinsToday += 1;
      me.totalDamage = Number(me.totalDamage || 0) + damage;
      me.bestHit = Math.max(Number(me.bestHit || 0), damage);
      me.bestCombo =
        damage >= Number(me.bestHit || 0) ? comboData.combo : me.bestCombo || comboData.combo;
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

      if (clan.boss.recentResults.length > 12) {
        clan.boss.recentResults.length = 12;
      }

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

    return Object.values(boss.participants || {})
      .sort((a, b) => Number(b.totalDamage || 0) - Number(a.totalDamage || 0))
      .slice(0, 10);
  }

  static getBossSpinStatus(store) {
    const clan = this.getClan(store);
    if (!clan) return null;

    const boss = ensureBossState(clan);
    const me = ensureBossParticipant(
      clan,
      "player_main",
      readStoreState(store)?.player?.name || readStoreState(store)?.player?.username || "Player"
    );

    return {
      bossStatus: boss.status,
      bossHp: boss.hp,
      bossMaxHp: boss.maxHp,
      dailySpinLimit: boss.dailySpinLimit,
      spinsUsedToday: me.spinsToday,
      spinsLeft: Math.max(0, Number(boss.dailySpinLimit || 5) - Number(me.spinsToday || 0)),
      energyPerSpin: boss.energyPerSpin,
      totalDamage: me.totalDamage || 0,
      bestHit: me.bestHit || 0,
      bestCombo: me.bestCombo || "-",
      lastResult: boss.lastResult || null,
    };
  }

  static getTabList() {
    return ["genel", "uyeler", "kasa", "gelistirme", "boss", "log"];
  }
}
