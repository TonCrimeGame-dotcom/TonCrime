import { makeId, now } from "./ClanUtils.js";

export function createDefaultClan(playerName = "Player") {
  const t = now();

  return {
    id: makeId("clan"),
    name: "OTTOMAN",
    tag: "OTT",
    level: 1,
    xp: 120,
    xpNext: 500,
    logo: "default",
    description: "Şehirde güç kurmak isteyen düzenli ve aktif ekip.",
    rank: 128,
    power: 420,
    territoryCount: 0,
    bank: 15000,
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
        level: 8,
        power: 140,
        online: true,
        lastSeen: t,
        contribution: 5000,
      },
      {
        id: makeId("member"),
        name: "Mert",
        role: "officer",
        level: 7,
        power: 110,
        online: false,
        lastSeen: t - 1000 * 60 * 20,
        contribution: 3200,
      },
      {
        id: makeId("member"),
        name: "Kaan",
        role: "member",
        level: 5,
        power: 80,
        online: true,
        lastSeen: t,
        contribution: 1800,
      },
    ],

    joinRequests: [],
    logs: [
      {
        id: makeId("log"),
        type: "system",
        text: "Clan kuruldu.",
        time: t,
      },
      {
        id: makeId("log"),
        type: "donation",
        text: `${playerName} clan kasasına $5.000 yatırdı.`,
        time: t,
      },
    ],

    wars: {
      active: [],
      history: [],
    },
  };
}

export function createEmptyClanState() {
  return null;
}
