export function ensureStarsEconomyState(state = {}) {
  const stars = state.stars || {};
  const balance = Math.max(0, Number(stars.balance ?? stars.gameStars ?? stars.starBalance ?? 0));
  return {
    ...stars,
    balance,
    gameStars: balance,
    withdrawable: false,
    owned: stars.owned || {},
    selectedId: stars.selectedId ?? null,
    lastClaimTs: stars.lastClaimTs || {},
    twinBonusClaimed: stars.twinBonusClaimed || {},
    diseaseUntil: Number(stars.diseaseUntil || 0),
    lastDiseaseAt: Number(stars.lastDiseaseAt || 0),
    purchases: Array.isArray(stars.purchases) ? stars.purchases : [],
    easyMatchTickets: Math.max(0, Number(stars.easyMatchTickets || 0)),
    cosmetics: {
      ...(stars.cosmetics || {}),
    },
    economyMode: "stars",
  };
}

export function applyStarsProductGrantToState(state = {}, product, payment = {}) {
  if (!product?.id) return state;

  const now = Date.now();
  const grant = product.grant || {};
  const stars = ensureStarsEconomyState(state);
  const addedStars = Math.max(0, Number(grant.gameStars ?? grant.stars ?? 0));
  const nextStars = Math.max(0, Number(stars.balance || 0) + addedStars);

  const purchaseRecord = {
    id: `stars_${product.id}_${now}`,
    productId: product.id,
    priceStars: Number(product.priceStars || 0),
    gameStars: addedStars,
    currency: "XTR",
    withdrawable: false,
    source: "telegram_stars",
    status: payment.status || "paid",
    chargeId: payment.chargeId || "",
    createdAt: now,
  };

  return {
    ...state,
    stars: {
      ...stars,
      balance: nextStars,
      gameStars: nextStars,
      withdrawable: false,
      purchases: [purchaseRecord, ...(stars.purchases || [])].slice(0, 80),
      lastPurchaseAt: now,
      lastProductId: product.id,
    },
  };
}

export function consumeEasyMatchTicketFromState(state = {}) {
  const stars = ensureStarsEconomyState(state);
  const current = Math.max(0, Number(stars.easyMatchTickets || 0));
  if (current <= 0) return { state, consumed: false };

  return {
    consumed: true,
    state: {
      ...state,
      stars: {
        ...stars,
        easyMatchTickets: current - 1,
        lastEasyMatchUsedAt: Date.now(),
      },
    },
  };
}
