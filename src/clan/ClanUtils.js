export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString("tr-TR");
}

export function now() {
  return Date.now();
}

export function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function shallowClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function getRoleLabel(role) {
  switch (role) {
    case "leader":
      return "Lider";
    case "officer":
      return "Yardımcı";
    case "member":
    default:
      return "Üye";
  }
}

export function getUpgradeCost(type, level = 0) {
  const next = Number(level || 0) + 1;

  switch (type) {
    case "memberCap":
      return 5000 * next;
    case "vault":
      return 8000 * next;
    case "income":
      return 7000 * next;
    case "attack":
      return 6000 * next;
    case "defense":
      return 6000 * next;
    default:
      return 999999;
  }
}

export function getUpgradeLabel(type) {
  switch (type) {
    case "memberCap":
      return "Üye Limiti";
    case "vault":
      return "Kasa";
    case "income":
      return "Gelir";
    case "attack":
      return "Saldırı";
    case "defense":
      return "Savunma";
    default:
      return type;
  }
}

export function getMaxMembersFromUpgrade(level = 0) {
  return 10 + level * 5;
}

export function getVaultCapacity(level = 0) {
  return 50000 + level * 50000;
}

export function getIncomeBonusPercent(level = 0) {
  return level * 10;
}

export function getAttackBonus(level = 0) {
  return level * 5;
}

export function getDefenseBonus(level = 0) {
  return level * 5;
}
