// src/clan/ClanSystem.js

export const ClanSystem = {

  getClan(state) {
    return state.clan || null;
  },

  createClan(store, name, tag) {
    const s = store.get();

    const clan = {
      name,
      tag,
      level: 1,
      xp: 0,
      bank: 0,
      maxMembers: 20,
      members: [
        {
          id: s.player?.id || "player",
          name: s.player?.username || "Leader",
          role: "Leader",
          level: s.player?.level || 1
        }
      ],
      log: [`Clan kuruldu: ${name}`]
    };

    store.set({ clan });
  },

  donate(store, amount) {
    const s = store.get();
    const clan = s.clan;

    if (!clan) return;

    clan.bank += amount;
    clan.xp += amount;

    clan.log.push(`+${amount} TON bağış yapıldı`);

    if (clan.xp > clan.level * 1000) {
      clan.level++;
      clan.log.push(`Clan seviye atladı! (${clan.level})`);
    }

    store.set({ clan });
  },

  upgradeMembers(store) {
    const s = store.get();
    const clan = s.clan;

    if (!clan) return;

    const cost = clan.level * 500;

    if (clan.bank < cost) return;

    clan.bank -= cost;
    clan.maxMembers += 5;

    clan.log.push(`Üye limiti arttı (+5)`);

    store.set({ clan });
  },

  upgradeBank(store) {
    const s = store.get();
    const clan = s.clan;

    if (!clan) return;

    const cost = clan.level * 300;

    if (clan.bank < cost) return;

    clan.bank -= cost;

    clan.log.push(`Clan kasa bonusu yükseltildi`);

    store.set({ clan });
  },

  addMember(store, player) {
    const s = store.get();
    const clan = s.clan;

    if (!clan) return;

    if (clan.members.length >= clan.maxMembers) return;

    clan.members.push(player);

    clan.log.push(`${player.name} klana katıldı`);

    store.set({ clan });
  },

  leaveClan(store, playerId) {
    const s = store.get();
    const clan = s.clan;

    if (!clan) return;

    clan.members = clan.members.filter(m => m.id !== playerId);

    clan.log.push(`Bir üye klanı terk etti`);

    store.set({ clan });
  }

};
