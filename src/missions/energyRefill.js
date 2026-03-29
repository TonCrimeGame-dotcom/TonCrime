export function incrementEnergyRefillUsed(store, amount = 1) {
  if (!store || typeof store.get !== "function" || typeof store.set !== "function") return 0;

  const s = store.get() || {};
  const m = s.missions || {};
  const current = Math.max(0, Number(m.energyRefillUsed || 0));
  const next = current + Math.max(0, Number(amount || 0));

  if (next === current) return current;

  store.set({
    missions: {
      ...m,
      energyRefillUsed: next,
    },
  });

  return next;
}
