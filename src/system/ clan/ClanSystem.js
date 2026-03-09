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
  if (!state.player.name) state.player.name = "Player";
  if (typeof state.player.cash !== "number") state.player.cash = 50000;
  return state;
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

  return clan;
}

function addLog(clan, type, text) {
  clan.logs = clan.logs || [];
  clan.logs.unshift({
    id: makeId("log"),
    type,
    text,
    time: now(),
  });

  if (clan.logs.length > 50) {
    clan.logs.length = 50;
  }
}

export class ClanSystem {
  static hasClan(store) {
    const state = ensureRootClan(readStoreState(store));
    return !!state.clan;
  }

  static getClan(store) {
    const state = ensureRootClan(readStoreState(store));
    return state.clan || null;
  }

  static createClan(store, payload = {}) {
    return updateStoreState(store, (state) => {
      ensureRootClan(state);

      if (state.clan) return state;

      const playerName = state.player?.name || "Player";
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

  static getTabList() {
    return ["genel", "uyeler", "kasa", "gelistirme", "log"];
  }
}
