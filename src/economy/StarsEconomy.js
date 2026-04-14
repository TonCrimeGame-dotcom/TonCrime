export function ensureStarsEconomyState(state = {}) {
  const stars = state.stars || {};
  return {
    ...stars,
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
  const player = { ...(state.player || {}) };
  const stars = ensureStarsEconomyState(state);
  const wallet = { ...(state.wallet || {}) };
  const currentCoins = Math.max(0, Number(state.coins ?? state.yton ?? wallet.yton ?? 0));
  let nextCoins = currentCoins;

  if (Number(grant.yton || 0) > 0) {
    nextCoins += Number(grant.yton || 0);
  }

  if (grant.fullEnergy) {
    const maxEnergy = Math.max(1, Number(player.energyMax || 100));
    player.energy = maxEnergy;
  }

  if (grant.premium) {
    player.membership = "premium";
    player.premium = true;
    player.isPremium = true;
    player.canOwnBusiness = !!grant.canOwnBusiness;
    player.canWithdraw = false;
    if (Number(grant.levelAtLeast || 0) > 0) {
      player.level = Math.max(Number(player.level || 0), Number(grant.levelAtLeast || 0));
    }
  }

  if (Number(grant.easyMatchTickets || 0) > 0) {
    stars.easyMatchTickets = Math.max(0, Number(stars.easyMatchTickets || 0)) + Number(grant.easyMatchTickets || 0);
  }

  if (grant.cosmeticBadge) {
    stars.cosmetics = {
      ...(stars.cosmetics || {}),
      badge: String(grant.cosmeticBadge),
    };
  }

  const purchaseRecord = {
    id: `stars_${product.id}_${now}`,
    productId: product.id,
    priceStars: Number(product.priceStars || 0),
    currency: "XTR",
    withdrawable: false,
    source: "telegram_stars",
    status: payment.status || "paid",
    chargeId: payment.chargeId || "",
    createdAt: now,
  };

  return {
    ...state,
    coins: nextCoins,
    yton: nextCoins,
    premium: !!(state.premium || grant.premium),
    isPremium: !!(state.isPremium || grant.premium),
    player,
    wallet: {
      ...wallet,
      yton: nextCoins,
      tonBalance: 0,
      starsWithdrawable: false,
    },
    stars: {
      ...stars,
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
