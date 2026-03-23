
function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function rewardId(prefix = "reward") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function itemReward(name, rarity, extra = {}) {
  return {
    type: "item",
    icon: extra.icon || "📦",
    label: extra.label || name,
    glow: extra.glow || "#8ab4ff",
    item: {
      id: rewardId(name.toLowerCase().replace(/\s+/g, "_")),
      kind: extra.kind || "rare",
      icon: extra.icon || "📦",
      name,
      rarity,
      qty: Number(extra.qty || 1),
      usable: !!extra.usable,
      sellable: extra.sellable !== false,
      marketable: extra.marketable !== false,
      sellPrice: Number(extra.sellPrice || 0),
      marketPrice: Number(extra.marketPrice || 0),
      desc: extra.desc || "Loot ödülü.",
      energyGain: Number(extra.energyGain || 0),
    },
  };
}

export const FREE_WHEEL_REWARDS = [
  { type: "coins", amount: 25, icon: "💰", label: "+25 YTON", glow: "#ffd166" },
  { type: "coins", amount: 40, icon: "💰", label: "+40 YTON", glow: "#ffd166" },
  { type: "energy", amount: 10, icon: "⚡", label: "+10 Enerji", glow: "#7cf7c0" },
  { type: "coins", amount: 60, icon: "💎", label: "+60 YTON", glow: "#8ab4ff" },
  itemReward("Mystery Crate", "rare", { icon: "📦", glow: "#c77dff", sellPrice: 45, marketPrice: 60, kind: "rare" }),
  { type: "energy", amount: 15, icon: "⚡", label: "+15 Enerji", glow: "#7cf7c0" },
  { type: "coins", amount: 80, icon: "💰", label: "+80 YTON", glow: "#ffd166" },
  itemReward("Adrenaline Shot", "epic", { icon: "🧪", glow: "#ff8fab", usable: true, sellPrice: 25, marketPrice: 40, energyGain: 20, marketable: true, sellable: true, kind: "energy" }),
];

export const PREMIUM_WHEEL_REWARDS = [
  { type: "coins", amount: 120, icon: "💰", label: "+120 YTON", glow: "#ffd166" },
  { type: "coins", amount: 180, icon: "💎", label: "+180 YTON", glow: "#8ab4ff" },
  { type: "energy", amount: 25, icon: "⚡", label: "+25 Enerji", glow: "#7cf7c0" },
  itemReward("Mystery Crate", "rare", { icon: "📦", glow: "#c77dff", sellPrice: 45, marketPrice: 60, kind: "rare" }),
  itemReward("Legendary Crate", "legendary", { icon: "👑", glow: "#ffcc66", sellPrice: 110, marketPrice: 165, kind: "legendary" }),
  itemReward("Golden Pass", "legendary", { icon: "👑", glow: "#ffcc66", sellPrice: 250, marketPrice: 0, marketable: false, kind: "rare" }),
  { type: "energy", amount: 40, icon: "⚡", label: "+40 Enerji", glow: "#7cf7c0" },
  { type: "coins", amount: 250, icon: "💰", label: "+250 YTON", glow: "#ffd166" },
];

export const CRATE_TABLES = {
  mystery: [
    { weight: 28, reward: { type: "coins", amount: 45, icon: "💰", label: "+45 YTON", glow: "#ffd166" } },
    { weight: 20, reward: { type: "coins", amount: 75, icon: "💎", label: "+75 YTON", glow: "#8ab4ff" } },
    { weight: 22, reward: { type: "energy", amount: 20, icon: "⚡", label: "+20 Enerji", glow: "#7cf7c0" } },
    { weight: 15, reward: itemReward("Adrenaline Shot", "epic", { icon: "🧪", glow: "#ff8fab", usable: true, sellPrice: 25, marketPrice: 40, energyGain: 20, marketable: true, sellable: true, kind: "energy" }) },
    { weight: 10, reward: itemReward("Mystery Crate", "rare", { icon: "📦", glow: "#c77dff", sellPrice: 45, marketPrice: 60, kind: "rare" }) },
    { weight: 5, reward: itemReward("Golden Pass", "legendary", { icon: "👑", glow: "#ffcc66", sellPrice: 250, marketPrice: 0, marketable: false, kind: "rare" }) },
  ],
  legendary: [
    { weight: 25, reward: { type: "coins", amount: 150, icon: "💰", label: "+150 YTON", glow: "#ffd166" } },
    { weight: 18, reward: { type: "coins", amount: 240, icon: "💎", label: "+240 YTON", glow: "#8ab4ff" } },
    { weight: 18, reward: { type: "energy", amount: 35, icon: "⚡", label: "+35 Enerji", glow: "#7cf7c0" } },
    { weight: 14, reward: itemReward("Legendary Crate", "legendary", { icon: "👑", glow: "#ffcc66", sellPrice: 110, marketPrice: 165, kind: "legendary" }) },
    { weight: 15, reward: itemReward("Golden Pass", "legendary", { icon: "👑", glow: "#ffcc66", sellPrice: 250, marketPrice: 0, marketable: false, kind: "rare" }) },
    { weight: 10, reward: itemReward("Adrenaline Shot", "epic", { icon: "🧪", glow: "#ff8fab", usable: true, sellPrice: 25, marketPrice: 40, energyGain: 20, marketable: true, sellable: true, kind: "energy" }) },
  ],
};

export function isFreeSpinReady(store) {
  const s = typeof store.get === "function" ? store.get() : store;
  return String(s?.trade?.lastFreeSpinDay || "") !== dayKey();
}

export function markFreeSpinUsed(store) {
  const s = store.get();
  store.set({ trade: { ...(s.trade || {}), lastFreeSpinDay: dayKey() } });
}

export function getWheelRewards(kind = "free") {
  return (kind === "premium" ? PREMIUM_WHEEL_REWARDS : FREE_WHEEL_REWARDS).map((x) => ({ ...x, item: x.item ? { ...x.item } : undefined }));
}

export function randomIndex(len) {
  return Math.max(0, Math.min(len - 1, Math.floor(Math.random() * len)));
}

export function rollCrateReward(kind = "mystery") {
  const table = CRATE_TABLES[kind] || CRATE_TABLES.mystery;
  const total = table.reduce((a, x) => a + Number(x.weight || 0), 0);
  let r = Math.random() * total;
  for (const entry of table) {
    r -= Number(entry.weight || 0);
    if (r <= 0) {
      const rw = entry.reward;
      return { ...rw, item: rw.item ? { ...rw.item, id: rewardId((rw.item.name || "item").toLowerCase().replace(/\s+/g, "_")) } : undefined };
    }
  }
  const rw = table[table.length - 1].reward;
  return { ...rw, item: rw.item ? { ...rw.item, id: rewardId((rw.item.name || "item").toLowerCase().replace(/\s+/g, "_")) } : undefined };
}

export function applyLootReward(store, reward, meta = {}) {
  const s = store.get();
  const trade = { ...(s.trade || {}) };
  const inventory = { ...(s.inventory || {}), items: (s.inventory?.items || []).map((x) => ({ ...x })) };
  const player = { ...(s.player || {}) };
  const patch = {};

  if (reward.type === "coins") {
    patch.coins = Number(s.coins || 0) + Number(reward.amount || 0);
  } else if (reward.type === "energy") {
    const maxEnergy = Math.max(1, Number(player.energyMax || 100));
    player.energy = clamp(Number(player.energy || 0) + Number(reward.amount || 0), 0, maxEnergy);
    patch.player = player;
  } else if (reward.type === "item" && reward.item) {
    const items = inventory.items;
    const existing = items.find((x) => x.name === reward.item.name && String(x.rarity || "") === String(reward.item.rarity || ""));
    if (existing) existing.qty = Number(existing.qty || 0) + Number(reward.item.qty || 1);
    else items.unshift({ ...reward.item });
    patch.inventory = inventory;
  }

  if (meta.freeSpinUsed) {
    trade.lastFreeSpinDay = dayKey();
    patch.trade = trade;
  }

  store.set(patch);
}

export function getInventoryCount(store, crateName) {
  const s = store.get();
  return (s.inventory?.items || []).reduce((a, x) => a + ((x.name === crateName) ? Number(x.qty || 0) : 0), 0);
}

export function consumeInventoryCrate(store, crateName) {
  const s = store.get();
  const items = (s.inventory?.items || []).map((x) => ({ ...x }));
  const idx = items.findIndex((x) => x.name === crateName && Number(x.qty || 0) > 0);
  if (idx < 0) return false;
  items[idx].qty = Number(items[idx].qty || 0) - 1;
  if (items[idx].qty <= 0) items.splice(idx, 1);
  store.set({ inventory: { ...(s.inventory || {}), items } });
  return true;
}

export function formatRewardText(reward) {
  if (!reward) return "Ödül";
  if (reward.label) return reward.label;
  if (reward.type === "coins") return `+${Number(reward.amount || 0)} YTON`;
  if (reward.type === "energy") return `+${Number(reward.amount || 0)} Enerji`;
  if (reward.type === "item") return reward.item?.name || reward.label || "Item";
  return "Ödül";
}
